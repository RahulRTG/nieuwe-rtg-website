/* Kantoren, deel "regie": de boardroom-schakelkast en wat RTG platformbreed
   bijstuurt -- functies aan/uit (globaal, per doelgroep, per genre, in EEN klik
   per fase of alles ineens), Rahuls karakteraanvulling, de geld-regie (pasprijzen,
   partnervergoeding, ledenvoordeel), de Mall-regie, de paniekkamer (knoppen
   worden voorstellen) en de wereldkaart. Afgesplitst uit kantoren/index.js. */
/* Wie handelt hier: uit de canonieke envelop en niet uit req.boardroomKey
   (TAKEN.md 4.72). Zie server/opzet/envelop.js voor waarom die lezer bestaat. */
const { wie: envelopWie } = require('../../opzet/envelop');

module.exports = (ctx) => {
  const { app, officeAuth, boardroomAuth, boardroomLijst, keyVanCodenaam, veilig, afdelingen,
          sseToOffice, db, save, kern } = ctx;

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

  /* De sleutel van de kamer: de eigenaar geeft toegang op codenaam en trekt
     hem ook weer in. De lijst toont alleen codenamen; namen blijven in de kluis. */
  app.post('/api/office/boardroom/toegang', boardroomAuth, (req, res) => veilig(res, () =>
    ({ status: 200, ok: true, baas: !!req.boardroomBaas, lijst: boardroomLijst().map(t => ({ codenaam: t.codenaam, sinds: t.at })) })));
  app.post('/api/office/boardroom/toegang/geef', boardroomAuth, async (req, res) => {
    try {
      if (!req.boardroomBaas) return res.status(403).json({ error: 'Alleen de eigenaar geeft boardroom-toegang.' });
      const t = await keyVanCodenaam(req.body.codenaam);
      if (!t) return res.status(404).json({ error: 'Deze codenaam kennen we niet.' });
      const lijst = boardroomLijst();
      if (!lijst.some(x => x.key === t.key)) {
        lijst.push({ key: t.key, codenaam: t.codename, at: new Date().toISOString() });
        save();
        afdelingen.audit('eigenaar', 'Boardroom-toegang gegeven aan ' + t.codename);
      }
      res.json({ ok: true, lijst: lijst.map(x => ({ codenaam: x.codenaam, sinds: x.at })) });
    } catch (e) { console.error('[boardroom]', e); res.status(500).json({ error: 'Er ging iets mis. Probeer het opnieuw.' }); }
  });
  app.post('/api/office/boardroom/toegang/weg', boardroomAuth, (req, res) => veilig(res, () => {
    if (!req.boardroomBaas) return { status: 403, error: 'Alleen de eigenaar trekt boardroom-toegang in.' };
    const wie = String(req.body.codenaam || '').trim().toLowerCase();
    const lijst = boardroomLijst();
    const rest = lijst.filter(x => String(x.codenaam || '').toLowerCase() !== wie);
    if (rest.length !== lijst.length) {
      db.data.boardroomToegang = rest;
      save();
      afdelingen.audit('eigenaar', 'Boardroom-toegang ingetrokken van ' + req.body.codenaam);
    }
    return { status: 200, ok: true, lijst: rest.map(x => ({ codenaam: x.codenaam, sinds: x.at })) };
  }));
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
