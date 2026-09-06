/* Conflictvaste requestmerge voor de twee algemene auditsporen.

   Onder het PostgreSQL-collectieslot nemen we uitsluitend
   aantoonbare TOEVOEGINGEN uit onze requestkopie over. Bestaande regels moeten
   bytegelijk en in dezelfde volgorde aanwezig blijven. Nieuwe regels krijgen
   daarna een verse verwijzing naar de actuele DB-kop. Een herschrijving,
   verwijdering of gebroken keten blijft dus een hard conflict. */
'use strict';

const crypto = require('node:crypto');
const keten = require('../lib/keten');

const HANDELING_MAX = 50000;
const API_MAX = 5000;
const json = v => JSON.stringify(v);

function conflict(tekst) {
  const e = new Error(tekst || 'Het auditspoor veranderde tijdens dit verzoek.');
  e.code = 'PG_REQUEST_CONFLICT';
  throw e;
}

function zonder(regel, velden) {
  const uit = { ...(regel || {}) };
  for (const veld of velden) delete uit[veld];
  return uit;
}

/* handelingLog staat nieuwste-eerst. Een geldige requesttoevoeging is daarom
   een nieuwe kop, gevolgd door een ongewijzigde prefix van de oude lijst (de
   alleroudste staart mag door de bewaarlimiet zijn afgekapt). */
function handelingToevoegingen(basis, variant, naam) {
  const b = Array.isArray(basis) ? basis : [];
  const v = Array.isArray(variant) ? variant : conflict(naam + ' is geen lijst.');
  const oud = new Map(b.filter(Boolean).map(r => [r.hash, json(r)]));
  let grens = v.findIndex(r => r && oud.has(r.hash));
  if (grens < 0) grens = v.length;
  const nieuw = v.slice(0, grens), gedeeld = v.slice(grens);
  if (nieuw.some(r => !r || typeof r.hash !== 'string' || !r.hash || oud.has(r.hash)) ||
      gedeeld.some(r => !r || !oud.has(r.hash)))
    conflict(naam + ' is niet uitsluitend aan de kop uitgebreid.');
  if (b.length && !gedeeld.length && nieuw.length)
    conflict(naam + ' deelt geen bestaande ketenschakel meer.');
  const verwacht = b.slice(0, gedeeld.length);
  if (gedeeld.length !== verwacht.length || gedeeld.some((r, i) => json(r) !== json(verwacht[i])))
    conflict(naam + ' herschrijft bestaand bewijs.');
  let ouder = gedeeld.find(r => r && r.hash) || null;
  for (const r of nieuw.slice().reverse()) {
    const nr = ouder ? Number(ouder.nr) || 0 : 0;
    if (r.vorige !== (ouder ? ouder.hash : null) || Number(r.nr) !== nr + 1)
      conflict(naam + ' heeft geen oplopende ketenschakel.');
    ouder = r;
  }
  return nieuw;
}

function mergeHandeling(basis, ons, hun) {
  if (!keten.verifieer(ons).ok) conflict('De request handelingLog-keten is gebroken.');
  if (!keten.verifieer(hun).ok) conflict('De actuele handelingLog-keten is gebroken.');
  /* Retentie verwijdert uitsluitend de oudste staart. Als de andere kant niet
     veranderde is de volledige geldige variant daarom leidend; via alleen de
     append-merge zou zo'n legitieme snoei stil verloren gaan. */
  if (json(hun) === json(basis)) {
    handelingToevoegingen(basis, ons, 'handelingLog/request');
    return ons;
  }
  if (json(ons) === json(basis)) {
    handelingToevoegingen(basis, hun, 'handelingLog/database');
    return hun;
  }
  const nieuw = handelingToevoegingen(basis, ons, 'handelingLog/request');
  handelingToevoegingen(basis, hun, 'handelingLog/database');
  const uit = hun.slice();
  /* `nieuw` staat nieuwste-eerst; hang de oudste toevoeging eerst aan de
     actuele DB-kop om de requestvolgorde te behouden. */
  for (const regel of nieuw.slice().reverse())
    keten.noteerIn(uit, zonder(regel, ['hash', 'vorige', 'nr']), HANDELING_MAX);
  return uit;
}

