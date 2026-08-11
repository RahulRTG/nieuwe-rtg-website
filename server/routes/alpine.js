/* Domein "alpine": het wintersport- en seizoensresort voor partners met de
   alpine-cap; de kern in server/kern/alpine.js. */
module.exports = (kern) => {
  const { app, db, supplierAuth, alpine } = kern;
  const stuur = (res, r) => { const { status, ...rest } = r; res.status(status || 200).json(rest); };
  /* De paden staan voluit en niet als '/api/supplier/alpine' + pad. Zo'n
     opgebouwd pad ziet scripts/schakelbaar.js niet, en wat die census niet
     ziet is vanuit de boardroom niet uit te zetten en niet per stad te
     sluiten (scripts/check.js regel 45). De caps-controle blijft hier op EEN
     plek staan; alleen de registratie is uitgeschreven. */
  const doe = (fn) => (req, res) => {
    const caps = db.capsVan(req.supplier);
    if (!caps.includes('alpine')) { res.status(403).json({ error: 'Deze zaak is geen wintersportresort.' }); return; }
    stuur(res, fn(req.supplier.code, req.body || {}));
  };

  app.post('/api/supplier/alpine', supplierAuth, doe((code) => alpine.overzicht(code)));
  app.post('/api/supplier/alpine/piste', supplierAuth, doe((code, b) => alpine.pisteZet(code, b.id, b.status)));
  app.post('/api/supplier/alpine/lift', supplierAuth, doe((code, b) => alpine.liftZet(code, b.id, b.status)));
  app.post('/api/supplier/alpine/lawine', supplierAuth, doe((code, b) => alpine.lawineZet(code, b.niveau)));
  app.post('/api/supplier/alpine/pas', supplierAuth, doe((code, b) => alpine.pasMaak(code, b)));
  app.post('/api/supplier/alpine/huur', supplierAuth, doe((code, b) => alpine.huurMaak(code, b)));
  app.post('/api/supplier/alpine/huur/in', supplierAuth, doe((code, b) => alpine.huurIn(code, b.id)));
  app.post('/api/supplier/alpine/groep/in', supplierAuth, doe((code, b) => alpine.groepIn(code, b)));
  app.post('/api/supplier/alpine/prive', supplierAuth, doe((code, b) => alpine.priveBoek(code, b)));
  app.post('/api/supplier/alpine/prive/klaar', supplierAuth, doe((code, b) => alpine.priveKlaar(code, b.id)));
  app.post('/api/supplier/alpine/chalet', supplierAuth, doe((code, b) => alpine.chaletBoek(code, b)));
};
