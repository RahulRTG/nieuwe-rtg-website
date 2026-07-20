/* Member-submodule: de extra premium ROS-apps van de Lifestyle Pass -- Reisboek,
   Cellier, Table en Maison. Gated op de Lifestyle Pass (Business erft mee). Alleen
   routes; de logica woont in kern/rechterhand/. Gemount vanuit routes/member.js. */
module.exports = (kern) => {
  const { app, auth,
    reizen, reisZet, reisWeg, reisItem, reisItemWeg,
    cellier, celZet, celWeg, celSchenk,
    tables, tableZet, tableWeg, tableGast, tableGastZet, tableGastWeg, tableMenu, tableMenuWeg,
    maison, maisonStaf, maisonStafWeg, maisonTaak, maisonTaakKlaar, maisonTaakWeg, maisonLog, maisonLogWeg,
    garderobe, gwStuk, gwStukWeg, gwVakman, gwVakmanWeg,
    mecenaat, mecGift, mecGiftWeg, mecBetaald,
    nalatenschap, nlDoc, nlDocWeg, nlContact, nlContactWeg, nlWens, nlWensWeg,
    logboek, lbObject, lbObjectWeg, lbRegel, lbRegelWeg,
    cercle, crClub, crClubWeg,
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
  // Garde-robe
  route('garderobe', (k) => garderobe(k));
  route('garderobe/stuk', (k, b) => gwStuk(k, b));
  route('garderobe/stuk/weg', (k, b) => gwStukWeg(k, String(b.id || '')));
  route('garderobe/vakman', (k, b) => gwVakman(k, b));
  route('garderobe/vakman/weg', (k, b) => gwVakmanWeg(k, String(b.id || '')));
  // Mecenaat
  route('mecenaat', (k) => mecenaat(k));
  route('mecenaat/gift', (k, b) => mecGift(k, b));
  route('mecenaat/gift/weg', (k, b) => mecGiftWeg(k, String(b.id || '')));
  route('mecenaat/betaald', (k, b) => mecBetaald(k, String(b.id || ''), b.betaald === true));
  // Nalatenschap
  route('nalatenschap', (k) => nalatenschap(k));
  route('nalatenschap/doc', (k, b) => nlDoc(k, b));
  route('nalatenschap/doc/weg', (k, b) => nlDocWeg(k, String(b.id || '')));
  route('nalatenschap/contact', (k, b) => nlContact(k, b));
  route('nalatenschap/contact/weg', (k, b) => nlContactWeg(k, String(b.id || '')));
  route('nalatenschap/wens', (k, b) => nlWens(k, b));
  route('nalatenschap/wens/weg', (k, b) => nlWensWeg(k, String(b.id || '')));
  // Logboek
  route('logboek', (k) => logboek(k));
  route('logboek/object', (k, b) => lbObject(k, b));
  route('logboek/object/weg', (k, b) => lbObjectWeg(k, String(b.id || '')));
  route('logboek/regel', (k, b) => lbRegel(k, b));
  route('logboek/regel/weg', (k, b) => lbRegelWeg(k, String(b.id || '')));
  // Cercle
  route('cercle', (k) => cercle(k));
  route('cercle/club', (k, b) => crClub(k, b));
  route('cercle/club/weg', (k, b) => crClubWeg(k, String(b.id || '')));

  // Rahul als adviseur binnen elke app (u-vorm); async, dus een eigen handler
  app.post('/api/member/rechterhand/ai', auth, async (req, res) => {
    if (!eis(req, res)) return;
    try { stuur(res, await rechterhandAI(req.session.key, String((req.body || {}).app || ''), (req.body || {}).vraag)); }
    catch (e) { res.status(500).json({ error: 'Er ging iets mis. Probeer het opnieuw.' }); }
  });
};