function commandHash(regel) {
  return crypto.createHash('sha256').update(JSON.stringify(regel)).digest('hex').slice(0, 32);
}

function commandHeel(lijst) {
  const l = Array.isArray(lijst) ? lijst : [];
  for (let i = 0; i < l.length; i++) {
    const r = l[i];
    if (!r || !r.id || !r.zegel) return false;
    const kern = zonder(r, ['zegel']);
    if (commandHash(kern) !== r.zegel) return false;
    if (i > 0 && r.vorig !== l[i - 1].zegel) return false;
  }
  return true;
}

/* commandJournaal staat oudste-eerst. Door afkap is de gedeelde basis dus een
   ongewijzigde suffix van de oude lijst; nieuwe regels staan erachter. */
function commandToevoegingen(basis, variant, naam) {
  const b = Array.isArray(basis) ? basis : [];
  const v = Array.isArray(variant) ? variant : conflict(naam + ' is geen lijst.');
  const oud = new Map(b.filter(Boolean).map(r => [String(r.id), json(r)]));
  let grens = v.findIndex(r => !r || !oud.has(String(r.id)));
  if (grens < 0) grens = v.length;
  const gedeeld = v.slice(0, grens), nieuw = v.slice(grens);
  if (gedeeld.some(r => !r || !oud.has(String(r.id))) ||
      nieuw.some(r => !r || oud.has(String(r.id))))
    conflict(naam + ' is niet uitsluitend aan de staart uitgebreid.');
  if (b.length && !gedeeld.length && nieuw.length)
    conflict(naam + ' deelt geen bestaande ketenschakel meer.');
  const verwacht = b.slice(b.length - gedeeld.length);
  if (gedeeld.length !== verwacht.length || gedeeld.some((r, i) => json(r) !== json(verwacht[i])))
    conflict(naam + ' herschrijft bestaand bewijs.');
  return nieuw;
}

const API_VELDEN = ['commandJournaal', 'commandJournaalTotaal'];

function valideerWissing(b, v, naam) {
  const bl = Array.isArray(b.commandJournaal) ? b.commandJournaal : [];
  const vl = Array.isArray(v.commandJournaal) ? v.commandJournaal : [];
  const laatste = vl[vl.length - 1];
  const afkap = bl.length === API_MAX && vl.length === API_MAX ? 1 : 0;
  const oud = bl.slice(afkap), herschreven = vl.slice(0, -1);
  if (!laatste || laatste.actor !== 'systeem' || laatste.actie !== 'wissing in het spoor' ||
      laatste.uitslag !== 'gedaan' || herschreven.length !== oud.length)
    conflict(naam + ' is geen aantoonbare AVG-wissing.');
  let actor = null, geraakt = 0;
  for (let i = 0; i < oud.length; i++) {
    const voor = oud[i], na = herschreven[i];
    if (!voor || !na || voor.id !== na.id ||
        json(zonder(voor, ['actor', 'vorig', 'zegel'])) !==
        json(zonder(na, ['actor', 'vorig', 'zegel'])))
      conflict(naam + ' herschrijft meer dan de actorbinding.');
    if (voor.actor === na.actor) continue;
    if (na.actor !== 'gewist' || (actor && actor !== voor.actor))
      conflict(naam + ' wist niet precies één actorbinding.');
    actor = voor.actor; geraakt++;
  }
  const kop = bl.length ? bl[bl.length - 1].zegel : null;
  const gemeld = Number(laatste.na && laatste.na.regelsGewist);
  /* Een vol venster kapt bij het wissingbewijs precies de oudste basisregel. */
  if (afkap && gemeld === geraakt + 1 && bl[0] && (!actor || actor === bl[0].actor)) {
    actor = actor || bl[0].actor; geraakt++;
  }
  if (!geraakt || gemeld !== geraakt ||
      !laatste.voor || laatste.voor.kopVoorWissing !== kop)
    conflict(naam + ' verantwoordt de AVG-wissing niet volledig.');
}

