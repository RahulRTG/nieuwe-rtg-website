/* School (deelmodule): de eigen Rahul Bijles van elk kind (en van elke ouder
   die mee wil leren). Het niveau komt uit de klas (Groep ...) en de leerdoelen
   uit het nog open huiswerk; het gesprek is persoonlijk en blijft bewaard.
   De toon en de vaste regels (geduldig, positief, eerlijk) staan in
   kern/bijles.js -- een motor, twee werelden. */
const { maakBijles } = require('../kern/bijles');

module.exports = (sctx) => {
  const { router, F, save, schoon, eigenVeld, K, gezinSessie, leerlingVan } = sctx;
  const motor = maakBijles({
    winkel: () => { const f = F(); if (!f.bijles) f.bijles = {}; return f.bijles; },
    save, schoon
  });

  // het niveau en de open leerdoelen van dit kind in deze klas (mag ontbreken)
  function context(s, req) {
    const kc = String(req.body.klasCode || '').trim().toUpperCase();
    const k = kc ? eigenVeld(K(), kc) : null;
    const l = k && leerlingVan(k, s.g, s.p.id);
    const doelen = l ? (k.huiswerk || [])
      .filter(h => h.doel && !(h.afDoor || []).includes(l.sleutel))
      .map(h => h.titel).slice(0, 5) : [];
    return { niveau: l ? k.naam : null, doelen };
  }

  router.post('/school/bijles/vraag', async (req, res) => {
    const s = gezinSessie(req, res); if (!s) return;
    const c = context(s, req);
    const r = await motor.vraag({ sleutel: 'gezin:' + s.g.code + ':' + s.p.id, naam: s.p.naam,
      niveau: c.niveau, doelen: c.doelen, tekst: req.body.tekst });
    if (r.error) return res.status(r.status || 400).json({ error: r.error });
    res.json(r);
  });
  router.post('/school/bijles/gesprek', (req, res) => {
    const s = gezinSessie(req, res); if (!s) return;
    res.json(motor.gesprek('gezin:' + s.g.code + ':' + s.p.id));
  });
};
