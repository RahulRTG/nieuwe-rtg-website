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
  const { app, auth, supplierAuth, officeAuth, express, rtf,
    officeMijn, officeMaak, officeOpen, officeBewaar, officeDeel, officeWeg,
    officeVersies, officeTerug, officeAI, officeKring } = kern;
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

  /* RTF-leden: elk gezinsprofiel een eigen map (gezinscode + profieltoken in
     de body, zoals alle RTF-routes), met een kring per gezin: de maker kan
     een document met het eigen gezin delen (meelezen of samen schrijven),
     nooit daarbuiten. Een oppas of familielid (gast) leest alleen mee. */
  function rtfSessie(req, res) {
    const sess = rtf && rtf.verifieerProfiel(req.body.code, req.body.token);
    if (!sess) { res.status(403).json({ error: 'Log opnieuw in bij je gezin.' }); return null; }
    const code = String(req.body.code || '').toUpperCase();
    return { key: 'rtf:' + code + ':' + sess.handle, kring: 'rtfgezin:' + code, gast: !!sess.gast };
  }
  const rtfRoute = (pad, fn, opties) => app.post('/api/rtf/kantoorpakket' + pad, ...((opties && opties.ruim) ? [ruim] : []), async (req, res) => {
    const s = rtfSessie(req, res); if (!s) return;
    if (opties && opties.schrijf && s.gast) return res.status(403).json({ error: 'Als oppas of familielid lees je mee; maken en bewerken doet het gezin zelf.' });
    stuur(res, await fn(s, req.body || {}));
  });
  rtfRoute('/mijn', (s) => officeMijn(s.key, s.kring));
  rtfRoute('/maak', (s, b) => officeMaak(s.key, b, s.kring), { schrijf: true });
  rtfRoute('/open', (s, b) => officeOpen(s.key, b.id, s.kring));
  rtfRoute('/bewaar', (s, b) => officeBewaar(s.key, b.id, b, s.kring), { schrijf: true, ruim: true });
  rtfRoute('/weg', (s, b) => officeWeg(s.key, b.id), { schrijf: true });
  rtfRoute('/versies', (s, b) => officeVersies(s.key, b.id, s.kring));
  rtfRoute('/terug', (s, b) => officeTerug(s.key, b.id, b.nr), { schrijf: true });
  rtfRoute('/ai', (s, b) => officeAI(s.key, b.id, b.opdracht, b.vraag, s.kring), { schrijf: true });
  rtfRoute('/gezin', (s, b) => officeKring(s.key, b.id, b.rechten), { schrijf: true });
};
