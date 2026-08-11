/* RTG Sociaal: de samenhanglaag en de sociale graaf -- wat er tussen u en de
   mensen om u heen speelt (PLATFORM.md laag 2, LIFE.md fase 1).

   ALLEEN LEZEN, ALLEBEI. Praten, plaatsen, aanmelden en matchen blijft in de
   gespecialiseerde app -- Berichten, Genootschap, Pulse, De Salon, Vonk -- en
   deze routes hebben er met opzet geen tegenhanger voor. Dat is niet alleen een
   afspraak: de twee kernlagen eronder hebben geen enkele schrijffunctie, en
   test/socialegraaf.test.js zakt zodra er een bij komt.

   WAAROM TWEE ROUTES EN NIET EEN. `/wereld` is de rij die het huidige scherm
   toont (drie bronnen, vier signalen, dezelfde taal als Reizen en Kantoor).
   `/graaf` is de diepere laag: negen bronnen plus de Control Tower, en de vraag
   die geen sociale app vandaag beantwoordt -- wat wacht er op mij, en wat komt
   eraan. Ze samenvoegen zou betekenen dat het bestaande scherm negen domeinen
   moet ophalen voor drie rijen; ze naast elkaar laten kost een route.

   GEEN GASTEN OP DE GRAAF. De samenhanglaag mag een gast bedienen (die ziet dan
   gewoon niets), maar de graaf leest de vriendenlaag, de matches en de termijnen
   van de mensen om het lid heen. Dat is geen beeld voor een sessie zonder pas. */
module.exports = (kern) => {
  const { app, auth, geenGast } = kern;

  app.post('/api/sociaal/wereld', auth, (req, res) =>
    res.json(kern.socialewereld.kring(req.session.key)));

  app.post('/api/sociaal/graaf', auth, (req, res) => {
    if (geenGast(req, res)) return;
    res.json(kern.socialegraaf.beeld(req.session.key));
  });

  /* Een object opvragen: wat kan ik met deze persoon, groep of bijeenkomst
     (LIFE.md fase 2). Ook dit is ALLEEN LEZEN -- elke cap die terugkomt is een
     weg naar de app die het echte werk doet, en er is hier geen tegenhanger die
     iets uitvoert.

     EEN 404 ZEGT NIET WELKE VAN DE TWEE HET WAS. Bestaat niet en hoort niet bij
     u komen allebei hier uit, met dezelfde tekst. Zou de melding verschillen,
     dan is een reeks aanvragen genoeg om te leren welke groepen bestaan en hoe
     ze heten -- en dat is precies wat een besloten genootschap niet mag lekken. */
  app.post('/api/sociaal/object', auth, (req, res) => {
    if (geenGast(req, res)) return;
    const b = req.body || {};
    const r = kern.objectlaag.object(req.session.key, String(b.soort || ''), b.id);
    if (!r) return res.status(404).json({ error: 'Dit vinden we niet.' });
    res.json(r);
  });
};
