/* Keukenvoorraad-routes (toren horeca): het overzicht met waarde, marges en
   inkoopadvies, recepten koppelen aan het menu, en de vloerhandelingen
   telling, verspilling en levering. Recepten en leveringen zijn management;
   tellen en derving melden mag iedereen (de vloer weet wat er staat). */
module.exports = (kern) => {
  const { app, supplierAuth, managerOnly, keuken, save, sseToSupplier, findSupplier, ghMarkt, ghPlaatsBestelling, sessionFor, dagrapport, shiftSamenvatting } = kern;
  const stuur = (res, r) => r.error ? res.status(r.status || 400).json({ error: r.error }) : res.json(r);
  const sein = code => sseToSupplier(code, 'sync', { scope: 'voorraad' });

  app.post('/api/supplier/keuken', supplierAuth, (req, res) => res.json(keuken.overzicht(req.supplier)));
  // het uittreksel voor de werkvloer-schermen: laag, op en de 86-adviezen
  app.post('/api/supplier/keuken/werkvloer', supplierAuth, (req, res) => res.json(keuken.werkvloer(req.supplier)));

  app.post('/api/supplier/keuken/recept', supplierAuth, (req, res) => {
    if (!managerOnly(req, res)) return;
    const r = keuken.receptZet(req.supplier, String(req.body.menuItemId || ''), req.body.regels);
    if (r.ok) sein(req.supplier.code);
    stuur(res, r);
  });
  app.post('/api/supplier/keuken/telling', supplierAuth, (req, res) => {
    const r = keuken.telling(req.supplier, req.body.artikelId, req.body.geteld, req.actor.name);
    if (r.ok) sein(req.supplier.code);
    stuur(res, r);
  });
  app.post('/api/supplier/keuken/verspilling', supplierAuth, (req, res) => {
    const r = keuken.verspilling(req.supplier, req.body.artikelId, req.body.hoeveelheid, req.body.reden, req.actor.name);
    if (r.ok) sein(req.supplier.code);
    stuur(res, r);
  });
  app.post('/api/supplier/keuken/levering', supplierAuth, (req, res) => {
    if (!managerOnly(req, res)) return;
    const r = keuken.levering(req.supplier, req.body.artikelId, req.body.hoeveelheid, req.body.kostprijs, req.actor.name);
    if (r.ok) sein(req.supplier.code);
    stuur(res, r);
  });

  /* Het inkoopadvies wordt met EEN knop een groothandelsbestelling: de
     adviesregels worden op naam gekoppeld aan het assortiment; wat niet
     matcht komt terug als "nietGevonden". Komt de bestelling later op
     "geleverd", dan vult de voorraad zichzelf aan (hook in de kern). */
  app.post('/api/supplier/keuken/bestel-advies', supplierAuth, (req, res) => {
    if (!managerOnly(req, res)) return;
    const s = req.supplier;
    const advies = keuken.inkoopadvies(s);
    if (!advies.length) return res.status(409).json({ error: 'Niets staat onder het minimum; er valt niets te bestellen.' });
    const soort = s.type === 'groothandel' ? 'groothandel' : 'partner';
    const ghCode = String(req.body.groothandelCode || '').toUpperCase();
    const gh = ghMarkt(soort, {}).find(g => g.code === ghCode);
    if (!gh) return res.status(404).json({ error: 'Groothandel niet gevonden of levert niet aan dit type zaak.' });
    const regels = [];
    const nietGevonden = [];
    for (const a of advies) {
      const naam = a.naam.toLowerCase();
      const p = gh.producten.find(x => { const pn = x.naam.toLowerCase(); return pn === naam || pn.includes(naam) || naam.includes(pn); });
      if (p) regels.push({ productId: p.id, aantal: a.advies });
      else nietGevonden.push(a.naam);
    }
    if (!regels.length) return res.status(409).json({ error: 'Geen adviesartikel staat in het assortiment van deze groothandel.', nietGevonden });
    const r = ghPlaatsBestelling(ghCode, { soort, id: s.code, naam: s.name }, regels, { bezorgen: true });
    if (r.error) return res.status(r.status).json({ error: r.error });
    res.json({ ok: true, order: r.order, nietGevonden });
  });

  // menu-engineering: verkoopvolume maal marge, in de klassieke kwadranten
  app.post('/api/supplier/keuken/menu-analyse', supplierAuth, (req, res) => {
    res.json(keuken.menuAnalyse(req.supplier, req.body.dagen));
  });
  // het actieplan van de AI-chef-adviseur: kwadranten plus derving, in euro's
  app.post('/api/supplier/keuken/menu-advies', supplierAuth, (req, res) => {
    if (!managerOnly(req, res)) return;
    res.json(keuken.menuAdvies(req.supplier, req.body.dagen));
  });

  // de dagafsluiting (Z-rapport): omzet, bonnen, betaalwijzen en btw van een dag
  app.post('/api/supplier/dagrapport', supplierAuth, (req, res) => {
    res.json(dagrapport(req.supplier, req.body.datum));
  });
  // de shift-samenvatting: het avondbriefing-moment (cijfers, gasten, toppers, derving, team)
  app.post('/api/supplier/shift', supplierAuth, (req, res) => {
    res.json(shiftSamenvatting(req.supplier, req.body.datum));
  });
  // dezelfde cijfers als journaalregels voor de boekhouding (CSV-download)
  app.get('/api/supplier/dagrapport.csv', (req, res) => {
    const sess = sessionFor(String(req.query.token || ''));
    if (!sess || sess.role !== 'supplier') return res.status(401).end();
    const s = findSupplier(sess.code);
    if (!s) return res.status(404).end();
    const r = dagrapport(s, req.query.datum);
    const geld = n => (Number(n) || 0).toFixed(2).replace('.', ',');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="dagrapport-' + s.code.toLowerCase() + '-' + r.datum + '.csv"');
    res.write('﻿' + ['datum', 'omschrijving', 'categorie', 'omzet incl btw', 'btw-tarief', 'btw-bedrag', 'omzet excl btw'].join(';') + '\n');
    for (const b of r.btw) res.write([r.datum, 'Omzet ' + b.label, b.cat, geld(b.omzet), b.tarief + '%', geld(b.btw), geld(b.grondslag)].join(';') + '\n');
    const WIJZE = { app: 'in de app', contant: 'contant', rtgpay: 'RTG Pay', rtg: 'RTG-lidmaatschap', kamer: 'op de kamer', pin: 'PIN' };
    for (const [wijze, bedrag] of Object.entries(r.betaalwijzen)) res.write([r.datum, 'Ontvangsten ' + (WIJZE[wijze] || wijze), 'betaalwijze', geld(bedrag), '', '', ''].join(';') + '\n');
    if (r.fooien) res.write([r.datum, 'Fooien (voor het team)', 'fooi', geld(r.fooien), '', '', ''].join(';') + '\n');
    res.end();
  });
};
