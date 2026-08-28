/* Horeca OS (deellaag): de club en de drukke bar -- polsbandtegoed,
   minimum spend op een VIP-tafel, de gastenlijst met promotercodes, de
   capaciteitsteller aan de deur en herbetreding.

   Vier keuzes, en ze gaan alle vier over hetzelfde: een club weet 's nachts om
   half drie precies zoveel als het systeem hem vertelt.

   1. EEN POLSBAND IS GELD, DUS HIJ KAN NOOIT ONDER NUL. Opwaarderen en
      afboeken lopen via dezelfde bonnenlaag als de cadeaubon (kern/horeca.js):
      een band is een tegoed met een polsbandnummer erop. Bij vertrek kan het
      restsaldo terug -- dat is geen gunst maar geld van de gast.
   2. EEN POLSBAND DRAAGT GEEN NAAM. Er staat een nummer op en een saldo. Wie
      hem verliest, verliest zijn tegoed en niet zijn identiteit; wij hoeven
      niet te weten wie er om 02:41 een biertje kocht.
   3. MINIMUM SPEND IS EEN AFSPRAAK, GEEN INCASSO. Het systeem toont wat er nog
      te gaan is en int niets automatisch bij; wat er aan het eind gebeurt, is
      een gesprek aan de tafel en geen stille afboeking.
   4. DE GASTENLIJST EN DE DEUR STAAN HIERNAAST, in horeca/clubdeur.js. Ze
      zijn hier weggeknipt toen de gastenlijst een tweede schrijver kreeg (de
      avondplanner) en dit bestand over de 10 kB ging. De knip loopt op een
      onderwerpgrens: hier het geld van de gast, daar de deur. */
