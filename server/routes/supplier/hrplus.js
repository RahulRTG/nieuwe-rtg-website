/* Supplier-submodule "hrplus": de volle HR-kamer van elke zaak --
   inwerktrajecten (dag 1 / week 1 / maand 1), groeigesprekken,
   certificaten & bevoegdheden met verloopbewaking, en dienstjaren.
   Privacy: een groeigesprek is alleen leesbaar voor management en de
   medewerker zelf; er zijn bewust geen scores of ranglijsten. */
module.exports = (kern) => {
  const { app, db, save, supplierAuth, managerOnly, accounts, logActivity, sseToSupplier, crypto } = kern;

  const bak = (naam, code) => {
    if (!db.data[naam]) db.data[naam] = {};
    if (!db.data[naam][code]) db.data[naam][code] = [];
    return db.data[naam][code];
  };
  const rid = () => crypto.randomBytes(4).toString('hex');
  const txt = (v, n) => String(v == null ? '' : v).trim().slice(0, n);
  const INWERK = [
    ['dag1', 'Welkom, rondleiding en kennismaking met het team'],
    ['dag1', 'PDA en kassacode werken; eigen pincode gezet'],
    ['dag1', 'Huisregels, veiligheid en allergenenkaart doorgenomen'],
    ['week1', 'Meegelopen met een ervaren collega'],
    ['week1', 'Eigen taken een dienst lang zelfstandig gedraaid'],
    ['maand1', 'Eerste groeigesprek ingepland'],
    ['maand1', 'Alle systemen zelfstandig in gebruik']
  ];

  const magZien = (req, staffId) => req.actor.manager || Number(req.actor.staffId) === Number(staffId);

  function dienst(code) {
    const nu = Date.now();
    return accounts.listStaff(code).map(s => {
      const start = Date.parse(s.created_at);
      if (!Number.isFinite(start)) return null;
      const dagen = Math.max(0, Math.floor((nu - start) / 86400000));
      const jaren = Math.floor(dagen / 365);
      const volgend = new Date(start); volgend.setFullYear(volgend.getFullYear() + jaren + 1);
      return { staffId: s.id, name: s.name, func: s.func || null, sinds: s.created_at.slice(0, 10), dagen, jaren, volgendJubileum: volgend.toISOString().slice(0, 10) };
    }).filter(Boolean);
  }

  function verlopend(code) {
    const grens = Date.now() + 60 * 86400000;
    return bak('certificaten', code).filter(c => c.verlooptOp && Date.parse(c.verlooptOp) <= grens)
      .map(c => ({ id: c.id, name: c.name, soort: c.soort, verlooptOp: c.verlooptOp, verlopen: Date.parse(c.verlooptOp) < Date.now() }));
  }

  app.post('/api/supplier/hr/overzicht', supplierAuth, (req, res) => {
    if (!managerOnly(req, res)) return;
    const code = req.supplier.code;
    res.json({ ok: true, inwerk: bak('inwerk', code), gesprekken: bak('groeigesprekken', code),
      certificaten: bak('certificaten', code), dienst: dienst(code), verlopend: verlopend(code) });
  });

  app.post('/api/supplier/hr/inwerk/start', supplierAuth, (req, res) => {
    if (!managerOnly(req, res)) return;
    const st = accounts.getStaffById(Number(req.body.staffId));
    if (!st || String(st.supplier_code).toUpperCase() !== req.supplier.code) return res.status(404).json({ error: 'Teamlid niet gevonden.' });
    const lijst = bak('inwerk', req.supplier.code);
    if (lijst.some(t => t.staffId === st.id && !t.klaarOp)) return res.status(409).json({ error: 'Er loopt al een inwerktraject.' });
    const traject = { id: rid(), staffId: st.id, name: st.name, gestart: new Date().toISOString(),
      stappen: INWERK.map(([fase, tekst]) => ({ id: rid(), fase, tekst, klaar: false })), klaarOp: null };
    lijst.push(traject);
    save();
    logActivity(req.supplier.code, req.actor, 'startte het inwerktraject van ' + st.name);
    sseToSupplier(req.supplier.code, 'sync', { scope: 'hr' });
    res.json({ ok: true, traject });
  });

  app.post('/api/supplier/hr/inwerk/stap', supplierAuth, (req, res) => {
    if (!managerOnly(req, res)) return;
    const t = bak('inwerk', req.supplier.code).find(x => x.id === req.body.trajectId);
    if (!t) return res.status(404).json({ error: 'Traject niet gevonden.' });
    const tekst = txt(req.body.tekst, 120);
    const fase = ['dag1', 'week1', 'maand1'].includes(req.body.fase) ? req.body.fase : 'week1';
    if (!tekst) return res.status(400).json({ error: 'Geef de stap een tekst.' });
    t.stappen.push({ id: rid(), fase, tekst, klaar: false });
    t.klaarOp = null;
    save();
    sseToSupplier(req.supplier.code, 'sync', { scope: 'hr' });
    res.json({ ok: true, traject: t });
  });

  app.post('/api/supplier/hr/inwerk/vink', supplierAuth, (req, res) => {
    const t = bak('inwerk', req.supplier.code).find(x => x.id === req.body.trajectId);
    if (!t) return res.status(404).json({ error: 'Traject niet gevonden.' });
    if (!magZien(req, t.staffId)) return res.status(403).json({ error: 'Alleen management of de medewerker zelf.' });
    const s = t.stappen.find(x => x.id === req.body.stapId);
    if (!s) return res.status(404).json({ error: 'Stap niet gevonden.' });
    s.klaar = !s.klaar;
    s.klaarOp = s.klaar ? new Date().toISOString() : null;
    s.door = req.actor.name;
    t.klaarOp = t.stappen.every(x => x.klaar) ? new Date().toISOString() : null;
    save();
    sseToSupplier(req.supplier.code, 'sync', { scope: 'hr' });
    res.json({ ok: true, traject: t });
  });

  app.post('/api/supplier/hr/gesprek', supplierAuth, (req, res) => {
    if (!managerOnly(req, res)) return;
    const st = accounts.getStaffById(Number(req.body.staffId));
    if (!st || String(st.supplier_code).toUpperCase() !== req.supplier.code) return res.status(404).json({ error: 'Teamlid niet gevonden.' });
    const g = { id: rid(), staffId: st.id, name: st.name, datum: txt(req.body.datum, 10) || new Date().toISOString().slice(0, 10),
      onderwerp: txt(req.body.onderwerp, 80) || 'Groeigesprek', verslag: txt(req.body.verslag, 2000),
      afspraken: txt(req.body.afspraken, 600), door: req.actor.name, at: new Date().toISOString() };
    bak('groeigesprekken', req.supplier.code).push(g);
    save();
    logActivity(req.supplier.code, req.actor, 'legde een groeigesprek vast met ' + st.name);
    sseToSupplier(req.supplier.code, 'sync', { scope: 'hr' });
    res.json({ ok: true, gesprek: g });
  });

  app.post('/api/supplier/hr/gesprekken', supplierAuth, (req, res) => {
    const alles = bak('groeigesprekken', req.supplier.code);
    if (req.actor.manager) {
      const sid = req.body.staffId == null ? null : Number(req.body.staffId);
      return res.json({ ok: true, gesprekken: sid == null ? alles : alles.filter(g => g.staffId === sid) });
    }
    res.json({ ok: true, gesprekken: alles.filter(g => Number(g.staffId) === Number(req.actor.staffId)) });
  });

  app.post('/api/supplier/hr/certificaat', supplierAuth, (req, res) => {
    if (!managerOnly(req, res)) return;
    const st = accounts.getStaffById(Number(req.body.staffId));
    if (!st || String(st.supplier_code).toUpperCase() !== req.supplier.code) return res.status(404).json({ error: 'Teamlid niet gevonden.' });
    const soort = txt(req.body.soort, 60);
    if (!soort) return res.status(400).json({ error: 'Geef het certificaat een naam (bijv. EHBO of BHV).' });
    const c = { id: rid(), staffId: st.id, name: st.name, soort, behaaldOp: txt(req.body.behaaldOp, 10) || null,
      verlooptOp: txt(req.body.verlooptOp, 10) || null, door: req.actor.name, at: new Date().toISOString() };
    bak('certificaten', req.supplier.code).push(c);
    save();
    sseToSupplier(req.supplier.code, 'sync', { scope: 'hr' });
    res.json({ ok: true, certificaat: c });
  });

  app.post('/api/supplier/hr/certificaat/weg', supplierAuth, (req, res) => {
    if (!managerOnly(req, res)) return;
    const lijst = bak('certificaten', req.supplier.code);
    const i = lijst.findIndex(c => c.id === req.body.id);
    if (i < 0) return res.status(404).json({ error: 'Certificaat niet gevonden.' });
    lijst.splice(i, 1);
    save();
    sseToSupplier(req.supplier.code, 'sync', { scope: 'hr' });
    res.json({ ok: true });
  });

  app.post('/api/supplier/hr/mijn', supplierAuth, (req, res) => {
    const sid = Number(req.actor.staffId);
    if (!Number.isFinite(sid)) return res.status(400).json({ error: 'Alleen voor ingelogde medewerkers.' });
    const code = req.supplier.code;
    res.json({ ok: true,
      inwerk: bak('inwerk', code).filter(t => t.staffId === sid),
      gesprekken: bak('groeigesprekken', code).filter(g => g.staffId === sid),
      certificaten: bak('certificaten', code).filter(c => c.staffId === sid) });
  });

};
