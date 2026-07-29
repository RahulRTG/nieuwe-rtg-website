/* Techniek (deelmodule): het papierwerk dat Rahul uitvraagt.

   Hier stond in twee markdown-bestanden een rij [VUL IN]-plekken. Niemand vult
   een invullijst in, dus stond het er nog steeds. Nu vraagt Rahul het uit: één
   vraag per keer, met erbij waaróm hij het vraagt, en het antwoord landt
   meteen op de goede plek in het document.

   Alles achter eigenaarAlleen. Niet uit gewoonte: hier komen het KvK-nummer,
   het privénummer van de jurist en de afspraak wie er 's nachts gebeld wordt.
   Dat is geen informatie voor iedereen met toegang tot het techniekbord.

   Rahul verzint hier nooit iets -- zie de kop van server/papieren/vragen.js.
   De server neemt alleen aan wat een mens intypt.

   Gemount vanuit routes/techniek.js. */
const papieren = require('../../papieren');
const { log } = require('../../log');

module.exports = (tctx) => {
  const { app, accounts, techAuth, eigenaarAlleen } = tctx;

  const wie = (req) => {
    try { return req.techUser ? accounts.realNameOf(req.techUser) : null; }
    catch (e) { return null; }
  };

  /* De stand plus de eerstvolgende vraag in één antwoord: het bord hoeft niet
     twee keer te vragen, en Rahul heeft altijd meteen iets te zeggen. */
  app.get('/api/techniek/papieren', techAuth, eigenaarAlleen, (req, res) => {
    res.json({ ...papieren.overzicht(), volgende: papieren.volgende() });
  });

  /* Een antwoord vastleggen. Parkeren mag ({ parkeer: true }) en telt gewoon
     als open -- de go-live-keuring blijft er dan op blokkeren. Dat is bewust:
     "ik weet het nog niet" hoort zichtbaar te blijven, niet weg te vallen. */
  app.post('/api/techniek/papieren/antwoord', techAuth, eigenaarAlleen, (req, res) => {
    const b = req.body || {};
    const r = papieren.antwoord(b.id, b.waarde, { parkeer: !!b.parkeer, door: wie(req) });
    if (r.fout) return res.status(400).json({ error: r.fout });
    // WAT er geantwoord is blijft uit het logboek: dit zijn juist de gegevens
    // die we nergens dubbel willen hebben. Alleen dát er iets is vastgelegd.
    log.info('papieren-antwoord', { vraag: String(b.id || ''), geparkeerd: !!r.geparkeerd });
    res.json({ ...r, ...papieren.overzicht(), volgende: papieren.volgende() });
  });

  /* Het ingevulde document, om te lezen of af te drukken. Bewust plat tekst:
     dit is het papier dat je tijdens een datalek naast je toetsenbord wilt
     hebben liggen, niet iets dat door een systeem heen moet. */
  app.get('/api/techniek/papieren/document', techAuth, eigenaarAlleen, (req, res) => {
    const d = papieren.document((req.query && req.query.naam) || '');
    if (d.fout) return res.status(404).json({ error: d.fout });
    res.json(d);
  });
};
