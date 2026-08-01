/* De papierwerk-deur: EEN implementatie, meerdere plekken die hem ophangen.

   Het papierwerk (KvK, aanspreekpunt, FG, bewaartermijnen, verwerkers, wie er
   bij een datalek gebeld wordt) hing alleen aan de technische pagina. De
   eigenaar wilde het in de BOARDROOM kunnen inleveren, bewerken en bijwerken --
   en dat is ook de juiste plek: dit is bestuurswerk, geen systeembeheer.

   Wat NIET gebeurt: een tweede implementatie. Twee deuren naar dezelfde
   gegevens met elk hun eigen code is precies de fout die in deze codebase al
   een reeks keren is opgeruimd -- ze lopen uiteen zodra iemand er een aanraakt,
   en dan verschilt wat de ene deur toelaat van wat de andere toelaat. Vandaar
   dit bestand: de handlers staan hier een keer, en techniek en de boardroom
   hangen ze allebei op met hun eigen poortwachter.

   ACHTER DE EIGENAAR, OVERAL. Hier komen het KvK-nummer, het privenummer van
   de jurist en de afspraak wie er om drie uur 's nachts gebeld wordt. Dat is
   geen informatie voor iedereen met een kantoorsessie, en ook niet voor
   iedereen die op het techniekbord mag. De aanroeper levert daarom zowel de
   poort (auth) als de eigenaar-controle mee.

   Rahul verzint hier nooit iets -- zie de kop van server/papieren/vragen.js.
   De server neemt alleen aan wat een mens intypt. */
const papieren = require('../papieren');
const { log } = require('../log');

/* prefix : het pad zonder /papieren, bv. '/api/office'
   poort   : de middleware(s) die voor elke route komen
   wie     : (req) => naam van de invuller, voor het spoor
   isBaas  : (req) => is dit de eigenaar? (per plek anders bewezen) */
module.exports = function papierenDeur({ app, prefix, poort, wie, isBaas }) {
  const wachters = [].concat(poort || []);
  const alleenBaas = (req, res, next) => {
    if (isBaas && !isBaas(req)) return res.status(403).json({ error: 'Alleen de eigenaar komt bij het papierwerk.' });
    next();
  };
  const naam = (req) => { try { return wie ? wie(req) : null; } catch (e) { return null; } };

  /* De stand plus de eerstvolgende vraag in een antwoord: het bord hoeft niet
     twee keer te vragen, en Rahul heeft altijd meteen iets te zeggen. */
  app.get(prefix + '/papieren', ...wachters, alleenBaas, (req, res) => {
    res.json({ ...papieren.overzicht(), volgende: papieren.volgende() });
  });
  /* Dezelfde stand via POST. De boardroom praat overal met POST + Bearer; een
     GET zou daar de enige uitzondering zijn, en uitzonderingen in de
     toegangsvorm zijn precies waar later gaten in vallen. */
  app.post(prefix + '/papieren', ...wachters, alleenBaas, (req, res) => {
    res.json({ ...papieren.overzicht(), volgende: papieren.volgende() });
  });

  /* Een antwoord vastleggen, wijzigen of parkeren -- alle drie dezelfde
     handeling: het antwoord op vraag X is voortaan dit. Parkeren
     ({ parkeer: true }) telt gewoon als open, en de go-live-keuring blijft er
     dan op blokkeren. Dat is bewust: "ik weet het nog niet" hoort zichtbaar te
     blijven, niet weg te vallen. */
  app.post(prefix + '/papieren/antwoord', ...wachters, alleenBaas, (req, res) => {
    const b = req.body || {};
    const r = papieren.antwoord(b.id, b.waarde, { parkeer: !!b.parkeer, door: naam(req) });
    if (r.fout) return res.status(400).json({ error: r.fout });
    // WAT er geantwoord is blijft uit het logboek: dit zijn juist de gegevens
    // die we nergens dubbel willen hebben. Alleen dat er iets is vastgelegd.
    log.info('papieren-antwoord', { vraag: String(b.id || ''), geparkeerd: !!r.geparkeerd });
    res.json({ ...r, ...papieren.overzicht(), volgende: papieren.volgende() });
  });

  /* Het ingevulde document, om te lezen of af te drukken. Bewust plat tekst:
     dit is het papier dat je tijdens een datalek naast je toetsenbord wilt
     hebben liggen, niet iets dat door een systeem heen moet. */
  const doc = (req, res) => {
    const naamIn = (req.query && req.query.naam) || (req.body && req.body.naam) || '';
    const d = papieren.document(naamIn);
    if (d.fout) return res.status(404).json({ error: d.fout });
    res.json(d);
  };
  app.get(prefix + '/papieren/document', ...wachters, alleenBaas, doc);
  app.post(prefix + '/papieren/document', ...wachters, alleenBaas, doc);

  // welke documenten er zijn, zodat het scherm ze niet hoeft te kennen
  app.post(prefix + '/papieren/documenten', ...wachters, alleenBaas, (req, res) => {
    res.json({ documenten: Object.keys(papieren.DOCUMENTEN).map(n => ({ naam: n, waarvoor: papieren.DOCUMENTEN[n].waarvoor })) });
  });
};
