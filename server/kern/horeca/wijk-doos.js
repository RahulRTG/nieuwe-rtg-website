/* Horeca (kern): DE DOOS MET OVERDRACHTEN -- waar ze staan, en hoe lang al.

   Een aanbod (./wijk-overdracht.js), een weigering (./wijk-antwoord.js) en het
   scherm dat ze toont, kijken alle drie in dezelfde doos. Toen die doos in het
   ene bestand stond en het andere hem als argument kreeg, was de doos van het
   verkeerde bestand -- en dat is precies hoe twee lijsten uiteen gaan lopen.

   Hij is puur en heeft geen fabriek nodig: er zit niets in dat per zaak of per
   opzet verschilt. Zes regels, en ze staan een keer (LAT-regel 4). */
'use strict';

const MAXOPEN = 24;      // hoeveel aanbiedingen er tegelijk uit mogen staan
const MAXBEWAAR = 200;   // hoeveel er in de geschiedenis blijven staan

function doos(h) {
  if (!Array.isArray(h.wijkOverdrachten)) h.wijkOverdrachten = [];
  return h.wijkOverdrachten;
}

const open = (h) => doos(h).filter((o) => o.stand === 'aangeboden');

const minutenSinds = (at) => at ? Math.max(0, Math.round((Date.now() - Date.parse(at)) / 60000)) : 0;

/* De open aanbiedingen, met hoe lang ze staan. Geen grens en geen kleur: een
   aanbod dat lang staat is een feit waar een maître op mag handelen, en er is
   nergens vastgelegd hoe lang dat mag duren (HORECA.md, grens 7). */
const lijst = (h) => open(h).map((o) => Object.assign({}, o, { staat: minutenSinds(o.at) }));

/* WAAR EEN AANBOD OVER GAAT, in woorden: de gekozen tafels, of de hele wijk.
   Drie plekken hebben die zin nodig -- de aanbodkant, de antwoordkant en het
   journaal -- en drie zinnen die hetzelfde bedoelen gaan uiteen lopen. */
const wat = (o) => (o.tafels && o.tafels.length) ? o.tafels.join(', ') : o.wijkNaam;

module.exports = { doos, open, lijst, minutenSinds, wat, MAXOPEN, MAXBEWAAR };
