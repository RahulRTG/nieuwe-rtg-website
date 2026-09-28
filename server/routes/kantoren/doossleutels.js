/* Kantoren, deel "doossleutels": een eigen sleutel per zaakdoos, GEBONDEN AAN
   ZIJN ZAAK (AUTHORITY.md fase 7, besluit B12). Het register staat in
   kern/zaakdoos/sleutels.js; de vloot gebruikt hem in routes/doos-wacht.js, en
   een manager van de zaak doet hetzelfde voor zijn eigen dozen in
   routes/supplier/doossleutels.js. Uitgeven is ook roteren: de vorige sleutel
   van die doos is daarna niets meer waard. De kale sleutel staat alleen in dit
   antwoord (no-store, buiten elke antwoordcache).

   UITGEVEN IS ZWAAR, en alleen voor de eigenaar: een sleutel is een ingang voor
   een apparaat, en een gestolen sessie zou zichzelf er anders een maken -- dezelfde
   grond als boardroomtoegang geven (./regie-toegang.js). Intrekken is dat ook,
   want een sleutel intrekken zet een doos buiten. */
module.exports = (ctx) => {
  const { app, boardroomAuth, afdelingen, zwaar, boardroomUser, kern } = ctx;
  const register = () => kern.doosSleutels;
  // de mens op naam die uitgeeft of intrekt: nooit de gedeelde kantoorcode (die komt niet langs eigenaarZwaar)
  const wie = req => { const u = boardroomUser(req); return (kern.boardroomWie && kern.boardroomWie(req)) || (u ? 'account:' + u.id : ''); };

  async function eigenaarZwaar(req, res, doel, wat) {
    if (!req.boardroomBaas) { res.status(403).json({ error: 'Alleen de eigenaar geeft of neemt een doossleutel.' }); return false; }
    const bewijs = await zwaar.eis(boardroomUser(req), doel, zwaar.sessieSleutel(req), req, wat);
    if (bewijs.error) { zwaar.stuur(res, bewijs); return false; }
    return true;
  }

  app.post('/api/office/doos/sleutel', boardroomAuth, async (req, res) => {
    try {
      res.set('Cache-Control', 'no-store');
      if (!(await eigenaarZwaar(req, res, 'eigenaar-doossleutel', 'Een sleutel voor een zaakdoos uitgeven'))) return;
      const b = req.body || {};
      const zaak = kern.findSupplier(b.zaak);
      if (!zaak) return res.status(400).json({ error: 'Noem de zaak waar deze doos staat (haar code).' });
      const r = await register().geef({ doos: b.doos, zaak: zaak.code, scope: b.scope, dagen: b.dagen, door: wie(req) });
      if (r.error) return res.status(r.status || 400).json({ error: r.error });
      afdelingen.audit('eigenaar', 'Eigen sleutel ' + (r.rotatie > 1 ? 'geroteerd' : 'uitgegeven') + ' voor doos ' + r.doos + ' van zaak ' + r.zaak);
      res.json(r);
    } catch (e) { console.error('[doossleutel]', e); res.status(500).json({ error: 'Er ging iets mis. Probeer het opnieuw.' }); }
  });

  app.post('/api/office/doos/sleutel/weg', boardroomAuth, async (req, res) => {
    try {
      if (!(await eigenaarZwaar(req, res, 'eigenaar-doossleutel-weg', 'De sleutel van een zaakdoos intrekken'))) return;
      const r = await register().trekIn({ doos: req.body && req.body.doos, door: wie(req), reden: req.body && req.body.reden });
      if (r.ingetrokken) afdelingen.audit('eigenaar', 'Eigen sleutel ingetrokken van doos ' + r.doos);
      res.json(r);
    } catch (e) { console.error('[doossleutel]', e); res.status(500).json({ error: 'Er ging iets mis. Probeer het opnieuw.' }); }
  });

  /* De gedeelde sleutel dicht of weer open. Zwaar en alleen de eigenaar: dicht
     zet elke doos zonder eigen sleutel buiten. Het register weigert dichtzetten
     zolang er nog een doos met de gedeelde sleutel meldt. */
  app.post('/api/office/doos/gedeeld/zet', boardroomAuth, async (req, res) => {
    try {
      const dicht = req.body && req.body.dicht;
      if (!(await eigenaarZwaar(req, res, 'eigenaar-doossleutel-gedeeld', dicht === true
        ? 'De gedeelde doos-sleutel dichtzetten' : 'De gedeelde doos-sleutel weer openzetten'))) return;
      const r = register().gedeeldZet({ dicht, wie: 'eigenaar' });
      if (r.error) return res.status(r.status || 400).json(r);
      afdelingen.audit('eigenaar', 'Gedeelde doos-sleutel ' + (r.dicht ? 'dichtgezet' : 'weer opengezet'));
      res.json(r);
    } catch (e) { console.error('[doossleutel]', e); res.status(500).json({ error: 'Er ging iets mis. Probeer het opnieuw.' }); }
  });

  app.post('/api/office/doos/sleutels', boardroomAuth, (req, res) => res.json(Object.assign({ ok: true }, register().overzicht())));
};
