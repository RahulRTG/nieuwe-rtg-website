/* RTG Atelier: het ontwerpbureau van de RTG-kantoren. Een besloten,
   uiterst exclusief atelier dat mode en alles wat je aan het lijf draagt
   ontwerpt: couture en tailoring, tassen, horloges, schoenen, hoeden,
   haute joaillerie, eyewear en kleinlederwaren. Bedoeld als het huis waar
   de grote maisons hun ateliers zouden willen hebben: elk stuk begint met
   een brief, de AI tekent het concept uit (silhouet, materialen, een
   gedempt "quiet luxury"-palet, details en een verhaal), levert een
   technisch pakket en de blik van een creatief directeur.

   Beeld bouwen we met CSS/SVG uit het palet (geen stockfoto's, geen
   modellen); de kleuren komen als naam + hex mee zodat het scherm een
   moodboard kan tonen. Volgt het vaste kern-patroon maakAtelier(state). */

const CATEGORIEEN = {
  kleding:      { label: 'Couture & tailoring', icon: '🧥' },
  tassen:       { label: 'Maroquinerie', icon: '👜' },
  horloges:     { label: 'Haute horlogerie', icon: '⌚' },
  schoenen:     { label: 'Bottier', icon: '👞' },
  hoeden:       { label: 'Millinery', icon: '🎩' },
  sieraden:     { label: 'Haute joaillerie', icon: '💍' },
  zonnebrillen: { label: 'Eyewear', icon: '🕶️' },
  lederwaren:   { label: 'Kleinlederwaren', icon: '👛' }
};
const STATUS = ['schets', 'ontwikkeling', 'prototype', 'monster', 'productie', 'archief'];

// een gedempt palet (naam -> hex); quiet luxury, geen felle tinten
const PALET = {
  'inkt-navy': '#1E2A38', 'houtskool': '#2B2B2B', 'kameel': '#C19A6B', 'ivoor': '#F2EBDD',
  'mos': '#4A5340', 'bordeaux': '#5E1F2D', 'steengrijs': '#8A867E', 'cognac': '#8B5A2B',
  'antraciet': '#33363B', 'crème': '#E8E0D0', 'oxbloed': '#4A1C24', 'salie': '#9CA88F',
  'nachtblauw': '#141A2A', 'taupe': '#7A6E63', 'goudoker': '#B08D3A', 'porselein': '#EDE7DD'
};
const PALET_NAMEN = Object.keys(PALET);

