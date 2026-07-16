/* Domein "spellen": potjes mens-erger-je-niet, schaken en woordduel plus het
   Sneek-scorebord, op de vriendenlaag. Twee ingangen naar dezelfde motor:
   de RTG-leden-app (Bearer-token) en de RTFoundation (gezinscode + token),
   zodat alle leden tegen elkaar spelen. */
module.exports = (kern) => {
  const { app, auth, geenGast, rtf, spelNieuw, spelAntwoord, spelRandom, mijnSpellen, spelStaat, spelZet, spelOpgeven, sneekScore, sneekBord, socialConnecties } = kern;

  function rtfSpeler(req, res) {
    const sess = rtf.verifieerProfiel(req.body.code, req.body.token);
    if (!sess) { res.status(403).json({ error: 'Log opnieuw in bij je gezin.' }); return null; }
    if (sess.gast) { res.status(403).json({ error: 'Als oppas of familielid speel je hier niet mee.' }); return null; }
    return sess.handle;
  }
  const vriendenVan = (mij) => (socialConnecties(mij).connections || []).map(c => c.key);
  const stuur = (res, r) => r.error ? res.status(r.status).json({ error: r.error }) : res.json(r);

  // dezelfde acties voor beide werelden; alleen de identiteit verschilt
  const ACTIES = {
    nieuw: (mij, b) => spelNieuw(mij, { soort: b.soort, grootte: b.grootte, modus: b.modus, vrienden: b.vrienden, taal: b.taal }),
    antwoord: (mij, b) => spelAntwoord(mij, String(b.id || ''), b.akkoord === true),
    random: (mij, b) => spelRandom(mij, String(b.soort || ''), b.grootte, b.taal),
    mijn: (mij) => Object.assign({ status: 200 }, mijnSpellen(mij)),
    staat: (mij, b) => spelStaat(mij, String(b.id || '')),
    zet: (mij, b) => spelZet(mij, String(b.id || ''), b.zet),
    opgeven: (mij, b) => spelOpgeven(mij, String(b.id || '')),
    'sneek-score': (mij, b) => sneekScore(mij, b.punten),
    'sneek-bord': (mij) => Object.assign({ status: 200 }, sneekBord(mij, vriendenVan(mij)))
  };
  for (const [naam, doe] of Object.entries(ACTIES)) {
    app.post('/api/member/spel/' + naam, auth, (req, res) => {
      if (geenGast(req, res)) return;
      stuur(res, doe(req.session.key, req.body || {}));
    });
    app.post('/api/rtf/spel/' + naam, (req, res) => {
      const mij = rtfSpeler(req, res); if (!mij) return;
      stuur(res, doe(mij, req.body || {}));
    });
  }
};
