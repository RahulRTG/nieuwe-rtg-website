/* Domein "staff" (aparte module op de gedeelde kern). Alleen de routes;
   de helpers blijven in de kern (server.js) en komen via het kern-object binnen. */
module.exports = (kern) => {
  const { DEMO, accounts, app, checkCred, crypto, db, findStaffPartner, hasCred, klokVan, logActivity, managerOnly, notifySupplier, publicPartner, save, schoon, sseToOffice, sseToSupplier, supplierAuth, trustVan } = kern;

/* Het urenoverzicht voor de zaak: wie is er nu binnen, wie werkte wanneer en
   hoelang (vandaag en deze week). Elke medewerker klokt via de PDA; het
   management ziet hier het complete beeld. */
app.post('/api/staff/klok/overzicht', supplierAuth, (req, res) => {
  if (!managerOnly(req, res)) return;
  const lijst = db.data.klok[req.supplier.code] || [];
  const rows = accounts.listStaff(req.supplier.code).map(accounts.publicStaff).map(m => {
    const mijn = lijst.filter(e => e.staffId === m.id);
    const laatste = mijn[0] || null;
    return {
      id: m.id, name: m.name, func: m.func || '', role: m.role,
      binnen: !!mijn.find(e => !e.out),
      laatsteIn: laatste ? laatste.in : null, laatsteUit: laatste ? laatste.out : null,
      ...klokVan(req.supplier.code, m.id)
    };
  });
  res.json({ ok: true, rows });
});

/* Collega's bellen: alleen wie is ingeklokt is bereikbaar. Het belsignaal
   loopt over het eigen kanaal van de zaak (SSE); het toestel van de collega
   rinkelt en neemt aan of wijst af. */
app.post('/api/staff/bel', supplierAuth, (req, res) => {
  if (!req.actor.staffId) return res.status(403).json({ error: 'Alleen met een persoonlijke login.' });
  const naar = parseInt(req.body.staffId, 10);
  if (!naar || naar === req.actor.staffId) return res.status(400).json({ error: 'Kies een collega.' });
  const lijst = db.data.klok[req.supplier.code] || [];
  if (!lijst.find(e => e.staffId === naar && !e.out)) return res.status(409).json({ error: 'Deze collega is niet ingeklokt en dus niet bereikbaar.' });
  sseToSupplier(req.supplier.code, 'bel', { van: req.actor.name, vanId: req.actor.staffId, naar });
  logActivity(req.supplier.code, req.actor, 'belde een ingeklokte collega');
  res.json({ ok: true });
});
app.post('/api/staff/bel/antwoord', supplierAuth, (req, res) => {
  if (!req.actor.staffId) return res.status(403).json({ error: 'Alleen met een persoonlijke login.' });
  sseToSupplier(req.supplier.code, 'bel-antwoord', { vanId: parseInt(req.body.vanId, 10), naam: req.actor.name, naarId: req.actor.staffId, akkoord: req.body.akkoord !== false });
  res.json({ ok: true });
});

app.post('/api/staff/clock', supplierAuth, (req, res) => {
  if (!req.actor.staffId) return res.status(403).json({ error: 'Alleen met een persoonlijke login.' });
  const lijst = db.data.klok[req.supplier.code] = db.data.klok[req.supplier.code] || [];
  const open = lijst.find(e => e.staffId === req.actor.staffId && !e.out);
  let actie;
  if (open) { open.out = new Date().toISOString(); actie = 'uit'; }
  else { lijst.unshift({ id: crypto.randomBytes(4).toString('hex'), staffId: req.actor.staffId, name: req.actor.name, in: new Date().toISOString(), out: null }); actie = 'in'; }
  db.data.klok[req.supplier.code] = lijst.slice(0, 4000);
  save();
  logActivity(req.supplier.code, req.actor, 'klokte ' + actie);
  sseToSupplier(req.supplier.code, 'sync', { scope: 'klok' });
  res.json({ ok: true, actie, klok: klokVan(req.supplier.code, req.actor.staffId) });
});

app.post('/api/staff/mine', supplierAuth, (req, res) => {
  if (!req.actor.staffId) return res.status(403).json({ error: 'Alleen met een persoonlijke login.' });
  res.json({
    klok: klokVan(req.supplier.code, req.actor.staffId),
    verlof: (db.data.verlof[req.supplier.code] || []).filter(v => v.staffId === req.actor.staffId).slice(0, 10),
    trust: trustVan(req.supplier.code, req.actor.staffId)
  });
});

app.post('/api/staff/leave/request', supplierAuth, (req, res) => {
  if (!req.actor.staffId) return res.status(403).json({ error: 'Alleen met een persoonlijke login.' });
  const soort = req.body.soort === 'ziek' ? 'ziek' : 'verlof';
  const van = schoon(req.body.van, 10), tot = schoon(req.body.tot, 10);
  const geldig = d => /^\d{4}-\d{2}-\d{2}$/.test(d);
  if (soort === 'verlof' && (!geldig(van) || !geldig(tot) || tot < van))
    return res.status(400).json({ error: 'Kies een geldige begin- en einddatum.' });
  const lijst = db.data.verlof[req.supplier.code] = db.data.verlof[req.supplier.code] || [];
  const entry = {
    id: crypto.randomBytes(4).toString('hex'),
    staffId: req.actor.staffId, name: req.actor.name, soort,
    van: soort === 'ziek' ? new Date().toISOString().slice(0, 10) : van,
    tot: soort === 'ziek' ? null : tot,
    reden: schoon(req.body.reden, 140),
    status: soort === 'ziek' ? 'gemeld' : 'nieuw',
    at: new Date().toISOString()
  };
  lijst.unshift(entry);
  db.data.verlof[req.supplier.code] = lijst.slice(0, 2000);
  save();
  if (soort === 'ziek') {
    logActivity(req.supplier.code, req.actor, 'meldde zich ziek');
    notifySupplier(req.supplier.code, { icon: '🤒', title: 'Ziekmelding', body: req.actor.name + ' heeft zich ziek gemeld. Denk aan de bezetting van vandaag.' });
  } else {
    logActivity(req.supplier.code, req.actor, 'vroeg verlof aan (' + entry.van + ' t/m ' + entry.tot + ')');
    notifySupplier(req.supplier.code, { icon: '🌴', title: 'Verlofaanvraag', body: req.actor.name + ': ' + entry.van + ' t/m ' + entry.tot + (entry.reden ? ' · ' + entry.reden : '') });
  }
  sseToSupplier(req.supplier.code, 'sync', { scope: 'verlof' });
  res.json({ ok: true, entry });
});

app.post('/api/staff/trust/send', supplierAuth, (req, res) => {
  if (!req.actor.staffId) return res.status(403).json({ error: 'Alleen met een persoonlijke login.' });
  const text = schoon(req.body.text, 800);
  if (!text) return res.status(400).json({ error: 'Leeg bericht.' });
  let t = db.data.trustLine.find(x => x.code === req.supplier.code && x.staffId === req.actor.staffId);
  if (!t) {
    t = { id: crypto.randomBytes(4).toString('hex'), code: req.supplier.code, company: req.supplier.name,
          staffId: req.actor.staffId, anon: !!req.body.anon, name: req.actor.name, messages: [], open: true, lastAt: null };
    db.data.trustLine.unshift(t);
    db.data.trustLine = db.data.trustLine.slice(0, 2000);
  }
  if (req.body.anon != null) t.anon = !!req.body.anon;
  t.messages.push({ from: 'staff', text, at: new Date().toISOString() });
  t.messages = t.messages.slice(-60);
  t.open = true;
  t.lastAt = new Date().toISOString();
  save();
  // bewust GEEN logActivity en GEEN notifySupplier: dit blijft buiten de werkgever om
  sseToOffice('sync', { scope: 'trust' });
  res.json({ ok: true, trust: trustVan(req.supplier.code, req.actor.staffId) });
});

app.post('/api/staff/trust/thread', supplierAuth, (req, res) => {
  if (!req.actor.staffId) return res.status(403).json({ error: 'Alleen met een persoonlijke login.' });
  res.json({ trust: trustVan(req.supplier.code, req.actor.staffId) });
});

app.post('/api/staff', (req, res) => {
  let partner;
  if (hasCred(req.body)) {
    if (!DEMO) return res.status(403).json({ error: 'Demo-inlog is uitgeschakeld. Gebruik uw personeelscode.' });
    if (!checkCred(req.body.username, req.body.password))
      return res.status(401).json({ error: 'Onjuiste gebruikersnaam of wachtwoord.' });
    partner = db.data.partners.find(p => p.staff) || null;
  } else {
    partner = findStaffPartner(req.body.staffCode);
  }
  if (!partner) return res.status(404).json({ error: 'Deze personeelscode kennen we niet.' });
  // De personeelscode gaat mee terug zodat de inlog verder werkt zoals de code-invoer.
  res.json({ ok: true, partner: publicPartner(partner), staffCode: partner.staff ? partner.staff.code : null });
});
};