module.exports = (kern) => {
  const { app, save, schoon, supplierAuth, logActivity, horeca } = kern;
  const { H, nu, id, heleCenten, uitEuro, bonMaak, bonBoek } = horeca;

  /* De doos van de club (banden, tafels, lijst, deur) komt uit
     kern/horeca/clublaag.js, zodat dit bestand en clubdeur.js er niet elk een
     eigen versie van aanmaken. */
  const { C } = kern.clublaag;

  /* ---------- polsbanden ---------- */
  app.post('/api/supplier/horeca/club/band', supplierAuth, (req, res) => {
    const c = C(req.supplier.code);
    const nummer = schoon(req.body.nummer, 40);
    if (!nummer) return res.status(400).json({ error: 'Welk bandnummer? (het nummer dat op de band staat, geen naam)' });
    const bedrag = req.body.bedrag != null ? uitEuro(req.body.bedrag) : heleCenten(req.body.centen);
    if (!bedrag) return res.status(400).json({ error: 'Voor hoeveel wordt de band opgewaardeerd?' });
    let band = c.banden[nummer];
    if (!band) {
      const bon = bonMaak(req.supplier.code, { soort: 'tegoed', centen: bedrag, naam: 'Polsband ' + nummer });
      band = c.banden[nummer] = { nummer, bonCode: bon.code, at: nu(), opgewaardeerd: bedrag };
    } else {
      const h = H(req.supplier.code);
      const bon = h.bonnen[band.bonCode];
      if (!bon) return res.status(404).json({ error: 'Het tegoed van deze band is niet gevonden.' });
      bon.saldo += bedrag;
      bon.uitgegeven += bedrag;
      bon.mutaties.unshift({ at: nu(), centen: bedrag });
      band.opgewaardeerd = (band.opgewaardeerd || 0) + bedrag;
    }
    save();
    const saldo = H(req.supplier.code).bonnen[band.bonCode].saldo;
    logActivity(req.supplier.code, req.actor, 'waardeerde band ' + nummer + ' op met ' + (bedrag / 100).toFixed(2));
    /* De BONCODE gaat mee terug. Die is het bewijs-in-handen waarmee een gast
       op zijn telefoon zijn saldo kan zien en kan afrekenen (routes/gast/club.js):
       het bandnummer staat groot op de band en is te raden, de boncode niet.
       Druk hem als QR op de band; toon hem verder nergens. */
    res.json({ ok: true, band: { nummer, saldo, opgewaardeerd: band.opgewaardeerd, bonCode: band.bonCode },
      pad: '/apps/gast.html?band=' + band.bonCode,
      let: 'Op een band staat een nummer en een saldo, geen naam. De boncode is het bewijs-in-handen: zet hem als QR op de band.' });
  });

  app.post('/api/supplier/horeca/club/band/betaal', supplierAuth, (req, res) => {
    const c = C(req.supplier.code);
    const band = c.banden[schoon(req.body.nummer, 40)];
    if (!band) return res.status(404).json({ error: 'Deze band kennen we niet.' });
    const bedrag = req.body.bedrag != null ? uitEuro(req.body.bedrag) : heleCenten(req.body.centen);
    const uit = bonBoek(req.supplier.code, band.bonCode, bedrag);
    if (uit.error) return res.status(uit.status || 400).json({ error: uit.error });
    res.json({ ok: true, geboekt: uit.geboekt, saldo: uit.saldo, tekort: uit.restVraag || 0,
      let: uit.restVraag ? 'Er is ' + (uit.restVraag / 100).toFixed(2) + ' te weinig saldo; laat de rest apart afrekenen.' : null });
  });

  app.post('/api/supplier/horeca/club/band/terug', supplierAuth, (req, res) => {
    const c = C(req.supplier.code);
    const band = c.banden[schoon(req.body.nummer, 40)];
    if (!band) return res.status(404).json({ error: 'Deze band kennen we niet.' });
    const h = H(req.supplier.code);
    const bon = h.bonnen[band.bonCode];
    if (!bon || !bon.saldo) return res.status(409).json({ error: 'Er staat niets meer op deze band.' });
    const terug = bon.saldo;
    bon.saldo = 0;
    bon.mutaties.unshift({ at: nu(), centen: -terug, soort: 'uitbetaald' });
    band.uitbetaald = (band.uitbetaald || 0) + terug;
    save();
    logActivity(req.supplier.code, req.actor, 'betaalde ' + (terug / 100).toFixed(2) + ' terug van band ' + band.nummer);
    res.json({ ok: true, uitbetaald: terug, saldo: 0,
      let: 'Restsaldo hoort terug naar de gast; het is geen omzet van de club.' });
  });

  /* ---------- minimum spend op een tafel ---------- */
  app.post('/api/supplier/horeca/club/tafel', supplierAuth, (req, res) => {
    const c = C(req.supplier.code);
    const naam = schoon(req.body.tafel, 30);
    if (!naam) return res.status(400).json({ error: 'Welke tafel?' });
    const minimum = req.body.minimum != null ? uitEuro(req.body.minimum) : heleCenten(req.body.minimumCenten);
    c.tafels[naam] = { tafel: naam, minimumCenten: minimum, gastnaam: schoon(req.body.gastnaam, 60) || null,
      personen: Math.max(1, Math.min(60, parseInt(req.body.personen, 10) || 2)),
      rekeningId: schoon(req.body.rekeningId, 40) || null, at: nu(), door: req.actor.name };
    save();
    res.json({ ok: true, tafel: c.tafels[naam] });
  });

  app.post('/api/supplier/horeca/club/tafel/stand', supplierAuth, (req, res) => {
    const c = C(req.supplier.code);
    const h = H(req.supplier.code);
    const rijen = Object.values(c.tafels).map(t => {
      const rek = t.rekeningId ? h.rekeningen[t.rekeningId] : null;
      const besteed = rek ? (rek.regels || []).reduce((s, r) => s + r.centen * r.aantal, 0) : 0;
      return { tafel: t.tafel, gastnaam: t.gastnaam, personen: t.personen, minimumCenten: t.minimumCenten,
        besteed, teGaan: Math.max(0, t.minimumCenten - besteed), gehaald: besteed >= t.minimumCenten };
    }).sort((a, b) => String(a.tafel).localeCompare(String(b.tafel)));
    res.json({ ok: true, tafels: rijen,
      let: 'Minimum spend is een afspraak: het systeem toont wat er te gaan is en boekt niets automatisch bij.' });
  });

};
