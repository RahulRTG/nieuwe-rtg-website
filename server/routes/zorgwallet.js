/* Domein "zorgwallet": de zorgtak van de verzekeraar (achter de
   polis-cap; de werkplek en de PDA gebruiken dezelfde endpoints) en de
   RTG Wallet van het lid (achter de leden-inlog; gasten hebben geen
   wallet). */
module.exports = (kern) => {
  const { app, db, auth, supplierAuth, zorgpolis, wallet } = kern;
  const stuur = (res, r) => { const { status, ...rest } = r; r.error ? res.status(status || 400).json({ error: r.error }) : res.status(200).json(rest); };

  // de verzekeraar: werkplek en PDA
  const z = (pad, fn) => app.post('/api/supplier/zorgpolis' + pad, supplierAuth, async (req, res) => {
    const caps = (db.data.supplierTypes[req.supplier.type] || {}).caps || [];
    if (!caps.includes('polis')) { res.status(403).json({ error: 'Deze zaak is geen verzekeraar.' }); return; }
    stuur(res, await fn(req.supplier.code, req.body || {}));
  });
  z('', (code) => zorgpolis.overzicht(code));
  z('/inschrijf', (code, b) => zorgpolis.schrijfIn(code, b, b.door));
  z('/stop', (code, b) => zorgpolis.stopZet(code, b.id));
  z('/declaratie', (code, b) => zorgpolis.declaratieIn(code, b));
  z('/declaratie/beslis', (code, b) => zorgpolis.declaratieBeslis(code, b, b.door));
  z('/pas', (code, b) => zorgpolis.pasCheck(code, b.pas));

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
