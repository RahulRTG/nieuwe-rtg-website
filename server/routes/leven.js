/* RTFoundation: de routes van het Life OS (LEVEN.md).

   Dun, bewust: de kern doet het werk en de route vertaalt alleen. De
   levenslijn levert de lijn en het command center; de mentor staat in
   ./levenmentor.js.

   IN DIT BESTAND STAAT GEEN ENKELE SCHRIJFROUTE, en dat is geen omissie maar
   het verschil tussen deze wereld en RTG Geld. Het werkwoord van RTG Geld is
   uitvoeren binnen regels; het werkwoord van deze wereld is OPENEN, en die
   opent alleen (LEVEN.md par. 0). Wie hier iets wil toevoegen dat namens de
   mens handelt, leest eerst par. 2.2 en 2.7: het platform mag niet sturen,
   en de motor rekent maar beslist niet.

   De enige uitzondering staat bewust in een APART bestand, ./levenband.js:
   daar wordt wel geschreven, maar wat er geschreven wordt is niet het leven
   van iemand maar zijn toestemming (LEVEN.md par. 2.8).

   Identiteit: het token reist in de Authorization-kop, nooit in een URL. */
module.exports = (kern) => {
  const { app, auth } = kern;

  /* GEEN GASTEN, om dezelfde reden als bij RTG Geld (zie routes/geld.js): een
     anonieme gast heeft geen codenaam, en kern.codenaamVan valt voor hem stil
     terug op de rauwe sessiesleutel. Deze laag schrijft weliswaar niets, maar
     ze LEEST een levensbeeld bij elkaar, en dat hoort niemand te krijgen die
     geen lid is. */
  const geenGast = (req, res) => {
    if (req.session.tier === 'guest') {
      res.status(403).json({ error: 'Dit levensbeeld is voor leden.' });
      return true;
    }
    return false;
  };

  /* De try bestaat omdat een omgevallen kernlaag anders als kale 500 zonder
     lichaam bij het lid belandt; de fout blijft zichtbaar in de serverlog.

     ELK PAD STAAT HIERONDER VOLUIT. Een pad dat met een plus wordt gebouwd
     ziet scripts/schakelbaar.js niet, en wat die census niet ziet is vanuit
     de boardroom niet uit te zetten en niet per stad te sluiten -- zie het
     langere waarom in routes/geld.js. */
  const doe = (werk) => (req, res) => {
    if (geenGast(req, res)) return;
    try { res.json(Object.assign({ ok: true }, werk(req.session.key))); }
    catch (e) { res.status(500).json({ error: 'Er ging iets mis. Probeer het opnieuw.' }); }
  };

  /* De lijn: tien fasen in vaste volgorde, met per fase zijn staat. Hier
     wordt niets gefilterd of weggelaten -- welke fasen het SCHERM toont is
     een schermkeuze (LEVEN.md par. 1.1: 'nvt' hoort niet grijs in beeld), en
     een route die alvast weglaat maakt die keuze onomkeerbaar. */
  app.post('/api/leven/lijn', auth, doe((key) => kern.levenslijn.lijn(key)));

  /* Het command center: precies het beeld dat kern/levenslijn samenstelt,
     met alleen ok erbij. Hier wordt niets bijgerekend; een tweede rekenlaag
     in een route loopt gegarandeerd uit de pas met de kern. */
  app.post('/api/leven/cockpit', auth, doe((key) => kern.levenslijn.cockpit(key)));

  /* De mentor staat apart omdat hij als enige de AI aanraakt en zijn eigen
     grenzen draagt; zelfde opzet als routes/geld.js met geldrahul. */
  require('./levenmentor')(kern);
  /* De rechten per relatie (fase 2) staan in ./levenband.js en worden NIET
     hiervandaan gemount, maar rechtstreeks vanuit opzet/aanbouw.js met een
     eigen domeingrens.

     WAAROM DAT VERSCHIL ERTOE DOET. Hij werd hier gemount met de kern van DIT
     domein, en dat is de alleen-lees-grens: `leven` mag `levenslijn` zien en
     verder niets. Daardoor sloeg de domeingrens aan op kern.levensband en gaven
     drie routes een 500 -- band verbreken, een deling zetten en een deling
     intrekken. GRENZEN.json had al een eigen ingang `levenband`, maar die werd
     door niemand gebruikt.

     De grens deed dus precies zijn werk; wat ontbrak was iemand die de toets
     draaide. Hem oplossen door `levensband` aan `leven` toe te voegen zou de
     fout hebben weggenomen en de SCHEIDING mee: deze wereld opent alleen, en de
     enige laag die schrijft hoort niet in dezelfde grens te zitten als de laag
     die dat niet mag. */
};
