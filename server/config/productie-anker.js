/* HET EXTERNE ANKER IS IN PRODUCTIE VERPLICHT (audit P1-3d).

   De hashketen ziet gesleutel MIDDEN in een auditspoor; kopafknipping en een
   volledige herberekening ziet alleen het anker dat BUITEN dit huis staat
   (lib/ankerdienst.js, lib/ankerpost.js, lib/ankertimer.js). Zonder
   RTG_ANKERPOST_URL draaide de ankertimer gewoon niet, en het opstarten ging
   door alsof er niets ontbrak. Dat is precies de stille belofte waar het anker
   tegen bestaat: dan staat er in het controlregister een mechanisme dat
   "bewezen" is en dat nergens in bedrijf is.

   Zelfde vorm als ERR_WEBHOOK_URL in ./productie.js: een fout in publieke
   productie, een waarschuwing in de besloten beta, en een adres dat er WEL staat
   maar door de ankerpost wordt geweigerd (dezelfde schijf, deze machine,
   onversleuteld) is erger dan geen adres en dus altijd een fout. De echte
   bestemming -- een tweede machine met een WORM-opslag -- blijft een besluit
   over de infrastructuur; scripts/ankerontvanger.js is de referentie. */
'use strict';

function keurAnker(env, fouten, waarschuwingen, priveBeta) {
  if (env.RTG_ANKER_HERSTEL_SIGN_KEY_FILE)
    fouten.push('De private audit-herstelsleutel staat in de app-omgeving. Alleen het handmatige scripts/ankerherstel.js mag die sleutel lezen.');
  if (env.RTG_ANKER_HERSTEL_FILE) {
    const h = require('../lib/ankerherstel').maakHerstel({ omgeving: env }).lees();
    if (!h.verklaring) fouten.push('RTG_ANKER_HERSTEL_FILE is gezet, maar de apart getekende herstelverklaring is ongeldig: ' + (h.fout || 'onbekend'));
  }
  if (!env.RTG_ANKERPOST_URL) {
    const melding = 'RTG_ANKERPOST_URL niet gezet: het auditspoor wordt nergens buiten dit huis verankerd. ' +
      'Kopafknipping en een volledige herberekening van een journaal blijven dan onzichtbaar. Zet het adres van ' +
      'de tweede machine (zie scripts/ankerontvanger.js).';
    if (priveBeta) waarschuwingen.push(melding); else fouten.push(melding);
    return;
  }
  let keur;
  try { keur = require('../lib/ankerpost').keurBestemming(env.RTG_ANKERPOST_URL); }
  catch (e) { keur = { ok: false, reden: 'de keuring kon niet draaien: ' + (e && e.message) }; }
  if (!keur.ok) fouten.push('RTG_ANKERPOST_URL wordt geweigerd (' + keur.reden + '): de ankertimer brengt dan niets weg.');
  if (!env.RTG_ANKERPOST_SLEUTEL)
    waarschuwingen.push('RTG_ANKERPOST_SLEUTEL niet gezet: de tweede machine kan niet nagaan dat een blok van deze installatie komt voordat zij het bewaart.');
}

module.exports = { keurAnker };