const BANK = {
  kleding: {
    silhouet: ['strak getailleerd tweedelig', 'gedeconstrueerde overjas', 'vloeiende bias-cut japon', 'oversized atelier-blazer', 'dubbelrijs kolbert met scherpe schouder'],
    materiaal: ['dubbelgetwijnde kasjmier', 'wol-mohair uit Biella', 'matte zijde-duchesse', 'gewassen Belgisch linnen', 'Sea Island-katoen', 'gebrushte alpaca'],
    detail: ['met de hand gerolde zoom', 'onzichtbare pat-sluiting', 'ingezette paspelzakken', 'schouderwerk in canvas opgebouwd', 'passepoil in contrasttoon'],
    afwerking: ['volledig gevoerd in habotai-zijde', 'kraag met de hand ingezet', 'knopen van buffelhoorn']
  },
  tassen: {
    silhouet: ['gestructureerde top-handle', 'zachte hobo met plooival', 'architecturale bucket', 'platte enveloppe-clutch', 'compacte crossbody op maat'],
    materiaal: ['volnerf boxcalf', 'geborsteld nappa', 'saffiano-kalfsleer', 'suède van hertenleer', 'Alligator mississippiensis (gecertificeerd)'],
    detail: ['met de hand gezadelstikte randen', 'verzonken magneetsluiting', 'beslag in geborsteld palladium', 'monogram in blindpreeg', 'draagriem met rolgesp'],
    afwerking: ['randen in acht lagen gelakt', 'voering in suède-alcantara', 'onderkant op metalen studs']
  },
  horloges: {
    silhouet: ['ultradun dresshorloge', 'geïntegreerde sportkast', 'kussenvormige kast', 'skelet met open werk', 'chronograaf met twee tellers'],
    materiaal: ['geborsteld titanium graad 5', '18k Sedna-goud', 'gepolijst platina 950', 'satijngeborsteld staal', 'keramiek in kooktechniek'],
    detail: ['met de hand geguillocheerde wijzerplaat', 'gefacetteerde uurindexen', 'saffierglas met dubbele AR-coating', 'kroon met cabochon', 'transparante bodem'],
    afwerking: ['handmatig gefinishte bruggen met Genève-strepen', 'gebloemde schroefkoppen', 'geschuurde flanken']
  },
  schoenen: {
    silhouet: ['Oxford met gladde neus', 'ongevoerde loafer', 'Chelsea-boot op maat', 'sculpturale pump', 'derby met three-eyelet'],
    materiaal: ['Blake-genaaid boxcalf', 'patina-kalfsleer', 'suède uit Toscane', 'cordovan van de schaduwzijde', 'exotisch python (gecertificeerd)'],
    detail: ['met de hand opgebouwde patina', 'dichte broguering', 'gestikte mocassin-neus', 'bies in contrastkleur', 'ingelegde hielkap'],
    afwerking: ['volleren zool met eikenschors gelooid', 'gebeeldhouwde houten hak', 'ingelegde messing pin']
  },
  hoeden: {
    silhouet: ['brede fedora', 'strakke cloche', 'panama met snap-brim', 'sculpturale cocktailhoed', 'baret in wolvilt'],
    materiaal: ['fur felt van haas', 'Panama Montecristi-vlecht', 'geschoren bever-velours', 'geperst kasjmiervilt'],
    detail: ['grosgrain-lint met de hand gestrikt', 'met stoom gevormde bol', 'gebrande rand', 'binnenband van leer', 'veer met de hand ingezet'],
    afwerking: ['rand met de hand afgebiesd', 'gestempeld gouden logo binnenin']
  },
  sieraden: {
    silhouet: ['rivière-collier', 'cocktailring met hoofdsteen', 'oorsieraad in cascade', 'gearticuleerde armband', 'sautoir met kwast'],
    materiaal: ['18k witgoud', '18k rozégoud', 'zwart geëmailleerd goud', 'platina 950'],
    detail: ['oud-mine geslepen diamant', 'Colombiaanse smaragd', 'Akoya-parels', 'onzichtbare zetting', 'pavé van briljant'],
    afwerking: ['met de hand gezette stenen', 'satijnmat geborsteld goud', 'gegraveerde binnenzijde']
  },
  zonnebrillen: {
    silhouet: ['pantos-rondbril', 'oversized cat-eye', 'strakke pilotenbril', 'hoekige navigator', 'onzichtbare rimless'],
    materiaal: ['acetaat uit Mazzucchelli', 'titanium scharnieren', 'goud-PVD montuur', 'gebüffeld hoorn'],
    detail: ['5-baraaj scharnier', 'mineraalglazen', 'verzonken logo op de tempel', 'zadelbrug', 'gepolariseerde lens'],
    afwerking: ['met de hand gepolijst front', 'tempels met kern van staal']
  },
  lederwaren: {
    silhouet: ['langwerpige portefeuille', 'compacte kaarthouder', 'zip-around etui', 'sleutelhoes', 'reispochette'],
    materiaal: ['volnerf boxcalf', 'saffiano-kalfsleer', 'geborsteld nappa', 'geitensuède'],
    detail: ['met de hand gezadelstikt', 'blindgepreegd monogram', 'verzonken drukknoop', 'binnenvakken in contrastkleur'],
    afwerking: ['randen in lagen gelakt', 'voering in kalfsleer']
  }
};

