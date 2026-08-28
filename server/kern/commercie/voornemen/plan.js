/* WAT EEN VOORNEMEN IS, EN WANNEER HET NIET MEER MAG VERANDEREN.

   ../voornemen.js is de levensloop -- opstellen, keuren, aftekenen, uitvoeren.
   Dit bestand is de VORM: de standen, de toegestane overgangen, en de
   vingerafdruk waarmee een goedgekeurd plan zichzelf bewaakt.

   DE VINGERAFDRUK IS HET BELANGRIJKST. Zonder hem is "goedgekeurd" een stempel op
   een plan dat daarna nog kan veranderen: keur 900 euro goed, voer 9000 uit. De
   afdruk wordt gerekend over ALLES wat de goedkeuring betekenis geeft -- de
   stappen, hun bedragen, hun volgorde, het doel -- en bij elke uitvoering
   opnieuw. Wijkt hij af, dan is de goedkeuring vervallen en niet "bijna geldig".

   DE VOLGORDE TELT MEE, en dat is geen detail: vijf hotels in een andere
   volgorde boeken is een ander plan als de derde het budget opmaakt.

   DE STANDEN:

     OPGESTELD    er ligt een plan, er is nog niets gewogen
     GEKEURD      het besluit zegt ja; uitvoeren mag
     WACHT        er is een tweede handtekening of extra bewijs nodig
     AFGEWEZEN    het besluit zegt nee, met de reden
     BEZIG        de eerste stap is uitgevoerd
     UITGEVOERD   alle stappen zijn af
     GESTAAKT     afgebroken, met de reden en de stand waarin het gebeurde

   BEZIG IS EEN EIGEN STAND en geen detail van UITGEVOERD. Een voornemen dat
   halverwege blijft steken is precies het geval waarvoor deze laag bestaat; het
   moet zichtbaar zijn dat er drie van de vijf hotels geboekt staan. */
'use strict';

const crypto = require('crypto');

const STAND = {
  OPGESTELD: 'OPGESTELD', GEKEURD: 'GEKEURD', WACHT: 'WACHT', AFGEWEZEN: 'AFGEWEZEN',
  BEZIG: 'BEZIG', UITGEVOERD: 'UITGEVOERD', GESTAAKT: 'GESTAAKT'
};

/* Een overgang die hier niet staat is een programmeerfout en wordt geweigerd.
   Let op wat er NIET in staat: van AFGEWEZEN naar GEKEURD. Een nee wordt geen ja
   door het nog eens te vragen -- daar is een nieuw voornemen voor, met een eigen
   sleutel en een eigen keuring. */
const OVERGANG = {
  [STAND.OPGESTELD]: [STAND.GEKEURD, STAND.WACHT, STAND.AFGEWEZEN, STAND.GESTAAKT],
  [STAND.WACHT]: [STAND.GEKEURD, STAND.AFGEWEZEN, STAND.GESTAAKT],
  [STAND.GEKEURD]: [STAND.BEZIG, STAND.UITGEVOERD, STAND.GESTAAKT],
  [STAND.BEZIG]: [STAND.UITGEVOERD, STAND.GESTAAKT],
  [STAND.AFGEWEZEN]: [],
  [STAND.UITGEVOERD]: [],
  [STAND.GESTAAKT]: []
};

const MAG_UITVOEREN = new Set([STAND.GEKEURD, STAND.BEZIG]);
const MAX_STAPPEN = 200;

function magOvergaan(van, naar) {
  return Array.isArray(OVERGANG[van]) && OVERGANG[van].includes(naar);
}

/* Een stap. `centen` mag nul zijn (een stap die geen geld kost telt wel mee in
   de volgorde), maar niet negatief: een negatieve stap zou het totaal omlaag
   praten en zo de grens ondergraven waarop het geheel is goedgekeurd. */
function maakStap(s, i) {
  const c = Math.round(Number((s && s.centen) || 0));
  if (!Number.isFinite(c) || c < 0) return { error: 'Stap ' + (i + 1) + ' heeft geen geldig bedrag.' };
  const wat = String((s && s.wat) || '').slice(0, 80);
  if (!wat) return { error: 'Stap ' + (i + 1) + ' zegt niet wat er gebeurt.' };
  return { nr: i + 1, wat, doel: s.doel == null ? null : String(s.doel).slice(0, 80),
    centen: c, gegevens: s.gegevens == null ? null : s.gegevens,
    gedaan: false, uitkomst: null, at: null };
}

/* De vingerafdruk over alles wat de goedkeuring betekenis geeft. Niet over het
   hele object: `gedaan` en `uitkomst` veranderen tijdens de uitvoering en horen
   er dus juist NIET in -- anders vervalt de goedkeuring bij de eerste stap. */
function afdruk({ handeling, doel, stappen }) {
  const kern = JSON.stringify([String(handeling || ''), doel == null ? null : String(doel),
    (stappen || []).map(s => [s.nr, s.wat, s.doel, s.centen])]);
  return crypto.createHash('sha256').update(kern).digest('hex').slice(0, 32);
}

function totaal(stappen) {
  return (stappen || []).reduce((n, s) => n + (Number(s.centen) || 0), 0);
}

module.exports = { STAND, OVERGANG, MAG_UITVOEREN, MAX_STAPPEN, magOvergaan, maakStap, afdruk, totaal };
