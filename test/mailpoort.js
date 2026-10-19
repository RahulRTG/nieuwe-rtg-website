/* Het gedeelde geheim van de buitenpoorten voor post, voor de toetsen
   (server/kern/mailpoort.js, eigenaarsbesluit 19 oktober 2026). Een vaste
   proefwaarde: dit opent alleen een wegwerpserver die met
   RTG_MAILPOORT_GEHEIM = deze waarde is gestart.

   zetKop(): een toetsbestand dat als mailserver post aflevert, roept dit een
   keer aan. Daarna draagt elk verzoek in DAT proces naar /api/mail/binnen of
   /api/werkmail/bezorg de kop met het geheim, zoals de eigen mailserver dat
   doet. Andere adressen merken niets; wie de poort zonder geheim wil
   beproeven, doet dat in een eigen bestand (test/toegang-mailpoort.test.js). */
'use strict';
const { KOP } = require('../server/kern/mailpoort');
const GEHEIM = 'proef-mailpoort-geheim-van-32-tekens-of-meer';
const POORT = /\/api\/(mail\/binnen|werkmail\/bezorg)(\?|$)/;

function zetKop() {
  if (globalThis.__rtgMailpoortKop) return;
  globalThis.__rtgMailpoortKop = true;
  const kaal = globalThis.fetch;
  globalThis.fetch = (url, opties) => {
    if (!POORT.test(String(url))) return kaal(url, opties);
    const o = Object.assign({}, opties || {});
    o.headers = Object.assign({}, o.headers || {}, { [KOP]: GEHEIM });
    return kaal(url, o);
  };
}

module.exports = { GEHEIM, KOP, zetKop };
