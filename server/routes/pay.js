/* Domein "pay": RTG Pay, de interne betaallaag. Ledenkant (wallet, opladen,
   Goudjes (betaalverzoeken), kassacode) achter de gewone leden-inlog; partnerkant (innen,
   saldo, uitbetalen) achter de leverancier-inlog. Alles idempotent: de
   client stuurt bij elke knop een idem-sleutel mee, dubbeltikken kan nooit
   dubbel boeken. */
module.exports = (kern) => {
  const { app, auth, supplierAuth, liveCodename, pay, sseToOffice } = kern;
  const stuur = (res, r) => r.error ? res.status(r.status || 400).json({ error: r.error }) : res.json(r);
  const geenGast = (req, res) => {
    if (req.session.tier === 'guest') { res.status(403).json({ error: 'RTG Pay is voor leden.' }); return true; }
    return false;
  };

  // alles van het lid in een scherm: saldo, verzoeken, geschiedenis
  app.post('/api/pay/overzicht', auth, (req, res) => {
    if (geenGast(req, res)) return;
    res.json(pay.overzicht(liveCodename(req.session)));
  });
  // opladen (Apple Pay/kaart via de betaal-naad)
  app.post('/api/pay/oplaad', auth, async (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, await pay.laadOp({ codenaam: liveCodename(req.session), centen: req.body.centen, idem: req.body.idem }));
  });
  // geld sturen naar een codenaam: EEN knop, autolaad inbegrepen
  app.post('/api/pay/stuur', auth, async (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, await pay.stuur({ van: liveCodename(req.session), aanCodenaam: req.body.aan, centen: req.body.centen, oms: req.body.oms, idem: req.body.idem }));
  });
  // een Goudje vragen (een of meer vrienden, met of zonder splitsen)
  app.post('/api/pay/verzoek', auth, async (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, await pay.verzoekMaak({ van: liveCodename(req.session), aan: req.body.aan, totaalCenten: req.body.totaalCenten, perCenten: req.body.perCenten, oms: req.body.oms, splitsMetMij: req.body.splitsMetMij === true }));
  });
  // een Goudje betalen: EEN knop
  app.post('/api/pay/verzoek/betaal', auth, async (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, await pay.verzoekBetaal({ codenaam: liveCodename(req.session), verzoekId: String(req.body.id || ''), idem: req.body.idem }));
  });
  app.post('/api/pay/verzoek/intrek', auth, (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, pay.verzoekIntrek({ codenaam: liveCodename(req.session), verzoekId: String(req.body.id || '') }));
  });
  // de kassacode: vijf minuten geldig, tot een zelfgekozen maximum
  app.post('/api/pay/kascode', auth, (req, res) => {
    if (geenGast(req, res)) return;
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
  app.post('/api/supplier/pay/uitbetaal', supplierAuth, async (req, res) => {
    stuur(res, await pay.partnerUitbetaal({ supplierCode: req.supplier.code, idem: req.body.idem }));
  });

  // de gezondheidsknop voor de bewaking: klopt het grootboek nog op de cent?
  // Geen data naar buiten, alleen ja of nee (en een 500 zodat een alarm afgaat).
  app.get('/api/pay/gezond', (req, res) => {
    const c = pay.sluitcontrole();
    res.status(c.klopt ? 200 : 500).json({ klopt: c.klopt });
  });
};
