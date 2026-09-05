/* Eén duurzame PostgreSQL-commit voor alle gewone collecties die door één
   HTTP-verzoek zijn gewijzigd. De request werkt op een geisoleerde kopie;
   hierdoor komt niets in db.data vóór COMMIT en kan rollback niets uit een
   andere request terugdraaien.

   Locks staan altijd op collectienaam gesorteerd. Dat is ook de volgorde van
   de bestaande flush/economische banen en voorkomt een kruisdeadlock. */
'use strict';

const { KANAAL } = require('./schrijflanen');
const { voegVeilig } = require('./verzoekmerge');

module.exports = (ctx) => {
  const { pool, uitStore, naarStore, toegepast, laatsteJson,
    laatsteGrootte, laatsteLengte, laatsteCheck } = ctx;
  const lengte = v => Array.isArray(v) ? v.length :
    (v && typeof v === 'object' ? Object.keys(v).length : 0);
  const fout = (code, tekst) => Object.assign(new Error(tekst), { code });

  function voegSamen(w, rij) {
    const dbBestaat = !!rij && !rij.weg;
    const basis = w.basisBestaat ? JSON.parse(w.basisJson) : undefined;
    const ons = w.waardeBestaat ? JSON.parse(w.waardeJson) : undefined;
    const hunJson = dbBestaat ? uitStore(rij.val) : null;
    const hun = dbBestaat ? JSON.parse(hunJson) : undefined;

    /* Een verwijdering of grafsteen die deze request nog niet zag mag niet door
       een verouderde werkkopie herrijzen. Omgekeerd mag een verwijdering niet
       stil een gelijktijdige wijziging van een ander proces uitwissen. */
    if (w.basisBestaat && !dbBestaat) {
      if (!w.waardeBestaat) return { bestaat: false, waarde: undefined, dbJson: null };
      throw fout('PG_REQUEST_CONFLICT', 'De collectie is tijdens dit verzoek verwijderd; opnieuw laden is vereist.');
    }
    if (!w.waardeBestaat) {
      if (!w.basisBestaat) return { bestaat: dbBestaat, waarde: hun, dbJson: hunJson };
      if (JSON.stringify(basis) !== hunJson)
        throw fout('PG_REQUEST_CONFLICT', 'De collectie veranderde tijdens de verwijdering; opnieuw laden is vereist.');
      return { bestaat: false, waarde: undefined, dbJson: null };
    }
    if (!dbBestaat && w.basisBestaat)
      throw fout('PG_REQUEST_DRIFT', 'De lokale collectie ontbreekt in PostgreSQL; herstel is vereist.');
    const waarde = dbBestaat ? voegVeilig(basis, ons, hun, w.sleutel) : ons;
    return { bestaat: true, waarde, dbJson: JSON.stringify(waarde) };
  }

  async function commitVerzoek(dataNu, wijzigingen) {
    if (!Array.isArray(wijzigingen) || !wijzigingen.length) return { geschreven: 0, sleutels: [] };
    const lijst = wijzigingen.slice().sort((a, b) => a.sleutel.localeCompare(b.sleutel));
    for (const w of lijst) {
      if (!/^[A-Za-z_$][A-Za-z0-9_$-]{0,119}$/.test(String(w.sleutel || '')))
        throw fout('PG_REQUEST_SLEUTEL', 'Ongeldige collectie in requestcommit.');
    }
    const client = await pool.connect();
    const publicaties = [];
    let gecommit = false;
    try {
      await client.query('BEGIN');
      for (const w of lijst)
        await client.query('SELECT pg_advisory_xact_lock(hashtext($1)::bigint)', [w.sleutel]);
      for (const w of lijst) {
        const q = await client.query('SELECT val, ver, weg FROM kv WHERE key=$1 FOR UPDATE', [w.sleutel]);
        const rij = q.rows[0] || null;
        if (rij && rij.weg && Number(rij.ver) > Number(toegepast.get(w.sleutel) || 0) && w.basisBestaat)
          throw fout('PG_REQUEST_GRAFSTEEN', 'Een nieuwere verwijdering moet eerst worden ingelezen.');
        const samen = voegSamen(w, rij);
        const zelfde = samen.bestaat === (!!rij && !rij.weg) &&
          (!samen.bestaat || samen.dbJson === uitStore(rij.val));
        let versie = rij ? Number(rij.ver) : null;
        if (!zelfde) {
          const nv = await client.query("SELECT nextval('kv_ver_seq') AS v");
          versie = Number(nv.rows[0].v);
          if (samen.bestaat) {
            await client.query(
              `INSERT INTO kv(key,val,ver,bijgewerkt,weg) VALUES($1,$2,$3,now(),false)
               ON CONFLICT(key) DO UPDATE SET val=EXCLUDED.val,ver=EXCLUDED.ver,bijgewerkt=now(),weg=false`,
              [w.sleutel, naarStore(samen.dbJson), versie]);
          } else {
            await client.query(
              `INSERT INTO kv(key,val,ver,bijgewerkt,weg) VALUES($1,'',$2,now(),true)
               ON CONFLICT(key) DO UPDATE SET val='',ver=EXCLUDED.ver,bijgewerkt=now(),weg=true`,
              [w.sleutel, versie]);
          }
          await client.query('SELECT pg_notify($1,$2)', [KANAAL, w.sleutel]);
        }
        publicaties.push({ sleutel: w.sleutel, ...samen, versie });
      }
      await client.query('COMMIT');
      gecommit = true;
    } catch (e) {
      if (!gecommit) try { await client.query('ROLLBACK'); } catch (x) {}
      throw e;
    } finally { client.release(); }

    /* Publiceer pas na COMMIT. Alle lokale commitbanen delen één opslag-slot;
       daardoor is deze assignment de recentste autoritatieve DB-versie en
       kan geen oudere lokale publicatie er later overheen schrijven. */
    for (const p of publicaties) {
      if (p.bestaat) dataNu[p.sleutel] = p.waarde;
      else delete dataNu[p.sleutel];
      if (p.bestaat) laatsteJson.set(p.sleutel, p.dbJson);
      else laatsteJson.delete(p.sleutel);
      if (p.versie != null) toegepast.set(p.sleutel, p.versie);
      if (p.bestaat) {
        laatsteGrootte.set(p.sleutel, p.dbJson.length);
        laatsteLengte.set(p.sleutel, lengte(p.waarde));
        laatsteCheck.set(p.sleutel, Date.now());
      } else {
        laatsteGrootte.delete(p.sleutel); laatsteLengte.delete(p.sleutel); laatsteCheck.delete(p.sleutel);
      }
    }
    return { geschreven: publicaties.length, sleutels: publicaties.map(p => p.sleutel) };
  }

  /* Alleen voor mutaties buiten een HTTP-context. Zij krijgen nooit een 2xx,
     maar moeten wel veilig kunnen landen terwijl de verkeerspoort dicht is.
     Vergelijk tegen de laatst bevestigde DB-json en laat dezelfde atomaire
     multi-collectiecommit het werk doen. */
  function openstaandeWijzigingen(dataNu) {
    const uit = [], sleutels = new Set([...Object.keys(dataNu || {}), ...laatsteJson.keys()]);
    for (const sleutel of sleutels) {
      const basisBestaat = laatsteJson.has(sleutel);
      const basisJson = basisBestaat ? laatsteJson.get(sleutel) : null;
      const waardeBestaat = !!dataNu && Object.prototype.hasOwnProperty.call(dataNu, sleutel);
      const waardeJson = waardeBestaat ? JSON.stringify(dataNu[sleutel]) : null;
      if (basisBestaat === waardeBestaat && basisJson === waardeJson) continue;
      uit.push({ sleutel, basisBestaat, basisJson, waardeBestaat, waardeJson });
    }
    return uit.sort((a, b) => a.sleutel.localeCompare(b.sleutel));
  }

  return { commitVerzoek, openstaandeWijzigingen };
};
