/* Kantoren, deel "doossleutels": een eigen sleutel per zaakdoos (AUTHORITY.md
   fase 7). Het register staat in kern/zaakdoos/sleutels.js; de vloot gebruikt
   hem in routes/doos.js. De gedeelde doos-sleutel blijft werken tot een apart
   besluit (schaduw).

   UITGEVEN IS ZWAAR, en alleen voor de eigenaar: een sleutel is een ingang voor
   een apparaat, en een gestolen sessie zou zichzelf er anders een maken -- dezelfde
   grond als boardroomtoegang geven (./regie-toegang.js). Intrekken is dat ook,
   want een sleutel intrekken zet een doos buiten. */
module.exports = (ctx) => {
  const { app, boardroomAuth, afdelingen, zwaar, boardroomUser, db, save } = ctx;
  const crypto = require('crypto');
  const register = () => require('../../kern/zaakdoos/sleutels').doosSleutelsVan({ db, save, crypto });

  async function eigenaarZwaar(req, res, doel, wat) {
    if (!req.boardroomBaas) { res.status(403).json({ error: 'Alleen de eigenaar geeft of neemt een doossleutel.' }); return false; }
    const bewijs = await zwaar.eis(boardroomUser(req), doel, zwaar.sessieSleutel(req), req, wat);
    if (bewijs.error) { zwaar.stuur(res, bewijs); return false; }
    return true;
  }

  app.post('/api/office/doos/sleutel', boardroomAuth, async (req, res) => {
    try {
      if (!(await eigenaarZwaar(req, res, 'eigenaar-doossleutel', 'Een sleutel voor een zaakdoos uitgeven'))) return;
      const r = register().geef(req.body && req.body.doos);
      if (r.error) return res.status(r.status || 400).json({ error: r.error });
      afdelingen.audit('eigenaar', 'Eigen sleutel uitgegeven voor doos ' + r.doos);
      res.json(r);
    } catch (e) { console.error('[doossleutel]', e); res.status(500).json({ error: 'Er ging iets mis. Probeer het opnieuw.' }); }
  });

  app.post('/api/office/doos/sleutel/weg', boardroomAuth, async (req, res) => {
    try {
      if (!(await eigenaarZwaar(req, res, 'eigenaar-doossleutel-weg', 'De sleutel van een zaakdoos intrekken'))) return;
      const r = register().trekIn(req.body && req.body.doos);
      if (r.ingetrokken) afdelingen.audit('eigenaar', 'Eigen sleutel ingetrokken van doos ' + String(req.body.doos || ''));
      res.json(r);
    } catch (e) { console.error('[doossleutel]', e); res.status(500).json({ error: 'Er ging iets mis. Probeer het opnieuw.' }); }
  });

  app.post('/api/office/doos/sleutels', boardroomAuth, (req, res) => res.json(Object.assign({ ok: true }, register().overzicht())));
};
