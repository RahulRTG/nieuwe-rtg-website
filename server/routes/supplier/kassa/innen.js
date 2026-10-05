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

   DE CODE IS GEEN BONNUMMER MEER. Tot 27 september 2026 zocht deze route op
   `o.pickup`: vier tekens, ongeveer 20 bits, kaal opgeslagen en overal te zien.
   Dat veld is nu een label voor keuken en pas en autoriseert niets. De kassa
   scant de afhaal-QR van het lid (128 bits) en kern/afhaalcode.js claimt die
   in EEN collectietransactie, samen met het besluit of hier wordt afgerekend.
   Deze route voert daarna alleen de projectie op de order uit.

   HERHALEN. Een tweede scan van dezelfde code geeft 409. Stuurt de kassa een
   `idem` mee en herhaalt ze na een time-out, dan krijgt ze het vastgelegde
   besluit terug (`herhaald`) -- zonder tweede afrekening, en met de projectie
   alsnog als die bij de eerste poging niet was gelukt. */
module.exports = (kern) => {
  const { app, broadcastSync, crypto, db, facturatie, logActivity, notify, pickupCode, save,
          sseToCustomer, sseToOffice, sseToSupplier, supplierAuth, orderMetRef, afhaalcode } = kern;
  // dezelfde factuurroutine als de app-kant; zie kern/lidacties/factuur.js
  const { maakFactuurVoorLid, regelsVanItems } = require('../../../kern/lidacties/factuur');
  const factuurVoorLid = maakFactuurVoorLid(facturatie);

app.post('/api/supplier/pos/redeem', supplierAuth, async (req, res) => {
  let uit;
  try {
    uit = await afhaalcode.claim({ code: req.body.code, supplierCode: req.supplier.code,
      actor: req.actor && (req.actor.staffId || req.actor.name),
      idempotentieSleutel: req.body.idem, orderVan: orderMetRef });
  } catch (e) {
    return res.status(503).json({ error: 'De afhaalcode kon niet veilig worden gecontroleerd. Er is niets uitgegeven.' });
  }
  if (uit.error) return res.status(uit.status).json({ error: uit.error });
  const o = orderMetRef(uit.ref);
  if (!o) return res.status(404).json({ error: 'Bestelling niet gevonden.' });
  /* De projectie van het vastgelegde besluit. Afrekenen gebeurt alleen als de
     claim dat besliste EN de order nog niet op betaald staat: een herhaling na
     een geslaagde projectie rekent dus nooit een tweede keer af. */
  const wasPaid = !uit.afgerekend;
  let sale = null;
  if (uit.afgerekend && !o.paid) {
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
  if (uit.herhaald && o.status === 'geserveerd' && !sale)
    return res.json({ ok: true, herhaald: true, order: { ref: o.ref, codename: o.customerCodename,
      bon: o.pickup || null, items: o.items, total: o.total, wasPaid }, sale: null });
  o.status = 'geserveerd';
  save();
  logActivity(req.supplier.code, req.actor, 'gaf bestelling ' + o.ref + ' uit'
    + (wasPaid ? '' : ' en rekende € ' + o.total + ' af (RTG)'));
  broadcastSync([o.customerTier], 'orders');
  sseToCustomer(o.customerKey || o.customerTier, 'sync', { scope: 'orders' });
  sseToOffice('sync', { scope: 'orders' });
  sseToSupplier(req.supplier.code, 'sync', { scope: 'pos' });
  notify(o.customerKey, { icon: 'ster', title: req.supplier.name, body: 'Uw bestelling is uitgegeven. Veel plezier.', scope: 'orders' });
  res.json({ ok: true, herhaald: !!uit.herhaald, order: { ref: o.ref, codename: o.customerCodename, bon: o.pickup || null,
    items: o.items, total: o.total, wasPaid }, sale });
});

};
