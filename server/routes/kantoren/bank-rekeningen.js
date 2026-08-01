/* Kantoren, deel "bank-rekeningen": de dagelijkse bankzaken vanuit de
   backoffice -- rekeningen openen, rood-staan-ruimte, bevriezen, afschriften,
   de spaarrente en de renteronde, kredietbesluiten, de salarisrun en de
   incasso.

   De REGIE (de drie-standen-knop, het vier-ogen-principe daarop en de noodstop)
   staat in ./bank.js. Dat is een ander soort handeling: die verandert WAT RTG
   Bank is, deze voeren uit wat hij doet. Afgesplitst toen bank.js de 10 KB
   passeerde.

   `naam(req)` komt uit ./bank.js mee via de context: wie er handelt komt uit de
   sessie, nooit uit req.body. Zie de toelichting daar. */
module.exports = (ctx) => {
  const { app, officeAuth, veilig, afdelingen, sseToOffice, kern, naam } = ctx;
  const bank = kern.bank;
  const sync = () => sseToOffice('sync', { scope: 'bank' });

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
  app.post('/api/office/bank/rente', officeAuth, async (req, res) => {
    const r = await bank.bankRenteRonde(req.body && req.body.dagen != null ? { dagen: Number(req.body.dagen) } : {});
    veilig(res, () => {
      if (r.ok && r.bijgeschrevenCenten > 0) { afdelingen.audit(naam(req), 'Spaarrente bijgeschreven: € ' + (r.bijgeschrevenCenten / 100).toFixed(2) + ' op ' + r.rekeningen + ' rekening(en)'); sync(); }
      return r;
    });
  });

  /* Krediet: de openstaande leningaanvragen en het besluit. Een mens beslist,
     nooit de AI; goedkeuren stort de hoofdsom op de rekening van het lid. */
  app.post('/api/office/bank/krediet', officeAuth, (req, res) => veilig(res, () => bank.bankKredietOpenstaand()));
  app.post('/api/office/bank/krediet/besluit', officeAuth, async (req, res) => {
    const r = await bank.bankKredietBesluit({ id: String(req.body.id || ''), akkoord: req.body.akkoord === true, wie: naam(req) });
    veilig(res, () => {
      if (r.ok) { afdelingen.audit(naam(req), 'Kredietaanvraag ' + r.krediet.id + ' ' + (r.krediet.status === 'afgewezen' ? 'afgewezen' : 'goedgekeurd (€ ' + (r.krediet.bedragCenten / 100).toFixed(2) + ')')); sync(); }
      return r;
    });
  });

  /* Salarisrun gekoppeld aan de personeelskosten: het voorstel rekent de
     geklokte maanduren van een zaak om naar posten (zelfde uurloon als het
     fiscale bord, gematcht op de lid-koppeling van het personeel); de run
     voert dat voorstel uit vanaf een gekozen bronrekening, door dezelfde
     batch-voorcontrole als elke bulkbetaling. */
  app.post('/api/office/bank/salaris/voorstel', officeAuth, (req, res) => veilig(res, () =>
    bank.bankSalarisVoorstel({ zaak: req.body.zaak })));
  app.post('/api/office/bank/salaris/run', officeAuth, async (req, res) => {
    const v = bank.bankSalarisVoorstel({ zaak: req.body.zaak });
    if (v.error) { veilig(res, () => v); return; }
    if (!v.posten.length) { veilig(res, () => ({ status: 400, error: 'Geen uitbetaalbare posten: niemand met geklokte uren en een gekoppelde betaalrekening.' })); return; }
    const r = await bank.bankSalarisRun({ vanIban: String(req.body.vanIban || ''), posten: v.posten });
    veilig(res, () => {
      if (r.ok) { afdelingen.audit(naam(req), 'Salarisrun ' + v.zaak + ' (' + v.maand + '): ' + r.geboekt + ' loonbetaling(en), € ' + (r.totaalCenten / 100).toFixed(2)); sync(); }
      return r.ok ? { ...r, zaak: v.zaak, maand: v.maand, zonderRekening: v.zonderRekening } : r;
    });
  });

  // de incassoronde: alle vaste betalingen die aan de beurt zijn uitvoeren
  app.post('/api/office/bank/incasso', officeAuth, async (req, res) => {
    const r = await bank.bankIncassoRonde(req.body && req.body.tot != null ? { tot: Number(req.body.tot) } : {});
    veilig(res, () => {
      if (r.ok && r.uitgevoerd > 0) { afdelingen.audit(naam(req), 'Incassoronde: ' + r.uitgevoerd + ' vaste betaling(en), € ' + (r.bedragCenten / 100).toFixed(2)); sync(); }
      return r;
    });
  });
};
