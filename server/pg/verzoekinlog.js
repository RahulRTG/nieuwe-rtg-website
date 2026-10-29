/* Alleen aantoonbaar afzonderlijke toevoegingen aan de bestaande inlogsporen.
   Geen vroege commit: sessie, audit en activiteit blijven één requestcommit.
   Deze merge wordt ook door LISTEN gebruikt. Gelijke nieuwe inhoud kan daarom
   twee echte gebeurtenissen OF één teruggelezen gebeurtenis betekenen. Zonder
   gebeurtenisidentiteit weigeren we die ambiguïteit; nooit optellen of dedupen.
   Oude regels krijgen geen nieuwe velden en blijven bytegelijk behouden. */
'use strict';
const keten = require('../lib/keten');
const { voegVeilig } = require('./verzoekmerge');
const { handelingToevoegingen } = require('./verzoeksporen');
const { gebroken, zonder } = require('./spoorketen');
const { bewaarLogboek } = require('../lib/logboekretentie');
const { BELEID, DAG } = require('../bewaarbeleid');
const klok = require('../lib/klok');
const json = x => JSON.stringify(x);
const gelijk = (a, b) => json(a) === json(b);
const kaart = x => x && typeof x === 'object' && !Array.isArray(x);
function conflict(naam) {
  throw Object.assign(new Error('Onzekere of gewijzigde inloghistorie: ' + naam), { code: 'PG_REQUEST_CONFLICT' });
}
function lijst(x, naam) { if (!Array.isArray(x)) conflict(naam); return x; }
function disjunct(a, b, kern, naam) {
  const gezien = new Set(a.map(x => json(kern(x))));
  if (b.some(x => gezien.has(json(kern(x))))) conflict(naam + ': overlappende toevoegingen');
}
function verlopenStaart(b, v) {
  if (v.length >= b.length || !gelijk(v, b.slice(0, v.length))) return false;
  const beleid = BELEID.find(r => r.tak === 'securityLog');
  if (!beleid || beleid.vorm !== 'lijst' || !Number.isFinite(beleid.dagen)) return false;
  const grens = klok.nu() - beleid.dagen * DAG;
  return b.slice(v.length).every(r => {
    const waarde = r && r[beleid.datum];
    const t = typeof waarde === 'number' ? waarde : Date.parse(waarde);
    return waarde != null && Number.isFinite(t) && t < grens;
  });
}
function mergeSecurity(basis, ons, hun) {
  const b = basis === undefined ? [] : lijst(basis, 'securityLog/basis');
  const o = lijst(ons, 'securityLog/request'), h = lijst(hun, 'securityLog/database');
  for (const [naam, waarde] of [['basis', b], ['verzoek', o], ['database', h]]) {
    if (!keten.verifieer(waarde).ok) gebroken('securityLog', naam, 'De securityLog-keten is gebroken.');
  }
  // De bestaande bewaartermijn mag een verlopen oudste staart verwijderen.
  // Alleen als de andere kant ongewijzigd is: geen herleving of verlies bij
  // gelijktijdige cleanup/toevoegingen en geen willekeurige oude verwijdering.
  if (gelijk(h, b) && verlopenStaart(b, o)) return o;
  if (gelijk(o, b) && verlopenStaart(b, h)) return h;
  const toevoeging = (v, naam) => {
    const nieuw = handelingToevoegingen(b, v, 'securityLog/' + naam);
    // Alleen de bestaande maximale lengte mag oude staartregels verdringen.
    if (!gelijk(v, nieuw.concat(b).slice(0, 5000))) conflict('securityLog/' + naam + ': verwijderde historie');
    return nieuw;
  };
  const on = toevoeging(o, 'request'), hn = toevoeging(h, 'database');
  if (gelijk(o, b)) return h;
  if (gelijk(h, b)) return o;
  const kern = r => zonder(r, ['hash', 'vorige', 'nr']);
  disjunct(on, hn, kern, 'securityLog');
  const uit = h.slice();
  for (const r of on.slice().reverse()) keten.noteerIn(uit, kern(r), 5000);
  return uit;
}
function activiteitToevoegingen(b, v, naam) {
  lijst(v, naam);
  if (v.some(r => !kaart(r))) conflict(naam + ': ongeldige regel');
  if (gelijk(b, v)) return [];
  const oud = new Set(b.map(json));
  let grens = v.findIndex(r => oud.has(json(r)));
  if (grens < 0) {
    if (b.length) conflict(naam + ': geen gedeelde historie');
    grens = v.length;
  }
  const nieuw = v.slice(0, grens);
  if (!gelijk(v, bewaarLogboek(nieuw.concat(b)))) conflict(naam + ': herschreven of verwijderde historie');
  return nieuw;
}
function mergeActiviteit(basis, ons, hun) {
  const b = basis === undefined ? {} : basis;
  if (![b, ons, hun].every(kaart)) conflict('supplierActivity: geen kaart');
  const uit = {};
  for (const code of new Set([...Object.keys(b), ...Object.keys(ons), ...Object.keys(hun)])) {
    if (['__proto__', 'constructor', 'prototype'].includes(code)) conflict('supplierActivity: ongeldige zaaksleutel');
    const heeft = x => Object.hasOwn(x, code);
    // Hele-zaakverwijdering houdt het bestaande drie-wegcontract: alleen
    // tegen een ongewijzigde tegenkant; nooit gelijktijdige activiteit wissen.
    // Dit verleent geen verwijderrecht: dat blijft bij de requestautorisatie.
    if (heeft(b) && (!heeft(ons) || !heeft(hun))) {
      const waarde = voegVeilig(b[code], ons[code], hun[code], 'supplierActivity/' + code);
      if (waarde !== undefined) uit[code] = waarde;
      continue;
    }
    const oud = heeft(b) ? lijst(b[code], code) : [];
    const o = heeft(ons) ? ons[code] : [], h = heeft(hun) ? hun[code] : [];
    const on = activiteitToevoegingen(oud, o, code), hn = activiteitToevoegingen(oud, h, code);
    if (gelijk(o, oud)) { uit[code] = h; continue; }
    if (gelijk(h, oud)) { uit[code] = o; continue; }
    disjunct(on, hn, x => x, 'supplierActivity/' + code);
    uit[code] = bewaarLogboek(on.concat(h));
  }
  return uit;
}
module.exports = { mergeSecurity, mergeActiviteit };
