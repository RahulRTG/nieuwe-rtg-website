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
const MAX_MATEN = 8;            // 8 maten is een fatsoenlijk stuk, en blijft klein
const MAX_KANALEN = 12;
const MAX_NOTEN = 512;          // per kanaal
const MAX_TRACKS = 50;          // per lid
const BPM_MIN = 40, BPM_MAX = 200;
// MIDI-nootnummers: C1 tot C7. Daarbuiten hoort bijna niemand nog iets zinnigs.
const TOON_MIN = 24, TOON_MAX = 96;

/* De instrumenten. `slag` speelt op stappen (aan of uit), `toon` speelt noten
   (met een toonhoogte en een lengte). Meer soorten zijn er niet, en dat is met
   opzet: een raster dat twee dingen kan is te leren; een raster dat tien dingen
   kan is een handleiding. */
const INSTRUMENTEN = {
  kick:  { naam: 'Kick',      soort: 'slag' },
  snare: { naam: 'Snare',     soort: 'slag' },
  clap:  { naam: 'Klap',      soort: 'slag' },
  hihat: { naam: 'Hi-hat',    soort: 'slag' },
  tom:   { naam: 'Tom',       soort: 'slag' },
  bas:   { naam: 'Bas',       soort: 'toon', basToon: 36 },
  toets: { naam: 'Toets',     soort: 'toon', basToon: 60 },
  snaar: { naam: 'Strijkers', soort: 'toon', basToon: 48 },
  pluk:  { naam: 'Pluk',      soort: 'toon', basToon: 60 },
  lead:  { naam: 'Lead',      soort: 'toon', basToon: 72 }
};
const NAMEN = Object.keys(INSTRUMENTEN);
const SLAGWERK = NAMEN.filter(n => INSTRUMENTEN[n].soort === 'slag');
const MELODISCH = NAMEN.filter(n => INSTRUMENTEN[n].soort === 'toon');

const bestaat = (naam) => Object.prototype.hasOwnProperty.call(INSTRUMENTEN, String(naam));
const soortVan = (naam) => (bestaat(naam) ? INSTRUMENTEN[naam].soort : null);
const stappenVoor = (maten) => STAPPEN_PER_MAAT * maten;

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

module.exports = { INSTRUMENTEN, NAMEN, SLAGWERK, MELODISCH, bestaat, soortVan, stappenVoor,
  beginKanalen, STAPPEN_PER_MAAT, MAX_MATEN, MAX_KANALEN, MAX_NOTEN, MAX_TRACKS,
  BPM_MIN, BPM_MAX, TOON_MIN, TOON_MAX };
