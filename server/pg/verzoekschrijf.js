/* PostgreSQL-opslag, deel "verzoekschrijf": een lijst requestwijzigingen
   samenvoegen en wegschrijven BINNEN een transactie die de aanroeper al open
   heeft, en ze daarna publiceren.

   WAAROM DIT UIT ./verzoektransactie.js KWAM. Er zijn drie plekken die tijdens
   een HTTP-verzoek een PostgreSQL-commit doen: de requestcommit zelf, de
   collectietransactie (./collectietransactie.js) en de economische boeking
   (./economische-boeking.js). De laatste twee committen MIDDEN in het verzoek,
   voor de requestcommit -- en daar stond het auditspoor van dat verzoek nog
   niet in. Een mutatie kon zo vaststaan terwijl haar spoor bij een mislukte
   requestcommit verdween (audit P0-1: een kascode met een 503 die toch gecommit
   was, en een ongewijzigd handelingLog). De vroege paden nemen de spoorregels
   van het verzoek daarom mee in HUN transactie, en dat moet met precies dezelfde
   samenvoeging als de requestcommit: twee mergeregels voor dezelfde collectie
   lopen uiteen bij de eerste wijziging. Vandaar een plek.

   Vergrendelen doet de AANROEPER, in een vaste volgorde over al zijn sleutels
   (zie ./verzoektransactie.js); deze helper neemt de sloten nog eens, en een
   advisory xact-slot dat de sessie al heeft, is een no-op. */
'use strict';

const { KANAAL } = require('./schrijflanen');

module.exports = (ctx, voegSamen) => {
  const { uitStore, naarStore, toegepast, laatsteJson,
    laatsteGrootte, laatsteLengte, laatsteCheck } = ctx;
  const lengte = v => Array.isArray(v) ? v.length :
    (v && typeof v === 'object' ? Object.keys(v).length : 0);
  const fout = (code, tekst) => Object.assign(new Error(tekst), { code });

  function sorteer(wijzigingen) {
    const lijst = (Array.isArray(wijzigingen) ? wijzigingen : []).slice()
      .sort((a, b) => a.sleutel.localeCompare(b.sleutel));
    for (const w of lijst) {
      if (!/^[A-Za-z_$][A-Za-z0-9_$-]{0,119}$/.test(String(w.sleutel || '')))
        throw fout('PG_REQUEST_SLEUTEL', 'Ongeldige collectie in requestcommit.');
    }
    return lijst;
  }

  /* Binnen de open transactie van `client`. Geeft de publicaties terug; die
     mogen pas NA de COMMIT naar de levende werkkopie. */
  async function schrijfIn(client, lijst) {
    const publicaties = [];
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
    return publicaties;
  }

  /* Publiceer pas na COMMIT. Een versie die ouder is dan wat deze instance al
     toepaste, schrijft niet terug: de vroege paden draaien buiten het
     opslag-slot van de requestcommit, en een latere commit van een ander
     verzoek mag niet door een eerdere worden overschreven. */
  function publiceer(dataNu, publicaties) {
    for (const p of publicaties) {
      if (p.versie != null && Number(toegepast.get(p.sleutel) || 0) > p.versie) continue;
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
  }

  return { sorteer, schrijfIn, publiceer };
};
