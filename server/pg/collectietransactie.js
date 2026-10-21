/* PostgreSQL-opslag, deel "collectietransactie": één autoritatieve
   read-modify-write op een top-level collectie.

   Afgesplitst uit ./index.js, dat daarmee over de tien kilobyte ging. Het is ook
   een eigen onderwerp: index.js gaat over verbinden, laden en luisteren, en dit
   gaat over één ding -- een mutatie die niet mag racen.

   WAAROM DIT PAD BESTAAT. Dit is bedoeld voor gedeelde toestand met een
   revisiecontract (zoals Magnaat-teamkamers): de gewone write-behind merge kan
   twee gelijktijdige mutaties wel samenvoegen, maar kan niet voorkomen dat twee
   instances dezelfde revisie allebei accepteren. Het advisory slot en de
   rijvergrendeling maken lezen, controleren en schrijven hier één
   database-transactie.

   `werk` is bewust synchroon. Geen await binnen het slot betekent dat de
   kritieke sectie klein en controleerbaar blijft. De lokale werkkopie wordt pas
   NA COMMIT vervangen; bij een fout of rollback lekt dus geen half uitgevoerde
   mutatie naar db.data of naar een volgende save(). */
'use strict';
const klok = require('../lib/klok');
const { KANAAL } = require('./schrijflanen');
const publiceerCollectie = require('../db/collectie-publicatie');
const { merge3 } = require('../db/merge');
const contractVan = require('../db/collectie-contract');

