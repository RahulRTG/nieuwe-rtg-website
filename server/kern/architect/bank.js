/* RTG Architectenbureau, deelbestand "bank": de disciplines, het gedempte natuurlijke
   palet en de spec-catalogus (BANK) per discipline, plus de pure generatieve helpers
   die geen database nodig hebben (deterministische keuze, palet en het bureau-sjabloon
   voor een concept). Puur data + functies; de runtime woont in index.js en aiwerk.js. */

const DISCIPLINES = {
  villa:      { label: "Villa's", icon: '🏖️' },
  penthouse:  { label: 'Penthouses', icon: '🏙️' },
  landgoed:   { label: 'Landgoederen', icon: '🏰' },
  chalet:     { label: 'Chalets', icon: '🏔️' },
  paviljoen:  { label: 'Paviljoens', icon: '🌿' }
};
const STATUS = ['schets', 'voorontwerp', 'ontwerp', 'maquette', 'realisatie', 'archief'];

// gedempt, natuurlijk palet voor gevels en interieurs; naam -> hex
const PALET = {
  'travertijn': '#C9BBA4', 'kalksteen': '#D6CDBB', 'zichtbeton': '#9A9791', 'leisteen': '#3E4348',
  'eiken': '#8A6A45', 'notenhout': '#5A4632', 'brons': '#7A6A4F', 'antraciet': '#33363B',
  'zandsteen': '#B7A78C', 'ivoor': '#F2EBDD', 'mosgroen': '#4A5340', 'terracotta': '#9E5B3E',
  'houtskool': '#2B2B2B', 'nachtblauw': '#1E2A38', 'parelwit': '#ECE9E1', 'klei': '#A8846B'
};
const PALET_NAMEN = Object.keys(PALET);

const BANK = {
  villa: {
    typologie: ['vrijstaande moderne villa', 'patiovilla rond een binnentuin', 'split-level villa op een helling', 'villa met zwevend dakvlak', 'villa met dubbelhoge woonhal'],
    constructie: ['betonskelet met vrije indeling', 'houtskeletbouw in CLT', 'staalframe met glasgevels', 'geisoleerd metselwerk met betonkern'],
    materiaal: ['travertijn', 'geborsteld eiken', 'zichtbeton', 'kalksteen', 'brons detaillering'],
    voorzieningen: ['verwarmd binnenzwembad', 'wijnkelder op temperatuur', 'thuisbioscoop', 'wellness met sauna en hammam', 'domotica met scenario-lichtsturing'],
    delen: ['Fundering & casco', 'Gevel', 'Dak', 'Installaties', 'Interieur'],
    oppervlak: 'woonoppervlak ~450 m2 over twee lagen',
    kavel: 'kavel ~1.500 m2 met omsloten tuin'
  },
  penthouse: {
    typologie: ['dubbelhoog penthouse met dakterras', 'hoekpenthouse met panoramaraam', 'penthouse met privelift', 'setback-penthouse met loggia'],
    constructie: ['betonvloeren met vrije indeling', 'lichte scheidingswanden op maat', 'vliesgevel met drievoudig glas', 'geisoleerd dakterras met houten deck'],
    materiaal: ['gepolijst natuursteen', 'notenhout', 'messing lijstwerk', 'microcement', 'rookglas'],
    voorzieningen: ['privelift tot in de hal', 'dakterras met buitenkeuken', 'klimaatplafond', 'geintegreerde geluidsinstallatie', 'panoramische schuifpuien'],
    delen: ['Casco & vloeren', 'Gevel & pui', 'Dakterras', 'Installaties', 'Interieur'],
    oppervlak: 'woonoppervlak ~280 m2 met ~120 m2 buitenruimte',
    kavel: 'bovenste twee lagen met vrij uitzicht'
  },
  landgoed: {
    typologie: ['klassiek landhuis met symmetrische opzet', 'landgoed met poortgebouw en bijgebouwen', 'boerderijlandgoed met schuurvolume', 'landhuis met oranjerie'],
    constructie: ['massief metselwerk met natuurstenen plint', 'houten kapconstructie', 'stalen serreconstructie', 'gerenoveerd casco met moderne kern'],
    materiaal: ['handvormsteen', 'leisteen dak', 'eiken spanten', 'natuursteen dorpels', 'smeedijzer'],
    voorzieningen: ['oranjerie', 'stallen en manege', 'wijnkelder', 'gastenverblijf', 'landschapstuin met vijverpartij'],
    delen: ['Hoofdhuis', 'Bijgebouwen', 'Dak & kap', 'Installaties', 'Tuin & terrein'],
    oppervlak: 'hoofdhuis ~700 m2, bijgebouwen ~300 m2',
    kavel: 'landgoed ~4 ha met lanen en waterpartij'
  },
  chalet: {
    typologie: ['alpenchalet met overstekend dak', 'chalet half in de helling', 'modern chalet met glasgevel', 'chalet met wellness op de onderste laag'],
    constructie: ['massieve houtbouw op betonnen souterrain', 'zwaar houtskelet met natuursteen plint', 'geisoleerde houtbouw voor het hooggebergte', 'hybride hout-beton'],
    materiaal: ['oud eiken', 'natuursteen', 'gebrand hout', 'wol en vilt', 'brons'],
    voorzieningen: ['ski-in ski-out berging', 'wellness met buitenbad', 'open haard met stookkern', 'vloerverwarming op warmtepomp', 'droogruimte voor uitrusting'],
    delen: ['Souterrain & casco', 'Houtbouw', 'Dak', 'Installaties', 'Interieur'],
    oppervlak: 'woonoppervlak ~320 m2 over drie lagen',
    kavel: 'kavel ~900 m2 aan de piste'
  },
  paviljoen: {
    typologie: ['tuinpaviljoen met glazen wanden', 'gastenpaviljoen los van het hoofdhuis', 'poolhouse met lounge', 'werkpaviljoen in het groen'],
    constructie: ['slank staalframe met schuifpuien', 'houtskelet met groendak', 'betonvloer met vrije plattegrond', 'demontabele modulaire opbouw'],
    materiaal: ['staal', 'glas', 'cederhout', 'zichtbeton', 'groendak'],
    voorzieningen: ['volledig te openen glasgevels', 'buitenkeuken', 'zwevende haard', 'zonwering met lamellen', 'verlichting in het maaiveld'],
    delen: ['Fundering', 'Casco & gevel', 'Dak', 'Installaties', 'Afwerking'],
    oppervlak: 'woonoppervlak ~90 m2, overdekt terras ~40 m2',
    kavel: 'vrijstaand in de tuin'
  }
};

