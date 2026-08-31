/* Member-submodule: betalen. Facturen betalen via de betaalprovider (met
   idempotentiesleutel en de vaste 30%-afdracht aan de RTFoundation), betalen
   met munten (crypto via een vergunninghoudende aanbieder, meteen omgezet naar
   euro) en facturen/jaaroverzichten als PDF. Gemount vanuit routes/member.js. */
module.exports = (kern) => {
  const { app, auth, db, save, accounts, memberTemplate, betaal, fonds, factuur, broadcastSync, stateFor,
          liveCodename } = kern;
  const { principalVoorSession } = require('../../kern/economie/identiteit');

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
    // De afschrijving loopt via de betaalprovider met een idempotentiesleutel per
    // factuur: twee keer op "betaal" tikken of een netwerk-herhaling schrijft nooit
    // dubbel af. In demo-stand bevestigt de provider direct ('betaald'); met een
    // echte Stripe-sleutel komt de definitieve bevestiging via de webhook, en
    // markeren we hier nog niets als betaald.
    const wie = principalVoorSession(req.session);
    let foundation = 0, provider = betaal.AANBIEDER, intents = [];
    for (const inv of targets) {
      let uitslag;
      try {
        uitslag = await betaal.maakBetaling({
          bedrag: Math.max(1, Math.round((inv.bijdrage || 0) * 100)), // euro's -> centen
          valuta: 'eur', referentie: String(inv.id),
          idempotentieSleutel: wie + ':inv:' + inv.id,
          omschrijving: 'RTG factuur ' + inv.id
        });
      } catch (e) { return res.status(502).json({ error: 'Betaling kon niet worden gestart.' }); }
      const bevestigd = uitslag.status === 'betaald' || uitslag.status === 'succeeded';
      if (bevestigd) {
        inv.status = 'paid';
        inv.date = 'Zojuist betaald';
        inv.betaalId = uitslag.id;
        // Vaste 30%-afdracht aan de RTFoundation: bij elke bevestigde maandbetaling
        // splitsen we het foundation-deel meteen af en zetten het (zodra het IBAN
        // bekend is) als uitbetaling weg. Boekingen dragen niets af; alleen
        // abonnementen. fonds.boekAfdracht is idempotent per factuur.
        if (fonds.isAbonnement(inv.desc)) {
          foundation += fonds.aandeelEuro(inv.bijdrage);
          try { await fonds.boekAfdracht({ invoiceId: inv.id, wie, bijdrage: inv.bijdrage, betaalId: uitslag.id, omschrijving: inv.desc }); }
          catch (e) { /* afdracht mag de betaling nooit blokkeren; ledger vangt het later op */ }
        }
        for (const item of (md.trip ? md.trip.items : [])) {
          if (item.invoiceId === inv.id) { item.status = 'paid'; item.label = 'Bevestigd'; }
        }
      } else {
        /* De belofte "de webhook bevestigt" stond hier al, maar niets vertelde
           die webhook WELKE factuur bij welk lid hoorde -- dus wikkelde hij nooit
           iets af en werd in productie geen enkele factuur betaald. De context
           gaat daarom lokaal in de boeken, op het betaal-id. Bewust lokaal en
           niet als metadata bij de provider: een accountId hoort niet naar een
           derde partij, ook niet als pseudoniem. */
        db.data.kaartWachtend = db.data.kaartWachtend && typeof db.data.kaartWachtend === 'object' ? db.data.kaartWachtend : {};
        db.data.kaartWachtend[uitslag.id] = {
          soort: 'factuur', wie, invoiceId: inv.id,
          own, accountId: own ? req.session.account.id : null, at: Date.now()
        };
        // een plafond, zodat een reeks afgebroken betalingen dit niet laat groeien
        const sleutels = Object.keys(db.data.kaartWachtend);
        if (sleutels.length > 20000) for (const k of sleutels.slice(0, sleutels.length - 20000)) delete db.data.kaartWachtend[k];
        intents.push({ invoiceId: inv.id, clientSecret: uitslag.clientSecret, status: uitslag.status });
      }
    }
    if (own) accounts.saveMemberState(req.session.account.id, md);
    else save();
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
