/* Domein "kantoorpakket": RTG Office, het kantoorpakket voor het hele
   ecosysteem. Drie ingangen op dezelfde kern:
   - leden (RTG, Lifestyle en Business Pass) onder /api/kantoorpakket,
     op het eigen account (gasten niet);
   - elke leverancier en partner onder /api/supplier/kantoorpakket, als
     team-drive per zaak (sleutel 'sup:CODE', het hele team dezelfde map);
   - de eigen RTG-kantoren onder /api/office/kantoorpakket, op de gedeelde
     kantoor-drive ('rtg:kantoor').
   De bewaar-route heeft een ruimere body-limiet; los van de RTG-backoffice
   (/api/office) zelf. */
module.exports = (kern) => {
  const { app, auth, supplierAuth, officeAuth, express,
    officeMijn, officeMaak, officeOpen, officeBewaar, officeDeel, officeWeg,
    officeVersies, officeTerug, officeAI } = kern;
  const stuur = (res, r) => r.error ? res.status(r.status || 400).json({ error: r.error }) : res.json(r);
  const ruim = express.json({ limit: '600kb' });

  /* Dezelfde acties voor elke ingang; alleen de sleutel verschilt. */
  function mount(basis, wacht, keyVan) {
    const route = (pad, fn, extra) => app.post(basis + pad, ...(extra ? [extra] : []), wacht, async (req, res) => {
      stuur(res, await fn(keyVan(req), req.body || {}));
    });
    route('/mijn', (key) => officeMijn(key));
    route('/maak', (key, b) => officeMaak(key, b));
    route('/open', (key, b) => officeOpen(key, b.id));
    route('/bewaar', (key, b) => officeBewaar(key, b.id, b), ruim);
    route('/deel', (key, b) => officeDeel(key, b.id, b.codenaam, b.aan !== false, b.rechten));
    route('/weg', (key, b) => officeWeg(key, b.id));
    route('/versies', (key, b) => officeVersies(key, b.id));
    route('/terug', (key, b) => officeTerug(key, b.id, b.nr));
    route('/ai', (key, b) => officeAI(key, b.id, b.opdracht, b.vraag));
  }

  // leden: op het eigen account; de gratis gast-app heeft geen Office
  const geenGast = (req, res, next) => {
    if (req.session.tier === 'guest') return res.status(403).json({ error: 'RTG Office is voor leden.' });
    next();
  };
  const ledenAuth = [auth, geenGast];
  {
    const route = (pad, fn, extra) => app.post('/api/kantoorpakket' + pad, ...(extra ? [extra] : []), ...ledenAuth, async (req, res) => {
      stuur(res, await fn(req.session.key, req.body || {}));
    });
    route('/mijn', (key) => officeMijn(key));
    route('/maak', (key, b) => officeMaak(key, b));
    route('/open', (key, b) => officeOpen(key, b.id));
    route('/bewaar', (key, b) => officeBewaar(key, b.id, b), ruim);
    route('/deel', (key, b) => officeDeel(key, b.id, b.codenaam, b.aan !== false, b.rechten));
    route('/weg', (key, b) => officeWeg(key, b.id));
    route('/versies', (key, b) => officeVersies(key, b.id));
    route('/terug', (key, b) => officeTerug(key, b.id, b.nr));
    route('/ai', (key, b) => officeAI(key, b.id, b.opdracht, b.vraag));
  }

  // elke leverancier en partner: de team-drive van de zaak
  mount('/api/supplier/kantoorpakket', supplierAuth, req => 'sup:' + req.supplier.code);
  // de eigen RTG-kantoren: de gedeelde kantoor-drive
  mount('/api/office/kantoorpakket', officeAuth, () => 'rtg:kantoor');
};
