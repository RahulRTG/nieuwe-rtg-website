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

/* ============================================================================
   TOEPASSELIJKHEID: EEN GRENS BESTAAT NIET OVERAL.

   De eerste versie van dit bestand deed alsof de zes grenzen overal gelden. Dat
   is niet waar, en het is op een dure manier niet waar: `in-de-opslag` -- het
   proces sterft MIDDENIN de schrijfactie -- bestaat op deze opslag helemaal
   niet. db/sqlite.js schrijft met BEGIN IMMEDIATE ... COMMIT, dus de save is EEN
   transactie die heel commit of heel terugrolt. Er is geen middelpunt om in te
   sterven. scripts/crashgrenzen.js heeft dat gemeten: een injectie tussen de
   schrijfopdracht en de checkpoint gaf exact de uitkomst van sterf-na-commit.

   Een kunstmatig crashpunt maken zodat de matrix mooier wordt, is het
   tegenovergestelde van meten. NOT_APPLICABLE vastleggen is architectonisch
   sterker: het zegt iets WAARS over de opslagsemantiek.

   MAAR DAN MAG DE WAARHEID OOK NIET UNIVERSEEL WORDEN GEDAAN. Crashsemantiek
   hangt niet aan een route alleen, maar aan vier dingen tegelijk:

       capability x opslagmotor x transactiegrens x uitvoeringspad

   Dit bestand dekt de tweede. De vierde -- welk pad een route werkelijk neemt --
   is NIET af te leiden en staat daarom niet in deze tabel: scripts/crashproef.js
   MEET hem, en vond dat eenenveertig van de negentig rijen langs geen van beide
   injectiepunten komen omdat die routes met de gewone write-behind save()
   schrijven. Een tabel die dat had geraden, had die eenenveertig als bestaande
   grenzen geteld.

   ELKE REGEL DRAAGT EEN GRAAD, en dat is hier het hele verschil tussen kennis en
   een aanname (BESTUUR.md):

     gemeten       een proef heeft dit aangetoond, met de proef erbij
     beredeneerd   volgt uit de opslagsemantiek zelf; niemand heeft het gedraaid
     onbekend      niet vastgesteld -- en dat blijft staan tot iemand KIJKT

   `onbekend` wordt hier nooit stil een `NOT_APPLICABLE`. Dat is geen technische
   schuld maar epistemische schuld: RTG weet nog niet wat het weet, en dat hoort
   ongemakkelijk te blijven staan. */
const OPSLAGSTRATEGIEEN = Object.freeze({
  'sqlite-transactie': 'db/sqlite.js schrijft alle collecties in EEN transactie (BEGIN IMMEDIATE ... COMMIT)',
  'json-tijdelijk-hernoem': 'db/snapshot.js schrijft een tijdelijk bestand, fsync, en hernoemt het',
  'postgres-transactie': 'db/postgres.js -- eigen transactiegrenzen, apart te beoordelen',
  'geheugen': 'db/geheugen.js bewaart niets buiten het proces'
});

const TOEPASSELIJK = Object.freeze({
  APPLICABLE: 'deze grens bestaat op deze opslag: er is een moment waarop hij geraakt kan worden',
  NOT_APPLICABLE: 'deze grens bestaat hier niet -- de opslagsemantiek kent dat moment niet',
  TE_BEOORDELEN: 'niet vastgesteld voor deze opslag; niemand heeft het gemeten of uitgeschreven'
});

/* Per grens per opslagstrategie: bestaat het moment, met welke graad, en waarom.
   Alleen `sqlite-transactie` is hier ergens `gemeten` -- dat is de opslag waarop
   dit huis draait en waarop scripts/crashgrenzen.js heeft gedraaid. De andere
   drie staan met opzet op TE_BEOORDELEN waar niemand heeft gekeken; ze
   overnemen van sqlite zou de fout maken waar deze tabel juist tegen bestaat. */
const TOEPASSELIJKHEID = Object.freeze({
  'in-de-opslag': {
    'sqlite-transactie': { stand: 'NOT_APPLICABLE', graad: 'gemeten',
      grond: 'een save is EEN transactie die heel commit of heel terugrolt; een injectie tussen ' +
        'de schrijfopdracht en de checkpoint gaf exact de uitkomst van sterf-na-commit',
      proef: 'scripts/crashgrenzen.js' },
    'json-tijdelijk-hernoem': { stand: 'TE_BEOORDELEN', graad: 'onbekend',
      grond: 'de hernoeming is zelf atomair, dus mogelijk bestaat het middelpunt ook hier niet -- ' +
        'maar dat is geredeneerd en niet gedraaid, en deze tabel neemt geen redenering over als feit' },
    'postgres-transactie': { stand: 'TE_BEOORDELEN', graad: 'onbekend',
      grond: 'apart te beoordelen: eigen transactiegrenzen, hier nooit onder een crashproef gehouden' },
    'geheugen': { stand: 'NOT_APPLICABLE', graad: 'beredeneerd',
      grond: 'deze opslag belooft geen duurzaamheid, dus er is geen duurzaam middelpunt om in te sterven' }
  }
});

/* De toepasselijkheid van EEN grens op EEN opslag. Een grens die hier niet in
   staat, is niet stilzwijgend APPLICABLE: hij is TE_BEOORDELEN. Het verschil
   tussen "wij weten dat hij bestaat" en "wij hebben er nooit naar gekeken" is
   precies wat deze laag moet bewaren. */
function toepasselijk(grens, opslag) {
  const rij = TOEPASSELIJKHEID[grens];
  if (!rij) return { stand: 'TE_BEOORDELEN', graad: 'onbekend',
    grond: 'voor deze grens is geen toepasselijkheid per opslag vastgelegd' };
  const cel = rij[opslag];
  if (!cel) return { stand: 'TE_BEOORDELEN', graad: 'onbekend',
    grond: 'deze grens is nooit tegen opslagstrategie ' + opslag + ' gehouden' };
  return cel;
}

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

module.exports = { CONTRACTEN, GRENZEN, OPSLAGSTRATEGIEEN, TOEPASSELIJK, TOEPASSELIJKHEID, toepasselijk, weeg };
