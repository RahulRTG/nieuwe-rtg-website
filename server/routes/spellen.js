/* Domein "spellen": potjes mens-erger-je-niet, schaken en woordduel plus het
   Sneek-scorebord, op de vriendenlaag. Twee ingangen naar dezelfde motor:
   de RTG-leden-app (Bearer-token) en de RTFoundation (gezinscode + token),
   zodat alle leden tegen elkaar spelen. */
const { log } = require('../log');

module.exports = (kern) => {
  const { app, auth, geenGast, rtf, spelNieuw, spelAntwoord, spelRandom, mijnSpellen, spelStaat, spelZet, spelOpgeven, spelRahul, spelKlasgenoten, spelOnline, sneekScore, sneekBord, arcadeScore, arcadeBord, socialConnecties } = kern;

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
    nieuw: (mij, b, wereld) => spelNieuw(mij, { soort: b.soort, grootte: b.grootte, modus: b.modus, vrienden: b.vrienden, codenamen: b.codenamen, klasgenoten: b.klasgenoten, taal: b.taal, wereld }),
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
    // Rahul als spelmaatje: een hint, een regel of een peptalk tijdens het potje
    rahul: (mij, b) => spelRahul(mij, String(b.id || ''), b.vraag),
    // de kieslijst met klasgenoten (De Arena); een RTG-lid heeft geen klas
    // en krijgt gewoon een lege lijst
    klasgenoten: (mij) => spelKlasgenoten(mij),
    /* Wie van je vrienden er nu is. De kring komt hier vandaan en niet uit het
       verzoek: een client die zelf een lijst sleutels mag meesturen zou de
       aanwezigheid van willekeurige leden kunnen aftasten. */
    online: (mij) => Object.assign({ status: 200 }, spelOnline(mij, vriendenVan(mij))),
    'sneek-score': (mij, b) => sneekScore(mij, b.punten),
    'sneek-bord': (mij) => Object.assign({ status: 200 }, sneekBord(mij, vriendenVan(mij))),
    'arcade-score': (mij, b) => arcadeScore(mij, String(b.spel || ''), b.punten),
    'arcade-bord': (mij, b) => arcadeBord(mij, String(b.spel || ''), vriendenVan(mij))
  };
  /* vangnet: Express 4 vangt async-fouten niet zelf, dus zonder try/catch
     blijft een request eeuwig hangen als een actie onverwacht gooit.

     De exceptie MOET hier gelogd worden. Werd hij weggegooid, dan bleef er van
     een echte fout in een van deze acties niets over dan een kale 500: geen
     stack, geen actie, geen id -- terwijl de fout-aggregatie op het techniekbord
     er juist voor is. Zo was een 500 uit spelAntwoord onder parallelle belasting
     niet te herleiden. */
  async function veilig(res, werk, naam, req) {
    try { stuur(res, await werk()); }
    catch (e) {
      log.uitzondering(e, { id: req && req.id, p: req && req.path, actie: naam });
      res.status(500).json({ error: 'Er ging iets mis. Probeer het opnieuw.', id: req && req.id });
    }
  }
  for (const [naam, doe] of Object.entries(ACTIES)) {
    app.post('/api/member/spel/' + naam, auth, (req, res) => {
      if (geenGast(req, res)) return;
      veilig(res, () => doe(req.session.key, req.body || {}, 'rtg'), naam, req);
    });
    app.post('/api/rtf/spel/' + naam, (req, res) => {
      const mij = rtfSpeler(req, res); if (!mij) return;
      veilig(res, () => doe(mij, req.body || {}, 'rtf'), naam, req);
    });
  }
};
