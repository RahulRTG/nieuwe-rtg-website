/* Kassa (deelmodule): cadeaukaarten verkopen en met de hand afboeken. Krijgt de
   gedeelde kern een keer bij het opstarten vanuit routes/supplier/kassa.js.

   Waarom dit een eigen bestand is: het stond in ./afrekenen.js, dat over het
   afrekenen van kamers en tafels gaat. Een cadeaukaart verkopen heeft daar
   niets mee te maken, en dat bestand liep tegen de omvangsgrens uit
   keuringsregel 13. Dit is de natuurlijke naad.

   HET INWISSELEN STAAT HIER NIET. Dat is sinds TAKEN.md 4.27 een BETAALWIJZE
   aan de kassa (./verkoop.js, `method: 'cadeaukaart'`): daar draagt de bon de
   omzet, de btw en de factuur, en trekt diezelfde bon het saldo af. Wat hier
   staat is het correctiemiddel -- alleen saldo eraf, zonder bon en dus zonder
   omzet -- en financeVoor meldt apart hoeveel er zo is afgeboekt. */
module.exports = (kern) => {
  const { app, db, gcCode, logActivity, save, supplierAuth } = kern;
  /* EEN DUBBELTIK GAF HIER TWEE KAARTEN MET SALDO (TAKEN.md 4.55), en die zijn
     allebei inwisselbaar -- de zaak geeft het tweede bedrag weg. Dezelfde module
     als RTG Pay en RTG Bank, met een eigen store zodat de sleutelruimtes
     gescheiden blijven. De afdruk draagt de zaak en het bedrag; dat is wat een
     verzoek hier bepaalt. */
  const metIdem = require('../../../lib/idem')({ d: () => db.data, save, naam: 'kassaIdem', bijeen: db.bijeen });

app.post('/api/supplier/giftcard/sell', supplierAuth, async (req, res) => {
  const bedrag = Math.round(Number(req.body.bedrag));
  if (!(bedrag >= 10 && bedrag <= 5000)) return res.status(400).json({ error: 'Kies een bedrag tussen € 10 en € 5.000.' });
  const idem = req.body.idem ? 'gc:' + req.supplier.code + ':' + String(req.body.idem).slice(0, 60) : null;
  const r = await metIdem(idem, 'gc|' + req.supplier.code + '|' + bedrag, () => {
    const kaart = { code: gcCode(), supplierCode: req.supplier.code, supplierName: req.supplier.name, bedrag, saldo: bedrag,
      kocht: req.actor.name + ' (kassa)', customerKey: null, at: new Date().toISOString(), verzilveringen: [] };
    db.data.giftcards.unshift(kaart);
    db.data.giftcards = db.data.giftcards.slice(0, 20000);
    save();
    logActivity(req.supplier.code, req.actor, 'verkocht een cadeaukaart van € ' + bedrag + ' (' + kaart.code + ')');
    return { ok: true, kaart };
  });
  if (r && r.error) return res.status(r.status || 409).json({ error: r.error });
  res.json(r);
});

app.post('/api/supplier/giftcard/redeem', supplierAuth, (req, res) => {
  const code = String(req.body.code || '').trim().toUpperCase();
  const g = (db.data.giftcards || []).find(x => x.code === code && x.supplierCode === req.supplier.code);
  if (!g) return res.status(404).json({ error: 'Deze cadeaukaart kennen we hier niet.' });
  const bedrag = Math.round(Number(req.body.bedrag) * 100) / 100;
  if (!(bedrag > 0)) return res.status(400).json({ error: 'Geen geldig bedrag.' });
  if (bedrag > g.saldo) return res.status(409).json({ error: 'Onvoldoende saldo: er staat nog € ' + g.saldo + ' op deze kaart.' });
  g.saldo = Math.round((g.saldo - bedrag) * 100) / 100;
  g.verzilveringen = g.verzilveringen || [];
  /* `bron: 'handmatig'`: alleen SALDO af, dus geen omzet, btw of factuur. De
     gewone weg is de kassa met betaalwijze 'cadeaukaart' (TAKEN.md 4.27). */
  g.verzilveringen.push({ bedrag, at: new Date().toISOString(), actor: req.actor.name, bron: 'handmatig' });
  save();
  logActivity(req.supplier.code, req.actor, 'boekte € ' + bedrag + ' met de hand af van cadeaukaart ' + g.code + ' (rest € ' + g.saldo + ', geen kassabon)');
  res.json({ ok: true, saldo: g.saldo, kaart: { code: g.code, saldo: g.saldo } });
});
};
