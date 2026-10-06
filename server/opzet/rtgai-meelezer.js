'use strict';

const { naAntwoord } = require('../lib/antwoord-einde');

/* De meelezer telt na het antwoord en beslist niets. Laat binden voorkomt een
   opstartkring: de verzoekketen bestaat voordat de RTG-AI-kern is gemaakt. */
module.exports = function koppelRtgaiMeelezer(app) {
  let meelezer = null;
  app.use((req, res, next) => {
    naAntwoord(res, () => {
      try {
        if (meelezer) meelezer.lees(req.method, req.path, res.statusCode);
      } catch (e) { /* observatie mag het antwoord niet wijzigen */ }
    });
    next();
  });
  return function zetRtgaiMeelezer(nieuw) { meelezer = nieuw; };
};
