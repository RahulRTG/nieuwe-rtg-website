/* RTG Studio (deelmodule): de instrumenten en de maten.

   Dit is de GEDEELDE WOORDENSCHAT van de studio: de server keurt er invoer mee,
   de client bouwt er zijn klank mee, en Rahul mag niets voorstellen wat hier
   niet in staat. Eén lijst, één plek -- anders keurt de server iets goed dat de
   client niet kan spelen, of andersom.

   WAAROM ALLES GESYNTHETISEERD IS EN NIETS GESAMPLED. De bekende knip- en
   muziekprogramma's ontlenen hun kracht aan samplepakketten en plug-ins. Die
   kunnen wij niet meeleveren: we hebben er geen rechten op, en er komt sowieso
   niets van een vreemde server binnen (de CSP staat dat niet toe). Elke klank
   hier wordt dus door de app zelf opgewekt, uit oscillatoren en ruis -- dezelfde
   klanktaal als RTG Sound (public/shared/geluid.js).

   Dat is geen uitgeklede versie. Het is precies wat maakt dat wat je hier maakt
   VAN JOU is, zonder dat er een licentie van iemand anders in zit. En daarom mag
   het wél onder een clip: in kern/clips-studio.js stond "geen muziekbibliotheek,
   want we hebben geen rechten op muziek". Op eigen werk hebben we die wel. */

// De stappen per maat. 16 is de maat van een sequencer: vier tellen, elk in
// vieren. Dit getal staat hier en nergens anders.
const STAPPEN_PER_MAAT = 16;
/* 32 maten. Een lus van acht maten is een figuur, geen lied: daar past geen
   couplet en refrein in. Met 32 kan een stuk een vorm hebben, en met de
   secties hieronder kun je die vorm ook benoemen. */
const MAX_MATEN = 32;
const MAX_KANALEN = 16;
const MAX_NOTEN = 1024;         // per kanaal
const MAX_TRACKS = 50;          // per lid
const MAX_SECTIES = 12;
const TEKST_MAX = 16;           // tekens per lettergreep onder een noot
const BPM_MIN = 40, BPM_MAX = 200;
// MIDI-nootnummers: C1 tot C7. Daarbuiten hoort bijna niemand nog iets zinnigs.
const TOON_MIN = 24, TOON_MAX = 96;

/* De instrumenten. `slag` speelt op stappen (aan of uit), `toon` speelt noten
   (met een toonhoogte en een lengte). Meer soorten zijn er niet, en dat is met
   opzet: een raster dat twee dingen kan is te leren; een raster dat tien dingen
   kan is een handleiding. */
const INSTRUMENTEN = {
  kick:   { naam: 'Kick',      soort: 'slag' },
  snare:  { naam: 'Snare',     soort: 'slag' },
  clap:   { naam: 'Klap',      soort: 'slag' },
  hihat:  { naam: 'Hi-hat',    soort: 'slag' },
  ride:   { naam: 'Ride',      soort: 'slag' },
  shaker: { naam: 'Shaker',    soort: 'slag' },
  tom:    { naam: 'Tom',       soort: 'slag' },
  bas:    { naam: 'Bas',       soort: 'toon', basToon: 36 },
  toets:  { naam: 'Toets',     soort: 'toon', basToon: 60 },
  orgel:  { naam: 'Orgel',     soort: 'toon', basToon: 48 },
  snaar:  { naam: 'Strijkers', soort: 'toon', basToon: 48 },
  koper:  { naam: 'Koper',     soort: 'toon', basToon: 55 },
  pluk:   { naam: 'Pluk',      soort: 'toon', basToon: 60 },
  bel:    { naam: 'Bel',       soort: 'toon', basToon: 72 },
  lead:   { naam: 'Lead',      soort: 'toon', basToon: 72 },
  /* DE ZANG. Een noot van een stemkanaal draagt naast een toonhoogte ook een
     LETTERGREEP. Die wordt op het toestel van de luisteraar opgewekt met
     formantsynthese: klinkers zijn niets anders dan een paar resonanties, en
     die kun je met filters nabouwen (apps/klankwerk/zang.js legt het uit).

     WAT DIT WEL EN NIET IS. Het is een echt gezongen klinker, gevormd zoals een
     mond hem vormt -- geen opname van een zanger, en het gaat ook niet klinken
     als een zanger. Dat staat op het scherm en het staat hier, want een studio
     die dat verzwijgt verkoopt een illusie. Wat het wel geeft: een stem die
     UW woorden zingt op UW melodie, waar geen licentie van iemand anders in
     zit -- en die dus mee mag naar uw clip en naar de uitgave. */
  zang:   { naam: 'Zang',      soort: 'stem', basToon: 60, stemkleur: 'solo' },
  koor:   { naam: 'Koor',      soort: 'stem', basToon: 55, stemkleur: 'koor' },
  fluister: { naam: 'Fluister', soort: 'stem', basToon: 60, stemkleur: 'zacht' }
};
const NAMEN = Object.keys(INSTRUMENTEN);
const SLAGWERK = NAMEN.filter(n => INSTRUMENTEN[n].soort === 'slag');
const MELODISCH = NAMEN.filter(n => INSTRUMENTEN[n].soort === 'toon');
const STEMMEN = NAMEN.filter(n => INSTRUMENTEN[n].soort === 'stem');

const bestaat = (naam) => Object.prototype.hasOwnProperty.call(INSTRUMENTEN, String(naam));
const soortVan = (naam) => (bestaat(naam) ? INSTRUMENTEN[naam].soort : null);
const stappenVoor = (maten) => STAPPEN_PER_MAAT * maten;
// Een stem speelt noten, net als een melodisch instrument; hij draagt er alleen
// tekst bij. Deze ene functie voorkomt dat die regel op tien plekken staat.
const speeltNoten = (naam) => soortVan(naam) === 'toon' || soortVan(naam) === 'stem';

/* Een nieuw stuk begint niet leeg. Een leeg raster is de reden dat mensen een
   muziekprogramma weer sluiten: je hoort niets, dus je weet niet wat je doet.
   Dit is een eenvoudige maat die meteen klinkt, en die je overal kunt slopen. */
function beginKanalen() {
  return [
    { instrument: 'kick',  stappen: [0, 4, 8, 12] },
    { instrument: 'hihat', stappen: [2, 6, 10, 14] },
    { instrument: 'snare', stappen: [4, 12] },
    { instrument: 'bas',   noten: [{ stap: 0, toon: 36, lengte: 4 }, { stap: 8, toon: 43, lengte: 4 }] }
  ];
}

module.exports = { INSTRUMENTEN, NAMEN, SLAGWERK, MELODISCH, STEMMEN, bestaat, soortVan,
  speeltNoten, stappenVoor, beginKanalen, STAPPEN_PER_MAAT, MAX_MATEN, MAX_KANALEN, MAX_NOTEN,
  MAX_TRACKS, MAX_SECTIES, TEKST_MAX, BPM_MIN, BPM_MAX, TOON_MIN, TOON_MAX };
