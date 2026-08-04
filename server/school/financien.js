/* School (deelmodule): de financiele laag -- schoolgeld en ouderbijdragen als
   factuur, betaallinks, terugbetalingen, kantinesaldo, budgetten per afdeling,
   subsidies, debiteurenbeheer en de export naar de boekhouding.

   De harde regel die hier in code staat en niet alleen in een folder:

   GELD RAAKT NOOIT HET ONDERWIJS. Een openstaande factuur sluit geen kind uit,
   blokkeert geen account, verbergt geen cijfer en haalt niemand van een
   excursie. Er is in deze module dus met opzet GEEN functie die iets afsluit;
   het enige wat een openstaande post doet, is op een lijst staan van de
   administratie. Elk antwoord zegt dat er ook bij (`blokkeertOnderwijs:
   false`), zodat een koppelend systeem het niet zelf kan verzinnen. Dat sluit
   aan op de vrijwillige ouderbijdrage die er al was (school/bijdrage.js).

   De tweede regel: bedragen staan in CENTEN. Een euro als kommagetal is de
   klassieke manier om er twee cent naast te zitten. */
module.exports = (sctx) => {
  const { router, save, rid, nu, schoon, eigenVeld, poort, log, meld, leerlingLijst, machtigingActief } = sctx;

  const FAC = (sch) => { if (!sch.facturen) sch.facturen = []; return sch.facturen; };
  const BUD = (sch) => { if (!sch.budgetten) sch.budgetten = {}; return sch.budgetten; };
  const SUB = (sch) => { if (!sch.subsidies) sch.subsidies = []; return sch.subsidies; };
  const KAN = (sch) => { if (!sch.kantine) sch.kantine = {}; return sch.kantine; };
  const centen = (v) => Math.round(Math.max(0, Math.min(1000000, Number(v) || 0)) * 100);
  const open = (f) => Math.max(0, f.centen - (f.betaald || 0) + (f.terugbetaald || 0));
  const NOOIT = { blokkeertOnderwijs: false,
    uitleg: 'Een openstaande post heeft geen enkel gevolg voor het onderwijs: geen uitsluiting, geen geblokkeerd account, geen verborgen cijfers.' };

  /* ---------- factureren ----------
     Schoolgeld, ouderbijdrage, excursie, boekenpakket: alles is hier een
     factuur met een soort. De betaallink is een verwijzing naar de gewone
     betaalweg van het huis; hij bevat geen bedrag dat de klant kan wijzigen. */
  router.post('/school/factuur/maak', (req, res) => {
    const g = poort(req, res, 'financieel'); if (!g) return;
    const l = eigenVeld(leerlingLijst(g.sch), req.body.leerlingId);
    if (!l) return res.status(404).json({ error: 'Deze leerling staat niet in de administratie.' });
    const bedrag = centen(req.body.bedrag);
    if (!bedrag) return res.status(400).json({ error: 'Vul een bedrag in.' });
    const omschrijving = schoon(req.body.omschrijving, 120);
    if (!omschrijving) return res.status(400).json({ error: 'Waar is deze factuur voor?' });
    const SOORT = ['schoolgeld', 'ouderbijdrage', 'excursie', 'materiaal', 'kantine', 'overig'];
    const soort = String(req.body.soort || 'overig');
    if (!SOORT.includes(soort)) return res.status(400).json({ error: 'Kies een soort: ' + SOORT.join(', ') + '.' });
    const f = { id: rid(6), nummer: 'F' + String(FAC(g.sch).length + 1).padStart(5, '0'),
      leerlingId: l.id, naam: l.naam, soort, omschrijving, centen: bedrag, betaald: 0, terugbetaald: 0,
      vervalt: schoon(req.body.vervalt, 10) || null, incasso: req.body.incasso === true,
      vrijwillig: soort === 'ouderbijdrage', at: nu(), door: g.p.naam, herinneringen: [] };
    f.betaallink = '/apps/foundation/school.html#factuur=' + f.id;
    FAC(g.sch).unshift(f); g.sch.facturen = FAC(g.sch).slice(0, 20000);
    log(g.sch, g.p, 'factuur-gemaakt', l.id, soort + ' ' + (bedrag / 100).toFixed(2));
    save();
    meld(g.sch, 'factuur.gemaakt', { factuurId: f.id, nummer: f.nummer, soort: f.soort, centen: f.centen, vervalt: f.vervalt });
    /* De incasso-vlag betekent precies een ding: er MAG geïncasseerd worden
       als er een getekende machtiging ligt. Er wordt hier niets geïnd, en het
       antwoord zegt dat zelf -- anders leest een koppelend systeem "incasso"
       als "geregeld". */
    const m = f.incasso ? machtigingActief(g.sch, l.id) : null;
    res.json(Object.assign({ ok: true, factuur: f }, NOOIT,
      f.incasso ? { incasseerbaar: !!m, machtiging: m ? m.kenmerk : null, geindNu: false,
        let: m ? 'Er ligt een geldige machtiging (' + m.kenmerk + '). Innen doet uw bank of betaaldienst; RTG School schrijft niets af.'
          : 'Er ligt GEEN geldige machtiging voor deze leerling, dus incasseren mag niet. Leg de machtiging eerst vast.' } : {},
      f.vrijwillig ? { let: 'De ouderbijdrage is vrijwillig; dat staat ook in de factuur zelf.' } : {}));
  });

  /* Betaling of terugbetaling boeken. Beide via dezelfde weg, want een
     terugbetaling die ergens anders wordt bijgehouden is een terugbetaling die
     in het overzicht ontbreekt. */
  router.post('/school/factuur/boek', (req, res) => {
    const g = poort(req, res, 'financieel'); if (!g) return;
    const f = FAC(g.sch).find(x => x.id === String(req.body.factuurId || ''));
    if (!f) return res.status(404).json({ error: 'Die factuur kennen we niet.' });
    const bedrag = centen(req.body.bedrag);
    if (!bedrag) return res.status(400).json({ error: 'Vul het bedrag in.' });
    const terug = req.body.terugbetaling === true;
    if (terug) {
      if (bedrag > (f.betaald || 0) - (f.terugbetaald || 0)) return res.status(400).json({ error: 'Er is niet zoveel betaald om terug te betalen.' });
      f.terugbetaald = (f.terugbetaald || 0) + bedrag;
      f.reden = schoon(req.body.reden, 160) || null;
    } else f.betaald = (f.betaald || 0) + bedrag;
    f.regels = (f.regels || []).concat([{ at: nu(), centen: bedrag, soort: terug ? 'terugbetaling' : 'betaling', wijze: schoon(req.body.wijze, 30) || 'overboeking', door: g.p.naam }]).slice(-50);
    f.status = open(f) === 0 ? 'voldaan' : 'open';
    log(g.sch, g.p, terug ? 'terugbetaling' : 'betaling', f.leerlingId, f.nummer);
    save();
    if (!terug && f.status === 'voldaan') meld(g.sch, 'factuur.betaald', { factuurId: f.id, nummer: f.nummer, centen: f.centen });
    res.json(Object.assign({ ok: true, factuur: { id: f.id, nummer: f.nummer, open: open(f), status: f.status } }, NOOIT));
  });

  /* ---------- debiteuren ----------
     Een lijst met openstaande posten en hoe lang ze al openstaan. Herinneren
     mag, uitsluiten niet -- en dat verschil staat in het antwoord. */
  router.post('/school/debiteuren', (req, res) => {
    const g = poort(req, res, 'financieel.lees'); if (!g) return;
    const vandaag = new Date().toISOString().slice(0, 10);
    const rijen = FAC(g.sch).filter(f => open(f) > 0).map(f => ({
      id: f.id, nummer: f.nummer, naam: f.naam, leerlingId: f.leerlingId, soort: f.soort, vrijwillig: !!f.vrijwillig,
      open: open(f), vervalt: f.vervalt, teLaat: !!(f.vervalt && f.vervalt < vandaag),
      incasso: !!f.incasso, machtiging: f.incasso ? !!machtigingActief(g.sch, f.leerlingId) : null,
      herinneringen: (f.herinneringen || []).length }));
    res.json(Object.assign({ ok: true, aantal: rijen.length,
      openTotaal: rijen.reduce((n, r) => n + r.open, 0),
      teLaat: rijen.filter(r => r.teLaat).length, debiteuren: rijen.slice(0, 500) }, NOOIT));
  });

  router.post('/school/factuur/herinner', (req, res) => {
    const g = poort(req, res, 'financieel'); if (!g) return;
    const f = FAC(g.sch).find(x => x.id === String(req.body.factuurId || ''));
    if (!f) return res.status(404).json({ error: 'Die factuur kennen we niet.' });
    if (open(f) <= 0) return res.status(409).json({ error: 'Deze factuur staat niet meer open.' });
    if (f.vrijwillig && (f.herinneringen || []).length >= 1)
      return res.status(409).json({ error: 'Een vrijwillige bijdrage herinneren we hooguit een keer. Vaker vragen maakt vrijwillig alsnog verplicht.' });
    f.herinneringen = (f.herinneringen || []).concat([{ at: nu(), door: g.p.naam, tekst: schoon(req.body.tekst, 300) || null }]);
    save();
    res.json(Object.assign({ ok: true, herinneringen: f.herinneringen.length }, NOOIT));
  });

  return { facturen: FAC, centen, openBedrag: open, NOOIT };
};
