'use strict';
/* De auditmeting: liet dit verzoek een spoor na?

   Een eigen bestand omdat het een eigen onderwerp is -- en omdat
   ./verzoekketen.js er met dit blok erin over de 10 KB ging (keuringsregel 13).
   Die grens is een dakpan: eroverheen betekent dat er een tweede onderwerp in
   zit, en dat was hier ook zo.

     De AUDIT-as vraagt of een route een spoor nalaat. Er is geen doorgang waar
     auditregels ontstaan, dus dat wordt hier van buiten gemeten: de lengtes van
     de journalen (kern/auditsporen.js) net voor en net na het verzoek.

     Op res.finish en niet op matchmoment, want een spoor ontstaat TIJDENS de
     afhandeling. Dat is precies de wedloop die server/routelog.js voor de
     dekkingsmeting vermijdt -- daar is 'is hij geraakt' de vraag en telt een
     afgebroken verbinding gewoon mee. Hier is de vraag wat het verzoek HEEFT
     GEDAAN, en dan is het einde het enige eerlijke moment. Valt de verbinding
     weg, dan komt er geen AUDIT-regel; die route staat dan ongemeten op deze as
     en dat is juister dan een halve waarneming.

     req.routePatroon wordt door de router gezet zodra een route matcht. Zonder
     dat schrijven we niets: een 404 heeft geen route om iets over te zeggen. */
module.exports = function auditmeting({ app, db }) {
  /* Zonder journaal doet dit niets en kost het niets: deze meting hoort in de
     testrun, niet in productie. */
  if (!process.env.RTG_ROUTELOG) return;
  const routelog = require('../routelog');
  const sporen = require('../kern/auditsporen');
  app.use((req, res, next) => {
    if (!db || !db.data) return next();
    const voor = sporen.standVan(db.data);
    res.on('finish', () => {
      const patroon = req.routePatroon || null;
      if (!patroon) return;
      try { routelog.noteerAudit(req.method, patroon, sporen.gegroeid(voor, sporen.standVan(db.data)), res.statusCode); }
      catch (e) { /* een meting mag nooit een verzoek raken */ }
    });
    next();
  });
};
