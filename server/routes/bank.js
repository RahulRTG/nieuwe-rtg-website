/* Domein "bank": RTG Bank voor het lid. Het scherm is er alleen als de boardroom
   de leden-bank LIVE heeft gezet (bankLedenAan); tot die tijd geeft het overzicht
   online:false en blijven de acties dicht. Iedereen krijgt zijn eigen rekening pas
   NA akkoord (opt-in) -- hetzelfde voor nieuwe leden als voor bestaande leden bij
   live gaan. Achter de gewone leden-inlog, niet voor gasten. Idempotent op de
   clearende paden. */
module.exports = (kern) => {
  const { app, auth, liveCodename, bank } = kern;
  const stuur = (res, r) => r.error ? res.status(r.status || 400).json({ error: r.error }) : res.json(r);
  const gast = (req, res) => { if (req.session.tier === 'guest') { res.status(403).json({ error: 'RTG Bank is voor leden.' }); return true; } return false; };
  const dicht = (req, res) => { if (!kern.bankLedenAan()) { res.status(403).json({ error: 'De RTG Bank is nog niet live voor leden.' }); return true; } return false; };
  const gate = (req, res) => gast(req, res) || dicht(req, res); // niet-gast EN de bank moet live zijn
  const cn = req => liveCodename(req.session);

  // het scherm: online? akkoord? mijn rekeningen. Werkt altijd (online:false als dicht)
  app.post('/api/bank/overzicht', auth, (req, res) => { if (gast(req, res)) return; stuur(res, bank.bankLedenOverzicht(cn(req))); });
  // akkoord geven: opent meteen de eerste betaalrekening (de module bewaakt online)
  app.post('/api/bank/akkoord', auth, async (req, res) => { if (gast(req, res)) return; stuur(res, await bank.bankLedenAkkoord(cn(req))); });

  app.post('/api/bank/rekening/open', auth, async (req, res) => { if (gate(req, res)) return; stuur(res, await bank.rekeningOpen({ codenaam: cn(req), soort: req.body.soort, naam: req.body.naam, wie: 'lid' })); });
  app.post('/api/bank/rekening', auth, (req, res) => { if (gate(req, res)) return; stuur(res, bank.rekeningDetail(String(req.body.iban || ''), cn(req))); });
  app.post('/api/bank/afschrift', auth, (req, res) => {
    if (gate(req, res)) return;
    const bezit = bank.rekeningDetail(String(req.body.iban || ''), cn(req));
    if (bezit.error) return stuur(res, bezit);
    stuur(res, bank.afschrift({ iban: String(req.body.iban || ''), limit: Number(req.body.limit) || 50, offset: Number(req.body.offset) || 0 }));
  });
  app.post('/api/bank/bevries', auth, (req, res) => { if (gate(req, res)) return; stuur(res, bank.rekeningBevries(String(req.body.iban || ''), req.body.aan === true, cn(req))); });

  app.post('/api/bank/storten', auth, async (req, res) => { if (gate(req, res)) return; stuur(res, await bank.bankStorten({ iban: String(req.body.iban || ''), centen: req.body.centen, route: req.body.route, codenaam: cn(req), idem: req.body.idem, oms: req.body.oms })); });
  app.post('/api/bank/overboek', auth, (req, res) => { if (gate(req, res)) return; stuur(res, bank.bankOverboek({ vanIban: String(req.body.vanIban || ''), naarIban: String(req.body.naarIban || ''), centen: req.body.centen, oms: req.body.oms, codenaam: cn(req) })); });
  app.post('/api/bank/naar-wallet', auth, (req, res) => { if (gate(req, res)) return; stuur(res, bank.bankBankNaarWallet({ iban: String(req.body.iban || ''), codenaam: cn(req), centen: req.body.centen })); });
  app.post('/api/bank/van-wallet', auth, (req, res) => { if (gate(req, res)) return; stuur(res, bank.bankWalletNaarBank({ iban: String(req.body.iban || ''), codenaam: cn(req), centen: req.body.centen })); });
  app.post('/api/bank/sepa', auth, async (req, res) => { if (gate(req, res)) return; stuur(res, await bank.bankSepaUit({ iban: String(req.body.iban || ''), codenaam: cn(req), centen: req.body.centen, naarIban: req.body.naarIban, begunstigde: req.body.begunstigde, oms: req.body.oms, idem: req.body.idem })); });
  app.post('/api/bank/spaardoel', auth, (req, res) => { if (gate(req, res)) return; stuur(res, bank.bankSpaardoelZet({ iban: String(req.body.iban || ''), euro: req.body.euro, codenaam: cn(req) })); });
  app.post('/api/bank/rente-voorbeeld', auth, (req, res) => { if (gate(req, res)) return; stuur(res, bank.bankRenteVoorbeeld(req.body.euro)); });

  // passen
  app.post('/api/bank/passen', auth, (req, res) => { if (gate(req, res)) return; stuur(res, bank.bankPassen(cn(req))); });
  app.post('/api/bank/pas/uitgeven', auth, (req, res) => { if (gate(req, res)) return; stuur(res, bank.bankPasUitgeven({ iban: String(req.body.iban || ''), soort: req.body.soort, naam: req.body.naam, codenaam: cn(req) })); });
  app.post('/api/bank/pas/bevries', auth, (req, res) => { if (gate(req, res)) return; stuur(res, bank.bankPasBevries(String(req.body.id || ''), req.body.aan === true, cn(req))); });
  app.post('/api/bank/pas/limiet', auth, (req, res) => { if (gate(req, res)) return; stuur(res, bank.bankPasLimiet(String(req.body.id || ''), req.body.euro, cn(req))); });
  app.post('/api/bank/pas/betaal', auth, (req, res) => { if (gate(req, res)) return; stuur(res, bank.bankPasBetaal({ id: String(req.body.id || ''), centen: req.body.centen, oms: req.body.oms, codenaam: cn(req) })); });
  app.post('/api/bank/pas/sluit', auth, (req, res) => { if (gate(req, res)) return; stuur(res, bank.bankPasSluit(String(req.body.id || ''), cn(req))); });

  // krediet
  app.post('/api/bank/krediet', auth, (req, res) => { if (gate(req, res)) return; stuur(res, bank.bankKredieten(cn(req))); });
  app.post('/api/bank/krediet/aanvraag', auth, (req, res) => { if (gate(req, res)) return; stuur(res, bank.bankKredietAanvraag({ iban: String(req.body.iban || ''), euro: req.body.euro, looptijdMnd: req.body.looptijdMnd, codenaam: cn(req) })); });
  app.post('/api/bank/krediet/aflossing', auth, (req, res) => { if (gate(req, res)) return; stuur(res, bank.bankKredietAflossing({ id: String(req.body.id || ''), centen: req.body.centen, codenaam: cn(req) })); });

  // terugkerende betalingen
  app.post('/api/bank/terugkerend', auth, (req, res) => { if (gate(req, res)) return; stuur(res, bank.bankTerugkerend(cn(req))); });
  app.post('/api/bank/terugkerend/zet', auth, (req, res) => { if (gate(req, res)) return; stuur(res, bank.bankTerugkerendZet({ vanIban: String(req.body.vanIban || ''), naarIban: String(req.body.naarIban || ''), centen: req.body.centen, interval: req.body.interval, oms: req.body.oms, codenaam: cn(req) })); });
  app.post('/api/bank/terugkerend/stop', auth, (req, res) => { if (gate(req, res)) return; stuur(res, bank.bankTerugkerendStop({ id: String(req.body.id || ''), codenaam: cn(req) })); });

  // zakelijk bankieren
  app.post('/api/bank/bulk', auth, (req, res) => { if (gate(req, res)) return; stuur(res, bank.bankBulkBetaal({ vanIban: String(req.body.vanIban || ''), posten: req.body.posten, oms: req.body.oms, codenaam: cn(req) })); });
  app.post('/api/bank/salaris', auth, (req, res) => { if (gate(req, res)) return; stuur(res, bank.bankSalarisRun({ vanIban: String(req.body.vanIban || ''), posten: req.body.posten, oms: req.body.oms, codenaam: cn(req) })); });

  // de AI-bankier (Rahul): advies over de eigen rekeningen; adviseert, beslist niet
  app.post('/api/bank/advies', auth, async (req, res) => { if (gate(req, res)) return; stuur(res, await bank.bankAdvies({ codenaam: cn(req), vraag: req.body.vraag })); });

  /* Afschrift-export: een net CSV-bestand van de eigen rekening om te bewaren
     of in de boekhouding in te lezen. GET met ?token= (een downloadlink kan
     geen Authorization-header meesturen), dezelfde gates als de rest. */
  app.get('/api/bank/afschrift.csv', (req, res) => {
    const sess = kern.resolveSession(String(req.query.token || ''));
    if (!sess) return res.status(401).json({ error: 'Niet ingelogd.' });
    req.session = sess;
    if (gate(req, res)) return;
    const iban = String(req.query.iban || '');
    const bezit = bank.rekeningDetail(iban, cn(req));
    if (bezit.error) return stuur(res, bezit);
    const esc = require('../kern/factuur').csvCel; // csv-veilig + geen formule-injectie
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="rtg-afschrift-' + iban + '-' + new Date().toISOString().slice(0, 10) + '.csv"');
    res.write('\uFEFF' + ['datum', 'af/bij', 'bedrag', 'soort', 'tegenrekening', 'omschrijving'].join(';') + '\n');
    // het hele afschrift, in blokken langs de vaste paginagrens van de kern
    for (let vanaf = 0; vanaf < 2000; vanaf += 200) {
      const blok = bank.afschrift({ iban, limit: 200, offset: vanaf });
      if (blok.error || !blok.regels.length) break;
      for (const r of blok.regels)
        res.write([new Date(r.at).toISOString().slice(0, 16).replace('T', ' '), r.af ? 'af' : 'bij',
          (r.centen / 100).toFixed(2).replace('.', ','), r.soort, r.tegen, r.oms || ''].map(esc).join(';') + '\n');
      if (blok.regels.length < 200) break;
    }
    res.end();
  });
};
