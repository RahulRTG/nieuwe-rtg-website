/* De Residence: het virtuele grandhotel van RTG -- een sociale wereld in
   huisstijl waar leden als elegante pionnen door de zalen lopen, bij elkaar
   gaan zitten en praten, en een eigen suite inrichten met RTG Maison-meubels.
   Alles op codenaam (nooit echte namen), live via het bestaande per-lid
   SSE-kanaal (sseToCustomer, event 'residentie'), naar het Samen-patroon:
   toestand in db.data + save, seintjes naar de kamerleden. Rustig van aard:
   geen scores, geen streaks, geen koop-lussen -- de catalogus is inbegrepen.
   Volgt het vaste kern-patroon maakResidentie(state). */
const { MEUBELS, ZALEN, SUITE } = require('./zalen');
const TTL = 90000; // wie 90s niets laat horen, is de kamer uit

function maakResidentie({ db, save, schoon, sseToCustomer }) {
  const R = () => {
    if (!db.data.residentie || typeof db.data.residentie !== 'object') db.data.residentie = { kamers: {}, suites: {}, wie: {} };
    if (!db.data.residentie.wie) db.data.residentie.wie = {};
    return db.data.residentie;
  };
  const kamer = id => (R().kamers[id] = R().kamers[id] || { leden: {}, chat: [] });

  function suiteVan(key, codenaam) {
    const s = R().suites[key] = R().suites[key] || { codenaam, naam: 'Suite ' + codenaam, open: true, meubels: [] };
    s.codenaam = codenaam || s.codenaam;
    if (s.codenaam) R().wie[s.codenaam] = key; // eigen index: suite-adres -> sleutel
    return s;
  }
  // kamer-id -> de plattegrond (zaal of suite); suites heten 'suite:<codenaam>'
  function plattegrond(id) {
    if (ZALEN[id]) return { ...ZALEN[id], id, soort: 'zaal' };
    if (id.startsWith('suite:')) {
      const eigenaarKey = R().wie[id.slice(6)];
      const s = eigenaarKey && R().suites[eigenaarKey];
      if (!s) return null;
      return { id, soort: 'suite', naam: s.naam, sub: 'de suite van ' + s.codenaam, b: SUITE.b, d: SUITE.d,
        spawn: SUITE.spawn, meubels: s.meubels.map(m => [m.soort, m.x, m.y]), open: s.open, eigenaarKey };
    }
    return null;
  }
  const geblokkeerd = (p, x, y) => (p.meubels || []).some(([soort, mx, my]) => {
    const M = MEUBELS[soort];
    return M && !M.vlak && x >= mx && x < mx + M.b && y >= my && y < my + M.d;
  });
  const zitplek = (p, x, y) => (p.meubels || []).some(([soort, mx, my]) => {
    const M = MEUBELS[soort];
    return M && M.zit && x >= mx && x < mx + M.b && y >= my && y < my + M.d;
  });

  function ruimOp(id) {
    const k = kamer(id), nu = Date.now();
    for (const key of Object.keys(k.leden)) if (nu - (k.leden[key].at || 0) > TTL) {
      const weg = k.leden[key]; delete k.leden[key];
      sein(id, 'weg', { codenaam: weg.codenaam });
    }
  }
  function sein(id, kind, data, behalveKey) {
    const k = kamer(id);
    for (const key of Object.keys(k.leden)) if (key !== behalveKey) {
      try { sseToCustomer(key, 'residentie', Object.assign({ kind, kamer: id }, data)); } catch (e) {}
    }
  }
  const kamerVan = key => Object.keys(R().kamers).find(id => R().kamers[id].leden[key]) || null;
  const pub = l => ({ codenaam: l.codenaam, x: l.x, y: l.y, dx: l.dx, dy: l.dy, zit: !!l.zit });
  function staat(id, p) {
    ruimOp(id);
    const k = kamer(id);
    return { ok: true, kamer: { id, soort: p.soort, naam: p.naam, sub: p.sub || null, b: p.b, d: p.d,
      meubels: p.meubels || [], eigen: false }, leden: Object.values(k.leden).map(pub), chat: k.chat.slice(-30) };
  }

  function betreed(key, codenaam, id) {
    id = String(id || 'lobby').slice(0, 60);
    const p = plattegrond(id);
    if (!p) return { status: 404, error: 'Deze kamer bestaat niet.' };
    if (p.soort === 'suite' && !p.open && p.eigenaarKey !== key)
      return { status: 403, error: 'Deze suite is op dit moment gesloten.' };
    const vorige = kamerVan(key);
    if (vorige && vorige !== id) { const weg = kamer(vorige).leden[key]; delete kamer(vorige).leden[key]; if (weg) sein(vorige, 'weg', { codenaam: weg.codenaam }); }
    ruimOp(id);
    const k = kamer(id);
    if (!k.leden[key] && Object.keys(k.leden).length >= 40) return { status: 409, error: 'Deze zaal is vol (40 gasten); probeer een andere.' };
    k.leden[key] = k.leden[key] || { codenaam, x: p.spawn[0], y: p.spawn[1], dx: p.spawn[0], dy: p.spawn[1], zit: false, at: Date.now() };
    k.leden[key].codenaam = codenaam; k.leden[key].at = Date.now();
    save();
    sein(id, 'kom', pub(k.leden[key]), key);
    const uit = staat(id, p);
    uit.ik = codenaam;
    uit.kamer.eigen = p.soort === 'suite' && p.eigenaarKey === key;
    return uit;
  }

  function stap(key, body) {
    const id = kamerVan(key);
    if (!id) return { status: 409, error: 'U bent nog geen kamer binnen.' };
    const p = plattegrond(id);
    const l = kamer(id).leden[key];
    const x = Math.round(Number((body || {}).x)), y = Math.round(Number((body || {}).y));
    if (!(x >= 0 && x < p.b && y >= 0 && y < p.d)) return { status: 400, error: 'Die plek ligt buiten de zaal.' };
    const zit = zitplek(p, x, y);
    if (geblokkeerd(p, x, y) && !zit) return { status: 409, error: 'Daar staat iets in de weg.' };
    l.x = l.dx; l.y = l.dy; l.dx = x; l.dy = y; l.zit = zit; l.at = Date.now();
    save();
    sein(id, 'stap', { codenaam: l.codenaam, x: l.x, y: l.y, dx: x, dy: y, zit }, key);
    return { status: 200, ok: true, zit };
  }

  function zeg(key, body) {
    const id = kamerVan(key);
    if (!id) return { status: 409, error: 'U bent nog geen kamer binnen.' };
    const l = kamer(id).leden[key];
    const tekst = schoon((body || {}).tekst, 140);
    if (!tekst) return { status: 400, error: 'Zeg iets.' };
    const regel = { codenaam: l.codenaam, tekst, at: Date.now() };
    kamer(id).chat = [...kamer(id).chat.slice(-39), regel];
    l.at = Date.now();
    save();
    sein(id, 'zeg', regel, key);
    return { status: 200, ok: true };
  }

  function emote(key, body) {
    const id = kamerVan(key);
    if (!id) return { status: 409, error: 'U bent nog geen kamer binnen.' };
    const g = ['✶', '♥', '○'].includes((body || {}).glyf) ? body.glyf : '✶';
    const l = kamer(id).leden[key];
    l.at = Date.now();
    sein(id, 'emote', { codenaam: l.codenaam, glyf: g }, key);
    return { status: 200, ok: true };
  }

  function weg(key) {
    const id = kamerVan(key);
    if (id) { const l = kamer(id).leden[key]; delete kamer(id).leden[key]; save(); if (l) sein(id, 'weg', { codenaam: l.codenaam }); }
    return { status: 200, ok: true };
  }

  function pols(key) {
    const id = kamerVan(key);
    if (!id) return { status: 409, error: 'U bent geen kamer binnen.' };
    kamer(id).leden[key].at = Date.now();
    return staat(id, plattegrond(id));
  }

  const api = { betreed, stap, zeg, emote, weg, pols };
  Object.assign(api, require('./suite')({ R, suiteVan, kamer, sein, save, schoon, MEUBELS, ZALEN, SUITE }));
  return { residentie: api };
}

module.exports = { maakResidentie };
