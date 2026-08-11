/* Domein "pay": RTG Pay, de interne betaallaag. Ledenkant (wallet, opladen,
   Klompjes (betaalverzoeken), kassacode) achter de gewone leden-inlog; partnerkant (innen,
   saldo, uitbetalen) achter de leverancier-inlog. Alles idempotent: de
   client stuurt bij elke knop een idem-sleutel mee, dubbeltikken kan nooit
   dubbel boeken. */
module.exports = (kern) => {
  const { app, auth, supplierAuth, managerOnly, liveCodename, pay, onboarding, sseToOffice, factuurSaldo } = kern;
  const stuur = (res, r) => r.error ? res.status(r.status || 400).json({ error: r.error }) : res.json(r);
  const geenGast = (req, res) => {
    if (req.session.tier === 'guest') { res.status(403).json({ error: 'RTG Pay is voor leden.' }); return true; }
    return false;
  };
  // Een anonieme demo-gast heeft geen wallet; een GRATIS ACCOUNT wel: die mag
  // opladen en met de QR-kassacode betalen (bv. eten bestellen als niet-lid).
  // De sociale kant van Pay (tikken, verzoeken) blijft voor leden.
  const geenEchtAccount = (req, res) => {
    if (req.session.tier === 'guest' && !req.session.account) { res.status(403).json({ error: 'Maak een gratis account om met RTG Pay te betalen.' }); return true; }
    return false;
  };
  // Een gratis lid dat RTG Pay gebruikt, laat eenmalig zijn paspoort zien; de
  // betaalde passen deden dat al bij de onboarding. Blokkeert het geld-moment
  // netjes tot dat rond is (met kyc:true zodat de app naar de paspoort-stap gaat).
  const kyc = (req, res) => {
    if (!onboarding || !onboarding.payGate) return false;
    const g = onboarding.payGate(req.session);
    if (!g.ok) { res.status(g.status || 403).json({ error: g.error, kyc: true }); return true; }
    return false;
  };

  // alles van het lid in een scherm: saldo, verzoeken, geschiedenis
  app.post('/api/pay/overzicht', auth, (req, res) => {
    if (geenGast(req, res)) return;
    res.json(pay.overzicht(liveCodename(req.session)));
  });
  // opladen (Apple Pay/kaart via de betaal-naad)
  app.post('/api/pay/oplaad', auth, async (req, res) => {
    if (geenEchtAccount(req, res)) return;
    if (kyc(req, res)) return;
    stuur(res, await pay.laadOp({ codenaam: liveCodename(req.session), centen: req.body.centen, idem: req.body.idem }));
  });
  // geld sturen naar een codenaam: EEN knop, autolaad inbegrepen
  app.post('/api/pay/stuur', auth, async (req, res) => {
    if (geenGast(req, res)) return;
    if (kyc(req, res)) return;
    stuur(res, await pay.stuur({ van: liveCodename(req.session), aanCodenaam: req.body.aan, centen: req.body.centen, oms: req.body.oms, idem: req.body.idem }));
  });
  // een Klompje vragen (een of meer vrienden, met of zonder splitsen)
  app.post('/api/pay/verzoek', auth, async (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, await pay.verzoekMaak({ van: liveCodename(req.session), aan: req.body.aan, totaalCenten: req.body.totaalCenten, perCenten: req.body.perCenten, oms: req.body.oms, splitsMetMij: req.body.splitsMetMij === true }));
  });
  // een Klompje betalen: EEN knop
  app.post('/api/pay/verzoek/betaal', auth, async (req, res) => {
    if (geenGast(req, res)) return;
    if (kyc(req, res)) return;
    stuur(res, await pay.verzoekBetaal({ codenaam: liveCodename(req.session), verzoekId: String(req.body.id || ''), idem: req.body.idem }));
  });
  app.post('/api/pay/verzoek/intrek', auth, (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, pay.verzoekIntrek({ codenaam: liveCodename(req.session), verzoekId: String(req.body.id || '') }));
  });
  /* De maandfactuur betalen uit het eigen saldo: de derde betaalweg naast de
     kaart en de munten (kern/factuursaldo.js). Zelfde poorten als elk ander
     geld-moment hier: leden, en eenmalig het paspoort. */
  app.post('/api/pay/saldo', auth, async (req, res) => {
    if (geenGast(req, res)) return;
    if (kyc(req, res)) return;
    stuur(res, await factuurSaldo({
      own: !!req.session.account,
      accountId: req.session.account ? req.session.account.id : null,
      wie: req.session.account ? ('acc:' + req.session.account.id) : ('sess:' + req.session.tier),
      tier: req.session.tier,
      codenaam: liveCodename(req.session),
      invoiceId: String(req.body.invoiceId || '')
    }));
  });

  // de tik: ontvangen met een aanraking (tikcode), betalen met een knop
  app.post('/api/pay/tikcode', auth, (req, res) => {
    if (geenGast(req, res)) return;
    res.json(pay.tikCode({ codenaam: liveCodename(req.session) }));
  });
  app.post('/api/pay/tik', auth, async (req, res) => {
    if (geenGast(req, res)) return;
    if (kyc(req, res)) return;
    stuur(res, await pay.tikBetaal({ van: liveCodename(req.session), code: req.body.code, centen: req.body.centen, oms: req.body.oms, idem: req.body.idem }));
  });
  app.post('/api/pay/tiks', auth, (req, res) => {
    if (geenGast(req, res)) return;
    res.json(pay.tikFeed(liveCodename(req.session)));
  });
  // de kassacode: vijf minuten geldig, tot een zelfgekozen maximum
  app.post('/api/pay/kascode', auth, (req, res) => {
    if (geenEchtAccount(req, res)) return;
    res.json(pay.kasCode({ codenaam: liveCodename(req.session), maxCenten: req.body.maxCenten }));
  });

  // de partnerkant: code innen aan de kassa, saldo zien, uitbetalen
  app.post('/api/supplier/pay/in', supplierAuth, async (req, res) => {
    const r = await pay.kasInt({ supplierCode: req.supplier.code, code: req.body.code, centen: req.body.centen, oms: req.body.oms, idem: req.body.idem });
    if (r.ok) sseToOffice('sync', { scope: 'pay' });
    stuur(res, r);
  });
  app.post('/api/supplier/pay/overzicht', supplierAuth, (req, res) => {
    res.json(pay.partnerOverzicht(req.supplier.code));
  });
  /* UITBETALEN IS GEEN WERKHANDELING MAAR EEN GELDHANDELING.

     Deze route stuurt het hele RTG Pay-saldo van de zaak naar de bank en roept
     daarvoor de echte betaaldienst aan. Hij stond op supplierAuth, en dat is
     ELKE ingelogde medewerker: de afwasser met een pincode kon het saldo van de
     zaak leegtrekken. Dat het geld naar de rekening van de zaak zelf gaat maakt
     het niet ongevaarlijk -- het is onomkeerbaar, het haalt geld uit de kas op
     een moment dat de eigenaar niet koos, en het is een prima manier om een
     zaak op een druk moment plat te leggen.

     Innen (pay/in) en het saldo bekijken (pay/overzicht) blijven voor iedereen:
     dat is het werk. Weghalen is van de manager. */
  app.post('/api/supplier/pay/uitbetaal', supplierAuth, async (req, res) => {
    if (!managerOnly(req, res)) return;
    stuur(res, await pay.partnerUitbetaal({ supplierCode: req.supplier.code, idem: req.body.idem }));
  });

  // de gezondheidsknop voor de bewaking: klopt het grootboek nog op de cent?
  // Geen data naar buiten, alleen ja of nee (en een 500 zodat een alarm afgaat).
  app.get('/api/pay/gezond', (req, res) => {
    const c = pay.sluitcontrole();
    res.status(c.klopt ? 200 : 500).json({ klopt: c.klopt });
  });
};
