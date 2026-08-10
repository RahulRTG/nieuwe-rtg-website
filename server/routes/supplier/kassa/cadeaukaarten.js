/* Kassa (deelmodule): de cadeaukaarten -- verkopen en innen.

   Losgeknipt van ./afrekenen.js toen dat bestand door de reparatie van
   TAKEN.md 4.27 over de 10 kB-grens ging. De naad lag er al: uitchecken en het
   tafelticket gaan over EEN rekening die wordt afgewikkeld, een cadeaukaart is
   een eigen tegoed met een eigen levensloop.

   Krijgt de gedeelde kern een keer bij het opstarten vanuit
   routes/supplier/kassa.js. */
module.exports = (kern) => {
  const { app, crypto, db, facturatie, gcCode, logActivity, pickupCode, save, sseToSupplier, supplierAuth } = kern;
  // het verzilveren zelf staat op EEN plek; zie kern/cadeaukaart.js
  const cadeaukaart = require('../../../kern/cadeaukaart');

app.post('/api/supplier/giftcard/sell', supplierAuth, (req, res) => {
  const bedrag = Math.round(Number(req.body.bedrag));
  if (!(bedrag >= 10 && bedrag <= 5000)) return res.status(400).json({ error: 'Kies een bedrag tussen € 10 en € 5.000.' });
  const kaart = { code: gcCode(), supplierCode: req.supplier.code, supplierName: req.supplier.name, bedrag, saldo: bedrag,
    kocht: req.actor.name + ' (kassa)', customerKey: null, at: new Date().toISOString(), verzilveringen: [] };
  db.data.giftcards.unshift(kaart);
  db.data.giftcards = db.data.giftcards.slice(0, 20000);
  save();
  logActivity(req.supplier.code, req.actor, 'verkocht een cadeaukaart van € ' + bedrag + ' (' + kaart.code + ')');
  res.json({ ok: true, kaart });
});

/* Een cadeaukaart innen aan de balie, zonder dat de kassa er een bon bij
   aanslaat. Dit IS die bon: het btw-moment van een meervoudig inwisselbare
   kaart is de inwisseling, dus hier ontstaat de omzet en hier hoort de
   factuur.

   Tot TAKEN.md 4.27 gebeurde er alleen het eerste stukje (saldo eraf) en telde
   de maandboekhouding het bedrag ernaast nog eens op als `gcIngewisseld`. Dat
   gaf twee gevolgen: de btw-aangifte, die het factuurregister telt, miste de
   omzet, en een zaak die de bon WEL aansloeg telde hem dubbel. Beide zijn met
   dezelfde beweging weg -- de inwisseling is een gewone kassabon met
   betaalwijze 'cadeaukaart'. Slaat de kassa de bon zelf aan, dan gaat dat via
   /api/supplier/pos/sale met dezelfde betaalwijze en ontstaat er hier niets. */
app.post('/api/supplier/giftcard/redeem', supplierAuth, (req, res) => {
  const v = cadeaukaart.verzilver(db, req.supplier.code, req.body.code, req.body.bedrag, req.actor.name);
  if (v.error) return res.status(v.status || 400).json({ error: v.error });
  const g = v.kaart, bedrag = v.bedrag;
  const sale = {
    id: crypto.randomBytes(4).toString('hex'), bon: pickupCode(), actor: req.actor.name,
    desc: 'Cadeaukaart ' + g.code, room: null, items: null,
    total: bedrag, method: 'cadeaukaart', betaler: null, kaart: g.code,
    at: new Date().toISOString()
  };
  const list = db.data.posSales[req.supplier.code] = (db.data.posSales[req.supplier.code] || []);
  list.unshift(sale);
  db.data.posSales[req.supplier.code] = list.slice(0, 300);
  save();
  /* De factuur langs dezelfde motor als de gewone kassaverkoop, zodat deze
     omzet in het factuurregister staat en dus in de btw-aangifte. Hij faalt
     niet stil: de melder in kern/lidacties/factuur.js telt een misser op het
     techniekbord. */
  facturatie.boekMetCodenaam({
    soort: 'verkoop', verkoperCode: req.supplier.code, verkoperNaam: req.supplier.name,
    koper: { naam: 'Kasklant' }, regels: [{ omschrijving: 'Cadeaukaart ' + g.code, aantal: 1, stuk: bedrag }],
    methode: 'cadeaukaart', ref: sale.id
  }, null).catch(() => {});
  logActivity(req.supplier.code, req.actor, 'inde € ' + bedrag + ' van cadeaukaart ' + g.code + ' (rest € ' + g.saldo + ')');
  sseToSupplier(req.supplier.code, 'sync', { scope: 'pos' });
  res.json({ ok: true, saldo: g.saldo, sale, kaart: { code: g.code, saldo: g.saldo } });
});
};
