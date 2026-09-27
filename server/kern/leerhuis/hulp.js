/* ============================================================================
   HET LEERHUIS -- de vaste weigeringen die elke handeling deelt.

   Een weigering zegt altijd waarom en, waar het kan, hoe het wel kan (de regel
   van kern/economie/firewall.js). `status` volgt de betekenis: 400 de vraag is
   onvolledig, 403 deze mens mag dit niet, 404 bestaat niet in DEZE organisatie,
   409 de stand laat het niet toe.
   ========================================================================== */
'use strict';

const { heeftBestuur, relatieActief } = require('./oordeel');

/* Een persoon is een sleutel met een wereld ervoor (de regel van
   kern/vakbewijs.js: een kale naam hoort bij twee mensen). `systeem:` is
   voorbehouden aan de kern zelf en komt nooit uit een verzoek. */
const PERSOON = /^(lid|concern|staff|rtf):[A-Za-z0-9_.-]{1,60}$/;
const ID = /^[A-Za-z0-9_.-]{1,60}$/;

class Weigering extends Error {
  constructor(reden, status, hoe) { super(reden); this.status = status || 403; this.hoe = hoe || null; }
}
const weiger = (reden, status, hoe) => { throw new Weigering(reden, status, hoe); };

function eisPersoon(k, wat) {
  if (typeof k !== 'string' || !PERSOON.test(k)) weiger((wat || 'persoon') + ' is geen geldige sleutel (lid:, concern:, staff: of rtf:)', 400);
  return k;
}
function eisId(x, wat) {
  if (typeof x !== 'string' || !ID.test(x)) weiger((wat || 'id') + ' ontbreekt of is ongeldig', 400);
  return x;
}
function eisOrg(st) {
  if (!st.org) weiger('deze organisatie heeft (nog) geen leerhuis', 404, 'open eerst het leerhuis van de organisatie');
}
/* Bestuursrollen zijn per organisatie en worden nooit geerfd van een ouder:
   een ACADEMY_OWNER van RTF Nederland is niets in RTF Amsterdam tot hij daar is
   benoemd (fail closed, grondwet 16). */
function eisBestuur(st, door, rollen, wat) {
  eisOrg(st);
  if (!relatieActief(st, door)) weiger(door + ' heeft geen lopende relatie met ' + st.org.id, 403);
  if (!rollen.some(r => heeftBestuur(st, door, r)))
    weiger((wat || 'deze handeling') + ' vraagt ' + rollen.join(' of ') + ' in ' + st.org.id, 403);
}
/* Welke kennisversies golden er toen dit bewijs of oordeel ontstond? Daarmee
   kan een auditor later zien of een latere kennisverandering het raakt. */
const kennisNu = (st, v) => Object.fromEntries(((st.vaardigheden[v] || {}).kennis || [])
  .map(k => [k, st.kennis[k] ? st.kennis[k].actief : null]));
/* Een id van de aanroeper mag, maar nooit een id dat al bestaat: dan zou de
   projectie het oude object stil vervangen, en dat is historie herschrijven
   (grondwet 18). Gevonden door de eigenschapstoets, niet door lezen. */
function nieuwId(bak, id, ctx) {
  if (id == null) return ctx.id();
  eisId(id);
  if (Object.prototype.hasOwnProperty.call(bak, id)) weiger('id ' + id + ' bestaat al; een bestaand object krijgt geen nieuwe geschiedenis', 409);
  return id;
}
function eisNiet(a, b, reden) { if (a === b) weiger(reden, 403); }

module.exports = { Weigering, weiger, eisPersoon, eisId, eisOrg, eisBestuur, eisNiet, kennisNu, nieuwId, PERSOON, ID };
