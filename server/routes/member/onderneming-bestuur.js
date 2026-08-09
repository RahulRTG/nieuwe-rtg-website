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
    ondernemingBestuurderAf, ondernemingAandeelZet, ondernemingAandeelWeg,
    ondernemingToegang, ondernemingOntwerp, ONDERNEMING_ONTWERPER } = kern;

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

  /* Wie er bij de onderneming kan, over de twee rechtenmodellen die er al zijn.
     LEEST alleen: toegang verlenen gebeurt waar de rol woont -- in de zaak-app
     of in RTG Werk OS, allebei met hun eigen journaal. Zie
     kern/onderneming/toegang.js. */
  app.post('/api/onderneming/toegang', auth, (req, res) => {
    const o = mijn(req);
    if (!o) return stuur(res, nietGevonden);
    res.json({ ok: true, toegang: ondernemingToegang(o) });
  });

  /* De AI-laag: de bedrijfsontwerper en de Mall-bouwer. Er wordt NIETS
     opgeslagen -- de uitkomst is tekst die de ondernemer zelf overneemt. Zie
     kern/onderneming/ontwerper.js voor de drie grenzen die in de prompt staan
     en ook in de uitwijk gelden. */
  app.post('/api/onderneming/ontwerp', auth, async (req, res) => {
    const o = mijn(req);
    if (!o) return stuur(res, nietGevonden);
    const b = req.body || {};
    stuur(res, await ondernemingOntwerp(req, o, String(b.opdracht || 'ontwerp'), b.vraag));
  });

  app.post('/api/onderneming/ontwerp/opdrachten', auth, (req, res) => {
    res.json({ ok: true, opdrachten: Object.entries(ONDERNEMING_ONTWERPER)
      .map(([id, x]) => ({ id, label: x.label, wat: x.wat })) });
  });
};
