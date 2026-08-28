/* Horeca OS (deellaag): afrekenen -- korting, fooi en betalen, ook deels en
   met meerdere methoden tegelijk. De bonnen, de offline-wachtrij en de
   instellingen staan in horeca/bonnen.js.

   Drie dingen die hier in de code staan en niet alleen in de folder:

   1. FOOI IS NOOIT VOORGEVULD. Er is geen standaardpercentage; wat er niet
      expliciet wordt gegeven, staat er niet. Fooi telt ook niet mee in de
      omzet -- hij staat apart en gaat naar het personeel.
   2. EEN REKENING SLUIT PAS ALS HIJ BETAALD IS. Er is geen knop die een bon
      "wegzet"; wat oninbaar is, wordt geboekt als oninbaar MET een reden, en
      dat blijft zichtbaar in de dagcijfers. Anders verdwijnt een gat in de kas
      als een administratieve handeling.
   3. TE VEEL BETALEN BESTAAT NIET. Betalen boven het openstaande bedrag wordt
      geweigerd; wie wisselgeld bedoelt, geeft fooi of krijgt geld terug uit de
      lade. Een bon die op -3,40 uitkomt, klopt nooit meer met de kas. */
module.exports = (kern) => {
  const { app, save, schoon, supplierAuth, logActivity, sseToSupplier, horeca } = kern;
  const { nu, id, heleCenten, uitEuro, openstaand, bonBoek } = horeca;
  const rekVan = kern.horecaRekVan;
  const publiek = kern.horecaPubliek;
  const WIJZEN = ['contant', 'pin', 'online', 'rekening', 'kamer', 'bon', 'tegoed', 'munt'];

  /* ---------- korting ---------- */
  app.post('/api/supplier/horeca/korting', supplierAuth, (req, res) => {
    const r = rekVan(req, res); if (!r) return;
    if (r.status !== 'open') return res.status(409).json({ error: 'Deze rekening is al ' + r.status + '.' });
    const reden = schoon(req.body.reden, 80);
    if (!reden) return res.status(400).json({ error: 'Waarom wordt er korting gegeven? Dat hoort bij het bedrag te staan.' });
    const procent = Math.max(0, Math.min(100, Number(req.body.procent) || 0));
    const bedrag = req.body.centen != null ? heleCenten(req.body.centen) : uitEuro(req.body.bedrag);
    if (!procent && !bedrag) return res.status(400).json({ error: 'Geef een percentage of een bedrag.' });
    r.kortingen.push({ id: id(3), reden, procent: procent || null, centen: procent ? null : bedrag,
      at: nu(), door: req.actor.name });
    save();
    logActivity(req.supplier.code, req.actor, 'gaf korting op ' + (r.tafel || r.id) + ': ' + reden);
    res.json({ ok: true, rekening: publiek(r) });
  });

  /* ---------- fooi ---------- */
  app.post('/api/supplier/horeca/fooi', supplierAuth, (req, res) => {
    const r = rekVan(req, res); if (!r) return;
    const bedrag = req.body.centen != null ? heleCenten(req.body.centen) : uitEuro(req.body.bedrag);
    r.fooiCenten = bedrag;
    save();
    res.json({ ok: true, fooi: r.fooiCenten, rekening: publiek(r),
      let: 'Fooi wordt nooit voorgevuld en telt niet mee in de omzet; hij gaat naar het personeel.' });
  });

  /* ---------- betalen ---------- */
  app.post('/api/supplier/horeca/betaal', supplierAuth, (req, res) => {
    const r = rekVan(req, res); if (!r) return;
    if (r.status !== 'open') return res.status(409).json({ error: 'Deze rekening is al ' + r.status + '.' });
    const wijze = String(req.body.wijze || 'pin');
    if (!WIJZEN.includes(wijze)) return res.status(400).json({ error: 'Onbekende betaalwijze. Kies uit: ' + WIJZEN.join(', ') + '.' });
    const open = openstaand(r);
    if (open <= 0) return res.status(409).json({ error: 'Er staat niets meer open op deze rekening.' });
    let bedrag = req.body.centen != null ? heleCenten(req.body.centen) : (req.body.bedrag != null ? uitEuro(req.body.bedrag) : open);
    if (!bedrag) return res.status(400).json({ error: 'Vul het bedrag in.' });

    // bon of tegoed: eerst afboeken op de bon, dan pas noteren als betaling
    let bonUit = null;
    if (wijze === 'bon' || wijze === 'tegoed') {
      const uit = bonBoek(req.supplier.code, req.body.bonCode, Math.min(bedrag, open));
      if (uit.error) return res.status(uit.status || 400).json({ error: uit.error });
      bonUit = uit; bedrag = uit.geboekt;
    }
    if (bedrag > open) return res.status(400).json({ error: 'Dat is meer dan er openstaat (' + (open / 100).toFixed(2) + '). Wisselgeld gaat uit de lade, niet over de bon.' });

    const betaling = { id: id(3), wijze, centen: bedrag, at: nu(), door: req.actor.name,
      valuta: schoon(req.body.valuta, 3) || 'EUR', koers: req.body.koers ? Number(req.body.koers) : null,
      bon: bonUit ? bonUit.bon : null, kamer: wijze === 'kamer' ? (r.kamer || schoon(req.body.kamer, 20)) : null };
    if (wijze === 'kamer' && !betaling.kamer) return res.status(400).json({ error: 'Op welke kamer moet dit geboekt worden?' });
    /* Op de kamer boeken kan alleen als daar een open gastrekening staat. Zo
       verdwijnt een rekening nooit in een kamer die leegstaat -- dat merkt
       niemand tot de dagafsluiting. De folio-laag wordt na deze module gemount,
       dus de verwijzing loopt via de kern (late binding). */
    if (wijze === 'kamer') {
      if (!kern.horecaFolioBoek) return res.status(409).json({ error: 'De hotellaag staat niet aan; op de kamer boeken kan hier niet.' });
      const opFolio = kern.horecaFolioBoek(req.supplier.code, betaling.kamer, {
        soort: r.kanaal === 'roomservice' ? 'roomservice' : 'restaurant',
        omschrijving: (r.tafel || r.kanaal) + ' · rekening ' + r.id, centen: bedrag,
        door: req.actor.name, bron: r.id });
      if (opFolio.error) return res.status(opFolio.status || 400).json({ error: opFolio.error });
      betaling.folioRegel = opFolio.regel.id;
    }
    r.betalingen.push(betaling);
    const rest = openstaand(r);
    if (rest <= 0) {
      r.status = 'betaald'; r.geslotenAt = nu();
      /* De voorraad loopt via het BESTAANDE keukenbrein (kern/keuken.js), dat
         de recepturen al kent en de ingredienten afboekt met een logregel. Er
         komt hier dus geen tweede voorraadadministratie naast (LAT-regel 4).
         Een verkoop wordt nooit geblokkeerd door de voorraadstand -- de gast
         gaat voor -- en de telling zet de stand later recht. */
      if (kern.keuken && kern.keuken.boekVerkoopAf && !r.voorraadGeboekt) {
        r.voorraadGeboekt = kern.keuken.boekVerkoopAf(req.supplier,
          (r.regels || []).map(x => ({ name: x.naam, qty: x.aantal })), 'horeca ' + (r.tafel || r.kanaal)) || 0;
      }
    }
    save();
    sseToSupplier(req.supplier.code, 'sync', { scope: 'horeca' });
    res.json({ ok: true, betaling, openstaand: rest, gesloten: r.status === 'betaald',
      rekening: publiek(r), bonSaldo: bonUit ? bonUit.saldo : undefined });
  });

  // wat niet betaald wordt, verdwijnt niet: het wordt geboekt als oninbaar
  app.post('/api/supplier/horeca/oninbaar', supplierAuth, (req, res) => {
    const r = rekVan(req, res); if (!r) return;
    if (r.status !== 'open') return res.status(409).json({ error: 'Deze rekening is al ' + r.status + '.' });
    const reden = schoon(req.body.reden, 160);
    if (!reden) return res.status(400).json({ error: 'Noteer waarom deze rekening oninbaar is (weggelopen, klacht, vergissing).' });
    r.status = 'oninbaar'; r.oninbaar = { centen: openstaand(r), reden, at: nu(), door: req.actor.name };
    r.geslotenAt = nu();
    save();
    logActivity(req.supplier.code, req.actor, 'boekte ' + (r.tafel || r.id) + ' als oninbaar: ' + reden);
    res.json({ ok: true, oninbaar: r.oninbaar,
      let: 'Dit blijft in de dagcijfers staan; een gat in de kas is geen administratieve handeling.' });
  });
};
