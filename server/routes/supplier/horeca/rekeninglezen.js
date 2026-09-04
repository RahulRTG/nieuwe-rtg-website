/* Horeca OS (deellaag): de gangen en het kijken -- een gang vrijgeven, en de
   rekening of de lijst rekeningen opvragen.

   WAAROM DIT BESTAND BESTAAT. ./rekening.js ging over de tienkilobytegrens van
   keuringsregel 13 toen drie takken er tegelijk iets bijzetten. De naad ligt
   hier omdat alles hieronder LEEST of doorzet en niets meer aan de rekening
   toevoegt; ./correctie.js is op dezelfde manier al eerder afgesplitst.

   De twee gedeelde hulpjes komen uit ./rekening.js via `kern` (horecaRekVan en
   horecaPubliek) -- er komt dus geen tweede manier bij om een rekening op te
   zoeken of publiek te maken. */
module.exports = (kern) => {
  const { app, save, schoon, supplierAuth, sseToSupplier, horeca } = kern;
  const { H, nu, totaal, openstaand } = horeca;
  const rekVan = kern.horecaRekVan;
  const publiek = kern.horecaPubliek;

  /* ---------- gangen ----------
     De bediening zet een gang vrij ("laat maar komen"); de keuken zet de
     regels daarna zelf door op het keukenscherm. Zo bepaalt de zaal het tempo
     van het diner en de keuken het tempo van de bereiding. */
  app.post('/api/supplier/horeca/gang/vrij', supplierAuth, (req, res) => {
    const r = rekVan(req, res); if (!r) return;
    const gang = Math.max(0, Math.min(9, parseInt(req.body.gang, 10) || 0));
    const regels = r.regels.filter(x => x.gang === gang && !x.vrijAt);
    if (!regels.length) return res.status(404).json({ error: 'Er staat niets meer open in gang ' + gang + '.' });
    const om = schoon(req.body.serveerOm, 5) || null;
    for (const x of regels) { x.vrijAt = nu(); x.serveerOm = om; }
    save();
    sseToSupplier(req.supplier.code, 'sync', { scope: 'keuken' });
    res.json({ ok: true, gang, vrijgegeven: regels.length, serveerOm: om, rekening: publiek(r) });
  });

  /* ---------- kijken ---------- */
  app.post('/api/supplier/horeca/rekening', supplierAuth, (req, res) => {
    const r = rekVan(req, res); if (!r) return;
    res.json({ ok: true, rekening: publiek(r) });
  });

  app.post('/api/supplier/horeca/rekeningen', supplierAuth, (req, res) => {
    const h = H(req.supplier.code);
    const status = schoon(req.body.status, 20) || 'open';
    const kanaal = schoon(req.body.kanaal, 20);
    const rijen = Object.values(h.rekeningen)
      .filter(r => r.status === status && (!kanaal || r.kanaal === kanaal))
      .sort((a, b) => String(a.geopendAt).localeCompare(String(b.geopendAt)))
      .slice(0, 300)
      .map(r => ({ id: r.id, kanaal: r.kanaal, tafel: r.tafel, naam: r.naam, gasten: r.gasten,
        regels: r.regels.length, geopendAt: r.geopendAt, totalen: totaal(r), openstaand: openstaand(r) }));
    res.json({ ok: true, aantal: rijen.length, rekeningen: rijen,
      omzetOpen: rijen.reduce((t, r) => t + r.totalen.netto, 0) });
  });

};
