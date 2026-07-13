/* Domein "supplier" (deelmodule): vastgoed. Draait op de gedeelde kern. */
module.exports = (kern) => {
  const { app, crypto, db, express, logActivity, keyVanCodenaam, managerOnly, notify, salonNaarVolgers, save, schoon, sseToCustomer, sseToSupplier, supplierAuth } = kern;

/* ================== vastgoed: het makelaarskantoor ==================
   Panden aanbieden (gericht aan gekozen leden of publiek), biedingen,
   bezichtigingen met keyless toegang, en snelle contracten. */
function isVastgoed(s, res) {
  if (s.type !== 'vastgoed') { res.status(409).json({ error: 'Dit is geen makelaarskantoor.' }); return false; }
  return true;
}
function pandVan(s, id) { return (s.panden || []).find(p => p.id === id); }
function keylessCode() { const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let c = ''; for (let i = 0; i < 6; i++) c += A[crypto.randomInt(A.length)]; return c; }

app.post('/api/supplier/pand', supplierAuth, (req, res) => {
  if (!managerOnly(req, res)) return;
  const s = req.supplier;
  if (!isVastgoed(s, res)) return;
  if (!Array.isArray(s.panden)) s.panden = [];
  if (req.body.weg) {
    s.panden = s.panden.filter(p => p.id !== req.body.id);
    save(); sseToSupplier(s.code, 'sync', { scope: 'vastgoed' });
    return res.json({ ok: true, panden: s.panden });
  }
  const titel = schoon(req.body.titel, 80);
  const prijs = Number(req.body.prijs);
  if (!titel) return res.status(400).json({ error: 'Geef het pand een titel.' });
  if (!(prijs > 0)) return res.status(400).json({ error: 'Geef een geldige prijs op.' });
  const num = (v, max) => { const n = parseInt(v, 10); return Number.isFinite(n) && n >= 0 && n <= max ? n : 0; };
  const velden = {
    titel, prijs: Math.round(prijs),
    soort: ['woning', 'appartement', 'villa', 'commercieel', 'grond'].includes(req.body.soort) ? req.body.soort : 'woning',
    transactie: req.body.transactie === 'huur' ? 'huur' : 'koop',
    plaats: schoon(req.body.plaats, 60), adres: schoon(req.body.adres, 80),
    slaapkamers: num(req.body.slaapkamers, 30), badkamers: num(req.body.badkamers, 20),
    oppervlakte: num(req.body.oppervlakte, 100000), perceel: num(req.body.perceel, 10000000),
    tuin: !!req.body.tuin, zwembad: !!req.body.zwembad, garage: num(req.body.garage, 20),
    energielabel: schoon(req.body.energielabel, 3) || null,
    omschrijving: schoon(req.body.omschrijving, 1200),
    keyless: !!req.body.keyless,
    status: ['beschikbaar', 'onder-optie', 'verkocht', 'verhuurd'].includes(req.body.status) ? req.body.status : undefined
  };
  if (req.body.id) {
    const p = pandVan(s, req.body.id);
    if (!p) return res.status(404).json({ error: 'Pand niet gevonden.' });
    if (velden.status === undefined) delete velden.status;
    Object.assign(p, velden);
  } else {
    if ((s.panden || []).length >= 300) return res.status(400).json({ error: 'Tot 300 panden per kantoor.' });
    s.panden.push({ id: 'p' + crypto.randomBytes(3).toString('hex'), fotos: [], status: 'beschikbaar', ...velden });
  }
  save();
  logActivity(s.code, req.actor, 'werkte het vastgoedaanbod bij');
  sseToSupplier(s.code, 'sync', { scope: 'vastgoed' });
  res.json({ ok: true, panden: s.panden });
});

/* Een foto bij een pand (los opgeslagen, net als de huurfoto's). */
app.post('/api/supplier/pand/foto', express.json({ limit: '1.5mb' }), supplierAuth, (req, res) => {
  const s = req.supplier;
  if (!isVastgoed(s, res)) return;
  if (!managerOnly(req, res)) return;
  const p = pandVan(s, req.body.id);
  if (!p) return res.status(404).json({ error: 'Pand niet gevonden.' });
  const foto = String(req.body.foto || '');
  if (!/^data:image\/(jpeg|png|webp);base64,/.test(foto) || foto.length > 500000) return res.status(400).json({ error: 'Stuur een foto (tot ~400 kB).' });
  p.fotos = p.fotos || [];
  if (req.body.weg != null) { p.fotos.splice(Number(req.body.weg), 1); }
  else { if (p.fotos.length >= 12) return res.status(400).json({ error: 'Tot 12 foto\'s per pand.' }); p.fotos.push(foto); }
  save();
  sseToSupplier(s.code, 'sync', { scope: 'vastgoed' });
  res.json({ ok: true, aantal: p.fotos.length });
});

/* Aanbieden: kies specifieke leden (op codenaam), of publiek/naar de volgers.
   Gerichte leden krijgen een melding en zien het pand prive in hun app. */
app.post('/api/supplier/aanbieding', supplierAuth, async (req, res) => {
  if (!managerOnly(req, res)) return;
  const s = req.supplier;
  if (!isVastgoed(s, res)) return;
  const p = pandVan(s, req.body.pandId);
  if (!p) return res.status(404).json({ error: 'Pand niet gevonden.' });
  const codenamen = Array.isArray(req.body.codenamen) ? req.body.codenamen : String(req.body.codenamen || '').split(',');
  const aanKeys = [], nietGevonden = [];
  for (const cn of codenamen.map(x => String(x).trim()).filter(Boolean)) {
    const lid = await keyVanCodenaam(cn);
    if (lid) aanKeys.push(lid.key); else nietGevonden.push(cn);
  }
  const publiek = !!req.body.publiek;
  if (!publiek && !aanKeys.length) return res.status(400).json({ error: 'Kies minstens een lid (op codenaam) of maak het aanbod publiek.' });
  const a = { ref: 'RTG-A-' + crypto.randomBytes(3).toString('hex').toUpperCase(),
    supplierCode: s.code, pandId: p.id, aanKeys, publiek, at: new Date().toISOString() };
  db.data.vastgoedAanbod.unshift(a);
  db.data.vastgoedAanbod = db.data.vastgoedAanbod.slice(0, 20000);
  // gerichte leden persoonlijk op de hoogte brengen
  for (const key of aanKeys) {
    notify(key, { icon: '\u{1F3E1}', title: s.name, body: 'Voor u geselecteerd: ' + p.titel + ' \u00B7 \u20AC ' + p.prijs.toLocaleString('nl-NL'), scope: 'vastgoed' });
    sseToCustomer(key, 'sync', { scope: 'vastgoed' });
  }
  // en desgewenst op De Salon voor de volgers
  if (publiek && req.body.salon) salonNaarVolgers(s, p.titel + ' \u2013 ' + p.plaats + ' \u00B7 \u20AC ' + p.prijs.toLocaleString('nl-NL') + '. ' + (p.omschrijving || '').slice(0, 140));
  save();
  logActivity(s.code, req.actor, 'bood ' + p.titel + ' aan (' + (publiek ? 'publiek' : aanKeys.length + ' lid/leden') + ')');
  sseToSupplier(s.code, 'sync', { scope: 'vastgoed' });
  res.json({ ok: true, aanbieding: { ref: a.ref, aan: aanKeys.length, publiek, nietGevonden } });
});

/* De slimme backoffice: kerncijfers, panden, en alles wat aandacht vraagt. */
app.post('/api/supplier/vastgoed/overzicht', supplierAuth, (req, res) => {
  const s = req.supplier;
  if (!isVastgoed(s, res)) return;
  const panden = s.panden || [];
  const bez = db.data.bezichtigingen.filter(b => b.supplierCode === s.code).slice(0, 100);
  const bod = db.data.biedingen.filter(b => b.supplierCode === s.code).slice(0, 100);
  const pandTitel = id => (panden.find(p => p.id === id) || {}).titel || id;
  res.json({
    stats: {
      totaal: panden.length,
      beschikbaar: panden.filter(p => p.status === 'beschikbaar').length,
      onderOptie: panden.filter(p => p.status === 'onder-optie').length,
      verkocht: panden.filter(p => p.status === 'verkocht' || p.status === 'verhuurd').length,
      openBezichtigingen: bez.filter(b => b.status === 'aangevraagd').length,
      openBiedingen: bod.filter(b => b.status === 'open').length,
      portefeuille: panden.filter(p => p.status !== 'verkocht' && p.status !== 'verhuurd').reduce((n, p) => n + (p.transactie === 'koop' ? p.prijs : 0), 0)
    },
    panden,
    aanbiedingen: db.data.vastgoedAanbod.filter(a => a.supplierCode === s.code).slice(0, 60)
      .map(a => ({ ref: a.ref, pand: pandTitel(a.pandId), aan: a.aanKeys.length, publiek: a.publiek, at: a.at })),
    bezichtigingen: bez.map(b => ({ ref: b.ref, pand: pandTitel(b.pandId), codename: b.codename, wens: b.wens, status: b.status, moment: b.moment || null, keyless: !!b.keyless })),
    biedingen: bod.map(b => ({ ref: b.ref, pand: pandTitel(b.pandId), codename: b.codename, bedrag: b.bedrag, status: b.status, tegenbod: b.tegenbod || null }))
  });
});

/* Bezichtiging bevestigen (met moment) en, als het pand keyless is, een
   toegangsvenster verlenen; of afwijzen. */
app.post('/api/supplier/bezichtiging/beslis', supplierAuth, (req, res) => {
  const s = req.supplier;
  if (!isVastgoed(s, res)) return;
  const b = db.data.bezichtigingen.find(x => x.ref === String(req.body.ref || '') && x.supplierCode === s.code);
  if (!b) return res.status(404).json({ error: 'Bezichtiging niet gevonden.' });
  const p = pandVan(s, b.pandId) || {};
  if (req.body.actie === 'afwijzen') { b.status = 'afgewezen'; }
  else if (req.body.actie === 'bevestigen') {
    const moment = String(req.body.moment || '');
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(moment)) return res.status(400).json({ error: 'Kies datum en tijd voor de bezichtiging.' });
    b.status = 'bevestigd'; b.moment = moment;
    // keyless: een venster rond het afgesproken moment (30 min voor tot 2 uur na)
    if (p.keyless) {
      const t = new Date(moment).getTime();
      b.keyless = { code: keylessCode(), van: new Date(t - 30 * 60000).toISOString(), tot: new Date(t + 120 * 60000).toISOString(), gebruikt: [] };
    }
  } else return res.status(400).json({ error: 'Onbekende actie.' });
  save();
  notify(b.customerTier || b.key, { icon: '\u{1F3E1}', title: s.name,
    body: req.body.actie === 'bevestigen'
      ? 'Bezichtiging van ' + p.titel + ' bevestigd: ' + String(b.moment).replace('T', ' ').slice(0, 16) + (b.keyless ? ' \u00B7 keyless toegang staat klaar.' : '')
      : 'De bezichtiging van ' + p.titel + ' kon helaas niet.', scope: 'vastgoed' });
  sseToCustomer(b.key, 'sync', { scope: 'vastgoed' });
  logActivity(s.code, req.actor, (req.body.actie === 'bevestigen' ? 'bevestigde' : 'wees af') + ' bezichtiging ' + b.ref);
  sseToSupplier(s.code, 'sync', { scope: 'vastgoed' });
  res.json({ ok: true });
});

