/* RTG Werkplaats: het app- en productbureau van de RTG-kantoren. Twee sporen:
   - een NIEUWE app bedenken: geef een brief, de AI werkt een app-concept uit
     (doel, doelgroep, schermen, functies, huisstijl, eerste stappen);
   - een BESTAAND onderdeel VERBETEREN: kies een doel (een huidige app, materiaal
     uit de Bibliotheek, of een groep in de App Store) en een wens, de AI geeft
     een analyse met concrete verbeteringen, nieuwe functies en risico's.

   Alles is advies: de AI stelt voor, een mens beslist en bouwt (klein en
   omkeerbaar). Het AI-deel (uitwerken en kritiek, met sjabloon-terugval zonder
   sleutel) staat in ./werkplaats-ai.js; dit deel is de basis en de uitgifte.
   Volgt het vaste kern-patroon van de ontwerpbureaus: maak/zet/verwijder +
   AI-acties. */
const { maakWerkplaatsAI } = require('./werkplaats-ai');

function maakWerkplaats({ db, save, crypto, anthropic, schoon }) {
  const scho = schoon || ((v, n) => String(v == null ? '' : v).trim().slice(0, n || 200));
  const id = () => 'wp' + crypto.randomBytes(4).toString('hex');
  const nu = () => new Date().toISOString();
  const d = () => db.data;
  const STATUS = ['idee', 'uitgewerkt', 'in-bouw', 'klaar'];
  const SOORTEN = { nieuw: 'Nieuwe app', verbeter: 'Verbeteren' };
  const DOELSOORT = { app: 'Bestaande app', bieb: 'Bibliotheek', winkel: 'App Store' };
  const lead = () => { try { return require('./rahul').RAHUL_LEAD; } catch (e) { return ''; } };
  const lijst = (a, n, m) => (Array.isArray(a) ? a : []).slice(0, m || 6).map(x => scho(x, n || 140)).filter(Boolean);

  function store() {
    if (!d().werkplaats || typeof d().werkplaats !== 'object') d().werkplaats = { items: [] };
    if (!Array.isArray(d().werkplaats.items)) d().werkplaats.items = [];
    if (!d().werkplaats._seed) {
      d().werkplaats._seed = true;
      _maak({ soort: 'nieuw', naam: 'RTG Reisdagboek', brief: 'Een rustige app die je reis vanzelf tot een mooi dagboek maakt uit je boekingen en uitgelichte Salon-posts.' });
      _maak({ soort: 'verbeter', doelSoort: 'app', doel: 'RTG Pay', naam: 'Pay: sneller tikken', brief: 'Betalen met een tik nog sneller en duidelijker maken.' });
      save();
    }
    return d().werkplaats;
  }
  const alle = () => store().items;
  const vind = i => alle().find(x => x.id === i);

  function publiek(o) {
    return {
      id: o.id, soort: o.soort, soortLabel: SOORTEN[o.soort] || o.soort,
      doelSoort: o.doelSoort || null, doelSoortLabel: o.doelSoort ? DOELSOORT[o.doelSoort] : null,
      doel: o.doel || null, naam: o.naam, brief: o.brief, status: o.status,
      plan: o.plan || null, kritiek: o.kritiek || null, uitgifte: o.uitgifte || null,
      at: o.at, updatedAt: o.updatedAt || o.at, door: o.door || null
    };
  }

  function _maak(data) {
    const soort = SOORTEN[data.soort] ? data.soort : 'nieuw';
    const doelSoort = (soort === 'verbeter' && DOELSOORT[data.doelSoort]) ? data.doelSoort : null;
    const o = {
      id: id(), soort, doelSoort, doel: doelSoort ? scho(data.doel, 120) : null,
      naam: scho(data.naam, 120) || 'Naamloze opdracht', brief: scho(data.brief, 900),
      status: 'idee', plan: null, kritiek: null, at: nu(), updatedAt: nu(), door: scho(data.door, 60) || null
    };
    alle().unshift(o); if (alle().length > 4000) alle().length = 4000;
    return o;
  }

  function overzicht() {
    const it = alle(); const perStatus = {}; STATUS.forEach(s => perStatus[s] = 0);
    it.forEach(o => perStatus[o.status] = (perStatus[o.status] || 0) + 1);
    return {
      ok: true, soorten: SOORTEN, doelsoorten: DOELSOORT, statussen: STATUS, items: it.map(publiek),
      kpi: { totaal: it.length, nieuw: it.filter(o => o.soort === 'nieuw').length, verbeter: it.filter(o => o.soort === 'verbeter').length, klaar: perStatus['klaar'] || 0 }
    };
  }
  function maak(data) {
    if (!scho(data && data.naam, 120)) return { status: 400, error: 'Geef de opdracht een naam.' };
    const o = _maak(data || {}); save(); return { ok: true, item: publiek(o) };
  }
  function zet(i, patch) {
    const o = vind(i); if (!o) return { status: 404, error: 'Opdracht niet gevonden.' };
    patch = patch || {};
    if (patch.naam != null) o.naam = scho(patch.naam, 120) || o.naam;
    if (patch.brief != null) o.brief = scho(patch.brief, 900);
    if (patch.doel != null) o.doel = scho(patch.doel, 120) || null;
    if (patch.status != null && STATUS.includes(patch.status)) o.status = patch.status;
    o.updatedAt = nu(); save(); return { ok: true, item: publiek(o) };
  }
  function verwijder(i) { const s = store(); s.items = s.items.filter(x => x.id !== i); save(); return { ok: true }; }

  /* ---- rechtstreeks uitgeven: de opdracht wordt een echt onderdeel ----
     De Werkplaats blijft adviseren, maar kan het resultaat nu ook DIRECT in de
     winkel zetten. De overlay leeft in db.data.appbiebExtra; de App-Bibliotheek
     (kern/appbieb.js) leest en toont die overal in de Mall. Alles omkeerbaar:
     "intrekken" haalt het onderdeel er weer uit. De plank ('winkel' = App Store,
     'bieb' = Bibliotheek) volgt uit het doel van de opdracht. */
  function biebStore() {
    if (!Array.isArray(d().appbiebExtra)) d().appbiebExtra = [];
    return d().appbiebExtra;
  }
  function _uitgifteItem(o, ref) {
    const plank = o.doelSoort === 'bieb' ? 'bieb' : 'winkel';
    const uitleg = (o.soort === 'nieuw'
      ? (o.plan && o.plan.doel) || o.brief
      : (o.plan && o.plan.analyse) || o.brief) || o.naam;
    return {
      id: ref, naam: scho(o.naam, 120) || 'RTG Werkplaats-app',
      plank, uitleg: scho(uitleg, 260),
      icon: 'ster', sterren: 4.6, versie: '1.0', grootteMB: 60,
      winkelwaardeCenten: 0, bron: 'werkplaats', werkplaatsId: o.id, at: nu()
    };
  }
  function publiceer(i) {
    const o = vind(i); if (!o) return { status: 404, error: 'Opdracht niet gevonden.' };
    if (!o.plan) return { status: 400, error: 'Werk de opdracht eerst uit voordat je hem publiceert.' };
    const store = biebStore();
    const ref = (o.uitgifte && o.uitgifte.ref) || ('wx-' + crypto.randomBytes(5).toString('hex'));
    const item = _uitgifteItem(o, ref);
    const ix = store.findIndex(x => x && x.id === ref);
    if (ix >= 0) store[ix] = item; else { store.unshift(item); if (store.length > 2000) store.length = 2000; }
    o.uitgifte = { ref, plank: item.plank, plankLabel: item.plank === 'bieb' ? 'Bibliotheek' : 'App Store', at: nu() };
    o.status = 'klaar'; o.updatedAt = nu(); save();
    return { ok: true, item: publiek(o) };
  }
  function introk(i) {
    const o = vind(i); if (!o) return { status: 404, error: 'Opdracht niet gevonden.' };
    if (o.uitgifte && o.uitgifte.ref) {
      const store = biebStore(); const ix = store.findIndex(x => x && x.id === o.uitgifte.ref);
      if (ix >= 0) store.splice(ix, 1);
    }
    o.uitgifte = null; if (o.status === 'klaar') o.status = 'uitgewerkt'; o.updatedAt = nu(); save();
    return { ok: true, item: publiek(o) };
  }

  const ai = maakWerkplaatsAI({ vind, publiek, scho, lijst, lead, nu, save, anthropic, DOELSOORT });

  return { werkplaats: { STATUS, SOORTEN, DOELSOORT, overzicht, maak, zet, verwijder, aiUitwerken: ai.aiUitwerken, aiKritiek: ai.aiKritiek, publiceer, introk } };
}

module.exports = { maakWerkplaats };
