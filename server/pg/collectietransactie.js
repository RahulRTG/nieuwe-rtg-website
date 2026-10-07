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
    if (!sleutel || typeof werk !== 'function') throw new Error('Collectietransactie vereist een sleutel en bewerker.');
    const spoorLijst = spoor && schrijver
      ? schrijver.sorteer((spoor.wijzigingen || []).filter(w => w.sleutel !== sleutel)) : [];
    if (spoor) spoor.geschreven = false;
    const client = await pool.connect();
    let waarde, resultaat, jsonVoor, publicatieBasisJson, jsonNa, versie = null, spoorPublicaties = [];
    try {
      await client.query('BEGIN');
      /* Alle sloten in een vaste volgorde, voor er iets gelezen wordt: dezelfde
         volgorde als de requestcommit, dus geen kruisdeadlock met een verzoek
         dat hetzelfde spoor en deze collectie samen commit. */
      for (const k of [...new Set([sleutel, ...spoorLijst.map(w => w.sleutel)])].sort())
        await client.query('SELECT pg_advisory_xact_lock(hashtext($1)::bigint)', [k]);
      const huidig = await client.query('SELECT val, ver, weg FROM kv WHERE key = $1 FOR UPDATE', [sleutel]);
      /* EEN GRAFSTEEN telt hier als "bestaat niet" en niet als data (TAKEN.md
         4.38). Twee redenen: `val` is dan leeg, dus JSON.parse zou struikelen;
         en beginnen bij de werkkopie zou de gewiste collectie langs deze weg
         alsnog laten herrijzen. Opnieuw vullen mag -- daarom vanaf leeg en niet
         met een weigering. */
      const bestaat = huidig.rows.length && !huidig.rows[0].weg;
      jsonVoor = bestaat
        ? uitStore(huidig.rows[0].val)
        : JSON.stringify(huidig.rows.length ? {} : (dataNu[sleutel] == null ? {} : dataNu[sleutel]));
      /* Neem ook lokaal openstaand werk mee dat al VOOR dit DB-slot via
         S()/save() ontstond. Anders zou juist een ingetrokken zetel die nog op
         de write-behind flush wacht buiten de autorisatie in `werk` vallen.
         De extra JSON-ronde voorkomt dat `werk` via een gedeelde objectref al
         vóór COMMIT aan db.data schrijft. */
      const dbBasis = JSON.parse(jsonVoor);
      /* Houd live-voor apart van de verenigde werkkopie. De werkkopie kan
         verse DB-wijzigingen bevatten die live nog niet kende; publicatie mag
         die niet aanzien voor een wijziging die tijdens deze tx ontstond. */
      const liveVoor = dataNu[sleutel] == null ? (Array.isArray(dbBasis) ? [] : {}) : dataNu[sleutel];
      // Een nooit ingelezen collectie is geen lokale verwijdering van de DB-rij.
      const cacheBasis = laatsteJson.has(sleutel)
        ? JSON.parse(laatsteJson.get(sleutel)) : (Array.isArray(liveVoor) ? [] : {});
      publicatieBasisJson = JSON.stringify(liveVoor);
      /* Een collectie die deze instance NOOIT zag (geen cache en geen live
         waarde) heeft geen lokale wijziging: dan telt voor de samenvoeging de
         database als live. Als `{}` las merge3 dat als "alles verwijderd", en
         wiste de eerste transactie van instance B wat instance A net in een
         NIEUWE collectie had gezet (gevonden door test/eten-kortingscode.pg.test.js).
         De publicatiebasis blijft `{}`: lokaal stond er niets, dus de commit
         moet daarna in zijn geheel in db.data landen. */
      const liveMerge = dataNu[sleutel] == null && !laatsteJson.has(sleutel) ? dbBasis : liveVoor;
      waarde = JSON.parse(JSON.stringify(merge3(cacheBasis, liveMerge, dbBasis)));
      resultaat = werk(waarde);
      if (resultaat && typeof resultaat.then === 'function')
        throw new Error('De bewerker van een collectietransactie mag niet asynchroon zijn.');
      jsonNa = JSON.stringify(waarde);
      if (jsonNa !== jsonVoor || (huidig.rows.length && huidig.rows[0].weg)) {
        const nv = await client.query("SELECT nextval('kv_ver_seq') AS v");
        versie = Number(nv.rows[0].v);
        await client.query(
          // `weg = false`: schrijven heft een grafsteen op, net als in de gewone flush
          `INSERT INTO kv(key, val, ver, bijgewerkt) VALUES($1, $2, $3, now())
           ON CONFLICT(key) DO UPDATE SET val = EXCLUDED.val, ver = EXCLUDED.ver, weg = false, bijgewerkt = now()`,
          [sleutel, naarStore(jsonNa), versie]
        );
        await client.query('SELECT pg_notify($1, $2)', [KANAAL, sleutel]);
        if (spoorLijst.length) spoorPublicaties = await schrijver.schrijfIn(client, spoorLijst);
      } else if (huidig.rows.length) versie = Number(huidig.rows[0].ver);
      await client.query('COMMIT');
      if (spoor && spoorPublicaties.length) spoor.geschreven = true;
    } catch (e) {
      try { await client.query('ROLLBACK'); } catch (x) {}
      throw e;
    } finally {
      client.release();
    }
    /* Tussen de eerste SELECT en COMMIT blijft de event-loop vrij. Een gewone
       route kan dan dezelfde levende collectie wijzigen en save() plannen.
       Publiceer daarom niet met een assignment: voeg de commit samen tegen de
       exacte live-basis van vóór `werk`. laatsteJson blijft afzonderlijk
       de commit-basis, zodat de gewone flush het live verschil nog ziet. */
    if (spoorPublicaties.length) schrijver.publiceer(dataNu, spoorPublicaties);
    const gepubliceerd = publiceerCollectie({ dataNu, sleutel, basisJson: publicatieBasisJson,
      commitWaarde: waarde, commitJson: jsonNa, versie, toegepast, laatsteJson });
    if (gepubliceerd.cacheBijgewerkt) {
      laatsteGrootte.set(sleutel, jsonNa.length);
      laatsteLengte.set(sleutel, Array.isArray(waarde) ? waarde.length :
        (waarde && typeof waarde === 'object' ? Object.keys(waarde).length : 0));
      laatsteCheck.set(sleutel, klok.nu());
    }
    return resultaat;
  }

  return { bewerkCollectie };
};
