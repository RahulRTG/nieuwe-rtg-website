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

const maandVan = t => new Date(t).toISOString().slice(0, 7);

/* De rij van een houder (een lid op codenaam, of een zaak op code). Rolt bij
   een nieuwe maand vanzelf om: verbruik is per maand, en een tegoed dat blijft
   staan zou "inbegrepen per maand" tot een leugen maken. rijVan legt hem vast;
   rijKijk rekent met een kopie of een vluchtige verse rij en schept niets
   (test/leeszonderscheppen.test.js). */
function maakRijen({ eigen, save, tijd }) {
  function rijVan(houder, pas, contractCredits) {
    const a = eigen.bak('aiTegoed');
    const sleutel = String(houder || '');
    const maand = maandVan(tijd());
    let r = a[sleutel];
    if (!r || r.maand !== maand) {
      r = a[sleutel] = verseRij(sleutel, pas, maand, r);
      save();
    }
    return metInbegrepen(r, pas, contractCredits);
  }
  function rijKijk(houder, pas, contractCredits) {
    const a = eigen.kijk('aiTegoed');
    const sleutel = String(houder || '');
    const maand = maandVan(tijd());
    const oud = a[sleutel];
    const r = (oud && oud.maand === maand) ? Object.assign({}, oud) : verseRij(sleutel, pas, maand, oud);
    return metInbegrepen(r, pas, contractCredits);
  }
  return { rijVan, rijKijk };
}

module.exports = { verseRij, metInbegrepen, maakRijen };
