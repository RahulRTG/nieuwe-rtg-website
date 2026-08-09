/* Member-submodule "onderneming/bestuur": wie beslist, wie bezit, en wie er als
   UBO uit volgt.

   Apart van ./onderneming.js en ./onderneming-geld.js langs dezelfde naad als
   die twee: daar de levensloop, daar het dagelijkse geld, hier de juridische
   samenstelling. Alle routes gebruiken dezelfde eigendomscontrole, die als
   `mijn` wordt meegegeven.

   Er is met opzet GEEN route die de UBO zet. Die wordt afgeleid uit de
   aandelen en het bestuur; zie kern/onderneming/bestuur.js. Een aangevinkte
   UBO blijft staan als de aandelen verschuiven, en dan klopt het register
   precies op het moment dat het ertoe doet niet meer. */
module.exports = (kern, mijn, stuur, nietGevonden) => {
  const { app, auth, ondernemingBestuur, ondernemingBestuurderZet,
    ondernemingBestuurderAf, ondernemingAandeelZet, ondernemingAandeelWeg } = kern;

  app.post('/api/onderneming/bestuur', auth, (req, res) => {
    const o = mijn(req);
    if (!o) return stuur(res, nietGevonden);
    res.json({ ok: true, bestuur: ondernemingBestuur(o) });
  });

  app.post('/api/onderneming/bestuur/zet', auth, (req, res) => {
    const o = mijn(req);
    if (!o) return stuur(res, nietGevonden);
    stuur(res, ondernemingBestuurderZet(o, req.body || {}));
  });

  /* Aftreden en niet wissen: wie er ooit bestuurder was, was dat -- en juist
     die geschiedenis is waar een aansprakelijkheidsvraag over gaat. */
  app.post('/api/onderneming/bestuur/af', auth, (req, res) => {
    const o = mijn(req);
    if (!o) return stuur(res, nietGevonden);
    stuur(res, ondernemingBestuurderAf(o, (req.body || {}).id));
  });

  app.post('/api/onderneming/aandeel/zet', auth, (req, res) => {
    const o = mijn(req);
    if (!o) return stuur(res, nietGevonden);
    stuur(res, ondernemingAandeelZet(o, req.body || {}));
  });

  app.post('/api/onderneming/aandeel/weg', auth, (req, res) => {
    const o = mijn(req);
    if (!o) return stuur(res, nietGevonden);
    stuur(res, ondernemingAandeelWeg(o, (req.body || {}).id));
  });
};