/* Een bod behandelen: accepteren, afwijzen of een tegenbod doen. */
app.post('/api/supplier/bod/beslis', supplierAuth, (req, res) => {
  if (!managerOnly(req, res)) return;
  const s = req.supplier;
  if (!isVastgoed(s, res)) return;
  const b = db.data.biedingen.find(x => x.ref === String(req.body.ref || '') && x.supplierCode === s.code);
  if (!b) return res.status(404).json({ error: 'Bod niet gevonden.' });
  if (b.status !== 'open') return res.status(409).json({ error: 'Dit bod is al behandeld.' });
  const p = pandVan(s, b.pandId) || {};
  if (req.body.actie === 'accepteren') { b.status = 'geaccepteerd'; if (pandVan(s, b.pandId)) pandVan(s, b.pandId).status = 'onder-optie'; }
  else if (req.body.actie === 'afwijzen') { b.status = 'afgewezen'; }
  else if (req.body.actie === 'tegenbod') {
    const tb = Number(req.body.tegenbod);
    if (!(tb > 0)) return res.status(400).json({ error: 'Geef een geldig tegenbod.' });
    b.status = 'tegenbod'; b.tegenbod = Math.round(tb);
  } else return res.status(400).json({ error: 'Onbekende actie.' });
  save();
  notify(b.customerTier || b.key, { icon: '\u{1F3E1}', title: s.name,
    body: b.status === 'geaccepteerd' ? 'Uw bod op ' + p.titel + ' is geaccepteerd! We stellen een contract op.'
      : b.status === 'tegenbod' ? 'Tegenbod op ' + p.titel + ': \u20AC ' + b.tegenbod.toLocaleString('nl-NL')
      : 'Uw bod op ' + p.titel + ' is helaas afgewezen.', scope: 'vastgoed' });
  sseToCustomer(b.key, 'sync', { scope: 'vastgoed' });
  logActivity(s.code, req.actor, 'behandelde bod ' + b.ref + ' (' + b.status + ')');
  sseToSupplier(s.code, 'sync', { scope: 'vastgoed' });
  res.json({ ok: true, status: b.status });
});
};