function valideerApiVariant(b, v, naam) {
  const bl = Array.isArray(b.commandJournaal) ? b.commandJournaal : [];
  const vl = Array.isArray(v.commandJournaal) ? v.commandJournaal : [];
  const bt = Number(b.commandJournaalTotaal || 0), vt = Number(v.commandJournaalTotaal || 0);
  if (!commandHeel(vl) || json(zonder(b, API_VELDEN)) !== json(zonder(v, API_VELDEN)))
    conflict(naam + ' is niet geldig.');
  const laatste = vl[vl.length - 1];
  if (vt === bt + 1 && laatste && laatste.actie === 'wissing in het spoor') {
    valideerWissing(b, v, naam); return;
  }
  const nieuw = commandToevoegingen(bl, vl, naam);
  if (vt !== bt + nieuw.length) conflict('De teller van ' + naam + ' loopt niet met zijn regels mee.');
}

function mergeApiSpoor(basis, ons, hun) {
  const b = basis && typeof basis === 'object' ? basis : {};
  const o = ons && typeof ons === 'object' ? ons : conflict('apiSpoor/request is geen kaart.');
  const h = hun && typeof hun === 'object' ? hun : {};
  const bl = Array.isArray(b.commandJournaal) ? b.commandJournaal : [];
  const ol = Array.isArray(o.commandJournaal) ? o.commandJournaal : [];
  const hl = Array.isArray(h.commandJournaal) ? h.commandJournaal : [];
  const basisTotaal = Number(b.commandJournaalTotaal || 0);
  if (!commandHeel(ol)) conflict('De request apiSpoor-keten is gebroken.');
  if (!commandHeel(hl)) conflict('De actuele apiSpoor-keten is gebroken.');
  /* AVG-wissing herschrijft en herzegelt bewust de volledige actor-keten. Als
     PostgreSQL sinds de requestbasis niet veranderde mag die bewezen geldige
     herschrijving landen; de append-only concurrentiemerge kan haar per
     definitie niet reconstrueren. */
  if (json(h) === json(b)) {
    valideerApiVariant(b, o, 'apiSpoor/request');
    return o;
  }
  if (json(o) === json(b)) {
    valideerApiVariant(b, h, 'apiSpoor/database');
    return h;
  }
  if (json(zonder(b, API_VELDEN)) !== json(zonder(o, API_VELDEN)) ||
      json(zonder(b, API_VELDEN)) !== json(zonder(h, API_VELDEN)))
    conflict('apiSpoor bevat een onbekende gelijktijdige wijziging.');
  const nieuw = commandToevoegingen(bl, ol, 'apiSpoor/request');
  const hunNieuw = commandToevoegingen(bl, hl, 'apiSpoor/database');
  if (!commandHeel(hl)) conflict('De actuele apiSpoor-keten is gebroken.');
  if (Number(o.commandJournaalTotaal || 0) !== basisTotaal + nieuw.length)
    conflict('De teller van apiSpoor/request loopt niet met zijn regels mee.');
  if (Number(h.commandJournaalTotaal || 0) !== basisTotaal + hunNieuw.length)
    conflict('De teller van apiSpoor/database loopt niet met zijn regels mee.');
  const lijst = hl.slice();
  for (const regel of nieuw) {
    const kern = zonder(regel, ['zegel']);
    kern.vorig = lijst.length ? lijst[lijst.length - 1].zegel : null;
    lijst.push({ ...kern, zegel: commandHash(kern) });
  }
  if (lijst.length > API_MAX) lijst.splice(0, lijst.length - API_MAX);
  return { ...h, commandJournaal: lijst,
    commandJournaalTotaal: Number(h.commandJournaalTotaal || 0) + nieuw.length };
}

function voegSpoorSamen(sleutel, basis, ons, hun) {
  if (sleutel === 'handelingLog') return mergeHandeling(basis, ons, hun);
  if (sleutel === 'apiSpoor') return mergeApiSpoor(basis, ons, hun);
  return null;
}

module.exports = { voegSpoorSamen, mergeHandeling, mergeApiSpoor };