function maakAtelier({ db, save, crypto, anthropic, schoon }) {
  const scho = schoon || ((v, n) => String(v == null ? '' : v).trim().slice(0, n || 200));
  const id = () => 'atl' + crypto.randomBytes(4).toString('hex');
  const nu = () => new Date().toISOString();
  const d = () => db.data;

  function store() {
    if (!d().atelier || typeof d().atelier !== 'object') d().atelier = { ontwerpen: [], collecties: [] };
    if (!Array.isArray(d().atelier.ontwerpen)) d().atelier.ontwerpen = [];
    if (!Array.isArray(d().atelier.collecties)) d().atelier.collecties = [];
    // een keer een paar signatuurstukken zaaien zodat het atelier nooit leeg oogt
    if (!d().atelier._seed) {
      d().atelier._seed = true;
      const demo = [
        { categorie: 'tassen', naam: 'Bordeaux Top-Handle No.1', brief: 'Een tijdloze top-handle in bordeaux, discreet, voor de avond', huis: 'RTG Atelier' },
        { categorie: 'horloges', naam: 'Nocturne Ultradun', brief: 'Ultradun dresshorloge, nachtblauwe wijzerplaat, quiet luxury', huis: 'RTG Atelier' }
      ];
      for (const x of demo) { const o = _maak(x); o.concept = _concept(o.categorie, o.brief, o.naam); }
      save();
    }
    return d().atelier;
  }
  const alle = () => store().ontwerpen;
  const vind = oid => alle().find(o => o.id === oid);

  function hash(s) { let h = 2166136261; s = String(s); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function kies(arr, seed, n) {
    const out = []; const used = new Set(); const s = (seed >>> 0);
    for (let i = 0; out.length < Math.min(n, arr.length); i++) {
      const idx = (s + i * 2654435761) % arr.length; // s en de stap zijn positief, dus idx is dat ook
      if (!used.has(idx)) { used.add(idx); out.push(arr[idx]); }
    }
    return out;
  }
  function palet(seed, n) { return kies(PALET_NAMEN, seed, n).map(nm => ({ naam: nm, hex: PALET[nm] })); }

  function _concept(categorie, brief, naam) {
    const b = BANK[categorie] || BANK.tassen;
    const seed = hash((categorie || '') + '|' + (naam || '') + '|' + (brief || ''));
    const kleuren = palet(seed, 3);
    const materialen = kies(b.materiaal, seed >>> 2, 2);
    const details = kies(b.detail, seed >>> 4, 3);
    const silhouet = b.silhouet[seed % b.silhouet.length];
    const afwerking = b.afwerking[(seed >>> 6) % b.afwerking.length];
    const insp = scho(brief, 120) || 'de stilte van luxe';
    const verhaal = 'Een ' + silhouet + ' in ' + materialen[0] + ', gedragen door ' + kleuren[0].naam +
      ' en ' + kleuren[1].naam + '. Geboren uit "' + insp + '": ingetogen, zeker van zichzelf, zonder een enkel overbodig gebaar. ' +
      'Het is een stuk dat fluistert in plaats van roept, en juist daardoor blijft hangen.';
    return { silhouet, materialen, kleuren, details, afwerking, verhaal };
  }

  function publiek(o) {
    return {
      id: o.id, categorie: o.categorie, categorieLabel: (CATEGORIEEN[o.categorie] || {}).label || o.categorie,
      icon: (CATEGORIEEN[o.categorie] || {}).icon || '✎',
      naam: o.naam, brief: o.brief, huis: o.huis || null, collectie: o.collectie || null,
      status: o.status, concept: o.concept || null, techpack: o.techpack || null,
      kritiek: o.kritiek || null, at: o.at, updatedAt: o.updatedAt || o.at, door: o.door || null
    };
  }

  function _maak(data) {
    const categorie = CATEGORIEEN[data.categorie] ? data.categorie : 'tassen';
    const o = {
      id: id(), categorie, naam: scho(data.naam, 100) || 'Naamloos ontwerp',
      brief: scho(data.brief, 600), huis: scho(data.huis, 80) || null,
      collectie: scho(data.collectie, 80) || null,
      concept: null, techpack: null, kritiek: null,
      status: 'schets', at: nu(), updatedAt: nu(), door: scho(data.door, 60) || null
    };
    alle().unshift(o);
    if (alle().length > 5000) alle().length = 5000;
    return o;
  }

  function overzicht() {
    const on = alle();
    const perStatus = {}; for (const s of STATUS) perStatus[s] = 0;
    const perCategorie = {};
    for (const o of on) { perStatus[o.status] = (perStatus[o.status] || 0) + 1; perCategorie[o.categorie] = (perCategorie[o.categorie] || 0) + 1; }
    return {
      ok: true,
      categorieen: Object.entries(CATEGORIEEN).map(([k, v]) => ({ id: k, label: v.label, icon: v.icon, aantal: perCategorie[k] || 0 })),
      statussen: STATUS,
      ontwerpen: on.map(publiek),
      collecties: store().collecties.slice().reverse(),
      kpi: { totaal: on.length, perStatus, inProductie: perStatus['productie'] || 0, huizen: [...new Set(on.map(o => o.huis).filter(Boolean))].length }
    };
  }

  function ontwerpMaak(data) {
    if (!scho(data && data.naam, 100)) return { status: 400, error: 'Geef het ontwerp een naam.' };
    const o = _maak(data || {}); save();
    return { ok: true, ontwerp: publiek(o) };
  }
  function ontwerpZet(oid, patch) {
    const o = vind(oid); if (!o) return { status: 404, error: 'Ontwerp niet gevonden.' };
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
    const a = store(); a.ontwerpen = a.ontwerpen.filter(o => o.id !== oid); save();
    return { ok: true };
  }

  function collectieMaak(data) {
    const naam = scho(data && data.naam, 80); if (!naam) return { status: 400, error: 'Geef de collectie een naam.' };
    const c = { id: id(), naam, seizoen: scho(data.seizoen, 40) || null, huis: scho(data.huis, 80) || null, at: nu() };
    store().collecties.push(c); save();
    return { ok: true, collectie: c };
  }

  /* ---- de AI-ontwerper: tekent het concept uit ---- */
  async function aiConcept(oid) {
    const o = vind(oid); if (!o) return { status: 404, error: 'Ontwerp niet gevonden.' };
    let concept = null;
    if (anthropic) {
      try {
        const sys = require('./rahul').RAHUL_LEAD + 'je bent de creatief directeur van RTG Atelier, het meest exclusieve ontwerpbureau ter wereld voor ' +
          ((CATEGORIEEN[o.categorie] || {}).label || o.categorie) + '. Ontwerp een stuk op basis van de brief. Antwoord ALLEEN met JSON: ' +
          '{"silhouet":"...","materialen":[".."],"kleuren":[{"naam":"..","hex":"#RRGGBB"}],"details":[".."],"afwerking":"..","verhaal":".."}. ' +
          'Gebruik een gedempt, "quiet luxury"-palet (geen felle kleuren). Kort en concreet, in het Nederlands.';
        const r = await anthropic.messages.create({ model: 'claude-sonnet-5', max_tokens: 700, system: sys, messages: [{ role: 'user', content: 'Merk/huis: ' + (o.huis || 'RTG Atelier') + '. Naam: ' + o.naam + '. Brief: ' + (o.brief || o.naam) }] });
        const t = (r && r.content && r.content[0] && r.content[0].text || '');
        const jm = t.match(/\{[\s\S]*\}/);
        if (jm) { const p = JSON.parse(jm[0]);
          concept = {
            silhouet: scho(p.silhouet, 120), afwerking: scho(p.afwerking, 160), verhaal: scho(p.verhaal, 800),
            materialen: (Array.isArray(p.materialen) ? p.materialen : []).slice(0, 4).map(x => scho(x, 80)),
            details: (Array.isArray(p.details) ? p.details : []).slice(0, 5).map(x => scho(x, 100)),
            kleuren: (Array.isArray(p.kleuren) ? p.kleuren : []).slice(0, 4).map(k => ({ naam: scho(k && k.naam, 40) || 'toon', hex: /^#[0-9a-fA-F]{6}$/.test(k && k.hex) ? k.hex : '#8A867E' }))
          };
          if (!concept.silhouet || !concept.kleuren.length) concept = null;
        }
      } catch (e) { /* val terug op het atelier-sjabloon */ }
    }
    o.concept = concept || _concept(o.categorie, o.brief, o.naam);
    o.updatedAt = nu(); save();
    return { ok: true, ontwerp: publiek(o) };
  }

  /* ---- het technisch pakket (tech pack) ---- */
  const ONDERDELEN = {
    kleding: ['Buitenstof', 'Voering', 'Kraag & revers', 'Knopen', 'Naadafwerking'],
    tassen: ['Body', 'Voering', 'Handvat/riem', 'Sluiting', 'Beslag'],
    horloges: ['Kast', 'Wijzerplaat', 'Uurwerk', 'Band', 'Kroon & glas'],
    schoenen: ['Bovenwerk', 'Voering', 'Zool', 'Hiel', 'Sluiting'],
    hoeden: ['Bol', 'Rand', 'Binnenband', 'Lint', 'Afwerking'],
    sieraden: ['Montuur', 'Hoofdsteen', 'Zetting', 'Sluiting', 'Gravure'],
    zonnebrillen: ['Front', 'Lenzen', 'Tempels', 'Scharnieren', 'Neusbrug'],
    lederwaren: ['Body', 'Voering', 'Vakindeling', 'Sluiting', 'Preeg']
  };
  function aiTechpack(oid) {
    const o = vind(oid); if (!o) return { status: 404, error: 'Ontwerp niet gevonden.' };
    const con = o.concept || _concept(o.categorie, o.brief, o.naam);
    const mats = con.materialen.length ? con.materialen : ['boxcalf'];
    const namen = ONDERDELEN[o.categorie] || ONDERDELEN.tassen;
    const seed = hash(o.id);
    const onderdelen = namen.map((naam, i) => ({
      naam, materiaal: mats[i % mats.length],
      spec: con.details[i % Math.max(1, con.details.length)] || 'volgens atelier-standaard'
    }));
    o.techpack = {
      onderdelen,
      constructie: (CATEGORIEEN[o.categorie] || {}).label + ', met de hand opgebouwd; ' + con.afwerking,
      maten: o.categorie === 'horloges' ? 'kastdiameter 38-40 mm, dikte < 9 mm' : (o.categorie === 'kleding' ? 'volledige maatstaat 34-46 (EU)' : 'atelier-standaardmaat, op maat mogelijk'),
      kleurwegen: con.kleuren.map(k => k.naam),
      controle: ['materiaalkeuring bij ontvangst', 'tussentijdse pasvorm/monsterkeur', 'eindcontrole met de hand'],
      opmerking: 'Prototype eerst; monster ter goedkeuring van de creatief directeur voor productievrijgave.'
    };
    o.updatedAt = nu(); save();
    return { ok: true, ontwerp: publiek(o) };
  }

  /* ---- de blik van de creatief directeur ---- */
  async function aiKritiek(oid, vraag) {
    const o = vind(oid); if (!o) return { status: 404, error: 'Ontwerp niet gevonden.' };
    const con = o.concept || _concept(o.categorie, o.brief, o.naam);
    const regels = [
      'Signatuur: het ' + con.silhouet + ' is herkenbaar; houd één signatuurelement en snijd de rest weg.',
      'Materiaal: ' + con.materialen.join(' en ') + ' dragen het stuk; overweeg één contrast in ' + (con.kleuren[2] || con.kleuren[0]).naam + ' voor spanning.',
      'Commercieel: dit spreekt de couture-klant aan; een ingetogen variant verbreedt de collectie zonder het huis te verwateren.',
      'Afwerking: ' + con.afwerking + ' is het verschil met confectie; laat het zien in de fotografie.'
    ];
    const v = String(vraag || '').replace(/[<>]/g, '').trim().slice(0, 300);
    if (anthropic) {
      try {
        const sys = require('./rahul').RAHUL_LEAD + 'je bent de creatief directeur van RTG Atelier. Geef een korte, scherpe maar respectvolle kritiek op het ontwerp: signatuur, materiaal, commerciële haak en afwerking. In het Nederlands. Situatie: ' +
          o.naam + ' (' + ((CATEGORIEEN[o.categorie] || {}).label) + '), ' + con.silhouet + ', ' + con.materialen.join('/') + ', tinten ' + con.kleuren.map(k => k.naam).join('/') + '.';
        const r = await anthropic.messages.create({ model: 'claude-sonnet-5', max_tokens: 450, system: sys, messages: [{ role: 'user', content: v || 'Geef je kritiek en één concreet verbeterpunt.' }] });
        const t = (r && r.content && r.content[0] && r.content[0].text || '').trim();
        if (t) { o.kritiek = t; o.updatedAt = nu(); save(); return { ok: true, kritiek: t, ontwerp: publiek(o) }; }
      } catch (e) { /* regelgebaseerde terugval */ }
    }
    o.kritiek = regels.join(' '); o.updatedAt = nu(); save();
    return { ok: true, kritiek: o.kritiek, punten: regels, ontwerp: publiek(o) };
  }

  return { atelier: { CATEGORIEEN, STATUS, PALET, overzicht, ontwerpMaak, ontwerpZet, ontwerpVerwijder, collectieMaak, aiConcept, aiTechpack, aiKritiek } };
}

module.exports = { maakAtelier, CATEGORIEEN, STATUS };
