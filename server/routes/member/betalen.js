/* Member-submodule: betalen. Facturen betalen via de betaalprovider (met
   idempotentiesleutel en de vaste 30%-afdracht aan de RTFoundation), betalen
   met munten (crypto via een vergunninghoudende aanbieder, meteen omgezet naar
   euro) en facturen/jaaroverzichten als PDF. Gemount vanuit routes/member.js. */
module.exports = (kern) => {
  const { app, auth, db, accounts, memberTemplate, betaal, betaalWaarheid, fonds, factuur, broadcastSync, stateFor,
          liveCodename } = kern;
  const { principalVoorSession } = require('../../kern/economie/principal');

  /* Het dossier van dit lid: een echt account heeft een eigen ledenstaat, een
     demo-sessie deelt de gedeelde demo. Deze twee regels stonden op DRIE
     plekken -- hier, en twee keer in ./betalen-munt.js -- en dat is precies hoe
     ledenInvoices bij de laatste splitsing kon achterblijven in het ene bestand
     terwijl het andere hem nog aanriep: /api/factuur gaf een 500 en een lid kon
     zijn factuur niet meer downloaden. Nu een keer, hier, en doorgegeven. */
  function ledenStaat(req) {
    return req.session.account
      ? (accounts.getMemberState(req.session.account.id) || memberTemplate())
      : db.data;
  }
  const ledenInvoices = (req) => ledenStaat(req).invoices || [];

  app.post('/api/pay', auth, async (req, res) => {
    if (req.session.tier === 'guest') return res.status(403).json({ error: 'Alleen voor leden.' });
    if (!betaal.BETALEN_AAN) return res.status(503).json({
      error: 'Betalen staat bewust uitgeschakeld. Er is niets afgeschreven.', code: 'betalingen-uit' });
    const zPay = db.data.techniek && db.data.techniek.zekeringen && db.data.techniek.zekeringen.betalingen;
    if (zPay && zPay.aan === false) return res.status(503).json({ error: 'Betalen is tijdelijk uitgeschakeld.' });
    // Echte accounts betalen hun eigen facturen; demo-sessies de gedeelde demo.
    const own = !!req.session.account;
    const md = ledenStaat(req);
    const invoices = md.invoices || [];
    let targets;
    if (req.body.all) {
      targets = invoices.filter(i => i.status === 'open');
      if (!targets.length) return res.status(409).json({ error: 'Er staat niets open.' });
    } else {
      const inv = invoices.find(i => i.id === req.body.invoiceId);
      if (!inv) return res.status(404).json({ error: 'Factuur niet gevonden.' });
      if (inv.status === 'paid') return res.status(409).json({ error: 'Deze factuur is al betaald.' });
      targets = [inv];
    }
    /* VIA DE BETAALWAARHEID (MONEY-012). Per factuur een betaling met een vaste
       sleutel, vastgelegd VOOR de aanroep; de afwikkeling (betaald zetten, de
       30%-afdracht, de reisonderdelen) loopt via kern/betaalwaarheid/inkomend.js
       door settleFactuur, of de provider nu meteen bevestigt of later via de
       webhook of de veegronde. Hier stond een kale betaal.maakBetaling met een
       wachtende rij in kaartWachtend: geen veegronde, een stille wis boven de
       20.000 rijen, en bij een fout niets vastgelegd.

       DE ROUTE SCHRIJFT DE LEDENSTAAT NIET MEER. getMemberState geeft een kopie;
       de afwikkeling bewaart haar eigen verse kopie, en een save van de oude
       kopie hier zou "betaald" weer overschrijven. */
    if (!betaalWaarheid) return res.status(503).json({ error: 'De betaalwaarheid is niet aangesloten; er is niets afgeschreven.' });
    const wie = principalVoorSession(req.session);
    let foundation = 0;
    const provider = betaal.AANBIEDER, intents = [];
    for (const inv of targets) {
      let w, uit;
      try {
        w = betaalWaarheid.maak({ actor: wie, idem: 'inv:' + inv.id, soort: 'factuur', bronRef: String(inv.id),
          centen: Math.max(1, Math.round((inv.bijdrage || 0) * 100)), valuta: 'eur',
          context: { invoiceId: inv.id, wie, own, accountId: own ? req.session.account.id : null } });
        uit = await betaalWaarheid.begin(w.id, { omschrijving: 'RTG factuur ' + inv.id });
      } catch (e) {
        return res.status(502).json({ betalingId: w ? w.id : null,
          error: w ? 'De betaling gaf geen uitsluitsel. Betaal niet opnieuw: RTG zoekt het na met dezelfde sleutel.'
            : 'Betaling kon niet worden gestart.' });
      }
      const r = betaalWaarheid.van(w.id);
      if (r && r.afgehandeldAt) { if (fonds.isAbonnement(inv.desc)) foundation += fonds.aandeelEuro(inv.bijdrage); }
      else intents.push({ invoiceId: inv.id, betalingId: w.id, status: r ? r.status : null,
        clientSecret: (uit && uit.actie && uit.actie.clientSecret) || null });
    }
    // ander open scherm van hetzelfde lid meteen bijwerken
    broadcastSync([req.session.tier], 'payments');
    const antwoord = { ok: true, foundation, provider, state: stateFor(req.session, req.body.lang) };
    if (intents.length) { antwoord.pending = true; antwoord.intents = intents; } // wachten op kaartbevestiging
    res.json(antwoord);
  });

  /* Met munten betalen. RTG accepteert cryptomunten voor zijn eigen diensten en
     zet ze via een vergunninghoudende aanbieder meteen om naar euro's; RTG houdt
     zelf nooit crypto vast. Staat de acceptatie uit, dan is dit niet beschikbaar. */
  /* De muntkant (opties, ontvangstverzoek, rechtstreeks met munten betalen)
     staat in ./betalen-munt: een eigen onderwerp met een eigen aanbieder, en
     samen met de kaartkant paste het niet meer onder de 10 KB. */
  require('./betalen-munt')(Object.assign({}, kern, { ledenStaat, ledenInvoices }));

  app.post('/api/factuur', auth, (req, res) => {
    if (req.session.tier === 'guest') return res.status(403).json({ error: 'Alleen voor leden.' });
    const inv = ledenInvoices(req).find(i => i.id === req.body.invoiceId);
    if (!inv) return res.status(404).json({ error: 'Factuur niet gevonden.' });
    const who = { codename: liveCodename(req.session), tier: req.session.tier };
    const pdf = factuur.ledenFactuur(inv, who);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="RTG-factuur-' + String(inv.id).replace(/[^\w.-]/g, '') + '.pdf"');
    res.send(pdf);
  });

  app.post('/api/facturen/overzicht', auth, (req, res) => {
    if (req.session.tier === 'guest') return res.status(403).json({ error: 'Alleen voor leden.' });
    const jaar = String(req.body.jaar || '').match(/\d{4}/) ? req.body.jaar : null;
    const alle = ledenInvoices(req).filter(i => !jaar || String(i.date || '').includes(jaar));
    const who = { codename: liveCodename(req.session), tier: req.session.tier };
    const pasNaam = { rtg: 'RTG Pass', lifestyle: 'Lifestyle Pass', business: 'Business Pass' }[who.tier] || 'RTG';
    let betaald = 0, open = 0, naarFonds = 0;
    const rijen = [];
    for (const i of alle) {
      const tot = (i.netto || 0) + (i.bijdrage || 0);
      if (i.status === 'paid') betaald += tot; else open += tot;
      if (factuur.isContrib(i.desc)) naarFonds += Math.round((i.bijdrage || 0) / 1.21 * 0.3 * 100) / 100;
      rijen.push({ label: (i.id || '') + '  ' + (i.desc || ''), waarde: factuur.euroTekst(tot) + '  ' + (i.status === 'paid' ? '(betaald)' : '(open)') });
    }
    rijen.push({ label: 'Totaal betaald', waarde: factuur.euroTekst(betaald), bold: true, streep: true });
    rijen.push({ label: 'Totaal openstaand', waarde: factuur.euroTekst(open), bold: true });
    rijen.push({ label: 'Bijgedragen aan de RTFoundation', waarde: factuur.euroTekst(naarFonds), bold: true });
    const pdf = factuur.overzichtPdf(
      { titel: 'Factuuroverzicht' + (jaar ? ' ' + jaar : ''), periode: jaar || '', opnaam: who.codename + '  .  ' + pasNaam },
      rijen);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="RTG-factuuroverzicht' + (jaar ? '-' + jaar : '') + '.pdf"');
    res.send(pdf);
  });
};
