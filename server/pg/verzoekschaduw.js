/* Alleen meetdelta's van de commerciële schaduwregels zijn samenvoegbaar.
   Het toegangsverzoek mag niet botsen doordat twee instances een waarneming
   tellen. De modus, vrijstelling en hun geschiedenis zijn geen meetgegevens:
   verandert besturing tegelijk met een andere wijziging, dan blijft het een
   conflict. Deze merge geldt zowel voor requestcommit als voor LISTEN/poll. */
'use strict';
const { voegVeilig } = require('./verzoekmerge');
const { MODUS, VOORBEELDEN } = require('../kern/commercie/schaduw');
const json = v => JSON.stringify(v);
const gelijk = (a, b) => json(a) === json(b);
const kaart = v => v && typeof v === 'object' && !Array.isArray(v);
const METING = new Set(['waarnemingen', 'zouTegenhouden', 'voorbeelden']);
const STANDEN = new Set(Object.values(MODUS));
const vorm = (v, velden) => kaart(v) && Object.keys(v).sort().join(',') === velden;
const tijd = v => Number.isFinite(v) && v >= 0;
const beheerder = v => v === null || typeof v === 'string' && v.length > 0 && v.length <= 60;

function conflict(pad, reden) {
  throw Object.assign(new Error('Ongeldige of gelijktijdig bestuurde schaduwmeting bij ' +
    pad + ': ' + reden), { code: 'PG_REQUEST_CONFLICT' });
}
function getal(n, pad) {
  if (!Number.isSafeInteger(n) || n < 0) conflict(pad, 'geen niet-negatief veilig geheel getal');
  return n;
}
function rij(r, id, pad) {
  if (!vorm(r, 'door,id,modus,sinds,verloop,voorbeelden,vrijstelling,waarnemingen,zouTegenhouden') || r.id !== id)
    conflict(pad, 'geen volledige schaduwregel met de verwachte identiteit');
  if (!STANDEN.has(r.modus) || !tijd(r.sinds) || !beheerder(r.door))
    conflict(pad, 'ongeldige besturingsstand');
  if (r.vrijstelling !== null && (!vorm(r.vrijstelling, 'at,door,reden') ||
      !tijd(r.vrijstelling.at) || !beheerder(r.vrijstelling.door) ||
      typeof r.vrijstelling.reden !== 'string' || r.vrijstelling.reden.length < 15 || r.vrijstelling.reden.length > 300))
    conflict(pad, 'ongeldige vrijstelling');
  // De bestaande zetModus bewaart maximaal veertig volledige beheerovergangen.
  if (!Array.isArray(r.verloop) || r.verloop.length > 40 || r.verloop.some(v =>
    !vorm(v, 'at,door,naar,van') || !tijd(v.at) || !STANDEN.has(v.van) || !STANDEN.has(v.naar) || !beheerder(v.door)))
    conflict(pad, 'ongeldig besturingsverloop');
  const totaal = getal(r.waarnemingen, pad + '.waarnemingen');
  if (getal(r.zouTegenhouden, pad + '.zouTegenhouden') > totaal)
    conflict(pad, 'meer tegengehouden dan waargenomen');
  if (!Array.isArray(r.voorbeelden) || r.voorbeelden.length > VOORBEELDEN)
    conflict(pad, 'ongeldige of onbegrensde voorbeelden');
  for (const v of r.voorbeelden) {
    if (!kaart(v) || Object.keys(v).sort().join(',') !== 'at,reden,wat,wie' ||
        !Number.isFinite(v.at) || v.at < 0 || typeof v.reden !== 'string' || v.reden.length > 200 ||
        !(v.wie === null || typeof v.wie === 'string' && v.wie.length <= 60) ||
        !(v.wat === null || typeof v.wat === 'string' && v.wat.length <= 120))
      conflict(pad, 'ongeldig voorbeeld');
  }
}

/* Het aantal bezwaren bepaalt exact hoeveel kopregels zijn toegevoegd. Alleen
   de staart die door de bestaande limiet verdrongen wordt mag verdwijnen;
   herschrijven, sorteren of een niet-getelde kopregel toevoegen mag niet. */
