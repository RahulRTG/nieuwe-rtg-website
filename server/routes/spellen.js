/* Domein "spellen": potjes mens-erger-je-niet, schaken en woordduel plus het
   Sneek-scorebord, op de vriendenlaag. Twee ingangen naar dezelfde motor:
   de RTG-leden-app (Bearer-token) en de RTFoundation (gezinscode + token),
   zodat alle leden tegen elkaar spelen. */
const { log } = require('../log');

module.exports = (kern) => {
  const { app, auth, geenGast, rtf, spelNieuw, spelAntwoord, spelRandom, mijnSpellen, spelStaat, spelZet, spelOpgeven, spelToewijzen, spelKijk, spelReplay, spelNaspelen, spelRahul, spelNabespreking, spelKlasgenoten, spelOnline, spelZichtbaar, spelZichtbaarZet, spelUitslagen, spelStand, spelPrestaties, spelPraat, spelPraatStuur, teamNieuw, teamNodig, teamAntwoord, teamVerlaat, mijnTeams, sudokuNieuw, sudokuKlaar, toernooiNieuw, toernooiAntwoord, mijnToernooien, toernooiStaat, sneekScore, sneekBord, arcadeScore, arcadeBord, socialConnecties } = kern;

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
    /* `context` en `bron` staan hier met OPZET niet bij, en dat is geen
       omissie: ze bepalen straks welk beleid aan een potje hangt (§8 van
       GAMEHALL.md), en wie zijn eigen context mag meesturen opent een 18+-spel
       als schoolsessie. Ze worden gezet door de INGANG die het weet -- een
       chat-start kent zijn gesprek, deze route kent alleen "iemand vraagt een
       potje aan". Voeg ze hier dus niet toe omdat de kern ze accepteert. */
    nieuw: (mij, b, wereld) => spelNieuw(mij, { soort: b.soort, grootte: b.grootte, modus: b.modus, vrienden: b.vrienden, codenamen: b.codenamen, klasgenoten: b.klasgenoten, taal: b.taal, tempo: b.tempo, wereld }),
    antwoord: (mij, b) => spelAntwoord(mij, String(b.id || ''), b.akkoord === true),
    random: (mij, b, wereld) => spelRandom(mij, String(b.soort || ''), b.grootte, b.taal, wereld, b.tempo),
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
    /* De partij opeisen als de klok van de ander verliep. Bewust een APARTE
       actie en niet iets wat 'staat' stilletjes doet: een potje beeindigen is
       een handeling en hoort er een te blijven. */
    toewijzen: (mij, b) => spelToewijzen(mij, String(b.id || '')),
    // het verloop van je EIGEN partij; een kijker krijgt hier niets
    replay: (mij, b) => spelReplay(mij, String(b.id || '')),
    /* Hetzelfde verloop, maar herbouwd tot een bord: de server rekent, zodat
       de client geen tweede exemplaar van de spelregels hoeft te dragen. */
    naspelen: (mij, b) => spelNaspelen(mij, String(b.id || ''), b.stap),
    // meekijken: mag dit spel bekeken worden, en hoor jij bij de kring?
    kijk: (mij, b) => spelKijk(mij, String(b.id || '')),
    // Rahul als spelmaatje: een hint, een regel of een peptalk tijdens het potje
    rahul: (mij, b) => spelRahul(mij, String(b.id || ''), b.vraag),
    /* Rahul die de partij NA AFLOOP nabespreekt. Bewust een tweede ingang en
       geen vlag op `rahul`: deze leest het hele verloop en weigert daarom een
       lopend potje. Een vlag op dezelfde deur zou betekenen dat een verkeerde
       waarde het bord alsnog opengooit. */
    nabespreking: (mij, b) => spelNabespreking(mij, String(b.id || ''), b.vraag),
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
    'toernooi-nieuw': (mij, b) => toernooiNieuw(mij, { soort: b.soort, naam: b.naam, maat: b.maat, vorm: b.vorm,
      spelers: (Array.isArray(b.spelers) ? b.spelers : []).filter(k => kringVan(mij).includes(k)) }),
    'toernooi-antwoord': (mij, b) => toernooiAntwoord(mij, String(b.id || ''), b.akkoord === true),
    'toernooi-mijn': (mij) => mijnToernooien(mij),
    'toernooi-staat': (mij, b) => toernooiStaat(mij, String(b.id || '')),
    // de eigen opt-out: wel spelen, niet gezien worden
    zichtbaar: (mij) => spelZichtbaar(mij),
    'zichtbaar-zet': (mij, b) => spelZichtbaarZet(mij, b.aan !== false),
    'sneek-score': (mij, b) => sneekScore(mij, b.punten),
    'sneek-bord': (mij) => Object.assign({ status: 200 }, sneekBord(mij, vriendenVan(mij))),
    /* Teams: een vaste club om mee te spelen. Uitnodigen kan alleen binnen je
       eigen kring, en die wordt gewogen in `kern/spellen/kring.js` -- met opzet
       NIET hier nog een keer. Hier stond eerst een tweede filter op `kringVan`,
       en dat was smaller dan de kern: `kringVan` kent vrienden en klasgenoten,
       de kring kent ook het huishouden. Een ouder kon zijn eigen kind dus niet
       in zijn team vragen. Twee definities van dezelfde kring is precies wat
       kring.js moest opheffen; deze route geeft de gevraagde sleutels door en
       de kern zeeft ze. */
    'team-nieuw': (mij, b) => teamNieuw(mij, b.naam, Array.isArray(b.leden) ? b.leden : []),
    'team-nodig': (mij, b) => teamNodig(mij, String(b.id || ''), Array.isArray(b.leden) ? b.leden : []),
    'team-antwoord': (mij, b) => teamAntwoord(mij, String(b.id || ''), b.akkoord === true),
    'team-verlaat': (mij, b) => teamVerlaat(mij, String(b.id || '')),
    'team-mijn': (mij) => mijnTeams(mij),
    /* Praten in het potje. Geen eigen berichtenvoorraad -- dit gaat de
       communicatiekern in; zie kern/spellen/praat.js. Twee acties, want lezen
       mag geen gesprek AANMAKEN. */
    praat: (mij, b) => spelPraat(mij, String(b.id || ''), b.aantal),
    'praat-stuur': (mij, b) => spelPraatStuur(mij, String(b.id || ''), b.tekst),
    /* Sudoku loopt NIET via arcade-score: de server geeft de puzzel uit en
       rekent de score. Er is dus ook geen tijd of getal dat hier binnenkomt --
       alleen het ingevulde rooster. */
    'sudoku-nieuw': (mij, b) => sudokuNieuw(mij, String(b.niveau || '')),
    'sudoku-klaar': (mij, b) => sudokuKlaar(mij, b.rooster),
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
