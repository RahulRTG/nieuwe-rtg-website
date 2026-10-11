/* Het verbond tussen twee genootschappen (kern/verbond/, GEMEENSCHAP-FASE0.md
   par. 4.2). De ledendeur: gewone leden-auth, geen gast.

   De route geeft de SESSIE door en het id van het verbond, en verder alleen wat
   een mens invult (doel, afspraken, data, een reden). Welke kant iemand is,
   leest de kern uit de sessie; er is hier met opzet geen `kant` uit het verzoek.
   De statuscode komt uit de kern: 404 voor een verbond dat niet bestaat (of
   niet voor jou), 403 voor wie geen beheerder is, 409 voor een stand die het
   niet toelaat (opgezegd, verlopen, nog niet compleet) en 400 voor invoer die
   niet klopt. Gemount vanuit routes/member.js. */
'use strict';
const { veiligeFout } = require('../../kern/util');
module.exports = (kern) => {
  const { app, auth, geenGast, verbond } = kern;
  const fout = (res, e) => res.status(400).json({ error: veiligeFout(e) });
  const uit = (res, r) => res.status(r && r.status ? r.status : (r && r.error ? 400 : 200)).json(r);
  const id = (req) => (req.body || {}).verbond;

  app.post('/api/verbond/voorstel', auth, (req, res) => {
    if (geenGast(req, res)) return;
    try { uit(res, verbond.voorstel(req.session, req.body || {})); } catch (e) { fout(res, e); }
  });

  app.post('/api/verbond/teken', auth, (req, res) => {
    if (geenGast(req, res)) return;
    try { uit(res, verbond.teken(req.session, id(req))); } catch (e) { fout(res, e); }
  });

  app.post('/api/verbond/wijzig', auth, (req, res) => {
    if (geenGast(req, res)) return;
    try { uit(res, verbond.wijzig(req.session, id(req), req.body || {})); } catch (e) { fout(res, e); }
  });

  app.post('/api/verbond/zeg-op', auth, (req, res) => {
    if (geenGast(req, res)) return;
    try { uit(res, verbond.zegOp(req.session, id(req), (req.body || {}).reden)); } catch (e) { fout(res, e); }
  });

  app.post('/api/verbond/mijn', auth, (req, res) => {
    if (geenGast(req, res)) return;
    try { uit(res, verbond.mijn(req.session)); } catch (e) { fout(res, e); }
  });

  app.post('/api/verbond/lees', auth, (req, res) => {
    if (geenGast(req, res)) return;
    try { uit(res, verbond.lees(req.session, id(req))); } catch (e) { fout(res, e); }
  });
};
