/* RTG Ontwerpstudio: het voertuig- en vaartuig-ontwerpbureau van de RTG-
   kantoren, de tegenhanger van RTG Atelier maar dan voor alles wat je
   beweegt. Vier disciplines: automotive (hypercars, GT's, limousines),
   jachten & boten, luchtvaart (business jets) en helikopters. Elk concept
   begint met een brief; de AI tekent het uit (silhouet, aandrijving,
   materialen, een gedempt palet, uitrusting en een verhaal), levert een
   specsheet en de blik van de chef-ontwerper.

   Geen echte merken als bevestigde partners; dit is een concept- en
   ontwerpstudio met RTG-huisnamen. Beeld bouwen we met CSS-swatches uit het
   palet. Volgt het vaste kern-patroon maakStudio(state). */

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

function maakStudio({ db, save, crypto, anthropic, schoon }) {
  const scho = schoon || ((v, n) => String(v == null ? '' : v).trim().slice(0, n || 200));
  const id = () => 'stu' + crypto.randomBytes(4).toString('hex');
  const nu = () => new Date().toISOString();
  const d = () => db.data;

  function store() {
    if (!d().studio || typeof d().studio !== 'object') d().studio = { ontwerpen: [], collecties: [] };
    if (!Array.isArray(d().studio.ontwerpen)) d().studio.ontwerpen = [];
    if (!Array.isArray(d().studio.collecties)) d().studio.collecties = [];
    if (!d().studio._seed) {
      d().studio._seed = true;
      const demo = [
        { discipline: 'automotive', naam: 'Meridiaan GT', brief: 'Elektrische grand tourer, obsidiaan, stil en zeker, voor lange afstanden' },
        { discipline: 'jacht', naam: 'Aurelia 55 Explorer', brief: 'Explorer-jacht van 55 meter, warm interieur, stille modus voor de nacht' }
      ];
      for (const x of demo) { const o = _maak(x); o.concept = _concept(o.discipline, o.brief, o.naam); }
      save();
    }
    return d().studio;
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

  function publiek(o) {
    return {
      id: o.id, discipline: o.discipline, disciplineLabel: (DISCIPLINES[o.discipline] || {}).label || o.discipline,
      icon: (DISCIPLINES[o.discipline] || {}).icon || '✎',
      naam: o.naam, brief: o.brief, huis: o.huis || null, collectie: o.collectie || null,
      status: o.status, concept: o.concept || null, specsheet: o.specsheet || null,
      kritiek: o.kritiek || null, at: o.at, updatedAt: o.updatedAt || o.at, door: o.door || null
    };
  }

  function _maak(data) {
    const discipline = DISCIPLINES[data.discipline] ? data.discipline : 'automotive';
    const o = {
      id: id(), discipline, naam: scho(data.naam, 100) || 'Naamloos concept',
      brief: scho(data.brief, 600), huis: scho(data.huis, 80) || null, collectie: scho(data.collectie, 80) || null,
      concept: null, specsheet: null, kritiek: null,
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
    const naam = scho(data && data.naam, 80); if (!naam) return { status: 400, error: 'Geef het programma een naam.' };
    const c = { id: id(), naam, seizoen: scho(data.seizoen, 40) || null, huis: scho(data.huis, 80) || null, at: nu() };
    store().collecties.push(c); save();
    return { ok: true, collectie: c };
  }

  async function aiConcept(oid) {
    const o = vind(oid); if (!o) return { status: 404, error: 'Concept niet gevonden.' };
    let concept = null;
    if (anthropic) {
      try {
        const sys = require('./rahul').RAHUL_LEAD + 'je bent de chef-ontwerper van RTG Ontwerpstudio, het meest exclusieve ontwerpbureau ter wereld voor ' +
          ((DISCIPLINES[o.discipline] || {}).label || o.discipline) + '. Ontwerp een concept op basis van de brief. Antwoord ALLEEN met JSON: ' +
          '{"silhouet":"..","aandrijving":"..","materialen":[".."],"kleuren":[{"naam":"..","hex":"#RRGGBB"}],"uitrusting":[".."],"verhaal":".."}. ' +
          'Gedempt "quiet luxury"-palet, geen felle kleuren. Geen echte merknamen. Kort en concreet, in het Nederlands.';
        const r = await anthropic.messages.create({ model: 'claude-sonnet-5', max_tokens: 700, system: sys, messages: [{ role: 'user', content: 'Huis: ' + (o.huis || 'RTG Ontwerpstudio') + '. Naam: ' + o.naam + '. Brief: ' + (o.brief || o.naam) }] });
        const t = (r && r.content && r.content[0] && r.content[0].text || '');
        const jm = t.match(/\{[\s\S]*\}/);
        if (jm) { const p = JSON.parse(jm[0]);
          concept = {
            silhouet: scho(p.silhouet, 120), aandrijving: scho(p.aandrijving, 120), verhaal: scho(p.verhaal, 800),
            materialen: (Array.isArray(p.materialen) ? p.materialen : []).slice(0, 4).map(x => scho(x, 80)),
            uitrusting: (Array.isArray(p.uitrusting) ? p.uitrusting : []).slice(0, 5).map(x => scho(x, 100)),
            kleuren: (Array.isArray(p.kleuren) ? p.kleuren : []).slice(0, 4).map(k => ({ naam: scho(k && k.naam, 40) || 'toon', hex: /^#[0-9a-fA-F]{6}$/.test(k && k.hex) ? k.hex : '#53565A' }))
          };
          if (!concept.silhouet || !concept.kleuren.length) concept = null;
        }
      } catch (e) { /* val terug op het studio-sjabloon */ }
    }
    o.concept = concept || _concept(o.discipline, o.brief, o.naam);
    o.updatedAt = nu(); save();
    return { ok: true, ontwerp: publiek(o) };
  }

  function aiSpecsheet(oid) {
    const o = vind(oid); if (!o) return { status: 404, error: 'Concept niet gevonden.' };
    const b = BANK[o.discipline] || BANK.automotive;
    const con = o.concept || _concept(o.discipline, o.brief, o.naam);
    const mats = con.materialen.length ? con.materialen : ['koolstofvezel'];
    const modules = b.modules.map((naam, i) => ({
      naam, spec: (i === 0 ? con.aandrijving : (con.uitrusting[i % Math.max(1, con.uitrusting.length)] || 'volgens studio-standaard'))
    }));
    o.specsheet = {
      modules,
      prestaties: b.prestaties,
      afmetingen: b.afmetingen,
      materiaalpakket: mats,
      kleurwegen: con.kleuren.map(k => k.naam),
      controle: ['ontwerpreview met de chef-ontwerper', 'maquette/schaalmodel ter goedkeuring', 'prototype met validatie voor vrijgave'],
      opmerking: 'Conceptcijfers voor de studio; homologatie en certificering lopen buiten dit ontwerpspoor.'
    };
    o.updatedAt = nu(); save();
    return { ok: true, ontwerp: publiek(o) };
  }

  async function aiKritiek(oid, vraag) {
    const o = vind(oid); if (!o) return { status: 404, error: 'Concept niet gevonden.' };
    const con = o.concept || _concept(o.discipline, o.brief, o.naam);
    const regels = [
      'Silhouet: het ' + con.silhouet + ' is herkenbaar; houd een zuivere lijn en snijd overbodige details weg.',
      'Aandrijving: ' + con.aandrijving + ' past bij de positionering; laat de stilte en het koppel het verhaal dragen.',
      'Materiaal: ' + con.materialen.join(' en ') + ' geven gewicht; zet een enkel contrast in ' + (con.kleuren[2] || con.kleuren[0]).naam + ' voor spanning.',
      'Ervaring: ' + (con.uitrusting[0] || 'de uitrusting') + ' is het verschil met de rest; maak dat voelbaar in de eerste seconde.'
    ];
    const v = String(vraag || '').replace(/[<>]/g, '').trim().slice(0, 300);
    if (anthropic) {
      try {
        const sys = require('./rahul').RAHUL_LEAD + 'je bent de chef-ontwerper van RTG Ontwerpstudio. Geef een korte, scherpe maar respectvolle kritiek: silhouet, aandrijving, materiaal en de ervaring aan boord. In het Nederlands. Situatie: ' +
          o.naam + ' (' + ((DISCIPLINES[o.discipline] || {}).label) + '), ' + con.silhouet + ', ' + con.aandrijving + ', tinten ' + con.kleuren.map(k => k.naam).join('/') + '.';
        const r = await anthropic.messages.create({ model: 'claude-sonnet-5', max_tokens: 450, system: sys, messages: [{ role: 'user', content: v || 'Geef je kritiek en een concreet verbeterpunt.' }] });
        const t = (r && r.content && r.content[0] && r.content[0].text || '').trim();
        if (t) { o.kritiek = t; o.updatedAt = nu(); save(); return { ok: true, kritiek: t, ontwerp: publiek(o) }; }
      } catch (e) { /* regelgebaseerde terugval */ }
    }
    o.kritiek = regels.join(' '); o.updatedAt = nu(); save();
    return { ok: true, kritiek: o.kritiek, punten: regels, ontwerp: publiek(o) };
  }

  return { studio: { DISCIPLINES, STATUS, PALET, overzicht, ontwerpMaak, ontwerpZet, ontwerpVerwijder, collectieMaak, aiConcept, aiSpecsheet, aiKritiek } };
}

module.exports = { maakStudio, DISCIPLINES, STATUS };
