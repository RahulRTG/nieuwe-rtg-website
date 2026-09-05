/* Een economische sleutel en zijn grootboekmutatie in DEZELFDE PostgreSQL-
   transactie. De sleutel vooraf claimen is uitdrukkelijk niet genoeg: een crash
   tussen claim en boeking zou dan geld missen. Daarom worden de twee
   grootboekprojecties en het antwoord samen gecommit, onder een database-slot
   dat ook over losse app-processen heen werkt. */
'use strict';

const { KANAAL } = require('./schrijflanen');
const { vind: heeftRegel, vindBeweging, bewegingGelijk, saldoSamen,
  boekingenSamen } = require('../db/economische-identiteit');
const publiceerCollectie = require('../db/collectie-publicatie');

module.exports = (ctx) => {
  const { pool, merge3, uitStore, naarStore, toegepast, laatsteJson,
    laatsteGrootte, laatsteLengte, laatsteCheck } = ctx;

  const lengte = v => Array.isArray(v) ? v.length :
    (v && typeof v === 'object' ? Object.keys(v).length : 0);
  const kopie = v => JSON.parse(JSON.stringify(v));

  function geldig(invoer, werk) {
    const i = invoer || {};
    if (!/^payout-terug:[a-f0-9]{64}$/.test(String(i.sleutel || '')) ||
        !/^[a-f0-9]{64}$/.test(String(i.afdruk || '')) ||
        !i.identiteit || !['pay', 'bank'].includes(i.identiteit.domein) ||
        !i.identiteit.van || !i.identiteit.naar || !Number.isSafeInteger(i.identiteit.centen) ||
        !i.identiteit.soort || typeof i.identiteit.ref !== 'string' ||
        !Array.isArray(i.collecties) || !i.collecties.length ||
        i.collecties.some(k => !/^[a-zA-Z][a-zA-Z0-9_]{0,119}$/.test(String(k))) ||
        typeof werk !== 'function') {
      throw new Error('Economische boeking vereist een sleutel, afdruk, collecties en synchrone bewerker.');
    }
  }

  /* Kies de databasewaarheid, maar neem lokale nog-niet-geflushe wijzigingen
     mee wanneer we een bekende basis hebben. Zonder bekende basis wint de
     database: een willekeurige oude processnapshot mag nooit geld terugzetten. */
  function verenig(k, lokaal, rij) {
    const bestaat = rij && !rij.weg;
    if (!bestaat) return rij ? {} : kopie(lokaal == null ? {} : lokaal);
    const hunJson = uitStore(rij.val);
    const hun = JSON.parse(hunJson);
    if (!laatsteJson.has(k)) return hun;
    const basisJson = laatsteJson.get(k);
    return JSON.stringify(lokaal) === basisJson ? hun : merge3(JSON.parse(basisJson), lokaal, hun);
  }


  async function boekEenmaal(dataNu, invoer, werk) {
    geldig(invoer, werk);
    const sleutel = String(invoer.sleutel), afdruk = String(invoer.afdruk);
    const collecties = [...new Set(invoer.collecties.map(String))].sort();
    const client = await pool.connect();
    let gecommit = false, antwoord, standen = [], bestaand = false;
    const rijen = new Map(), concept = {}, begin = new Map();
    try {
      await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1)::bigint)', ['economisch:' + sleutel]);
      const eerder = await client.query(
        'SELECT afdruk, antwoord FROM economische_boekingen WHERE sleutel=$1', [sleutel]);
      if (eerder.rows.length && eerder.rows[0].afdruk !== afdruk) {
        await client.query('ROLLBACK');
        return { status: 409, error: 'Deze economische sleutel hoort al bij een andere boeking.' };
      }
      /* Dezelfde vaste volgorde als de gewone PostgreSQL-schrijflanen voorkomt
         een deadlock wanneer een flush en een economische commit elkaar raken. */
      for (const k of collecties)
        await client.query('SELECT pg_advisory_xact_lock(hashtext($1)::bigint)', [k]);
      for (const k of collecties) {
        const r = await client.query('SELECT val, ver, weg FROM kv WHERE key=$1 FOR UPDATE', [k]);
        rijen.set(k, r.rows[0] || null);
      }
      /* Alle I/O is klaar voordat de callback de tijdelijke projecties ziet.
         De refs worden in dezelfde synchrone event-loop-tik teruggezet: geen
         ander verzoek kan half-gecommitte db.data waarnemen of muteren. */
      const liveRefs = new Map();
      for (const k of collecties) {
        liveRefs.set(k, dataNu[k]);
        const liveKopie = kopie(dataNu[k] == null ? {} : dataNu[k]);
        concept[k] = verenig(k, liveKopie, rijen.get(k));
        begin.set(k, liveKopie);
      }
      if (eerder.rows.length) {
        antwoord = JSON.parse(uitStore(eerder.rows[0].antwoord));
        if (!bewegingGelijk(invoer.identiteit, antwoord && antwoord.boeking) ||
            !heeftRegel(concept, collecties, antwoord)) {
          await client.query('ROLLBACK');
          return { status: 503, code: 'ECONOMISCHE_PROJECTIE_ONTBREEKT',
            error: 'De economische sleutel bestaat, maar zijn grootboekregel ontbreekt; herstel is vereist.' };
        }
        bestaand = true;
      } else {
        if (vindBeweging(concept, collecties, invoer.identiteit)) {
          await client.query('ROLLBACK');
          return { status: 503, code: 'ECONOMISCHE_SLEUTEL_ONTBREEKT',
            error: 'De grootboekregel bestaat zonder economische sleutel; herstel is vereist.' };
        }
        try {
          for (const k of collecties) dataNu[k] = concept[k];
          antwoord = werk();
        } finally {
          for (const [k, v] of liveRefs) dataNu[k] = v;
        }
        if (antwoord && typeof antwoord.then === 'function')
          throw new Error('De bewerker van een economische boeking mag niet asynchroon zijn.');
        if (!antwoord || antwoord.ok !== true) {
          await client.query('ROLLBACK');
          return antwoord || { status: 500, error: 'De grootboekbewerker gaf geen bevestiging.' };
        }
        if (!bewegingGelijk(invoer.identiteit, antwoord.boeking) ||
            !heeftRegel(concept, collecties, antwoord)) {
          await client.query('ROLLBACK');
          return { status: 503, code: 'ECONOMISCHE_PROJECTIE_ONTBREEKT',
            error: 'De economische bewerker leverde geen overeenkomende grootboekregel.' };
        }
        for (const k of collecties) {
          const waarde = concept[k], json = JSON.stringify(waarde);
          const nv = await client.query("SELECT nextval('kv_ver_seq') AS v");
          const ver = Number(nv.rows[0].v);
          await client.query(
            `INSERT INTO kv(key,val,ver,bijgewerkt,weg) VALUES($1,$2,$3,now(),false)
             ON CONFLICT(key) DO UPDATE SET val=EXCLUDED.val,ver=EXCLUDED.ver,bijgewerkt=now(),weg=false`,
            [k, naarStore(json), ver]);
          await client.query('SELECT pg_notify($1,$2)', [KANAAL, k]);
          standen.push({ k, basis: begin.get(k), waarde, json, ver });
        }
        await client.query(
          'INSERT INTO economische_boekingen(sleutel,afdruk,antwoord) VALUES($1,$2,$3)',
          [sleutel, afdruk, naarStore(JSON.stringify(antwoord))]);
      }
      await client.query('COMMIT');
      gecommit = true;
    } catch (e) {
      if (!gecommit) try { await client.query('ROLLBACK'); } catch (x) {}
      throw e;
    } finally { client.release(); }

    /* Caches pas NA COMMIT bijwerken. Op het herhaalpad blijft dbJson de
       databasebasis en mag een eventueel lokaal openstaand verschil later nog
       door de gewone merge worden weggeschreven. */
    if (bestaand) {
      for (const k of collecties) {
        const rij = rijen.get(k);
        const waarde = concept[k], json = rij && !rij.weg ? uitStore(rij.val) : JSON.stringify(waarde);
        standen.push({ k, basis: begin.get(k), waarde, json, ver: rij && rij.ver });
      }
    }
    for (const s of standen) {
      const combineer = /Saldi$/.test(s.k) ? saldoSamen(s.basis) :
        (/Boekingen$/.test(s.k) ? boekingenSamen : undefined);
      const publicatie = publiceerCollectie({ dataNu, sleutel: s.k,
        basisJson: JSON.stringify(s.basis), commitWaarde: s.waarde,
        commitJson: s.json, versie: s.ver, toegepast, laatsteJson, combineer });
      if (publicatie.cacheBijgewerkt) {
        laatsteGrootte.set(s.k, s.json.length);
        laatsteLengte.set(s.k, lengte(s.waarde));
        laatsteCheck.set(s.k, Date.now());
      }
    }
    return bestaand ? Object.assign({}, antwoord, { herhaald: true }) : antwoord;
  }

  return { boekEenmaal };
};
