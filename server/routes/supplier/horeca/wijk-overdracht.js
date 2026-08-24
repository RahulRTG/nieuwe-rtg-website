/* Horeca OS (deellaag): EEN WIJK OVERDRAGEN -- de deuren.

   De regels staan in kern/horeca/wijk-overdracht.js (bieden, aanvaarden,
   intrekken), kern/horeca/wijk-antwoord.js (weigeren, en dat antwoord aan
   laten komen) en kern/horeca/wijk-leen.js (de uitgeleende tafel). Hier staat
   alleen de deur.

   WAAROM DIT NAAST ./wijk.js STAAT EN NIET ERIN. Daar wonen de KAART en de
   DIENST: welke tafels bij welke wijk horen (de leiding) en wie hem nu draagt
   (de mens). Hier woont het HERVERDELEN midden in een dienst. Dat zijn twee
   soorten handelingen van twee soorten mensen, en toen ze in een bestand
   stonden liep dat tegen de 10 KB aan -- de snede lag toch al op die naad.

   ZES DEUREN MET DEZELFDE ROMP: een persoonlijke inlog, de handeling, het
   journaal, en een duw naar de andere schermen. De romp staat een keer; de
   PADEN staan voluit, want een pad dat wordt opgebouwd is voor de schakelkast
   onzichtbaar en telt nergens mee (keuringsregel 45). */
'use strict';

module.exports = (kern) => {
  const { app, save, schoon, supplierAuth, logActivity, sseToSupplier, horeca } = kern;
  const { H } = horeca;
  const over = require('../../../kern/horeca/wijk-overdracht')({ horeca, schoon });
  const leen = require('../../../kern/horeca/wijk')({ horeca, schoon }).leen;

  const wieVan = (req) => ({ staffId: req.actor.staffId == null ? null : String(req.actor.staffId),
    naam: req.actor.name, manager: !!req.actor.manager });

  const deur = (doen, zin) => (req, res) => {
    const ik = wieVan(req);
    if (ik.staffId == null) return res.status(403).json({ error: 'Alleen vanaf een persoonlijke inlog.' });
    const uit = doen(H(req.supplier.code), req, ik);
    if (uit.error) return res.status(uit.status || 400).json({ error: uit.error, code: uit.code || null });
    save();
    logActivity(req.supplier.code, req.actor, zin(uit));
    sseToSupplier(req.supplier.code, 'sync', { scope: 'horeca' });
    res.json(uit);
  };

  /* Waar een aanbod over gaat komt uit de kern (wijk-doos.js); het journaal
     zet er alleen de wijk omheen, want over een half jaar wil je in die regel
     kunnen lezen uit WELKE wijk die twee tafels kwamen. */
  const doos = require('../../../kern/horeca/wijk-doos');
  const wat = (o) => o.tafels ? doos.wat(o) + ' uit wijk "' + o.wijkNaam + '"' : 'wijk "' + o.wijkNaam + '"';

  /* De ploeg van deze zaak, zodat een aanbod niet bij een verzonnen staffId kan
     landen. Hier en niet in de kern: wie er bestaat is een vraag voor de
     identiteitslaag. Faalt die, dan komt er een lege lijst uit en gaat het
     aanbod niet door -- zie de kop van bied() voor waarom dat de veilige kant
     is. */
  const ploegVan = (code) => {
    try { return (kern.accounts.listStaff(code) || []).map((x) => String(x.id)); }
    catch (e) { return []; }
  };

  app.post('/api/supplier/horeca/wijk/bied', supplierAuth, deur(
    (h, req, ik) => over.bied(h, { wijkId: req.body.wijkId, naarId: req.body.naarId,
      naarNaam: req.body.naarNaam, tafels: req.body.tafels,
      ploeg: ploegVan(req.supplier.code) }, ik),
    (u) => 'bood ' + wat(u.overdracht) + ' aan ' + (u.overdracht.naarNaam || 'een collega')));

  app.post('/api/supplier/horeca/wijk/aanvaard', supplierAuth, deur(
    (h, req, ik) => over.aanvaard(h, req.body.overdrachtId, ik),
    (u) => 'nam ' + wat(u.overdracht) + ' over van ' + u.overdracht.vanNaam));

  app.post('/api/supplier/horeca/wijk/trek-in', supplierAuth, deur(
    (h, req, ik) => over.trekIn(h, req.body.overdrachtId, ik),
    (u) => 'trok het aanbod van ' + wat(u.overdracht) + ' in'));

  /* Weigeren doet de gevraagde, en alleen die -- zie de kop van
     kern/horeca/wijk-antwoord.js voor waarom een manager dat niet namens iemand
     doet. De reden staat in het journaal, want "waarom niet" is precies wat een
     maître een half uur later wil weten. */
  app.post('/api/supplier/horeca/wijk/weiger', supplierAuth, deur(
    (h, req, ik) => over.weiger(h, req.body.overdrachtId, ik, req.body.reden),
    (u) => 'weigerde ' + wat(u.overdracht) + ' van ' + u.overdracht.vanNaam +
      (u.overdracht.reden ? ' (' + u.overdracht.reden + ')' : '')));

  app.post('/api/supplier/horeca/wijk/gezien', supplierAuth, deur(
    (h, req, ik) => over.gezien(h, req.body.overdrachtId, ik),
    (u) => 'zag de weigering van ' + wat(u.overdracht)));

  /* Een uitgeleende tafel teruggeven. Kan door wie hem leende, wie hem
     uitleende, en een manager -- alle drie de mensen die er iets mee te maken
     hebben, want een leen die niemand kan beëindigen is een leen die blijft
     staan tot iemand naar huis gaat. */
  app.post('/api/supplier/horeca/wijk/tafel-terug', supplierAuth, deur(
    (h, req, ik) => leen.terug(h, req.body.tafel, ik),
    (u) => 'gaf tafel ' + u.leen.tafel + ' terug aan ' + (u.leen.wijkNaam || 'de zaal')));
};
