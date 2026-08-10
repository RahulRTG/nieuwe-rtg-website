/* Domein "spellen": potjes mens-erger-je-niet, schaken en woordduel plus het
   Sneek-scorebord, op de vriendenlaag. Twee ingangen naar dezelfde motor:
   de RTG-leden-app (Bearer-token) en de RTFoundation (gezinscode + token),
   zodat alle leden tegen elkaar spelen. */
const { log } = require('../log');

module.exports = (kern) => {
  const { app, auth, geenGast, rtf, spelNieuw, spelAntwoord, spelRandom, mijnSpellen, spelStaat, spelZet, spelOpgeven, spelRahul, spelKlasgenoten, sneekScore, sneekBord, arcadeScore, arcadeBord, socialConnecties } = kern;

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
  const stuur = (res, r) => r.error ? res.status(r.status).json({ error: r.error }) : res.json(r);

  // dezelfde acties voor beide werelden; alleen de identiteit verschilt, en
  // elke app start zijn eigen spelgroep (meespelen op uitnodiging kan altijd)
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
     was een lus met opgebouwde paden, waardoor scripts/schakelbaar.js geen van
     beide zag -- niet uit te zetten, niet per stad te sluiten (scripts/check.js
     regel 45). Uitgeschreven staat er nu ook zwart op wit DAT het er twee zijn.

     De actienaam reist mee naar veilig(), want die schrijft hem in het
     foutlog; zonder naam is een uitzondering hier niet terug te vinden. De
     twee poorten verschillen en blijven elk op EEN plek. */
  /* geenGast blijft hier BINNEN en wordt geen middleware: hij geeft true of
     false terug en roept geen next(), dus als middleware zou elk verzoek
     blijven hangen. De poort die scripts/check.js regel 28 ziet is `auth`
     ervoor; deze tweede controle sluit de anonieme demo-gast uit. */
  const viaLid = (naam, fn) => (req, res) => {
    if (geenGast(req, res)) return;
    veilig(res, () => fn(req.session.key, req.body || {}, 'rtg'), naam, req);
  };
  const viaHuis = (naam, fn) => (req, res) => {
    veilig(res, () => fn(req.huisLid, req.body || {}, 'rtf'), naam, req);
  };

  app.post('/api/member/spel/nieuw', auth, viaLid('nieuw', (mij, b, wereld) => spelNieuw(mij, { soort: b.soort, grootte: b.grootte, modus: b.modus, vrienden: b.vrienden, codenamen: b.codenamen, klasgenoten: b.klasgenoten, taal: b.taal, wereld })));
  app.post('/api/member/spel/antwoord', auth, viaLid('antwoord', (mij, b) => spelAntwoord(mij, String(b.id || ''), b.akkoord === true)));
  app.post('/api/member/spel/random', auth, viaLid('random', (mij, b, wereld) => spelRandom(mij, String(b.soort || ''), b.grootte, b.taal, wereld)));
  app.post('/api/member/spel/mijn', auth, viaLid('mijn', (mij) => Object.assign({ status: 200 }, mijnSpellen(mij))));
  app.post('/api/member/spel/staat', auth, viaLid('staat', (mij, b) => spelStaat(mij, String(b.id || ''), b.velden === true)));
  app.post('/api/member/spel/zet', auth, viaLid('zet', (mij, b) => {
      // de nieuwe staat reist mee in het antwoord: scheelt de client een
      // tweede round-trip na elke zet
      const r = spelZet(mij, String(b.id || ''), b.zet);
      if (!r.error) { const s = spelStaat(mij, String(b.id || '')); if (s.potje) r.potje = s.potje; }
      return r;
    }));
  app.post('/api/member/spel/opgeven', auth, viaLid('opgeven', (mij, b) => spelOpgeven(mij, String(b.id || ''))));
  app.post('/api/member/spel/rahul', auth, viaLid('rahul', (mij, b) => spelRahul(mij, String(b.id || ''), b.vraag)));
  app.post('/api/member/spel/klasgenoten', auth, viaLid('klasgenoten', (mij) => spelKlasgenoten(mij)));
  app.post('/api/member/spel/sneek-score', auth, viaLid('sneek-score', (mij, b) => sneekScore(mij, b.punten)));
  app.post('/api/member/spel/sneek-bord', auth, viaLid('sneek-bord', (mij) => Object.assign({ status: 200 }, sneekBord(mij, vriendenVan(mij)))));
  app.post('/api/member/spel/arcade-score', auth, viaLid('arcade-score', (mij, b) => arcadeScore(mij, String(b.spel || ''), b.punten)));
  app.post('/api/member/spel/arcade-bord', auth, viaLid('arcade-bord', (mij, b) => arcadeBord(mij, String(b.spel || ''), vriendenVan(mij))));

  app.post('/api/rtf/spel/nieuw', huisPoort, viaHuis('nieuw', (mij, b, wereld) => spelNieuw(mij, { soort: b.soort, grootte: b.grootte, modus: b.modus, vrienden: b.vrienden, codenamen: b.codenamen, klasgenoten: b.klasgenoten, taal: b.taal, wereld })));
  app.post('/api/rtf/spel/antwoord', huisPoort, viaHuis('antwoord', (mij, b) => spelAntwoord(mij, String(b.id || ''), b.akkoord === true)));
  app.post('/api/rtf/spel/random', huisPoort, viaHuis('random', (mij, b, wereld) => spelRandom(mij, String(b.soort || ''), b.grootte, b.taal, wereld)));
  app.post('/api/rtf/spel/mijn', huisPoort, viaHuis('mijn', (mij) => Object.assign({ status: 200 }, mijnSpellen(mij))));
  app.post('/api/rtf/spel/staat', huisPoort, viaHuis('staat', (mij, b) => spelStaat(mij, String(b.id || ''), b.velden === true)));
  app.post('/api/rtf/spel/zet', huisPoort, viaHuis('zet', (mij, b) => {
      // de nieuwe staat reist mee in het antwoord: scheelt de client een
      // tweede round-trip na elke zet
      const r = spelZet(mij, String(b.id || ''), b.zet);
      if (!r.error) { const s = spelStaat(mij, String(b.id || '')); if (s.potje) r.potje = s.potje; }
      return r;
    }));
  app.post('/api/rtf/spel/opgeven', huisPoort, viaHuis('opgeven', (mij, b) => spelOpgeven(mij, String(b.id || ''))));
  app.post('/api/rtf/spel/rahul', huisPoort, viaHuis('rahul', (mij, b) => spelRahul(mij, String(b.id || ''), b.vraag)));
  app.post('/api/rtf/spel/klasgenoten', huisPoort, viaHuis('klasgenoten', (mij) => spelKlasgenoten(mij)));
  app.post('/api/rtf/spel/sneek-score', huisPoort, viaHuis('sneek-score', (mij, b) => sneekScore(mij, b.punten)));
  app.post('/api/rtf/spel/sneek-bord', huisPoort, viaHuis('sneek-bord', (mij) => Object.assign({ status: 200 }, sneekBord(mij, vriendenVan(mij)))));
  app.post('/api/rtf/spel/arcade-score', huisPoort, viaHuis('arcade-score', (mij, b) => arcadeScore(mij, String(b.spel || ''), b.punten)));
  app.post('/api/rtf/spel/arcade-bord', huisPoort, viaHuis('arcade-bord', (mij, b) => arcadeBord(mij, String(b.spel || ''), vriendenVan(mij))));
};
