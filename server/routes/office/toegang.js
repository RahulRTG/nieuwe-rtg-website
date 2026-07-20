/* Backoffice (deelmodule): inloggen, het beveiligingslog, de tijdlijn, export, de live-stream en de status.
   Draait op de gedeelde kern; gemount vanuit routes/office.js. */
module.exports = (octx) => {
  const { kern, officeQueryMag } = octx;
  const { OFFICE_CODE, UPLOAD_DIR, accounts, app, appUrl, archief, broadcastSync, conciergeInbox, crypto, db, eigenaar, ensureSupplierDefaults, fs, loginFails, mail, makeSupplierCode, noteFailedTry, notify, notifySupplier, officeAuth, officeState, path, talen, trChat, pendingVerifications, rememberSession, save, schoon, sessionFor, sseClients, sseToOffice, sseToSupplier, tooManyTries, totpOk, veiligGelijk, logInlog, paspoortIncidenten, paspoortBeoordeel, salonProfielCompleet, salonItemsVan, ontmoetKantoorState, ontmoetSosAf, ontmoetSignaalLid } = kern;
app.post('/api/office/login', (req, res) => {
  const bucket = 'office:' + req.ip;
  if (tooManyTries(res, bucket)) return;
  // tijd-veilig vergeleken: de reactietijd verraadt niets over de code
  if (!veiligGelijk(String(req.body.code || '').trim().toUpperCase(), OFFICE_CODE)) {
    noteFailedTry(bucket);
    logInlog('office', false, null, req);
    return res.status(401).json({ error: 'Onjuiste backoffice-code.' });
  }
  /* de tweede factor (TOTP, zoals bij de bank): staat OFFICE_TOTP_SECRET in
     de omgeving, dan is de code alleen niet genoeg; er moet ook een geldige
     zescijferige authenticator-code bij */
  if (process.env.OFFICE_TOTP_SECRET && !totpOk(process.env.OFFICE_TOTP_SECRET, req.body.totp)) {
    noteFailedTry(bucket);
    logInlog('office-2fa', false, null, req);
    return res.status(401).json({ error: 'Tweede factor vereist: voer de zescijferige code uit uw authenticator-app in.' });
  }
  loginFails.delete(bucket);
  logInlog('office', true, 'backoffice', req);
  const token = crypto.randomBytes(24).toString('hex');
  rememberSession(token, { role: 'office' });
  res.json({ token, state: officeState() });
});

/* het inlog-auditlog: elke poging op elk kanaal, alleen voor het kantoor */
app.post('/api/office/securitylog', officeAuth, (req, res) => {
  res.json({ log: (db.data.securityLog || []).slice(0, 200) });
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
      .filter(b => b.status !== 'wacht-op-betaling' && past([b.supplierName, b.customerCodename, b.ref, (b.service && b.service.name) || b.kind || '', b.status].join(' ')))
      .map(b => ({ soort: 'dienst', at: b.at, ref: b.ref, supplierName: b.supplierName, customerCodename: b.customerCodename,
        status: b.status, paid: !!b.paid, bedrag: b.price || 0, sub: (b.service && b.service.name) || b.kind || 'Boeking', when: b.wanneer || null })));
  alles.sort((a, b) => String(b.at).localeCompare(String(a.at)));
  const per = 25;
  const pages = Math.max(1, Math.ceil(alles.length / per));
  const page = Math.min(pages, Math.max(1, Number(req.body.page) || 1));
  res.json({ items: alles.slice((page - 1) * per, page * per), total: alles.length, page, pages });
});

/* Bewust POST met het token in de Authorization-header (zelfde les als de
   bank-export): een token in een GET-querystring lekt via logs, proxies en de
   browsergeschiedenis. De backoffice downloadt via fetch + blob. */
app.post('/api/office/export.csv', officeAuth, (req, res) => {
  const esc = require('../../kern/factuur').csvCel; // csv-veilig + geen formule-injectie
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="rtg-backoffice-' + new Date().toISOString().slice(0, 10) + '.csv"');
  res.write('\uFEFF' + ['datum', 'soort', 'partner', 'gast', 'omschrijving', 'status', 'betaald', 'bedrag'].join(';') + '\n');
  // de boekhouding blijft compleet: gearchiveerde tickets (oudste eerst) tellen mee
  for (const o of archief.leesAlles()) {
    res.write([String(o.at).slice(0, 16).replace('T', ' '), 'bestelling', o.supplierName, o.customerCodename,
      (o.items || []).map(i => i.qty + 'x ' + i.name).join(', '), o.status, o.paid ? 'ja' : 'nee',
      (o.total || 0).toFixed(2).replace('.', ',')].map(esc).join(';') + '\n');
  }
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
  if (!officeQueryMag(req.query.token)) return res.status(401).end();
  res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', 'Connection': 'keep-alive' });
  res.write('retry: 3000\n\n');
  const client = { office: true, res };
  sseClients.push(client);
  const ping = setInterval(() => res.write(': ping\n\n'), 25000);
  req.on('close', () => { clearInterval(ping); const i = sseClients.indexOf(client); if (i >= 0) sseClients.splice(i, 1); });
});

app.post('/api/office/state', officeAuth, (req, res) => res.json({ state: officeState() }));
};
