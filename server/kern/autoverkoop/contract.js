/* Autoverkoop (deelmodule): de tekst van het digitale koopcontract, uit de
   deal zelf (voertuig, prijs en vraagprijs, inruil met taxatie, aflevering).
   Los van kern/autoverkoop/deal.js, dat het contract opstelt, bijwerkt na een
   tegenbod en laat tekenen. */
'use strict';

function koopContract(d) {
  return [
    'RTG Autoverkoop, koopovereenkomst (concept)',
    '',
    'Voertuig: ' + d.autoNaam,
    'Prijs: € ' + d.prijs + (d.vraagprijs && d.vraagprijs !== d.prijs ? ' (vraagprijs € ' + d.vraagprijs + ')' : ''),
    d.inruil ? 'Inruil: ' + [d.inruil.merk, d.inruil.model, d.inruil.jaar].filter(Boolean).join(' ') + (d.inruil.taxatie != null ? ', getaxeerd op € ' + d.inruil.taxatie : ', taxatie volgt') : 'Inruil: geen',
    d.concierge ? 'Aflevering: concierge, op ' + (d.adres || 'uw adres') : 'Aflevering: ophalen bij de zaak',
    '',
    'Door te tekenen bevestigt u de koop tegen bovenstaande voorwaarden. De zaak levert de auto met de opgegeven garantie en historie. Betaling en tenaamstelling worden bij aflevering afgerond.'
  ].join('\n');
}

module.exports = { koopContract };
