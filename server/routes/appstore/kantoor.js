/* De keuringskant van de RTG App Store: hier tekent een MENS van RTG af.

   Dit is grens 2 uit kern/appstore/index.js, en dit bestand is de plek waar hij
   zichtbaar is: de machinepoort heeft de bundel al gelezen en kan alleen
   doorlaten NAAR hier. Publiceren gebeurt nergens anders.

   Elke handeling vraagt een NAAM (`door`). Een kantoorsessie is een code en geen
   mens; zonder naam is er straks een besluit waar niemand bij hoorde. */
module.exports = (kern) => {
  const { app, officeAuth, appstore } = kern;

  const antwoord = (res, r) => (r && r.error) ? res.status(r.status || 400).json(r) : res.json(r);
  const naam = (req) => String(req.body.door || '').trim().slice(0, 80);
  /* WIE TEKENT ER, als persoon. Een kantoorsessie is een code en niet vanzelf
     een mens; alleen wie met zijn eigen inlog binnenkomt heeft een sleutel
     (kern/kantoor/index.js zet die op het verzoek). Ontbreekt hij, dan valt de
     vier-ogenregel terug op de naam en zegt het dossier dat de scheiding is
     OPGEGEVEN en niet bewezen. */
  const wieKey = (req) => req.officeKey || null;

  // de wachtrij: alles wat de machinepoort heeft doorgelaten en op een mens wacht
  app.post('/api/appstore/kantoor/wachtrij', officeAuth, (req, res) => res.json({
    inzendingen: appstore.wachtrij(), uitgevers: appstore.uitgevers(),
    let: 'De machinepoort keurt nooit goed. Wat hier staat, is door de vormcontrole; of de app DOET wat hij belooft, ziet alleen een mens.' }));

  // een uitgever toelaten, weigeren of schorsen
  app.post('/api/appstore/kantoor/uitgever', officeAuth, (req, res) => antwoord(res, appstore.uitgeverBesluit({
    org: req.body.org, besluit: String(req.body.besluit || ''), reden: req.body.reden, door: naam(req) })));

  /* De toegankelijkheidsuitslag noteren. Achter officeAuth en NIET achter de
     uitgeverspoort, en dat is de kern: een ingediend stuk is geen bewijs
     (CLAUDE.md). RTG draait de keuring op de bundel die er ligt; de uitgever
     levert geen uitslag aan. De keurloper (scripts/appstore-a11y.js) logt hier
     als kantoor in en zet zijn uitslag neer.

     Zonder deze uitslag gaat een versie niet live -- zie kern/appstore/besluit.js. */
  /* mutatie: idempotent -- dezelfde uitslag twee keer noteren laat dezelfde stand */
  app.post('/api/appstore/kantoor/toegankelijk', officeAuth, (req, res) => antwoord(res, appstore.toegankelijk.noteer({
    versieId: req.body.versieId, stand: String(req.body.stand || ''), fouten: req.body.fouten,
    bevindingen: req.body.bevindingen,
    /* `door` is hier GEEN handtekening maar een herkomst: dit is een meting en
       geen besluit. Een mens die aftekent moet zijn naam noemen (zie
       kantoor/besluit hieronder); een keurloper die rendert hoeft dat niet, en
       zonder deze standaard zou een machine een mensennaam moeten verzinnen. */
    door: naam(req) || 'de keurloper' })));

  /* Wat er nog gekeurd moet worden. De keurloper vraagt dit op. */
  /* mutatie: idempotent -- lezen */
  app.post('/api/appstore/kantoor/toegankelijk/wachtrij', officeAuth, (req, res) =>
    res.json({ lijst: appstore.toegankelijk.wachtOpKeuring() }));

  // een inzending publiceren of weigeren
  /* mutatie: nietHerhaalbaar -- een besluit is een handeling van een mens en telt op in het journaal */
  app.post('/api/appstore/kantoor/besluit', officeAuth, (req, res) => antwoord(res, appstore.besluit({
    versieId: req.body.versieId, besluit: String(req.body.besluit || ''), reden: req.body.reden,
    door: naam(req), doorKey: wieKey(req) })));

  /* De noodrem. Een app die live staat en niet had gemoeten, is met een verzoek
     weg -- ook bij de leden die hem al hadden. Dat is geen extra functie maar de
     reden dat publiceren een aanwijsbare versie is en geen toestand. */
  app.post('/api/appstore/kantoor/intrekken', officeAuth, (req, res) => antwoord(res, appstore.intrekken({
    sleutel: req.body.sleutel, reden: req.body.reden, door: naam(req) || 'RTG-kantoor' })));

  // het journaal: elke beslissing over een derde, aangroeiend en niet te herschrijven
  app.post('/api/appstore/kantoor/journaal', officeAuth, (req, res) => res.json({ journaal: appstore.journaal(req.body.n) }));

  /* DE CONTROLERONDE. Een keuring is geen moment maar een toestand: een app die
     in maart is afgetekend, zegt niets over vandaag. Deze ronde leest van elke
     live app de hele bundel terug en houdt hem tegen zijn eigen hash. Klopt hij
     niet, dan gaat de app er meteen uit -- daar valt niets af te wegen. */
  app.post('/api/appstore/kantoor/hercontrole', officeAuth, (req, res) =>
    antwoord(res, appstore.hercontrole({ door: naam(req) || 'RTG-kantoor' })));

  /* ---- de betaalde kant ----
     De AFDRACHT geldt voor elke uitgever tegelijk en werkt alleen vooruit: een
     bon die al is geschreven wordt nooit herrekend. Daarom draagt hij een naam
     en een reden, en staat hij in het journaal.

     De TERUGGAVERECHTEN zijn wat er overblijft als RTG of een uitgever een app
     intrekt die iemand had gekocht (kern/appstore/teruggave.js). Ze worden
     KLAARGEZET; hier beslist een mens, en pas dan beweegt er geld. */
  const geld = () => appstore.geld;
  const geenGeld = (res) => res.status(503).json({ error: 'De betaallaag draait niet mee.', nietGebouwd: 'RTG Pay is in dit proces niet gemount.' });

  app.post('/api/appstore/kantoor/afdracht', officeAuth, (req, res) => {
    if (!geld()) return geenGeld(res);
    if (req.body.procent == null) return res.json({ afdracht: geld().afdracht(), max: geld().AFDRACHT_MAX });
    antwoord(res, geld().afdrachtZet({ procent: req.body.procent, reden: req.body.reden, door: naam(req) }));
  });

  app.post('/api/appstore/kantoor/teruggaven', officeAuth, (req, res) => {
    if (!geld()) return geenGeld(res);
    res.json({ open: geld().openRechten(),
      let: 'Een ingetrokken app die iemand had gekocht, laat een recht achter. Terugbetalen of afwijzen is een besluit van een mens; er gebeurt hier niets vanzelf.' });
  });
  app.post('/api/appstore/kantoor/teruggave', officeAuth, async (req, res) => {
    if (!geld()) return geenGeld(res);
    antwoord(res, await geld().rechtDoe({ id: req.body.id, besluit: String(req.body.besluit || ''),
      reden: req.body.reden, door: naam(req), idem: req.body.idem }));
  });
};
