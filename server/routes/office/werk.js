/* Backoffice (deelmodule): nudge, dagbriefing, verificaties, incidenten, documenten en het conciergepostvak.
   Draait op de gedeelde kern; gemount vanuit routes/office.js. */
module.exports = (octx) => {
  const { kern, officeQueryMag } = octx;
  const { OFFICE_CODE, UPLOAD_DIR, accounts, app, appUrl, archief, broadcastSync, conciergeInbox, crypto, db, eigenaar, ensureSupplierDefaults, fs, loginFails, mail, makeSupplierCode, noteFailedTry, notify, notifySupplier, officeAuth, officeState, path, talen, trChat, pendingVerifications, rememberSession, save, schoon, sessionFor, sseClients, sseToOffice, sseToSupplier, tooManyTries, totpOk, veiligGelijk, logInlog, paspoortIncidenten, paspoortBeoordeel, salonProfielCompleet, salonItemsVan, ontmoetKantoorState, ontmoetSosAf, ontmoetSignaalLid } = kern;
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
  // gezichtscontrole (selfie x paspoort) en nationaliteit vastleggen bij goedkeuren:
  // zo weten we dat het paspoort bij de codenaam en de persoon hoort (eis 5)
  if (status === 'verified') {
    const md = accounts.getMemberState(user.id) || {};
    if (req.body.faceMatch !== undefined) md.faceMatch = req.body.faceMatch === true;
    if (req.body.nationaliteit) md.nationaliteit = String(req.body.nationaliteit).slice(0, 40);
    // geslacht uit het paspoort vastleggen (v/m/x); stuurt de "naar de vrouw"-regel bij ontmoetingen
    const g = String(req.body.geslacht || '').toLowerCase();
    if (g === 'v' || g === 'm' || g === 'x') md.geslacht = g;
    accounts.saveMemberState(user.id, md);
  }
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

/* ---- paspoort-incidenten: RTG beoordeelt of een opgeeiste identiteit vrijkomt ---- */
app.post('/api/office/incidenten', officeAuth, (req, res) => {
  res.json({ incidenten: paspoortIncidenten(req.body.alleen === 'open' ? 'open' : 'alle') });
});
app.post('/api/office/incident/beslis', officeAuth, (req, res) => {
  const besluit = req.body.besluit === 'vrijgeven' ? 'vrijgeven' : 'afwijzen';
  const r = paspoortBeoordeel(String(req.body.id || ''), besluit, req.actor && req.actor.name);
  if (r.error) return res.status(r.status).json({ error: r.error });
  res.json(r);
});

app.get('/api/office/doc', (req, res) => {
  if (!officeQueryMag(req.query.token)) return res.status(401).end();
  const file = path.basename(String(req.query.file || '')); // geen padtraversal
  const full = path.join(UPLOAD_DIR, file);
  if (!file || !full.startsWith(UPLOAD_DIR) || !fs.existsSync(full)) return res.status(404).end();
  // het identiteitsbewijs staat (met RTG_ENC_KEY) versleuteld op schijf: hier ontsleutelen
  let buf;
  try { buf = require('../../kluis').ontsleutelBuf(fs.readFileSync(full)); } catch (e) { return res.status(500).end(); }
  const ext = (file.split('.').pop() || '').toLowerCase();
  res.type(ext === 'jpg' ? 'jpeg' : ext).end(buf);
});

/* De concierge-inbox, met elk ledenbericht vertaald naar de taal van de
   kantoormedewerker: het lid schrijft in de eigen taal, het kantoor leest in de
   zijne (zelfde per-bericht-cache als overal). */
app.post('/api/office/conversations', officeAuth, async (req, res) => {
  const to = talen.taalVan(req.body.lang);
  const inbox = conciergeInbox();
  for (const c of inbox) c.messages = await trChat(c.messages, to);
  res.json({ conversations: inbox });
});

app.post('/api/office/reply', officeAuth, (req, res) => {
  const u = accounts.getUserById(Number(req.body.userId));
  if (!u) return res.status(404).json({ error: 'Account niet gevonden.' });
  const text = String(req.body.text || '').trim();
  if (!text) return res.status(400).json({ error: 'Leeg bericht.' });
  const md = accounts.getMemberState(u.id) || {};
  md.conversation = md.conversation || [];
  md.conversation.push({ from: 'concierge', text: text.slice(0, 1000), lang: talen.taalVan(req.body.lang), at: new Date().toISOString(), channel: 'concierge' });
  md.needsConcierge = false;
  accounts.saveMemberState(u.id, md);
  broadcastSync([u.tier], 'chat');
  notify(u.tier, { icon: '💬', title: 'Uw concierge', body: text.slice(0, 80), scope: 'chat' });
  // Het antwoord verschijnt in de app van het lid (met push-melding); RTG gebruikt
  // geen externe berichtenkanalen.
  const inbox = conciergeInbox();
  Promise.all(inbox.map(async c => { c.messages = await trChat(c.messages, talen.taalVan(req.body.lang)); }))
    .then(() => res.json({ ok: true, conversations: inbox }));
});
};
