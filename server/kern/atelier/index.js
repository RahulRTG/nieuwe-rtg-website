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
   moodboard kan tonen. Volgt het vaste kern-patroon maakAtelier(state). Dit
   is de orkestrator: de data en het sjabloon wonen in ./bank, de AI-acties
   in ./aiwerk. */
const { CATEGORIEEN, STATUS, PALET, maakConcept } = require('./bank');

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
      for (const x of demo) { const o = _maak(x); o.concept = maakConcept(o.categorie, o.brief, o.naam, scho); }
      save();
    }
    return d().atelier;
  }
  const alle = () => store().ontwerpen;
  const vind = oid => alle().find(o => o.id === oid);

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

  // de gedeelde ctx voor de deelbestanden
  const ctx = { anthropic, save, scho, nu, vind, publiek };
  const api = {
    CATEGORIEEN, STATUS, PALET,
    overzicht, ontwerpMaak, ontwerpZet, ontwerpVerwijder, collectieMaak
  };
  Object.assign(api, require('./aiwerk')(ctx));
  return { atelier: api };
}

module.exports = { maakAtelier, CATEGORIEEN, STATUS };
