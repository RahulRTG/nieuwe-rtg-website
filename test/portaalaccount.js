/* DE CODEPORTALEN VRAGEN EEN ACCOUNT (eigenaarsbesluit 19 oktober 2026,
   server/kern/codekoppel.js), voor de toetsen die een portaal als middel
   gebruiken en niet de deur zelf meten.

   zetPortaalAccount(): een toetsbestand roept dit een keer aan. Daarna krijgt
   elk verzoek naar een codedeur (/api/rtfos/portaal/..., /api/rtf/club/...,
   /api/rtf/partner/{raad,besluit-start,stem,besluit-sluit}) zonder eigen
   Authorization-kop een gratis account van diezelfde server mee -- een per
   server, langs de echte registratie (scripts/lib/gratisaccount.js). Dat ene
   account koppelt zich dus aan elk dossier dat het bestand opent, zoals een
   medewerker die meerdere dossiers beheert. Wie de deur zelf meet, doet dat
   zonder deze hulp (test/toegang-portalen.test.js). */
'use strict';
const { registreerGratis } = require('../scripts/lib/gratisaccount');
const DEUR = /^(https?:\/\/[^/]+)\/api\/(rtfos\/portaal\/(partner|gemeente|ondernemer|vrijwilliger|deelnemer|donateur)(\/(genootschap|genootschap\/erken|zet|uren|intrekken|bewijs))?|rtf\/club\/(portaal|bericht)|rtf\/partner\/(raad|besluit-start|stem|besluit-sluit))(\?|$)/;

function zetPortaalAccount() {
  if (globalThis.__rtgPortaalAccount) return;
  globalThis.__rtgPortaalAccount = true;
  const kaal = globalThis.fetch;
  const leden = new Map();
  globalThis.fetch = async (url, opties) => {
    const m = DEUR.exec(String(url));
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

module.exports = { zetPortaalAccount };
