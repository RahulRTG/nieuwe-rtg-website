/* Horeca OS (deellaag): cadeaubonnen en tegoed, de offline-wachtrij en de
   instellingen (happy hour en arrangementen). Hoort bij horeca/betalen.js;
   inwisselen loopt daar via dezelfde betaalweg.

   OFFLINE IS EEN ECHTE STAND. Bonnen die tijdens een internetstoring op het
   apparaat zijn gemaakt, komen met hun EIGEN tijdstip binnen en met een
   clientId. Dezelfde bon twee keer insturen levert een keer omzet -- en de
   tweede keer wordt GETELD in het antwoord, niet stil genegeerd: een kassa die
   denkt te hebben verkocht wat er niet staat, is erger dan een foutmelding. */
module.exports = (kern) => {
  const { app, save, schoon, supplierAuth, logActivity, horeca } = kern;
  const { H, Hlees, id, heleCenten, uitEuro, bonMaak } = horeca;

  /* ---------- bonnen ---------- */
  app.post('/api/supplier/horeca/bon/maak', supplierAuth, (req, res) => {
    const bedrag = req.body.centen != null ? heleCenten(req.body.centen) : uitEuro(req.body.bedrag);
    if (!bedrag) return res.status(400).json({ error: 'Voor welk bedrag?' });
    const b = bonMaak(req.supplier.code, { soort: req.body.soort, centen: bedrag,
      naam: req.body.naam, geldigTot: req.body.geldigTot });
    logActivity(req.supplier.code, req.actor, 'gaf een ' + b.soort + ' uit van ' + (bedrag / 100).toFixed(2));
    res.json({ ok: true, bon: b });
  });

  /* OPZOEKEN IS KIJKEN: H() zet de doos van een zaak neer zodra iemand ernaar
     vraagt, ook bij een 404 (kern/horeca.js). */
  app.post('/api/supplier/horeca/bon', supplierAuth, (req, res) => {
    const h = Hlees(req.supplier.code);
    const code = String(req.body.bonCode || '').toUpperCase();
    const b = Object.prototype.hasOwnProperty.call(h.bonnen, code) ? h.bonnen[code] : null;
    if (!b) return res.status(404).json({ error: 'Deze bon kennen we niet.' });
    res.json({ ok: true, bon: { code: b.code, soort: b.soort, saldo: b.saldo, uitgegeven: b.uitgegeven,
      geldigTot: b.geldigTot, mutaties: b.mutaties.slice(0, 10) } });
  });

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
