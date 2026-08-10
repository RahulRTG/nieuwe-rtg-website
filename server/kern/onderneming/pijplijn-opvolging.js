/* Onderneming-deelmodule "pijplijn-opvolging": wat er in de verkoop vandaag
   toe doet.

   Los van ./pijplijn.js omdat dat bestand over de 10 kB van het modulebeleid
   ging. De naad is dezelfde als bij ./dagbeeld.js en ./dagbeeld-acties.js:
   daar staat wat het scherm TOONT, hier wat de ondernemer moet DOEN. Een regel
   erbij verandert het pijplijnbeeld dus niet van vorm.

   Eerst wat er stil ligt bij de klant, dan wat de scoringskans zegt -- in die
   volgorde, want een uitgebrachte offerte is verricht werk dat op het punt
   staat te verdampen, en een tegenvallende score is een patroon en geen
   aflopende klok. Aanvragen zonder prijs worden hier NIET genoemd: die staan
   al in ./relaties.js, en twee keer hetzelfde vragen leest als een storing. */
'use strict';

/* Onder dit percentage is de scoringskans het noemen waard. Een kwart: bij
   minder maakt de ondernemer drie offertes voor elke klus die hij krijgt. */
const LAAG_PERCENTAGE = 25;

function pijplijnOpvolging(p) {
  if (!p) return [];
  const uit = [];

  if (p.stil.aantal > 0) {
    const bedrag = p.stil.rijen.reduce((n, x) => n + x.bedrag, 0);
    uit.push({ id: 'stil', aantal: p.stil.aantal,
      kop: p.stil.aantal + ' offerte' + (p.stil.aantal === 1 ? ' ligt' : 's liggen') +
        ' al ' + p.stil.rijen[0].dagen + ' dagen bij de klant',
      waarom: 'Samen ' + Math.round(bedrag) + ' euro aan werk dat u al heeft uitgerekend. Wie niet meer belt, hoort meestal niets meer.' });
  }

  /* Een tegenvallende score, maar alleen als er genoeg is beslist om er iets
     over te mogen zeggen -- anders is dit een verwijt op basis van drie
     offertes. Zie de meterregel in ./pijplijn.js. */
  if (p.scoringskans.percentage !== null && p.scoringskans.percentage < LAAG_PERCENTAGE &&
      p.open.uitgebracht > 0) {
    uit.push({ id: 'scoringskans',
      kop: 'Van uw offertes wordt ' + p.scoringskans.percentage + '% akkoord',
      waarom: 'Over ' + p.scoringskans.beslist + ' afgeronde offertes. Dat kan aan de prijs liggen, aan de snelheid, of aan wie u een offerte stuurt -- maar het is werk dat u wel maakt.' });
  }
  return uit;
}

module.exports = { pijplijnOpvolging, LAAG_PERCENTAGE };
