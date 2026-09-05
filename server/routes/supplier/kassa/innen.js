/* Kassa (deelmodule): INNEN op een RTG-ophaalcode -- een bestelling die online
   is geplaatst uitgeven, en hem afrekenen als dat nog niet was gebeurd.

   Waarom dit naast ./verkoop.js staat en er niet in. Dat bestand gaat over de
   losse kassaverkoop: iemand staat aan de balie, er is nog geen bestelling, en
   de bon ontstaat op dat moment. Hier bestaat de bestelling al -- met een ref,
   een codenaam en misschien een betaling -- en het enige dat gebeurt is: hem
   vinden, eventueel afrekenen, en uitgeven. Twee verschillende beginsituaties.

   De aanleiding was de omvangsgrens van keuringsregel 13: verkoop.js kwam op
   10,4 kB doordat de verkoop de herhalingslaag kreeg (kern/kassa/herhaling.js)
   en de cadeaukaart een betaalwijze werd. Beide horen bij de VERKOOP; het innen
   stond er alleen naast. Dit is dus de naad die er al lag.

   GEEN HERHALINGSLAAG HIER, en dat is geen vergeten regel. Deze route is uit
   zichzelf al eenmalig: hij weigert een code die al is uitgegeven met een 409
   ("Code X is al uitgegeven"), en de tweede oproep komt dus nooit bij het
   afrekenen. Een idem-sleutel zou daar niets aan toevoegen. */
const moneyCredentialBlokkade = require('../../../middleware/money-credential-productiepoort').blokkade;

module.exports = (kern) => {
  const { app, broadcastSync, crypto, db, facturatie, logActivity, notify, pickupCode, save,
          sseToCustomer, sseToOffice, sseToSupplier, supplierAuth, ordersVanZaak } = kern;
  // dezelfde factuurroutine als de app-kant; zie kern/lidacties/factuur.js
  const { maakFactuurVoorLid, regelsVanItems } = require('../../../kern/lidacties/factuur');
  const factuurVoorLid = maakFactuurVoorLid(facturatie);

app.post('/api/supplier/pos/redeem', supplierAuth, (req, res) => {
  const dicht = moneyCredentialBlokkade('pay.order_pickup_code');
  if (dicht) return res.status(dicht.status).json(dicht);
  const code = String(req.body.code || '').trim().toUpperCase();
  if (!code) return res.status(400).json({ error: 'Voer een ophaalcode in.' });
  /* Een interne spoedbon gebruikt `pickupCode()` alleen als werknummer op de
     keukenlijn. Hij heeft geen klant en geen uitgifterecht. Zonder de expliciete
     scheiding hieronder maakte dit algemene loket van dat werknummer alsnog
     een bearer waarmee iemand de interne bon kon laten aftekenen. */
  const o = ordersVanZaak(req.supplier.code).find(x => !x.intern && x.pickup === code);
  if (!o) return res.status(404).json({ error: 'Onbekende code voor dit bedrijf.' });
  if (o.refunded || o.status === 'geweigerd') return res.status(409).json({ error: 'Deze bestelling is geannuleerd.' });
  if (o.status === 'geserveerd') return res.status(409).json({ error: 'Deze ophaalcode is al uitgegeven.' });
  const wasPaid = o.paid;
  let sale = null;
  if (!o.paid) {
    // afrekenen via RTG-lidmaatschap; komt als omzet in het dagoverzicht
    o.paid = true;
    o.betaaldMet = 'rtg'; // de werkelijke betaalwijze, voor de dagafsluiting (TAKEN.md 4.59)
    /* HET MOMENT VAN BETALEN, en dat stond hier als enige betaalweg niet bij.
       Elke andere weg zet paidAt (bestellen.js, rekening.js, tafelticket), en de
       hele verslaglegging valt daarop terug: het dagrapport, de maandboekhouding
       en de kantoorcijfers rekenen met `paidAt || at`. Zonder paidAt telde een
       bon die vorige maand is geplaatst en vandaag wordt opgehaald mee in de
       VORIGE maand -- en dan wijkt hij af van de factuur hieronder, die de datum
       van vandaag draagt. */
    o.paidAt = new Date().toISOString();
    sale = {
      id: crypto.randomBytes(4).toString('hex'),
      bon: pickupCode(),
      actor: req.actor.name,
      /* De bearer blijft bij de order en wordt niet nogmaals in de bontekst
         opgeslagen. De autoritatieve orderreferentie is genoeg voor audit. */
      desc: 'RTG-ophaalbestelling ' + o.ref,
      room: null,
      items: o.items, total: o.total, method: 'rtg',
      at: new Date().toISOString()
    };
    const list = db.data.posSales[req.supplier.code] = (db.data.posSales[req.supplier.code] || []);
    list.unshift(sale);
    db.data.posSales[req.supplier.code] = list.slice(0, 300);
    /* HIER wordt de bestelling afgerekend, dus hier hoort de factuur -- en
       nergens anders: betaalde het lid al in de app, dan is hij daar geboekt en
       staat deze tak (`if (!o.paid)`) niet aan. Deze bon krijgt method 'rtg' en
       wordt door financeVoor overgeslagen om dubbeltelling te vermijden; zonder
       de factuur hieronder viel de omzet daarmee helemaal buiten de btw.
       Via dezelfde routine als de app-kant (kern/lidacties/factuur.js), want
       twee wegen naar dezelfde bon horen dezelfde factuur op te leveren. */
    factuurVoorLid({ supplierCode: req.supplier.code, supplierNaam: req.supplier.name,
      codenaam: o.customerCodename, ref: o.ref, methode: 'rtg', regels: regelsVanItems(o.items) });
  }
  o.status = 'geserveerd';
  save();
  logActivity(req.supplier.code, req.actor, 'gaf bestelling ' + o.ref + ' uit'
    + (wasPaid ? '' : ' en rekende € ' + o.total + ' af (RTG)'));
  broadcastSync([o.customerTier], 'orders');
  sseToCustomer(o.customerKey || o.customerTier, 'sync', { scope: 'orders' });
  sseToOffice('sync', { scope: 'orders' });
  sseToSupplier(req.supplier.code, 'sync', { scope: 'pos' });
  notify(o.customerTier, { icon: 'ster', title: req.supplier.name, body: 'Uw bestelling is uitgegeven. Veel plezier.', scope: 'orders' });
  res.json({ ok: true, order: { ref: o.ref, codename: o.customerCodename, items: o.items, total: o.total, wasPaid }, sale });
});

};
