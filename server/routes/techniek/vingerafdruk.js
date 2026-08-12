/* Techniek (deelmodule): de TOESTANDSVINGERAFDRUK.

   WAAROM DIT EEN ENDPOINT IS EN GEEN PROEF-VLAG. Er is bewust gekozen voor een
   blijvend pad achter techAuth in plaats van iets dat alleen onder een
   omgevingsvariabele bestaat. Twee redenen, en de tweede is de zwaarste:

   1. Een pad dat alleen in een proefopstelling bestaat, is een pad dat niemand
      draait -- en dus een pad dat op enig moment stuk is zonder dat het opvalt.
      Dezelfde afweging staat in server/lib/verraad.js.
   2. Hij is buiten de proef bruikbaar. Na een incident is "welke collecties
      bewogen er tussen 14:03 en 14:05" een vraag die je wilt kunnen stellen
      zonder in de database te graven.

   WAT ERUIT KOMT: per collectie een aantal en een gezouten hash. Geen sleutels,
   geen waarden, geen namen, geen bedragen. Het waarom daarvan staat in
   server/lib/vingerafdruk.js, en het is niet vrijblijvend: een meetinstrument
   dat gegevens meedraagt is zelf een lek.

   ACHTER techAuth EN NIET achter de gewone inlog: het aantal rijen per
   collectie is op zichzelf al bedrijfsinformatie (hoeveel leden, hoeveel
   boekingen). Dat is geen persoonsgegeven, maar het hoort ook niet bij een
   willekeurig lid.

   Gemount vanuit routes/techniek.js. */
const { vingerafdruk, verschil } = require('../../lib/vingerafdruk');

module.exports = (tctx) => {
  const { app, db, techAuth } = tctx;

  /* `detail: ['naam', ...]` geeft per genoemde collectie ook de losse
     rij-hashes. Duurder, en alleen nodig als je wilt weten WELKE rij bewoog in
     plaats van DAT er een bewoog. Bewust een opgegeven lijst en geen "alles":
     dat laatste is over een volle database een antwoord van tientallen
     megabytes, en dan is de meting zelf de storing. */
  app.post('/api/techniek/vingerafdruk', techAuth, (req, res) => {
    const b = req.body || {};
    const detail = Array.isArray(b.detail) ? b.detail.slice(0, 20).map(String) : [];
    res.json({ ok: true, ...vingerafdruk(db.data, { detail }) });
  });

  /* Twee vingerafdrukken vergelijken kan de aanroeper ook zelf; dat hij het
     hier ook kan vragen, is omdat de REGEL voor "wat telt als een wijziging"
     dan op één plek staat. Twee plekken die dat beslissen, gaan uiteen (LAT.md
     regel 4) -- en dan meet de ene ronde iets anders dan de andere. */
  app.post('/api/techniek/vingerafdruk/verschil', techAuth, (req, res) => {
    const b = req.body || {};
    if (!b.voor || !b.na) return res.status(400).json({ error: 'Geef twee vingerafdrukken mee: voor en na.' });
    res.json({ ok: true, ...verschil(b.voor, b.na) });
  });
};
