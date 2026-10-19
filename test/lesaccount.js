/* DE LES VRAAGT EEN ACCOUNT (eigenaarsbesluit 19 oktober 2026,
   server/foundation/onderwijs/lesaccount.js), voor de toetsen die een les als
   middel gebruiken en niet de deur zelf meten.

   zetLesAccount(): een toetsbestand roept dit een keer aan. Daarna krijgt elk
   verzoek in DAT proces naar /api/foundation/les/maak of /les/join dat geen
   eigen Authorization-kop draagt, een gratis account van diezelfde server
   mee (een per server, langs de echte registratie: scripts/lib/gratisaccount.js).
   Wie de deur zelf meet, doet dat in een eigen bestand zonder deze hulp
   (test/toegang-les.test.js). */
'use strict';
const { registreerGratis } = require('../scripts/lib/gratisaccount');
const LES = /^(https?:\/\/[^/]+)\/api\/foundation\/les\/(maak|join)(\?|$)/;

function zetLesAccount() {
  if (globalThis.__rtgLesAccount) return;
  globalThis.__rtgLesAccount = true;
  const kaal = globalThis.fetch;
  const leden = new Map();
  globalThis.fetch = async (url, opties) => {
    const m = LES.exec(String(url));
    const o = Object.assign({}, opties || {});
    const kop = Object.assign({}, o.headers || {});
    if (!m || Object.keys(kop).some((k) => k.toLowerCase() === 'authorization')) return kaal(url, opties);
    if (!leden.has(m[1])) leden.set(m[1], await registreerGratis(m[1]));
    const lid = leden.get(m[1]);
    if (lid) kop.Authorization = 'Bearer ' + lid.token;
    o.headers = kop;
    return kaal(url, o);
  };
}

module.exports = { zetLesAccount };
