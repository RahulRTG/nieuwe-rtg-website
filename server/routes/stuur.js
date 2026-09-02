/* Routes "stuur": het universele stuur van de AI (kern/stuur.js) voor de
   drie werelden. Rahul voert hiermee acties uit op ELK toegestaan API-pad,
   altijd met de eigen inlog van wie het vraagt:
   - /api/member/doe    het lid (en de gratis app), met de leden-token
   - /api/supplier/doe  de zaak (eigenaar of manager)
   - /api/staff/doe     het personeel op de PDA (logt in binnen de zaak)
   De /kaart-varianten geven uitsluitend de expliciet beoordeelde paden terug.
   Een wijziging levert een eenmalig servervoorstel; alleen /doe/bevestig kan
   dat exacte voorstel uitvoeren. De tool-lus zelf mag die route nooit zien. */
module.exports = (kern) => {
  const { app, auth, supplierAuth, stuurRoep, stuurBevestig, stuurPaden } = kern;

  /* DE ISOLATIECONTEXT HOORT OOK HIER, en dat werd bijna vergeten. De tool-lus
     (kern/stuur/lus.js) versmalt zijn kaart al op de stand van de aanroeper --
     maar deze drie /kaart-routes zijn een TWEEDE weg naar dezelfde lijst, en die
     versmalde niet. Een lid in de beschermstand kreeg hier gewoon te lezen wat
     hij normaal mag, en dat is precies de faalvorm waar de laag tegen is: de
     weigering komt dan pas bij de aanroep, dus na de belofte.

     Hij komt uit de SESSIE en niet uit het verzoek -- zelfde reden als in
     kern/stuur/luscontext.js: zou de aanroeper hem meesturen, dan kiest hij zelf
     welke stand op hem van toepassing is. */
  const isoContext = (req) => {
    const s = (req && req.session) || null;
    if (!s || !kern.isolatie) return null;
    try {
      return kern.isolatie.context({ identiteit: s.key || null, sessie: s.id || s.sid || s.key || null });
    } catch (e) { return null; }
  };

  /* Wat er door een stand wegviel, gaat MEE in het antwoord. Een kaart die
     stilletjes korter is, laat de aanroeper denken dat die vermogens niet
     bestaan (EXECUTIE.md blok 0). */
  const metUitleg = (paden) => {
    const iso = paden.isolatie;
    if (!iso || !iso.actief || !iso.weggevallen.length) return { ok: true, paden };
    return { ok: true, paden, beveiligingsstand: { weggevallen: iso.weggevallen.length, uitleg: iso.uitleg } };
  };

  const antwoord = (res, r) => {
    if (r.bevestigNodig) return res.status(428).json(r);
    if (r.error) return res.status(r.status || 500).json({ error: r.error });
    // de buitenkant is gelukt; de binnenkant vertelt hoe de actie afliep
    return res.json({ ok: r.status < 400, status: r.status, antwoord: r.antwoord });
  };
  const alleenPersoneel = (req, res, wereld) => {
    if (wereld === 'staff' && (!req.actor || !req.actor.staffId)) {
      res.status(403).json({ error: 'Het personeelsstuur vereist een persoonlijke personeelslogin.' });
      return false;
    }
    return true;
  };
  const doeHandler = (wereld) => async (req, res) => {
    if (!alleenPersoneel(req, res, wereld)) return;
    const r = await stuurRoep(req, String(req.body.pad || ''), req.body.body,
      { wereld });
    antwoord(res, r);
  };
  const bevestigHandler = (wereld) => async (req, res) => {
    if (!alleenPersoneel(req, res, wereld)) return;
    if (req.body.akkoord !== true)
      return res.status(400).json({ error: 'Bevestig dit voorstel uitdrukkelijk met akkoord=true.' });
    const r = await stuurBevestig(req, String(req.body.goedkeuringId || ''), wereld);
    antwoord(res, r);
  };
  app.post('/api/member/doe', auth, doeHandler('member'));
  app.post('/api/member/doe/bevestig', auth, bevestigHandler('member'));
  app.post('/api/supplier/doe', supplierAuth, doeHandler('supplier'));
  app.post('/api/supplier/doe/bevestig', supplierAuth, bevestigHandler('supplier'));
  app.post('/api/staff/doe', supplierAuth, doeHandler('staff'));
  app.post('/api/staff/doe/bevestig', supplierAuth, bevestigHandler('staff'));

  // de kaart per wereld: leden zien geen werk-paden en andersom
  const WERK = ['/api/supplier', '/api/staff', '/api/office', '/api/foundation', '/api/partner'];
  app.post('/api/member/doe/kaart', auth, (req, res) => {
    const alle = stuurPaden(app, 'member', isoContext(req));
    const paden = alle.filter(p => !WERK.some(w => p.startsWith(w)));
    /* De vlag reist mee over het filteren heen: `filter` levert een gewone array
       en die draagt de niet-opsombare eigenschap niet. */
    Object.defineProperty(paden, 'isolatie', { value: alle.isolatie, enumerable: false });
    res.json(metUitleg(paden));
  });
  app.post('/api/supplier/doe/kaart', supplierAuth, (req, res) => {
    res.json(metUitleg(stuurPaden(app, 'supplier', isoContext(req))));
  });
  app.post('/api/staff/doe/kaart', supplierAuth, (req, res) => {
    if (!alleenPersoneel(req, res, 'staff')) return;
    res.json(metUitleg(stuurPaden(app, 'staff', isoContext(req))));
  });
};
