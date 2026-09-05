/* Backoffice (deelmodule): partner- en schoolbesluiten en het vertrouwenskanaal met het personeel.
   Draait op de gedeelde kern; gemount vanuit routes/office.js. */
const { datum: klokDatum } = require('../../lib/klok');
const { idVanKey } = require('../../lib/lidsleutel');
const toelatingscontrole = require('../../kern/bedrijfscontrole');

module.exports = (octx) => {
  const { kern } = octx;
  const { accounts, app, appUrl, boardroomAuth, boardroomWie, db, ensureSupplierDefaults, findSupplier,
          forgetSessionDuurzaam, logActivity, mail, makeSupplierCode, save, sessions, schoon,
          sseClients, sseSend, sseToOffice, sseToSupplier } = kern;
app.post('/api/office/partner/decide', boardroomAuth, async (req, res) => {
  const a = db.data.partnerApplications.find(x => x.id === req.body.id);
  if (!a) return res.status(404).json({ error: 'Aanvraag niet gevonden.' });
  if (a.status !== 'nieuw') return res.status(409).json({ error: 'Deze aanvraag is al behandeld.' });
  if (req.body.action === 'goedkeuren') {
    // de toegangseis geldt ook hier: een partnerplek vraag je aan ALS LID, met
    // welke pas dan ook. Zonder ledenbewijs bij de aanvraag gaat er geen
    // bedrijfscode de deur uit. `businessPass` staat er nog voor aanvragen van
    // voor die regel wijzigde -- ook dat is een ledenbewijs.
    const bewijs = a.pas || a.businessPass;
    if (!bewijs || !bewijs.key)
      return res.status(409).json({ error: 'Deze aanvraag heeft geen ledenbewijs; zonder pas geen bedrijfscode. Vraag de aanvrager de aanvraag opnieuw te doen terwijl hij is ingelogd met zijn pas.' });
    const legacyPin = !!(accounts.legacyStaffPinToegestaan && accounts.legacyStaffPinToegestaan());
    const beheerLidId = idVanKey(bewijs.key);
    const beheerLid = beheerLidId != null ? accounts.getUserById(beheerLidId) : null;
    /* Oude persona-passen hebben geen account-id. Zij mogen uitsluitend in de
       expliciete Magnaat Test-omgeving de oude PIN-fixture blijven gebruiken;
       in iedere echte omgeving is een levende persoonlijke accountbinding een
       harde voorwaarde voordat de zaak ook maar wordt aangemaakt. */
    if ((!beheerLid || (accounts.isActief && !accounts.isActief(beheerLid))) && !legacyPin)
      return res.status(409).json({ error: 'Het RTG-account van de aanvrager is niet meer actief. Laat de eigenaar de aanvraag vanuit het eigen account opnieuw indienen.' });

    /* EN HET TOELATINGSDOSSIER, want een ledenbewijs is niet hetzelfde als een
       afgeronde controle. Deze poort kwam met de samenvoeging mee in een tweede
       versie van deze route; ik hield die van de verzameling (die de pas-eis en
       het zaakabonnement draagt) en liet deze liggen. test/partnerpas.test.js
       bewees binnen een dag waarom dat niet kon: "ook de eigenaar kan de
       officiele controles niet overslaan" kreeg 200 in plaats van 409.

       Dat is precies de vorm die COMMERCIE.md verbiedt -- een bewering die
       AFGEDWONGEN heet zonder toets erachter. De eigenaar is hier niet de
       uitzondering maar juist het geval dat ertoe doet: wie alles mag, moet
       hier ook langs. */
    const poort = toelatingscontrole.magGoedkeuren(a, Date.now());
    if (!poort.ok) return res.status(409).json(poort);
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
      // uit het bewijs hierboven, in welke van de twee vormen het ook staat:
      // `pas.tier` is de huidige, `businessPass.pas` de vorm van voor 20 augustus.
      const trede = (bewijs && bewijs.tier) || (a.businessPass && a.businessPass.pas);
      if (trede && kern.zaakAbonnement) kern.zaakAbonnement.zet(code, trede, 'partner-goedkeuring');
    } catch (e) { /* een abonnement dat niet landt, mag de goedkeuring niet blokkeren */ }
    const pin = legacyPin ? accounts.makePin() : null;
    if (legacyPin) {
      await accounts.createStaff({ supplierCode: code, name: a.contactName, role: 'manager',
        func: 'Beheer', pin,
        ...(beheerLid ? { memberId: beheerLid.id, memberTier: beheerLid.tier } : {}) });
    } else {
      accounts.createAccountStaff({ supplierCode: code, name: a.contactName, role: 'manager',
        func: 'Beheer', memberId: beheerLid.id, memberTier: beheerLid.tier });
    }
    a.status = 'goedgekeurd'; a.code = code;
    save();
    const url = appUrl(req);
    mail.send(a.email, 'Welkom als partner van Rahul Travel Group',
      'Beste ' + a.contactName + ',\n\n' + a.company + ' is goedgekeurd als RTG-partner.\n\n' +
      'Uw leverancierscode: ' + code + '\n\n' +
      'Open de partner-app op ' + url + '/apps/leverancier.html en log in met hetzelfde persoonlijke RTG-account waarmee u de aanvraag indiende. ' +
      'Uw managementwerkplek staat daar direct klaar.\n\n' +
      'Uw zaak staat nog offline. Loop eerst even de ondernemer-poort door: vul uw ' +
      'Salon-pagina (een bio en een foto) en volg de korte rondleidingen door de kassa ' +
      'en de werk-apps. Daarna zet u uw zaak zelf online en bent u zichtbaar voor leden.\n\n' +
      'Uw bedrijfsaccount op De Salon is direct aangemaakt; dit is een vast onderdeel van elk RTG-partnerschap. ' +
      'Via Kantoor, Marketing stelt u uw profiel in, plaatst u berichten, aanbiedingen en polls, en ziet u uw volgers en cijfers.\n\nRahul Travel Group');
    sseToOffice('sync', { scope: 'team' });
    return res.json({ ok: true, code, ...(legacyPin ? { pin } : {}),
      toegang: 'persoonlijk-rtg-account' });
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
app.post('/api/office/partner/status', boardroomAuth, async (req, res) => {
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
    for (const hash of hashes) {
      if (await forgetSessionDuurzaam(hash)) ingetrokken += 1;
    }
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

/* De schoolgoedkeuring en de vertrouwensmeldingen staan sinds deze ronde in
   ./partners/kantoorlijsten.js -- zie de kop daar. Ze stonden hier ook, en
   dan wint de eerste registratie en draait de tweede nooit (check-regel 31). */


  require('./partners/kantoorlijsten')(octx);
};
