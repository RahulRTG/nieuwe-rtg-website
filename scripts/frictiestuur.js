/* KAN DE FRICTIEMOTOR HET AI-STUUR VANDAAG IETS VERTELLEN?

   EXECUTIE.md noemt als resterende dubbele waarheid dat kern/stuur/beleid.js wel
   kern/frictie/bodem.js leest maar niet de MOTOR. De voor de hand liggende stap
   is die motor aansluiten. Dit script vraagt eerst of dat iets zou opleveren --
   dezelfde volgorde als scripts/objectmodel.js bij `Asset`: meten voor je een
   koppeling verklaart.

   HET ANTWOORD IS: BIJNA NIETS, MAAR NIET NIETS -- EN DAT VERSCHIL IS GEMETEN.
   De eerste versie van dit script beweerde "nooit" en werd door zijn eigen
   uitslag weerlegd: bedrag alleen komt niet boven de autogrens, bedrag EN
   aantal samen wel (25.000 euro + 500 objecten = 42, grens 30). Twee factoren
   die elk onder de grens blijven, kunnen er samen overheen -- dat is precies
   waarom dit een meting is en geen redenering.

   DE REST IS REKENKUNDIG. De motor heeft twee ingangen:
   een GRONDSLAG (zestien handelingen die Command kent) en een CONTEXT (bedrag,
   aantal, omkeerbaarheid, zekerheid). Het stuur kent van beide bijna niets:

     de grondslag  er is geen afbeelding van een AI-route op een van die zestien
                   namen. Er een verzinnen is de fout van de cap `rooms`.
     de context    bedrag en aantal staan soms in de body. Onomkeerbaarheid en
                   persoonsgegevens niet -- dat zijn eigenschappen van de
                   HANDELING, en die staat nergens opgeschreven.

   Met de grondslag op `lezen` (0 punten) blijft alleen de context over, en die
   haalt de autogrens vrijwel nooit. Dit script rekent dat na op de motor zelf,
   zodat het een MEETUITSLAG is en geen redenering.

   WAT HIJ BEWAAKT. Hij eindigt met foutcode 1 zodra de kern van de bevinding
   verandert -- als een bedrag alleen ineens WEL zou verzwaren, dan is de
   koppeling opeens wel zinvol en hoort iemand daarnaar te kijken. Hij schrijft
   met opzet GEEN register in de wortel: dan zou hij aan een ratel moeten hangen
   (scripts/lib/metingen.js) voor een getal dat per definitie nul is.

   Draaien: npm run frictiestuur */
'use strict';

const { maakFrictie, NIVEAUS } = require('../server/kern/frictie');
const { contextUit, naarStuurniveau, STANDAARDGRENZEN } = require('../server/kern/stuur/frictieschaduw');

const frictie = maakFrictie({ beleid: STANDAARDGRENZEN });

/* Wat er werkelijk in een AI-body kan staan, en wat niet. De laatste twee zijn
   er om te laten zien WAT er zou moeten bestaan voordat de koppeling iets doet. */
const GEVALLEN = [
  { naam: 'lege body', body: {} },
  { naam: 'bedrag 5.000 euro (in centen)', body: { centen: 500000 } },
  { naam: 'bedrag 25.000 euro (in centen)', body: { centen: 2500000 } },
  { naam: 'bedrag 250.000 euro (in centen)', body: { centen: 25000000 } },
  { naam: 'bedrag zonder eenheid in de naam', body: { bedrag: 250000 } },
  { naam: 'lijst van 100 objecten', body: { items: new Array(100).fill(0) } },
  { naam: 'aantal 500 expliciet', body: { aantal: 500 } },
  { naam: '25.000 euro EN 500 objecten', body: { centen: 2500000, aantal: 500 } }
];

/* Wat de motor NIET uit een body kan halen. Deze twee bepalen de uitslag en
   staan daarom apart -- niet als geval maar als de ontbrekende ingang. */
const NIET_AF_TE_LEIDEN = [
  { veld: 'onomkeerbaar', punten: 20, waarom: 'of iets terug te draaien is, is een eigenschap van de handeling en staat niet in het verzoek' },
  { veld: 'persoonsgegevens', punten: 20, waarom: 'welke velden persoonsgegevens zijn, weet deze laag niet -- er is geen gegevensklasse per VELD (KANTOORMACHT.md)' },
  { veld: 'klantImpact', punten: 15, waarom: 'of de klant het merkt, volgt uit het domein en niet uit de body' }
];

