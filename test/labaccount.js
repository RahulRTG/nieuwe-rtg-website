/* DE BUURTDEUREN VAN HET LIVING LAB VRAGEN EEN ACCOUNT (eigenaarsbesluit 19
   oktober 2026, server/routes/livinglab/bewoneraccount.js), voor de toetsen die
   een thema of een stem als middel gebruiken en niet de deur zelf meten.

   zetLabAccount(): een toetsbestand roept dit een keer aan. Daarna krijgt elk
   verzoek naar een buurtdeur van het lab (/api/lab2/bewoner/*, /mijn/*, /publiek/*) zonder eigen
   Authorization-kop een gratis account mee -- en wel EEN PER ALIAS uit het lijf.
   Die toetsen lieten verschillende aliassen als verschillende bewoners stemmen;
   sinds de stem aan het account hangt, is dat precies wat een eigen account per
   alias nabootst. Wie de deur zelf meet, doet dat zonder deze hulp
   (test/toegang-lab.test.js). */
'use strict';
const { registreerGratis } = require('../scripts/lib/gratisaccount');
const DEUR = /^(https?:\/\/[^/]+)\/api\/lab2\/(bewoner\/(labs|themas|thema|stem|overzicht|studie|klacht|kader|paspoort|paspoort-maak)|mijn(\/[a-z/]+)?|publiek\/[a-z-]+)(\?|$)/;

function zetLabAccount() {
  if (globalThis.__rtgLabAccount) return;
  globalThis.__rtgLabAccount = true;
  const kaal = globalThis.fetch;
  const leden = new Map();
  globalThis.fetch = async (url, opties) => {
    const m = DEUR.exec(String(url));
    const o = Object.assign({}, opties || {});
    const kop = Object.assign({}, o.headers || {});
    if (!m || Object.keys(kop).some((k) => k.toLowerCase() === 'authorization')) return kaal(url, opties);
    let alias = '';
    try { alias = String((JSON.parse(o.body || '{}') || {}).alias || ''); } catch (e) { alias = ''; }
    const sleutel = m[1] + '|' + alias;
    if (!leden.has(sleutel)) leden.set(sleutel, await registreerGratis(m[1]));
    const lid = leden.get(sleutel);
    if (lid) kop.Authorization = 'Bearer ' + lid.token;
    o.headers = kop;
    return kaal(url, o);
  };
}

module.exports = { zetLabAccount };