function toevoegingen(b, v, pad) {
  const dn = v.waarnemingen - b.waarnemingen, dz = v.zouTegenhouden - b.zouTegenhouden;
  if (dn < 0 || dz < 0 || dz > dn) conflict(pad, 'geen monotone meetdelta');
  const aantal = Math.min(dz, VOORBEELDEN), kop = v.voorbeelden.slice(0, aantal);
  if (kop.length !== aantal || !gelijk(v.voorbeelden, kop.concat(b.voorbeelden).slice(0, VOORBEELDEN)))
    conflict(pad, 'bestaande voorbeelden veranderd of toevoegingen niet geteld');
  return kop;
}

function regelSamen(id, b, o, h) {
  const pad = 'schaduwregels.' + id;
  for (const [naam, v] of [['basis', b], ['request', o], ['database', h]])
    if (v !== undefined) rij(v, id, pad + '/' + naam);
  // Ook een eenzijdige nieuwe rij moet een getelde, volledig bewaarde kop
  // hebben; de generieke merge hieronder mag die controle niet overslaan.
  if (b === undefined) {
    for (const v of [o, h]) if (v !== undefined && v.voorbeelden.length !== Math.min(v.zouTegenhouden, VOORBEELDEN))
      conflict(pad, 'nieuwe voorbeeldkop komt niet overeen met het aantal bezwaren');
  }
  // Hele-rijverwijdering krijgt nooit de meetuitzondering.
  if (o === undefined || h === undefined) return voegVeilig(b, o, h, pad);
  const sleutels = new Set([...Object.keys(b || {}), ...Object.keys(o), ...Object.keys(h)]);
  const bestuur = [...sleutels].filter(k => !METING.has(k));
  if (b === undefined) {
    if (bestuur.some(k => !gelijk(o[k], h[k]))) conflict(pad, 'verschillende nieuwe besturingsregels');
  } else if (!gelijk(o, b) && !gelijk(h, b) &&
      bestuur.some(k => !gelijk(o[k], b[k]) || !gelijk(h[k], b[k]))) {
    conflict(pad, 'besturing veranderde naast een andere wijziging');
  }
  const basis = b || { waarnemingen: 0, zouTegenhouden: 0, voorbeelden: [] };
  const on = toevoegingen(basis, o, pad + '/request');
  toevoegingen(basis, h, pad + '/database');
  const uit = {};
  for (const k of bestuur) {
    const v = voegVeilig(b && b[k], o[k], h[k], pad + '.' + k);
    if (v !== undefined) uit[k] = v;
  }
  // Geen gelijkheidskortsluiting: twee onafhankelijke +1-delta's zijn samen +2.
  for (const k of ['waarnemingen', 'zouTegenhouden'])
    uit[k] = getal(basis[k] + (o[k] - basis[k]) + (h[k] - basis[k]), pad + '.' + k);
  /* De lokale nog ongecommitteerde kop blijft vóór de DB-kop. Niet sorteren op
     kloktijd: LISTEN maakt `hun` de nieuwe basis; diezelfde lokale toevoeging
     moet bij de latere commit nog aantoonbaar een kop zijn. Gelijke voorbeelden
     mogen verschillende waarnemingen zijn en worden niet stil gededupliceerd. */
  uit.voorbeelden = on.concat(h.voorbeelden).slice(0, VOORBEELDEN);
  return uit;
}

function voegSchaduwSamen(basis, ons, hun) {
  const b = basis === undefined ? {} : basis;
  if (![b, ons, hun].every(kaart)) conflict('schaduwregels', 'geen regelkaart');
  const uit = {};
  for (const id of new Set([...Object.keys(b), ...Object.keys(ons), ...Object.keys(hun)])) {
    if (['__proto__', 'constructor', 'prototype'].includes(id)) conflict('schaduwregels', 'ongeldige regelsleutel');
    const eigen = v => Object.hasOwn(v, id) ? v[id] : undefined;
    const r = regelSamen(id, eigen(b), eigen(ons), eigen(hun));
    if (r !== undefined) uit[id] = r;
  }
  return uit;
}
module.exports = { voegSchaduwSamen };
