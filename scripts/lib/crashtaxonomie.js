/* ============================================================================
   DE CRASH-TAXONOMIE -- drie contracten, en waarom het er drie zijn.

   "Overleeft route X een crash?" is de verkeerde vraag, en hij is verkeerd op
   een manier die pas opvalt als je hem beantwoordt: hij geeft EEN antwoord op
   drie vragen die verschillende dingen beloven en op verschillende manieren
   stukgaan. Een route kan atomair zijn en toch onherstelbaar; hij kan
   herstelbaar zijn en toch niet te verzoenen met een aanbieder die al heeft
   geboekt.

     ATOMIC                   een interne operatie is alles of niets.
     RECOVERABLE              na een crash kan RTG deterministisch ontdekken
                              waar hij gebleven was en veilig verdergaan.
     EXTERNALLY_RECONCILABLE  heeft een aanbieder mogelijk al gecommit terwijl
                              RTG het antwoord verloor, dan kan RTG de waarheid
                              terugvinden.

   WAAROM DIT EEN EIGEN BESTAND IS EN GEEN LIJST IN DE PROEF. Twee lezers, en
   ze mogen nooit uit elkaar lopen: scripts/factuurproef.js MEET aan een van
   deze grenzen, scripts/gelddekking.js TELT wat er over gemeten is. Stond de
   definitie op allebei die plekken, dan is de eerste die verschuift een stille
   (LAT.md regel 4). Hij woont hier, en hij velt zelf geen oordeel.

   DE GRENZEN ZIJN HET PUNT. `crash-herstel: PROVEN` is een bewering over EEN
   moment, niet over crashes in het algemeen -- en welk moment dat was, is
   precies wat er niet in past. Daarom staat hieronder een gesloten lijst van
   crashgrenzen, en mag een uitslag alleen PROVEN heten als er bij staat WELKE
   grenzen eronder vallen. Is dat een deel, dan heet hij PROVEN_PARTIAL: een
   eigen stand, want "deels bewezen" afronden naar bewezen is de duurste
   afronding die dit huis kent.
   ========================================================================== */
'use strict';

const CONTRACTEN = Object.freeze({
  ATOMIC: 'Een interne operatie is alles of niets. Er bestaat geen moment waarop een deel ' +
    'van de uitkomst duurzaam is en de rest niet -- ook niet als het proces er middenin sterft.',
  RECOVERABLE: 'Na een crash kan RTG deterministisch ontdekken waar hij gebleven was en veilig ' +
    'verdergaan. Dat is iets ANDERS dan atomair: een operatie die netjes half is afgebroken kan ' +
    'herstelbaar zijn, en een atomaire operatie kan onherstelbaar zijn als niemand kan zien dat hij ' +
    'is gebeurd.',
  EXTERNALLY_RECONCILABLE: 'Heeft een aanbieder mogelijk al gecommit terwijl RTG het antwoord ' +
    'verloor, dan kan RTG de waarheid terugvinden. Deze derde bestaat omdat de eerste twee alleen ' +
    'over de eigen opslag gaan, en het duurste geldverlies juist buiten de deur ontstaat.'
});

/* DE GESLOTEN LIJST CRASHGRENZEN. Gesloten met opzet: een open lijst laat
   "bewezen" groeien door er grenzen buiten te laten. Wie er een bijzet, maakt
   daarmee zichtbaar dat er meer ONbewezen is -- en dat is de goede richting. */
const GRENZEN = Object.freeze({
  'voor-eerste-mutatie': 'het proces sterft voordat er iets is gemuteerd',
  'in-de-opslag': 'het proces sterft MIDDENIN de onderliggende schrijfactie',
  'na-commit-voor-antwoord': 'de schrijfactie is duurzaam, de aanroeper heeft nog niets gehoord',
  'na-commit-voor-bericht': 'de herstart valt tussen de commit en het bericht aan de betrokkene',
  'providercommit-zonder-antwoord': 'een aanbieder heeft geboekt en RTG kreeg het antwoord niet',
  'ambigu-extern-resultaat': 'het externe resultaat is onbeslist en moet worden verzoend'
});

/* De uitslag over een verzameling grenzen. Geen samengesteld cijfer: hij geeft
   een stand EN de lijsten waaruit die stand volgt, zodat een lezer altijd kan
   zien welk moment er wel en niet onder valt. */
function weeg(perGrens) {
  const alle = Object.keys(GRENZEN);
  const bewezen = alle.filter(g => perGrens[g] === 'PROVEN');
  const gezakt = alle.filter(g => perGrens[g] === 'FAILED');
  const open = alle.filter(g => perGrens[g] !== 'PROVEN' && perGrens[g] !== 'FAILED');
  const stand = gezakt.length ? 'FAILED'
    : bewezen.length === 0 ? 'UNKNOWN'
      : open.length === 0 ? 'PROVEN' : 'PROVEN_PARTIAL';
  return { stand, bewezen, gezakt, open,
    /* De reden hoort in de uitslag en niet in een leeswijzer: een stand
       PROVEN_PARTIAL zonder de open grenzen ernaast leest als PROVEN. */
    waarom: stand === 'PROVEN_PARTIAL'
      ? 'bewezen op ' + bewezen.length + ' van de ' + alle.length + ' crashgrenzen; open: ' + open.join(', ')
      : stand === 'UNKNOWN' ? 'geen enkele crashgrens beproefd'
        : stand === 'FAILED' ? 'gezakt op: ' + gezakt.join(', ')
          : 'alle ' + alle.length + ' crashgrenzen beproefd en gehaald' };
}

module.exports = { CONTRACTEN, GRENZEN, weeg };
