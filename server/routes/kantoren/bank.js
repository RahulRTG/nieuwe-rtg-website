/* Kantoren, deel "bank": RTG Bank vanuit de boardroom. De 3-standen knop
   (partner -> hybride -> eigen) waarmee RTG in de toekomst met één druk de eigen
   bank + het eigen betaalsysteem aanzet, plus de bank-gezondheid, de rekeningen,
   de rood-staan-ruimte, de spaarrente en de renteronde. Alles achter de office-
   inlog; elke schakeling komt in het auditlog. Afgesplitst uit kantoren/index.js. */
module.exports = (ctx) => {
  const { app, officeAuth, veilig, afdelingen, sseToOffice, kern } = ctx;
  const bank = kern.bank;
  const naam = req => (req.body && req.body.naam ? String(req.body.naam) : 'boardroom');
  const sync = () => sseToOffice('sync', { scope: 'bank' });

  // het volledige bord: regie (de knop), gezondheid en de rekeningen
  app.post('/api/office/bank', officeAuth, (req, res) => veilig(res, () => bank.overzicht()));
  app.post('/api/office/bank/gezond', officeAuth, (req, res) => veilig(res, () => bank.gezondheid()));

  /* De knop: een stand kiezen, één slag verder/terug draaien, en de bank aan-
     of uitzetten als uitgevende partij. Verder draaien kan alleen als de bank
     operationeel is; dat bewaakt de bankregie zelf. */
  /* De knop schakelt via vier-ogen bij het OPSCHALEN: opschalen levert
     needsAuth (wacht op een tweede persoon), afschalen gaat direct. */
  function relais(req, r, wat) {
    if (!r || r.error) return r;
    if (r.needsAuth) afdelingen.audit(naam(req), wat + ' AANGEVRAAGD -- wacht op een tweede persoon');
    else if (!r.ongewijzigd) { afdelingen.audit(naam(req), wat + ' uitgevoerd'); sync(); }
    return r;
  }
  app.post('/api/office/bank/modus', officeAuth, (req, res) => veilig(res, () =>
    relais(req, kern.bankModusZet({ modus: String(req.body.modus || ''), wie: naam(req) }), 'RTG Bank-stand "' + String(req.body.modus || '') + '"')));
  app.post('/api/office/bank/draai', officeAuth, (req, res) => veilig(res, () => req.body.terug === true
    ? relais(req, kern.bankDraaiTerug({ wie: naam(req) }), 'RTG Bank-knop terug')
    : relais(req, kern.bankDraai({ wie: naam(req) }), 'RTG Bank-knop een slag verder')));
  app.post('/api/office/bank/operationeel', officeAuth, (req, res) => veilig(res, () =>
    relais(req, kern.bankOperationeelZet({ aan: req.body.aan === true, wie: naam(req) }), 'RTG Bank ' + (req.body.aan === true ? 'operationeel aan' : 'operationeel uit'))));

  // de tweede persoon bevestigt (of iemand trekt in) een openstaande autorisatie
  app.post('/api/office/bank/autoriseer/bevestig', officeAuth, (req, res) => veilig(res, () => {
    const r = kern.bankAutoriseerBevestig({ id: String(req.body.id || ''), door: naam(req) });
    if (r.ok) { afdelingen.audit(naam(req), 'RTG Bank-autorisatie bevestigd (2e persoon): ' + r.uitgevoerd + ' -> stand ' + r.modus + (r.operationeel ? ', operationeel' : '')); sync(); }
    return r;
  }));
  app.post('/api/office/bank/autoriseer/annuleer', officeAuth, (req, res) => veilig(res, () => {
    const r = kern.bankAutoriseerAnnuleer({ wie: naam(req) });
    if (r.ok) { afdelingen.audit(naam(req), 'RTG Bank-autorisatie ingetrokken'); sync(); }
    return r;
  }));

  /* Nood-fallback: noodstop (clearing valt terug op de kaart-rails), herstel, en
     het melden van een mislukte clearing (trip automatisch nood bij de drempel). */
  app.post('/api/office/bank/nood', officeAuth, (req, res) => veilig(res, () => {
    const r = kern.bankNoodMeld({ reden: req.body.reden, wie: naam(req) });
    if (r.ok) { afdelingen.audit(naam(req), 'RTG Bank NOODSTOP -- clearing valt terug op de kaart-rails'); sync(); }
    return r;
  }));
  app.post('/api/office/bank/herstel', officeAuth, (req, res) => veilig(res, () => {
    const r = kern.bankNoodHerstel({ wie: naam(req) });
    if (r.ok) { afdelingen.audit(naam(req), 'RTG Bank noodstop hersteld -- clearing volgt weer de stand'); sync(); }
    return r;
  }));
  app.post('/api/office/bank/mislukking', officeAuth, (req, res) => veilig(res, () => {
    const r = kern.bankClearingMislukt(req.body.reden);
    if (r.getript) { afdelingen.audit(naam(req), 'RTG Bank AUTOMATISCH in nood na ' + r.mislukt + ' mislukte clearings'); sync(); }
    return { ok: true, ...r };
  }));

  // de leden-bank live zetten (zichtbaar in de app) of weer sluiten
  app.post('/api/office/bank/leden', officeAuth, (req, res) => veilig(res, () => {
    const r = kern.bankLedenZet({ aan: req.body.aan === true, wie: naam(req) });
    if (r.ok) { afdelingen.audit(naam(req), 'RTG Bank voor leden ' + (r.ledenAan ? 'LIVE gezet' : 'gesloten')); sync(); }
    return r;
  }));
  app.post('/api/office/bank/instellingen', officeAuth, (req, res) => veilig(res, () => {
    const r = kern.bankInstellingenZet(req.body || {});
    if (r.ok) { afdelingen.audit(naam(req), 'RTG Bank-instellingen gewijzigd (spaarrente ' + (r.spaarrenteBp / 100) + '%)'); sync(); }
    return r;
  }));

  // rekeningen: voor een lid openen, rood-staan-ruimte zetten, bevriezen, afschrift
  app.post('/api/office/bank/rekening/open', officeAuth, async (req, res) => {
    try { const r = await bank.rekeningOpen({ codenaam: req.body.codenaam, soort: req.body.soort, naam: req.body.naamRek, wie: 'kantoor' });
      if (r.ok) { afdelingen.audit(naam(req), 'Bankrekening geopend voor ' + r.rekening.iban); sync(); }
      r.error ? res.status(r.status || 400).json({ error: r.error }) : res.json(r);
    } catch (e) { res.status(500).json({ error: 'Er ging iets mis. Probeer het opnieuw.' }); }
  });
  app.post('/api/office/bank/rekening/rood', officeAuth, (req, res) => veilig(res, () => {
    const r = bank.rekeningRoodZet(String(req.body.iban || ''), req.body.euro);
    if (r.ok) { afdelingen.audit(naam(req), 'Rood-staan-ruimte op ' + r.iban + ' gezet op € ' + (r.roodLimiet / 100).toFixed(2)); sync(); }
    return r;
  }));
  app.post('/api/office/bank/rekening/bevries', officeAuth, (req, res) => veilig(res, () => {
    const r = bank.rekeningBevries(String(req.body.iban || ''), req.body.aan === true);
    if (r.ok) { afdelingen.audit(naam(req), 'Rekening ' + r.iban + ' ' + (r.bevroren ? 'bevroren' : 'ontdooid')); sync(); }
    return r;
  }));
  app.post('/api/office/bank/afschrift', officeAuth, (req, res) => veilig(res, () => bank.afschrift({ iban: String(req.body.iban || ''), limit: Number(req.body.limit) || 50, offset: Number(req.body.offset) || 0 })));

  // de renteronde met de hand draaien (normaal een dagelijkse achtergrondronde)
  app.post('/api/office/bank/rente', officeAuth, (req, res) => veilig(res, () => {
    const r = bank.bankRenteRonde(req.body && req.body.dagen != null ? { dagen: Number(req.body.dagen) } : {});
    if (r.ok && r.bijgeschrevenCenten > 0) { afdelingen.audit(naam(req), 'Spaarrente bijgeschreven: € ' + (r.bijgeschrevenCenten / 100).toFixed(2) + ' op ' + r.rekeningen + ' rekening(en)'); sync(); }
    return r;
  }));

  /* Krediet: de openstaande leningaanvragen en het besluit. Een mens beslist,
     nooit de AI; goedkeuren stort de hoofdsom op de rekening van het lid. */
  app.post('/api/office/bank/krediet', officeAuth, (req, res) => veilig(res, () => bank.bankKredietOpenstaand()));
  app.post('/api/office/bank/krediet/besluit', officeAuth, (req, res) => veilig(res, () => {
    const r = bank.bankKredietBesluit({ id: String(req.body.id || ''), akkoord: req.body.akkoord === true, wie: naam(req) });
    if (r.ok) { afdelingen.audit(naam(req), 'Kredietaanvraag ' + r.krediet.id + ' ' + (r.krediet.status === 'afgewezen' ? 'afgewezen' : 'goedgekeurd (€ ' + (r.krediet.bedragCenten / 100).toFixed(2) + ')')); sync(); }
    return r;
  }));

  // de incassoronde: alle vaste betalingen die aan de beurt zijn uitvoeren
  app.post('/api/office/bank/incasso', officeAuth, (req, res) => veilig(res, () => {
    const r = bank.bankIncassoRonde(req.body && req.body.tot != null ? { tot: Number(req.body.tot) } : {});
    if (r.ok && r.uitgevoerd > 0) { afdelingen.audit(naam(req), 'Incassoronde: ' + r.uitgevoerd + ' vaste betaling(en), € ' + (r.bedragCenten / 100).toFixed(2)); sync(); }
    return r;
  }));
};
