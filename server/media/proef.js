/* Actieve go-live-proef voor gedeelde objectopslag.

   Configuratie en een bereikbare HEAD zeggen niet dat twee applicatieprocessen
   dezelfde bytes kunnen schrijven, lezen en verwijderen. Deze proef maakt
   daarom twee losse backendinstanties, schrijft willekeurige bytes met A,
   leest en hasht ze met B en verwijdert ze met B. De objectnaam en inhoud zijn
   per ronde nieuw; een cache kan de uitkomst niet groen maken. */
'use strict';

const crypto = require('crypto');
const { maakS3Backend } = require('../media/s3');

async function proefGedeeldeMedia(cfg, opties) {
  opties = opties || {};
  const maak = opties.maakBackend || maakS3Backend;
  const willekeurig = opties.randomBytes || crypto.randomBytes;
  const naam = 'rtg-golive-' + willekeurig(16).toString('hex') + '.proef';
  const inhoud = willekeurig(96);
  const verwacht = crypto.createHash('sha256').update(inhoud).digest('hex');
  const schrijver = maak(cfg);
  const lezer = maak(cfg);
  let bestaat = false;
  try {
    await schrijver.put(naam, inhoud);
    bestaat = true;
    const terug = await lezer.get(naam);
    if (!Buffer.isBuffer(terug)) throw new Error('de objectopslag gaf geen bytes terug');
    const werkelijk = crypto.createHash('sha256').update(terug).digest('hex');
    if (werkelijk !== verwacht) throw new Error('de tweede instance las andere bytes dan de eerste schreef');
    await lezer.del(naam);
    if (await schrijver.has(naam)) throw new Error('het proefobject bleef na verwijderen bestaan');
    bestaat = false;
    return { ok: true, bytes: inhoud.length, sha256: verwacht, tweeInstanties: true, verwijderd: true };
  } finally {
    if (bestaat) {
      try { await schrijver.del(naam); } catch (e) { /* de oorspronkelijke fout blijft leidend */ }
    }
  }
}

module.exports = { proefGedeeldeMedia };
