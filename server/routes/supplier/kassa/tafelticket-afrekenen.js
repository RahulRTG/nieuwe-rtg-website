/* Het tafelticket is de gebundelde afrekening van meerdere open bonnen. Het
   losse kamer-/tafeluitchecken blijft in afrekenen.js; hier staat de eigen
   zegelcontrole, facturatie en kassabon van deze tweede workflow. */
'use strict';

module.exports = (kern, factuur, opslag) => {
  const { app, crypto, logActivity, notify, pickupCode, save, sseToCustomer,
    sseToOffice, sseToSupplier, supplierAuth, tafelticket } = kern;
  const factuurVoorLid = factuur.factuurVoorLid, regelsVanItems = factuur.regelsVanItems;
  const nu = () => require('../../../lib/klok').datum().toISOString();

  app.post('/api/supplier/tafelticket', supplierAuth, (req, res) => {
    const r = tafelticket.bouwTicket(req.supplier, req.body.table);
    if (r.error) return res.status(r.status).json({ error: r.error });
    res.json(r);
  });

  app.post('/api/supplier/tafelticket/afrekenen', supplierAuth, (req, res) => {
    const chk = tafelticket.afrekenCheck(req.supplier, req.body.table, req.body.zegel, req.body.at);
    if (chk.error) return res.status(chk.status).json({ error: chk.error });
    const method = ['rtgpay', 'contant', 'rtg'].includes(req.body.method) ? req.body.method : 'contant';
    const codenames = [];
    for (const o of chk.bonnen) {
      o.paid = true;
      o.paidAt = nu();
      o.betaaldMet = method;
      if (o.status === 'wacht-op-betaling' || o.status === 'nieuw') o.status = 'geserveerd';
      o.rekeningVoldaan = true;
      if (!codenames.includes(o.customerCodename)) codenames.push(o.customerCodename);
      /* De gebundelde kassabon hieronder vervangt de factuur per bestelling
         niet; de boekhouding en btw-aangifte lezen juist die bronbonnen. */
      factuurVoorLid({ supplierCode: req.supplier.code, supplierNaam: req.supplier.name,
        codenaam: o.customerCodename, ref: o.ref, methode: method, regels: regelsVanItems(o.items) });
      sseToCustomer(o.customerKey || o.customerTier, 'sync', { scope: 'orders' });
      notify(o.customerKey, { icon: '\u{1F9FE}', title: req.supplier.name,
        body: 'De rekening aan ' + chk.table + ' is voldaan. Bedankt en tot ziens.', scope: 'orders' });
    }
    /* `omzetElders` voorkomt dubbeltelling: de omzet staat al op de betaalde
       bestellingen; deze rij is het kassastuk voor het gezamenlijke ticket. */
    const sale = {
      id: crypto.randomBytes(4).toString('hex'), bon: pickupCode(), actor: req.actor.name,
      desc: 'Tafelticket ' + chk.table + ' (' + chk.bonnen.length + ' bon(nen), ' + codenames.length + ' gast(en))',
      room: chk.table, items: null, total: chk.subtotaal, method, omzetElders: 'bestellingen', at: nu()
    };
    const list = opslag.posSalesVan(req.supplier.code);
    list.unshift(sale);
    opslag.bewaarPosSales(req.supplier.code, list.slice(0, 300));
    const tf = (req.supplier.tables || []).find(t => t.name === chk.table);
    if (tf) tf.status = 'vrij';
    save();
    logActivity(req.supplier.code, req.actor, 'rekende tafelticket ' + chk.table + ' af: € ' + chk.subtotaal +
      ' (' + chk.bonnen.length + ' bon(nen), ' + method + ')');
    sseToSupplier(req.supplier.code, 'sync', { scope: 'orders' });
    sseToSupplier(req.supplier.code, 'sync', { scope: 'pos' });
    sseToOffice('sync', { scope: 'orders' });
    res.json({ ok: true, sale, table: chk.table, aantalBonnen: chk.bonnen.length,
      subtotaal: chk.subtotaal, gasten: codenames.length });
  });
};
