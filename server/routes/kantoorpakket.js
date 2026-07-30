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
    werkplek, boardroomWie, boardroomBaas,
    officeMijn, officeMaak, officeOpen, officeBewaar, officeDeel, officeWeg, officeSter,
    officeVersies, officeTerug, officeAI, officeKring, officeVul, officeUitslag } = kern;
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
    route('/ster', (key, b) => officeSter(key, b.id, b.aan));
    route('/versies', (key, b) => officeVersies(key, b.id));
    route('/terug', (key, b) => officeTerug(key, b.id, b.nr));
    route('/ai', (key, b) => officeAI(key, b.id, b.opdracht, b.vraag));
    route('/vul', (key, b) => officeVul(key, b.id, b));
    route('/uitslag', (key, b) => officeUitslag(key, b.id));
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
    route('/ster', (key, b) => officeSter(key, b.id, b.aan));
    route('/versies', (key, b) => officeVersies(key, b.id));
    route('/terug', (key, b) => officeTerug(key, b.id, b.nr));
    route('/ai', (key, b) => officeAI(key, b.id, b.opdracht, b.vraag));
    route('/vul', (key, b) => officeVul(key, b.id, b));
    route('/uitslag', (key, b) => officeUitslag(key, b.id));
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
  rtfRoute('/ster', (s, b) => officeSter(s.key, b.id, b.aan), { schrijf: true });
  rtfRoute('/versies', (s, b) => officeVersies(s.key, b.id, s.kring));
  rtfRoute('/terug', (s, b) => officeTerug(s.key, b.id, b.nr), { schrijf: true });
  rtfRoute('/ai', (s, b) => officeAI(s.key, b.id, b.opdracht, b.vraag, s.kring), { schrijf: true });
  rtfRoute('/gezin', (s, b) => officeKring(s.key, b.id, b.rechten), { schrijf: true });
  // invullen mag ook een oppas of familielid (gast): antwoorden is geen bewerken
  rtfRoute('/vul', (s, b) => officeVul(s.key, b.id, b, s.kring));
  rtfRoute('/uitslag', (s, b) => officeUitslag(s.key, b.id, s.kring), { schrijf: true });

  /* De werkplekken: elk huis zijn eigen kantoordrive, op dezelfde kern als de
     rest van RTG Office. RTG werkte al op 'rtg:kantoor'; de RTFoundation kreeg
     die drive nooit, en had dus geen eigen documenten. Nu heeft elk huis er
     een, met dezelfde drie soorten (tekst, blad, presentatie), dezelfde
     versies, dezelfde export en dezelfde AI-hulp.

     De deur is die van de werkplek zelf: de eigenaar mag in beide huizen, een
     medewerker alleen in het zijne. Wie geen sleutel heeft ziet de map niet,
     laat staan de inhoud. */
  const huisDrive = req => {
    const key = boardroomWie(req);
    const baas = boardroomBaas(key);
    const code = String((req.body || {}).bedrijf || '').toLowerCase();
    if (!werkplek.kent(code)) return { fout: { status: 404, error: 'Dit bedrijf kennen we niet.' } };
    if (!werkplek.magIn(code, key, baas)) return { fout: { status: 403, error: 'Deze werkplek is niet van u. Vraag de eigenaar om toegang tot dit bedrijf.' } };
    // de kring is het huis zelf: collega's van hetzelfde bedrijf delen de map
    return { key: code + ':kantoor', kring: 'werkplek:' + code };
  };
  const huisRoute = (pad, fn, opties) => app.post('/api/werkplek/kantoorpakket' + pad, ...((opties && opties.ruim) ? [ruim] : []), async (req, res) => {
    const s = huisDrive(req);
    if (s.fout) return res.status(s.fout.status).json({ error: s.fout.error });
    stuur(res, await fn(s, req.body || {}));
  });
  huisRoute('/mijn', (s) => officeMijn(s.key, s.kring));
  huisRoute('/maak', (s, b) => officeMaak(s.key, b, s.kring));
  huisRoute('/open', (s, b) => officeOpen(s.key, b.id, s.kring));
  huisRoute('/bewaar', (s, b) => officeBewaar(s.key, b.id, b, s.kring), { ruim: true });
  huisRoute('/weg', (s, b) => officeWeg(s.key, b.id));
  huisRoute('/ster', (s, b) => officeSter(s.key, b.id, b.aan));
  huisRoute('/versies', (s, b) => officeVersies(s.key, b.id, s.kring));
  huisRoute('/terug', (s, b) => officeTerug(s.key, b.id, b.nr));
  huisRoute('/ai', (s, b) => officeAI(s.key, b.id, b.opdracht, b.vraag, s.kring));
  huisRoute('/vul', (s, b) => officeVul(s.key, b.id, b, s.kring));
  huisRoute('/uitslag', (s, b) => officeUitslag(s.key, b.id, s.kring));
};
