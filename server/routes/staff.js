/* Domein "staff" (aparte module op de gedeelde kern). Alleen de routes;
   de helpers blijven in de kern (server.js) en komen via het kern-object binnen. */
module.exports = (kern) => {
  const { DEMO, accounts, app, checkCred, crypto, db, findStaffPartner, hasCred, klokVan, logActivity, managerOnly, notifySupplier, publicPartner, save, schoon, sseClients, sseSend, sseToOffice, sseToSupplier, supplierAuth, trustVan,
    fluisterZeg, fluisterVergeet, fluisterFocus, fluisterProfiel } = kern;

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

/* Videobellen op de werkvloer (WebRTC). De server geeft alleen signalen door
   (bel, aannemen, offer/answer/ice); het beeld en geluid lopen rechtstreeks
   tussen de toestellen (peer-to-peer). 1-op-1 belt op staffId en alleen wie
   is ingeklokt is bereikbaar; de teamcall is een groepsgesprek per zaak
   (kamer "team"), waarin ieder toestel rechtstreeks met de anderen verbindt
   (mesh) tot de kamergrens van 100 deelnemers. */
app.post('/api/staff/call', supplierAuth, (req, res) => {
  if (!req.actor.staffId) return res.status(403).json({ error: 'Alleen met een persoonlijke login.' });
  const kind = String(req.body.kind || '');
  if (!['ring', 'accept', 'decline', 'offer', 'answer', 'ice', 'hangup', 'join', 'leave'].includes(kind))
    return res.status(400).json({ error: 'Onbekend signaal.' });
  const naar = req.body.staffId != null && req.body.staffId !== '' ? parseInt(req.body.staffId, 10) : null;
  if (kind === 'ring') {
    if (!naar || naar === req.actor.staffId) return res.status(400).json({ error: 'Kies een collega.' });
    const lijst = db.data.klok[req.supplier.code] || [];
    if (!lijst.find(e => e.staffId === naar && !e.out)) return res.status(409).json({ error: 'Deze collega is niet ingeklokt en dus niet bereikbaar.' });
    logActivity(req.supplier.code, req.actor, 'belde een ingeklokte collega (video)');
  }
  sseToSupplier(req.supplier.code, 'rtc', {
    kind, van: req.actor.staffId, vanNaam: req.actor.name, naar,
    video: req.body.video !== false, payload: req.body.payload || null,
    kamer: String(req.body.kamer || '') || null
  });
  res.json({ ok: true });
});

/* Collega tegen collega: een direct chatbericht, van toestel naar toestel.
   De lijst toont wie er ingeklokt en online is; het gesprek zelf blijft
   tussen de twee collega's en komt bewust niet in het activiteitenlog. */
const dmSleutel = (a, b) => (a < b ? a + '-' + b : b + '-' + a);
const dmVan = (code, a, b) => {
  const zaak = db.data.collegaChats[code] = db.data.collegaChats[code] || {};
  const key = dmSleutel(a, b);
  zaak[key] = zaak[key] || { messages: [], unread: {}, lastAt: null };
  return zaak[key];
};
const dmCollega = (req, res) => {
  const ander = parseInt(req.body.staffId, 10);
  const st = Number.isFinite(ander) ? accounts.getStaffById(ander) : null;
  if (!st || String(st.supplier_code).toUpperCase() !== req.supplier.code || ander === req.actor.staffId) {
    res.status(404).json({ error: 'Collega niet gevonden.' });
    return null;
  }
  return st;
};

app.post('/api/staff/dm/lijst', supplierAuth, (req, res) => {
  if (!req.actor.staffId) return res.status(403).json({ error: 'Alleen met een persoonlijke login.' });
  const klok = db.data.klok[req.supplier.code] || [];
  const zaak = db.data.collegaChats[req.supplier.code] || {};
  const online = new Set(sseClients.filter(c => c.sup === req.supplier.code && c.staffId != null).map(c => c.staffId));
  const collegas = accounts.listStaff(req.supplier.code).map(accounts.publicStaff)
    .filter(m => m.id !== req.actor.staffId)
    .map(m => {
      const t = zaak[dmSleutel(req.actor.staffId, m.id)];
      return {
        id: m.id, name: m.name, func: m.func || '', role: m.role,
        binnen: !!klok.find(e => e.staffId === m.id && !e.out),
        online: online.has(m.id),
        ongelezen: t ? (t.unread[req.actor.staffId] || 0) : 0,
        laatste: t && t.messages.length ? t.messages[t.messages.length - 1].text.slice(0, 60) : ''
      };
    });
  res.json({ ok: true, collegas });
});

app.post('/api/staff/dm/history', supplierAuth, (req, res) => {
  if (!req.actor.staffId) return res.status(403).json({ error: 'Alleen met een persoonlijke login.' });
  const st = dmCollega(req, res);
  if (!st) return;
  const t = dmVan(req.supplier.code, req.actor.staffId, st.id);
  if (t.unread[req.actor.staffId]) { t.unread[req.actor.staffId] = 0; save(); }
  res.json({ ok: true, metWie: st.name, messages: t.messages.slice(-100) });
});

app.post('/api/staff/dm/send', supplierAuth, (req, res) => {
  if (!req.actor.staffId) return res.status(403).json({ error: 'Alleen met een persoonlijke login.' });
  const st = dmCollega(req, res);
  if (!st) return;
  const text = schoon(req.body.text, 500);
  if (!text) return res.status(400).json({ error: 'Leeg bericht.' });
  const t = dmVan(req.supplier.code, req.actor.staffId, st.id);
  t.messages.push({ van: req.actor.staffId, naam: req.actor.name, text, at: new Date().toISOString() });
  t.messages = t.messages.slice(-200);
  t.unread[st.id] = (t.unread[st.id] || 0) + 1;
  t.lastAt = new Date().toISOString();
  save();
  // alleen het toestel van de ontvanger krijgt het signaal (geen omroep)
  let bezorgd = 0;
  for (const c of sseClients) {
    if (c.sup === req.supplier.code && c.staffId === st.id) { sseSend(c.res, 'dm', { vanId: req.actor.staffId, van: req.actor.name, text }); bezorgd++; }
  }
  res.json({ ok: true, bezorgd, messages: t.messages.slice(-100) });
});

/* Fluister voor de vloer: dezelfde persoonlijke assistent, met een eigen
   geheugen per personeelslid (nooit gedeeld met de werkgever). */
const staffKey = req => 'staff:' + req.supplier.code + ':' + req.actor.staffId;
app.post('/api/staff/fluister', supplierAuth, async (req, res) => {
  if (!req.actor.staffId) return res.status(403).json({ error: 'Alleen met een persoonlijke login.' });
  const r = await fluisterZeg(staffKey(req), req.actor.name, req.body.q);
  if (r.error) return res.status(r.status).json({ error: r.error });
  res.json(r);
});
app.post('/api/staff/fluister/profiel', supplierAuth, (req, res) => {
  if (!req.actor.staffId) return res.status(403).json({ error: 'Alleen met een persoonlijke login.' });
  res.json(fluisterProfiel(staffKey(req)));
});
app.post('/api/staff/fluister/vergeet', supplierAuth, (req, res) => {
  if (!req.actor.staffId) return res.status(403).json({ error: 'Alleen met een persoonlijke login.' });
  const r = fluisterVergeet(staffKey(req), req.body.wat);
  if (r.error) return res.status(r.status).json({ error: r.error });
  res.json(r);
});
app.post('/api/staff/fluister/focus', supplierAuth, (req, res) => {
  if (!req.actor.staffId) return res.status(403).json({ error: 'Alleen met een persoonlijke login.' });
  res.json(fluisterFocus(staffKey(req), req.body.scores));
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
