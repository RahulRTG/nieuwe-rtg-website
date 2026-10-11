/* Supplier-werving: teambeheer, uitnodigingen en aanmelden met een RTG-account. */
module.exports = (wctx) => {
  const { kern } = wctx;
  const { DEMO, accounts, app, logActivity, notifySupplier, schoon, supplierAuth,
    werkmail } = kern;
  const uitnodiging = kern.personeelsUitnodiging || require('./uitnodiging')({ kern });
  const { maakInvite, wervingsBasis, wervingsLink, lijstInvites, trekInviteIn,
    roteerInvite } = uitnodiging;
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

app.post('/api/supplier/staff/remove', supplierAuth, async (req, res) => {
  if (!req.actor.manager) return res.status(403).json({ error: 'Alleen een manager kan personeel verwijderen.' });
  const st = accounts.getStaffById(Number(req.body.staffId));
  if (st && String(st.supplier_code).toUpperCase() === req.supplier.code) {
    // N36: eerst de uitnodiging intrekken; lukt dat niet, dan verandert er niets.
    try { await Promise.resolve(uitnodiging.trekInVoorStaff(req.supplier.code, st, req.actor.name)); }
    catch (e) { console.error('[staff-remove] veilige verwerking mislukt'); return res.status(503).json({ error: 'De medewerker kon niet veilig worden verwijderd.' }); }
    accounts.deactivateStaff(st.id);
    // Uit dienst trekt ook de persoonlijke werkmail meteen in.
    if (werkmail && werkmail.trekPersoneelIn) werkmail.trekPersoneelIn(req.supplier.code, st.id);
    logActivity(req.supplier.code, req.actor, req.actor.name + ' verwijderde ' + st.name + ' uit het team');
  }
  res.json({ ok: true, staff: accounts.listStaff(req.supplier.code).map(accounts.publicStaff) });
});

// Idempotent uitnodigen: alleen een verse sleutel mag een tweede code maken.
app.post('/api/supplier/staff/invite', supplierAuth, async (req, res) => {
  if (!req.actor.manager) return res.status(403).json({ error: 'Alleen een manager kan medewerkers uitnodigen.' });
  if (!wervingsBasis().ok)
    return res.status(503).json({ error: 'Personeelsuitnodigingen zijn tijdelijk niet veilig geconfigureerd.' });
  const naam = schoon(req.body.name, 60), role = req.body.role, func = String(req.body.func || '').slice(0, 40);
  const ontvangenSleutel = req.body.idem || (req.get && req.get('Idempotency-Key'));
  const sleutel = ontvangenSleutel
    ? 'inv:' + req.supplier.code + ':' + String(ontvangenSleutel).slice(0, 100) : null;
  let inv;
  try { inv = await Promise.resolve(maakInvite(req.supplier, req.actor, { naam, role, func, idem: sleutel })); }
  catch (e) { console.error('[staff-invite] veilige verwerking mislukt'); return res.status(503).json({ error: 'De uitnodiging kon niet veilig worden opgeslagen.' }); }
  const r = inv && inv.ok ? { ok: true, invite: { id: inv.id, kassacode: inv.kassacode,
    naam: inv.naam, role: inv.role, func: inv.func, expires: inv.expires, toegang: inv.toegang },
    link: wervingsLink(req, inv.kassacode), bedrijf: req.supplier.name } : inv;
  if (r && r.error) return res.status(r.status || 409).json({ error: r.error });
  res.json(r);
});

// Manager trekt een open uitnodiging in (kassacode wordt onbruikbaar).
app.post('/api/supplier/staff/invite/intrek', supplierAuth, async (req, res) => {
  if (!req.actor.manager) return res.status(403).json({ error: 'Alleen een manager kan uitnodigingen intrekken.' });
  let r;
  try { r = await Promise.resolve(trekInviteIn(req.supplier.code, req.body.id, req.actor.name, req.body.reden)); }
  catch (e) { console.error('[staff-invite] veilige verwerking mislukt'); return res.status(503).json({ error: 'De uitnodiging kon niet veilig worden ingetrokken.' }); }
  if (!r || r.error) return res.status(r && r.status || 404).json(r || { error: 'Deze uitnodiging bestaat niet.' });
  const staff = r.claimStaffId != null && accounts.getStaffByIdAny
    ? accounts.getStaffByIdAny(r.claimStaffId)
    : (r.claimMemberId != null ? accounts.staffByMember(req.supplier.code, r.claimMemberId) : null);
  if (staff && String(staff.supplier_code || '').toUpperCase() === req.supplier.code)
    accounts.deactivateStaff(staff.id);
  logActivity(req.supplier.code, req.actor, req.actor.name + ' trok een uitnodiging in');
  res.json({ ok: true });
});

app.post('/api/supplier/staff/invite/roteer', supplierAuth, async (req, res) => {
  if (!req.actor.manager) return res.status(403).json({ error: 'Alleen een manager kan uitnodigingen roteren.' });
  if (!wervingsBasis().ok)
    return res.status(503).json({ error: 'Personeelsuitnodigingen zijn tijdelijk niet veilig geconfigureerd.' });
  let inv;
  const idem = String((req.body.idem || (req.get && req.get('Idempotency-Key'))) || '').slice(0, 200);
  try { inv = await Promise.resolve(roteerInvite(req.supplier.code, req.body.id, req.actor.name, idem)); }
  catch (e) { console.error('[staff-invite] veilige verwerking mislukt'); return res.status(503).json({ error: 'De uitnodiging kon niet veilig worden geroteerd.' }); }
  if (!inv || inv.error) return res.status(inv && inv.status || 409).json(inv || { error: 'Rotatie mislukt.' });
  res.json({ ok: true, invite: { id: inv.id, kassacode: inv.kassacode, naam: inv.naam,
    role: inv.role, func: inv.func, expires: inv.expires, toegang: inv.toegang },
    link: wervingsLink(req, inv.kassacode), bedrijf: req.supplier.name });
});

// Manager reset de code van een collega (vergeten of misbruik): nieuwe pincode,
// eenmalig getoond, om door te geven.
app.post('/api/supplier/staff/reset-pin', supplierAuth, async (req, res) => {
  if (!req.actor.manager) return res.status(403).json({ error: 'Alleen een manager kan codes resetten.' });
  if (!accounts.legacyStaffPinToegestaan || !accounts.legacyStaffPinToegestaan())
    return res.status(403).json({ error: 'Personeel gebruikt het persoonlijke RTG-account; er is geen personeelspin om te resetten.' });
  const st = accounts.getStaffById(Number(req.body.staffId));
  if (!st || String(st.supplier_code).toUpperCase() !== req.supplier.code)
    return res.status(404).json({ error: 'Dit teamlid kennen we niet.' });
  const pin = accounts.makePin();
  await accounts.setStaffPin(st.id, pin);
  logActivity(req.supplier.code, req.actor, req.actor.name + ' resette de code van ' + st.name);
  try { notifySupplier(req.supplier.code, { kind: 'team', text: 'De code van ' + st.name + ' is gereset door ' + req.actor.name + '.' }); } catch (e) {}
  res.json({ ok: true, staff: accounts.publicStaff(st), pin });
});

// Manager ziet alleen lifecycle/status van open uitnodigingen. De kale code
// wordt na uitgifte nooit opnieuw getoond; daarvoor bestaat expliciete rotatie.
app.post('/api/supplier/staff/invites', supplierAuth, async (req, res) => {
  if (!req.actor.manager) return res.status(403).json({ error: 'Alleen een manager ziet de uitnodigingen.' });
  try {
    const r = await Promise.resolve(lijstInvites(req.supplier.code));
    res.json({ ok: true, invites: r.invites, bedrijf: req.supplier.name });
  } catch (e) { console.error('[staff-invite] veilige verwerking mislukt'); res.status(503).json({ error: 'De uitnodigingen konden niet veilig worden gelezen.' }); }
});

// De medewerker meldt zich aan: bedrijfsnaam + kassacode + eigen RTG-inlog. Eigen
// bestand sinds N29: de volgorde van de toetsen is daar het hele punt.
require('./personeel-aanmelden')(wctx, uitnodiging);

  // de sollicitatiestroom gebruikt dezelfde uitnodiging-helpers
  return uitnodiging;
};
