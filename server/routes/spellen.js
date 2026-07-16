/* Domein "spellen": potjes mens-erger-je-niet, schaken en woordduel plus het
   Sneek-scorebord, op de vriendenlaag. Twee ingangen naar dezelfde motor:
   de RTG-leden-app (Bearer-token) en de RTFoundation (gezinscode + token),
   zodat alle leden tegen elkaar spelen. */
module.exports = (kern) => {
  const { app, auth, geenGast, rtf, spelNieuw, spelAntwoord, spelRandom, mijnSpellen, spelStaat, spelZet, spelOpgeven, sneekScore, sneekBord, arcadeScore, arcadeBord, socialConnecties } = kern;

  function rtfSpeler(req, res) {
    const sess = rtf.verifieerProfiel(req.body.code, req.body.token);
    if (!sess) { res.status(403).json({ error: 'Log opnieuw in bij je gezin.' }); return null; }
    if (sess.gast) { res.status(403).json({ error: 'Als oppas of familielid speel je hier niet mee.' }); return null; }
    return sess.handle;
  }
  const vriendenVan = (mij) => (socialConnecties(mij).connections || []).map(c => c.key);
  const stuur = (res, r) => r.error ? res.status(r.status).json({ error: r.error }) : res.json(r);

  // dezelfde acties voor beide werelden; alleen de identiteit verschilt, en
  // elke app start zijn eigen spelgroep (meespelen op uitnodiging kan altijd)
  const ACTIES = {
    nieuw: (mij, b, wereld) => spelNieuw(mij, { soort: b.soort, grootte: b.grootte, modus: b.modus, vrienden: b.vrienden, codenamen: b.codenamen, taal: b.taal, wereld }),
    antwoord: (mij, b) => spelAntwoord(mij, String(b.id || ''), b.akkoord === true),
    random: (mij, b, wereld) => spelRandom(mij, String(b.soort || ''), b.grootte, b.taal, wereld),
    mijn: (mij) => Object.assign({ status: 200 }, mijnSpellen(mij)),
    staat: (mij, b) => spelStaat(mij, String(b.id || ''), b.velden === true),
    zet: (mij, b) => {
      // de nieuwe staat reist mee in het antwoord: scheelt de client een
      // tweede round-trip na elke zet
      const r = spelZet(mij, String(b.id || ''), b.zet);
      if (!r.error) { const s = spelStaat(mij, String(b.id || '')); if (s.potje) r.potje = s.potje; }
      return r;
    },
    opgeven: (mij, b) => spelOpgeven(mij, String(b.id || '')),
    'sneek-score': (mij, b) => sneekScore(mij, b.punten),
    'sneek-bord': (mij) => Object.assign({ status: 200 }, sneekBord(mij, vriendenVan(mij))),
    'arcade-score': (mij, b) => arcadeScore(mij, String(b.spel || ''), b.punten),
    'arcade-bord': (mij, b) => arcadeBord(mij, String(b.spel || ''), vriendenVan(mij))
  };
  // vangnet: Express 4 vangt async-fouten niet zelf, dus zonder try/catch
  // blijft een request eeuwig hangen als een actie onverwacht gooit
  async function veilig(res, werk) {
    try { stuur(res, await werk()); }
    catch (e) { res.status(500).json({ error: 'Er ging iets mis. Probeer het opnieuw.' }); }
  }
  for (const [naam, doe] of Object.entries(ACTIES)) {
    app.post('/api/member/spel/' + naam, auth, (req, res) => {
      if (geenGast(req, res)) return;
      veilig(res, () => doe(req.session.key, req.body || {}, 'rtg'));
    });
    app.post('/api/rtf/spel/' + naam, (req, res) => {
      const mij = rtfSpeler(req, res); if (!mij) return;
      veilig(res, () => doe(mij, req.body || {}, 'rtf'));
    });
  }
};
