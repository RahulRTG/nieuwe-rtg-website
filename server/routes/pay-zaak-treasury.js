/* RTG Pay, de ZAAK die geld apart zet en vooruit vastlegt: de treasury (btw en
   loonreserve automatisch opzij) en de pre-autorisatie (vooraf vastzetten,
   vastleggen, vrijgeven).

   AFGESPLITST VAN ./pay-zaak.js omdat dat bestand over de keuringsgrens van
   10240 byte ging, en de snede loopt langs de TIJD. Alles wat daar overblijft
   gaat over geld dat NU beweegt: een budget geven, innen aan de kassa, tegoed
   klaarzetten, uitbetalen. Dit gaat over geld dat blijft STAAN met een
   bestemming -- opzij voor de belasting, of vastgehouden tot een levering
   klopt. Dat zijn twee soorten belofte en ze horen niet in een bestand.

   Krijgt `stuurZaak` en `sseToOffice` mee van ./pay-zaak.js. stuurZaak is
   BEWUST niet dezelfde als de `stuur` van ./pay.js: een zaak krijgt bij een
   weigering een generieker antwoord dan een lid, en die regel staat op een
   plek -- zie de toelichting bovenaan pay-zaak.js. */
'use strict';

module.exports = (kern, { stuurZaak }) => {
  const { app, supplierAuth, managerOnly, pay, sseToOffice } = kern;

  /* ---- de treasury van de zaak ----
     Geld dat binnenkomt is niet hetzelfde als geld dat van u is: er zit btw in
     en er komt een loonrun aan. De zaak stelt percentages in en bij elke
     ontvangst gaat dat deel meteen apart. Het heeft tanden omdat `uitbetaal`
     hieronder BESCHIKBAAR uitbetaalt en niet het saldo -- zonder die helft is
     een btw-reservering een getal dat de volgende uitbetaling meeneemt.
     Instellen en vrijgeven zijn geldhandelingen en vragen de manager. */
  app.post('/api/supplier/pay/treasury', supplierAuth, (req, res) => {
    stuurZaak(res, pay.treasuryStand(req.supplier.code));
  });
  app.post('/api/supplier/pay/treasury/zet', supplierAuth, (req, res) => {
    if (!managerOnly(req, res)) return;
    stuurZaak(res, pay.treasuryZet(req.supplier.code, req.body || {}));
  });
  app.post('/api/supplier/pay/treasury/apart', supplierAuth, (req, res) => {
    if (!managerOnly(req, res)) return;
    stuurZaak(res, pay.treasuryApart(req.supplier.code, req.body || {}));
  });
  app.post('/api/supplier/pay/treasury/vrij', supplierAuth, (req, res) => {
    if (!managerOnly(req, res)) return;
    stuurZaak(res, pay.treasuryVrij(req.supplier.code, String(req.body.id || '')));
  });

  /* ---- vooraf vastzetten: de pre-autorisatie ----
     Drie handelingen van de ZAAK op een code van het lid: een maximum
     vastzetten, later het werkelijke bedrag vastleggen, of vrijgeven. Het lid
     heeft er geen eigen knop voor -- hij toont dezelfde kassacode als altijd en
     ziet het vastgezette bedrag terug in zijn overzicht. Dat is met opzet: een
     borg vastzetten is iets wat een zaak vraagt, en een tweede soort code zou
     het lid laten kiezen tussen twee dingen die voor hem hetzelfde zijn. */
  app.post('/api/supplier/pay/vooraf', supplierAuth, async (req, res) => {
    const r = await pay.kasVooraf({ supplierCode: req.supplier.code, code: req.body.code,
      maxCenten: req.body.maxCenten, oms: req.body.oms, idem: req.body.idem, urenGeldig: req.body.urenGeldig });
    if (r.ok) sseToOffice('sync', { scope: 'pay' });
    stuurZaak(res, r);
  });
  app.post('/api/supplier/pay/vastleg', supplierAuth, async (req, res) => {
    const r = await pay.kasVastleg({ supplierCode: req.supplier.code, reservering: req.body.reservering,
      centen: req.body.centen, oms: req.body.oms, idem: req.body.idem, genre: req.supplier.type });
    if (r.ok) sseToOffice('sync', { scope: 'pay' });
    stuurZaak(res, r);
  });
  app.post('/api/supplier/pay/vrijgeef', supplierAuth, (req, res) => {
    stuurZaak(res, pay.kasVrijgeef({ supplierCode: req.supplier.code, reservering: req.body.reservering }));
  });
  app.post('/api/supplier/pay/vooraf/lijst', supplierAuth, (req, res) => {
    stuurZaak(res, pay.voorafVanZaak(req.supplier.code));
  });

  // de partnerkant: code innen aan de kassa, saldo zien, uitbetalen
};
