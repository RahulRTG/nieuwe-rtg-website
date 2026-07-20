/* Member-submodule: de extra premium ROS-apps van de Lifestyle Pass -- Reisboek,
   Cellier, Table en Maison. Gated op de Lifestyle Pass (Business erft mee). Alleen
   routes; de logica woont in kern/rechterhand/. Gemount vanuit routes/member.js. */
module.exports = (kern) => {
  const { app, auth,
    reizen, reisZet, reisWeg, reisItem, reisItemWeg,
    cellier, celZet, celWeg, celSchenk,
    tables, tableZet, tableWeg, tableGast, tableGastZet, tableGastWeg, tableMenu, tableMenuWeg,
    maison, maisonStaf, maisonStafWeg, maisonTaak, maisonTaakKlaar, maisonTaakWeg, maisonLog, maisonLogWeg,
    rechterhandAI } = kern;

  function eis(req, res) {
    if (['lifestyle', 'business'].includes(req.session.tier)) return true;
    res.status(403).json({ error: 'Deze app is onderdeel van de Lifestyle Pass.' });
    return false;
  }
  const stuur = (res, r) => r && r.error ? res.status(r.status || 400).json({ error: r.error }) : res.json(r);
  function route(pad, werk) {
    app.post('/api/member/rechterhand/' + pad, auth, (req, res) => {
      if (!eis(req, res)) return;
      try { stuur(res, werk(req.session.key, req.body || {})); }
      catch (e) { res.status(500).json({ error: 'Er ging iets mis. Probeer het opnieuw.' }); }
    });
  }

  // Reisboek
  route('reisboek', (k) => reizen(k));
  route('reis/zet', (k, b) => reisZet(k, b));
  route('reis/weg', (k, b) => reisWeg(k, String(b.id || '')));
  route('reis/item', (k, b) => reisItem(k, b));
  route('reis/item/weg', (k, b) => reisItemWeg(k, b));
  // Cellier
  route('cellier', (k) => cellier(k));
  route('cellier/zet', (k, b) => celZet(k, b));
  route('cellier/weg', (k, b) => celWeg(k, String(b.id || '')));
  route('cellier/schenk', (k, b) => celSchenk(k, String(b.id || '')));
  // Table
  route('table', (k) => tables(k));
  route('table/zet', (k, b) => tableZet(k, b));
  route('table/weg', (k, b) => tableWeg(k, String(b.id || '')));
  route('table/gast', (k, b) => tableGast(k, b));
  route('table/gast/zet', (k, b) => tableGastZet(k, b));
  route('table/gast/weg', (k, b) => tableGastWeg(k, b));
  route('table/menu', (k, b) => tableMenu(k, b));
  route('table/menu/weg', (k, b) => tableMenuWeg(k, b));
  // Maison
  route('maison', (k) => maison(k));
  route('maison/staf', (k, b) => maisonStaf(k, b));
  route('maison/staf/weg', (k, b) => maisonStafWeg(k, String(b.id || '')));
  route('maison/taak', (k, b) => maisonTaak(k, b));
  route('maison/taak/klaar', (k, b) => maisonTaakKlaar(k, b));
  route('maison/taak/weg', (k, b) => maisonTaakWeg(k, String(b.id || '')));
  route('maison/log', (k, b) => maisonLog(k, b));
  route('maison/log/weg', (k, b) => maisonLogWeg(k, String(b.id || '')));

  // Rahul als adviseur binnen elke app (u-vorm); async, dus een eigen handler
  app.post('/api/member/rechterhand/ai', auth, async (req, res) => {
    if (!eis(req, res)) return;
    try { stuur(res, await rechterhandAI(req.session.key, String((req.body || {}).app || ''), (req.body || {}).vraag)); }
    catch (e) { res.status(500).json({ error: 'Er ging iets mis. Probeer het opnieuw.' }); }
  });
};
