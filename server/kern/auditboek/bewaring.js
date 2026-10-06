/* ============================================================================
   DE BEWARING -- hoe lang blijft een regel staan, en wanneer mag hij weg.

   BEWAARDAGEN = 730, dezelfde termijn als het inzagejournaal
   (server/inzagelog-bewaring.js) en om dezelfde reden: het boek is het bewijs
   OVER handelingen en hoort de gegevens waarover het gaat te overleven. Een
   releaseregel of een rollback is bovendien precies wat een auditor over twee
   jaar wil zien.

   VERWIJDEREN IS DE GEVAARLIJKSTE HANDELING VAN HET BOEK, dus er zijn vier eisen:
     1  het boek moet VERS en STRIKT verifieren (een kapot boek wordt niet
        gesnoeid: dan verdwijnt het bewijs van de manipulatie);
     2  een extern anker dat ouder is dan de termijn moet de te verwijderen regels
        dekken -- zo valt later te bewijzen dat ze niet te vroeg zijn weggehaald;
     3  de kop en minstens een regel blijven altijd staan;
     4  verwijderen, het checkpoint en de retentiegebeurtenis staan in EEN
        transactie onder het schrijversslot: of alles, of niets.

   Het CHECKPOINT bewaart de hash van de laatst verwijderde regel, zodat de
   eerstvolgende blijft wijzen naar iets dat aantoonbaar bestond. De
   verificatie controleert dat het checkpoint een retentiegebeurtenis heeft en
   dat de verjaring door een anker te bewijzen is (./verifieer.js).
   ========================================================================== */
'use strict';
const { SLOT } = require('./schema');
const { voegIn, nietVastgelegd } = require('./schrijver');
const { verifieer } = require('./verifieer');

const BEWAARDAGEN = 730;
const DAG = 24 * 3600 * 1000;

async function snoei({ pool, sinks, sleutels, minSinks = 1, nu = Date.now(), dagen = BEWAARDAGEN, actor = { soort: 'systeem', ref: 'auditboek-bewaring' } }) {
  const oordeel = await verifieer({ pool, sinks, sleutels, minSinks, nu, strikt: true, bewaarDagen: dagen });
  if (!oordeel.ok) throw Object.assign(new Error('Bewaring geweigerd: het boek verifieert niet strikt (' + oordeel.uitslag + ').'), { code: 'BEWARING_GEWEIGERD', oordeel });
  const grens = new Date(nu - dagen * DAG).toISOString();
  const kand = (await pool.query('SELECT MAX(nr) AS nr FROM auditboek WHERE tijd < $1', [grens])).rows[0];
  const kop = Number((await pool.query('SELECT MAX(nr) AS nr FROM auditboek')).rows[0].nr || 0);
  let tot = kand && kand.nr != null ? Number(kand.nr) : 0;
  tot = Math.min(tot, kop - 1);
  if (tot < 1) return { verwijderd: 0, reden: 'niets verjaard' };

  const ankerRijen = (await pool.query('SELECT anker_nr, nr, tijd FROM auditboek_anker ORDER BY anker_nr')).rows;
  const dekkend = ankerRijen.find(r => Number(r.nr) >= tot && Date.parse(r.tijd) <= nu - dagen * DAG);
  if (!dekkend) throw Object.assign(new Error('Bewaring geweigerd: geen extern anker dat ouder is dan de termijn dekt regel ' + tot + '.'), { code: 'BEWARING_GEWEIGERD' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SET LOCAL synchronous_commit = on');
    await client.query('SELECT pg_advisory_xact_lock($1)', [SLOT]);
    const rij = (await client.query('SELECT nr, hash, tijd FROM auditboek WHERE nr = $1', [tot])).rows[0];
    if (!rij) throw new Error('regel ' + tot + ' bestaat niet meer');
    await client.query("SET LOCAL rtg.auditboek_bewaring = 'toegestaan'");
    const weg = await client.query('DELETE FROM auditboek WHERE nr <= $1', [tot]);
    await client.query("SET LOCAL rtg.auditboek_bewaring = 'nee'");
    await client.query('INSERT INTO auditboek_checkpoint(nr, hash, tijd, reden, anker_nr) VALUES($1,$2,$3,$4,$5)',
      [tot, rij.hash, rij.tijd, 'bewaartermijn ' + dagen + ' dagen', Number(dekkend.anker_nr)]);
    await voegIn(client, { type: 'auditboek.retentie', uitkomst: 'uitgevoerd', actor,
      context: { totNr: tot, aantal: weg.rowCount, dagen, checkpointHash: rij.hash } }, { nu, dienst: 'auditboek' });
    await client.query('COMMIT');
    return { verwijderd: weg.rowCount, totNr: tot, checkpointHash: rij.hash, ankerNr: Number(dekkend.anker_nr) };
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch (x) {}
    throw e.code === 'BEWARING_GEWEIGERD' ? e : nietVastgelegd(e);
  } finally { client.release(); }
}

module.exports = { snoei, BEWAARDAGEN };