/* DE VASTGELEGDE STAND: welke gevallen verzwaren er vandaag. Dit is geen norm
   maar een ANKER -- zakt of groeit hij, dan is er aan de grenzen of de factoren
   in kern/frictie/motor.js gezeten en hoort iemand te kijken of dat de bedoeling
   was. Bijwerken mag, met de reden erbij. */
const VERZWAREN = Object.freeze(['25.000 euro EN 500 objecten']);

function meet() {
  const rijen = GEVALLEN.map(g => {
    const { ctx, gevonden, eenheidOnbekend } = contextUit(g.body);
    const oordeel = frictie.beoordeel('lezen', ctx);
    return {
      naam: g.naam, score: oordeel.score, niveau: oordeel.niveau,
      zouVerzwaren: naarStuurniveau(oordeel.niveau) != null,
      gelezen: gevonden, eenheidOnbekend
    };
  });
  /* De tegenproef: mét een echte grondslag verzwaart hij wel. Dat is precies wat
     bewijst dat de motor werkt en de KOPPELING het probleem is. */
  const metGrondslag = ['betaling opnieuw', 'klant compenseren', 'massamutatie'].map(a => {
    const o = frictie.beoordeel(a, { centen: 2500000 });
    return { actie: a, score: o.score, niveau: o.niveau };
  });
  return { rijen, metGrondslag, verzwaren: rijen.filter(r => r.zouVerzwaren).map(r => r.naam) };
}

if (require.main === module) {
  const u = meet();
  console.log('KAN DE FRICTIEMOTOR HET AI-STUUR IETS VERTELLEN?\n');
  console.log('  Grondslag `lezen` (0 punten) -- alleen wat uit een body te halen is:\n');
  for (const r of u.rijen) {
    const merk = r.zouVerzwaren ? 'VERZWAART' : '         ';
    console.log('  ' + merk + '  ' + r.naam.padEnd(36) + 'score ' + String(r.score).padStart(3) + '  -> ' + r.niveau +
      (r.eenheidOnbekend.length ? '   [' + r.eenheidOnbekend.join(', ') + ': eenheid onbekend, niet gelezen]' : ''));
  }
  console.log('\n  Tegenproef -- MET een grondslag uit Command, zelfde bedrag van 25.000 euro:\n');
  for (const r of u.metGrondslag)
    console.log('            ' + r.actie.padEnd(36) + 'score ' + String(r.score).padStart(3) + '  -> ' + r.niveau);

  console.log('\n  Wat de motor nodig heeft en een body niet draagt:\n');
  for (const n of NIET_AF_TE_LEIDEN)
    console.log('            ' + (n.veld + ' (+' + n.punten + ')').padEnd(36) + n.waarom);

  const zelfde = u.verzwaren.length === VERZWAREN.length && u.verzwaren.every((n, i) => n === VERZWAREN[i]);
  console.log('\n  UITSLAG: ' + u.verzwaren.length + ' van de ' + u.rijen.length + ' gevallen verzwaart' +
    (u.verzwaren.length ? ' (' + u.verzwaren.join('; ') + ')' : '') + '.');
  if (zelfde) {
    console.log('           Dat is de vastgelegde stand. Wat ontbreekt om meer te vangen is een GRONDSLAG');
    console.log('           per AI-route -- een besluit van de eigenaar en geen bedrading.');
  } else {
    console.log('\n  DE STAND IS VERSCHOVEN. Vastgelegd: ' + (VERZWAREN.join('; ') || '(niets)'));
    console.log('  Nu:          ' + (u.verzwaren.join('; ') || '(niets)'));
    console.log('  Iemand heeft aan de grenzen of de factoren gezeten. Kijk of dat de bedoeling was,');
    console.log('  en werk VERZWAREN in dit bestand bij met de reden.');
  }
  process.exitCode = zelfde ? 0 : 1;
}

module.exports = { GEVALLEN, NIET_AF_TE_LEIDEN, VERZWAREN, meet };
