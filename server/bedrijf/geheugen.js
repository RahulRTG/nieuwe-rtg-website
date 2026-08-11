/* RTG Werk OS (deellaag): het geheugen van een besluit.

   DE VRAAG DIE DIT BEANTWOORDT. "Waarom hebben we dit gedaan?", drie jaar
   later. En de omgekeerde: "welke besluiten raken dit contract?" Het Werk OS
   had de besluitvorming al -- voorstel, adviesronde met bezwaren, stemronde,
   uitkomst, evaluatiedatum -- maar een besluit hing aan niets. Het ging over
   een leverancier, een project of een release, en nergens stond wélke.

   WAAROM DIT EEN EXPLICIETE KOPPELING IS EN GEEN GEMETEN. De rest van deze
   laag leunt op kern/command/kwaliteit.js, dat verwijzingen MEET uit de
   gegevens. Dat kan hier niet, en dat is geen tekortkoming van die meter maar
   een eigenschap van wat we vastleggen: een besluit raakt MEERDERE objecten,
   dus het is een lijst, en zowel de meting als de afhankelijkhedenscan van
   object.js slaan lijsten over (een veld dat soms een sleutel bevat is geen
   verwijzing). Deze koppeling wordt dus geschreven door een mens en
   teruggelezen door dit bestand -- en juist daarom staat hij hier apart, met
   de regels eromheen zichtbaar.

   DRIE REGELS DIE HET GEHEUGEN DRAGEN, en alle drie komen ze uit dezelfde
   vraag: wat is dit over drie jaar nog waard?

   1. EEN KOPPELING DRAAGT WAT HET TOEN WAS. Niet alleen `{type, id}` maar ook
      de titel op het moment van koppelen. Een contract wordt hernoemd, een
      project wordt opgeruimd -- en dan is "besluit 14 juni ging over c8f1a"
      geen antwoord meer. Met de titel van toen staat er nog steeds wat er
      besloten werd, ook als het object weg is.
   2. EEN KOPPELING VERDWIJNT NIET, HIJ WORDT INGETROKKEN MET EEN REDEN. Wie
      een verkeerde koppeling kan wissen, kan de geschiedenis herschrijven --
      en dan is dit geen geheugen maar een prikbord. Ingetrokken staat er als
      ingetrokken, met wie en waarom.
   3. IEDERE LEZER LOST DE OBJECTEN OP MET ZIJN EIGEN REGISTER. Wie het recht
      voor een soort mist, krijgt niet de titel maar een TELLING met de reden
      -- dezelfde vorm die de kennisbank al gebruikt (`verborgen: n`), want een
      lijst die de titel wel toont is de afscherming kwijt.

   EN DE EVALUATIE IS DE ANDERE HELFT. Het Werk OS eiste al een evaluatiedatum
   bij elk aangenomen besluit ("een besluit zonder terugkijkmoment is een
   besluit dat nooit fout kan zijn geweest") maar er was geen route om op te
   schrijven WAT die evaluatie opleverde. Een datum zonder uitkomst is een
   agendapunt. Evaluaties stapelen: een besluit mag over drie jaar anders
   uitpakken dan na drie maanden, en dan horen ze allebei te staan. */
'use strict';

const { maakWerkRegister } = require('../kern/werkcommand/register');

const UITKOMSTEN = ['klopte', 'klopte niet', 'gemengd'];

