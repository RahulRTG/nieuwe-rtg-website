/* De uitroltrap woonde in ./index.js, en dat bestand stond met 15,0 kB ver boven
   de maat (TAKEN.md 5.57). De naad is deze: het REGISTER zegt WELKE functies er
   zijn, de LADDER in welke VOLGORDE ze opengaan -- twee lijsten met twee redenen
   om te veranderen.

   DE DRIE CONTROLES ZIJN MEEVERHUISD, en dat is de eis en geen netheid: ze
   binden de ladder aan het register. Bleven ze achter, dan kan de ladder stil
   naast het register komen te staan -- precies de fout die de kop hieronder
   beschrijft als "de catalogus klopte, de fase-lijst klopte, en samen deugden ze
   niet". Ze draaien daarom bij het BOUWEN: zonder het OP_ID van het register is
   er niets te controleren; ./index.js roept controleer() aan zodra hij ze heeft.

   Draai los: node --test test/functieregister.test.js */
'use strict';

/* De INHOUD van de treden staat in ./fasetreden.js: welke functies er in een
   trede zitten en waarom. Hier staat welke treden er ZIJN, met hun naam, hun
   uitleg en de mensrem -- en de drie controles die deze ladder aan het register
   binden. */
const { FASE_VOORDEUR, FASE_START, FASE_ONTMOETEN, FASE_PARTNERS,
  FASE_BESTELLEN, FASE_FUNDAMENT, FASE_STAD } = require('./fasetreden');

const FASES = [
  { id: 'start', naam: 'Trede 0 · De smalle snee', aan: FASE_START, mens: false,
    uitleg: 'De kleinste stand die een echte livegang aankan: binnenkomen, je gegevens beheren, je aanmelden voor een pas, de leden-app en De Salon. Bestellen, betalen, partners, personeel en de RTFoundation blijven dicht. De backoffice blijft open, want een pasbesluit wordt door een mens genomen.' },
  { id: 'ontmoeten', naam: 'Trede 1 · Leden onder elkaar', aan: FASE_ONTMOETEN, mens: true,
    mensWaarom: 'Hier gaat het kanaal open waarop het ene lid het andere rechtstreeks bereikt. LIFE.md laat daar geen automaat toe, en praktisch: moderatie en misbruikafhandeling moeten bemenst zijn vóór deze trede open gaat, niet erna.',
    uitleg: 'Vrienden verbinden, directe berichten, gesprekken, ontmoetingen in de buurt en de sociale laag.' },
  { id: 'partners', naam: 'Trede 2 · De partners erbij', aan: FASE_PARTNERS, mens: false,
    uitleg: 'De partner-app gaat open: partners komen binnen, plaatsen vacatures en leden kunnen solliciteren. Er gaat nog geen geld om.' },
  { id: 'bestellen', naam: 'Trede 3 · De vloer draait', aan: FASE_BESTELLEN, mens: false,
    uitleg: 'Bestellen en bezorgen, de kassa, het personeel en de aansturing. Zonder betaalrail: met RTG_BETALEN_UIT=1 weigert elke betaalactie fail-closed.' },
  { id: 'fundament', naam: 'Trede 4 · Het fundament (de wig)', aan: FASE_FUNDAMENT, mens: true,
    mensWaarom: 'Hier gaat het geld aan. GELD.md: de grens is hard, geld verlaat het huis nooit autonoom. Er bestaat geen meting die deze trede vanzelf mag openen.',
    uitleg: 'De wig compleet: één stad, één sector diep, met een echte betaalrail, wallet, partnerfinanciën en uitbetalingen.' },
  { id: 'stad', naam: 'Trede 5 · De stad', aan: FASE_STAD, mens: false,
    uitleg: 'Alles wat een stad levend maakt: tickets, vervoer, kamers, events, de eerste eigen apps en de RTFoundation.' },
  { id: 'alles', naam: 'Trede 6 · Alles open', aan: null, mens: false,
    uitleg: 'De volledige catalogus open, zoals de standaard: elk genre, elke eigen app, elke dienst.' }
];

function controleer(OP_ID) {
  /* Drie controles op deze lijst, want een fase-lijst die klopt met zichzelf is
     precies wat hierboven een keer misging. */
  for (const f of FASES) for (const id of f.aan || [])
    if (!OP_ID[id]) throw new Error('functie-catalogus: trede "' + f.id + '" noemt onbekende functie: ' + id);
  // de voordeur zit in ELKE trede
  for (const f of FASES) if (f.aan) for (const id of FASE_VOORDEUR)
    if (!f.aan.includes(id)) throw new Error('functie-catalogus: trede "' + f.id + '" sluit de voordeur: ' + id);
  // en elke trede bevat zijn voorganger, anders klimt de uitrolregie omlaag
  for (let i = 1; i < FASES.length; i++) {
    const vorige = FASES[i - 1].aan, deze = FASES[i].aan;
    if (!vorige || !deze) continue;
    for (const id of vorige) if (!deze.includes(id))
      throw new Error('functie-catalogus: trede "' + FASES[i].id + '" sluit iets wat "' + FASES[i - 1].id + '" opende: ' + id);
  }
}

module.exports = { FASES, FASE_VOORDEUR, controleer };
