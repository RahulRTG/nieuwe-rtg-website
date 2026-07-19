/* RTG Architectenbureau: het huizen-ontwerpbureau van de RTG-kantoren, de
   vierde ontwerptak naast Atelier (draagbaar), Ontwerpstudio (voertuigen) en
   Hardwarelab (apparaten). Hier ontwerpen we het gebouwde: villa's,
   penthouses, landgoederen, chalets en paviljoens. Elk concept begint met een
   brief; de AI tekent het uit (typologie, constructie, materialen, een gedempt
   palet, voorzieningen en een verhaal), levert een bouwstaat en de blik van de
   chef-architect, en per project een portfolio.

   Geen echte merken of bestaande gebouwen als bevestigde partners; dit is een
   concept- en ontwerpbureau met RTG-huisnamen. Beeld bouwen we met
   CSS-swatches uit het palet. Volgt het vaste kern-patroon maakArchitect(state). */

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

function maakArchitect({ db, save, crypto, anthropic, schoon }) {
  const scho = schoon || ((v, n) => String(v == null ? '' : v).trim().slice(0, n || 200));
  const id = () => 'arc' + crypto.randomBytes(4).toString('hex');
  const nu = () => new Date().toISOString();
  const d = () => db.data;

  function store() {
    if (!d().architect || typeof d().architect !== 'object') d().architect = { ontwerpen: [], collecties: [] };
    if (!Array.isArray(d().architect.ontwerpen)) d().architect.ontwerpen = [];
    if (!Array.isArray(d().architect.collecties)) d().architect.collecties = [];
    if (!d().architect._seed) {
      d().architect._seed = true;
      const demo = [
        { discipline: 'villa', naam: 'Villa Meridiaan', brief: 'Moderne villa aan zee, veel licht, zwevend dakvlak, wellness en zwembad' },
        { discipline: 'chalet', naam: 'Chalet Aurelia', brief: 'Warm alpenchalet, ski-in ski-out, buitenbad, oud eiken en natuursteen' }
      ];
      for (const x of demo) { const o = _maak(x); o.concept = _concept(o.discipline, o.brief, o.naam); }
      save();
    }
    return d().architect;
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

  function publiek(o) {
    return {
      id: o.id, discipline: o.discipline, disciplineLabel: (DISCIPLINES[o.discipline] || {}).label || o.discipline,
      icon: (DISCIPLINES[o.discipline] || {}).icon || '🏛️',
      naam: o.naam, brief: o.brief, huis: o.huis || null, collectie: o.collectie || null,
      status: o.status, concept: o.concept || null, bouwstaat: o.bouwstaat || null,
      kritiek: o.kritiek || null, at: o.at, updatedAt: o.updatedAt || o.at, door: o.door || null
    };
  }

  function _maak(data) {
    const discipline = DISCIPLINES[data.discipline] ? data.discipline : 'villa';
    const o = {
      id: id(), discipline, naam: scho(data.naam, 100) || 'Naamloos concept',
      brief: scho(data.brief, 600), huis: scho(data.huis, 80) || null, collectie: scho(data.collectie, 80) || null,
      concept: null, bouwstaat: null, kritiek: null,
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
      kpi: { totaal: on.length, perStatus, inRealisatie: perStatus['realisatie'] || 0, huizen: [...new Set(on.map(o => o.huis).filter(Boolean))].length }
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
    const naam = scho(data && data.naam, 80); if (!naam) return { status: 400, error: 'Geef het project een naam.' };
    const c = { id: id(), naam, seizoen: scho(data.seizoen, 40) || null, huis: scho(data.huis, 80) || null, at: nu() };
    store().collecties.push(c); save();
    return { ok: true, collectie: c };
  }

  /* Het portfolio per project: alle concepten die aan dit project zijn
     toegewezen (op naam), met hun uitgewerkte concept, klaar om als
     presentatie te tonen, te printen of als PDF te bewaren. */
  function portfolio(naam) {
    const sleutel = scho(naam, 80);
    if (!sleutel) return { status: 400, error: 'Kies een project.' };
    const col = store().collecties.find(c => c.naam === sleutel) || null;
    const items = alle().filter(o => o.collectie === sleutel);
    if (!col && !items.length) return { status: 404, error: 'Geen project met concepten gevonden.' };
    const disciplines = [...new Set(items.map(o => o.discipline))]
      .map(k => (DISCIPLINES[k] || {}).label || k);
    return {
      ok: true,
      project: col || { naam: sleutel, seizoen: null, huis: null },
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
        const sys = require('./rahul').RAHUL_LEAD + 'je bent de chef-architect van RTG Architectenbureau, het meest exclusieve architectenbureau ter wereld voor ' +
          ((DISCIPLINES[o.discipline] || {}).label || o.discipline) + '. Ontwerp een concept op basis van de brief. Antwoord ALLEEN met JSON: ' +
          '{"typologie":"..","constructie":"..","materialen":[".."],"kleuren":[{"naam":"..","hex":"#RRGGBB"}],"voorzieningen":[".."],"verhaal":".."}. ' +
          'Gedempt, natuurlijk "quiet luxury"-palet, geen felle kleuren. Geen echte merknamen of bestaande gebouwen. Kort en concreet, in het Nederlands.';
        const r = await anthropic.messages.create({ model: 'claude-sonnet-5', max_tokens: 700, system: sys, messages: [{ role: 'user', content: 'Huis: ' + (o.huis || 'RTG Architectenbureau') + '. Naam: ' + o.naam + '. Brief: ' + (o.brief || o.naam) }] });
        const t = (r && r.content && r.content[0] && r.content[0].text || '');
        const jm = t.match(/\{[\s\S]*\}/);
        if (jm) { const p = JSON.parse(jm[0]);
          concept = {
            typologie: scho(p.typologie, 120), constructie: scho(p.constructie, 120), verhaal: scho(p.verhaal, 800),
            materialen: (Array.isArray(p.materialen) ? p.materialen : []).slice(0, 4).map(x => scho(x, 80)),
            voorzieningen: (Array.isArray(p.voorzieningen) ? p.voorzieningen : []).slice(0, 5).map(x => scho(x, 100)),
            kleuren: (Array.isArray(p.kleuren) ? p.kleuren : []).slice(0, 4).map(k => ({ naam: scho(k && k.naam, 40) || 'toon', hex: /^#[0-9a-fA-F]{6}$/.test(k && k.hex) ? k.hex : '#9A9791' }))
          };
          if (!concept.typologie || !concept.kleuren.length) concept = null;
        }
      } catch (e) { /* val terug op het bureau-sjabloon */ }
    }
    o.concept = concept || _concept(o.discipline, o.brief, o.naam);
    o.updatedAt = nu(); save();
    return { ok: true, ontwerp: publiek(o) };
  }

  function aiBouwstaat(oid) {
    const o = vind(oid); if (!o) return { status: 404, error: 'Concept niet gevonden.' };
    const b = BANK[o.discipline] || BANK.villa;
    const con = o.concept || _concept(o.discipline, o.brief, o.naam);
    const mats = con.materialen.length ? con.materialen : ['zichtbeton'];
    const delen = b.delen.map((naam, i) => ({
      naam, spec: (i === 0 ? con.constructie : (con.voorzieningen[i % Math.max(1, con.voorzieningen.length)] || 'volgens bureau-standaard'))
    }));
    o.bouwstaat = {
      delen,
      oppervlak: b.oppervlak,
      kavel: b.kavel,
      materiaalpakket: mats,
      kleurwegen: con.kleuren.map(k => k.naam),
      controle: ['ontwerpreview met de chef-architect', 'maquette ter goedkeuring', 'definitief ontwerp met vergunningcheck voor vrijgave'],
      opmerking: 'Conceptcijfers voor het bureau; vergunningen, constructieberekening en oplevering lopen buiten dit ontwerpspoor.'
    };
    o.updatedAt = nu(); save();
    return { ok: true, ontwerp: publiek(o) };
  }

  async function aiKritiek(oid, vraag) {
    const o = vind(oid); if (!o) return { status: 404, error: 'Concept niet gevonden.' };
    const con = o.concept || _concept(o.discipline, o.brief, o.naam);
    const regels = [
      'Typologie: het ' + con.typologie + ' is herkenbaar; houd een zuivere lijn en snijd overbodige volumes weg.',
      'Constructie: ' + con.constructie + ' past bij de positionering; laat de ruimte en het daglicht het verhaal dragen.',
      'Materiaal: ' + con.materialen.join(' en ') + ' geven gewicht; zet een enkel contrast in ' + (con.kleuren[2] || con.kleuren[0]).naam + ' voor spanning.',
      'Beleving: ' + (con.voorzieningen[0] || 'de voorziening') + ' is het verschil met de rest; maak dat voelbaar bij binnenkomst.'
    ];
    const v = String(vraag || '').replace(/[<>]/g, '').trim().slice(0, 300);
    if (anthropic) {
      try {
        const sys = require('./rahul').RAHUL_LEAD + 'je bent de chef-architect van RTG Architectenbureau. Geef een korte, scherpe maar respectvolle kritiek: typologie, constructie, materiaal en de beleving van de ruimte. In het Nederlands. Situatie: ' +
          o.naam + ' (' + ((DISCIPLINES[o.discipline] || {}).label) + '), ' + con.typologie + ', ' + con.constructie + ', tinten ' + con.kleuren.map(k => k.naam).join('/') + '.';
        const r = await anthropic.messages.create({ model: 'claude-sonnet-5', max_tokens: 450, system: sys, messages: [{ role: 'user', content: v || 'Geef je kritiek en een concreet verbeterpunt.' }] });
        const t = (r && r.content && r.content[0] && r.content[0].text || '').trim();
        if (t) { o.kritiek = t; o.updatedAt = nu(); save(); return { ok: true, kritiek: t, ontwerp: publiek(o) }; }
      } catch (e) { /* regelgebaseerde terugval */ }
    }
    o.kritiek = regels.join(' '); o.updatedAt = nu(); save();
    return { ok: true, kritiek: o.kritiek, punten: regels, ontwerp: publiek(o) };
  }

  return { architect: { DISCIPLINES, STATUS, PALET, overzicht, ontwerpMaak, ontwerpZet, ontwerpVerwijder, collectieMaak, portfolio, aiConcept, aiBouwstaat, aiKritiek } };
}

module.exports = { maakArchitect, DISCIPLINES, STATUS };
