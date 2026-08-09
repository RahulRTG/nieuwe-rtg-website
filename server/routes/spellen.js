/* Domein "spellen": potjes mens-erger-je-niet, schaken en woordduel plus het
   Sneek-scorebord, op de vriendenlaag. Twee ingangen naar dezelfde motor:
   de RTG-leden-app (Bearer-token) en de RTFoundation (gezinscode + token),
   zodat alle leden tegen elkaar spelen. */
const { log } = require('../log');

module.exports = (kern) => {
  const { app, auth, geenGast, rtf, spelNieuw, spelAntwoord, spelRandom, mijnSpellen, spelStaat, spelZet, spelOpgeven, spelRahul, spelKlasgenoten, spelOnline, spelZichtbaar, spelZichtbaarZet, spelUitslagen, spelStand, spelPrestaties, toernooiNieuw, toernooiAntwoord, mijnToernooien, toernooiStaat, sneekScore, sneekBord, arcadeScore, arcadeBord, socialConnecties } = kern;

  function rtfSpeler(req, res) {
    const sess = rtf.verifieerProfiel(req.body.code, req.body.token);
    if (!sess) { res.status(403).json({ error: 'Log opnieuw in bij je gezin.' }); return null; }
    if (sess.gast) { res.status(403).json({ error: 'Als oppas of familielid speel je hier niet mee.' }); return null; }
    return sess.handle;
  }
  const vriendenVan = (mij) => (socialConnecties(mij).connections || []).map(c => c.key);
  /* De kring waarbinnen aanwezigheid bestaat: je vrienden, plus je klasgenoten
     als je op school zit. Die tweede hoort erbij omdat beschermde tieners
     onvindbaar zijn via de codenaam-zoeker: hun klas is de enige kring die ze
     hebben, en zonder die kring zou aanwezigheid voor hen leeg blijven.
     spelKlasgenoten filtert blokkades er zelf al uit; presence doet het nog
     eens, want een dubbele controle op een blokkade is geen verspilling. */
  const kringVan = (mij) => vriendenVan(mij)
    .concat((spelKlasgenoten(mij).klasgenoten || []).map(kg => kg.key));
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
    /* Wie er nu is. De kring komt hier vandaan en niet uit het verzoek: een
       client die zelf een lijst sleutels mag meesturen zou de aanwezigheid van
       willekeurige leden kunnen aftasten. */
    online: (mij) => Object.assign({ status: 200 }, spelOnline(mij, kringVan(mij))),
    // je eigen historie; onder de progressiegrens is die er niet
    uitslagen: (mij, b) => spelUitslagen(mij, b.hoeveel),
    // je stand per spel, afgeleid uit de uitslagen (dus over hetzelfde venster)
    stand: (mij) => spelStand(mij),
    // behaalde prestaties; wat je nog NIET hebt reist bewust niet mee
    prestaties: (mij) => spelPrestaties(mij),
    /* Toernooien: een knockout waarvan elke wedstrijd een gewoon potje is. De
       deelnemers komen uit dezelfde kring als een potje (vrienden en
       klasgenoten), dus de kring wordt hier bepaald en niet in het verzoek. */
    'toernooi-nieuw': (mij, b) => toernooiNieuw(mij, { soort: b.soort, naam: b.naam, maat: b.maat,
      spelers: (Array.isArray(b.spelers) ? b.spelers : []).filter(k => kringVan(mij).includes(k)) }),
    'toernooi-antwoord': (mij, b) => toernooiAntwoord(mij, String(b.id || ''), b.akkoord === true),
    'toernooi-mijn': (mij) => mijnToernooien(mij),
    'toernooi-staat': (mij, b) => toernooiStaat(mij, String(b.id || '')),
    // de eigen opt-out: wel spelen, niet gezien worden
    zichtbaar: (mij) => spelZichtbaar(mij),
    'zichtbaar-zet': (mij, b) => spelZichtbaarZet(mij, b.aan !== false),
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
