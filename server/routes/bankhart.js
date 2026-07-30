/* Routes van het financiele hart: het verenigde afschrift (RTG Bank + RTG
   Pay + de derde-partij-kaartnaad, gelijkwaardig getoond met een bronlabel),
   de premium-functies (inzichten, vaste-lasten-radar, wisselgeld sparen),
   de zakelijke rekening van elke zaak (manager) en de Regelwacht-status
   voor het bankkantoor. Draait op de gedeelde kern. */
module.exports = (kern) => {
  const { app, auth, supplierAuth, officeAuth, managerOnly, liveCodename, bank, regelwacht, logActivity } = kern;
  const stuur = (res, r) => r.error ? res.status(r.status || 400).json({ error: r.error }) : res.json(r);
  const gast = (req, res) => { if (req.session.tier === 'guest') { res.status(403).json({ error: 'RTG Bank is voor leden.' }); return true; } return false; };
  const dicht = (req, res) => { if (!kern.bankLedenAan()) { res.status(403).json({ error: 'De RTG Bank is nog niet live voor leden.' }); return true; } return false; };
  const gate = (req, res) => gast(req, res) || dicht(req, res);
  const cn = req => liveCodename(req.session);

  /* ---------- het hart voor het lid ---------- */
  app.post('/api/bank/hart', auth, (req, res) => { if (gate(req, res)) return; res.json(bank.bankHart(cn(req), Math.min(200, Number(req.body.limit) || 60))); });
  app.post('/api/bank/inzichten', auth, (req, res) => { if (gate(req, res)) return; res.json(bank.bankInzichten(cn(req), req.body.maand)); });
  app.post('/api/bank/vastelasten', auth, (req, res) => { if (gate(req, res)) return; res.json({ vasteLasten: bank.bankVasteLasten(cn(req)) }); });
  app.post('/api/bank/veeg', auth, async (req, res) => { if (gate(req, res)) return; stuur(res, await bank.bankVeegWisselgeld(cn(req))); });

  /* ---------- de zakelijke rekening van de zaak (werkgever) ----------
     De zaak bankiert onder de eigen vlag 'zaak:<code>': de manager opent
     (of vindt) de zakelijke rekening en ziet het afschrift en het saldo. */
  app.post('/api/supplier/bank/zakelijk', supplierAuth, async (req, res) => {
    if (!managerOnly(req, res)) return;
    if (!kern.bankLedenAan()) return res.status(403).json({ error: 'De RTG Bank is nog niet live.' });
    const vlag = 'zaak:' + req.supplier.code;
    let rekening = Object.values(kern.db.data.bankRekeningen || {}).find(m => m.codenaam === vlag && m.soort === 'zakelijk');
    if (!rekening) {
      const r = await bank.rekeningOpen({ codenaam: vlag, soort: 'zakelijk', naam: 'Zakelijke rekening ' + req.supplier.name, wie: 'zaak' });
      if (r.error) return stuur(res, r);
      rekening = kern.db.data.bankRekeningen[r.rekening.iban];
      logActivity(req.supplier.code, req.actor, 'opende de zakelijke rekening van de zaak');
    }
    const af = bank.afschrift({ iban: rekening.iban, limit: 40 });
    res.json({ rekening: { iban: rekening.iban, naam: rekening.naam, soort: rekening.soort },
      saldoCenten: bank.saldoVan(rekening.iban), afschrift: af.regels || [] });
  });

  /* ---------- de Regelwacht voor het bankkantoor ---------- */
  app.post('/api/office/bank/regels', officeAuth, (req, res) => res.json(regelwacht.status()));
  app.post('/api/office/bank/regels/update', officeAuth, (req, res) => {
    const r = regelwacht.pasToe({ landen: req.body.landen || {} }, 'kantoor', req.body.versie);
    res.json(r);
  });
  app.post('/api/office/bank/regels/check', officeAuth, async (req, res) => res.json(await regelwacht.check()));

};
