/* Horeca OS (deellaag): de offline-wachtrij en de instellingen (happy hour
   en arrangementen). De bonnen staan in horeca/bonkaart.js; inwisselen loopt
   via horeca/betalen.js.

   OFFLINE IS EEN ECHTE STAND. Bonnen die tijdens een internetstoring op het
   apparaat zijn gemaakt, komen met hun EIGEN tijdstip binnen en met een
   clientId. Dezelfde bon twee keer insturen levert een keer omzet -- en de
   tweede keer wordt GETELD in het antwoord, niet stil genegeerd: een kassa die
   denkt te hebben verkocht wat er niet staat, is erger dan een foutmelding. */
module.exports = (kern) => {
  const { app, save, schoon, supplierAuth } = kern;
  const { H, id, heleCenten, uitEuro } = kern.horeca;

  /* De bonnen zelf (cadeaubon, tegoed) staan sinds 27 september 2026 in
     ./bonkaart.js, op hun eigen collectie met een 128-bit code als hash. */

  require('./offline')(kern);

  /* ---------- happy hour en arrangementen instellen ---------- */
  app.post('/api/supplier/horeca/instel', supplierAuth, (req, res) => {
    const h = H(req.supplier.code);
    if (Array.isArray(req.body.happy)) {
      h.instel.happy = req.body.happy.slice(0, 20).map(x => ({
        naam: schoon(x && x.naam, 40) || 'Happy hour',
        van: schoon(x && x.van, 5) || null, tot: schoon(x && x.tot, 5) || null,
        dagen: Array.isArray(x && x.dagen) ? x.dagen.map(Number).filter(d => d >= 0 && d <= 6) : [],
        groepen: Array.isArray(x && x.groepen) ? x.groepen.slice(0, 10).map(g => schoon(g, 30)).filter(Boolean) : [],
        procent: Math.max(0, Math.min(90, Number(x && x.procent) || 0)) }));
    }
    if (Array.isArray(req.body.arrangementen)) {
      h.instel.arrangementen = req.body.arrangementen.slice(0, 30).map(a => ({
        id: schoon(a && a.id, 20) || id(3), naam: schoon(a && a.naam, 60) || 'Arrangement',
        centen: a && a.centen != null ? heleCenten(a.centen) : uitEuro(a && a.prijs),
        perPersoon: (a && a.perPersoon) !== false,
        bevat: Array.isArray(a && a.bevat) ? a.bevat.slice(0, 20).map(x => schoon(x, 60)).filter(Boolean) : [] }));
    }
    save();
    res.json({ ok: true, instel: h.instel });
  });
};
