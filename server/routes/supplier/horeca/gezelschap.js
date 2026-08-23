/* Horeca OS (deellaag): het gezelschap aan een rekening, van de kant van de
   BEDIENING.

   De gastenkant kon dit al (kern/gast/sessie.js: aanschuiven met een sleutel);
   de bediening niet. Daardoor was "stoel 1 de entrecote, stoel 3 de zeebaars"
   alleen mogelijk als iedere gast zelf de QR scande -- en dat is precies niet
   hoe een restaurant werkt waar de gastvrouw de bestelling opneemt.

   Vier handelingen, en verder niets: kijken, een stoel erbij of hernoemen, een
   stoel weg, en een regel naar een stoel. De rekensom staat in
   kern/horeca/gezelschap.js; deze laag doet de poort en het opslaan. */
'use strict';

module.exports = (kern) => {
  const { app, save, schoon, supplierAuth, logActivity, sseToSupplier, horeca } = kern;
  const gezelschap = require('../../../kern/horeca/gezelschap')({ horeca, schoon });
  const { totaal } = horeca;

  /* rekVan en publiek komen uit horeca/rekening.js, dat eerder wordt gemount.
     Ze via kern opvragen op het MOMENT van de aanroep en niet nu: bij het
     mounten bestaan ze nog niet, en een undefined die pas maanden later opvalt
     is precies de fout die de folio-laag hier al een keer heeft gemaakt. */
  const rekVan = (req, res) => kern.horecaRekVan(req, res);
  const publiek = (r) => kern.horecaPubliek(r);

  const duw = (code) => sseToSupplier(code, 'sync', { scope: 'horeca' });

  /* ---------- kijken ---------- */
  app.post('/api/supplier/horeca/gezelschap', supplierAuth, (req, res) => {
    const r = rekVan(req, res); if (!r) return;
    res.json({ ok: true, rekeningId: r.id, tafel: r.tafel || r.kanaal, gezelschap: gezelschap.beeld(r) });
  });

  /* ---------- een stoel erbij, of hernoemen ---------- */
  app.post('/api/supplier/horeca/gezelschap/stoel', supplierAuth, (req, res) => {
    const r = rekVan(req, res); if (!r) return;
    if (r.status !== 'open') return res.status(409).json({ error: 'Deze rekening is al ' + r.status + '.' });
    const uit = gezelschap.zetStoel(r, req.body, req.actor.name);
    if (uit.error) return res.status(uit.status || 400).json({ error: uit.error });
    save();
    duw(req.supplier.code);
    res.json({ ok: true, stoel: uit.stoel, gezelschap: gezelschap.beeld(r) });
  });

  /* ---------- een stoel weg ----------
     `ookMetSessie` bestaat wel als schakelaar maar wordt hier NIET doorgegeven:
     een gast met een eigen telefoon aan deze rekening wegklikken is een besluit
     dat bij het overnemen van de rekening hoort, niet bij een kruisje op een
     lijstje. De kern weigert het dus, met een zin die zegt wat er wel kan. */
  app.post('/api/supplier/horeca/gezelschap/stoel/weg', supplierAuth, (req, res) => {
    const r = rekVan(req, res); if (!r) return;
    if (r.status !== 'open') return res.status(409).json({ error: 'Deze rekening is al ' + r.status + '.' });
    const voor = totaal(r).bruto;
    const uit = gezelschap.haalStoel(r, req.body.nr);
    if (uit.error) return res.status(uit.status || 400).json({ error: uit.error });
    /* De grendel onder punt 3 van de kern: een stoel weghalen mag het bedrag op
       de rekening niet aanraken. Klopt het niet, dan slaan we niets op. */
    if (totaal(r).bruto !== voor) return res.status(500).json({ error: 'Het bedrag op de rekening zou veranderen. Er is niets gewijzigd.' });
    save();
    logActivity(req.supplier.code, req.actor, 'haalde ' + uit.handle + ' van de rekening op ' + (r.tafel || r.kanaal));
    duw(req.supplier.code);
    res.json({ ok: true, weg: uit.stoel, losgemaakt: uit.losgemaakt, let: uit.let, gezelschap: gezelschap.beeld(r) });
  });

  /* ---------- een regel naar een stoel ---------- */
  app.post('/api/supplier/horeca/rekening/regel/stoel', supplierAuth, (req, res) => {
    const r = rekVan(req, res); if (!r) return;
    if (r.status !== 'open') return res.status(409).json({ error: 'Deze rekening is al ' + r.status + '.' });
    const uit = gezelschap.regelNaarStoel(r, req.body.regelId, req.body.nr);
    if (uit.error) return res.status(uit.status || 400).json({ error: uit.error });
    save();
    /* Naar de keuken duwen en niet alleen naar de zaal: op de bon bij de pas
       staat waar het bord heen moet, en dat is net veranderd. */
    sseToSupplier(req.supplier.code, 'sync', { scope: 'keuken' });
    duw(req.supplier.code);
    res.json({ ok: true, naar: uit.naar, handle: uit.handle || null,
      rekening: publiek(r), gezelschap: gezelschap.beeld(r) });
  });

  kern.horecaGezelschap = gezelschap;
};
