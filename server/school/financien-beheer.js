/* School (deelmodule): de financiele laag, deel twee -- kantinesaldo,
   budgetten per afdeling, subsidies en de rapportage/export naar de
   boekhouding. Hoort bij school/financien.js (facturen, betalingen,
   debiteuren), dat de factuurlijst en de centen-hulpjes via de context
   meegeeft.

   Dezelfde harde regel geldt hier: GELD RAAKT NOOIT HET ONDERWIJS. Een leeg
   kantinesaldo weigert geen eten -- het verschil wordt een factuur, en die
   factuur sluit op zijn beurt niemand ergens van uit. Elk antwoord zegt dat
   erbij, zodat een koppelend systeem het niet zelf kan verzinnen. */
module.exports = (sctx) => {
  const { router, save, rid, nu, schoon, eigenVeld, poort, leerlingLijst,
    facturen: FAC, naarCenten, openBedrag: open, NOOIT } = sctx;

  const KAN = (sch) => { if (!sch.kantine) sch.kantine = {}; return sch.kantine; };
  const BUD = (sch) => { if (!sch.budgetten) sch.budgetten = {}; return sch.budgetten; };
  const SUB = (sch) => { if (!sch.subsidies) sch.subsidies = []; return sch.subsidies; };

  /* ---------- kantinesaldo ----------
     Opwaarderen en afboeken op de leerling. Een negatief saldo bestaat niet:
     een kind dat niets meer op de pas heeft, krijgt gewoon eten -- dat wordt
     een factuur voor de ouders, geen weigering aan de balie. */
  router.post('/school/kantine/saldo', (req, res) => {
    const g = poort(req, res, 'financieel'); if (!g) return;
    const l = eigenVeld(leerlingLijst(g.sch), req.body.leerlingId);
    if (!l) return res.status(404).json({ error: 'Deze leerling staat niet in de administratie.' });
    const k = KAN(g.sch);
    const rij = k[l.id] || (k[l.id] = { leerlingId: l.id, naam: l.naam, saldo: 0, mutaties: [] });
    const bij = naarCenten(req.body.bij), af = naarCenten(req.body.af);
    if (bij) { rij.saldo += bij; rij.mutaties.unshift({ at: nu(), centen: bij, soort: 'opwaardering' }); }
    if (af) {
      const echt = Math.min(af, rij.saldo);
      rij.saldo -= echt;
      rij.mutaties.unshift({ at: nu(), centen: af, soort: 'besteding', watNiet: af - echt || undefined });
      if (af - echt > 0) {
        const f = { id: rid(6), nummer: 'F' + String(FAC(g.sch).length + 1).padStart(5, '0'), leerlingId: l.id, naam: l.naam,
          soort: 'kantine', omschrijving: 'Kantine, niet gedekt door het saldo', centen: af - echt, betaald: 0, terugbetaald: 0,
          at: nu(), door: g.p.naam, herinneringen: [], status: 'open' };
        FAC(g.sch).unshift(f);
        rij.mutaties[0].factuur = f.nummer;
      }
    }
    rij.mutaties = rij.mutaties.slice(0, 200);
    save();
    res.json(Object.assign({ ok: true, saldo: rij.saldo, mutaties: rij.mutaties.slice(0, 10),
      let: 'Een leeg saldo weigert nooit eten; het verschil wordt een factuur.' }, NOOIT));
  });

  /* ---------- budgetten en subsidies ---------- */
  router.post('/school/budget/zet', (req, res) => {
    const g = poort(req, res, 'financieel'); if (!g) return;
    const id = schoon(req.body.id, 30) || rid(4);
    const naam = schoon(req.body.naam, 60);
    if (!naam) return res.status(400).json({ error: 'Geef het budget een naam (de afdeling of het doel).' });
    const b = BUD(g.sch)[id] || (BUD(g.sch)[id] = { id, naam, centen: 0, besteed: 0, boekingen: [], at: nu() });
    b.naam = naam;
    if (req.body.bedrag != null) b.centen = naarCenten(req.body.bedrag);
    if (req.body.besteding != null) {
      const bedrag = naarCenten(req.body.besteding);
      b.besteed += bedrag;
      b.boekingen = [{ at: nu(), centen: bedrag, wat: schoon(req.body.wat, 120) || null, door: g.p.naam }].concat(b.boekingen).slice(0, 200);
    }
    save();
    res.json({ ok: true, budget: Object.assign({}, b, { over: b.centen - b.besteed, overschreden: b.besteed > b.centen }) });
  });

  router.post('/school/subsidie/zet', (req, res) => {
    const g = poort(req, res, 'financieel'); if (!g) return;
    const naam = schoon(req.body.naam, 80);
    if (!naam) return res.status(400).json({ error: 'Geef de subsidie een naam.' });
    const s = { id: rid(5), naam, verstrekker: schoon(req.body.verstrekker, 80) || null,
      centen: naarCenten(req.body.bedrag), ontvangen: naarCenten(req.body.ontvangen), doel: schoon(req.body.doel, 200) || null,
      verantwoordVoor: schoon(req.body.verantwoordVoor, 10) || null, at: nu() };
    SUB(g.sch).unshift(s); g.sch.subsidies = SUB(g.sch).slice(0, 500);
    save();
    res.json({ ok: true, subsidie: s });
  });

  /* ---------- rapportage en export ----------
     De export is bewust plat en compleet: soort, bedrag, betaald, open, datum.
     Een boekhoudkoppeling die zelf moet raden wat een regel betekent, boekt
     verkeerd. */
  router.post('/school/financien/rapport', (req, res) => {
    const g = poort(req, res, 'financieel.lees'); if (!g) return;
    const alle = FAC(g.sch);
    const perSoort = {};
    for (const f of alle) {
      const r = perSoort[f.soort] || (perSoort[f.soort] = { soort: f.soort, aantal: 0, gefactureerd: 0, betaald: 0, terugbetaald: 0, open: 0 });
      r.aantal++; r.gefactureerd += f.centen; r.betaald += (f.betaald || 0); r.terugbetaald += (f.terugbetaald || 0); r.open += open(f);
    }
    const budgetten = Object.values(BUD(g.sch)).map(b => Object.assign({}, b, { over: b.centen - b.besteed, overschreden: b.besteed > b.centen, boekingen: undefined }));
    res.json(Object.assign({ ok: true,
      totalen: { gefactureerd: alle.reduce((n, f) => n + f.centen, 0), betaald: alle.reduce((n, f) => n + (f.betaald || 0), 0),
        terugbetaald: alle.reduce((n, f) => n + (f.terugbetaald || 0), 0), open: alle.reduce((n, f) => n + open(f), 0) },
      perSoort: Object.values(perSoort), budgetten,
      subsidies: SUB(g.sch).map(s => ({ naam: s.naam, verstrekker: s.verstrekker, centen: s.centen, ontvangen: s.ontvangen, verantwoordVoor: s.verantwoordVoor })),
      export: alle.slice(0, 2000).map(f => ({ nummer: f.nummer, datum: String(f.at).slice(0, 10), soort: f.soort,
        omschrijving: f.omschrijving, centen: f.centen, betaald: f.betaald || 0, terugbetaald: f.terugbetaald || 0, open: open(f) })) }, NOOIT));
  });
};
