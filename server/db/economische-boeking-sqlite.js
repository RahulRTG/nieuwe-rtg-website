/* SQLite-tegenhanger van pg/economische-boeking: BEGIN IMMEDIATE omvat zowel
   de economische sleutel als alle betrokken grootboekprojecties. Daardoor kan
   een tweede proces dezelfde teruggang pas zien nadat de eerste geheel is
   gecommit; na een rollback ziet het juist niets en mag de retry boeken. */
'use strict';
const { vind: heeftRegel, vindBeweging, bewegingGelijk, saldoSamen,
  boekingenSamen } = require('./economische-identiteit');
const publiceerCollectie = require('./collectie-publicatie');

module.exports = ({ db, verbinding, statements, merge3, uitStore, naarStore,
  laatsteJson, toegepast, voorcheck }) => {
  let econ = null;
  const kopie = v => JSON.parse(JSON.stringify(v));

  function economischeStatements(kv) {
    if (econ) return econ;
    kv.exec(`CREATE TABLE IF NOT EXISTS economische_boekingen(
      sleutel TEXT PRIMARY KEY, afdruk TEXT NOT NULL, antwoord TEXT NOT NULL,
      aangemaakt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
    econ = {
      lees: kv.prepare('SELECT afdruk, antwoord FROM economische_boekingen WHERE sleutel=?'),
      zet: kv.prepare('INSERT INTO economische_boekingen(sleutel,afdruk,antwoord) VALUES(?,?,?)')
    };
    return econ;
  }

  function verenig(k, lokaal, rij) {
    if (!rij) return kopie(lokaal == null ? {} : lokaal);
    const hunJson = uitStore(rij.val), hun = JSON.parse(hunJson);
    if (!laatsteJson.has(k)) return hun;
    const basisJson = laatsteJson.get(k);
    return JSON.stringify(lokaal) === basisJson ? hun : merge3(JSON.parse(basisJson), lokaal, hun);
  }

  return function boekEenmaal(invoer, werk) {
    const i = invoer || {}, sleutel = String(i.sleutel || ''), afdruk = String(i.afdruk || '');
    const collecties = Array.isArray(i.collecties) ? [...new Set(i.collecties.map(String))].sort() : [];
    if (!/^payout-terug:[a-f0-9]{64}$/.test(sleutel) || !/^[a-f0-9]{64}$/.test(afdruk) ||
        !i.identiteit || !['pay', 'bank'].includes(i.identiteit.domein) ||
        !i.identiteit.van || !i.identiteit.naar || !Number.isSafeInteger(i.identiteit.centen) ||
        !i.identiteit.soort || typeof i.identiteit.ref !== 'string' ||
        !collecties.length || collecties.some(k => !/^[a-zA-Z][a-zA-Z0-9_]{0,119}$/.test(k)) ||
        typeof werk !== 'function')
      throw new Error('Economische boeking vereist een sleutel, afdruk, collecties en synchrone bewerker.');

    const kv = verbinding(), s = statements(), es = economischeStatements(kv);
    let antwoord, bestaand = false, standen = [];
    const concept = {}, begin = new Map(), rijen = new Map();
    kv.exec('BEGIN IMMEDIATE');
    try {
      const eerder = es.lees.get(sleutel);
      if (eerder && eerder.afdruk !== afdruk) {
        kv.exec('ROLLBACK');
        return { status: 409, error: 'Deze economische sleutel hoort al bij een andere boeking.' };
      }
      for (const k of collecties) {
        const rij = s.lees.get(k) || null;
        const liveKopie = kopie(db.data[k] == null ? {} : db.data[k]);
        rijen.set(k, rij); begin.set(k, liveKopie);
        concept[k] = verenig(k, liveKopie, rij);
      }
      if (eerder) {
        antwoord = JSON.parse(uitStore(eerder.antwoord));
        if (!bewegingGelijk(i.identiteit, antwoord && antwoord.boeking) ||
            !heeftRegel(concept, collecties, antwoord)) {
          kv.exec('ROLLBACK');
          return { status: 503, code: 'ECONOMISCHE_PROJECTIE_ONTBREEKT',
            error: 'De economische sleutel bestaat, maar zijn grootboekregel ontbreekt; herstel is vereist.' };
        }
        bestaand = true;
      } else {
        if (vindBeweging(concept, collecties, i.identiteit)) {
          kv.exec('ROLLBACK');
          return { status: 503, code: 'ECONOMISCHE_SLEUTEL_ONTBREEKT',
            error: 'De grootboekregel bestaat zonder economische sleutel; herstel is vereist.' };
        }
        const liveRefs = new Map(collecties.map(k => [k, db.data[k]]));
        try {
          for (const k of collecties) db.data[k] = concept[k];
          antwoord = werk();
        } finally {
          for (const [k, v] of liveRefs) db.data[k] = v;
        }
        if (antwoord && typeof antwoord.then === 'function')
          throw new Error('De bewerker van een economische boeking mag niet asynchroon zijn.');
        if (!antwoord || antwoord.ok !== true) {
          kv.exec('ROLLBACK');
          return antwoord || { status: 500, error: 'De grootboekbewerker gaf geen bevestiging.' };
        }
        if (!bewegingGelijk(i.identiteit, antwoord.boeking) ||
            !heeftRegel(concept, collecties, antwoord)) {
          kv.exec('ROLLBACK');
          return { status: 503, code: 'ECONOMISCHE_PROJECTIE_ONTBREEKT',
            error: 'De economische bewerker leverde geen overeenkomende grootboekregel.' };
        }
        for (const k of collecties) {
          const waarde = concept[k], json = JSON.stringify(waarde);
          s.bump.run();
          const ver = Number(s.huidig.get().v);
          s.up.run(k, naarStore(json), ver);
          standen.push({ k, waarde, json, ver });
        }
        es.zet.run(sleutel, afdruk, naarStore(JSON.stringify(antwoord)));
      }
      kv.exec('COMMIT');
    } catch (e) {
      try { kv.exec('ROLLBACK'); } catch (x) {}
      throw e;
    }
    if (bestaand) for (const k of collecties) {
      const rij = rijen.get(k), waarde = concept[k];
      standen.push({ k, waarde, json: rij ? uitStore(rij.val) : JSON.stringify(waarde),
        ver: rij && Number(rij.ver) });
    }
    for (const x of standen) {
      const combineer = /Saldi$/.test(x.k) ? saldoSamen(begin.get(x.k)) :
        (/Boekingen$/.test(x.k) ? boekingenSamen : undefined);
      publiceerCollectie({ dataNu: db.data, sleutel: x.k,
        basisJson: JSON.stringify(begin.get(x.k)), commitWaarde: x.waarde,
        commitJson: x.json, versie: x.ver, toegepast, laatsteJson, combineer });
      voorcheck.vergeet(x.k);
    }
    return bestaand ? Object.assign({}, antwoord, { herhaald: true }) : antwoord;
  };
};
