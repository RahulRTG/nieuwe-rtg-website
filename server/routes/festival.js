/* Routes "festival": RTG Festival -- het terrein, de passen en de producten.
   Zie FESTIVAL.md voor de doctrine; dit bestand is alleen de deur. De poort
   (scannen) en de cockpit (bezetting, uitzonderingen) staan in ./festival/poort.js.

   ALLES LOOPT LANGS `mijn()`. Het festival moet bestaan EN van de ingelogde zaak
   zijn. Dat is een eigendomscontrole op het DOEL en niet op de aanvrager
   (LAT-regel 7): een id uit het lichaam is nooit een bewijs. Zelfde vorm als
   routes/concern.js, en om dezelfde reden -- daar is die controle ooit vergeten
   en lekte een heel OS erdoorheen.

   EEN 404 VOOR "BESTAAT NIET" EN "NIET VAN JOU". Het verschil zou verklappen
   welke festival-id's bestaan.

   DE CAP EN NIET HET GENRE. Wie een festival mag draaien, hangt aan de
   capability `tickets` en niet aan het genre `events`. Zo krijgt een strandtent
   die een driedaagse organiseert hem ook, zonder dat er een tweede lijst met
   toegestane genres ontstaat (kern/werkvormen.js is de enige waarheid over wat
   een zaak mag gebruiken). */
