/* Domein "supplier" (deelmodule): bezorg. Draait op de gedeelde kern. */
module.exports = (kern) => {
  const { app, crypto, db, logActivity, magBezorgen, haversine, etaMinutes, managerOnly, notify, save, schoon, sseToCustomer, sseToOffice, sseToSupplier, supplierAuth, orderMetRef, ordersVanZaak } = kern;

/* ================== de ophaal/bezorgdienst van de zaak ==================
   Beheer (assortiment + schakelaars) is voor managers; de bezorgersritten
   zijn voor iedereen met een PDA-login: ritten staan op naam (staffId). */
function bezorgVan(s) {
  if (!s.bezorg || typeof s.bezorg !== 'object') s.bezorg = { aan: false, ophalen: true, bezorgen: true, producten: [] };
  if (!Array.isArray(s.bezorg.producten)) s.bezorg.producten = [];
  return s.bezorg;
}

app.post('/api/supplier/bezorg/instellingen', supplierAuth, (req, res) => {
  if (!managerOnly(req, res)) return;
  const s = req.supplier;
  if (!magBezorgen(s)) return res.status(409).json({ error: 'Deze sector heeft geen ophaal/bezorgdienst; die is voor horeca en zelfstandigen.' });
  const b = bezorgVan(s);
  if (req.body.ophalen != null) b.ophalen = !!req.body.ophalen;
  if (req.body.bezorgen != null) b.bezorgen = !!req.body.bezorgen;
  if (req.body.aan != null) {
    if (req.body.aan && !b.producten.length)
      return res.status(400).json({ error: 'Zet eerst producten in het assortiment; dan kan de dienst aan.' });
    b.aan = !!req.body.aan;
  }
  if (!b.ophalen && !b.bezorgen) b.aan = false; // zonder kanaal geen dienst
  save();
  logActivity(s.code, req.actor, 'zette de ophaal/bezorgdienst ' + (b.aan ? 'aan' : 'uit'));
  sseToSupplier(s.code, 'sync', { scope: 'bezorg' });
  res.json({ ok: true, bezorg: b });
});

app.post('/api/supplier/bezorg/product', supplierAuth, (req, res) => {
  if (!managerOnly(req, res)) return;
  const s = req.supplier;
  if (!magBezorgen(s)) return res.status(409).json({ error: 'Deze sector heeft geen ophaal/bezorgdienst.' });
  const b = bezorgVan(s);
  if (req.body.weg) {
    b.producten = b.producten.filter(p => p.id !== req.body.id);
    if (!b.producten.length) b.aan = false; // leeg assortiment: dienst dicht
    save(); sseToSupplier(s.code, 'sync', { scope: 'bezorg' });
    return res.json({ ok: true, producten: b.producten, aan: b.aan });
  }
  const name = schoon(req.body.name, 60);
  const price = Number(req.body.price);
  if (!name) return res.status(400).json({ error: 'Geef het product een naam.' });
  if (!(price > 0) || price > 10000) return res.status(400).json({ error: 'Geef een geldige prijs op.' });
  const desc = schoon(req.body.desc, 140);
  if (req.body.id) {
    const p = b.producten.find(x => x.id === req.body.id);
    if (!p) return res.status(404).json({ error: 'Product niet gevonden.' });
    p.name = name; p.price = price; p.desc = desc;
  } else {
    if (b.producten.length >= 60) return res.status(400).json({ error: 'Het assortiment kan tot 60 producten hebben.' });
    b.producten.push({ id: 'bz' + crypto.randomBytes(3).toString('hex'), name, desc, price });
  }
  save();
  sseToSupplier(s.code, 'sync', { scope: 'bezorg' });
  res.json({ ok: true, producten: b.producten });
});

/* Alles wat er nu loopt: voor de zaak-tab en de bezorger-PDA. */
app.post('/api/supplier/bezorg/overzicht', supplierAuth, (req, res) => {
  const s = req.supplier;
  const lopend = ordersVanZaak(s.code).filter(o => o.levering &&
    !['geweigerd', 'terugbetaald', 'bezorgd', 'opgehaald'].includes(o.status) && o.status !== 'wacht-op-betaling').slice(0, 60);
  const vandaag = new Date().toISOString().slice(0, 10);
  const klaarVandaag = ordersVanZaak(s.code).filter(o => o.levering &&
    ['bezorgd', 'opgehaald'].includes(o.status) && String(o.finishedAt || o.at).slice(0, 10) === vandaag);
  res.json({ bezorg: bezorgVan(s), lopend, vandaag: { aantal: klaarVandaag.length, omzet: klaarVandaag.reduce((x, o) => x + (o.total || 0), 0) } });
});

/* De bezorger neemt een of meer leveringen tegelijk aan, op eigen naam. */
app.post('/api/supplier/bezorg/neem', supplierAuth, (req, res) => {
  const s = req.supplier;
  const refs = (Array.isArray(req.body.refs) ? req.body.refs : [req.body.ref]).filter(Boolean).slice(0, 8);
  const genomen = [];
  for (const ref of refs) {
    const o = (x => x && x.supplierCode === s.code ? x : undefined)(orderMetRef(ref));
    if (!o || o.levering !== 'bezorgen' || o.bezorger || !o.paid) continue;
    if (['geweigerd', 'terugbetaald', 'bezorgd', 'opgehaald'].includes(o.status)) continue;
    o.bezorger = { staffId: req.actor.staffId || null, name: req.actor.name };
    genomen.push(o.ref);
    sseToCustomer(o.customerKey || o.customerTier, 'bezorg', { ref: o.ref, kind: 'bezorger', bezorger: req.actor.name });
  }
  if (!genomen.length) return res.status(409).json({ error: 'Geen van deze leveringen is nog vrij.' });
  save();
  logActivity(s.code, req.actor, 'nam ' + genomen.length + ' bezorging(en) aan');
  sseToSupplier(s.code, 'sync', { scope: 'bezorg' });
  res.json({ ok: true, genomen });
});

/* Statusovergangen van de rit, ook voor meerdere refs tegelijk (de hele rit
   vertrekt of komt aan). Alleen de eigen rit, tenzij je manager bent. */
app.post('/api/supplier/bezorg/status', supplierAuth, (req, res) => {
  const s = req.supplier;
  const status = String(req.body.status || '');
  if (!['onderweg', 'bezorgd', 'opgehaald'].includes(status)) return res.status(400).json({ error: 'Onbekende status.' });
  const refs = (Array.isArray(req.body.refs) ? req.body.refs : [req.body.ref]).filter(Boolean).slice(0, 8);
  const bijgewerkt = [];
  for (const ref of refs) {
    const o = (x => x && x.supplierCode === s.code ? x : undefined)(orderMetRef(ref));
    if (!o || !o.levering) continue;
    if (status === 'opgehaald' && o.levering !== 'ophalen') continue;
    if (status !== 'opgehaald' && o.levering !== 'bezorgen') continue;
    if (status !== 'opgehaald' && o.bezorger && req.actor.staffId && o.bezorger.staffId !== req.actor.staffId && !req.actor.manager) continue;
    o.status = status;
    if (status !== 'onderweg') { o.finishedAt = new Date().toISOString(); delete o.etaMin; }
    bijgewerkt.push(o.ref);
    notify(o.customerTier, { icon: status === 'onderweg' ? '\u{1F6F5}' : '\u2705', title: s.name,
      body: status === 'onderweg' ? 'Uw bestelling is onderweg.' : status === 'bezorgd' ? 'Uw bestelling is bezorgd. Eet smakelijk!' : 'Uw bestelling is opgehaald. Dank u wel!', scope: 'orders' });
    sseToCustomer(o.customerKey || o.customerTier, 'bezorg', { ref: o.ref, kind: 'status', status });
  }
  if (!bijgewerkt.length) return res.status(404).json({ error: 'Geen levering gevonden om bij te werken.' });
  save();
  logActivity(s.code, req.actor, 'zette ' + bijgewerkt.join(', ') + ' op "' + status + '"');
  sseToSupplier(s.code, 'sync', { scope: 'bezorg' });
  sseToOffice('sync', { scope: 'orders' });
  res.json({ ok: true, refs: bijgewerkt });
});

/* GPS van de bezorger: vluchtig (geen save), de klant krijgt positie en
   verwachte aankomsttijd live via SSE. */
app.post('/api/supplier/bezorg/gps', supplierAuth, (req, res) => {
  const lat = Number(req.body.lat), lng = Number(req.body.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return res.status(400).json({ error: 'Geen geldige positie.' });
  const s = req.supplier;
  const B = db.data.bezorgers = db.data.bezorgers || {};
  B[s.code + ':' + (req.actor.staffId || 'beheer')] = { lat, lng, at: new Date().toISOString(), staffId: req.actor.staffId || null, name: req.actor.name };
  const mijnOnderweg = ordersVanZaak(s.code).filter(o => o.status === 'onderweg' &&
    o.bezorger && o.bezorger.staffId === (req.actor.staffId || null));
  const eta = [];
  for (const o of mijnOnderweg) {
    const m = o.geo && Number.isFinite(o.geo.lat) ? haversine({ lat, lng }, o.geo) : null;
    const e = m != null ? etaMinutes(m, 'driving') : null;
    if (e != null) o.etaMin = e;
    eta.push({ ref: o.ref, etaMin: e, meters: m });
    sseToCustomer(o.customerKey || o.customerTier, 'bezorg', { ref: o.ref, kind: 'gps', lat, lng, etaMin: e });
  }
  res.json({ ok: true, eta });
});

};
