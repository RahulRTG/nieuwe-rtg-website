/* Charter (deelmodule): de reis: de foto's per charter (voor/na als harde
   eis), uitvaren en teruggeven met motoruren- en brandstofverrekening, en
   het afhandelen van SOS. Krijgt de gedeelde context een keer bij het
   opstarten vanuit routes/supplier/charter.js. */
module.exports = (cctx) => {
  const { app, crypto, db, express, logActivity, managerOnly, media, notify, save, schoon, sseToCustomer, sseToOffice, sseToSupplier, supplierAuth,
    BOOT_TYPES, isCharter, charterVan, fotosVan, getal } = cctx;
  app.post('/api/supplier/charter/fotos', supplierAuth, (req, res) => {
    const s = req.supplier;
    if (!isCharter(s, res)) return;
    const c = charterVan(s, req.body.ref);
    if (!c) return res.status(404).json({ error: 'Charter niet gevonden.' });
    res.json({ fotos: db.data.charterFotos[c.ref] || { voor: [], na: [] } });
  });

  app.post('/api/supplier/charter/foto', express.json({ limit: '1.5mb' }), supplierAuth, async (req, res) => {
    const s = req.supplier;
    if (!isCharter(s, res)) return;
    const c = charterVan(s, req.body.ref);
    if (!c) return res.status(404).json({ error: 'Charter niet gevonden.' });
    const fase = req.body.fase === 'na' ? 'na' : 'voor';
    if (fase === 'voor' && c.status !== 'aangevraagd') return res.status(409).json({ error: 'Voor-foto\'s horen bij het uitvaren.' });
    if (fase === 'na' && c.status !== 'lopend') return res.status(409).json({ error: 'Na-foto\'s horen bij de teruggave.' });
    const foto = String(req.body.foto || '');
    if (!/^data:image\/(jpeg|png|webp);base64,/.test(foto) || foto.length > 400000)
      return res.status(400).json({ error: 'Stuur een foto (jpeg/png/webp, tot ~300 kB).' });
    const f = fotosVan(c.ref);
    if (f[fase].filter(x => x.door !== 'gast').length >= 8) return res.status(400).json({ error: 'Tot acht foto\'s per kant.' });
    // De foto naar de mediastore; in db.data komt alleen de /media-verwijzing.
    const ref = await media.bewaarPubliek(foto, 400000);
    if (!ref) return res.status(400).json({ error: 'De foto kon niet worden opgeslagen.' });
    f[fase].push({ foto: ref, door: req.actor.name, at: new Date().toISOString() });
    save();
    sseToCustomer(c.customerKey || c.customerTier, 'sync', { scope: 'charter' });
    res.json({ ok: true, aantal: f[fase].length });
  });

  /* Uitvaren en teruggeven, met de foto-eis als harde regel. Bij het uitvaren
     legt de schipper de motoruren en het brandstofniveau vast; bij teruggave
     idem, en het verschil wordt eerlijk verrekend. */
  app.post('/api/supplier/charter/status', supplierAuth, (req, res) => {
    const s = req.supplier;
    if (!isCharter(s, res)) return;
    const c = charterVan(s, req.body.ref);
    if (!c) return res.status(404).json({ error: 'Charter niet gevonden.' });
    const status = String(req.body.status || '');
    const f = db.data.charterFotos[c.ref] || { voor: [], na: [] };
    if (status === 'lopend') {
      if (c.status !== 'aangevraagd') return res.status(409).json({ error: 'Deze charter is niet klaar om uit te varen.' });
      if (!c.paid) return res.status(409).json({ error: 'Nog niet betaald.' });
      if (!f.voor.length) return res.status(409).json({ error: 'Eerst de staat vastleggen: minstens een voor-foto (gast of bemanning).' });
      const urenStart = Number(req.body.urenStart);
      if (!Number.isFinite(urenStart) || urenStart < 0) return res.status(400).json({ error: 'Vul de motorurenstand bij uitvaren in.' });
      c.uitvaart = { urenStart: Math.round(urenStart), brandstofStart: Math.min(8, Math.max(0, parseInt(req.body.brandstofStart, 10) || 8)),
        skipper: c.metSkipper ? (req.actor.name || null) : null, door: req.actor.name, at: new Date().toISOString() };
      if (c.metSkipper && !c.skipperNaam) c.skipperNaam = req.actor.name;
    } else if (status === 'afgerond') {
      if (c.status !== 'lopend') return res.status(409).json({ error: 'Deze charter is niet onderweg.' });
      if (!f.na.length) return res.status(409).json({ error: 'Eerst de staat bij teruggave vastleggen: minstens een na-foto.' });
      const urenEind = Number(req.body.urenEind);
      if (!Number.isFinite(urenEind) || (c.uitvaart && urenEind < c.uitvaart.urenStart))
        return res.status(400).json({ error: 'Vul de motorurenstand bij teruggave in (niet lager dan bij uitvaren).' });
      const brandstofEind = Math.min(8, Math.max(0, parseInt(req.body.brandstofEind, 10) || 8));
      const boot = (s.boten || []).find(v => v.id === c.bootId) || {};
      const gevaren = c.uitvaart ? Math.round(urenEind) - c.uitvaart.urenStart : 0;
      const vrij = (boot.motorurenPerDag || 0) * (c.dagen || 1);
      const extraUur = (boot.motorurenPerDag && gevaren > vrij) ? gevaren - vrij : 0;
      const uurKosten = Math.round(extraUur * (boot.meerUur || 0) * 100) / 100;
      const brandstofTekort = c.uitvaart ? Math.max(0, c.uitvaart.brandstofStart - brandstofEind) : 0; // in achtsten
      const brandstofKosten = Math.round(brandstofTekort / 8 * 400 * 100) / 100; // ~400 euro voor een volle tank op zee
      c.teruggave = { urenEind: Math.round(urenEind), brandstofEind, gevaren, extraUur, uurKosten, brandstofTekort, brandstofKosten,
        meerkosten: Math.round((uurKosten + brandstofKosten) * 100) / 100, door: req.actor.name, at: new Date().toISOString() };
      c.finishedAt = new Date().toISOString();
      delete db.data.charterLocaties[c.ref];
    } else if (status === 'geweigerd') {
      if (!req.actor.manager) return res.status(403).json({ error: 'Alleen een manager annuleert een charter.' });
      if (c.status === 'lopend') return res.status(409).json({ error: 'Een lopende charter annuleer je niet; rond hem af met na-foto\'s.' });
      c.finishedAt = new Date().toISOString();
    } else return res.status(400).json({ error: 'Onbekende status.' });
    c.status = status;
    save();
    logActivity(s.code, req.actor, (status === 'lopend' ? 'liet uitvaren: ' : status === 'afgerond' ? 'nam terug: ' : 'annuleerde ') + (c.bootNaam || c.ref) + ' (' + c.customerCodename + ')');
    notify(c.customerTier, { icon: '⛵', title: s.name,
      body: status === 'lopend' ? 'Behouden vaart! De staat is vastgelegd met ' + f.voor.length + ' foto(’s).' + (c.metSkipper ? ' Uw schipper is ' + (c.skipperNaam || 'aan boord') + '.' : '')
        : status === 'afgerond' ? 'Teruggegeven. ' + (c.teruggave.meerkosten > 0 ? 'Meerkosten: € ' + c.teruggave.meerkosten + ' (motoruren/brandstof).' : 'Geen meerkosten. Uw borg wordt vrijgegeven.') + ' Bedankt voor de vaart!'
        : 'De charter is geannuleerd.', scope: 'orders' });
    sseToCustomer(c.customerKey || c.customerTier, 'sync', { scope: 'charter' });
    sseToOffice('sync', { scope: 'orders' });
    res.json({ ok: true, charter: { ref: c.ref, status: c.status } });
  });

  app.post('/api/supplier/charter/sos-ok', supplierAuth, (req, res) => {
    const s = req.supplier;
    if (!isCharter(s, res)) return;
    const c = charterVan(s, req.body.ref);
    if (!c || !Array.isArray(c.sos)) return res.status(404).json({ error: 'Geen SOS gevonden.' });
    let n = 0;
    for (const x of c.sos) if (!x.ok) { x.ok = { door: req.actor.name, at: new Date().toISOString() }; n++; }
    if (!n) return res.status(409).json({ error: 'Alles is al afgehandeld.' });
    save();
    logActivity(s.code, req.actor, 'handelde de SOS op zee van ' + c.customerCodename + ' af');
    sseToOffice('sync', { scope: 'orders' });
    res.json({ ok: true, afgehandeld: n });
  });
};
