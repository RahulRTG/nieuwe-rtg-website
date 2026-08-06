/* Supplier-werving (deelmodule): het personeel zelf: toevoegen, verwijderen,
   uitnodigen met een kassacode, PIN-reset en het aanmelden met een eigen
   RTG-account. Gemount vanuit routes/supplier/werving.js op de gedeelde kern. */
module.exports = (wctx) => {
  const { kern } = wctx;
  // alleen wat deze wervingsmodule echt gebruikt (de rest van de gedeelde kern
  // hoort hier niet thuis; opgeruimd om dode destructuring te vermijden)
  const { DEMO, accounts, app, logActivity, loginFails, noteFailedTry,
    notifySupplier, save, schoon, supplierAuth, tooManyTries } = kern;
  /* De uitnodiging zelf -- maken, terugvinden, en er iemand mee verbinden --
     staat in ./uitnodiging.js. Hier staan de routes eromheen. */
  const uitnodiging = require('./uitnodiging')({ kern });
  const { invitesVan, findSupplierByName, maakInvite, wervingsLink, verbindLid } = uitnodiging;
app.post('/api/supplier/staff/add', supplierAuth, async (req, res) => {
  if (!req.actor.manager) return res.status(403).json({ error: 'Alleen een manager kan personeel toevoegen.' });
  // Nieuw personeel gaat via een uitnodiging (kassacode) en een eigen RTG-account;
  // rechtstreeks toevoegen bestaat alleen nog in de demo.
  if (!DEMO) return res.status(403).json({ error: 'Nieuw personeel meldt zich zelf aan: maak een uitnodiging (kassacode) en geef die samen met de bedrijfsnaam door.' });
  const name = schoon(req.body.name, 60);
  if (!name) return res.status(400).json({ error: 'Vul een naam in.' });
  const pin = accounts.makePin();
  const staff = await accounts.createStaff({ supplierCode: req.supplier.code, name, role: req.body.role === 'manager' ? 'manager' : 'staff', func: String(req.body.func || '').slice(0, 40) || null, pin });
  logActivity(req.supplier.code, req.actor, req.actor.name + ' voegde ' + name + ' toe aan het team');
  res.json({ ok: true, staff: accounts.publicStaff(staff), pin });
});

app.post('/api/supplier/staff/remove', supplierAuth, (req, res) => {
  if (!req.actor.manager) return res.status(403).json({ error: 'Alleen een manager kan personeel verwijderen.' });
  const st = accounts.getStaffById(Number(req.body.staffId));
  if (st && String(st.supplier_code).toUpperCase() === req.supplier.code) {
    accounts.deactivateStaff(st.id);
    logActivity(req.supplier.code, req.actor, req.actor.name + ' verwijderde ' + st.name + ' uit het team');
  }
  res.json({ ok: true, staff: accounts.listStaff(req.supplier.code).map(accounts.publicStaff) });
});

// Manager nodigt een medewerker uit: geeft een eenmalige kassacode terug.
app.post('/api/supplier/staff/invite', supplierAuth, (req, res) => {
  if (!req.actor.manager) return res.status(403).json({ error: 'Alleen een manager kan medewerkers uitnodigen.' });
  const inv = maakInvite(req.supplier, req.actor, {
    naam: schoon(req.body.name, 60), role: req.body.role, func: String(req.body.func || '').slice(0, 40)
  });
  res.json({ ok: true, invite: { kassacode: inv.kassacode, naam: inv.naam, role: inv.role, func: inv.func, expires: inv.expires },
    link: wervingsLink(req, inv.kassacode), bedrijf: req.supplier.name });
});

// Manager trekt een open uitnodiging in (kassacode wordt onbruikbaar).
app.post('/api/supplier/staff/invite/intrek', supplierAuth, (req, res) => {
  if (!req.actor.manager) return res.status(403).json({ error: 'Alleen een manager kan uitnodigingen intrekken.' });
  const kassacode = String(req.body.kassacode || '').trim().toUpperCase();
  const lijst = invitesVan(req.supplier.code);
  const idx = lijst.findIndex(i => i.kassacode === kassacode && !i.used);
  if (idx < 0) return res.status(404).json({ error: 'Deze uitnodiging bestaat niet (meer).' });
  lijst.splice(idx, 1);
  save();
  logActivity(req.supplier.code, req.actor, req.actor.name + ' trok een uitnodiging in');
  res.json({ ok: true });
});

// Manager reset de code van een collega (vergeten of misbruik): nieuwe pincode,
// eenmalig getoond, om door te geven.
app.post('/api/supplier/staff/reset-pin', supplierAuth, async (req, res) => {
  if (!req.actor.manager) return res.status(403).json({ error: 'Alleen een manager kan codes resetten.' });
  const st = accounts.getStaffById(Number(req.body.staffId));
  if (!st || String(st.supplier_code).toUpperCase() !== req.supplier.code)
    return res.status(404).json({ error: 'Dit teamlid kennen we niet.' });
  const pin = accounts.makePin();
  await accounts.setStaffPin(st.id, pin);
  logActivity(req.supplier.code, req.actor, req.actor.name + ' resette de code van ' + st.name);
  try { notifySupplier(req.supplier.code, { kind: 'team', text: 'De code van ' + st.name + ' is gereset door ' + req.actor.name + '.' }); } catch (e) {}
  res.json({ ok: true, staff: accounts.publicStaff(st), pin });
});

// Manager ziet de open uitnodigingen (om een kassacode opnieuw te tonen).
app.post('/api/supplier/staff/invites', supplierAuth, (req, res) => {
  if (!req.actor.manager) return res.status(403).json({ error: 'Alleen een manager ziet de uitnodigingen.' });
  const nu = Date.now();
  const lijst = (invitesVan(req.supplier.code)).filter(i => !i.used && i.expires > nu)
    .map(i => ({ kassacode: i.kassacode, naam: i.naam, role: i.role, func: i.func, expires: i.expires }));
  res.json({ ok: true, invites: lijst, bedrijf: req.supplier.name });
});

// De medewerker meldt zich aan: bedrijfsnaam + kassacode + eigen RTG-inlog.
app.post('/api/supplier/staff/join', async (req, res) => {
  const bucket = 'join:' + req.ip;
  if (tooManyTries(res, bucket)) return;
  const bedrijf = String(req.body.bedrijf || '').trim();
  const kassacode = String(req.body.kassacode || '').trim().toUpperCase();
  /* Een pincode hoeft niet meer: wie zich met zijn eigen RTG-account aanmeldt,
     logt daarna gewoon in op dat account en heeft zijn werk-app meteen (zie
     kern/werkbijlogin.js). De pincode bestaat alleen nog voor de losse
     personeelslogin op een gedeeld apparaat, dus kiest iemand er zelf geen, dan
     maken we er een en hoeft hij er nooit aan te denken. */
  const gekozen = String(req.body.pin || '').trim();
  if (!bedrijf || !kassacode) { noteFailedTry(bucket); return res.status(400).json({ error: 'Vul de bedrijfsnaam en de kassacode in.' }); }
  if (gekozen && !/^\d{4}$/.test(gekozen)) return res.status(400).json({ error: 'Een pincode is vier cijfers; laat hem leeg als u er geen wilt.' });
  const pin = gekozen || accounts.makePin();
  // 1) bewijs dat u een eigen RTG-account hebt (een betaalde pas is niet nodig)
  const lid = accounts.findByLogin(req.body.login);
  if (!lid || !(await accounts.verifyPassword(String(req.body.password || ''), lid.password_hash))) {
    noteFailedTry(bucket);
    return res.status(401).json({ error: 'Onjuiste RTG-inloggegevens. Meld u aan met uw eigen RTG-account.' });
  }
  // 2) het bedrijf moet bestaan en de kassacode moet erbij horen (eenmalig)
  const s = findSupplierByName(bedrijf);
  if (!s) { noteFailedTry(bucket); return res.status(404).json({ error: 'We kennen geen bedrijf met die naam. Controleer de bedrijfsnaam bij uw werkgever.' }); }
  const lijst = invitesVan(s.code);
  const inv = lijst.find(i => i.kassacode === kassacode && !i.used && i.expires > Date.now());
  if (!inv) { noteFailedTry(bucket); return res.status(403).json({ error: 'Deze kassacode klopt niet, is al gebruikt of verlopen. Vraag uw werkgever om een nieuwe uitnodiging.' }); }
  // 3) niet dubbel aanmelden bij hetzelfde bedrijf
  if (accounts.staffByMember(s.code, lid.id)) {
    inv.used = true; save();
    return res.status(409).json({ error: 'U bent al aangemeld bij dit bedrijf. Log in met uw naam en pincode.' });
  }
  loginFails.delete(bucket);
  const { staff, naam } = await verbindLid(s, inv, lid, { pin });
  res.json({ ok: true, code: s.code, staffId: staff.id, name: naam, role: inv.role });
});

  // de sollicitatiestroom gebruikt dezelfde uitnodiging-helpers
  return uitnodiging;
};
