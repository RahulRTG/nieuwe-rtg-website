/* RTG Hardwarelab, deelbestand "bank": de disciplines, het gedempte palet en de
   spec-catalogus (BANK) per discipline, plus de pure generatieve helpers die geen
   database nodig hebben (deterministische keuze uit de bank, een palet en het
   lab-sjabloon voor een concept, en de slug voor de winkel). Puur data + functies;
   de runtime woont in index.js en aiwinkel.js. */

const DISCIPLINES = {
  apparaat:   { label: 'Apparaten', icon: '📱' },
  wearable:   { label: 'Wearables', icon: '⌚' },
  scherm:     { label: 'Schermen & panelen', icon: '🖥️' },
  sensor:     { label: 'Sensoren & IoT', icon: '📡' },
  edge:       { label: 'Edge & servers', icon: '🗄️' },
  accessoire: { label: 'Accessoires', icon: '🎛️' }
};
const STATUS = ['schets', 'ontwikkeling', 'maquette', 'prototype', 'productie', 'archief'];

// gedempt palet plus een paar edele metallics voor behuizingen; naam -> hex
const PALET = {
  'ruimtegrijs': '#3A3D42', 'grafiet': '#2B2B2B', 'titaan': '#8E9295', 'middernacht': '#101828',
  'obsidiaan': '#0E0F12', 'zilverzand': '#C9C4BC', 'parelwit': '#ECE9E1', 'ivoor': '#F2EBDD',
  'staalblauw': '#37505C', 'nachtgroen': '#1B2A24', 'bordeaux': '#5E1F2D', 'champagne': '#CBB994',
  'antraciet': '#33363B', 'gunmetal': '#53565A', 'koelblauw': '#2E3A46', 'zandsteen': '#B7A78C'
};
const PALET_NAMEN = Object.keys(PALET);

