/* Domein "spellen": potjes mens-erger-je-niet, schaken en woordduel plus het
   Sneek-scorebord, op de vriendenlaag. Twee ingangen naar dezelfde motor:
   de RTG-leden-app (Bearer-token) en de RTFoundation (gezinscode + token),
   zodat alle leden tegen elkaar spelen. */
const { log } = require('../log');

module.exports = (kern) => {
  const { app, auth, geenGast, rtf, spelNieuw, spelAntwoord, spelRandom, mijnSpellen, spelStaat, spelZet, spelOpgeven, spelKijk, spelReplay, spelRahul, spelKlasgenoten, spelOnline, spelZichtbaar, spelZichtbaarZet, spelUitslagen, spelStand, spelPrestaties, spelPraat, spelPraatStuur, teamNieuw, teamNodig, teamAntwoord, teamVerlaat, mijnTeams, sudokuNieuw, sudokuKlaar, toernooiNieuw, toernooiAntwoord, mijnToernooien, toernooiStaat, sneekScore, sneekBord, arcadeScore, arcadeBord, socialConnecties } = kern;

  /* De gezinsdeur als ECHTE MIDDLEWARE en niet als aanroep binnenin: zo staat
     bij elke route zichtbaar welke deur hij heeft, voor een lezer en voor
     scripts/check.js regel 28 (die het venster na de route leest en een poort
     in een wrapper dus niet ziet). Wie er doorheen komt, reist mee op req. */
  function huisPoort(req, res, next) {
    const sess = rtf.verifieerProfiel(req.body.code, req.body.token);
    if (!sess) return res.status(403).json({ error: 'Log opnieuw in bij je gezin.' });
    if (sess.gast) return res.status(403).json({ error: 'Als oppas of familielid speel je hier niet mee.' });
    req.huisLid = sess.handle;
    next();
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
    // het verloop van je EIGEN partij; een kijker krijgt hier niets
    replay: (mij, b) => spelReplay(mij, String(b.id || '')),
    // meekijken: mag dit spel bekeken worden, en hoor jij bij de kring?
    kijk: (mij, b) => spelKijk(mij, String(b.id || '')),
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
  /* ELK SPEL HANGT OP TWEE DEUREN: de leden-app en het RTFoundation-huis. Dat
     was een lus met OPGEBOUWDE paden ('/api/member/spel/' + naam), en daardoor
     zag scripts/schakelbaar.js er geen enkele van -- niet uit te zetten vanuit
     de boardroom, niet per stad te sluiten (scripts/check.js regel 45).
     Uitgeschreven staat er nu ook zwart op wit DAT het er twee zijn, en dat ze
     precies evenveel mogen.

     De actienaam reist mee naar veilig(), want die schrijft hem in het foutlog;
     zonder naam is een uitzondering hier niet terug te vinden.

     geenGast blijft BINNEN de wrapper en wordt geen middleware: hij geeft true
     of false terug en roept geen next(), dus als middleware zou elk verzoek
     blijven hangen. De poort die regel 28 ziet is `auth` ervoor; deze tweede
     controle sluit de anonieme demo-gast uit. */
  const viaLid = (naam) => (req, res) => {
    if (geenGast(req, res)) return;
    veilig(res, () => ACTIES[naam](req.session.key, req.body || {}, 'rtg'), naam, req);
  };
  const viaHuis = (naam) => (req, res) => {
    veilig(res, () => ACTIES[naam](req.huisLid, req.body || {}, 'rtf'), naam, req);
  };

  app.post('/api/member/spel/nieuw', auth, viaLid('nieuw'));
  app.post('/api/member/spel/antwoord', auth, viaLid('antwoord'));
  app.post('/api/member/spel/random', auth, viaLid('random'));
  app.post('/api/member/spel/mijn', auth, viaLid('mijn'));
  app.post('/api/member/spel/staat', auth, viaLid('staat'));
  app.post('/api/member/spel/zet', auth, viaLid('zet'));
  app.post('/api/member/spel/opgeven', auth, viaLid('opgeven'));
  app.post('/api/member/spel/replay', auth, viaLid('replay'));
  app.post('/api/member/spel/kijk', auth, viaLid('kijk'));
  app.post('/api/member/spel/rahul', auth, viaLid('rahul'));
  app.post('/api/member/spel/klasgenoten', auth, viaLid('klasgenoten'));
  app.post('/api/member/spel/online', auth, viaLid('online'));
  app.post('/api/member/spel/uitslagen', auth, viaLid('uitslagen'));
  app.post('/api/member/spel/stand', auth, viaLid('stand'));
  app.post('/api/member/spel/prestaties', auth, viaLid('prestaties'));
  app.post('/api/member/spel/toernooi-nieuw', auth, viaLid('toernooi-nieuw'));
  app.post('/api/member/spel/toernooi-antwoord', auth, viaLid('toernooi-antwoord'));
  app.post('/api/member/spel/toernooi-mijn', auth, viaLid('toernooi-mijn'));
  app.post('/api/member/spel/toernooi-staat', auth, viaLid('toernooi-staat'));
  app.post('/api/member/spel/zichtbaar', auth, viaLid('zichtbaar'));
  app.post('/api/member/spel/zichtbaar-zet', auth, viaLid('zichtbaar-zet'));
  app.post('/api/member/spel/sneek-score', auth, viaLid('sneek-score'));
  app.post('/api/member/spel/sneek-bord', auth, viaLid('sneek-bord'));
  app.post('/api/member/spel/team-nieuw', auth, viaLid('team-nieuw'));
  app.post('/api/member/spel/team-nodig', auth, viaLid('team-nodig'));
  app.post('/api/member/spel/team-antwoord', auth, viaLid('team-antwoord'));
  app.post('/api/member/spel/team-verlaat', auth, viaLid('team-verlaat'));
  app.post('/api/member/spel/team-mijn', auth, viaLid('team-mijn'));
  app.post('/api/member/spel/praat', auth, viaLid('praat'));
  app.post('/api/member/spel/praat-stuur', auth, viaLid('praat-stuur'));
  app.post('/api/member/spel/sudoku-nieuw', auth, viaLid('sudoku-nieuw'));
  app.post('/api/member/spel/sudoku-klaar', auth, viaLid('sudoku-klaar'));
  app.post('/api/member/spel/arcade-score', auth, viaLid('arcade-score'));
  app.post('/api/member/spel/arcade-bord', auth, viaLid('arcade-bord'));

  app.post('/api/rtf/spel/nieuw', huisPoort, viaHuis('nieuw'));
  app.post('/api/rtf/spel/antwoord', huisPoort, viaHuis('antwoord'));
  app.post('/api/rtf/spel/random', huisPoort, viaHuis('random'));
  app.post('/api/rtf/spel/mijn', huisPoort, viaHuis('mijn'));
  app.post('/api/rtf/spel/staat', huisPoort, viaHuis('staat'));
  app.post('/api/rtf/spel/zet', huisPoort, viaHuis('zet'));
  app.post('/api/rtf/spel/opgeven', huisPoort, viaHuis('opgeven'));
  app.post('/api/rtf/spel/replay', huisPoort, viaHuis('replay'));
  app.post('/api/rtf/spel/kijk', huisPoort, viaHuis('kijk'));
  app.post('/api/rtf/spel/rahul', huisPoort, viaHuis('rahul'));
  app.post('/api/rtf/spel/klasgenoten', huisPoort, viaHuis('klasgenoten'));
  app.post('/api/rtf/spel/online', huisPoort, viaHuis('online'));
  app.post('/api/rtf/spel/uitslagen', huisPoort, viaHuis('uitslagen'));
  app.post('/api/rtf/spel/stand', huisPoort, viaHuis('stand'));
  app.post('/api/rtf/spel/prestaties', huisPoort, viaHuis('prestaties'));
  app.post('/api/rtf/spel/toernooi-nieuw', huisPoort, viaHuis('toernooi-nieuw'));
  app.post('/api/rtf/spel/toernooi-antwoord', huisPoort, viaHuis('toernooi-antwoord'));
  app.post('/api/rtf/spel/toernooi-mijn', huisPoort, viaHuis('toernooi-mijn'));
  app.post('/api/rtf/spel/toernooi-staat', huisPoort, viaHuis('toernooi-staat'));
  app.post('/api/rtf/spel/zichtbaar', huisPoort, viaHuis('zichtbaar'));
  app.post('/api/rtf/spel/zichtbaar-zet', huisPoort, viaHuis('zichtbaar-zet'));
  app.post('/api/rtf/spel/sneek-score', huisPoort, viaHuis('sneek-score'));
  app.post('/api/rtf/spel/sneek-bord', huisPoort, viaHuis('sneek-bord'));
  app.post('/api/rtf/spel/team-nieuw', huisPoort, viaHuis('team-nieuw'));
  app.post('/api/rtf/spel/team-nodig', huisPoort, viaHuis('team-nodig'));
  app.post('/api/rtf/spel/team-antwoord', huisPoort, viaHuis('team-antwoord'));
  app.post('/api/rtf/spel/team-verlaat', huisPoort, viaHuis('team-verlaat'));
  app.post('/api/rtf/spel/team-mijn', huisPoort, viaHuis('team-mijn'));
  app.post('/api/rtf/spel/praat', huisPoort, viaHuis('praat'));
  app.post('/api/rtf/spel/praat-stuur', huisPoort, viaHuis('praat-stuur'));
  app.post('/api/rtf/spel/sudoku-nieuw', huisPoort, viaHuis('sudoku-nieuw'));
  app.post('/api/rtf/spel/sudoku-klaar', huisPoort, viaHuis('sudoku-klaar'));
  app.post('/api/rtf/spel/arcade-score', huisPoort, viaHuis('arcade-score'));
  app.post('/api/rtf/spel/arcade-bord', huisPoort, viaHuis('arcade-bord'));
};
