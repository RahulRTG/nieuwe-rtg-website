/* Domein "pay": RTG Pay, de interne betaallaag. Ledenkant (wallet, opladen,
   Klompjes (betaalverzoeken), kassacode) achter de gewone leden-inlog; partnerkant (innen,
   saldo, uitbetalen) achter de leverancier-inlog. Alles idempotent: de
   client stuurt bij elke knop een idem-sleutel mee, dubbeltikken kan nooit
   dubbel boeken. */
module.exports = (kern) => {
  const { app, auth, liveCodename, pay, onboarding, factuurSaldo } = kern;
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

  /* ---- de portefeuille van het lid ----
     Niet hetzelfde als /overzicht: dat gaat over zijn wallet, dit over ALLES
     wat hij heeft. Sinds een lid een maaltijdbudget of een gemeentetegoed kan
     hebben, is "wat heb ik" een lijst met regels erbij en geen getal. */
  app.post('/api/pay/portefeuille', auth, (req, res) => {
    if (geenGast(req, res)) return;
    if (!pay.portefeuille) return res.json({ ok: true, posities: [], vrijBesteedbaar: 0, gebonden: 0 });
    res.json(pay.portefeuille(liveCodename(req.session)));
  });

  /* De ZAAKKANT (./pay-zaak.js): budget geven, vooraf vastzetten, innen,
     saldo en uitbetalen. Afgesplitst omdat dit bestand anders over de
     keuringsgrens van 10240 byte gaat, en het is de eerlijke snede: alles
     hierboven hangt aan `auth` (een lid), alles daar aan `supplierAuth` (een
     zaak). Twee poorten, twee bestanden. */
  require('./pay-zaak')(kern, { stuur });

  // de gezondheidsknop voor de bewaking: klopt het grootboek nog op de cent?
  // Geen data naar buiten, alleen ja of nee (en een 500 zodat een alarm afgaat).
  app.get('/api/pay/gezond', (req, res) => {
    const c = pay.sluitcontrole();
    res.status(c.klopt ? 200 : 500).json({ klopt: c.klopt });
  });
};
