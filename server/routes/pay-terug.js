/* Domein "pay", de TERUGSTORTING: het saldo van een lid terug naar zijn eigen
   bankrekening.

   Afgesplitst van ./pay.js omdat dat bestand over de keuringsgrens ging, maar de
   snede is inhoudelijk: dit is het enige pad waar geld het huis verlaat richting
   het LID. Precies die weg maakte dat het besluit WALLET_SALDO van soort moest
   wisselen -- saldo dat inwisselbaar is tegen de nominale waarde is elektronisch
   geld -- en daarmee is dit de zwaarste route van de hele betaallaag.

   Drie routes, en de scheiding is niet toevallig. `/api/pay/rekening` raakt een
   PERSOONSGEGEVEN (het IBAN, in de identiteitskluis) en `/api/pay/terug` raakt
   GELD; ze horen apart te kunnen falen en apart te kunnen worden dichtgezet.
   `/api/pay/terugstand` vertelt wat er kan en wat er nog mist, zodat een scherm
   nooit een knop hoeft te tonen die zonder uitleg niet werkt -- bij geld belt
   iemand daar niet over, hij vertrouwt het niet meer.

   Alle drie langs de KYC-poort. Een gast zonder echt account komt er sowieso
   niet bij: er is dan geen dossier waar een rekening in kan staan. */
module.exports = (kern, { stuur, geenGast, kyc }) => {
  const { app, auth, liveCodename, pay } = kern;

  /* `terugstand` eerst: een scherm hoort te weten wat er kan vóór het een knop
     tekent. Het antwoord draagt de blokkades met hun reden, dus er hoeft nooit
     iets uitgegrijsd te staan zonder uitleg. */
  app.post('/api/pay/terugstand', auth, (req, res) => {
    if (geenGast(req, res)) return;
    if (kyc(req, res)) return;
    if (!pay.terugstortenStand) return res.status(501).json({ error: 'Terugstorten draait hier niet.' });
    stuur(res, pay.terugstortenStand({ codenaam: liveCodename(req.session), userId: (req.session.account && req.session.account.id) || null }));
  });
  app.post('/api/pay/rekening', auth, (req, res) => {
    if (geenGast(req, res)) return;
    if (kyc(req, res)) return;
    if (!pay.rekeningZet) return res.status(501).json({ error: 'Terugstorten draait hier niet.' });
    stuur(res, pay.rekeningZet({ userId: (req.session.account && req.session.account.id) || null, iban: req.body.iban, naam: req.body.naam }));
  });
  app.post('/api/pay/terug', auth, async (req, res) => {
    if (geenGast(req, res)) return;
    if (kyc(req, res)) return;
    if (!pay.terugstorten) return res.status(501).json({ error: 'Terugstorten draait hier niet.' });
    const r = await pay.terugstorten({ codenaam: liveCodename(req.session), userId: (req.session.account && req.session.account.id) || null,
      centen: req.body.centen, idem: req.body.idem });
    stuur(res, r);
  });

};
