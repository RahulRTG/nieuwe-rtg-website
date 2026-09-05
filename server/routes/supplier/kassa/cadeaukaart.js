/* Kassa (deelmodule): CADEAUKAARTEN -- verkopen aan de balie en losse
   inwisselingen. Krijgt de gedeelde kern een keer bij het opstarten vanuit
   routes/supplier/kassa.js.

   WAAROM DIT EEN EIGEN BESTAND IS. Het stond in ./afrekenen.js, en dat bestand
   ging over uitchecken; twee onderwerpen in een module die met 9642 bytes vlak
   onder de tienkilobyte-grens zat. De keuring wees hem aan (meter
   keuringOmvang) en het advies was "knip er een deelbestand af zolang het
   rustig kan" -- dit is dat deelbestand.

   WAT HIER NIET STAAT: de kassabon die MET een cadeaukaart wordt betaald. Dat
   is ./verkoop.js, want dat is een verkoop en geen kaarthandeling; de kaart is
   daar alleen de betaalwijze. De drie grenzen van een verzilvering (de kaart is
   van DEZE zaak, het bedrag is echt een bedrag, er kan nooit meer af dan erop
   staat) delen ze via ./kaart.js.

   DE VERKOOP VAN EEN KAART IS NOG GEEN OMZET. Het saldo is een schuld aan de
   klant; het btw-moment is de inwisseling. Zie kern/fiscaal/index.js voor hoe
   de maandboekhouding daarmee rekent, en waarom een verzilvering `viaBon`
   draagt. */
const moneyCredentialBlokkade = require('../../../middleware/money-credential-productiepoort').blokkade;

module.exports = (kern, herhaling) => {
  const { app, db, gcCode, logActivity, save, supplierAuth } = kern;
  const metIdem = herhaling.metEigenAfdruk;
  // dezelfde drie grenzen als de kassabon die met een kaart betaalt
  const { verzilver: verzilverKaart } = require('./kaart');

app.post('/api/supplier/giftcard/sell', supplierAuth, async (req, res) => {
  const dicht = moneyCredentialBlokkade('pay.giftcard_value_code');
  if (dicht) return res.status(dicht.status).json(dicht);
  const bedrag = Math.round(Number(req.body.bedrag));
  if (!(bedrag >= 10 && bedrag <= 5000)) return res.status(400).json({ error: 'Kies een bedrag tussen € 10 en € 5.000.' });
  const idem = req.body.idem ? 'gc:' + req.supplier.code + ':' + String(req.body.idem).slice(0, 60) : null;
  const r = await metIdem(idem, 'gc|' + req.supplier.code + '|' + bedrag, () => {
    const kaart = { code: gcCode(), supplierCode: req.supplier.code, supplierName: req.supplier.name, bedrag, saldo: bedrag,
      kocht: req.actor.name + ' (kassa)', customerKey: null, at: new Date().toISOString(), verzilveringen: [] };
    db.data.giftcards.unshift(kaart);
    db.data.giftcards = db.data.giftcards.slice(0, 20000);
    save();
    /* Een cadeaukaartcode draagt geld en hoort niet in het activiteitenlog. */
    logActivity(req.supplier.code, req.actor, 'verkocht een cadeaukaart van € ' + bedrag);
    return { ok: true, kaart };
  });
  if (r && r.error) return res.status(r.status || 409).json({ error: r.error });
  res.json(r);
});

/* De LOSSE inwisseling is een handmatige saldo-correctie zonder kassabon. De
   maandboekhouding meldt hem apart en rekent hem niet als omzet of btw. */
app.post('/api/supplier/giftcard/redeem', supplierAuth, (req, res) => {
  const dicht = moneyCredentialBlokkade('pay.giftcard_value_code');
  if (dicht) return res.status(dicht.status).json(dicht);
  const r = verzilverKaart(db, req.supplier.code, req.body.code, req.body.bedrag, req.actor.name, null);
  if (r.error) return res.status(r.status).json({ error: r.error });
  save();
  logActivity(req.supplier.code, req.actor, 'boekte € ' + r.bedrag
    + ' met de hand af van een cadeaukaart (rest € ' + r.kaart.saldo + ', geen kassabon)');
  res.json({ ok: true, saldo: r.kaart.saldo, kaart: { code: r.kaart.code, saldo: r.kaart.saldo } });
});
};
