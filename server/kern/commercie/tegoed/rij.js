/* De rij van een houder: EEN vorm, op EEN plek. rijVan() in ../tegoed.js legt
   hem vast; rijKijk() rekent ermee zonder hem te bewaren. Twee kopieën van
   deze vorm zouden uiteenlopen (LAT.md regel 4). */
'use strict';
const { BELEID, inbegrepenVoor } = require('./inhoud');

const verseRij = (sleutel, pas, maand, oud) => ({ houder: sleutel, pas, maand, verbruikt: 0, bijgekocht: 0,
  beleid: (oud && oud.beleid) || BELEID.VRAAG_MIJ, autoBundel: (oud && oud.autoBundel) || null,
  maandMaxCenten: (oud && oud.maandMaxCenten) || null, autoDezeMaandCenten: 0, gewaarschuwdOp: null, bundels: [] });

const metInbegrepen = (r, pas, contractCredits) => {
  if (pas) r.pas = pas;
  const basis = Number.isFinite(contractCredits) ? contractCredits : inbegrepenVoor(r.pas);
  r.inbegrepen = Number.isFinite(basis) ? basis : null;
  return r;
};

module.exports = { verseRij, metInbegrepen };
