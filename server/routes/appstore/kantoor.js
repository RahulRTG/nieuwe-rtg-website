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

  // de wachtrij: alles wat de machinepoort heeft doorgelaten en op een mens wacht
  app.post('/api/appstore/kantoor/wachtrij', officeAuth, (req, res) => res.json({
    inzendingen: appstore.wachtrij(), uitgevers: appstore.uitgevers(),
    let: 'De machinepoort keurt nooit goed. Wat hier staat, is door de vormcontrole; of de app DOET wat hij belooft, ziet alleen een mens.' }));

  // een uitgever toelaten, weigeren of schorsen
  app.post('/api/appstore/kantoor/uitgever', officeAuth, (req, res) => antwoord(res, appstore.uitgeverBesluit({
    org: req.body.org, besluit: String(req.body.besluit || ''), reden: req.body.reden, door: naam(req) })));

  // een inzending publiceren of weigeren
  app.post('/api/appstore/kantoor/besluit', officeAuth, (req, res) => antwoord(res, appstore.besluit({
    versieId: req.body.versieId, besluit: String(req.body.besluit || ''), reden: req.body.reden, door: naam(req) })));

  /* De noodrem. Een app die live staat en niet had gemoeten, is met een verzoek
     weg -- ook bij de leden die hem al hadden. Dat is geen extra functie maar de
     reden dat publiceren een aanwijsbare versie is en geen toestand. */
  app.post('/api/appstore/kantoor/intrekken', officeAuth, (req, res) => antwoord(res, appstore.intrekken({
    sleutel: req.body.sleutel, reden: req.body.reden, door: naam(req) || 'RTG-kantoor' })));

  // het journaal: elke beslissing over een derde, aangroeiend en niet te herschrijven
  app.post('/api/appstore/kantoor/journaal', officeAuth, (req, res) => res.json({ journaal: appstore.journaal(req.body.n) }));
};
