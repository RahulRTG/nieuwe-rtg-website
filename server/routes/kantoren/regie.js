/* Kantoren, deel "regie": de boardroom-schakelkast en wat RTG platformbreed
   bijstuurt -- functies aan/uit (globaal, per doelgroep, per genre, in EEN klik
   per fase of alles ineens), Rahuls karakteraanvulling, de geld-regie (pasprijzen,
   partnervergoeding, ledenvoordeel), de Mall-regie, de paniekkamer (knoppen
   worden voorstellen) en de wereldkaart. Afgesplitst uit kantoren/index.js. */
/* Wie handelt hier: uit de canonieke envelop en niet uit req.boardroomKey
   (TAKEN.md 4.72). Zie server/opzet/envelop.js voor waarom die lezer bestaat. */
const { wie: envelopWie } = require('../../opzet/envelop');

module.exports = (ctx) => {
  const { app, officeAuth, boardroomAuth, veilig, afdelingen,
          sseToOffice, db, save, kern, zwaar, boardroomUser } = ctx;

  /* DE PRIJS VAN DE HERKOMSTPOORT, opgeteld over alle gesprekken.

     Hij hoort hier omdat dit de kamer is waar platformbrede knoppen worden
     omgezet, en `RTG_HERKOMST_AFDWINGEN` is er zo een. CONTROLPLANE.md zegt dat
     je niet kunt afdwingen wat nooit in de schaduw heeft gelopen -- maar een
     schaduw die niemand kan LEZEN, is geen schaduw. Deze route is die leesweg.

     Achter de BOARDROOMdeur: dit getal weegt of `RTG_HERKOMST_AFDWINGEN`
     omgaat, en dat is een platformbreed besluit van dezelfde soort als de
     bankstand ernaast -- geen dagelijks kantoorwerk, dus de leesladder van
     KANTOORMACHT.md gaat er niet over. Zie kern/stuur/schaduwtelling.js voor
     waarom er geen journaal onder ligt. */
  app.post('/api/office/stuur/herkomstschaduw', boardroomAuth, (req, res) => veilig(res, () =>
    ({ status: 200, ok: true, ...require('../../kern/stuur/schaduwtelling').stand() })));

  /* Het loket om een zware bevestiging in de boardroom te starten. De poort
     zelf staat in ./index.js; hier hangt alleen de deur. */
  app.post('/api/office/boardroom/bevestig/opties', boardroomAuth, async (req, res) => {
    const r = await zwaar.opties(boardroomUser(req), String(req.body.actie || ''),
      zwaar.sessieSleutel(req), req);
    if (r.error) return res.status(r.status || 400).json({ error: r.error });
    res.json(r);
  });

  /* De deur van de boardroom: alles hieronder loopt door de boardroom-poort
     (alleen de eigenaar, of wie van hem de sleutel kreeg). Het overige
     kantoor blijft op de gewone office-inlog werken. */
  app.post('/api/office/boardroom', boardroomAuth, (req, res) => veilig(res, () => ({ status: 200, ...afdelingen.boardroom(), baas: !!req.boardroomBaas })));

  /* HET PAPIERWERK, IN DE BOARDROOM.

     De 18 vragen (KvK, aanspreekpunt, FG, bewaartermijnen, verwerkers, wie er
     bij een datalek gebeld wordt) hingen alleen aan de technische pagina. Dat
     is de verkeerde plek: dit is bestuurswerk, geen systeembeheer, en het is de
     eigenaar die het moet inleveren, bijwerken en bijstellen.

     De handlers staan in ../papieren-deur.js en zijn dezelfde als op het
     techniekbord -- een tweede implementatie zou uiteenlopen zodra iemand er
     een aanraakt. Alleen de poort verschilt: hier de boardroomdeur, en
     daarbovenop req.boardroomBaas, want boardroom-toegang is niet hetzelfde
     als eigenaar zijn. Wie de sleutel van de kamer kreeg, hoeft nog niet het
     privenummer van de jurist te zien. */
  require('../papieren-deur')({
    app,
    prefix: '/api/office',
    poort: boardroomAuth,
    isBaas: (req) => !!req.boardroomBaas,
    wie: (req) => envelopWie(req)
  });

  /* De sleutel van de kamer (lijst, geven, intrekken) staat in ./regie-toegang.js
     -- afgesplitst voor de 10 KB van keuringsregel 13. Zelfde context, zelfde poort. */
  require('./regie-toegang')(ctx);
  /* De schakelroutes van de kast (globaal, fijn, genre, de grote hendel en de
     uitrolfases) staan in ./regie-schakel.js -- afgesplitst voor de 10 KB van
     keuringsregel 13. Zelfde context, zelfde poort. */
  require('./regie-schakel')(ctx);

  /* De AI-regie: de boardroom vult Rahuls karakter en verhaal aan. De
     vaste kern van het karakter blijft in de code staan (bewaakt door de
     drift-tests); deze aanvullingen komen live in ELKE assistent mee. */
  app.post('/api/office/boardroom/rahul', boardroomAuth, (req, res) => {
    res.json({ ok: true, profiel: db.data.rahulProfiel || { karakter: '', verhaal: '' } });
  });
  app.post('/api/office/boardroom/rahul/zet', boardroomAuth, (req, res) => {
    const kort = v => String(v == null ? '' : v).trim().slice(0, 2000);
    db.data.rahulProfiel = { karakter: kort(req.body.karakter), verhaal: kort(req.body.verhaal), at: new Date().toISOString() };
    save();
    sseToOffice('sync', { scope: 'boardroom' });
    res.json({ ok: true, profiel: db.data.rahulProfiel });
  });

  /* De Mall-regie: vanuit de boardroom elke leverancier in de RTG Mall bijstellen
     of verbergen (etage, tagline, actie). Het eigen-merk beheert RTG apart. */
  app.post('/api/office/mall', officeAuth, (req, res) => veilig(res, () => kern.mall.beheer()));
  app.post('/api/office/mall/zet', boardroomAuth, (req, res) => veilig(res, () => {
    const r = kern.mall.beheerZet(String(req.body.code || ''), req.body.patch || req.body || {});
    if (r.ok) sseToOffice('sync', { scope: 'mall' });
    return r;
  }));

  require('./geld')(ctx);

  // de paniekkamer: knoppen worden voorstellen; de boardroom besluit
  app.post('/api/office/paniek', officeAuth, (req, res) => veilig(res, () => afdelingen.paniekLijst()));
  app.post('/api/office/paniek/stel', officeAuth, (req, res) => veilig(res, () => {
    const r = afdelingen.paniekStel({ functie: String(req.body.functie || ''), aan: req.body.aan === true, doelgroep: req.body.doelgroep ? String(req.body.doelgroep) : null, reden: req.body.reden });
    if (r.ok) sseToOffice('sync', { scope: 'paniek' });
    return r;
  }));
  app.post('/api/office/paniek/besluit', boardroomAuth, (req, res) => veilig(res, () => {
    const r = afdelingen.paniekBesluit(String(req.body.id || ''), String(req.body.besluit || ''));
    if (r.ok) sseToOffice('sync', { scope: 'paniek' });
    return r;
  }));
  app.post('/api/office/paniek/bericht', officeAuth, (req, res) => veilig(res, () => afdelingen.paniekBericht(String(req.body.id || ''), String(req.body.wie || ''), req.body.tekst)));

  // de wereld: alles in het veld als bolletje (groen oke, oranje uit, rood
  // storing), met reset- en hulpknoppen; elke knop komt in het auditlog
  app.post('/api/office/wereld', officeAuth, (req, res) => veilig(res, () => afdelingen.wereld()));
  app.post('/api/office/wereld/actie', boardroomAuth, (req, res) => veilig(res, () => {
    const r = afdelingen.wereldActie(String(req.body.id || ''), String(req.body.actie || ''), req.body.naam);
    if (r.ok) sseToOffice('sync', { scope: 'wereld' });
    return r;
  }));
};
