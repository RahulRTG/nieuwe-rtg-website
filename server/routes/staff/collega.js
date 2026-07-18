/* Staff (deelmodule): de collegalaag: het urenoverzicht voor de zaak, de
   oproepen (buzz/walkie) en de onderlinge collega-DM's. Krijgt de gedeelde
   context een keer bij het opstarten vanuit routes/staff.js. */
module.exports = (actx) => {
  const { DEMO, accounts, app, checkCred, crypto, db, findStaffPartner, hasCred, klokVan, logActivity, managerOnly, notifySupplier, publicPartner, save, schoon, sseClients, sseSend, sseToOffice, sseToSupplier, supplierAuth, trustVan,
    fluisterZeg, fluisterVergeet, fluisterFocus, fluisterProfiel } = actx;
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

};
