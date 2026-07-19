/* RTG Architectenbureau: het huizen-ontwerpbureau van de RTG-kantoren, de
   vierde ontwerptak naast Atelier (draagbaar), Ontwerpstudio (voertuigen) en
   Hardwarelab (apparaten). Hier ontwerpen we het gebouwde: villa's,
   penthouses, landgoederen, chalets en paviljoens. Elk concept begint met een
   brief; de AI tekent het uit (typologie, constructie, materialen, een gedempt
   palet, voorzieningen en een verhaal), levert een bouwstaat en de blik van de
   chef-architect, en per project een portfolio.

   Geen echte merken of bestaande gebouwen als bevestigde partners; dit is een
   concept- en ontwerpbureau met RTG-huisnamen. Beeld bouwen we met
   CSS-swatches uit het palet. Volgt het vaste kern-patroon maakArchitect(state).
   Dit is de orkestrator: de data en het sjabloon wonen in ./bank, de AI-acties
   in ./aiwerk. */
const { DISCIPLINES, STATUS, PALET, maakConcept } = require('./bank');

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
      for (const x of demo) { const o = _maak(x); o.concept = maakConcept(o.discipline, o.brief, o.naam, scho); }
      save();
    }
    return d().architect;
  }
  const alle = () => store().ontwerpen;
  const vind = oid => alle().find(o => o.id === oid);

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

  // de gedeelde ctx voor de deelbestanden
  const ctx = { anthropic, save, scho, nu, vind, publiek };
  const api = {
    DISCIPLINES, STATUS, PALET,
    overzicht, ontwerpMaak, ontwerpZet, ontwerpVerwijder, collectieMaak, portfolio
  };
  Object.assign(api, require('./aiwerk')(ctx));
  return { architect: api };
}

module.exports = { maakArchitect, DISCIPLINES, STATUS };