module.exports = (sctx) => {
  const { app, db, save, schoon, nu, rid, dag, werkPoort, log, eigenVeld } = sctx;
  const B = (w) => sctx.BESLUITEN(w);
  const raaktVan = (b) => (Array.isArray(b.raakt) ? b.raakt : (b.raakt = []));

  const besluitVan = (req, res, g) => {
    const b = eigenVeld(B(g.w), String((req.body || {}).besluitId || ''));
    if (!b) { res.status(404).json({ error: 'Dat besluit kennen we niet.' }); return null; }
    return b;
  };

  /* ---------- koppelen: dit besluit gaat over DIT object ---------- */
  app.post('/api/bedrijf/besluit/raakt', (req, res) => {
    const g = werkPoort(req, res, 'besluit'); if (!g) return;
    const b = besluitVan(req, res, g); if (!b) return;
    const type = schoon(req.body.type, 30);
    const id = schoon(req.body.id, 64);
    if (!type || !id) return res.status(400).json({ error: 'Welk object: geef een soort en een id.' });

    /* De koppeling wordt hier BEWEZEN en niet geloofd: het object moet bestaan
       in het register van degene die koppelt. Daarmee vallen twee dingen
       tegelijk om -- een id dat niet bestaat, en een object dat de koppelaar
       zelf niet mag zien. Dat laatste is de belangrijkste: anders is dit veld
       een manier om te toetsen welke ids er in een gesloten module bestaan. */
    const register = maakWerkRegister(g.w.code, g.rechten);
    const soort = register.OP_TYPE.get(type);
    const rij = soort ? register.vindRij(db, type, id) : null;
    if (!soort || !rij) return res.status(404).json({
      error: 'Dat object staat niet in uw register.',
      let: 'Of het bestaat niet, of u heeft het recht voor die soort niet. Welke van de twee zegt dit antwoord bewust niet.' });

    if (raaktVan(b).some(r => r.type === type && r.id === id && !r.terug))
      return res.status(409).json({ error: 'Dit besluit is al aan dat object gekoppeld.' });

    const kort = register.kort(soort, rij);
    const koppel = { koppelId: rid(3), type, id,
      titelToen: kort.titel, subToen: kort.sub || null,
      door: g.l.naam, at: nu(), terug: null };
    raaktVan(b).push(koppel);
    log(g.w, g.l, 'besluit-raakt', b.id, kort.titel + ' (' + type + ')');
    save();
    res.json({ ok: true, koppeling: koppel, aantal: raaktVan(b).filter(r => !r.terug).length,
      let: 'De titel van nu wordt meebewaard. Wordt dit object later hernoemd of opgeruimd, dan staat hier nog steeds waar het besluit over ging.' });
  });

  /* ---------- intrekken: met een reden, en zonder te wissen ---------- */
  app.post('/api/bedrijf/besluit/raakt-terug', (req, res) => {
    const g = werkPoort(req, res, 'besluit'); if (!g) return;
    const b = besluitVan(req, res, g); if (!b) return;
    const k = raaktVan(b).find(r => r.koppelId === String(req.body.koppelId || ''));
    if (!k) return res.status(404).json({ error: 'Die koppeling kennen we niet.' });
    if (k.terug) return res.status(409).json({ error: 'Die koppeling is al ingetrokken.' });
    const reden = schoon(req.body.reden, 300);
    if (!reden) return res.status(400).json({
      error: 'Waarom hoort dit object hier niet bij? Een koppeling die zonder reden verdwijnt, maakt van dit geheugen een prikbord.' });
    k.terug = { reden, door: g.l.naam, at: nu() };
    log(g.w, g.l, 'besluit-raakt-terug', b.id, k.titelToen + ': ' + reden);
    save();
    res.json({ ok: true, koppeling: k,
      let: 'De koppeling blijft staan als ingetrokken. Wat er ooit stond, hoort leesbaar te blijven.' });
  });

  /* ---------- de evaluatie: wat leverde het terugkijken op ---------- */
  app.post('/api/bedrijf/besluit/evaluatie', (req, res) => {
    const g = werkPoort(req, res, 'besluit'); if (!g) return;
    const b = besluitVan(req, res, g); if (!b) return;
    if (b.status !== 'aangenomen') return res.status(409).json({
      error: 'Alleen een aangenomen besluit valt te evalueren; dit staat op ' + b.status + '.' });
    const uitkomst = String(req.body.uitkomst || '');
    if (!UITKOMSTEN.includes(uitkomst)) return res.status(400).json({ error: 'Kies een uitkomst: ' + UITKOMSTEN.join(', ') + '.' });
    const tekst = schoon(req.body.tekst, 2000);
    if (!tekst) return res.status(400).json({ error: 'Schrijf op wat u ziet. Een uitkomst zonder onderbouwing is een vinkje.' });
    if (!Array.isArray(b.evaluaties)) b.evaluaties = [];
    const rij = { id: rid(3), uitkomst, tekst, door: g.l.naam, op: dag(), at: nu(),
      opTijd: b.evalueerOp ? dag() >= b.evalueerOp : null };
    b.evaluaties.push(rij);
    log(g.w, g.l, 'besluit-geevalueerd', b.id, uitkomst);
    save();
    res.json({ ok: true, evaluatie: rij, aantal: b.evaluaties.length,
      let: b.evaluaties.length > 1
        ? 'Eerdere evaluaties blijven staan. Een besluit mag na drie jaar anders uitpakken dan na drie maanden, en dan horen ze allebei gelezen te worden.'
        : null });
  });

  /* De leeskant staat in ./geheugenlezen.js -- samen gingen ze over de 10 kB
     van keuringsregel 13, en de naad is echt: hier wordt geschreven en
     gejournaliseerd, daar wordt opgelost met het register van de LEZER.
     `raaktVan` reist mee zodat de normalisatie van een ontbrekende lijst op
     EEN plek staat (LAT-regel 4). */
  return { RAAKT: raaktVan, BESLUITUITKOMSTEN: UITKOMSTEN };
};
