/* Vastgoed (deelmodule): de portefeuille: panden toevoegen en beheren,
   foto's, en het aanbieden (gericht aan gekozen leden of publiek naar de
   volgers). Krijgt de gedeelde context een keer bij het opstarten vanuit
   routes/supplier/vastgoed.js. */
module.exports = (vctx) => {
  const { app, crypto, db, express, facturatie, logActivity, keyVanCodenaam, managerOnly, media, notify, salonNaarVolgers, save, schoon, sseToCustomer, sseToSupplier, supplierAuth,
    isVastgoed, pandVan, keylessCode } = vctx;
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
app.post('/api/supplier/pand/foto', express.json({ limit: '1.5mb' }), supplierAuth, async (req, res) => {
  const s = req.supplier;
  if (!isVastgoed(s, res)) return;
  if (!managerOnly(req, res)) return;
  const p = pandVan(s, req.body.id);
  if (!p) return res.status(404).json({ error: 'Pand niet gevonden.' });
  const foto = String(req.body.foto || '');
  if (!/^data:image\/(jpeg|png|webp);base64,/.test(foto) || foto.length > 500000) return res.status(400).json({ error: 'Stuur een foto (tot ~400 kB).' });
  p.fotos = p.fotos || [];
  if (req.body.weg != null) { p.fotos.splice(Number(req.body.weg), 1); }
  else {
    if (p.fotos.length >= 12) return res.status(400).json({ error: 'Tot 12 foto\'s per pand.' });
    // De foto naar de mediastore; in db.data komt alleen de /media-verwijzing.
    const ref = await media.bewaarPubliek(foto, 500000);
    if (!ref) return res.status(400).json({ error: 'De foto kon niet worden opgeslagen.' });
    p.fotos.push(ref);
  }
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
};
