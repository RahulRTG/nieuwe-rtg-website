/* RTG Hardwarelab: het hardware-ontwerpbureau van de RTG-kantoren, de derde
   tak naast RTG Atelier (draagbaar) en RTG Ontwerpstudio (voertuigen). Hier
   ontwerpen we de eigen apparaten: PDA's en tablets, schermen en panelen,
   sensoren en IoT, de zaakdoos-familie (edge & servers) en accessoires. Elk
   concept begint met een brief; de AI tekent het uit (behuizing, chip,
   materialen, een gedempt palet, poorten en een verhaal), levert een
   stuklijst en de blik van de chef-engineer.

   Geen echte merken of chips als bevestigde leveranciers; dit is een
   concept- en ontwerplab met RTG-huisnamen. Beeld bouwen we met CSS-swatches
   uit het palet. Volgt het vaste kern-patroon maakHardwarelab(state). */

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

function maakHardwarelab({ db, save, crypto, anthropic, schoon }) {
  const scho = schoon || ((v, n) => String(v == null ? '' : v).trim().slice(0, n || 200));
  const id = () => 'hw' + crypto.randomBytes(4).toString('hex');
  const nu = () => new Date().toISOString();
  const d = () => db.data;

  function store() {
    if (!d().hardware || typeof d().hardware !== 'object') d().hardware = { ontwerpen: [], collecties: [] };
    if (!Array.isArray(d().hardware.ontwerpen)) d().hardware.ontwerpen = [];
    if (!Array.isArray(d().hardware.collecties)) d().hardware.collecties = [];
    if (!d().hardware._seed) {
      d().hardware._seed = true;
      const demo = [
        { discipline: 'apparaat', naam: 'RTG PDA One', brief: 'Robuuste personeels-PDA, één hand te bedienen, RTG-passlezer, lange batterij' },
        { discipline: 'edge', naam: 'Zaakdoos Mini', brief: 'Stille edge-doos voor achter de bar, passief gekoeld, twee netwerkpoorten' }
      ];
      for (const x of demo) { const o = _maak(x); o.concept = _concept(o.discipline, o.brief, o.naam); }
      save();
    }
    return d().hardware;
  }
  const alle = () => store().ontwerpen;
  const vind = oid => alle().find(o => o.id === oid);

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

  function _concept(discipline, brief, naam) {
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

  function publiek(o) {
    return {
      id: o.id, discipline: o.discipline, disciplineLabel: (DISCIPLINES[o.discipline] || {}).label || o.discipline,
      icon: (DISCIPLINES[o.discipline] || {}).icon || '🔧',
      naam: o.naam, brief: o.brief, huis: o.huis || null, collectie: o.collectie || null,
      status: o.status, concept: o.concept || null, stuklijst: o.stuklijst || null,
      kritiek: o.kritiek || null, winkel: o.winkel || null,
      at: o.at, updatedAt: o.updatedAt || o.at, door: o.door || null
    };
  }

  const DIAKRIET = new RegExp('[' + String.fromCharCode(0x0300) + '-' + String.fromCharCode(0x036f) + ']', 'g');
  function slug(s) {
    return String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(DIAKRIET, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'rtg-product';
  }
  function winkelStore() {
    if (!d().winkelProducten || typeof d().winkelProducten !== 'object') d().winkelProducten = {};
    return d().winkelProducten;
  }
  /* Een afgerond concept als echt product in de RTG-winkel zetten: het komt in
     db.data.winkelProducten en verschijnt zo op de verkooppagina en in het
     bestel-endpoint, naast de vaste catalogus. De prijs is euro, ex btw. */
  function naarWinkel(oid, prijs) {
    const o = vind(oid); if (!o) return { status: 404, error: 'Concept niet gevonden.' };
    const eenmalig = Math.max(0, Math.round(Number(prijs && prijs.eenmalig) || 0));
    const perMaand = Math.max(0, Math.round(Number(prijs && prijs.perMaand) || 0));
    if (!eenmalig) return { status: 400, error: 'Geef een geldige eenmalige prijs (euro, ex btw).' };
    const eenheid = scho(prijs && prijs.eenheid, 40) || 'per stuk';
    const con = o.concept || _concept(o.discipline, o.brief, o.naam);
    const store = winkelStore();
    let sl = (o.winkel && o.winkel.slug) ? o.winkel.slug : slug(o.naam);
    if (store[sl] && store[sl].concept && store[sl].concept !== o.id) sl = sl + '-' + o.id.slice(-4);
    store[sl] = {
      naam: o.naam, eenmalig, perMaand, eenheid,
      bron: 'hardwarelab', concept: o.id, discipline: o.discipline,
      disciplineLabel: (DISCIPLINES[o.discipline] || {}).label || o.discipline,
      beschrijving: con.behuizing + ' met ' + con.chip + '.',
      kleuren: (con.kleuren || []).slice(0, 3), at: nu()
    };
    o.winkel = { slug: sl, eenmalig, perMaand, eenheid, at: nu() };
    o.updatedAt = nu(); save();
    return { ok: true, ontwerp: publiek(o), product: store[sl], slug: sl };
  }
  function uitWinkel(oid) {
    const o = vind(oid); if (!o) return { status: 404, error: 'Concept niet gevonden.' };
    if (o.winkel && o.winkel.slug) { const store = winkelStore(); delete store[o.winkel.slug]; }
    o.winkel = null; o.updatedAt = nu(); save();
    return { ok: true, ontwerp: publiek(o) };
  }

  function _maak(data) {
    const discipline = DISCIPLINES[data.discipline] ? data.discipline : 'apparaat';
    const o = {
      id: id(), discipline, naam: scho(data.naam, 100) || 'Naamloos concept',
      brief: scho(data.brief, 600), huis: scho(data.huis, 80) || null, collectie: scho(data.collectie, 80) || null,
      concept: null, stuklijst: null, kritiek: null,
      status: 'schets', at: nu(), updatedAt: nu(), door: scho(data.door, 60) || null
    };
    alle().unshift(o);
    if (alle().length > 5000) alle().length = 5000;
    return o;
  }

  function overzicht() {
    const on = alle();
    const perStatus = {}; for (const s of STATUS) perStatus[s] = 0;
    const perDiscipline = {};
    for (const o of on) { perStatus[o.status] = (perStatus[o.status] || 0) + 1; perDiscipline[o.discipline] = (perDiscipline[o.discipline] || 0) + 1; }
    return {
      ok: true,
      disciplines: Object.entries(DISCIPLINES).map(([k, v]) => ({ id: k, label: v.label, icon: v.icon, aantal: perDiscipline[k] || 0 })),
      statussen: STATUS,
      ontwerpen: on.map(publiek),
      collecties: store().collecties.slice().reverse(),
      kpi: { totaal: on.length, perStatus, inProductie: perStatus['productie'] || 0, huizen: [...new Set(on.map(o => o.huis).filter(Boolean))].length }
    };
  }

  function ontwerpMaak(data) {
    if (!scho(data && data.naam, 100)) return { status: 400, error: 'Geef het concept een naam.' };
    const o = _maak(data || {}); save();
    return { ok: true, ontwerp: publiek(o) };
  }
  function ontwerpZet(oid, patch) {
    const o = vind(oid); if (!o) return { status: 404, error: 'Concept niet gevonden.' };
    patch = patch || {};
    if (patch.naam != null) o.naam = scho(patch.naam, 100) || o.naam;
    if (patch.brief != null) o.brief = scho(patch.brief, 600);
    if (patch.huis != null) o.huis = scho(patch.huis, 80) || null;
    if (patch.collectie != null) o.collectie = scho(patch.collectie, 80) || null;
    if (patch.status != null && STATUS.includes(patch.status)) o.status = patch.status;
    if (patch.verhaal != null && o.concept) o.concept.verhaal = scho(patch.verhaal, 800);
    o.updatedAt = nu(); save();
    return { ok: true, ontwerp: publiek(o) };
  }
  function ontwerpVerwijder(oid) {
    const s = store(); s.ontwerpen = s.ontwerpen.filter(o => o.id !== oid); save();
    return { ok: true };
  }
  function collectieMaak(data) {
    const naam = scho(data && data.naam, 80); if (!naam) return { status: 400, error: 'Geef de serie een naam.' };
    const c = { id: id(), naam, seizoen: scho(data.seizoen, 40) || null, huis: scho(data.huis, 80) || null, at: nu() };
    store().collecties.push(c); save();
    return { ok: true, collectie: c };
  }

  /* Het productblad per serie: alle concepten die aan deze serie zijn
     toegewezen (op naam), met hun uitgewerkte concept, klaar om als
     presentatie te tonen, te printen of als PDF te bewaren. */
  function productblad(naam) {
    const sleutel = scho(naam, 80);
    if (!sleutel) return { status: 400, error: 'Kies een serie.' };
    const col = store().collecties.find(c => c.naam === sleutel) || null;
    const items = alle().filter(o => o.collectie === sleutel);
    if (!col && !items.length) return { status: 404, error: 'Geen serie met concepten gevonden.' };
    const disciplines = [...new Set(items.map(o => o.discipline))]
      .map(k => (DISCIPLINES[k] || {}).label || k);
    return {
      ok: true,
      serie: col || { naam: sleutel, seizoen: null, huis: null },
      disciplines,
      aantal: items.length,
      ontwerpen: items.map(publiek),
      gemaaktOp: nu()
    };
  }

  async function aiConcept(oid) {
    const o = vind(oid); if (!o) return { status: 404, error: 'Concept niet gevonden.' };
    let concept = null;
    if (anthropic) {
      try {
        const sys = require('./rahul').RAHUL_LEAD + 'je bent de chef-engineer van RTG Hardwarelab, het eigen hardware-ontwerpbureau van RTG voor ' +
          ((DISCIPLINES[o.discipline] || {}).label || o.discipline) + '. Ontwerp een hardware-concept op basis van de brief. Antwoord ALLEEN met JSON: ' +
          '{"behuizing":"..","chip":"..","materialen":[".."],"kleuren":[{"naam":"..","hex":"#RRGGBB"}],"poorten":[".."],"verhaal":".."}. ' +
          'Gedempt "quiet luxury"-palet, geen felle kleuren. Gebruik RTG-huisnamen voor chips (geen echte merken). Kort en concreet, in het Nederlands.';
        const r = await anthropic.messages.create({ model: 'claude-sonnet-5', max_tokens: 700, system: sys, messages: [{ role: 'user', content: 'Huis: ' + (o.huis || 'RTG Hardwarelab') + '. Naam: ' + o.naam + '. Brief: ' + (o.brief || o.naam) }] });
        const t = (r && r.content && r.content[0] && r.content[0].text || '');
        const jm = t.match(/\{[\s\S]*\}/);
        if (jm) { const p = JSON.parse(jm[0]);
          concept = {
            behuizing: scho(p.behuizing, 120), chip: scho(p.chip, 120), verhaal: scho(p.verhaal, 800),
            materialen: (Array.isArray(p.materialen) ? p.materialen : []).slice(0, 4).map(x => scho(x, 80)),
            poorten: (Array.isArray(p.poorten) ? p.poorten : []).slice(0, 5).map(x => scho(x, 100)),
            kleuren: (Array.isArray(p.kleuren) ? p.kleuren : []).slice(0, 4).map(k => ({ naam: scho(k && k.naam, 40) || 'toon', hex: /^#[0-9a-fA-F]{6}$/.test(k && k.hex) ? k.hex : '#53565A' }))
          };
          if (!concept.behuizing || !concept.kleuren.length) concept = null;
        }
      } catch (e) { /* val terug op het lab-sjabloon */ }
    }
    o.concept = concept || _concept(o.discipline, o.brief, o.naam);
    o.updatedAt = nu(); save();
    return { ok: true, ontwerp: publiek(o) };
  }

  function aiStuklijst(oid) {
    const o = vind(oid); if (!o) return { status: 404, error: 'Concept niet gevonden.' };
    const b = BANK[o.discipline] || BANK.apparaat;
    const con = o.concept || _concept(o.discipline, o.brief, o.naam);
    const mats = con.materialen.length ? con.materialen : ['aluminium'];
    const onderdelen = b.onderdelen.map((naam, i) => ({
      naam, spec: (i === 0 ? con.chip : (con.poorten[i % Math.max(1, con.poorten.length)] || 'volgens lab-standaard'))
    }));
    o.stuklijst = {
      onderdelen,
      verbruik: b.verbruik,
      afmetingen: b.afmetingen,
      materiaalpakket: mats,
      kleurwegen: con.kleuren.map(k => k.naam),
      controle: ['ontwerpreview met de chef-engineer', 'maquette/mock-up ter goedkeuring', 'prototype met validatie voor vrijgave'],
      opmerking: 'Conceptcijfers voor het lab; certificering (CE/FCC) en productievrijgave lopen buiten dit ontwerpspoor.'
    };
    o.updatedAt = nu(); save();
    return { ok: true, ontwerp: publiek(o) };
  }

  async function aiKritiek(oid, vraag) {
    const o = vind(oid); if (!o) return { status: 404, error: 'Concept niet gevonden.' };
    const con = o.concept || _concept(o.discipline, o.brief, o.naam);
    const regels = [
      'Behuizing: het ' + con.behuizing + ' is herkenbaar; houd een zuivere lijn en snijd overbodige naden weg.',
      'Chip: ' + con.chip + ' past bij de positionering; laat de stille koeling en de accuduur het verhaal dragen.',
      'Materiaal: ' + con.materialen.join(' en ') + ' geven gewicht; zet een enkel contrast in ' + (con.kleuren[2] || con.kleuren[0]).naam + ' voor spanning.',
      'Gebruik: ' + (con.poorten[0] || 'de aansluiting') + ' is het verschil met de rest; maak dat voelbaar in de eerste seconde.'
    ];
    const v = String(vraag || '').replace(/[<>]/g, '').trim().slice(0, 300);
    if (anthropic) {
      try {
        const sys = require('./rahul').RAHUL_LEAD + 'je bent de chef-engineer van RTG Hardwarelab. Geef een korte, scherpe maar respectvolle kritiek: behuizing, chip, materiaal en het gebruik in de hand. In het Nederlands. Situatie: ' +
          o.naam + ' (' + ((DISCIPLINES[o.discipline] || {}).label) + '), ' + con.behuizing + ', ' + con.chip + ', tinten ' + con.kleuren.map(k => k.naam).join('/') + '.';
        const r = await anthropic.messages.create({ model: 'claude-sonnet-5', max_tokens: 450, system: sys, messages: [{ role: 'user', content: v || 'Geef je kritiek en een concreet verbeterpunt.' }] });
        const t = (r && r.content && r.content[0] && r.content[0].text || '').trim();
        if (t) { o.kritiek = t; o.updatedAt = nu(); save(); return { ok: true, kritiek: t, ontwerp: publiek(o) }; }
      } catch (e) { /* regelgebaseerde terugval */ }
    }
    o.kritiek = regels.join(' '); o.updatedAt = nu(); save();
    return { ok: true, kritiek: o.kritiek, punten: regels, ontwerp: publiek(o) };
  }

  return { hardware: { DISCIPLINES, STATUS, PALET, overzicht, ontwerpMaak, ontwerpZet, ontwerpVerwijder, collectieMaak, productblad, naarWinkel, uitWinkel, aiConcept, aiStuklijst, aiKritiek } };
}

module.exports = { maakHardwarelab, DISCIPLINES, STATUS };
