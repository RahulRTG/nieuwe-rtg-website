/* De kloon per zaak en het update-kanaal van de Zaakdoos-vloot. Afgesplitst uit
   ./doos.js toen de kloon per zaak (besluit B12, devices.zaakdoos_sleutel) dat
   bestand over de grens zou zetten.

   DE KLOON. Vroeger gaf hij de hele db.data van alle zaken, en daarom was hij in
   productie dicht voor elke sleutel. Nu geeft hij met een EIGEN sleutel (scope
   kloon) alleen de positieve lijst van kern/zaakdoos/kloon.js voor de zaak VAN
   DE SLEUTEL -- en die mag in productie open. Wie een andere zaak vraagt dan
   zijn sleutel draagt, krijgt 403 en niet stilletjes zijn eigen zaak. In
   productie wordt de sleutelkaart eerst vers uit de autoritatieve opslag gelezen,
   zodat een intrekking op een andere instance hier meteen geldt.

   De volledige kloon met de gedeelde sleutel bestaat alleen nog BUITEN productie
   (de toetsomgeving van de doos); in productie is die weg 503. */
module.exports = (kern, doosSleutelOk) => {
  const { app, db } = kern;
  const kloon = require('../kern/zaakdoos/kloon');
  const productie = () => process.env.NODE_ENV === 'production';
  const NIET_IN_KLOON = ['democratieKwesties', 'democratieJournaal', 'democratieInbrengers', 'democratieActies', 'democratiePartijen', 'democratieVoorstellen'];

  app.get('/api/doos/kloon', async (req, res) => {
    res.set('Cache-Control', 'no-store');
    if (productie()) {
      if (!req.get('x-doos-eigen-sleutel')) return res.status(503).json({ code: 'doos-kloon-productie-dicht',
        error: 'De databasekloon is in productie alleen open voor de eigen sleutel van een doos, en dan alleen voor zijn zaak.' });
      try { if (typeof db.verversVerzoekCollectie === 'function') await db.verversVerzoekCollectie('doosSleutels'); }
      catch (e) { return res.status(503).json({ error: 'De sleutelstand is nu niet vers te lezen. Probeer het zo opnieuw.' }); }
    }
    if (!doosSleutelOk(req, res, 'kloon')) return;
    if (!req.doosZaak) {
      if (productie()) return res.status(503).json({ code: 'doos-kloon-productie-dicht', error: 'De databasekloon is in productie dicht.' });
      // geen DemocratieOS in de kloon: daar staat de koppeling kwestie-mens (POLITIEK.md C4)
      const data = Object.assign({}, db.data);
      for (const tak of NIET_IN_KLOON) delete data[tak];
      return res.json({ data });
    }
    const gevraagd = req.query && req.query.zaak;
    if (gevraagd != null && String(gevraagd).trim().toUpperCase() !== req.doosZaak)
      return res.status(403).json({ error: 'Deze sleutel kloont alleen zijn eigen zaak.' });
    const uit = kloon.kloonVoorZaak(db.data, req.doosZaak);
    if (!uit) return res.status(404).json({ error: 'De zaak van deze doos bestaat niet (meer).' });
    res.json(uit);
  });

  /* Het update-kanaal: de doos haalt hier de doelversie op (na de
     update-opdracht) en meldt de uitslag van zijn update-hook terug.
     Beide achter de doossleutel; de cloud duwt nooit iets naar binnen. */
  app.get('/api/doos/update', (req, res) => {
    if (!doosSleutelOk(req, res, 'update')) return;
    if (!db.data.doosUpdate || !db.data.doosUpdate.versie) return res.status(404).json({ error: 'Er staat geen doelversie klaar.' });
    res.json(db.data.doosUpdate);
  });
  app.post('/api/doos/update/status', (req, res) => {
    if (!doosSleutelOk(req, res, 'update')) return;
    if (!Array.isArray(db.data.doosUpdateStatus)) db.data.doosUpdateStatus = [];
    const b = req.body || {};
    const s = {
      doos: req.doosBewezen || String(b.doos || 'doos').replace(/[<>]/g, '').slice(0, 40),
      zaak: req.doosZaak || null,
      van: String(b.van || '').replace(/[^\w.\-]/g, '').slice(0, 20),
      naar: b.naar ? String(b.naar).replace(/[^\w.\-]/g, '').slice(0, 20) : null,
      gelukt: b.gelukt === true,
      melding: String(b.melding || '').replace(/[<>]/g, '').slice(0, 300), at: Date.now()
    };
    db.data.doosUpdateStatus.unshift(s);
    db.data.doosUpdateStatus = db.data.doosUpdateStatus.slice(0, 200);
    kern.save();
    if (kern.afdelingen) kern.afdelingen.audit('meetstation', 'Doos ' + s.doos + ' meldt update ' + (s.gelukt ? 'gelukt' : 'NIET gelukt') + (s.naar ? ' naar ' + s.naar : '') + ': ' + s.melding);
    res.json({ ok: true });
  });
};
