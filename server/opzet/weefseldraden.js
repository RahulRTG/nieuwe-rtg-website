/* De economische naad van het stadsweefsel.

   De kansenlaag leest de vacatures, de bedrijven, de beroepen en de vraag uit
   de Mall die hier al bestaan, en legt ze op de kaart. Ze blijven wonen waar ze
   wonen -- kern/werk houdt de vacatures bij, de partnerlijst de bedrijven, de
   Beroepen-Bibliotheek de beroepen en de Mall zijn eigen vraagbeeld -- en het
   weefsel is er alleen de LEZER van.

   Waarom dit hier staat en niet als blok in kernlaag7: die laag zat op een
   handvol bytes van de bestandsgrens, en comments wegschaven om eronder te
   blijven is de meter bedriegen in plaats van hem gehoorzamen. Zelfde reden en
   zelfde vorm als ./malldraden.js.

   Alle vier laat gebonden, want ze zijn alle vier eerder gemount dan het punt
   waarop de koppeling wordt gelegd. */
'use strict';

module.exports = function weefselDraden(kern, hulp) {
  const { db, openVacatures } = hulp;
  return {

  vacatures: () => openVacatures(null, null).map(v => ({ id: v.id, code: v.supplierCode, bedrijf: v.bedrijf,
    func: v.func, uren: v.uren, loc: v.loc })),
  bedrijven: () => (db.data.suppliers || []).map(s => ({ code: s.code, naam: s.name, type: s.type || null, loc: s.loc })),
  beroepen: () => {
    const bb = require('../kern/beroepenbieb/data');
    return [...bb.TECHNIEK_BEROEPEN.map(b => ({ beroep: b, wereld: 'techniek', wereldLabel: 'Technisch & agrarisch' })),
      ...bb.ZAKEN_BEROEPEN.map(b => ({ beroep: b, wereld: 'zaken', wereldLabel: 'Bedrijfsleven' }))];
  },
  // vierde bron: waar in de Mall naar is gezocht en niets gevonden. Een vacature
  // zegt "hier is werk", een lege zoekopdracht "hier is een markt". Per woord
  // geteld, nooit per persoon; zie kern/mall/vraagbeeld.js.
  mallvraag: () => (kern.mall && kern.mall.mallVraagbeeld ? kern.mall.mallVraagbeeld.tekorten() : [])
  };
};
