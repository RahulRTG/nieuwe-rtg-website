/* Een accountmutatie BUITEN een HTTP-verzoek (de bewaarveger: een uurlijkse
   AVG-wisregel). Zonder deze weg faalde elke achtergrondmutatie in productie
   met PG_ACCOUNTS_GEEN_REQUEST, en de wisregel draaide dus niet.

   `fn` is synchroon en raakt ALLEEN accounts: een collectiemutatie hier zou
   buiten de requestcommit landen en wordt geweigerd. De commit gebruikt
   hetzelfde deelnemersprotocol op een eigen PostgreSQL-transactie.
*/
'use strict';

const verzoekcontext = require('../db/verzoekcontext');
const proto = require('../db/deelnemers');
const { fout } = require('./transactie');

async function buitenVerzoek(fn) {
  if (!require('./duurzaamheid').gesloten()) return fn();
  const ctx = verzoekcontext.nieuw(null);
  let uit;
  try {
    verzoekcontext.voer(ctx, () => { uit = fn(); });
    if (uit && typeof uit.then === 'function')
      throw fout('PG_ACCOUNTS_ACHTERGROND_ASYNC', 'Een achtergrond-accountmutatie moet synchroon zijn.', 500);
    if (verzoekcontext.onbevestigdeWijzigingen(ctx).length)
      throw fout('PG_ACCOUNTS_ACHTERGROND_COLLECTIE',
        'Een achtergrond-accountmutatie mag geen collectie wijzigen.', 500);
    const lijst = verzoekcontext.deelnemersMetWerk(ctx);
    if (lijst.length) await eigenTransactie(lijst);
    return uit;
  } finally { verzoekcontext.sluit(ctx); }
}

async function eigenTransactie(lijst) {
  const pool = require('./mirror').accountPool();
  if (!pool) { proto.annuleer(lijst, false);
    throw fout('PG_ACCOUNTS_NIET_KLAAR', 'De gedeelde PostgreSQL-accountwaarheid is nog niet gereed.'); }
  const client = await pool.connect();
  let verstuurd = false;
  try {
    await client.query('BEGIN');
    await proto.pasToe(lijst, client);
    verstuurd = true;
    await client.query('COMMIT');
  } catch (e) {
    if (!verstuurd) try { await client.query('ROLLBACK'); } catch (x) {}
    proto.annuleer(lijst, verstuurd);
    throw e;
  } finally { client.release(); }
  proto.publiceer(lijst);
}

module.exports = { buitenVerzoek };
