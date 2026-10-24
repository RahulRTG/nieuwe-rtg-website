/* De bestaande SQLite-collectiepoort: een string bewerkt één collectie,
   een typed descriptor bewerkt meerdere collecties onder één BEGIN IMMEDIATE.
   Het stringcontract, inclusief expliciete grafsteen-herschepping, blijft staan. */
'use strict';
const publiceerCollectie = require('./collectie-publicatie');
const contractVan = require('./collectie-contract');
const { merge3 } = require('./merge');
const { melder } = require('./botsing');

module.exports = ({ db, verbinding, statements, uitStore, naarStore,
  laatsteJson, toegepast, voorcheck, mutaties }) => function collectieSlotSqlite(sleutel, werk) {
  const contract = contractVan(sleutel, werk);
  if (!db.writable) throw new Error('De SQLite-opslag is niet schrijfbaar.');
  const kv = verbinding();
  const { bump, huidig, lees: leesCollectie, up } = statements();
  const waarden = Object.create(null), standen = [];
  let antwoord;
  kv.exec('BEGIN IMMEDIATE');
  try {
    for (const k of contract.sleutels) {
      const gevonden = leesCollectie.get(k), grafsteen = !!(gevonden && gevonden.deleted);
      if (grafsteen) contract.verwijderd(k);
      const rij = gevonden && !grafsteen ? gevonden : null;
      // De oude stringpoort mag een grafsteen opnieuw vullen, uitsluitend
      // vanaf leeg. Getypeerde ontvangsten weigeren de grafsteen hierboven.
      const leeg = Array.isArray(db.data[k]) ? [] : contract.leeg(k);
      const jsonVoor = rij ? uitStore(rij.val)
        : JSON.stringify(grafsteen ? leeg : (contract.getypeerd || db.data[k] == null ? contract.leeg(k) : db.data[k]));
      // Typed: een lokale beginstand zonder KV-rij is nog niet duurzaam.
      // De merge neemt hem mee als delta die deze transactie moet vastleggen.
      const dbBasis = JSON.parse(jsonVoor);
      contract.controleer(k, dbBasis);
      if (contract.getypeerd && Object.hasOwn(db.data, k)) contract.controleer(k, db.data[k]);
      const liveVoor = db.data[k] == null ? (Array.isArray(dbBasis) ? [] : {}) : db.data[k];
      const cacheBasis = laatsteJson.has(k)
        ? JSON.parse(laatsteJson.get(k)) : (Array.isArray(liveVoor) ? [] : {});
      contract.controleer(k, cacheBasis);
      // Een nooit ingelezen bak is geen lokale verwijdering van verse DB-data.
      const liveMerge = db.data[k] == null && !laatsteJson.has(k) ? dbBasis : liveVoor;
      waarden[k] = grafsteen ? JSON.parse(jsonVoor)
        : JSON.parse(JSON.stringify(merge3(cacheBasis, liveMerge, dbBasis, melder(k))));
      contract.controleer(k, waarden[k]);
      standen.push({ k, gevonden, grafsteen, jsonVoor,
        publicatieBasisJson: JSON.stringify(liveVoor), versieNa: null });
    }
    antwoord = contract.getypeerd
      ? werk(waarden, contract.context(standen.map(s => [s.k, !!s.gevonden && !s.grafsteen]))) : werk(waarden[contract.sleutels[0]]);
    if (antwoord && typeof antwoord.then === 'function')
      throw new Error('De bewerker van een collectietransactie mag niet asynchroon zijn.');
    contract.controleerMap(waarden);
    for (const s of standen) {
      s.jsonNa = JSON.stringify(waarden[s.k]);
      s.waardeNa = contract.getypeerd ? JSON.parse(s.jsonNa) : waarden[s.k];
      if (s.jsonNa !== s.jsonVoor) {
        bump.run(); s.versieNa = huidig.get().v;
        up.run(s.k, naarStore(s.jsonNa), s.versieNa);
      } else if (s.gevonden) s.versieNa = s.gevonden.ver;
    }
    kv.exec('COMMIT');
  } catch (e) {
    try { kv.exec('ROLLBACK'); } catch (x) {}
    throw e;
  }
  for (const s of standen) {
    if (s.grafsteen && s.jsonNa === s.jsonVoor && s.versieNa != null) {
      // Een string-no-op boven een grafsteen schept niets opnieuw.
      delete db.data[s.k]; toegepast.set(s.k, Number(s.versieNa));
      mutaties.vergeet(s.k); voorcheck.vergeet(s.k);
      continue;
    }
    publiceerCollectie({ dataNu: db.data, sleutel: s.k, basisJson: s.publicatieBasisJson,
      commitWaarde: s.waardeNa, commitJson: s.jsonNa, versie: s.versieNa, toegepast, laatsteJson });
    voorcheck.vergeet(s.k);
  }
  return antwoord;
};
