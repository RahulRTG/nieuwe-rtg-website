/* Kassa (deelmodule): het afrekenen van een RESTANT REKENING -- uitchecken per
   kamer of tafel (met splitsen), en het tafelticket dat alle bonnen van een
   tafel in een keer voldoet. De cadeaukaarten stonden hier ook en zijn bij de
   reparatie van TAKEN.md 4.27 naar ./cadeaukaarten.js gegaan: dit bestand ging
   daardoor over de 10 kB-grens, en de naad lag er al -- hier wordt een
   openstaande rekening afgewikkeld, daar leeft een eigen tegoed.
   Krijgt de gedeelde kern een keer bij het opstarten vanuit
   routes/supplier/kassa.js. */
module.exports = (kern) => {
  const { app, crypto, db, facturatie, logActivity, notify, pickupCode, save, sseToCustomer, sseToOffice,
          sseToSupplier, supplierAuth, pay, tafelticket } = kern;
  // dezelfde factuurroutine als de app-kant; zie kern/lidacties/factuur.js
  const { maakFactuurVoorLid, regelsVanItems } = require('../../../kern/lidacties/factuur');
  const factuurVoorLid = maakFactuurVoorLid(facturatie);
app.post('/api/supplier/pos/checkout', supplierAuth, async (req, res) => {
  const room = String(req.body.room || '').slice(0, 60);
  const method = ['rtgpay', 'contant'].includes(req.body.method) ? req.body.method : 'contant';
  const list = db.data.posSales[req.supplier.code] = (db.data.posSales[req.supplier.code] || []);
  const open = list.filter(s => (s.method === 'kamer' || s.method === 'tafel') && !s.settled && s.room === room);
  if (!open.length) return res.status(404).json({ error: 'Geen open rekening voor deze kamer of tafel.' });
  let total = 0;
  for (const s of open) total += s.total;
  // eerst het geld (bij RTG Pay via de betaalcode), dan pas de lasten sluiten
  let betaler = null, betaaldienstKosten = 0;
  if (method === 'rtgpay') {
    const p = await pay.kasInt({
      supplierCode: req.supplier.code, code: req.body.payCode,
      centen: Math.round(total * 100), oms: 'Check-out ' + room + ', ' + req.supplier.name,
      idem: req.body.idem
    });
    if (p.error) return res.status(p.status || 400).json({ error: p.error });
    betaler = p.van;
    // de kosten van de betaaldienst, per transactie DIRECT verrekend met de zaak
    betaaldienstKosten = p.kosten || 0;
  }
  for (const s of open) s.settled = true;
  const sale = {
    id: crypto.randomBytes(4).toString('hex'),
    bon: pickupCode(),
    actor: req.actor.name,
    desc: (open[0].method === 'tafel' ? 'Rekening ' : 'Check-out ') + room + ' (' + open.length + ' post(en))',
    room, items: null, total, method, betaler,
    betaaldienstKosten: betaaldienstKosten || null,
    at: new Date().toISOString()
  };
  list.unshift(sale);
  db.data.posSales[req.supplier.code] = list.slice(0, 300);
  // na het uitchecken staat de kamer automatisch op "vuil" voor housekeeping
  const rm = (req.supplier.rooms || []).find(r => r.name === room);
  if (rm) rm.hk = { status: 'vuil', by: 'Systeem (check-out)', at: new Date().toISOString() };
  // en een afgerekende tafel staat weer vrij voor de volgende gasten
  const tf = (req.supplier.tables || []).find(t => t.name === room);
  if (tf) tf.status = 'vrij';
  save();
  /* HIER de factuur, en op precies EEN plek voor alles wat op deze rekening
     stond. Dit is het moment waarop de kamer- of tafellasten omzet worden: de
     losse posten zijn uitstel en tellen niet mee (kern/fiscaal/kasomzet.js),
     deze gebundelde bon wel.

     Dat is bij het bouwen van 4.28 twee keer verkeerd om gegaan en het hoort
     hier te staan. Eerst stond de factuur hier WEL terwijl /pos/sale er ook al
     een boekte -- dan verdubbelt de aangifte, en de toets liet dat meteen
     zien. Toen is hij hier weggehaald, en toen bleef 4.29 over: de logies bij
     het inchecken en de minibar zetten hun kamerlast rechtstreeks neer, buiten
     /pos/sale om, en die omzet kwam dus NOOIT in het factuurregister en dus
     nooit in de aangifte. Nu boekt /pos/sale niets voor 'kamer' en 'tafel' en
     boekt deze route het geheel: een moment, ongeacht langs welke weg de post
     op de rekening kwam. */
  facturatie.boekMetCodenaam({
    soort: 'verkoop', verkoperCode: req.supplier.code, verkoperNaam: req.supplier.name,
    koper: { naam: betaler || room || 'Kasklant' },
    regels: [{ omschrijving: sale.desc, aantal: 1, stuk: total }],
    methode: method, ref: sale.id
  }, betaler).catch(() => {});
  logActivity(req.supplier.code, req.actor, 'checkte ' + room + ' uit: € ' + total + ' (' + method + ')');
  sseToSupplier(req.supplier.code, 'sync', { scope: 'pos' });
  /* Splitsen vanaf de rekening: de betaler rekent het geheel af met RTG Pay
     en de tafelgenoten krijgen meteen een Klompje voor hun deel, uit naam
     van de betaler. Ketst het splitsen af (onbekende codenaam), dan blijft
     de betaling gewoon staan en komt de reden mee terug. */
  let gesplitst = null, splitsFout = null;
  const splitsMet = Array.isArray(req.body.splitsMet) ? req.body.splitsMet.filter(x => typeof x === 'string' && x.trim()).slice(0, 10) : [];
  if (betaler && splitsMet.length) {
    const v = await pay.verzoekMaak({
      van: betaler, aan: splitsMet, totaalCenten: Math.round(total * 100),
      oms: 'Rekening ' + room + ', ' + req.supplier.name, splitsMetMij: true
    });
    if (v.error) splitsFout = v.error;
    else gesplitst = { vrienden: splitsMet.length, perPersoon: v.perPersoon };
  }
  res.json({ ok: true, sale, betaler, gesplitst, splitsFout });
});

/* Tafelticket: alle openstaande bonnen van dezelfde tafel op EEN ticket. De AI
   (Rahul) en de kassa lopen over deze route, dus met de inlog en de controles
   van de zaak zelf. De beveiliging zit in de kern (HMAC-zegel + verse controle). */
app.post('/api/supplier/tafelticket', supplierAuth, (req, res) => {
  const r = tafelticket.bouwTicket(req.supplier, req.body.table);
  if (r.error) return res.status(r.status).json({ error: r.error });
  res.json(r);
});

// het tafelticket in EEN keer afrekenen. Het meegestuurde zegel (uit /tafelticket)
// wordt vers gecontroleerd: is de rekening intussen gewijzigd of gemanipuleerd,
// dan weigert de kern en moet het ticket opnieuw worden opgehaald. Zo nooit
// afrekenen op een oud of aangepast totaal, en nooit dubbel.
app.post('/api/supplier/tafelticket/afrekenen', supplierAuth, (req, res) => {
  const chk = tafelticket.afrekenCheck(req.supplier, req.body.table, req.body.zegel, req.body.at);
  if (chk.error) return res.status(chk.status).json({ error: chk.error });
  const method = ['rtgpay', 'contant', 'rtg'].includes(req.body.method) ? req.body.method : 'contant';
  const codenames = [];
  for (const o of chk.bonnen) {
    o.paid = true;
    o.paidAt = new Date().toISOString();
    if (o.status === 'wacht-op-betaling' || o.status === 'nieuw') o.status = 'geserveerd';
    o.rekeningVoldaan = true;
    if (!codenames.includes(o.customerCodename)) codenames.push(o.customerCodename);
    /* EEN FACTUUR PER BON, ook al gaat er EEN kassabon overheen. De gebundelde
       bon hieronder is het kassastuk van de zaak; de boekhouding en de
       btw-aangifte tellen per bestelling, dus daar hoort de factuur op te
       staan. Zonder deze regel viel een tafel die in EEN keer afrekent buiten
       het factuurregister -- zie kern/lidacties/factuur.js. */
    factuurVoorLid({ supplierCode: req.supplier.code, supplierNaam: req.supplier.name,
      codenaam: o.customerCodename, ref: o.ref, methode: method, regels: regelsVanItems(o.items) });
    sseToCustomer(o.customerKey || o.customerTier, 'sync', { scope: 'orders' });
    notify(o.customerKey || o.customerTier, { icon: '\u{1F9FE}', title: req.supplier.name, body: 'De rekening aan ' + chk.table + ' is voldaan. Bedankt en tot ziens.', scope: 'orders' });
  }
  /* Een gebundelde kassabon voor het hele tafelticket: het kassastuk van de
     zaak. Hij draagt `omzetElders`, want de omzet staat al op de bestellingen
     hierboven -- die staan in db.data.orders en worden daar geteld. Zonder dat
     merk telde de maandboekhouding de tafel twee keer: een keer per bon en
     een keer als bundel (TAKEN.md 4.28). Wie de bon telt, vraagt het aan
     kern/fiscaal/kasomzet.js. */
  const sale = {
    id: crypto.randomBytes(4).toString('hex'), bon: pickupCode(), actor: req.actor.name,
    desc: 'Tafelticket ' + chk.table + ' (' + chk.bonnen.length + ' bon(nen), ' + codenames.length + ' gast(en))',
    room: chk.table, items: null, total: chk.subtotaal, method,
    omzetElders: 'bonnen',
    at: new Date().toISOString()
  };
  const list = db.data.posSales[req.supplier.code] = (db.data.posSales[req.supplier.code] || []);
  list.unshift(sale);
  db.data.posSales[req.supplier.code] = list.slice(0, 300);
  // de tafel staat na afrekenen weer vrij voor de volgende gasten
  const tf = (req.supplier.tables || []).find(t => t.name === chk.table);
  if (tf) tf.status = 'vrij';
  save();
  logActivity(req.supplier.code, req.actor, 'rekende tafelticket ' + chk.table + ' af: € ' + chk.subtotaal + ' (' + chk.bonnen.length + ' bon(nen), ' + method + ')');
  sseToSupplier(req.supplier.code, 'sync', { scope: 'orders' });
  sseToSupplier(req.supplier.code, 'sync', { scope: 'pos' });
  sseToOffice('sync', { scope: 'orders' });
  res.json({ ok: true, sale, table: chk.table, aantalBonnen: chk.bonnen.length, subtotaal: chk.subtotaal, gasten: codenames.length });
});
};
