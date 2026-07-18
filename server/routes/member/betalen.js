/* Member-submodule: betalen. Facturen betalen via de betaalprovider (met
   idempotentiesleutel en de vaste 30%-afdracht aan de RTFoundation), betalen
   met munten (crypto via een vergunninghoudende aanbieder, meteen omgezet naar
   euro) en facturen/jaaroverzichten als PDF. Gemount vanuit routes/member.js. */
module.exports = (kern) => {
  const { app, auth, db, save, accounts, memberTemplate, betaal, fonds, munten, factuur,
    broadcastSync, stateFor, findSupplier, liveCodename } = kern;

  app.post('/api/pay', auth, async (req, res) => {
    if (req.session.tier === 'guest') return res.status(403).json({ error: 'Alleen voor leden.' });
    const zPay = db.data.techniek && db.data.techniek.zekeringen && db.data.techniek.zekeringen.betalingen;
    if (zPay && zPay.aan === false) return res.status(503).json({ error: 'Betalen is tijdelijk uitgeschakeld.' });
    // Echte accounts betalen hun eigen facturen; demo-sessies de gedeelde demo.
    const own = !!req.session.account;
    const md = own ? (accounts.getMemberState(req.session.account.id) || memberTemplate()) : db.data;
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
    const wie = own ? ('acc:' + req.session.account.id) : ('sess:' + req.session.tier);
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
        // echte kaartbetaling: client rondt af met clientSecret, webhook bevestigt
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
  app.post('/api/munt/opties', (req, res) => res.json(munten.opties()));

  app.post('/api/munt/verzoek', auth, async (req, res) => {
    if (req.session.tier === 'guest') return res.status(403).json({ error: 'Alleen voor leden.' });
    if (!munten.aan()) return res.status(503).json({ error: 'Betalen met munten is niet beschikbaar.' });
    const own = !!req.session.account;
    const md = own ? (accounts.getMemberState(req.session.account.id) || memberTemplate()) : db.data;
    const inv = (md.invoices || []).find(i => i.id === req.body.invoiceId);
    if (!inv) return res.status(404).json({ error: 'Factuur niet gevonden.' });
    if (inv.status === 'paid') return res.status(409).json({ error: 'Deze factuur is al betaald.' });
    const euroCenten = Math.max(1, Math.round((inv.bijdrage || 0) * 100));
    const wie = own ? ('acc:' + req.session.account.id) : ('sess:' + req.session.tier);
    try {
      const verzoek = await munten.maakVerzoek({
        euroCenten, munt: req.body.munt, referentie: String(inv.id),
        idempotentieSleutel: wie + ':muntinv:' + inv.id + ':' + String(req.body.munt || '').toLowerCase(),
        context: { soort: 'factuur', wie, invoiceId: inv.id, own, accountId: own ? req.session.account.id : null }
      });
      res.json({ ok: true, verzoek });
    } catch (e) { res.status(400).json({ error: e.message || 'Kon geen munt-adres maken.' }); }
  });

  /* Rechtstreeks een partner betalen met munten. Zelfde afhandeling als een gewone
     directe betaling, maar het geld komt via de munt-aanbieder binnen (omgezet naar
     euro); de webhook crediteert dan de leverancier. */
  app.post('/api/munt/direct', auth, async (req, res) => {
    if (req.session.tier === 'guest') return res.status(403).json({ error: 'Alleen voor leden.' });
    if (!munten.aan()) return res.status(503).json({ error: 'Betalen met munten is niet beschikbaar.' });
    const s = findSupplier(req.body.supplierCode);
    if (!s) return res.status(404).json({ error: 'Leverancier niet gevonden.' });
    const euroCenten = Math.round(Number(req.body.bedrag) * 100);
    if (!(euroCenten >= 50)) return res.status(400).json({ error: 'Kies een bedrag van minstens € 0,50.' });
    const key = req.session.key;
    const codename = liveCodename(req.session);
    try {
      const verzoek = await munten.maakVerzoek({
        euroCenten, munt: req.body.munt, referentie: 'DP-' + s.code,
        idempotentieSleutel: key + ':muntdirect:' + s.code + ':' + euroCenten + ':' + String(req.body.munt || '').toLowerCase() + ':' + Date.now(),
        context: { soort: 'direct', key, codename, supplierCode: s.code, omschrijving: String(req.body.omschrijving || '').slice(0, 120) }
      });
      res.json({ ok: true, verzoek, supplier: { code: s.code, name: s.name } });
    } catch (e) { res.status(400).json({ error: e.message || 'Kon geen munt-adres maken.' }); }
  });

  /* Facturen downloaden. Elk lid kan zijn eigen factuur als PDF ophalen, en een
     jaaroverzicht van alle facturen. Zelf gebouwd, zonder externe pakketten. */
  function ledenInvoices(req) {
    const own = !!req.session.account;
    const md = own ? (accounts.getMemberState(req.session.account.id) || memberTemplate()) : db.data;
    return md.invoices || [];
  }

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
