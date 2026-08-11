/* Routes "overheid" (deelmodule): DE RIJKS-BIBLIOTHEEK -- 10.000 werk-apps per
   overheidsafdeling, inbegrepen voor rijksambtenaren, met de installaties per
   ambtenaar.

   Afgesplitst van ./overheid.js, dat over de 10 kB-lat ging toen het btw-toezicht
   erbij kwam. Het is ook de natuurlijke naad: dit is een appwinkel en geen
   behandelloket, en het is het enige blok daar dat `rijksbieb` nodig heeft.

   DE POORT KOMT MEE UIT HET MOEDERBESTAND en wordt hier niet opnieuw geschreven.
   `rijk` is de controle of de ingelogde partner het rijk zelf is; die twee keer
   opschrijven is twee plekken die dezelfde waarheid vasthouden, en dan lopen ze
   uiteen zodra er een verandert (LAT.md regel 4). */
module.exports = (kern, { rijk }) => {
  const { app, supplierAuth, rijksbieb } = kern;

  /* ---- de Rijks-Bibliotheek: 10.000 werk-apps per overheidsafdeling,
     inbegrepen voor rijksambtenaren; installaties per ambtenaar ---- */
  const ambtenaarSleutel = req => 'RIJK:' + ((req.actor && (req.actor.id || req.actor.name)) || 'balie');
  app.post('/api/overheid/bieb', supplierAuth, rijk, (req, res) => res.json(rijksbieb.overzicht()));
  app.post('/api/overheid/bieb/catalogus', supplierAuth, rijk, (req, res) => res.json(rijksbieb.catalogus(req.body || {})));
  app.post('/api/overheid/bieb/installeer', supplierAuth, rijk, (req, res) => {
    const r = rijksbieb.installeer(ambtenaarSleutel(req), req.body.id);
    if (r.error) return res.status(r.status || 400).json({ error: r.error });
    res.json(r);
  });
  app.post('/api/overheid/bieb/weg', supplierAuth, rijk, (req, res) => {
    const r = rijksbieb.verwijder(ambtenaarSleutel(req), req.body.id);
    if (r.error) return res.status(r.status || 400).json({ error: r.error });
    res.json(r);
  });
  app.post('/api/overheid/bieb/mijn', supplierAuth, rijk, (req, res) => res.json({ apps: rijksbieb.mijnApps(ambtenaarSleutel(req)) }));
};