const BANK = {
  apparaat: {
    behuizing: ['unibody van gefreesd aluminium', 'keramische achterschaal', 'titanium frame met glazen front', 'gebogen glas rondom', 'robuust magnesium chassis'],
    chip: ['RTG S1 (8-core, 3 nm)', 'RTG S1 Pro met neurale kern', 'zuinige RTG A-serie', 'RTG S1 met veilige enclave'],
    materiaal: ['gerecycled aluminium', 'keramiek', 'gehard glas (anti-reflectie)', 'geanodiseerd titanium', 'bio-composiet'],
    poorten: ['USB-C 40 Gb/s', 'draadloos laden (Qi2)', 'eSIM + fysieke SIM', 'ultrabreedband (UWB)', 'RTG-passlezer (NFC)'],
    onderdelen: ['Processor', 'Scherm', 'Batterij', 'Camera', 'Behuizing'],
    verbruik: 'batterij ~4.500 mAh, standby ~3 dagen, snelladen 0-50% in ~20 min',
    afmetingen: '~160 x 74 x 7,8 mm, ~185 g'
  },
  wearable: {
    behuizing: ['titanium horlogekast', 'keramische smartring', 'lichtgewicht band van aluminium', 'in-ear behuizing van hars', 'monturen met titanium scharnieren'],
    chip: ['RTG W1 wearable-SoC (5 nm)', 'zuinige RTG A0 met sensor-hub', 'RTG BioCore met hartslag-DSP', 'ultralage-energie coprocessor'],
    materiaal: ['gerecycled titanium', 'saffierglas', 'medisch siliconen', 'keramiek', 'gerecycled aluminium'],
    poorten: ['Bluetooth LE 5.4', 'NFC / RTG-pas', 'draadloos laden', 'huidsensoren (hartslag/SpO2)', 'ECG-elektroden', 'bewegingssensor (9-assig)'],
    onderdelen: ['Sensorpakket', 'Rekenkern', 'Batterij', 'Radio', 'Behuizing'],
    verbruik: 'batterij ~2-7 dagen afhankelijk van de sensoren, draadloos laden in ~50 min',
    afmetingen: 'afhankelijk van de uitvoering; ~20-45 mm, ~8-50 g'
  },
  scherm: {
    behuizing: ['naadloos glazen paneel', 'ultradun aluminium frame', 'randloos OLED-vlak', 'gebogen ambient-display', 'e-ink hybride paneel'],
    chip: ['RTG DisplayEngine', 'lokale dimzone-controller', 'RTG kleurprocessor (10-bit)', 'ambient-lichtsensor met AI'],
    materiaal: ['anti-reflectie glas', 'geborsteld aluminium', 'mat keramiek', 'gerecycled polymeer'],
    poorten: ['HDMI 2.1', 'USB-C met beeld', 'draadloze spiegeling', 'ethernet (PoE)', 'RTG-koppelrail'],
    onderdelen: ['Paneel', 'Aansturing', 'Voeding', 'Sensoren', 'Behuizing'],
    verbruik: 'helderheid tot ~1.600 nits, verbruik ~30 W typisch',
    afmetingen: '~15,6 inch, ~4,4 mm dun, ~640 g'
  },
  sensor: {
    behuizing: ['weerbestendige puck (IP67)', 'compacte klikmodule', 'inbouwsensor achter glas', 'draadloze tag op muntformaat'],
    chip: ['RTG SenseCore', 'zuinige RTG A0 microcontroller', 'edge-AI versneller', 'radar-op-chip'],
    materiaal: ['gerecycled polymeer', 'geanodiseerd aluminium', 'siliconen afdichting', 'keramische antenne'],
    poorten: ['Bluetooth LE', 'Thread/Matter', 'RTG-mesh (868 MHz)', 'USB-C voor service', 'zonnecel-oplaadvlak'],
    onderdelen: ['Sensorkop', 'Rekenkern', 'Radio', 'Voeding', 'Behuizing'],
    verbruik: 'knoopcel of zonnecel, ~2 jaar op één lading',
    afmetingen: '~32 mm diameter, ~9 mm dik, ~18 g'
  },
  edge: {
    behuizing: ['gefreesd aluminium blok (passief gekoeld)', 'rackmodule van 1U', 'stille desktopkubus', 'stofdichte fanless-doos (IP54)'],
    chip: ['RTG EdgeCore (12-core)', 'RTG EdgeCore met NPU', 'redundante dubbele SoC', 'zuinige ARM-server-SoC'],
    materiaal: ['massief aluminium koellichaam', 'gerecycled staal', 'geborsteld titanium front', 'brandwerend polymeer'],
    poorten: ['2x 10 GbE', 'USB-C beheer', 'NVMe-uitbreiding', 'redundante voeding', 'RTG-mesh uplink'],
    onderdelen: ['Rekenkern', 'Opslag', 'Netwerk', 'Voeding', 'Koeling'],
    verbruik: 'typisch ~35 W, piek ~90 W, geruisloos onder ~40 dB',
    afmetingen: '~19 x 19 x 5 cm, ~1,9 kg'
  },
  accessoire: {
    behuizing: ['aluminium dock met magneetvlak', 'lederen hoes met standaard', 'draadloos laadstation', 'gefreesde stylus'],
    chip: ['RTG-koppelchip', 'laadcontroller met temp-bewaking', 'lage-latentie pen-processor', 'geen (passief)'],
    materiaal: ['geanodiseerd aluminium', 'met de hand geschept leder', 'gerecycled polymeer', 'siliconen grip'],
    poorten: ['USB-C passthrough', 'draadloos laden (Qi2)', 'RTG-magneetkoppeling', '3,5 mm audio'],
    onderdelen: ['Koppeling', 'Elektronica', 'Behuizing', 'Afwerking'],
    verbruik: 'passthrough tot 100 W, eigen verbruik verwaarloosbaar',
    afmetingen: 'compact, ~120 g afhankelijk van uitvoering'
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

// het lab-sjabloon: een deterministisch concept uit de bank (val-terug voor de AI)
function maakConcept(discipline, brief, naam, scho) {
  const b = BANK[discipline] || BANK.apparaat;
  const seed = hash((discipline || '') + '|' + (naam || '') + '|' + (brief || ''));
  const kleuren = palet(seed, 3);
  const materialen = kies(b.materiaal, seed >>> 2, 2);
  const poorten = kies(b.poorten, seed >>> 4, 3);
  const behuizing = b.behuizing[seed % b.behuizing.length];
  const chip = b.chip[(seed >>> 6) % b.chip.length];
  const insp = scho(brief, 120) || 'stille kracht';
  const verhaal = 'Een ' + behuizing + ' met ' + chip + ', afgewerkt in ' + materialen[0] + ' en de tinten ' +
    kleuren[0].naam + ' en ' + kleuren[1].naam + '. Geboren uit "' + insp + '": beheerst, zeker, gebouwd om te blijven. ' +
    'Kracht zonder drukte, precisie zonder lawaai.';
  return { behuizing, chip, materialen, kleuren, poorten, verhaal };
}

const DIAKRIET = new RegExp('[' + String.fromCharCode(0x0300) + '-' + String.fromCharCode(0x036f) + ']', 'g');
function slug(s) {
  return String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(DIAKRIET, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'rtg-product';
}

module.exports = { DISCIPLINES, STATUS, PALET, PALET_NAMEN, BANK, hash, kies, palet, maakConcept, slug };