module.exports = (ctx, schrijver) => {
  const { pool, uitStore, naarStore, toegepast, laatsteJson,
          laatsteGrootte, laatsteLengte, laatsteCheck } = ctx;

  /* HET SPOOR GAAT MEE IN DEZE TRANSACTIE (audit P0-1).

     Deze commit valt MIDDEN in een HTTP-verzoek, voor de requestcommit die het
     auditspoor van dat verzoek draagt. Zonder `spoor` stond de mutatie dus vast
     terwijl haar spoor nog in de werkkopie zat -- en bij een mislukte
     requestcommit (of een foutantwoord, dat hem overslaat) verdween. `spoor`
     zijn de requestwijzigingen van de auditcollecties
     (db/verzoekspoor.js levert ze); ze landen hier met dezelfde samenvoeging
     als in de requestcommit (./verzoekschrijf.js) en in DEZELFDE transactie.
     Faalt het spoor -- een gebroken keten, een conflict, een trigger -- dan
     rolt de mutatie mee terug. Alleen als de collectie werkelijk verandert,
     gaat het spoor mee: een bewerker die niets wijzigde, heeft niets
     vastgelegd waar een regel bij hoort. */
  async function bewerkCollectie(sleutel, dataNu, werk, spoor) {
    const contract = contractVan(sleutel, werk), sleutels = contract.sleutels;
    const spoorLijst = spoor && schrijver
      ? schrijver.sorteer((spoor.wijzigingen || []).filter(w => !sleutels.includes(w.sleutel))) : [];
    if (spoor) spoor.geschreven = false;
    const client = await pool.connect();
    const waarden = Object.create(null), standen = [];
    let resultaat, spoorPublicaties = [];
    try {
      await client.query('BEGIN');
      // Alle domein- EN auditsloten vóór de eerste lezing, in dezelfde vaste
      // volgorde als de requestcommit: geen kruisdeadlock of halfverse check.
      for (const k of [...new Set([...sleutels, ...spoorLijst.map(w => w.sleutel)])].sort())
        await client.query('SELECT pg_advisory_xact_lock(hashtext($1)::bigint)', [k]);
      const rijen = new Map();
      for (const k of sleutels) {
        const huidig = await client.query('SELECT val, ver, weg FROM kv WHERE key = $1 FOR UPDATE', [k]);
        rijen.set(k, huidig.rows[0]);
      }
      // Pas na ALLE database-I/O de levende waarden samen kopiëren. Anders
      // kan één lokale synchrone mutatie tussen twee SELECTs een halfoud paar
      // in de callback opleveren, ondanks correcte databasevergrendeling.
      for (const k of sleutels) {
        const rij = rijen.get(k), grafsteen = !!(rij && rij.weg);
        if (grafsteen) contract.verwijderd(k);
        // Stringcallers houden hun bestaande herscheppad. Een typed contract
        // weigert een grafsteen hierboven, zodat een receipt niet verdwijnt.
        const jsonVoor = rij && !grafsteen ? uitStore(rij.val)
          : JSON.stringify(grafsteen ? {} : (contract.getypeerd || dataNu[k] == null ? contract.leeg(k) : dataNu[k]));
        // Bij een typed contract is lokale beginstand nog GEEN duurzame
        // DB-basis. Neem die via merge mee en schrijf hem samen met de andere
        // bakken; anders kan een receipt naar een RAM-only object wijzen.
        const dbBasis = JSON.parse(jsonVoor);
        contract.controleer(k, dbBasis);
        if (contract.getypeerd && Object.hasOwn(dataNu, k)) contract.controleer(k, dataNu[k]);
        const liveVoor = dataNu[k] == null ? (Array.isArray(dbBasis) ? [] : {}) : dataNu[k];
        const cacheBasis = laatsteJson.has(k)
          ? JSON.parse(laatsteJson.get(k)) : (Array.isArray(liveVoor) ? [] : {});
        contract.controleer(k, cacheBasis);
        const publicatieBasisJson = JSON.stringify(liveVoor);
        // Geen cache EN geen lokale waarde is geen lokale verwijdering.
        // Neem de DB als merge-invoer, maar onthoud de echte live-basis voor
        // publicatie; anders wist een nieuwe worker de vorige commit.
        const liveMerge = dataNu[k] == null && !laatsteJson.has(k) ? dbBasis : liveVoor;
        waarden[k] = JSON.parse(JSON.stringify(merge3(cacheBasis, liveMerge, dbBasis)));
        contract.controleer(k, waarden[k]);
        standen.push({ k, rij, grafsteen, jsonVoor, publicatieBasisJson, versie: null });
      }
      resultaat = contract.getypeerd
        ? werk(waarden, contract.context(standen.map(s => [s.k, !!s.rij && !s.grafsteen]))) : werk(waarden[sleutels[0]]);
      if (resultaat && typeof resultaat.then === 'function')
        throw new Error('De bewerker van een collectietransactie mag niet asynchroon zijn.');
      contract.controleerMap(waarden);
      for (const s of standen) {
        s.jsonNa = JSON.stringify(waarden[s.k]);
        s.waarde = contract.getypeerd ? JSON.parse(s.jsonNa) : waarden[s.k];
      }
      let gewijzigd = false;
      for (const s of standen) {
        if (s.jsonNa !== s.jsonVoor || s.grafsteen) {
          const nv = await client.query("SELECT nextval('kv_ver_seq') AS v");
          s.versie = Number(nv.rows[0].v);
          await client.query(
            `INSERT INTO kv(key, val, ver, bijgewerkt) VALUES($1, $2, $3, now())
             ON CONFLICT(key) DO UPDATE SET val = EXCLUDED.val, ver = EXCLUDED.ver, weg = false, bijgewerkt = now()`,
            [s.k, naarStore(s.jsonNa), s.versie]);
          await client.query('SELECT pg_notify($1, $2)', [KANAAL, s.k]);
          gewijzigd = true;
        } else if (s.rij) s.versie = Number(s.rij.ver);
      }
      if (gewijzigd && spoorLijst.length) spoorPublicaties = await schrijver.schrijfIn(client, spoorLijst);
      await client.query('COMMIT');
      if (spoor && spoorPublicaties.length) spoor.geschreven = true;
    } catch (e) {
      try { await client.query('ROLLBACK'); } catch (x) {}
      throw e;
    } finally { client.release(); }
    // Pas NA de gezamenlijke commit publiceren. Gewone routes kunnen tijdens
    // I/O lokale wijzigingen maken: behoud die via de exacte live-voorbasis;
    // de afzonderlijke cachebasis blijft de werkelijk gecommitte JSON.
    if (spoorPublicaties.length) schrijver.publiceer(dataNu, spoorPublicaties);
    for (const s of standen) {
      const gepubliceerd = publiceerCollectie({ dataNu, sleutel: s.k,
        basisJson: s.publicatieBasisJson, commitWaarde: s.waarde, commitJson: s.jsonNa,
        versie: s.versie, toegepast, laatsteJson });
      if (gepubliceerd.cacheBijgewerkt) {
        laatsteGrootte.set(s.k, s.jsonNa.length);
        laatsteLengte.set(s.k, Array.isArray(s.waarde) ? s.waarde.length :
          (s.waarde && typeof s.waarde === 'object' ? Object.keys(s.waarde).length : 0));
        laatsteCheck.set(s.k, klok.nu());
      }
    }
    return resultaat;
  }

  return { bewerkCollectie };
};
