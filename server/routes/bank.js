/* Domein "bank": RTG Bank voor het lid. Rekeningen openen (betaal/spaar/zakelijk),
   storten (langs de 3-standen knop van de boardroom), overboeken, de brug van/naar
   de RTG Pay-wallet, uitgaande SEPA en het spaardoel. Achter de gewone leden-inlog;
   niet voor gasten. Idempotent op de clearende paden (de client stuurt een idem-
   sleutel mee), dubbeltikken kan nooit dubbel storten of afschrijven. */
module.exports = (kern) => {
  const { app, auth, liveCodename, bank, bankregieOverzicht } = kern;
  const stuur = (res, r) => r.error ? res.status(r.status || 400).json({ error: r.error }) : res.json(r);
  const geenGast = (req, res) => {
    if (req.session.tier === 'guest') { res.status(403).json({ error: 'RTG Bank is voor leden.' }); return true; }
    return false;
  };
  const cn = req => liveCodename(req.session);

  // alles van het lid in een scherm: mijn rekeningen + de publieke bankstand
  app.post('/api/bank/overzicht', auth, (req, res) => {
    if (geenGast(req, res)) return;
    const mijn = bank.rekeningenVanLid(cn(req));
    const regie = bankregieOverzicht();
    res.json({ ...mijn, bank: { modus: regie.modus, operationeel: regie.operationeel, spaarrentePct: regie.spaarrentePct } });
  });
  app.post('/api/bank/rekening/open', auth, async (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, await bank.rekeningOpen({ codenaam: cn(req), soort: req.body.soort, naam: req.body.naam, wie: 'lid' }));
  });
  app.post('/api/bank/rekening', auth, (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, bank.rekeningDetail(String(req.body.iban || ''), cn(req)));
  });
  app.post('/api/bank/afschrift', auth, (req, res) => {
    if (geenGast(req, res)) return;
    const bezit = bank.rekeningDetail(String(req.body.iban || ''), cn(req));
    if (bezit.error) return stuur(res, bezit);
    stuur(res, bank.afschrift({ iban: String(req.body.iban || ''), limit: Number(req.body.limit) || 50, offset: Number(req.body.offset) || 0 }));
  });
  app.post('/api/bank/bevries', auth, (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, bank.rekeningBevries(String(req.body.iban || ''), req.body.aan === true, cn(req)));
  });

  // storten: de knop bepaalt of het via de kaart-naad of als eigen emissie clearet
  app.post('/api/bank/storten', auth, async (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, await bank.bankStorten({ iban: String(req.body.iban || ''), centen: req.body.centen, route: req.body.route, codenaam: cn(req), idem: req.body.idem, oms: req.body.oms }));
  });
  app.post('/api/bank/overboek', auth, (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, bank.bankOverboek({ vanIban: String(req.body.vanIban || ''), naarIban: String(req.body.naarIban || ''), centen: req.body.centen, oms: req.body.oms, codenaam: cn(req) }));
  });
  app.post('/api/bank/naar-wallet', auth, (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, bank.bankBankNaarWallet({ iban: String(req.body.iban || ''), codenaam: cn(req), centen: req.body.centen }));
  });
  app.post('/api/bank/van-wallet', auth, (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, bank.bankWalletNaarBank({ iban: String(req.body.iban || ''), codenaam: cn(req), centen: req.body.centen }));
  });
  app.post('/api/bank/sepa', auth, async (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, await bank.bankSepaUit({ iban: String(req.body.iban || ''), codenaam: cn(req), centen: req.body.centen, naarIban: req.body.naarIban, begunstigde: req.body.begunstigde, oms: req.body.oms, idem: req.body.idem }));
  });
  app.post('/api/bank/spaardoel', auth, (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, bank.bankSpaardoelZet({ iban: String(req.body.iban || ''), euro: req.body.euro, codenaam: cn(req) }));
  });
  // een indicatie van de spaarrente per jaar op een bedrag
  app.post('/api/bank/rente-voorbeeld', auth, (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, bank.bankRenteVoorbeeld(req.body.euro));
  });

  /* Passen: betaalpassen en creditcards op een rekening (uitgeven, tonen,
     bevriezen, daglimiet, betalen, sluiten). */
  app.post('/api/bank/passen', auth, (req, res) => { if (geenGast(req, res)) return; stuur(res, bank.bankPassen(cn(req))); });
  app.post('/api/bank/pas/uitgeven', auth, (req, res) => { if (geenGast(req, res)) return; stuur(res, bank.bankPasUitgeven({ iban: String(req.body.iban || ''), soort: req.body.soort, naam: req.body.naam, codenaam: cn(req) })); });
  app.post('/api/bank/pas/bevries', auth, (req, res) => { if (geenGast(req, res)) return; stuur(res, bank.bankPasBevries(String(req.body.id || ''), req.body.aan === true, cn(req))); });
  app.post('/api/bank/pas/limiet', auth, (req, res) => { if (geenGast(req, res)) return; stuur(res, bank.bankPasLimiet(String(req.body.id || ''), req.body.euro, cn(req))); });
  app.post('/api/bank/pas/betaal', auth, (req, res) => { if (geenGast(req, res)) return; stuur(res, bank.bankPasBetaal({ id: String(req.body.id || ''), centen: req.body.centen, oms: req.body.oms, codenaam: cn(req) })); });
  app.post('/api/bank/pas/sluit', auth, (req, res) => { if (geenGast(req, res)) return; stuur(res, bank.bankPasSluit(String(req.body.id || ''), cn(req))); });

  /* Krediet: een lening aanvragen (het kantoor beslist), lopende leningen
     bekijken en aflossen. */
  app.post('/api/bank/krediet', auth, (req, res) => { if (geenGast(req, res)) return; stuur(res, bank.bankKredieten(cn(req))); });
  app.post('/api/bank/krediet/aanvraag', auth, (req, res) => { if (geenGast(req, res)) return; stuur(res, bank.bankKredietAanvraag({ iban: String(req.body.iban || ''), euro: req.body.euro, looptijdMnd: req.body.looptijdMnd, codenaam: cn(req) })); });
  app.post('/api/bank/krediet/aflossing', auth, (req, res) => { if (geenGast(req, res)) return; stuur(res, bank.bankKredietAflossing({ id: String(req.body.id || ''), centen: req.body.centen, codenaam: cn(req) })); });

  /* Terugkerende betalingen (incasso/vaste opdracht): zetten, tonen, stoppen. */
  app.post('/api/bank/terugkerend', auth, (req, res) => { if (geenGast(req, res)) return; stuur(res, bank.bankTerugkerend(cn(req))); });
  app.post('/api/bank/terugkerend/zet', auth, (req, res) => { if (geenGast(req, res)) return; stuur(res, bank.bankTerugkerendZet({ vanIban: String(req.body.vanIban || ''), naarIban: String(req.body.naarIban || ''), centen: req.body.centen, interval: req.body.interval, oms: req.body.oms, codenaam: cn(req) })); });
  app.post('/api/bank/terugkerend/stop', auth, (req, res) => { if (geenGast(req, res)) return; stuur(res, bank.bankTerugkerendStop({ id: String(req.body.id || ''), codenaam: cn(req) })); });

  /* Zakelijk bankieren: een bulkbetaling of salarisrun in één opdracht. */
  app.post('/api/bank/bulk', auth, (req, res) => { if (geenGast(req, res)) return; stuur(res, bank.bankBulkBetaal({ vanIban: String(req.body.vanIban || ''), posten: req.body.posten, oms: req.body.oms, codenaam: cn(req) })); });
  app.post('/api/bank/salaris', auth, (req, res) => { if (geenGast(req, res)) return; stuur(res, bank.bankSalarisRun({ vanIban: String(req.body.vanIban || ''), posten: req.body.posten, oms: req.body.oms, codenaam: cn(req) })); });

  // de AI-bankier (Rahul): advies over de eigen rekeningen; adviseert, beslist niet
  app.post('/api/bank/advies', auth, async (req, res) => { if (geenGast(req, res)) return; stuur(res, await bank.bankAdvies({ codenaam: cn(req), vraag: req.body.vraag })); });
};
