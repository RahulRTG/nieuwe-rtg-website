/* Routes van RTG Payroll: het loonkantoor (officeAuth) en de kant van de
   medewerker (supplierAuth: eigen loonstroken, eigen kansen en de eigen
   "open voor werk"-schakelaar). Draait op de gedeelde kern. */
module.exports = (kern) => {
  const { app, officeAuth, supplierAuth, payroll, openVacatures, findSupplier, db, logActivity, schoon } = kern;

  /* ---------- het payroll-kantoor (RTG-office) ---------- */
  app.post('/api/office/payroll/overzicht', officeAuth, (req, res) => {
    const mensen = payroll.wieWerktWaar();
    const zaken = db.data.suppliers.map(s => {
      const runs = payroll.runsVan(s.code);
      return { code: s.code, naam: s.name, stad: s.city, mensen: mensen.filter(m => m.code === s.code).length,
        laatsteRun: runs[0] ? { periode: runs[0].periode, totaalNetto: runs[0].totaalNetto, at: runs[0].at } : null };
    });
    res.json({ mensen, zaken,
      openVoorWerk: mensen.filter(m => m.openVoorWerk).length,
      overbelast: mensen.filter(m => m.past === 'overbelast').length });
  });

  app.post('/api/office/payroll/loonrun', officeAuth, (req, res) => {
    const r = payroll.loonrun(String(req.body.code || ''), req.body.periode, 'RTG Payroll');
    if (r.error) return res.status(r.status).json({ error: r.error });
    res.json(r);
  });

  app.post('/api/office/payroll/runs', officeAuth, (req, res) => {
    res.json({ runs: payroll.runsVan(String(req.body.code || '')) });
  });

  /* De matchtafel: elke open vacature met kandidaat-suggesties, en elke
     open-voor-werk-medewerker met de bedrijven die bij hem passen. */
  app.post('/api/office/payroll/match', officeAuth, (req, res) => {
    const vacatures = openVacatures(null, null).slice(0, 20)
      .map(v => ({ vacature: { id: v.id, bedrijf: v.bedrijf, func: v.func, plaats: v.plaats, soort: v.soort },
        kandidaten: payroll.kandidatenVoor(v) }));
    const open = payroll.wieWerktWaar().filter(m => m.openVoorWerk)
      .map(m => ({ naam: m.naam.split(' ')[0], rol: m.rol, zaak: m.zaak, past: m.past,
        kansen: payroll.kansenVoor(m.code, m.staffId).slice(0, 3)
          .map(k => ({ bedrijf: k.vacature.bedrijf, func: k.vacature.func, score: k.score })) }));
    res.json({ vacatures, open });
  });

  /* ---------- de medewerker (PDA) ---------- */
  app.post('/api/supplier/payroll/stroken', supplierAuth, (req, res) => {
    if (!req.actor.staffId) return res.json({ stroken: [] });
    res.json({ stroken: payroll.strokenVan(req.supplier.code, req.actor.staffId).slice(0, 12) });
  });

  app.post('/api/supplier/payroll/kansen', supplierAuth, (req, res) => {
    if (!req.actor.staffId) return res.json({ kansen: [], open: false });
    const o = payroll.openVoor(req.supplier.code, req.actor.staffId);
    res.json({ open: !!o, wens: (o && o.wens) || '',
      kansen: payroll.kansenVoor(req.supplier.code, req.actor.staffId)
        .map(k => ({ bedrijf: k.vacature.bedrijf, func: k.vacature.func, plaats: k.vacature.plaats,
          soort: k.vacature.soort, uren: k.vacature.uren, score: k.score })) });
  });

  app.post('/api/supplier/payroll/openvoorwerk', supplierAuth, (req, res) => {
    if (!req.actor.staffId) return res.status(403).json({ error: 'Alleen voor persoonlijke logins.' });
    const r = payroll.zetOpenVoorWerk(req.supplier.code, req.actor.staffId, !!req.body.aan, schoon(req.body.wens, 120));
    logActivity(req.supplier.code, req.actor, 'zette "open voor werk" ' + (req.body.aan ? 'aan' : 'uit'));
    res.json(r);
  });

};
