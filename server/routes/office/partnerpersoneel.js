/* Backoffice (deelmodule): de personeelscodes van het partnerkanaal, per
   medewerker (besluit B14, kern/partnerpersoneelscode.js).

   Het kantoor geeft uit, roteert en trekt in -- de partners van het
   partnerkanaal hebben (nog) geen eigen inlog, dus hier woont het beheer. Alles
   op NAAM: boardroomWie(req) moet een mens opleveren, de gedeelde kantoorcode
   krijgt 403 (in productie komt die de deur al niet door, B10). De kale code
   staat alleen in het antwoord op uitgeven of roteren (no-store, buiten elke
   antwoordcache: lib/eenmalig-geheim-routes.js); het overzicht draagt nooit een
   code of een hash.

   Een oude, zelfgekozen `partner.staff.code` opent niets meer; het overzicht
   meldt alleen DAT hij nog in de opslag staat, zodat een mens hem kan laten
   vervangen door codes per medewerker. */
module.exports = (octx) => {
  const { kern } = octx;
  const { app, boardroomAuth, boardroomWie, findPartner } = kern;
  const codes = () => kern.partnerPersoneelscode;
  const wie = req => { try { return boardroomWie(req) || ''; } catch (e) { return ''; } };
  const opNaam = (req, res) => {
    const w = wie(req);
    if (!w) res.status(403).json({ error: 'Personeelscodes beheert een medewerker op naam, niet de gedeelde kantoorcode.' });
    return w;
  };
  const fout = (res, e) => { console.error('[partnerpersoneel]', e); res.status(500).json({ error: 'Er ging iets mis. Probeer het opnieuw.' }); };

  app.post('/api/office/partnerkanaal/personeelscodes', boardroomAuth, (req, res) => {
    if (!opNaam(req, res)) return;
    const b = req.body || {};
    const partner = b.partner ? findPartner(b.partner) : null;
    if (b.partner && !partner) return res.status(404).json({ error: 'Deze partner kennen we niet.' });
    res.json({ codes: codes().lijst(partner ? partner.code : null),
      oudeKaleCode: partner ? !!(partner.staff && partner.staff.code) : null,
      uitleg: 'Een oude, zelfgekozen personeelscode opent niets meer; geef elke medewerker een eigen code.' });
  });

  app.post('/api/office/partnerkanaal/personeelscode', boardroomAuth, async (req, res) => {
    res.set('Cache-Control', 'no-store');
    try {
      const w = opNaam(req, res); if (!w) return;
      const b = req.body || {};
      const r = await codes().geef({ partner: b.partner, label: b.label, dagen: b.dagen, maxGebruik: b.maxGebruik, door: w });
      if (r.error) return res.status(r.status || 400).json({ error: r.error });
      res.json(r);
    } catch (e) { fout(res, e); }
  });

  app.post('/api/office/partnerkanaal/personeelscode/roteer', boardroomAuth, async (req, res) => {
    res.set('Cache-Control', 'no-store');
    try {
      const w = opNaam(req, res); if (!w) return;
      const b = req.body || {};
      const r = await codes().roteer({ id: b.id, dagen: b.dagen, door: w });
      if (r.error) return res.status(r.status || 400).json({ error: r.error });
      res.json(r);
    } catch (e) { fout(res, e); }
  });

  app.post('/api/office/partnerkanaal/personeelscode/intrek', boardroomAuth, async (req, res) => {
    try {
      const w = opNaam(req, res); if (!w) return;
      const b = req.body || {};
      const r = await codes().trekIn({ id: b.id, door: w, reden: b.reden });
      if (r.error) return res.status(r.status || 400).json({ error: r.error });
      res.json(r);
    } catch (e) { fout(res, e); }
  });
};
