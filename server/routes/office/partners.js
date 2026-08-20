/* Backoffice (deelmodule): partner- en schoolbesluiten en het vertrouwenskanaal met het personeel.
   Draait op de gedeelde kern; gemount vanuit routes/office.js. */
const { datum: klokDatum } = require('../../lib/klok');

module.exports = (octx) => {
  const { kern, officeQueryMag } = octx;
  const { accounts, app, appUrl, boardroomAuth, boardroomWie, db, ensureSupplierDefaults, findSupplier,
          forgetSession, logActivity, mail, makeSupplierCode, officeAuth, save, sessions, schoon,
          sseClients, sseSend, sseToOffice, sseToSupplier,
          ondernemingRegie, ondernemingProvisioningZet, ondernemingBijdrageZet, rechtsvormwacht } = kern;
app.post('/api/office/partner/decide', boardroomAuth, async (req, res) => {
  const a = db.data.partnerApplications.find(x => x.id === req.body.id);
  if (!a) return res.status(404).json({ error: 'Aanvraag niet gevonden.' });
  if (a.status !== 'nieuw') return res.status(409).json({ error: 'Deze aanvraag is al behandeld.' });
  if (req.body.action === 'goedkeuren') {
    // de toegangseis geldt ook hier: geen Business Pass-bewijs bij de
    // aanvraag, dan gaat er geen bedrijfscode de deur uit
    if (!a.businessPass || !a.businessPass.key)
      return res.status(409).json({ error: 'Deze aanvraag heeft geen Business Pass-bewijs; zonder Business Pass geen bedrijfscode. Vraag de aanvrager de aanvraag opnieuw te doen met een actieve Business Pass.' });
    const code = makeSupplierCode(a.company);
    // Een nieuw goedgekeurde partner start OFFLINE: eerst door de ondernemer-
    // poort (Salon-pagina vullen + de rondleidingen), dan pas online en
    // zichtbaar voor leden. online:false zet ensureSupplierDefaults niet terug.
    /* `rate: 0.12` stond hier tot 20 augustus 2026: elke nieuwe partner werd
       aangemaakt met een commissie van 12 procent. commissieVoor() geeft
       inmiddels altijd nul (kern/commercie/vergoeding.js), dus er bewoog niets
       -- maar een veld dat 0.12 zegt terwijl het huis 0% belooft, is precies de
       tegenspraak die deze hele ronde heeft opgeruimd. Nul is wat het is. */
    const s = { code, name: a.company, type: a.type, city: a.city, loc: null, rate: 0, menu: [], online: false };
    ensureSupplierDefaults(s);
    db.data.suppliers.push(s);

    /* HET ABONNEMENT VAN DE ZAAK. Zonder dit weet niemand na vandaag waar deze
       zaak op zit, en kan het capability-profiel niets afdwingen. De trede komt
       van de aanvraag zelf -- de pas waarmee is aangevraagd. Ontbreekt hij (een
       aanvraag van voor deze wijziging), dan wordt er niets vastgelegd en valt de
       zaak op de gedocumenteerde terugval, telbaar in `zonderAbonnement()`. */
    try {
      const trede = a.businessPass && a.businessPass.pas;
      if (trede && kern.zaakAbonnement) kern.zaakAbonnement.zet(code, trede, 'partner-goedkeuring');
    } catch (e) { /* een abonnement dat niet landt, mag de goedkeuring niet blokkeren */ }
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
      'Uw zaak staat nog offline. Loop eerst even de ondernemer-poort door: vul uw ' +
      'Salon-pagina (een bio en een foto) en volg de korte rondleidingen door de kassa ' +
      'en de werk-apps. Daarna zet u uw zaak zelf online en bent u zichtbaar voor leden.\n\n' +
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

/* Een partnerschap openen en sluiten is boardroomwerk: het maakt of verbreekt
   toegang tot een volledige bedrijfswerkplek. Een schorsing trekt daarom niet
   alleen nieuwe logins dicht, maar wist ook alle bestaande sessies en sluit
   open liveverbindingen. De centrale supplierAuth controleert de status bij
   ieder verzoek als tweede slot voor processen met oud sessiegeheugen. */
app.post('/api/office/partner/status', boardroomAuth, (req, res) => {
  const code = String((req.body || {}).code || '').trim().toUpperCase();
  const status = String((req.body || {}).status || '').trim().toLowerCase();
  const reden = schoon((req.body || {}).reden, 240);
  if (!['actief', 'geschorst', 'beeindigd'].includes(status))
    return res.status(400).json({ error: 'Kies actief, geschorst of beeindigd.' });
  const s = findSupplier(code);
  if (!s) return res.status(404).json({ error: 'Partner niet gevonden.' });
  if (status !== 'actief' && !reden)
    return res.status(400).json({ error: 'Leg vast waarom deze partnerwerkplek wordt gesloten.' });

  const vorige = s.partnerStatus || 'actief';
  s.partnerStatus = status;
  s.partnerStatusAt = klokDatum().toISOString();
  s.partnerStatusDoor = boardroomWie(req);
  s.partnerStatusReden = reden || null;
  if (status !== 'actief') s.online = false;

  let ingetrokken = 0;
  if (status !== 'actief') {
    const hashes = [];
    for (const [hash, sess] of sessions)
      if (sess && sess.role === 'supplier' && String(sess.code || '').toUpperCase() === code) hashes.push(hash);
    for (const hash of hashes) { forgetSession(hash); ingetrokken += 1; }
    for (let i = sseClients.length - 1; i >= 0; i--) {
      const client = sseClients[i];
      if (!client || String(client.sup || '').toUpperCase() !== code) continue;
      try { sseSend(client.res, 'toegang-ingetrokken', { status }); } catch (e) {}
      try { client.res.end(); } catch (e) {}
      sseClients.splice(i, 1);
    }
  }
  save();
  logActivity(code, { name: 'Boardroom' }, status === 'actief'
    ? 'hief de partnerschorsing op'
    : 'zette de partnerwerkplek op ' + status + ': ' + reden);
  sseToSupplier(code, 'partner-status', { status, at: s.partnerStatusAt });
  sseToOffice('sync', { scope: 'partners', code, status });
  res.json({ ok: true, code, vorige, status, ingetrokken, sessiesIngetrokken: ingetrokken });
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
    s.status = 'actief'; s.goedgekeurdAt = klokDatum().toISOString();
  } else {
    s.status = 'afgewezen'; s.afgewezenAt = klokDatum().toISOString();
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
  t.messages.push({ from: 'rtg', text, at: klokDatum().toISOString() });
  t.messages = t.messages.slice(-60);
  t.open = false;
  t.lastAt = klokDatum().toISOString();
  save();
  // alleen een seintje om te verversen; de inhoud gaat uitsluitend via de persoonlijke login
  sseToSupplier(t.code, 'sync', { scope: 'trust' });
  res.json({ ok: true });
});

  /* ---- de ondernemersregie: twee knoppen van de boardroom ----
     Achter de kantoorpoort, en elke wijziging komt met een naam in het
     journaal. Zie kern/onderneming/regie.js voor waarom soepeler zetten een
     naam vraagt en strenger zetten niet. */
  app.post('/api/office/ondernemersregie', officeAuth, (req, res) => {
    res.json({ ok: true, regie: ondernemingRegie() });
  });

  app.post('/api/office/ondernemersregie/provisioning', officeAuth, (req, res) => {
    const r = ondernemingProvisioningZet(String((req.body || {}).stand || ''), boardroomWie(req));
    res.status(r.status || 200).json(r);
  });

  app.post('/api/office/ondernemersregie/bijdrage', officeAuth, (req, res) => {
    const r = ondernemingBijdrageZet(req.body || {}, boardroomWie(req));
    res.status(r.status || 200).json(r);
  });

  /* ---- de rechtsvormwacht ----
     De stand van het rechtsvormenregister en een handmatige controle. Zetten
     kan ook met de hand, maar langs dezelfde gevalideerde weg als een bron:
     een tweede, soepelere ingang zou de grendels omzeilen die er juist voor de
     bron staan. Zie kern/onderneming/rechtsvormwacht.js. */
  app.post('/api/office/rechtsvormwacht', officeAuth, (req, res) => {
    res.json({ ok: true, wacht: rechtsvormwacht.status() });
  });

  app.post('/api/office/rechtsvormwacht/check', officeAuth, async (req, res) => {
    const r = await rechtsvormwacht.check();
    res.json(Object.assign({ ok: true }, r, { wacht: rechtsvormwacht.status() }));
  });

  app.post('/api/office/rechtsvormwacht/zet', officeAuth, (req, res) => {
    const r = rechtsvormwacht.pasToe(req.body || {}, 'kantoor: ' + boardroomWie(req));
    res.json(Object.assign({}, r, { wacht: rechtsvormwacht.status() }));
  });
};
