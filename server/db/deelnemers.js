/* Deelnemers aan één PostgreSQL-transactie: opslag die niet in de kv-collecties
   woont (users/supplier_staff in de accountcache) maar wel in DEZELFDE commit
   hoort te landen.

   Het protocol, en het staat hier één keer zodat de requestcommit
   (server/pg/verzoektransactie.js) en een accountmutatie buiten een HTTP-verzoek
   (server/accounts/transactie.js, buitenVerzoek) het niet elk op hun eigen
   manier doen:

     heeftWerk()        synchroon: raakte dit verzoek iets aan?
     pasToe(client)     binnen de open PostgreSQL-transactie, vóór COMMIT
     publiceer()        synchroon, pas NA COMMIT: de lokale cache volgt
     annuleer()         synchroon: niets gecommit, lokale werkkopie terug
     onzeker()          optioneel: COMMIT is verstuurd maar de uitkomst is
                        onbekend; de lokale cache moet opnieuw uit PostgreSQL

   Een fase houdt bij wie de deelnemer bezit. 'open' is van de verzoekcontext
   (sluit() annuleert hem), 'toepassen' is van de commit die loopt (die maakt hem
   af, ook als de client ondertussen ophangt), 'klaar' en 'geannuleerd' zijn
   eindstanden. Zonder die fase kon een verbroken verbinding een deelnemer
   terugdraaien terwijl PostgreSQL hem nog aan het committen was. */
'use strict';

function meld(wat, e) {
  console.error('[deelnemer] ' + wat + ' mislukt:', String((e && e.message) || e));
}

function metWerk(lijst) {
  return (lijst || []).filter(d => d && d.fase === 'open' && d.heeftWerk());
}

async function pasToe(lijst, client) {
  for (const d of lijst) {
    d.fase = 'toepassen';
    await d.pasToe(client);
  }
}

function publiceer(lijst) {
  for (const d of lijst) {
    if (d.fase !== 'toepassen') continue;
    d.fase = 'klaar';
    try { d.publiceer(); } catch (e) { meld('publiceren na COMMIT', e); }
  }
}

/* Geen COMMIT gelukt. `commitVerstuurd` betekent: de uitkomst is onbekend, dus
   naast terugdraaien moet de cache ook opnieuw uit de waarheid. */
function annuleer(lijst, commitVerstuurd) {
  for (const d of lijst || []) {
    if (d.fase !== 'toepassen' && d.fase !== 'open') continue;
    d.fase = 'geannuleerd';
    try { d.annuleer(); } catch (e) { meld('annuleren', e); }
    if (commitVerstuurd && typeof d.onzeker === 'function') {
      try { d.onzeker(); } catch (e) { meld('herstel plannen', e); }
    }
  }
}

module.exports = { metWerk, pasToe, publiceer, annuleer };