function hash(s) { let h = 2166136261; s = String(s); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function kies(arr, seed, n) {
  const out = []; const used = new Set(); const s = (seed >>> 0);
  for (let i = 0; out.length < Math.min(n, arr.length); i++) {
    const idx = (s + i * 2654435761) % arr.length;
    if (!used.has(idx)) { used.add(idx); out.push(arr[idx]); }
  }
  return out;
}
function palet(seed, n) { return kies(PALET_NAMEN, seed, n).map(nm => ({ naam: nm, hex: PALET[nm] })); }

// het bureau-sjabloon: een deterministisch concept uit de bank (val-terug voor de AI)
function maakConcept(discipline, brief, naam, scho) {
  const b = BANK[discipline] || BANK.villa;
  const seed = hash((discipline || '') + '|' + (naam || '') + '|' + (brief || ''));
  const kleuren = palet(seed, 3);
  const materialen = kies(b.materiaal, seed >>> 2, 2);
  const voorzieningen = kies(b.voorzieningen, seed >>> 4, 3);
  const typologie = b.typologie[seed % b.typologie.length];
  const constructie = b.constructie[(seed >>> 6) % b.constructie.length];
  const insp = scho(brief, 120) || 'stille kracht';
  const verhaal = 'Een ' + typologie + ', opgetrokken in ' + constructie + ', afgewerkt in ' + materialen[0] + ' en de tinten ' +
    kleuren[0].naam + ' en ' + kleuren[1].naam + '. Geboren uit "' + insp + '": beheerst, zeker, gebouwd om te blijven. ' +
    'Ruimte zonder drukte, luxe zonder lawaai.';
  return { typologie, constructie, materialen, kleuren, voorzieningen, verhaal };
}

module.exports = { DISCIPLINES, STATUS, PALET, PALET_NAMEN, BANK, hash, kies, palet, maakConcept };
