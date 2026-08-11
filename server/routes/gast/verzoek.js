/* Gast OS (deellaag): iets VRAGEN vanaf je eigen telefoon.

   De poort is `gastAuth`, en dat is hier meer dan bedrading: een verzoek hoort
   bij een tafel, en de tafelsleutel is het bewijs dat je daar zit. Zonder die
   grens zou "kunt u even komen bij tafel 12" een knop zijn die iedereen op
   straat kan indrukken.

   WAT DEZE ROUTES NIET DOEN: ze zeggen niets toe. Geen wachttijd, geen "we
   komen eraan", geen automatische compensatie bij een klacht. Wat er
   terugkomt is dat het verzoek staat en hoe lang al. De rest is aan een mens
   (zie kern/gast/verzoek.js voor waarom die grens hier ligt). */
module.exports = (ctx) => {
  const { app, gastAuth, stuur, verzoeklaag } = ctx;

  /* Wat je hier kunt vragen komt van de server en niet uit het scherm: een
     soort die erbij komt hoort niet op twee plekken te worden toegevoegd. */
  app.post('/api/gast/verzoek/soorten', gastAuth, (req, res) => {
    res.json({ ok: true, soorten: verzoeklaag.lijstVoorGast(),
      mijne: verzoeklaag.mijne(req.gast.zaakcode, req.gast.rekening) });
  });

  app.post('/api/gast/verzoek', gastAuth, (req, res) => {
    const b = req.body || {};
    stuur(res, verzoeklaag.vraag(req.gast.zaakcode, req.gast.rekening, req.gast.deelnemer,
      { soort: b.soort, tekst: b.tekst }));
  });

  app.post('/api/gast/verzoek/intrekken', gastAuth, (req, res) => {
    stuur(res, verzoeklaag.trekIn(req.gast.zaakcode, req.gast.rekening, (req.body || {}).verzoek));
  });
};
