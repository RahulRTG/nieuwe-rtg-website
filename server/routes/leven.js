/* RTFoundation: de routes van het Life OS (LEVEN.md).

   Dun, bewust: de kern doet het werk en de route vertaalt alleen. De
   levenslijn levert de lijn en het command center; de mentor staat in
   ./levenmentor.js.

   ER STAAT HIER GEEN ENKELE SCHRIJFROUTE, en dat is geen omissie maar het
   verschil tussen deze wereld en RTG Geld. Het werkwoord van RTG Geld is
   uitvoeren binnen regels; het werkwoord van deze wereld is OPENEN, en die
   opent alleen (LEVEN.md par. 0). Wie hier iets wil toevoegen dat namens de
   mens handelt, leest eerst par. 2.2 en 2.7: het platform mag niet sturen,
   en de motor rekent maar beslist niet.

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
     lichaam bij het lid belandt; de fout blijft zichtbaar in de serverlog. */
  function route(pad, werk) {
    app.post('/api/leven/' + pad, auth, (req, res) => {
      if (geenGast(req, res)) return;
      try { res.json(Object.assign({ ok: true }, werk(req.session.key))); }
      catch (e) { res.status(500).json({ error: 'Er ging iets mis. Probeer het opnieuw.' }); }
    });
  }

  /* De lijn: tien fasen in vaste volgorde, met per fase zijn staat. Hier
     wordt niets gefilterd of weggelaten -- welke fasen het SCHERM toont is
     een schermkeuze (LEVEN.md par. 1.1: 'nvt' hoort niet grijs in beeld), en
     een route die alvast weglaat maakt die keuze onomkeerbaar. */
  route('lijn', (key) => kern.levenslijn.lijn(key));

  /* Het command center: precies het beeld dat kern/levenslijn samenstelt,
     met alleen ok erbij. Hier wordt niets bijgerekend; een tweede rekenlaag
     in een route loopt gegarandeerd uit de pas met de kern. */
  route('cockpit', (key) => kern.levenslijn.cockpit(key));

  /* De mentor staat apart omdat hij als enige de AI aanraakt en zijn eigen
     grenzen draagt; zelfde opzet als routes/geld.js met geldrahul. */
  require('./levenmentor')(kern);
};
