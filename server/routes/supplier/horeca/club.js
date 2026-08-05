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
   4. DE CAPACITEITSTELLER IS EEN TELLER, GEEN CAMERA. Hij telt in en uit,
      inclusief herbetreding, en zegt hoeveel er nog bij kan. Er wordt niet
      bijgehouden wie er binnen is -- alleen hoeveel. */
module.exports = (kern) => {
  const { app, save, schoon, supplierAuth, logActivity, horeca } = kern;
  const { H, nu, id, centen, uitEuro, bonMaak, bonBoek } = horeca;

  const C = (code) => { const h = H(code); if (!h.club) h.club = { banden: {}, gastenlijst: [], deur: {}, tafels: {} }; return h.club; };
  const vandaag = () => nu().slice(0, 10);

  /* ---------- polsbanden ---------- */
  app.post('/api/supplier/horeca/club/band', supplierAuth, (req, res) => {
    const c = C(req.supplier.code);
    const nummer = schoon(req.body.nummer, 40);
    if (!nummer) return res.status(400).json({ error: 'Welk bandnummer? (het nummer dat op de band staat, geen naam)' });
    const bedrag = req.body.bedrag != null ? uitEuro(req.body.bedrag) : centen(req.body.centen);
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
    res.json({ ok: true, band: { nummer, saldo, opgewaardeerd: band.opgewaardeerd },
      let: 'Op een band staat een nummer en een saldo, geen naam.' });
  });

  app.post('/api/supplier/horeca/club/band/betaal', supplierAuth, (req, res) => {
    const c = C(req.supplier.code);
    const band = c.banden[schoon(req.body.nummer, 40)];
    if (!band) return res.status(404).json({ error: 'Deze band kennen we niet.' });
    const bedrag = req.body.bedrag != null ? uitEuro(req.body.bedrag) : centen(req.body.centen);
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
    const minimum = req.body.minimum != null ? uitEuro(req.body.minimum) : centen(req.body.minimumCenten);
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

  /* ---------- gastenlijst en promotercodes ---------- */
  app.post('/api/supplier/horeca/club/gastenlijst', supplierAuth, (req, res) => {
    const c = C(req.supplier.code);
    if (Array.isArray(req.body.namen)) {
      const datum = schoon(req.body.datum, 10) || vandaag();
      const promoter = schoon(req.body.promoter, 40) || null;
      for (const n of req.body.namen.slice(0, 500)) {
        const naam = schoon(n, 60);
        if (!naam) continue;
        c.gastenlijst.push({ id: id(3), naam, datum, promoter, personen: Math.max(1, Math.min(20, parseInt(req.body.personen, 10) || 1)),
          korting: schoon(req.body.korting, 40) || null, binnen: false, at: nu() });
      }
      c.gastenlijst = c.gastenlijst.slice(-5000);
      save();
    }
    const datum = schoon(req.body.datum, 10) || vandaag();
    const lijst = c.gastenlijst.filter(g => g.datum === datum);
    const perPromoter = {};
    for (const g of lijst) {
      const p = g.promoter || 'zonder promoter';
      perPromoter[p] = perPromoter[p] || { aangemeld: 0, binnen: 0 };
      perPromoter[p].aangemeld += g.personen;
      if (g.binnen) perPromoter[p].binnen += g.personen;
    }
    res.json({ ok: true, datum, aantal: lijst.length, gasten: lijst.slice(0, 500), perPromoter,
      let: 'Per promoter telt wat er is aangemeld EN wat er echt binnen is; alleen dat eerste zegt niets.' });
  });

  /* ---------- de deur: in, uit en terug ---------- */
  app.post('/api/supplier/horeca/club/deur', supplierAuth, (req, res) => {
    const c = C(req.supplier.code);
    const datum = vandaag();
    const d = c.deur[datum] = c.deur[datum] || { binnen: 0, in: 0, uit: 0, herbetreding: 0, geweigerd: 0 };
    const capaciteit = Math.max(1, Math.min(20000, parseInt(req.body.capaciteit, 10) || c.capaciteit || 300));
    c.capaciteit = capaciteit;
    const wat = String(req.body.wat || 'stand');
    const personen = Math.max(1, Math.min(50, parseInt(req.body.personen, 10) || 1));

    if (wat === 'in' || wat === 'terug') {
      if (d.binnen + personen > capaciteit) {
        d.geweigerd += personen;
        save();
        return res.status(409).json({ error: 'De capaciteit is bereikt (' + d.binnen + ' van ' + capaciteit + ' binnen).',
          vol: true, binnen: d.binnen, capaciteit });
      }
      if (req.body.leeftijdGecontroleerd === false)
        return res.status(409).json({ error: 'Zonder leeftijdscontrole komt er niemand binnen.' });
      d.binnen += personen;
      if (wat === 'in') d.in += personen; else d.herbetreding += personen;
      const g = req.body.gastId ? c.gastenlijst.find(x => x.id === String(req.body.gastId)) : null;
      if (g) g.binnen = true;
    } else if (wat === 'uit') {
      d.binnen = Math.max(0, d.binnen - personen);
      d.uit += personen;
    } else if (wat !== 'stand') return res.status(400).json({ error: 'Kies in, uit, terug of stand.' });
    save();
    const lijst = c.gastenlijst.filter(g => g.datum === datum);
    res.json({ ok: true, binnen: d.binnen, capaciteit, vrij: Math.max(0, capaciteit - d.binnen),
      in: d.in, uit: d.uit, herbetreding: d.herbetreding, geweigerd: d.geweigerd,
      verwacht: lijst.filter(g => !g.binnen).reduce((t, g) => t + g.personen, 0),
      let: 'De teller telt hoeveel mensen er binnen zijn, niet wie.' });
  });
};
