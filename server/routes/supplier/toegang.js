/* Supplier (deelmodule): de toegang: de eigen mini-boardroom (functies
   aan/uit), het inloggen van de zaak (code of personeelslogin), de
   rooster-opzoek en de instellingen. Krijgt de gedeelde kern een keer bij
   het opstarten vanuit routes/supplier.js. */
module.exports = (kern) => {
  const { DEMO, DEMO_SUPPLIER, accounts, app, checkCred, crypto, findSupplier, hasCred, logActivity,
          loginFails, managerOnly, noteFailedTry, pinSlot, rememberSession, sseToSupplier, supplierAuth,
          supplierState, tooManyTries, zaakBoard, zaakZet, logInlog, werkvensterVan, zetWerkvenster,
          magWerken, werkAdvies, persoonsPoort } = kern;
app.post('/api/supplier/zaak/board', supplierAuth, (req, res) => {
  res.json(zaakBoard(req.supplier));
});
app.post('/api/supplier/zaak/functie', supplierAuth, (req, res) => {
  if (!managerOnly(req, res)) return;
  const r = zaakZet(req.supplier, String(req.body.id || ''), req.body.aan !== false);
  if (r.error) return res.status(r.status).json({ error: r.error });
  res.json({ ok: true, functies: r.functies });
});

app.post('/api/supplier/login', async (req, res) => {
  let s, actor, staff = null;
  if (req.body.staffId != null) {
    if (!accounts.legacyStaffPinToegestaan || !accounts.legacyStaffPinToegestaan())
      return res.status(403).json({ error: 'De personeelspin is gesloten. Log in via /api/supplier/mijn/login met uw persoonlijke RTG-account.' });
    // Persoonlijke personeelslogin met PIN, binnen het bedrijfsaccount.
    s = findSupplier(req.body.code);
    if (!s) return res.status(404).json({ error: 'Deze leverancierscode kennen we niet.' });
    /* Het slot hangt aan het DOEL en wordt GEDEELD met /api/account/koppel:
       die route komt op precies dezelfde verifyStaffPin uit en had een eigen
       teller, per aanvrager. Zie server/pinslot.js. */
    const fk = pinSlot.personeel(s.code, req.body.staffId);
    if (pinSlot.dicht(fk))
      return res.status(429).json({ error: 'Te veel foute pogingen. Wacht een minuut en probeer het opnieuw.' });
    staff = await accounts.verifyStaffPin(Number(req.body.staffId), req.body.pin);
    if (!staff || String(staff.supplier_code).toUpperCase() !== s.code) {
      pinSlot.fout(fk, 'de personeelspin van ' + s.code + '#' + Number(req.body.staffId));
      logInlog('zaak', false, s.code + '#' + req.body.staffId, req);
      return res.status(401).json({ error: 'Onjuiste PIN.' });
    }
    pinSlot.goed(fk);
    // het werkvenster van de werkgever: buiten het venster geen sessie
    // (de manager valt er nooit onder; vrijstellingen stelt de zaak zelf in)
    const wv = magWerken(s, { staffId: staff.id, manager: staff.role === 'manager' }, null, req.body.positie);
    if (!wv.ok) {
      logInlog('zaak', false, s.code + ' · ' + staff.name + ' (werkvenster)', req);
      return res.status(403).json({ error: wv.error, venster: wv.venster || null, ...(wv.locatieNodig ? { locatieNodig: true } : {}) });
    }
    actor = { name: staff.name, role: staff.role, staffId: staff.id, manager: staff.role === 'manager' };
  } else if (hasCred(req.body)) {
    if (!DEMO) return res.status(403).json({ error: 'De gedeelde bedrijfsinlog is uitgeschakeld. Log in met uw persoonlijke RTG-account.' });
    const bucket = 'sup:' + req.ip;
    if (tooManyTries(res, bucket)) return;
    if (!checkCred(req.body.username, req.body.password)) {
      noteFailedTry(bucket, req.ip);
      /* Deze tak logde NIETS -- niet de misser en niet de treffer. De
         personeelstak eronder deed het wel, dus liet de route "soms wel, soms
         geen spoor" na en was "laat een spoor na" geen eigenschap van de
         ingang. Zie test/inlogspoor.test.js. */
      logInlog('zaak', false, req.body.username, req);
      return res.status(401).json({ error: 'Onjuiste gebruikersnaam of wachtwoord.' });
    }
    loginFails.delete(bucket);
    s = findSupplier(DEMO_SUPPLIER);
    actor = { name: 'Beheer', role: 'manager', manager: true };
  } else {
    // Geen anonieme of aparte bedrijfsidentiteit: iedere echte medewerker opent
    // de werkplek met het eigen RTG-account. Zo staat elke handeling op een
    // levende persoon en werkt centrale intrekking ook hier meteen door.
    return res.status(401).json({ error: 'Log in met uw persoonlijke RTG-account via /api/supplier/mijn/login.' });
  }
  if (!s) return res.status(404).json({ error: 'Deze leverancierscode kennen we niet.' });
  if (s.partnerStatus === 'geschorst' || s.partnerStatus === 'beeindigd') {
    logInlog('zaak', false, s.code + ' (werkplek gesloten)', req);
    return res.status(403).json({ error: 'Deze partnerwerkplek is door RTG gesloten.' });
  }
  /* De persoonseis van het genre, met DEZELFDE functie die supplierAuth
     gebruikt. Hem hier herhalen in eigen woorden zou de tweede plek zijn die
     dit besluit neemt, en die twee lopen uiteen. Wat dit toevoegt is alleen het
     moment: nu hoort iemand het aan de deur in plaats van bij zijn eerste
     handeling, met een sessie op zak die nergens meer komt. */
  const eisenaar = { name: actor.name, role: actor.role, staffId: actor.staffId, manager: actor.manager,
    lid: staff && staff.member_id != null ? Number(staff.member_id) : null };
  const pp = persoonsPoort(s, eisenaar);
  if (!pp.ok) {
    logInlog('zaak', false, s.code + ' · ' + actor.name + ' (persoonseis)', req);
    return res.status(403).json({ error: pp.error, persoonseis: pp.missend || null });
  }
  /* EEN GESLAAGDE INLOG IS ER PAS ALS ER EEN TOKEN IS. De PIN-tak zette zijn
     `ok: true` hierboven neer, nog voor deze twee weigeringen -- wie bij een
     gesloten werkplek de juiste pincode intikte, kwam als geslaagde inlog op
     het bord terwijl er nooit een sessie ontstond. Een auditlog met een regel
     die niet is gebeurd, is erger dan een ontbrekende regel. Daarom staat de
     succesregel nu op de enige plek waar hij waar is, en dekt hij meteen ook
     het bedrijfsaccount, dat helemaal niets logde. */
  const token = crypto.randomBytes(24).toString('hex');
  const binding = staff && staff.member_id != null
    ? accounts.staffAccountBinding(staff.member_id) : null;
  logInlog('zaak', true, s.code + ' · ' + actor.name, req);
    const werksessie = { role: 'supplier', code: s.code, actor: actor.name, staffId: actor.staffId,
      staffRole: actor.role, manager: actor.manager,
      ...(binding || {}) };
    rememberSession(token, werksessie);
  logActivity(s.code, actor, actor.name + ' logde in');
  res.json({ token, state: supplierState(s, actor) });
});

/* Het werkvenster: lezen mag elk personeelslid (zodat de PDA kan tonen
   wanneer je terecht kunt); zetten is aan de manager. De afdwinging zelf zit
   bij de ingangen (login hierboven en het ene RTG-account), niet hier. */
app.post('/api/supplier/werkvenster', supplierAuth, (req, res) => {
  const b = req.body || {};
  const wilZetten = typeof b.aan === 'boolean' || (b.dagen && typeof b.dagen === 'object') || Array.isArray(b.vrijgesteld) ||
    b.plek !== undefined || (b.perStaff && typeof b.perStaff === 'object');
  if (wilZetten) {
    if (!managerOnly(req, res)) return;
    zetWerkvenster(req.supplier, b);
    logActivity(req.supplier.code, req.actor, 'stelde het werkvenster bij');
    sseToSupplier(req.supplier.code, 'sync', { scope: 'settings' });
  }
  res.json({ ok: true, werkvenster: werkvensterVan(req.supplier) });
});

/* Rahuls werkadvies: kijkt naar geklokte uren en (alleen bij een sessie via
   het ene RTG-account) de eigen agenda en het eigen zorgprofiel. Advies is
   een zin of null; het blokkeert nooit iets. */
app.post('/api/supplier/werkadvies', supplierAuth, (req, res) => {
  res.json({ advies: werkAdvies({ code: req.supplier.code, staffId: req.actor.staffId, lidKey: req.actor.lidKey || null }) });
});

/* De oude namenlijst van de viercijferige PIN-fixture. Hij bestaat uitsluitend
   in Magnaat Test en is in iedere echte omgeving hard gesloten vóór opzoeking.

   Wat er wel aan moest. Hij had geen enkele rem en gaf publicStaff volledig
   terug: naam, rol, functie en of het personeelslid ook RTG-lid is. Met
   /api/suppliers als lijst van alle bedrijfscodes was daarmee het complete
   personeelsbestand van elke zaak in een paar minuten uit te lezen. Nu: een
   tempolimiet per IP, en alleen de velden die de kiezer echt toont. Wie het
   bedrijf niet kent, krijgt dezelfde 404 als voorheen.

   Buiten die geïsoleerde omgeving is er dus geen publiek personeelsregister. */
/* Een eigen, ruime teller. Bewust NIET tooManyTries/noteFailedTry: die tellen
   MISLUKTE inlogpogingen en slaan bij tien alarm ("mogelijk brute force"). Een
   inlogscherm dat de lijst ophaalt is geen mislukte poging, en van vals alarm
   wordt niemand veiliger. Dertig zaken per kwartier is ruim voor iemand die van
   bedrijf wisselt en te weinig om alle partners leeg te trekken. */
const rosterTeller = new Map();
function rosterMag(ip) {
  const nu = Date.now(), r = rosterTeller.get(ip);
  if (!r || nu > r.tot) { rosterTeller.set(ip, { n: 1, tot: nu + 15 * 60000 }); return true; }
  if (rosterTeller.size > 5000) rosterTeller.clear();  // geheugenplafond
  return ++r.n <= 30;
}
app.post('/api/supplier/roster', (req, res) => {
  if (!accounts.legacyStaffPinToegestaan || !accounts.legacyStaffPinToegestaan())
    return res.status(403).json({ error: 'De openbare personeelskiezer bestaat alleen in Magnaat Test. Log in met uw persoonlijke RTG-account.' });
  if (!rosterMag(req.ip)) return res.status(429).json({ error: 'Te veel opvragingen. Probeer het over een kwartier opnieuw.' });
  const s = findSupplier(req.body.code);
  if (!s) return res.status(404).json({ error: 'Deze leverancierscode kennen we niet.' });
  res.json({
    supplier: { code: s.code, name: s.name, type: s.type },
    staff: accounts.listStaff(s.code).map(accounts.publicStaff).map(m => ({ id: m.id, name: m.name, role: m.role, func: m.func }))
  });
});


// de zaakinstellingen (manager) staan apart, in ./toegang-settings.js
require('./toegang-settings')(kern);
};
