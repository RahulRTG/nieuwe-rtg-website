/* Kassa (deelmodule): het inwisselen aan de kassa. Afgesplitst uit
   ./verkoop.js toen die met main's idempotentieronde en de kaartimport samen
   door de 10 kB-maat ging; zie daar voor de verkoopstroom. */
'use strict';
module.exports = (kern) => {
  const { maakFactuurVoorLid, regelsVanItems } = require('../../../kern/lidacties/factuur');
  const factuurVoorLid = maakFactuurVoorLid(kern.facturatie);
  const { app, broadcastSync, crypto, db, logActivity, notify, ordersVanZaak, pickupCode, save, sseToCustomer, sseToOffice, sseToSupplier, supplierAuth } = kern;
  app.post('/api/supplier/pos/redeem', supplierAuth, (req, res) => {
  const code = String(req.body.code || '').trim().toUpperCase();
  if (!code) return res.status(400).json({ error: 'Voer een ophaalcode in.' });
  const o = ordersVanZaak(req.supplier.code).find(x => x.pickup === code);
  if (!o) return res.status(404).json({ error: 'Onbekende code voor dit bedrijf.' });
  if (o.refunded || o.status === 'geweigerd') return res.status(409).json({ error: 'Deze bestelling is geannuleerd.' });
  if (o.status === 'geserveerd') return res.status(409).json({ error: 'Code ' + code + ' is al uitgegeven.' });
  const wasPaid = o.paid;
  let sale = null;
  if (!o.paid) {
    // afrekenen via RTG-lidmaatschap; komt als omzet in het dagoverzicht
    o.paid = true;
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
      desc: 'RTG-code ' + code + ' (' + o.ref + ')',
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
  logActivity(req.supplier.code, req.actor, 'gaf bestelling ' + o.ref + ' uit op code ' + code + (wasPaid ? '' : ' en rekende € ' + o.total + ' af (RTG)'));
  broadcastSync([o.customerTier], 'orders');
  sseToCustomer(o.customerKey || o.customerTier, 'sync', { scope: 'orders' });
  sseToOffice('sync', { scope: 'orders' });
  sseToSupplier(req.supplier.code, 'sync', { scope: 'pos' });
  notify(o.customerTier, { icon: 'ster', title: req.supplier.name, body: 'Uw bestelling is uitgegeven. Veel plezier.', scope: 'orders' });
  res.json({ ok: true, order: { ref: o.ref, codename: o.customerCodename, items: o.items, total: o.total, wasPaid }, sale });
});
};
