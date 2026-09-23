/* Backoffice (deelmodule): DE STAND VAN DE BELEIDSMOTOR IN DE SCHADUW.

   AUTHORITY.md fase 1: de motor loopt mee met de vier kantoordeuren en telt of
   hij het eens is met de poort die vandaag afdwingt (besluit A1), en welke
   kantoorroutes zonder bekende poort liepen (besluit A3). De meting woont in
   kern/beleidsmotor/; deze route leest alleen.

   boardroomAuth en niet officeAuth, om dezelfde reden als ./mensdeur.js: de lijst
   routes zonder poort is een kaart van de gaten, en die hoort niet leesbaar te
   zijn voor de gedeelde code. */
module.exports = (octx) => {
  const { kern } = octx;
  const { app, officeAuth, boardroomAuth, beleidsmotor } = kern;

  app.post('/api/office/beleidsmotor', boardroomAuth, (req, res) => {
    if (!beleidsmotor || typeof beleidsmotor.stand !== 'function') {
      return res.status(503).json({ error: 'De beleidsmotor is niet bedraad in deze server.' });
    }
    res.json(beleidsmotor.stand());
  });

  /* WAAROM MAG IK HIER (NIET) IN? Voor elke kantoorsessie, ook de gedeelde code,
     en alleen over zichzelf. Een weigering zonder reden laat iemand raden; dit
     noemt per deur welke eis viel. */
  app.post('/api/office/beleidsmotor/waarom', officeAuth, (req, res) => {
    if (!beleidsmotor || typeof beleidsmotor.waarom !== 'function') {
      return res.status(503).json({ error: 'De beleidsmotor is niet bedraad in deze server.' });
    }
    res.json({ ok: true, deuren: beleidsmotor.waarom(req),
      grens: 'Alleen over uzelf. Dit zegt wat de deuren vandaag zouden besluiten; de poorten zelf beslissen nog.' });
  });
};
