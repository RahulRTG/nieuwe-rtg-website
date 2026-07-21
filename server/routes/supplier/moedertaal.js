/* Supplier (deelmodule): de moedertaal van het personeel. Wie bijvoorbeeld
   Spaans spreekt maar in een Nederlands systeem werkt, zet hier EEN keer zijn
   taal; daarna staat zijn hele werkscherm (PDA en werkplekken) in die taal en
   worden bonnen, taken en opdrachten voor hem meevertaald.

   - /api/supplier/mijn/taal      de eigen moedertaal lezen of zetten (per
                                  personeelslid, op staffId; geldt overal waar
                                  diezelfde persoon inlogt)
   - /api/supplier/vertaal/ui     het UI-woordenboek van een werk-app in een
                                  keer naar de moedertaal (gecachet in de
                                  vertaallaag; demo zonder AI-sleutel valt
                                  terug op het werkvloer-woordenboek)
   De losse regels (bonnen, taken) lopen via het bestaande /api/supplier/vertaal. */
module.exports = (kern) => {
  const { app, supplierAuth, db, save, talen } = kern;
  const vertaler = require('../../translate');

  // de taal hoort bij de PERSOON: hetzelfde personeelslid, dezelfde taal, in
  // elke werk-app; het bedrijfsaccount (Beheer) krijgt een eigen sleutel per zaak
  const sleutelVan = req => (req.actor && req.actor.staffId) ? 'p' + req.actor.staffId : 'z' + req.supplier.code;
  const bak = () => {
    if (!db.data.staffTaal || typeof db.data.staffTaal !== 'object') db.data.staffTaal = {};
    return db.data.staffTaal;
  };

  app.post('/api/supplier/mijn/taal', supplierAuth, (req, res) => {
    const b = bak();
    const k = sleutelVan(req);
    if (req.body && req.body.taal !== undefined) {
      const t = String(req.body.taal || '').toLowerCase();
      if (!t || t === 'nl') { delete b[k]; save(); return res.json({ ok: true, taal: 'nl' }); }
      if (!talen.isActief(t)) return res.status(400).json({ error: 'Deze taal staat (nog) niet aan. De boardroom zet wereldtalen aan of uit.' });
      b[k] = t;
      save();
      return res.json({ ok: true, taal: t });
    }
    res.json({ ok: true, taal: b[k] || 'nl', talen: talen.actieve() });
  });

  app.post('/api/supplier/vertaal/ui', supplierAuth, async (req, res) => {
    try {
      const naar = talen.taalVan(req.body.naar);
      const teksten = (Array.isArray(req.body.teksten) ? req.body.teksten : []).slice(0, 400)
        .map(t => String(t == null ? '' : t).slice(0, 300));
      const uit = [];
      for (const t of teksten) uit.push((await vertaler.translate(t, naar)).text);
      res.json({ ok: true, naar, teksten: uit });
    } catch (e) { res.status(500).json({ error: 'Vertalen lukte even niet. Probeer het opnieuw.' }); }
  });
};
