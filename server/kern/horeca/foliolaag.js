/* Horeca-kern (deelmodule): DE GASTREKENING VAN HET HOTEL, opzoeken en optellen.

   DERDE KEER DEZELFDE VERHUIZING (na ./regel.js en ./bezorglaag.js), en deze
   keer met een oorzaak die het opschrijven waard is. `folioVan` stond in
   routes/supplier/horeca/folio.js en werd daar op `kern` gezet. Dat werkte voor
   de buren -- betalen.js leest hem -- maar die `kern` is de ctx-KOPIE die
   supplier/horeca.js met Object.assign maakt. De echte kern krijgt hem dus
   nooit, en een ander domein kan er niet bij.

   Dat is precies de valkuil waar een domeingrens voor is: het leek een
   bedradingsprobleem ("zet die naam in GRENZEN.json") en was een
   eigendomsprobleem. Een rekensom die twee domeinen nodig hebben, hoort niet op
   een kern-eigenschap die een van de twee toevallig zet, maar in de kern zelf.

   WAT HIER WEL EN NIET STAAT. Hier stond eerst "alleen de leeskant", en dat
   bleek een halve grens: `boek()` moest een handeling later alsnog mee. Dat is
   geen slordigheid maar de goede uitkomst, en de scheiding die er nu ligt is
   scherper dan de vorige. BOEKEN is geen besluit van de zaak -- het is het
   mechanische gevolg van "er is iets op deze kamer gezet", met precies één
   regel eromheen (geen open folio, geen boeking) die voor iedereen gelijk moet
   zijn. Drie aanroepers gebruiken hem inmiddels: de kassa, de gastkant en de
   route zelf. OPENEN, de nachtrun, de borg en het afrekenen blijven in de
   route: dat zijn wél besluiten van de zaak, en die horen niet vanuit een
   ander domein aanroepbaar te zijn. */
'use strict';

const SOORTEN = ['kamer', 'toeristenbelasting', 'ontbijt', 'restaurant', 'minibar', 'bar', 'spa',
  'roomservice', 'parkeren', 'wasserij', 'activiteit', 'schade', 'overig'];

module.exports = ({ horeca, save, schoon }) => {
  const { H, nu, id, centen } = horeca;

  const F = (code) => { const h = H(code); if (!h.folios) h.folios = {}; return h.folios; };
  const som = (f) => (f.regels || []).reduce((t, r) => t + r.centen, 0);
  const betaald = (f) => (f.betalingen || []).reduce((t, b) => t + b.centen, 0);
  const openVan = (f) => som(f) - betaald(f);
  const publiek = (f) => Object.assign({}, f, { totaal: som(f), betaald: betaald(f), openstaand: openVan(f) });

  /* De open gastrekening op een kamer, of niets. Dit is de grendel onder
     roomservice EN onder de betaalwijze 'kamer': geen open folio betekent dat
     er niemand woont, en dan hoort er niets op die kamer te landen. */
  function folioVan(code, kamer) {
    return Object.values(F(code)).find(x => x.kamer === String(kamer || '') && x.status === 'open') || null;
  }

  /* Een bedrag op de gastrekening van een kamer. De enige regel eromheen is de
     grendel: bestaat er geen open folio, dan gaat de boeking niet door -- anders
     verdwijnt een rekening in een kamer die leegstaat en merkt niemand het tot
     de dagafsluiting. */
  function boek(code, kamer, regel) {
    const f = folioVan(code, kamer);
    if (!f) return { status: 404, error: 'Er staat geen open gastrekening op kamer ' + kamer + '.' };
    const soort = SOORTEN.includes(String(regel.soort)) ? String(regel.soort) : 'overig';
    const r = { id: id(3), soort, omschrijving: schoon(regel.omschrijving, 100) || soort,
      centen: centen(regel.centen), at: nu(), door: regel.door || 'systeem', bron: regel.bron || null };
    if (!r.centen) return { status: 400, error: 'Een boeking zonder bedrag doet niets.' };
    f.regels.push(r);
    save();
    return { ok: true, regel: r, folio: publiek(f) };
  }

  return { SOORTEN, F, som, betaald, openVan, publiek, folioVan, boek };
};
