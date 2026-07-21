/* Domein "alpine": het wintersport- en seizoensresort voor partners met de
   alpine-cap; de kern in server/kern/alpine.js. */
module.exports = (kern) => {
  const { app, db, supplierAuth, alpine } = kern;
  const stuur = (res, r) => { const { status, ...rest } = r; res.status(status || 200).json(rest); };
  const r = (pad, fn) => app.post('/api/supplier/alpine' + pad, supplierAuth, (req, res) => {
    const caps = (db.data.supplierTypes[req.supplier.type] || {}).caps || [];
    if (!caps.includes('alpine')) { res.status(403).json({ error: 'Deze zaak is geen wintersportresort.' }); return; }
    stuur(res, fn(req.supplier.code, req.body || {}));
  });

  r('', (code) => alpine.overzicht(code));
  r('/piste', (code, b) => alpine.pisteZet(code, b.id, b.status));
  r('/lift', (code, b) => alpine.liftZet(code, b.id, b.status));
  r('/lawine', (code, b) => alpine.lawineZet(code, b.niveau));
  r('/pas', (code, b) => alpine.pasMaak(code, b));
  r('/huur', (code, b) => alpine.huurMaak(code, b));
  r('/huur/in', (code, b) => alpine.huurIn(code, b.id));
  r('/groep/in', (code, b) => alpine.groepIn(code, b));
  r('/prive', (code, b) => alpine.priveBoek(code, b));
  r('/prive/klaar', (code, b) => alpine.priveKlaar(code, b.id));
  r('/chalet', (code, b) => alpine.chaletBoek(code, b));
};
