/* Domein "zorgwallet": de zorgtak van de verzekeraar (achter de
   polis-cap; de werkplek en de PDA gebruiken dezelfde endpoints) en de
   RTG Wallet van het lid (achter de leden-inlog; gasten hebben geen
   wallet). */
module.exports = (kern) => {
  const { app, db, auth, supplierAuth, zorgpolis, wallet } = kern;
  const stuur = (res, r) => { const { status, ...rest } = r; r.error ? res.status(status || 400).json({ error: r.error }) : res.status(200).json(rest); };

  // de verzekeraar: werkplek en PDA
  /* De paden staan voluit en niet als '/api/supplier/zorgpolis' + pad. Een opgebouwd pad
     ziet scripts/schakelbaar.js niet, en wat die census niet ziet is vanuit
     de boardroom niet uit te zetten en niet per stad te sluiten
     (scripts/check.js regel 45). De controle eromheen blijft op EEN plek;
     alleen de registratie is uitgeschreven. */
  const doe = (fn) => async (req, res) => {
    const caps = db.capsVan(req.supplier);
    if (!caps.includes('polis')) { res.status(403).json({ error: 'Deze zaak is geen verzekeraar.' }); return; }
    stuur(res, await fn(req.supplier.code, req.body || {}));
  };
  app.post('/api/supplier/zorgpolis', supplierAuth, doe((code) => zorgpolis.overzicht(code)));
  app.post('/api/supplier/zorgpolis/inschrijf', supplierAuth, doe((code, b) => zorgpolis.schrijfIn(code, b, b.door)));
  app.post('/api/supplier/zorgpolis/stop', supplierAuth, doe((code, b) => zorgpolis.stopZet(code, b.id)));
  app.post('/api/supplier/zorgpolis/declaratie', supplierAuth, doe((code, b) => zorgpolis.declaratieIn(code, b)));
  app.post('/api/supplier/zorgpolis/declaratie/beslis', supplierAuth, doe((code, b) => zorgpolis.declaratieBeslis(code, b, b.door)));
  app.post('/api/supplier/zorgpolis/pas', supplierAuth, doe((code, b) => zorgpolis.pasCheck(code, b.pas)));

  // de RTG Wallet van het lid
  const geenGast = (req, res, next) => {
    if (req.session.tier === 'guest') return res.status(403).json({ error: 'De RTG Wallet is voor leden.' });
    next();
  };
  const lid = [auth, geenGast];
  app.post('/api/wallet', ...lid, (req, res) => stuur(res, wallet.lijst(req.session.key)));
  app.post('/api/wallet/voeg', ...lid, (req, res) => stuur(res, wallet.voegZelf(req.session.key, req.body || {})));
  app.post('/api/wallet/weg', ...lid, (req, res) => stuur(res, wallet.weg(req.session.key, req.body.id)));
  app.post('/api/wallet/munt/koop', ...lid, (req, res) => stuur(res, wallet.muntKoop(req.session.key, req.body || {})));
  app.post('/api/wallet/munt/wissel', ...lid, (req, res) => stuur(res, wallet.muntWissel(req.session.key, req.body || {})));
};
