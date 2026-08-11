/* Domein "spellen": potjes mens-erger-je-niet, schaken en woordduel plus het
   Sneek-scorebord, op de vriendenlaag. Twee ingangen naar dezelfde motor:
   de RTG-leden-app (Bearer-token) en de RTFoundation (gezinscode + token),
   zodat alle leden tegen elkaar spelen. */
const { log } = require('../log');

module.exports = (kern) => {
  /* Alleen wat DIT bestand zelf gebruikt. De drieendertig spelfuncties zijn
     mee verhuisd naar ./spellen-acties.js en worden daar uit dezelfde kern
     gepakt; ze hier ook nog uitpakken zou een lijst zijn die niets doet en die
     bij de eerste hernoeming stil uit de pas loopt (scripts/check.js regel 39). */
  const { app, auth, geenGast, rtf, socialConnecties, spelKlasgenoten } = kern;

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
  /* De acties staan in ./spellen-acties.js: WAT een verzoek doet, los van de
     twee deuren waarop het hangt. Dit bestand ging bij het samenvoegen met main
     over de omvangregel, en dat is de naad waarlangs het geknipt is. */
  const ACTIES = require('./spellen-acties')({ kern, vriendenVan, kringVan });
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
