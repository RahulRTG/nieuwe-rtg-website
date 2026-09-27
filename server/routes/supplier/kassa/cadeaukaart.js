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
   daar alleen de betaalwijze. De grenzen van een verzilvering (de kaart is van
   DEZE zaak, het bedrag is echt een bedrag, er kan nooit meer af dan erop
   staat, en de claim is atomair) staan op een plek: kern/cadeaukaart.js.

   DE CODE bestaat kaal alleen in het antwoord op de verkoop en op een rotatie.
   metIdem BEWAART zijn antwoord (in kassaIdem) om het bij een herhaling terug
   te geven, en een bewaard antwoord met een kale code erin is de code op
   schijf. Daarom geeft het werk de code NIET terug: hij gaat in een doosje dat
   alleen deze aanroep ziet, en wordt pas NA metIdem aan een kopie gehangen.

   DE VERKOOP VAN EEN KAART IS NOG GEEN OMZET. Het saldo is een schuld aan de
   klant; het btw-moment is de inwisseling. Zie kern/fiscaal/index.js voor hoe
   de maandboekhouding daarmee rekent, en waarom een verzilvering `viaBon`
   draagt. */
module.exports = (kern, herhaling) => {
  const { app, cadeaukaart, logActivity, managerOnly, supplierAuth } = kern;
  const metIdem = herhaling.metEigenAfdruk;
  const vanZaak = (req, id) => g => g.id === String(id || '').slice(0, 40) && g.supplierCode === req.supplier.code;
  const fout = (res, r) => res.status(r.status || 409).json({ error: r.error, code: r.code });

app.post('/api/supplier/giftcard/sell', supplierAuth, async (req, res) => {
  const bedrag = Math.round(Number(req.body.bedrag));
  if (!(bedrag >= 10 && bedrag <= 5000)) return res.status(400).json({ error: 'Kies een bedrag tussen € 10 en € 5.000.' });
  const idem = req.body.idem ? 'gc:' + req.supplier.code + ':' + String(req.body.idem).slice(0, 60) : null;
  const doos = {};
  const r = await metIdem(idem, 'gc|' + req.supplier.code + '|' + bedrag, async () => {
    const u = await cadeaukaart.uitgeef({ supplierCode: req.supplier.code, supplierName: req.supplier.name,
      bedrag, kocht: req.actor.name + ' (kassa)', customerKey: null, issuer: 'zaak:' + req.supplier.code,
      idem: req.body.idem ? String(req.body.idem).slice(0, 60) : null });
    if (!u.ok) return u;
    doos.code = u.code;
    /* Een cadeaukaartcode draagt geld en hoort niet in het activiteitenlog. */
    logActivity(req.supplier.code, req.actor, 'verkocht een cadeaukaart van € ' + bedrag);
    return u.herhaald ? u : { ok: true, kaart: u.kaart };
  });
  if (r && r.error) return fout(res, r);
  if (r.herhaald || !doos.code) return res.json(Object.assign({}, r, { herhaald: true, codeGetoond: false,
    uitleg: 'De code is alleen bij de eerste keer getoond. Kwijt? Maak een nieuwe code; de oude vervalt dan.' }));
  res.json(Object.assign({}, r, { eenmalig: true, kaart: Object.assign({}, r.kaart, { code: doos.code }) }));
});

/* De LOSSE inwisseling is een handmatige saldo-correctie zonder kassabon. De
   maandboekhouding meldt hem apart en rekent hem niet als omzet of btw. Het
   antwoord noemt de kaart bij zijn id en nooit bij zijn code. */
app.post('/api/supplier/giftcard/redeem', supplierAuth, async (req, res) => {
  const r = await cadeaukaart.verzilver({ supplierCode: req.supplier.code, code: req.body.code,
    bedrag: req.body.bedrag, actor: req.actor.name, viaBon: null, idem: req.body.idem });
  if (!r.ok) return fout(res, r);
  if (!r.herhaald) logActivity(req.supplier.code, req.actor, 'boekte € ' + r.bedrag
    + ' met de hand af van een cadeaukaart (rest € ' + r.kaart.saldo + ', geen kassabon)');
  res.json({ ok: true, herhaald: !!r.herhaald, saldo: r.kaart.saldo, kaart: { id: r.kaart.id, saldo: r.kaart.saldo } });
});

/* Server-side intrekken en roteren door de zaak: de kaart hoort bij DEZE zaak
   en wordt bij haar id genoemd, nooit bij haar code. Intrekken laat het saldo
   staan (het is geld van de houder); roteren geeft een nieuwe code die alleen
   in dit antwoord staat -- en dat is werk van de manager: wie roteert, krijgt
   een code met saldo in handen. Intrekken mag elke medewerker, want een
   gestolen kaart dichtzetten hoort geen drempel te hebben. */
app.post('/api/supplier/giftcard/intrek', supplierAuth, async (req, res) => {
  const r = await cadeaukaart.intrek({ vind: vanZaak(req, req.body.id), door: 'zaak:' + req.supplier.code,
    reden: String(req.body.reden || '').slice(0, 120) || null });
  if (!r.ok) return fout(res, r);
  logActivity(req.supplier.code, req.actor, 'trok de code van een cadeaukaart in');
  res.json(r);
});

app.post('/api/supplier/giftcard/roteer', supplierAuth, async (req, res) => {
  if (!managerOnly(req, res)) return;
  const r = await cadeaukaart.roteer({ vind: vanZaak(req, req.body.id), door: 'zaak:' + req.supplier.code,
    idem: req.body.idem });
  if (!r.ok) return fout(res, r);
  logActivity(req.supplier.code, req.actor, 'gaf een cadeaukaart een nieuwe code');
  res.json(r);
});
};
