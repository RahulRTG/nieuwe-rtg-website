/* Backoffice (deelmodule): partner- en schoolbesluiten en het vertrouwenskanaal met het personeel.
   Draait op de gedeelde kern; gemount vanuit routes/office.js. */
module.exports = (octx) => {
  const { kern, officeQueryMag } = octx;
  const { OFFICE_CODE, UPLOAD_DIR, accounts, app, appUrl, archief, broadcastSync, conciergeInbox, crypto, db, eigenaar, ensureSupplierDefaults, fs, loginFails, mail, makeSupplierCode, noteFailedTry, notify, notifySupplier, officeAuth, officeState, path, talen, trChat, pendingVerifications, rememberSession, save, schoon, sessionFor, sseClients, sseToOffice, sseToSupplier, tooManyTries, totpOk, veiligGelijk, logInlog, paspoortIncidenten, paspoortBeoordeel, salonProfielCompleet, salonItemsVan, ontmoetKantoorState, ontmoetSosAf, ontmoetSignaalLid } = kern;
app.post('/api/office/partner/decide', officeAuth, async (req, res) => {
  const a = db.data.partnerApplications.find(x => x.id === req.body.id);
  if (!a) return res.status(404).json({ error: 'Aanvraag niet gevonden.' });
  if (a.status !== 'nieuw') return res.status(409).json({ error: 'Deze aanvraag is al behandeld.' });
  if (req.body.action === 'goedkeuren') {
    // de toegangseis geldt ook hier: geen Business Pass-bewijs bij de
    // aanvraag, dan gaat er geen bedrijfscode de deur uit
    if (!a.businessPass || !a.businessPass.key)
      return res.status(409).json({ error: 'Deze aanvraag heeft geen Business Pass-bewijs; zonder Business Pass geen bedrijfscode. Vraag de aanvrager de aanvraag opnieuw te doen met een actieve Business Pass.' });
    const code = makeSupplierCode(a.company);
    const s = { code, name: a.company, type: a.type, city: a.city, loc: null, rate: 0.12, menu: [] };
    ensureSupplierDefaults(s);
    db.data.suppliers.push(s);
    const pin = accounts.makePin();
    await accounts.createStaff({ supplierCode: code, name: a.contactName, role: 'manager', func: 'Beheer', pin });
    a.status = 'goedgekeurd'; a.code = code;
    save();
    const url = appUrl(req);
    mail.send(a.email, 'Welkom als partner van Rahul Travel Group',
      'Beste ' + a.contactName + ',\n\n' + a.company + ' is goedgekeurd als RTG-partner.\n\n' +
      'Uw leverancierscode: ' + code + '\nUw manager-PIN: ' + pin + ' (op naam van ' + a.contactName + ')\n\n' +
      'Open de partner-app op ' + url + '/apps/leverancier.html, kies uw bedrijf via de code, ' +
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

/* ---------- RTF School: RTG keurt schoolaanmeldingen goed ----------
   Een school meldt zich aan via de RTFoundation-app en staat dan op 'wacht'.
   Pas als RTG hem hier goedkeurt (status 'actief') kan de school personeel
   toelaten en klassen maken. Dezelfde beoordeling als bij partner-aanvragen. */
function scholen() {
  const f = db.data.foundation || (db.data.foundation = {});
  if (!f.scholen) f.scholen = {};
  return f.scholen;
}
app.post('/api/office/schools', officeAuth, (req, res) => {
  const lijst = Object.values(scholen()).map(s => ({
    code: s.code, naam: s.naam, plaats: s.plaats, status: s.status || 'actief', at: s.at,
    personeel: Object.keys(s.personeel || {}).length
  })).sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')));
  res.json({ schools: lijst });
});
app.post('/api/office/school/decide', officeAuth, (req, res) => {
  const s = scholen()[String(req.body.code || '').trim().toUpperCase()];
  if (!s) return res.status(404).json({ error: 'School niet gevonden.' });
  if ((s.status || 'actief') !== 'wacht') return res.status(409).json({ error: 'Deze school is al beoordeeld.' });
  if (req.body.action === 'goedkeuren') {
    s.status = 'actief'; s.goedgekeurdAt = new Date().toISOString();
  } else {
    s.status = 'afgewezen'; s.afgewezenAt = new Date().toISOString();
  }
  save();
  sseToOffice('sync', { scope: 'schools' });
  res.json({ ok: true, status: s.status });
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

};
