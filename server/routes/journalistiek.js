/* Routes voor het Journalistiek-genre.
   - /api/supplier/redactie/*  : de redactie zelf (achter de leverancier-inlog)
   - /api/krant/*              : de gepubliceerde krant lezen (openbaar) */
module.exports = (kern) => {
  const { app, db, supplierAuth, journalistiek } = kern;
  const stuur = (res, r) => r && r.error ? res.status(r.status || 400).json({ error: r.error }) : res.json(r);
  const code = req => req.supplier.code;

  /* DE REDACTIE IS EEN WERKVORM, GEEN ALGEMENE FUNCTIE.

     Tot nu toe kon elke zaak met een leverancier-inlog een krant beginnen: een
     taxibedrijf, een hotel, een kapper. Dat wijkt af van elke andere zakelijke
     module in dit huis -- retail, zorg, vervoer -- die allemaal achter hun
     capability zitten (db.capsVan). En het is niet vrijblijvend: een krant
     publiceert onder de naam van de zaak op /api/krant/*, dus dit is de enige
     module waarmee een zaak zonder tussenkomst iets NAAR BUITEN brengt.

     De capability heet 'redactie' en hangt aan de werkvorm journalistiek
     (seed/leveranciers.js). Wie hem niet heeft, krijgt 409 met de reden --
     dezelfde vorm als eisRetail in routes/supplier/retail.js, zodat er een
     manier is en niet twee. */
  function eisRedactie(req, res) {
    if (!db.capsVan(req.supplier).includes('redactie')) {
      res.status(409).json({ error: 'Deze zaak heeft geen redactie. Een krant hoort bij de werkvorm journalistiek.' });
      return false;
    }
    return true;
  }
  // elke redactie-route langs dezelfde deur; alleen /api/krant/* blijft openbaar
  const red = (pad, fn) => app.post('/api/supplier/redactie' + pad, supplierAuth, (req, res) => {
    if (!eisRedactie(req, res)) return;
    return fn(req, res);
  });

  red('/staat', (req, res) => res.json(journalistiek.staat(code(req))));
  red('/artikelen', (req, res) => res.json(journalistiek.artikelen(code(req), req.body || {})));
  red('/artikel/haal', (req, res) => {
    const a = journalistiek.artikelVol(code(req), (req.body || {}).id);
    if (!a) return res.status(404).json({ error: 'Artikel niet gevonden.' });
    res.json({ artikel: a });
  });
  red('/artikel/bewaar', (req, res) => stuur(res, journalistiek.bewaarArtikel(code(req), req.body || {}, req.actor)));
  red('/artikel/publiceer', (req, res) => stuur(res, journalistiek.publiceer(code(req), (req.body || {}).id, req.actor)));
  red('/artikel/concept', (req, res) => stuur(res, journalistiek.naarConcept(code(req), (req.body || {}).id)));
  red('/artikel/verwijder', (req, res) => stuur(res, journalistiek.verwijderArtikel(code(req), (req.body || {}).id)));
  red('/snel', (req, res) => stuur(res, journalistiek.snel(code(req), req.body || {}, req.actor)));
  red('/rubriek/bewaar', (req, res) => stuur(res, journalistiek.rubriekBewaar(code(req), (req.body || {}).naam)));
  red('/rubriek/verwijder', (req, res) => stuur(res, journalistiek.rubriekWeg(code(req), (req.body || {}).naam)));
  red('/huisstijl', (req, res) => stuur(res, journalistiek.huisstijlBewaar(code(req), req.body || {})));
  red('/site/bewaar', (req, res) => stuur(res, journalistiek.siteBewaar(code(req), (req.body || {}).design || req.body || {})));
  red('/assist', async (req, res) => { try { res.json(await journalistiek.assist(code(req), req.body || {})); } catch (e) { res.json({ chapo: '', koppen: [] }); } });

  // openbaar: de krant lezen
  app.post('/api/krant/gids', (req, res) => res.json({ lijst: journalistiek.krantGids() }));
  app.post('/api/krant/open', (req, res) => stuur(res, journalistiek.krant(String((req.body || {}).code || '').toUpperCase())));
  app.post('/api/krant/artikel', (req, res) => stuur(res, journalistiek.leesArtikel(String((req.body || {}).code || '').toUpperCase(), (req.body || {}).id)));
};
