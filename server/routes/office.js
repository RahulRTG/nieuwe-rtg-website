/* Domein "office" (aparte module op de gedeelde kern). Alleen de routes;
   de helpers blijven in de kern (server.js) en komen via het kern-object binnen. */
module.exports = (kern) => {
  const { OFFICE_CODE, UPLOAD_DIR, accounts, app, appUrl, broadcastSync, conciergeInbox, crypto, db, ensureSupplierDefaults, fs, loginFails, mail, makeSupplierCode, noteFailedTry, notify, notifySupplier, officeAuth, officeState, path, pendingVerifications, rememberSession, save, schoon, sessionFor, sseClients, sseToOffice, sseToSupplier, tooManyTries } = kern;

app.post('/api/office/partner/decide', officeAuth, (req, res) => {
  const a = db.data.partnerApplications.find(x => x.id === req.body.id);
  if (!a) return res.status(404).json({ error: 'Aanvraag niet gevonden.' });
  if (a.status !== 'nieuw') return res.status(409).json({ error: 'Deze aanvraag is al behandeld.' });
  if (req.body.action === 'goedkeuren') {
    const code = makeSupplierCode(a.company);
    const s = { code, name: a.company, type: a.type, city: a.city, loc: null, rate: 0.12, menu: [] };
    ensureSupplierDefaults(s);
    db.data.suppliers.push(s);
    const pin = accounts.makePin();
    accounts.createStaff({ supplierCode: code, name: a.contactName, role: 'manager', func: 'Beheer', pin });
    a.status = 'goedgekeurd'; a.code = code;
    save();
    const url = appUrl(req);
    mail.send(a.email, 'Welkom als partner van Rahul Travel Group',
      'Beste ' + a.contactName + ',\n\n' + a.company + ' is goedgekeurd als RTG-partner.\n\n' +
      'Uw leverancierscode: ' + code + '\nUw manager-PIN: ' + pin + ' (op naam van ' + a.contactName + ')\n\n' +
      'Open de partner-app op ' + url + '/apps/partners.html, kies uw bedrijf via de code, ' +
      'log in als management met uw PIN en stel uw pagina, menukaart en team in.\n\n' +
      'Uw bedrijfsaccount op De Salon is direct aangemaakt; dit is een vast onderdeel van elk RTG-partnerschap. ' +
      'Via Kantoor, Marketing stelt u uw profiel in, plaatst u berichten, aanbiedingen en polls, en ziet u uw volgers en cijfers.\n\nRahul Travel Group');
    sseToOffice('sync', { scope: 'team' });
    return res.json({ ok: true, code, pin });
  }
  a.status = 'afgewezen';
  save();
  mail.send(a.email, 'Uw partner-aanvraag bij Rahul Travel Group',
    'Beste ' + a.contactName + ',\n\nNa beoordeling kunnen we ' + a.company + ' op dit moment helaas geen partnerplek aanbieden.\n\nRahul Travel Group');
  sseToOffice('sync', { scope: 'team' });
  res.json({ ok: true });
});

app.post('/api/office/trust', officeAuth, (req, res) => {
  res.json({ threads: db.data.trustLine.slice(0, 40).map(t => ({
    id: t.id, company: t.company, anon: t.anon,
    name: t.anon ? 'Anoniem' : t.name,
    open: t.open, lastAt: t.lastAt,
    messages: t.messages.slice(-30)
  })) });
});

app.post('/api/office/trust/reply', officeAuth, (req, res) => {
  const t = db.data.trustLine.find(x => x.id === req.body.id);
  if (!t) return res.status(404).json({ error: 'Gesprek niet gevonden.' });
  const text = schoon(req.body.text, 800);
  if (!text) return res.status(400).json({ error: 'Leeg bericht.' });
  t.messages.push({ from: 'rtg', text, at: new Date().toISOString() });
  t.messages = t.messages.slice(-60);
  t.open = false;
  t.lastAt = new Date().toISOString();
  save();
  // alleen een seintje om te verversen; de inhoud gaat uitsluitend via de persoonlijke login
  sseToSupplier(t.code, 'sync', { scope: 'trust' });
  res.json({ ok: true });
});

app.post('/api/office/login', (req, res) => {
  const bucket = 'office:' + req.ip;
  if (tooManyTries(res, bucket)) return;
  if (String(req.body.code || '').trim().toUpperCase() !== OFFICE_CODE) {
    noteFailedTry(bucket);
    return res.status(401).json({ error: 'Onjuiste backoffice-code.' });
  }
  loginFails.delete(bucket);
  const token = crypto.randomBytes(24).toString('hex');
  rememberSession(token, { role: 'office' });
  res.json({ token, state: officeState() });
});

app.post('/api/office/timeline', officeAuth, (req, res) => {
  const q = String(req.body.q || '').trim().toLowerCase().slice(0, 60);
  const past = tekst => !q || tekst.toLowerCase().includes(q);
  const alles = db.data.orders
    .filter(o => o.status !== 'wacht-op-betaling' && past([o.supplierName, o.customerCodename, o.ref, o.status].join(' ')))
    .map(o => ({ soort: 'order', at: o.at, ref: o.ref, supplierName: o.supplierName, customerCodename: o.customerCodename,
      status: o.status, paid: !!o.paid, bedrag: o.total || 0, sub: o.items.reduce((n, i) => n + i.qty, 0) + ' item(s)' }))
    .concat(db.data.rides
      .filter(r => r.status !== 'wacht-op-betaling' && past([r.supplierName, r.customerCodename, r.ref, r.from, r.to, r.status].join(' ')))
      .map(r => ({ soort: r.type === 'jet' ? 'jet' : 'taxi', at: r.at, ref: r.ref, supplierName: r.supplierName, customerCodename: r.customerCodename,
        status: r.status, paid: !!r.paid, bedrag: r.quote || 0, sub: (r.from || '') + ' → ' + (r.to || '?'), when: r.plannedFor ? r.when : null })))
    .concat(db.data.boekingen
      .filter(b => b.status !== 'wacht-op-betaling' && past([b.supplierName, b.customerCodename, b.ref, b.service.name, b.status].join(' ')))
      .map(b => ({ soort: 'dienst', at: b.at, ref: b.ref, supplierName: b.supplierName, customerCodename: b.customerCodename,
        status: b.status, paid: !!b.paid, bedrag: b.price || 0, sub: b.service.name, when: b.wanneer || null })));
  alles.sort((a, b) => String(b.at).localeCompare(String(a.at)));
  const per = 25;
  const pages = Math.max(1, Math.ceil(alles.length / per));
  const page = Math.min(pages, Math.max(1, Number(req.body.page) || 1));
  res.json({ items: alles.slice((page - 1) * per, page * per), total: alles.length, page, pages });
});

app.get('/api/office/export.csv', (req, res) => {
  const sess = sessionFor(String(req.query.token || ''));
  if (!sess || sess.role !== 'office') return res.status(401).end();
  const esc = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="rtg-backoffice-' + new Date().toISOString().slice(0, 10) + '.csv"');
  res.write('\uFEFF' + ['datum', 'soort', 'partner', 'gast', 'omschrijving', 'status', 'betaald', 'bedrag'].join(';') + '\n');
  for (const o of db.data.orders) {
    if (o.status === 'wacht-op-betaling') continue;
    res.write([String(o.at).slice(0, 16).replace('T', ' '), 'bestelling', o.supplierName, o.customerCodename,
      o.items.map(i => i.qty + 'x ' + i.name).join(', '), o.status, o.paid ? 'ja' : 'nee',
      (o.total || 0).toFixed(2).replace('.', ',')].map(esc).join(';') + '\n');
  }
  for (const r of db.data.rides) {
    if (r.status === 'wacht-op-betaling') continue;
    res.write([String(r.at).slice(0, 16).replace('T', ' '), r.type === 'jet' ? 'jetrit' : 'taxirit', r.supplierName, r.customerCodename,
      (r.from || '') + ' naar ' + (r.to || '?'), r.status, r.paid ? 'ja' : 'nee',
      (r.quote || 0).toFixed(2).replace('.', ',')].map(esc).join(';') + '\n');
  }
  for (const b of db.data.boekingen) {
    if (b.status === 'wacht-op-betaling') continue;
    res.write([String(b.at).slice(0, 16).replace('T', ' '), 'boeking', b.supplierName, b.customerCodename,
      b.service.name + (b.wanneer ? ' (' + b.wanneer + ')' : ''), b.status, b.paid ? 'ja' : 'nee',
      (b.price || 0).toFixed(2).replace('.', ',')].map(esc).join(';') + '\n');
  }
  res.end();
});

app.get('/api/office/stream', (req, res) => {
  const sess = sessionFor(req.query.token);
  if (!sess || sess.role !== 'office') return res.status(401).end();
  res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', 'Connection': 'keep-alive' });
  res.write('retry: 3000\n\n');
  const client = { office: true, res };
  sseClients.push(client);
  const ping = setInterval(() => res.write(': ping\n\n'), 25000);
  req.on('close', () => { clearInterval(ping); const i = sseClients.indexOf(client); if (i >= 0) sseClients.splice(i, 1); });
});

app.post('/api/office/state', officeAuth, (req, res) => res.json({ state: officeState() }));

app.post('/api/office/nudge', officeAuth, (req, res) => {
  const kind = req.body.kind === 'ride' ? 'ride' : 'order';
  const lijst = kind === 'ride' ? db.data.rides : db.data.orders;
  const x = lijst.find(i => i.ref === req.body.ref);
  if (!x) return res.status(404).json({ error: 'Niet gevonden.' });
  if (x.nudgedAt && Date.now() - new Date(x.nudgedAt) < 10 * 60000)
    return res.status(409).json({ error: 'Er is net al een herinnering gestuurd. Geef de zaak even de tijd.' });
  x.nudgedAt = new Date().toISOString();
  save();
  notifySupplier(x.supplierCode, { icon: '⏰', title: 'Herinnering van RTG',
    body: (kind === 'ride' ? 'Rit ' : 'Bestelling ') + x.ref + ' van ' + x.customerCodename + ' wacht nog op actie. Kunt u er even naar kijken?' });
  sseToSupplier(x.supplierCode, 'sync', { scope: 'orders' });
  sseToOffice('sync', { scope: 'orders' });
  res.json({ ok: true });
});

app.post('/api/office/briefing', officeAuth, (req, res) => {
  const en = req.body.lang === 'en';
  const st = officeState();
  const s = st.stats;
  const eurF = n => '€ ' + Number(n).toLocaleString(en ? 'en-US' : 'nl-NL');
  const zinnen = [];
  zinnen.push(en
    ? 'Today the partners processed ' + s.aantalVandaag + ' paid order(s) and ride(s) for ' + eurF(s.omzetVandaag) + ' in net revenue; this week stands at ' + eurF(s.omzetWeek) + '.'
    : 'Vandaag verwerkten de partners ' + s.aantalVandaag + ' betaalde bestelling(en) en rit(ten), goed voor ' + eurF(s.omzetVandaag) + ' nettomzet; de week staat op ' + eurF(s.omzetWeek) + '.');
  const top = (st.performance || []).find(p => p.omzet > 0);
  if (top) zinnen.push(en
    ? 'Best performing partner: ' + top.name + ' (' + eurF(top.omzet) + ', ' + top.aantal + ' transaction(s)).'
    : 'Best presterende partner: ' + top.name + ' (' + eurF(top.omzet) + ', ' + top.aantal + ' transactie(s)).');
  zinnen.push(en
    ? (s.liveNu ? s.liveNu + ' member(s) are on the move right now.' : 'No members are on the move at the moment.')
    : (s.liveNu ? s.liveNu + ' lid/leden zijn nu onderweg.' : 'Er is nu niemand onderweg.'));
  const rood = (st.alerts || []).filter(a => a.level === 'rood').length;
  const rest = (st.alerts || []).length - rood;
  if (rood) zinnen.push(en
    ? rood + ' item(s) are stuck and need immediate attention; see the action centre.'
    : rood + ' zaak/zaken lopen vast en vragen nu aandacht; zie het actiecentrum.');
  else if (rest) zinnen.push(en
    ? 'Nothing is stuck; ' + rest + ' routine item(s) are waiting in the action centre.'
    : 'Niets loopt vast; er wachten nog ' + rest + ' routinepunt(en) in het actiecentrum.');
  else zinnen.push(en ? 'The action centre is empty: everything is running smoothly.' : 'Het actiecentrum is leeg: alles loopt.');
  zinnen.push(en
    ? 'The RTFoundation received ' + eurF(s.foundation) + ' so far (30% of paid member contributions).'
    : 'De RTFoundation ontving tot nu toe ' + eurF(s.foundation) + ' (30% van de betaalde ledenbijdragen).');
  res.json({ briefing: zinnen.join(' ') });
});

app.post('/api/office/verifications', officeAuth, (req, res) => res.json({ pending: pendingVerifications() }));

app.post('/api/office/verify', officeAuth, (req, res) => {
  const user = accounts.getUserById(Number(req.body.userId));
  if (!user) return res.status(404).json({ error: 'Account niet gevonden.' });
  const status = req.body.decision === 'approve' ? 'verified' : 'rejected';
  accounts.setVerification(user.id, status);
  mail.send(accounts.emailOf(user), status === 'verified' ? 'Uw identiteit is geverifieerd' : 'Uw verificatie is afgewezen',
    'Beste ' + accounts.realNameOf(user) + ',\n\n' +
    (status === 'verified' ? 'Uw identiteit is geverifieerd. U kunt nu in een tik boeken.' :
     'We konden uw document niet goedkeuren. Probeer het opnieuw met een duidelijkere foto.') +
    '\n\nRahul Travel Group');
  notify(user.tier, { icon: status === 'verified' ? '✅' : '⚠',
    title: status === 'verified' ? 'Identiteit geverifieerd' : 'Verificatie afgewezen',
    body: status === 'verified' ? 'U kunt nu in één tik boeken.' : 'Probeer een duidelijkere foto van uw document.' });
  res.json({ ok: true, status, pending: pendingVerifications() });
});

app.get('/api/office/doc', (req, res) => {
  const sess = sessionFor(req.query.token);
  if (!sess || sess.role !== 'office') return res.status(401).end();
  const file = path.basename(String(req.query.file || '')); // geen padtraversal
  const full = path.join(UPLOAD_DIR, file);
  if (!file || !full.startsWith(UPLOAD_DIR) || !fs.existsSync(full)) return res.status(404).end();
  res.sendFile(full);
});

app.post('/api/office/conversations', officeAuth, (req, res) => res.json({ conversations: conciergeInbox() }));

app.post('/api/office/reply', officeAuth, (req, res) => {
  const u = accounts.getUserById(Number(req.body.userId));
  if (!u) return res.status(404).json({ error: 'Account niet gevonden.' });
  const text = String(req.body.text || '').trim();
  if (!text) return res.status(400).json({ error: 'Leeg bericht.' });
  const md = accounts.getMemberState(u.id) || {};
  md.conversation = md.conversation || [];
  md.conversation.push({ from: 'concierge', text: text.slice(0, 1000), at: new Date().toISOString(), channel: 'concierge' });
  md.needsConcierge = false;
  accounts.saveMemberState(u.id, md);
  broadcastSync([u.tier], 'chat');
  notify(u.tier, { icon: '💬', title: 'Uw concierge', body: text.slice(0, 80), scope: 'chat' });
  // In productie gaat dit antwoord ook via WhatsApp naar accounts.phoneOf(u).
  res.json({ ok: true, conversations: conciergeInbox() });
});
};
