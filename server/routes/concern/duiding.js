/* Routes "concern" (deel): een vrije naam alsnog DUIDEN -- een bestuurder of
   gevolmachtigde van voor 23 september 2026 koppelen aan een codenaam, of
   uitdrukkelijk als extern vastleggen. De regels wonen in
   ../../kern/concern/duiding.js; hier alleen de deur.

   Twee dingen komen NIET uit het lichaam: wie de duiding doet (de sessie) en
   welke codenaam het werkelijk is (de gids, via duidBestuurder -- dezelfde
   opzoeking als bij feit/zet, zodat "is dit een lid" op een plek beslist wordt). */
'use strict';

const { duidBestuurder } = require('../../kern/concern/persoon');

module.exports = (kern, { mijn, stuur, nietGevonden }) => {
  const { app, auth, tijdDuid } = kern;

  app.post('/api/concern/feit/duid', auth, async (req, res) => {
    const e = mijn(req);
    if (!e) return stuur(res, nietGevonden);
    const b = req.body || {};
    const naar = await duidBestuurder('bestuurder', { sleutel: b.extern === true ? 'extern' : b.codenaam, extern: b.extern === true },
      kern.keyVanCodenaam);
    if (!naar.ok) return stuur(res, naar);
    stuur(res, tijdDuid(e.id, String(b.feit || ''), { sleutel: naar.body.sleutel, extern: b.extern === true },
      { bronSoort: b.bronSoort, bronDetail: b.bronDetail, wie: req.session.key }));
  });
};
