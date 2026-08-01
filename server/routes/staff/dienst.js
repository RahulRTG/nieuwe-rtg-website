/* Staff (deelmodule): de dienstlaag: Fluister voor de vloer (eigen geheugen
   per personeelslid), in- en uitklokken, het eigen overzicht, verlof en
   ziekmelden en de vertrouwenspersoon. Krijgt de gedeelde context een keer
   bij het opstarten vanuit routes/staff.js. */
module.exports = (actx) => {
  const { DEMO, accounts, app, checkCred, crypto, db, findStaffPartner, hasCred, klokVan, logActivity, managerOnly, notifySupplier, publicPartner, save, schoon, sseClients, sseSend, sseToOffice, sseToSupplier, supplierAuth, trustVan,
    fluisterZeg, fluisterVergeet, fluisterFocus, fluisterProfiel, stuurLus,
    werkbeleidPauzeStand, WERKBELEID_PAUZE_MINUTEN } = actx;
/* Fluister voor de vloer staat in ./dienst-fluister.js: dat stuk praat met een
   modelaanbieder en de rest van deze laag niet, dus de vraag wat er naar buiten
   gaat hoort daar bij elkaar. */
require('./dienst-fluister')({ app, accounts, supplierAuth, fluisterZeg, fluisterVergeet, fluisterFocus, fluisterProfiel, stuurLus });

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

/* PAUZE. Zolang je ingeklokt staat houdt het werkbeleid van je werkgever
   functies dicht (kern/lidboard/werkbeleid.js). In je pauze niet: dan is je
   pas weer van jou. De armslag is 45 minuten per dienst, samen voor alle
   pauzes -- de rookpauze en de grote pauze komen uit dezelfde pot.

   Wat hier NIET gebeurt: meten wat je in die minuten doet. De teller loopt op
   pauzeminuten, punt. Zou hij op je gebruik van De Salon lopen, dan hield dit
   systeem precies bij hoeveel minuten je op sociale media zat, en dat is de
   meting waar dat hele beleid tegen beschermt.

   Pauze nemen mag altijd, ook als de 45 minuten op zijn: je pauzerecht is niet
   van RTG. Wat er dan gebeurt is alleen dat het beleid weer geldt. */
app.post('/api/staff/pauze', supplierAuth, (req, res) => {
  if (!req.actor.staffId) return res.status(403).json({ error: 'Alleen met een persoonlijke login.' });
  const lijst = db.data.klok[req.supplier.code] = db.data.klok[req.supplier.code] || [];
  const dienst = Array.isArray(lijst) ? lijst.find(e => e.staffId === req.actor.staffId && e.in && !e.out) : null;
  if (!dienst) return res.status(409).json({ error: 'Je staat niet ingeklokt; een pauze hoort bij een dienst.' });
  dienst.pauzes = dienst.pauzes || [];
  const open = dienst.pauzes.find(p => p && p.in && !p.uit);
  let actie;
  if (open) { open.uit = new Date().toISOString(); actie = 'uit'; }
  else { dienst.pauzes.push({ in: new Date().toISOString(), uit: null }); actie = 'in'; }
  save();
  sseToSupplier(req.supplier.code, 'sync', { scope: 'klok' });
  const stand = werkbeleidPauzeStand(req.supplier.code, req.actor.staffId);
  res.json({ ok: true, actie, pauze: stand, budgetMinuten: WERKBELEID_PAUZE_MINUTEN });
});

app.post('/api/staff/mine', supplierAuth, (req, res) => {
  if (!req.actor.staffId) return res.status(403).json({ error: 'Alleen met een persoonlijke login.' });
  res.json({
    klok: klokVan(req.supplier.code, req.actor.staffId),
    verlof: (db.data.verlof[req.supplier.code] || []).filter(v => v.staffId === req.actor.staffId).slice(0, 10),
    pauze: werkbeleidPauzeStand(req.supplier.code, req.actor.staffId),
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
    notifySupplier(req.supplier.code, { icon: 'zorg', title: 'Ziekmelding', body: req.actor.name + ' heeft zich ziek gemeld. Denk aan de bezetting van vandaag.' });
  } else {
    logActivity(req.supplier.code, req.actor, 'vroeg verlof aan (' + entry.van + ' t/m ' + entry.tot + ')');
    notifySupplier(req.supplier.code, { icon: 'parasol', title: 'Verlofaanvraag', body: req.actor.name + ': ' + entry.van + ' t/m ' + entry.tot + (entry.reden ? ' · ' + entry.reden : '') });
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

};
