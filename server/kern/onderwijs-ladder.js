/* RTG School, de ladder: de officiële Nederlandse niveaustructuur als data.
   Van de basisschool tot de universiteit en daarna -- een mens kan oud worden
   met dit systeem. Wij ORDENEN op de officiële niveaus; wij zijn geen
   examenbureau en claimen geen accreditatie of diploma's. Dat staat er ook
   letterlijk bij (EERLIJK), en de tests bewaken dat. */

/* Elke fase heeft een vaste id die nooit meer verandert: het leerpaspoort
   verwijst ernaar, ook decennia later. volgend = de normale route omhoog;
   de doorstroomkaart hieronder kent de zijsprongen. */
const FASEN = [
  // primair onderwijs: groep 1 t/m 8
  { id: 'po-g1', trap: 'po', naam: 'Groep 1', leeftijd: '4-5' },
  { id: 'po-g2', trap: 'po', naam: 'Groep 2', leeftijd: '5-6' },
  { id: 'po-g3', trap: 'po', naam: 'Groep 3', leeftijd: '6-7' },
  { id: 'po-g4', trap: 'po', naam: 'Groep 4', leeftijd: '7-8' },
  { id: 'po-g5', trap: 'po', naam: 'Groep 5', leeftijd: '8-9' },
  { id: 'po-g6', trap: 'po', naam: 'Groep 6', leeftijd: '9-10' },
  { id: 'po-g7', trap: 'po', naam: 'Groep 7', leeftijd: '10-11' },
  { id: 'po-g8', trap: 'po', naam: 'Groep 8', leeftijd: '11-12' },
  // voortgezet onderwijs: per richting en leerjaar
  { id: 'vmbo-bb', trap: 'vo', naam: 'Vmbo basisberoeps', jaren: 4 },
  { id: 'vmbo-kb', trap: 'vo', naam: 'Vmbo kaderberoeps', jaren: 4 },
  { id: 'vmbo-gl', trap: 'vo', naam: 'Vmbo gemengde leerweg', jaren: 4 },
  { id: 'vmbo-tl', trap: 'vo', naam: 'Vmbo theoretische leerweg (mavo)', jaren: 4 },
  { id: 'havo',    trap: 'vo', naam: 'Havo', jaren: 5 },
  { id: 'vwo',     trap: 'vo', naam: 'Vwo (atheneum/gymnasium)', jaren: 6 },
  // middelbaar beroepsonderwijs
  { id: 'mbo-1', trap: 'mbo', naam: 'Mbo niveau 1 (entree)', jaren: 1 },
  { id: 'mbo-2', trap: 'mbo', naam: 'Mbo niveau 2 (basisberoeps)', jaren: 2 },
  { id: 'mbo-3', trap: 'mbo', naam: 'Mbo niveau 3 (vakopleiding)', jaren: 3 },
  { id: 'mbo-4', trap: 'mbo', naam: 'Mbo niveau 4 (middenkader)', jaren: 4 },
  // hoger onderwijs
  { id: 'hbo-ad', trap: 'hbo', naam: 'Hbo associate degree', jaren: 2 },
  { id: 'hbo-b',  trap: 'hbo', naam: 'Hbo bachelor', jaren: 4 },
  { id: 'hbo-m',  trap: 'hbo', naam: 'Hbo master', jaren: 1 },
  { id: 'wo-b',   trap: 'wo', naam: 'Universitaire bachelor', jaren: 3 },
  { id: 'wo-m',   trap: 'wo', naam: 'Universitaire master', jaren: 2 },
  { id: 'wo-phd', trap: 'wo', naam: 'Promotie (PhD)', jaren: 4 },
  // en daarna: het leren stopt nooit
  { id: 'leven', trap: 'leven', naam: 'Een leven lang leren', jaren: null }
];

const TRAPPEN = {
  po:    { naam: 'Basisschool', volgorde: 1 },
  vo:    { naam: 'Voortgezet onderwijs', volgorde: 2 },
  mbo:   { naam: 'Middelbaar beroepsonderwijs', volgorde: 3 },
  hbo:   { naam: 'Hoger beroepsonderwijs', volgorde: 4 },
  wo:    { naam: 'Wetenschappelijk onderwijs', volgorde: 5 },
  leven: { naam: 'Een leven lang leren', volgorde: 6 }
};

/* De referentieniveaus taal en rekenen (Wet referentieniveaus): het officiële
   meetlint waar de leerstof-motor zijn leerdoelen aan ophangt. */
const REFERENTIE = {
  '1F': { naam: 'Fundament 1F', ijkpunt: 'eind basisschool' },
  '2F': { naam: 'Fundament 2F', ijkpunt: 'eind vmbo en mbo-2/3; burgerschapsniveau' },
  '3F': { naam: 'Streefniveau 3F', ijkpunt: 'eind havo en mbo-4' },
  '4F': { naam: 'Streefniveau 4F', ijkpunt: 'eind vwo' },
  '1S': { naam: 'Streefniveau 1S', ijkpunt: 'eind basisschool (streef)' }
};

/* De doorstroomkaart: welke overgangen horen bij het bestel. De normale
   route binnen de basisschool (groep n naar n+1) staat er niet apart in;
   die volgt uit de volgorde van FASEN. */
const DOORSTROOM = [
  { van: 'po-g8', naar: ['vmbo-bb', 'vmbo-kb', 'vmbo-gl', 'vmbo-tl', 'havo', 'vwo'], via: 'schooladvies' },
  { van: 'vmbo-bb', naar: ['mbo-1', 'mbo-2'] },
  { van: 'vmbo-kb', naar: ['mbo-2', 'mbo-3', 'mbo-4'] },
  { van: 'vmbo-gl', naar: ['mbo-3', 'mbo-4', 'havo'] },
  { van: 'vmbo-tl', naar: ['mbo-3', 'mbo-4', 'havo'] },
  { van: 'havo', naar: ['hbo-ad', 'hbo-b', 'vwo', 'mbo-4'] },
  { van: 'vwo', naar: ['wo-b', 'hbo-b'] },
  { van: 'mbo-2', naar: ['mbo-3'] },
  { van: 'mbo-3', naar: ['mbo-4'] },
  { van: 'mbo-4', naar: ['hbo-ad', 'hbo-b', 'leven'] },
  { van: 'hbo-ad', naar: ['hbo-b'] },
  { van: 'hbo-b', naar: ['hbo-m', 'wo-m', 'leven'] },
  { van: 'hbo-m', naar: ['leven'] },
  { van: 'wo-b', naar: ['wo-m', 'hbo-m'] },
  { van: 'wo-m', naar: ['wo-phd', 'leven'] },
  { van: 'wo-phd', naar: ['leven'] },
  { van: 'mbo-1', naar: ['mbo-2', 'leven'] }
];

/* De eerlijkheid, altijd mee in elk ladder-antwoord. */
const EERLIJK = 'RTG School ordent de leerstof op de officiële Nederlandse niveaus ' +
  '(groep 1-8, referentieniveaus, vmbo/havo/vwo, mbo 1-4, hbo en wo), maar is geen ' +
  'school of examenbureau: diploma\u2019s en examens lopen via de officiële instellingen. ' +
  'Wat je hier opbouwt is jouw eigen leerpaspoort.';

module.exports = { FASEN, TRAPPEN, REFERENTIE, DOORSTROOM, EERLIJK };
