/* Domein "verzorging": de beauty-salon en barbier, petcare en de
   kinderopvang met nanny-service, elk achter een eigen cap ('beauty',
   'petcare', 'opvang'); de kern in server/kern/verzorging.js. */
module.exports = (kern) => {
  const { app, db, supplierAuth, beauty, petcare, opvang } = kern;
  const stuur = (res, r) => { const { status, ...rest } = r; res.status(status || 200).json(rest); };
  const maak = (basis, capNaam, domein) => (pad, fn) => app.post(basis + pad, supplierAuth, (req, res) => {
    const caps = (db.data.supplierTypes[req.supplier.type] || {}).caps || [];
    if (!caps.includes(capNaam)) { res.status(403).json({ error: 'Deze zaak is geen ' + domein + '.' }); return; }
    stuur(res, fn(req.supplier.code, req.body || {}));
  });

  const b = maak('/api/supplier/beauty', 'beauty', 'beauty-salon');
  b('', (code) => beauty.overzicht(code));
  b('/boek', (code, x) => beauty.boek(code, x));
  b('/status', (code, x) => beauty.afspraakStatus(code, x.id, x.status));
  b('/walkin', (code, x) => beauty.walkIn(code, x));
  b('/walkin/status', (code, x) => beauty.walkStatus(code, x.id, x.status));

  const p = maak('/api/supplier/petcare', 'petcare', 'petcare-bedrijf');
  p('', (code) => petcare.overzicht(code));
  p('/checkin', (code, x) => petcare.checkIn(code, x));
  p('/checkuit', (code, x) => petcare.checkUit(code, x.id));
  p('/notitie', (code, x) => petcare.notitie(code, x.id, x.tekst));
  p('/ronde', (code, x) => petcare.rondeMaak(code, x.tijd));
  p('/ronde/hond', (code, x) => petcare.rondeHond(code, x.id, x.naam));
  p('/ronde/klaar', (code, x) => petcare.rondeKlaar(code, x.id));
  p('/trim', (code, x) => petcare.trimBoek(code, x));
  p('/trim/klaar', (code, x) => petcare.trimKlaar(code, x.id));

  const o = maak('/api/supplier/opvang', 'opvang', 'kinderopvang');
  o('', (code) => opvang.overzicht(code));
  o('/kind', (code, x) => opvang.kindMeld(code, x));
  o('/kind/ophaal', (code, x) => opvang.kindOphaal(code, x));
  o('/nanny', (code, x) => opvang.nannyVraag(code, x));
  o('/nanny/zet', (code, x) => opvang.nannyZet(code, x));
  o('/verslag', (code, x) => opvang.verslagMaak(code, x));
};
