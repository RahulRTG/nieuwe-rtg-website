/* Verhuur (deelmodule): de vloot: auto's toevoegen, wijzigen of uit de
   verhuur nemen, het overzicht van lopende en afgeronde verhuur en de
   foto's per verhuur. Krijgt de gedeelde context een keer bij het
   opstarten vanuit routes/supplier/verhuur.js. */
module.exports = (vctx) => {
  const { app, crypto, db, express, facturatie, logActivity, managerOnly, media, notify, save, schoon, sseToCustomer, sseToOffice, sseToSupplier, supplierAuth,
    isVerhuur, huurVan, fotosVan } = vctx;
app.post('/api/supplier/auto', supplierAuth, (req, res) => {
  if (!managerOnly(req, res)) return;
  const s = req.supplier;
  if (!isVerhuur(s, res)) return;
  if (!Array.isArray(s.autos)) s.autos = [];
  if (req.body.weg) {
    const a = s.autos.find(x => x.id === req.body.id);
    if (a) a.actief = false; // nooit echt weg: lopende huren verwijzen ernaar
    save(); sseToSupplier(s.code, 'sync', { scope: 'huur' });
    return res.json({ ok: true, autos: s.autos });
  }
  const name = schoon(req.body.name, 60);
  const dagprijs = Number(req.body.dagprijs);
  if (!name) return res.status(400).json({ error: 'Geef de auto een naam.' });
  if (!(dagprijs > 0) || dagprijs > 5000) return res.status(400).json({ error: 'Geef een geldige dagprijs op.' });
  const keuze = (v, opties, standaard) => opties.includes(v) ? v : standaard;
  const getal = (v, min, max, standaard) => { const n = Number(v); return Number.isFinite(n) && n >= min && n <= max ? Math.round(n) : standaard; };
  const velden = {
    name, plate: schoon(req.body.plate, 12), dagprijs: Math.round(dagprijs), actief: true,
    categorie: schoon(req.body.categorie, 40) || 'Personenauto',
    transmissie: keuze(req.body.transmissie, ['handgeschakeld', 'automaat'], 'handgeschakeld'),
    brandstof: keuze(req.body.brandstof, ['benzine', 'diesel', 'elektrisch', 'hybride'], 'benzine'),
    stoelen: getal(req.body.stoelen, 1, 9, 5), deuren: getal(req.body.deuren, 2, 5, 4),
    airco: req.body.airco !== false, bagage: getal(req.body.bagage, 0, 9, 2),
    kmPerDag: getal(req.body.kmPerDag, 0, 2000, 0), // 0 = onbeperkt
    meerKm: Math.min(5, Math.max(0, Number(req.body.meerKm) || 0)),
    borg: getal(req.body.borg, 0, 5000, 0),
    minLeeftijd: getal(req.body.minLeeftijd, 18, 30, 21),
    icoon: schoon(req.body.icoon, 4) || '\uD83D\uDE97'
  };
  if (req.body.id) {
    const a = s.autos.find(x => x.id === req.body.id);
    if (!a) return res.status(404).json({ error: 'Auto niet gevonden.' });
    Object.assign(a, velden);
  } else {
    if (s.autos.length >= 60) return res.status(400).json({ error: 'Tot 60 auto\'s per zaak.' });
    s.autos.push({ id: 'c' + crypto.randomBytes(3).toString('hex'), ...velden });
  }
  save();
  logActivity(s.code, req.actor, 'werkte de verhuurvloot bij');
  sseToSupplier(s.code, 'sync', { scope: 'huur' });
  res.json({ ok: true, autos: s.autos });
});

app.post('/api/supplier/huur/overzicht', supplierAuth, (req, res) => {
  const s = req.supplier;
  if (!isVerhuur(s, res)) return;
  const vandaag = new Date().toISOString().slice(0, 10);
  const lijst = db.data.boekingen
    .filter(b => b.kind === 'huur' && b.supplierCode === s.code && b.paid &&
      (!['afgerond', 'geweigerd'].includes(b.status) || String(b.finishedAt || b.at).slice(0, 10) === vandaag))
    .slice(0, 40)
    .map(b => {
      const f = db.data.huurFotos[b.ref] || { voor: [], na: [] };
      const loc = db.data.huurLocaties[b.ref] || null;
      const auto = (s.autos || []).find(a => a.id === b.autoId) || null;
      return { ref: b.ref, codename: b.customerCodename, auto: b.autoNaam, kenteken: b.kenteken,
        van: b.van, tot: b.tot, dagen: b.dagen, prijs: b.price, status: b.status,
        borg: auto ? auto.borg : 0, spec: auto,
        uitgifte: b.uitgifte || null, inname: b.inname || null,
        fotosVoor: f.voor.length, fotosNa: f.na.length,
        sos: (b.sos || []).filter(x => !x.ok), sosAfgehandeld: (b.sos || []).filter(x => x.ok).length,
        locatie: loc && loc.aan && Number.isFinite(loc.lat) ? { lat: loc.lat, lng: loc.lng, at: loc.at } : null };
    });
  res.json({ huren: lijst });
});

/* De foto's zelf, per huur (zwaar: los van het overzicht opvragen). */
app.post('/api/supplier/huur/fotos', supplierAuth, (req, res) => {
  const s = req.supplier;
  if (!isVerhuur(s, res)) return;
  const h = huurVan(s, req.body.ref);
  if (!h) return res.status(404).json({ error: 'Huur niet gevonden.' });
  res.json({ fotos: db.data.huurFotos[h.ref] || { voor: [], na: [] } });
});

};
