/* Supplier (deelmodule): de toegang: de eigen mini-boardroom (functies
   aan/uit), het inloggen van de zaak (code of personeelslogin), de
   rooster-opzoek en de instellingen. Krijgt de gedeelde kern een keer bij
   het opstarten vanuit routes/supplier.js. */
module.exports = (kern) => {
  const { ALT_IDEE, BOEK_KETEN, DEMO, DEMO_SUPPLIER, HK_STATUSES, LANDEN, POS_METHODS, RIT_KETEN, RIT_LEGACY, TABLE_STATUSES, VAC_SOORTEN, ZAAK_OPTIES, accounts, addTicket, aiFindDoor, aiFindRoom, alcoholGrensVan, anthropic, app, applyChatPubliek, applyChatVertaald, auth, beslisReservering, isFavoriet, broadcastSync,
    zetCollectie, zetArtikel, pasVoorraad, releaseDrop, klantProfiel, zetKlantMaten, voegKlantnotitie,
    legApart, vraagPaskamer, paskamerBreng, stuurStyling, retailVerkoop, voorraadZoek, retailState,
    RETAIL_MATEN, RETAIL_SEIZOENEN, PASPOORT_NIVEAUS, paspoortVraag, paspoortBekijk, paspoortIncident, paspoortPartner,
    cannedBoekhouder, cateringDishes, chatStuur, checkCred, coachCache, coachRules, crypto, db, ensureApplyChat, eventCovers, express, fallbackRunsheet, financeVoor, factuur, facturatie, boekhoudkennis, talen, findSupplier, gcCode, geborenVan, guestsFor, hasCred, i18n, ledenPrijs, leeftijdVan, logActivity, keyVanCodenaam, magBezorgen, haversine, etaMinutes, ticketsVoorSlot, loginFails, managerOnly, noteFailedTry, notify, notifyApplicant, notifySupplier, parseRunsheetText, pickupCode, pinSlot, posDay, publicSupplier, pushLive, rememberSession, ritBezetting, ritVerder, runItem, salonNaarVolgers, salonProfielCompleet, salonItemsVan, save, scheduleFor, schoon, sectiesForOrder, sessionFor, setRoomHk, sortRunsheet, sseClients, sseSend, sseToCustomer, sseToOffice, sseToSupplier, stationsForOrder, supplierAuth, supplierState, tooManyTries, trChat, unlockDoor, weekdagFactor,
    zaakBoard, zaakZet, zaakFunctieAan, klantSalon, media,
    dpVerzoekMaak, dpVerzoekIntrek, dpOntvangsten, logInlog, pay,
    tafelplanning, reserveringTafel, reserveringKomst, walkIn, shiftSamenvatting,
    fluisterZeg, orderMetRef, ordersVanZaak, ordersVoegToe, boekingenVanZaak,
    werkvensterVan, zetWerkvenster, magWerken, werkAdvies } = kern;


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
  let s, actor;
  if (req.body.staffId != null) {
    // Persoonlijke personeelslogin met PIN, binnen het bedrijfsaccount.
    s = findSupplier(req.body.code);
    if (!s) return res.status(404).json({ error: 'Deze leverancierscode kennen we niet.' });
    /* Het slot hangt aan het DOEL en wordt GEDEELD met /api/account/koppel:
       die route komt op precies dezelfde verifyStaffPin uit en had een eigen
       teller, per aanvrager. Zie server/pinslot.js. */
    const fk = pinSlot.personeel(s.code, req.body.staffId);
    if (pinSlot.dicht(fk))
      return res.status(429).json({ error: 'Te veel foute pogingen. Wacht een minuut en probeer het opnieuw.' });
    const staff = await accounts.verifyStaffPin(Number(req.body.staffId), req.body.pin);
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
    logInlog('zaak', true, s.code + ' · ' + staff.name, req);
    actor = { name: staff.name, role: staff.role, staffId: staff.id, manager: staff.role === 'manager' };
  } else if (hasCred(req.body)) {
    if (!DEMO) return res.status(403).json({ error: 'Demo-inlog is uitgeschakeld. Log in op uw naam met uw persoonlijke pincode.' });
    const bucket = 'sup:' + req.ip;
    if (tooManyTries(res, bucket)) return;
    if (!checkCred(req.body.username, req.body.password)) {
      noteFailedTry(bucket);
      return res.status(401).json({ error: 'Onjuiste gebruikersnaam of wachtwoord.' });
    }
    loginFails.delete(bucket);
    s = findSupplier(DEMO_SUPPLIER);
    actor = { name: 'Beheer', role: 'manager', manager: true };
  } else {
    // Geen anonieme toegang meer met alleen de bedrijfscode: iedereen logt in op
    // de eigen naam met een persoonlijke pincode (of het bedrijfsaccount met
    // gebruikersnaam en wachtwoord). Zo staat elke handeling op een persoon.
    return res.status(401).json({ error: 'Kies wie u bent en voer uw persoonlijke pincode in.' });
  }
  if (!s) return res.status(404).json({ error: 'Deze leverancierscode kennen we niet.' });
  const token = crypto.randomBytes(24).toString('hex');
  rememberSession(token, { role: 'supplier', code: s.code, actor: actor.name, staffId: actor.staffId, staffRole: actor.role, manager: actor.manager });
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

/* De namenlijst voor het inlogscherm van de PDA: je kiest wie je bent en typt
   daarna je pincode. Die volgorde maakt de route noodzakelijk PUBLIEK -- er is
   voor het inloggen nog niets om op te authenticeren.

   Wat er wel aan moest. Hij had geen enkele rem en gaf publicStaff volledig
   terug: naam, rol, functie en of het personeelslid ook RTG-lid is. Met
   /api/suppliers als lijst van alle bedrijfscodes was daarmee het complete
   personeelsbestand van elke zaak in een paar minuten uit te lezen. Nu: een
   tempolimiet per IP, en alleen de velden die de kiezer echt toont. Wie het
   bedrijf niet kent, krijgt dezelfde 404 als voorheen.

   Blijft staan: de namen zelf zijn zichtbaar voor wie de code kent. Dat weghalen
   vraagt een andere inlogvorm (eerst een bedrijfsgeheim, dan pas de lijst) en
   dus een besluit over hoe personeel inlogt -- geen stille wijziging. */
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