module.exports = (kern) => {
  const { app, db, festival, logActivity, managerOnly, sseToSupplier, supplierAuth } = kern;

  const httpCode = (v) => (Number.isInteger(v) && v >= 100 && v <= 599 ? v : 200);
  const stuur = (res, r) => res.status(httpCode(r && r.status)).json(r);

  /* De capability-poort. Staat apart van mijn() omdat hij iets anders zegt:
     mijn() gaat over EIGENDOM, dit over MOGEN. Een zaak zonder tickets hoort
     geen festival te kunnen beginnen, ook niet van zichzelf. */
  function magFestival(req, res) {
    if (!(db.capsVan(req.supplier) || []).includes('tickets')) {
      res.status(409).json({ error: 'Deze sector werkt niet met kaarten en entree.' });
      return false;
    }
    return true;
  }

  /* Het festival van deze zaak, of niets. `eigenaar` is de zaakcode; die is bij
     het aanmaken gezet en verandert nooit -- een festival verhuist niet van
     eigenaar zonder dat er een mens naar kijkt. */
  function mijn(req) {
    const f = festival.festivalVind(String((req.body || {}).festival || ''));
    if (!f || f.eigenaar !== req.supplier.code) return null;
    return f;
  }
  const geenFestival = { status: 404, error: 'Dit festival staat niet op naam van uw zaak.' };

  /* De editie gaat RUW door naar de kern, en dat is met opzet.

     Hier stond een tweede eigendomsstap die de editie eerst zelf opzocht en
     404'de als hij niet bij dit festival hoorde. Een mutatie liet zien dat die
     niets tegenhield: elke kernfunctie neemt (festivalId, editieId) en zoekt de
     editie BINNEN dat festival (kern/festival/model.js, editieVind), dus een
     vreemd editie-id kwam daar toch al niet doorheen. Twee wachten waarvan er
     een niets doet, is er een te veel -- de volgende vertrouwt hem (LAT-regel
     4), en dan staat de echte grendel ergens anders dan iedereen denkt.

     Wat WEL een grendel is, staat hierboven: mijn(). Eigendom is het enige dat
     de kern niet kan weten, want die kent geen zaken. */
  const editieVan = (req) => String((req.body || {}).editie || '');

  /* ---- het festival en de editie ---- */

  app.post('/api/festival/mijn', supplierAuth, (req, res) => {
    const alle = Object.values((db.data.festivals || {}))
      .filter(f => f.eigenaar === req.supplier.code)
      .map(f => festival.publiekFestival(f));
    res.json({ ok: true, festivals: alle });
  });

  app.post('/api/festival/nieuw', supplierAuth, (req, res) => {
    if (!managerOnly(req, res)) return;
    if (!magFestival(req, res)) return;
    const r = festival.festivalNieuw(req.supplier.code, req.body || {});
    if (r.ok) logActivity(req.supplier.code, req.actor, 'begon het festival ' + r.festival.naam);
    stuur(res, r);
  });

  app.post('/api/festival/editie', supplierAuth, (req, res) => {
    if (!managerOnly(req, res)) return;
    const f = mijn(req);
    if (!f) return stuur(res, geenFestival);
    stuur(res, festival.editieNieuw(f.id, req.body || {}));
  });

  app.post('/api/festival/dag', supplierAuth, (req, res) => {
    if (!managerOnly(req, res)) return;
    const f = mijn(req);
    if (!f) return stuur(res, geenFestival);
    stuur(res, festival.dagZet(f.id, editieVan(req), req.body || {}));
  });

  /* ---- het terrein ---- */

  app.post('/api/festival/terrein', supplierAuth, (req, res) => {
    const f = mijn(req);
    if (!f) return stuur(res, geenFestival);
    stuur(res, festival.plekBoom(f.id, editieVan(req)));
  });

  app.post('/api/festival/plek', supplierAuth, (req, res) => {
    if (!managerOnly(req, res)) return;
    const f = mijn(req);
    if (!f) return stuur(res, geenFestival);
    const r = festival.plekZet(f.id, editieVan(req), req.body || {});
    if (r.ok) sseToSupplier(req.supplier.code, 'sync', { scope: 'festival' });
    stuur(res, r);
  });

  app.post('/api/festival/plek/weg', supplierAuth, (req, res) => {
    if (!managerOnly(req, res)) return;
    const f = mijn(req);
    if (!f) return stuur(res, geenFestival);
    const r = festival.plekWeg(f.id, editieVan(req), String((req.body || {}).plek || ''));
    if (r.ok) sseToSupplier(req.supplier.code, 'sync', { scope: 'festival' });
    stuur(res, r);
  });

  /* ---- producten en passen ---- */

  app.post('/api/festival/product', supplierAuth, (req, res) => {
    if (!managerOnly(req, res)) return;
    const f = mijn(req);
    if (!f) return stuur(res, geenFestival);
    stuur(res, festival.productZet(f.id, editieVan(req), req.body || {}));
  });

  /* Een pas uitgeven is een handeling met geld- en toegangsgevolgen, dus
     managerOnly. De VERKOOP zelf (betalen, bundels, groepen) is fase 5 en staat
     er bewust nog niet: een halve betaalweg is erger dan geen. */
  app.post('/api/festival/pas', supplierAuth, (req, res) => {
    if (!managerOnly(req, res)) return;
    const f = mijn(req);
    if (!f) return stuur(res, geenFestival);
    const r = festival.pasUitgeven(f.id, editieVan(req), req.body || {});
    if (r.ok) logActivity(req.supplier.code, req.actor, 'gaf een ' + r.pas.soort + '-pas uit op ' + r.pas.drager);
    stuur(res, r);
  });

  app.post('/api/festival/pas/intrek', supplierAuth, (req, res) => {
    if (!managerOnly(req, res)) return;
    const f = mijn(req);
    if (!f) return stuur(res, geenFestival);
    const r = festival.pasIntrekken(f.id, editieVan(req), (req.body || {}).code, (req.body || {}).reden);
    if (r.ok) logActivity(req.supplier.code, req.actor, 'trok een pas in');
    stuur(res, r);
  });

  /* De poort en de cockpit krijgen dezelfde eigendomscontrole mee in plaats van
     een eigen kopie: twee plekken die "is dit festival van jou" beantwoorden,
     is precies hoe zo'n controle uit de pas gaat lopen (LAT-regel 4). */
  require('./festival/poort')(kern, { mijn, editieVan, geenFestival, stuur });
  require('./festival/gereed')(kern, { mijn, editieVan, geenFestival, stuur });
  require('./festival/partner')(kern, { mijn, editieVan, geenFestival, stuur });
  require('./festival/verkoop')(kern, { mijn, editieVan, geenFestival, stuur });
};
