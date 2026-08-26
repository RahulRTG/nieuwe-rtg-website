/* RTG Pay, de WAARDEKANT van een lid: wat heeft hij, waar zit het vast, en waar
   kwam het vandaan.

   AFGESPLITST VAN ./pay.js omdat dat bestand over de keuringsgrens van 10240
   byte ging, en het is een eerlijke snede en geen willekeurige. Alles in pay.js
   gaat over WAT EEN LID DOET met zijn wallet -- opladen, sturen, een verzoek,
   een tikcode, een kascode. Dit gaat over WAT HIJ HEEFT: de portefeuille (sinds
   een lid een maaltijdbudget of een gemeentetegoed kan hebben, is "wat heb ik"
   een lijst met regels erbij en geen getal) en de waardegraaf (waar kwam het
   vandaan, en waarheen). Twee vragen, twee bestanden.

   Krijgt `stuur` en `geenGast` mee van ./pay.js, net als ./pay-terug en
   ./pay-zaak: die twee horen bij de aanroeper en niet bij dit onderwerp. */
'use strict';

module.exports = (kern, { geenGast }) => {
  const { app, auth, liveCodename, pay } = kern;

  /* ---- de portefeuille van het lid ----
     Niet hetzelfde als /overzicht: dat gaat over zijn wallet, dit over ALLES
     wat hij heeft. Sinds een lid een maaltijdbudget of een gemeentetegoed kan
     hebben, is "wat heb ik" een lijst met regels erbij en geen getal. */
  app.post('/api/pay/portefeuille', auth, (req, res) => {
    if (geenGast(req, res)) return;
    if (!pay.portefeuille) return res.json({ ok: true, posities: [], vrijBesteedbaar: 0, gebonden: 0 });
    res.json(pay.portefeuille(liveCodename(req.session)));
  });

  /* ---- de waardegraaf van het lid ----
     Niet "wat is er gebeurd" (dat is /overzicht) maar "waar ging mijn geld
     heen". Alles hier is afgeleid uit het grootboek; er wordt niets apart
     geteld. */
  app.post('/api/pay/graaf', auth, (req, res) => {
    if (geenGast(req, res)) return;
    if (!pay.graafVanLid) return res.json({ ok: true, bronnen: [], bestemmingen: [] });
    res.json(pay.graafVanLid(liveCodename(req.session), { dagen: req.body.dagen }));
  });

};
