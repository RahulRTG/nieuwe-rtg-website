/* RTG Ontwerpstudio, deelbestand "bank": de disciplines, het gedempte palet en de
   spec-catalogus (BANK) per discipline, plus de pure generatieve helpers die geen
   database nodig hebben (deterministische keuze, palet en het studio-sjabloon voor
   een concept). Puur data + functies; de runtime woont in index.js en aiwerk.js. */

const DISCIPLINES = {
  automotive: { label: 'Automotive', icon: '🏎️' },
  jacht:      { label: 'Jachten & boten', icon: '🛥️' },
  vliegtuig:  { label: 'Luchtvaart', icon: '✈️' },
  helikopter: { label: 'Helikopter', icon: '🚁' }
};
const STATUS = ['schets', 'ontwikkeling', 'maquette', 'prototype', 'productie', 'archief'];

// gedempt palet plus een paar edele metallics; naam -> hex
const PALET = {
  'obsidiaan': '#0E0F12', 'gunmetal': '#53565A', 'zilverzand': '#C9C4BC', 'champagne': '#CBB994',
  'middernachtblauw': '#101828', 'racing-groen': '#223B2E', 'houtskool': '#2B2B2B', 'ivoor': '#F2EBDD',
  'bordeaux': '#5E1F2D', 'cognac': '#8B5A2B', 'staalblauw': '#37505C', 'zandsteen': '#B7A78C',
  'antraciet': '#33363B', 'parelwit': '#ECE9E1', 'nachtgroen': '#1B2A24', 'titaan': '#8E9295'
};
const PALET_NAMEN = Object.keys(PALET);

const BANK = {
  automotive: {
    silhouet: ['mid-engine hypercar', 'grand tourer met lange motorkap', 'elektrische limousine', 'coupe-SUV op maat', 'open roadster', 'fastback-sedan'],
    aandrijving: ['V12 met elektrische boost', 'tri-motor elektrisch (~1000 kW)', 'waterstof-brandstofcel', 'plug-in hybride V8', 'dual-motor vierwielaandrijving'],
    materiaal: ['koolstofvezel monocoque', 'geanodiseerd aluminium', 'met de hand geschept leder', 'geborsteld titanium sierdelen', 'open-porie walnoot'],
    uitrusting: ['actieve aerodynamica', 'koolstof-keramische remmen', 'achterwielbesturing', 'luchtvering met wegvoorspelling', '20-weg verstelbaar gestoelte'],
    modules: ['Aandrijflijn', 'Chassis', 'Aerodynamica', 'Remmen', 'Interieur'],
    prestaties: '0-100 km/u in ~2,4 s, top ~350 km/u, elektrisch bereik ~500 km',
    afmetingen: 'lengte ~4,7 m, gewicht ~1,6 t'
  },
  jacht: {
    silhouet: ['plumb-bow superjacht', 'sportcruiser met achterterras', 'explorer met ijsklasse', 'ketch-getuigd zeiljacht', 'open dagcruiser'],
    aandrijving: ['diesel-elektrische pods', 'twin-diesel met waterjets', 'hybride met stille modus', 'volledig elektrisch met zonnedek'],
    materiaal: ['aluminium romp', 'teak-dek', 'koolstofvezel opbouw', 'met de hand gewreven laksysteem', 'gepolijst RVS-reling'],
    uitrusting: ['dynamische positionering', 'beach club met vouwbordes', 'stabilisatoren op nulsnelheid', 'glazen liftschacht', 'helideck'],
    modules: ['Romp', 'Aandrijving', 'Dek & opbouw', 'Interieur', 'Systemen'],
    prestaties: 'lengte ~55 m, kruissnelheid ~14 kn, bereik ~5.000 zeemijl',
    afmetingen: 'waterverplaatsing ~750 t, diepgang ~3,2 m'
  },
  vliegtuig: {
    silhouet: ['ultralong-range business jet', 'midsize jet', 'turboprop-tweemotor', 'supersone zakenjet (concept)'],
    aandrijving: ['twee turbofans', 'open-rotor concept', 'gereed voor duurzame kerosine (SAF)', 'hybride-elektrische taxifase'],
    materiaal: ['composiet romp', 'titanium hoofdliggers', 'met de hand gestikt leren interieur', 'geborsteld goud sierdelen'],
    uitrusting: ['stille cabine (~50 dB)', 'master suite met douche', 'circadiaans lichtsysteem', 'fly-by-wire zijstick'],
    modules: ['Cel', 'Voortstuwing', 'Cabine', 'Avionica', 'Systemen'],
    prestaties: 'bereik ~13.000 km, kruissnelheid Mach 0,90, plafond ~15.500 m',
    afmetingen: 'spanwijdte ~30 m, lengte ~33 m'
  },
  helikopter: {
    silhouet: ['VIP-medium twin', 'lichte single', 'stille stadsheli', 'offshore transport'],
    aandrijving: ['twee turboshaft-motoren', 'ommantelde staartrotor', 'hybride demonstrator'],
    materiaal: ['composiet cabine', 'vibratie-arme ophanging', 'met de hand gemaakt lederen clubinterieur', 'geborsteld aluminium'],
    uitrusting: ['ruisonderdrukte cabine', '4-persoons clubinterieur', 'autopilot met hover-hold', 'panoramaraam'],
    modules: ['Rotorsysteem', 'Voortstuwing', 'Cabine', 'Avionica', 'Systemen'],
    prestaties: 'kruissnelheid ~280 km/u, bereik ~800 km, 4-8 passagiers',
    afmetingen: 'rotordiameter ~13 m, lengte ~16 m'
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

// het studio-sjabloon: een deterministisch concept uit de bank (val-terug voor de AI)
function maakConcept(discipline, brief, naam, scho) {
  const b = BANK[discipline] || BANK.automotive;
  const seed = hash((discipline || '') + '|' + (naam || '') + '|' + (brief || ''));
  const kleuren = palet(seed, 3);
  const materialen = kies(b.materiaal, seed >>> 2, 2);
  const uitrusting = kies(b.uitrusting, seed >>> 4, 3);
  const silhouet = b.silhouet[seed % b.silhouet.length];
  const aandrijving = b.aandrijving[(seed >>> 6) % b.aandrijving.length];
  const insp = scho(brief, 120) || 'stille kracht';
  const verhaal = 'Een ' + silhouet + ' met ' + aandrijving + ', afgewerkt in ' + materialen[0] + ' en de tinten ' +
    kleuren[0].naam + ' en ' + kleuren[1].naam + '. Geboren uit "' + insp + '": beheerst, zeker, gebouwd om te blijven. ' +
    'Snelheid zonder drukte, luxe zonder lawaai.';
  return { silhouet, aandrijving, materialen, kleuren, uitrusting, verhaal };
}

module.exports = { DISCIPLINES, STATUS, PALET, PALET_NAMEN, BANK, hash, kies, palet, maakConcept };
