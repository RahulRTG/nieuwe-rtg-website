/* Kassa (deelmodule): het afrekenen -- uitchecken per kamer of tafel, met
   splitsen. Krijgt de gedeelde kern een keer bij het opstarten vanuit
   routes/supplier/kassa.js.

   DE CADEAUKAARTEN STONDEN HIER OOK, en zijn eruit gehaald: dit bestand zat
   met 9642 bytes vlak onder de tienkilobyte-grens (npm run keuring, meter
   keuringOmvang) en het deed twee dingen. Verkopen en innen van kaarten woont
   nu in ./cadeaukaart.js, naast de regel die ze delen (./kaart.js). */
/* `herhaling` komt sinds main's idempotentieronde als tweede argument mee:
   het uitchecken staat binnen eenmalig() (zie kern/kassa/herhaling.js). */
module.exports = (kern, herhaling) => {
  const { app, crypto, db, facturatie, logActivity, pickupCode, save,
          sseToSupplier, supplierAuth, pay } = kern;
  // dezelfde factuurroutine als de app-kant; zie kern/lidacties/factuur.js
  const { maakFactuurVoorLid, regelsVanItems } = require('../../../kern/lidacties/factuur');
  const factuurVoorLid = maakFactuurVoorLid(facturatie);
/* Dezelfde herhalingslaag als de verkoop hiernaast: uitchecken sluit lasten
   EN maakt een bon, dus een tweede aankomst van hetzelfde verzoek zou een
   tweede bon geven op lasten die al gesloten zijn. Zie kern/kassa/herhaling.js. */
app.post('/api/supplier/pos/checkout', supplierAuth, async (req, res) => {
 const antwoord = await herhaling.eenmaligVast('checkout', req.supplier.code, req.body, async () => {
  const room = String(req.body.room || '').slice(0, 60);
  const method = ['rtgpay', 'contant'].includes(req.body.method) ? req.body.method : 'contant';
  const list = db.data.posSales[req.supplier.code] = (db.data.posSales[req.supplier.code] || []);
  const open = list.filter(s => (s.method === 'kamer' || s.method === 'tafel') && !s.settled && s.room === room);
  if (!open.length) return { status: 404, error: 'Geen open rekening voor deze kamer of tafel.' };
  let total = 0;
  for (const s of open) total += s.total;
  // eerst het geld (bij RTG Pay via de betaalcode), dan pas de lasten sluiten
  let betaler = null, betaaldienstKosten = 0;
  if (method === 'rtgpay') {
    /* TWEE DRAGERS, EEN INNING (kern/pay/kasinnen.js). Hier stond `pay.kasInt`
       rechtstreeks, en daarmee nam deze ingang alleen de code van zes tekens:
       wie zijn QR ophield -- sinds RTG Link een ondertekende verwijzing -- kon
       hier niet afrekenen, terwijl hij dat bij dezelfde kassa een knop verderop
       wel kon. Dat is geen besluit maar een halve verhuizing. */
    const p = await kern.kasInnen({
      supplierCode: req.supplier.code, supplierNaam: req.supplier.name,
      code: req.body.payCode, centen: Math.round(total * 100),
      oms: 'Check-out ' + room + ', ' + req.supplier.name, idem: req.body.idem
    });
    if (p.error) return { status: p.status || 400, error: p.error };
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
    at: require('../../../lib/klok').datum().toISOString()
  };
  list.unshift(sale);
  db.data.posSales[req.supplier.code] = list.slice(0, 300);
  // na het uitchecken staat de kamer automatisch op "vuil" voor housekeeping
  const rm = (req.supplier.rooms || []).find(r => r.name === room);
  if (rm) rm.hk = { status: 'vuil', by: 'Systeem (check-out)', at: require('../../../lib/klok').datum().toISOString() };
  // en een afgerekende tafel staat weer vrij voor de volgende gasten
  const tf = (req.supplier.tables || []).find(t => t.name === room);
  if (tf) tf.status = 'vrij';
  save();
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
  return { ok: true, sale, betaler, gesplitst, splitsFout };
 });
 if (antwoord && antwoord.error) return res.status(antwoord.status || 400).json({ error: antwoord.error });
 res.json(antwoord);
});

/* Houd de opslagdeur in deze bestaande kassamodule. De tafelticketworkflow
   krijgt alleen de twee operaties die zij nodig heeft en wordt daarmee geen
   tweede rechtstreekse schrijver in db.data. */
require('./tafelticket-afrekenen')(kern, { factuurVoorLid, regelsVanItems }, {
  posSalesVan(code) {
    return db.data.posSales[code] = (db.data.posSales[code] || []);
  },
  bewaarPosSales(code, lijst) { db.data.posSales[code] = lijst; }
});

};
