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

module.exports = (ctx) => {
  const { pool, uitStore, naarStore, toegepast, laatsteJson,
          laatsteGrootte, laatsteLengte, laatsteCheck } = ctx;

  async function bewerkCollectie(sleutel, dataNu, werk) {
    if (!sleutel || typeof werk !== 'function') throw new Error('Collectietransactie vereist een sleutel en bewerker.');
    const client = await pool.connect();
    let waarde, resultaat, jsonNa, versie = null;
    try {
      await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1)::bigint)', [sleutel]);
      const huidig = await client.query('SELECT val, ver, weg FROM kv WHERE key = $1 FOR UPDATE', [sleutel]);
      /* EEN GRAFSTEEN telt hier als "bestaat niet" en niet als data (TAKEN.md
         4.38). Twee redenen: `val` is dan leeg, dus JSON.parse zou struikelen;
         en beginnen bij de werkkopie zou de gewiste collectie langs deze weg
         alsnog laten herrijzen. Opnieuw vullen mag -- daarom vanaf leeg en niet
         met een weigering. */
      const bestaat = huidig.rows.length && !huidig.rows[0].weg;
      const jsonVoor = bestaat
        ? uitStore(huidig.rows[0].val)
        : JSON.stringify(huidig.rows.length ? {} : (dataNu[sleutel] == null ? {} : dataNu[sleutel]));
      waarde = JSON.parse(jsonVoor);
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
      } else if (huidig.rows.length) versie = Number(huidig.rows[0].ver);
      await client.query('COMMIT');
    } catch (e) {
      try { await client.query('ROLLBACK'); } catch (x) {}
      throw e;
    } finally {
      client.release();
    }
    dataNu[sleutel] = waarde;
    laatsteJson.set(sleutel, jsonNa);
    laatsteGrootte.set(sleutel, jsonNa.length);
    laatsteLengte.set(sleutel, Array.isArray(waarde) ? waarde.length : (waarde && typeof waarde === 'object' ? Object.keys(waarde).length : 0));
    laatsteCheck.set(sleutel, klok.nu());
    if (versie != null) toegepast.set(sleutel, versie);
    return resultaat;
  }

  return { bewerkCollectie };
};
