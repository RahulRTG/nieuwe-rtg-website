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
    cercle, crClub, crClubWeg, crGast, crGastTerug, crWaarheen,
    hangar, hgToestel, hgToestelWeg, hgVlucht, hgVluchtWeg,
    entourage, enPersoon, enPersoonWeg, enDoc, enDocWeg, enGezelschap,
    attenties, atRelatie, atRelatieWeg, atGift, atGiftWeg,
    rechterhandAI } = kern;

  function eis(req, res) {
    if (['lifestyle', 'business'].includes(req.session.tier)) return true;
    res.status(403).json({ error: 'Deze app is onderdeel van de Lifestyle Pass.' });
    return false;
  }
  const stuur = (res, r) => r && r.error ? res.status(r.status || 400).json({ error: r.error }) : res.json(r);
  /* De paden staan voluit en niet als '/api/member/rechterhand/' + pad. Een opgebouwd pad
     ziet scripts/schakelbaar.js niet, en wat die census niet ziet is vanuit de
     boardroom niet uit te zetten en niet per stad te sluiten (scripts/check.js
     regel 45). De pas-eis en het vangnet blijven op EEN plek; alleen de
     registratie is uitgeschreven. */
  const doe = (werk) => (req, res) => {
    if (!eis(req, res)) return;
    try { stuur(res, werk(req.session.key, req.body || {})); }
    catch (e) { res.status(500).json({ error: 'Er ging iets mis. Probeer het opnieuw.' }); }
  };

  // Reisboek
  app.post('/api/member/rechterhand/reisboek', auth, doe((k) => reizen(k)));
  app.post('/api/member/rechterhand/reis/zet', auth, doe((k, b) => reisZet(k, b)));
  app.post('/api/member/rechterhand/reis/weg', auth, doe((k, b) => reisWeg(k, String(b.id || ''))));
  app.post('/api/member/rechterhand/reis/item', auth, doe((k, b) => reisItem(k, b)));
  app.post('/api/member/rechterhand/reis/item/weg', auth, doe((k, b) => reisItemWeg(k, b)));
  // Cellier
  app.post('/api/member/rechterhand/cellier', auth, doe((k) => cellier(k)));
  app.post('/api/member/rechterhand/cellier/zet', auth, doe((k, b) => celZet(k, b)));
  app.post('/api/member/rechterhand/cellier/weg', auth, doe((k, b) => celWeg(k, String(b.id || ''))));
  app.post('/api/member/rechterhand/cellier/schenk', auth, doe((k, b) => celSchenk(k, String(b.id || ''))));
  // Table
  app.post('/api/member/rechterhand/table', auth, doe((k) => tables(k)));
  app.post('/api/member/rechterhand/table/zet', auth, doe((k, b) => tableZet(k, b)));
  app.post('/api/member/rechterhand/table/weg', auth, doe((k, b) => tableWeg(k, String(b.id || ''))));
  app.post('/api/member/rechterhand/table/gast', auth, doe((k, b) => tableGast(k, b)));
  app.post('/api/member/rechterhand/table/gast/zet', auth, doe((k, b) => tableGastZet(k, b)));
  app.post('/api/member/rechterhand/table/gast/weg', auth, doe((k, b) => tableGastWeg(k, b)));
  app.post('/api/member/rechterhand/table/menu', auth, doe((k, b) => tableMenu(k, b)));
  app.post('/api/member/rechterhand/table/menu/weg', auth, doe((k, b) => tableMenuWeg(k, b)));
  // Maison
  app.post('/api/member/rechterhand/maison', auth, doe((k) => maison(k)));
  app.post('/api/member/rechterhand/maison/staf', auth, doe((k, b) => maisonStaf(k, b)));
  app.post('/api/member/rechterhand/maison/staf/weg', auth, doe((k, b) => maisonStafWeg(k, String(b.id || ''))));
  app.post('/api/member/rechterhand/maison/taak', auth, doe((k, b) => maisonTaak(k, b)));
  app.post('/api/member/rechterhand/maison/taak/klaar', auth, doe((k, b) => maisonTaakKlaar(k, b)));
  app.post('/api/member/rechterhand/maison/taak/weg', auth, doe((k, b) => maisonTaakWeg(k, String(b.id || ''))));
  app.post('/api/member/rechterhand/maison/log', auth, doe((k, b) => maisonLog(k, b)));
  app.post('/api/member/rechterhand/maison/log/weg', auth, doe((k, b) => maisonLogWeg(k, String(b.id || ''))));
  // Garde-robe
  app.post('/api/member/rechterhand/garderobe', auth, doe((k) => garderobe(k)));
  app.post('/api/member/rechterhand/garderobe/stuk', auth, doe((k, b) => gwStuk(k, b)));
  app.post('/api/member/rechterhand/garderobe/stuk/weg', auth, doe((k, b) => gwStukWeg(k, String(b.id || ''))));
  app.post('/api/member/rechterhand/garderobe/vakman', auth, doe((k, b) => gwVakman(k, b)));
  app.post('/api/member/rechterhand/garderobe/vakman/weg', auth, doe((k, b) => gwVakmanWeg(k, String(b.id || ''))));
  // Mecenaat
  app.post('/api/member/rechterhand/mecenaat', auth, doe((k) => mecenaat(k)));
  app.post('/api/member/rechterhand/mecenaat/gift', auth, doe((k, b) => mecGift(k, b)));
  app.post('/api/member/rechterhand/mecenaat/gift/weg', auth, doe((k, b) => mecGiftWeg(k, String(b.id || ''))));
  app.post('/api/member/rechterhand/mecenaat/betaald', auth, doe((k, b) => mecBetaald(k, String(b.id || ''), b.betaald === true)));
  // Nalatenschap
  app.post('/api/member/rechterhand/nalatenschap', auth, doe((k) => nalatenschap(k)));
  app.post('/api/member/rechterhand/nalatenschap/doc', auth, doe((k, b) => nlDoc(k, b)));
  app.post('/api/member/rechterhand/nalatenschap/doc/weg', auth, doe((k, b) => nlDocWeg(k, String(b.id || ''))));
  app.post('/api/member/rechterhand/nalatenschap/contact', auth, doe((k, b) => nlContact(k, b)));
  app.post('/api/member/rechterhand/nalatenschap/contact/weg', auth, doe((k, b) => nlContactWeg(k, String(b.id || ''))));
  app.post('/api/member/rechterhand/nalatenschap/wens', auth, doe((k, b) => nlWens(k, b)));
  app.post('/api/member/rechterhand/nalatenschap/wens/weg', auth, doe((k, b) => nlWensWeg(k, String(b.id || ''))));
  // Logboek
  app.post('/api/member/rechterhand/logboek', auth, doe((k) => logboek(k)));
  app.post('/api/member/rechterhand/logboek/object', auth, doe((k, b) => lbObject(k, b)));
  app.post('/api/member/rechterhand/logboek/object/weg', auth, doe((k, b) => lbObjectWeg(k, String(b.id || ''))));
  app.post('/api/member/rechterhand/logboek/regel', auth, doe((k, b) => lbRegel(k, b)));
  app.post('/api/member/rechterhand/logboek/regel/weg', auth, doe((k, b) => lbRegelWeg(k, String(b.id || ''))));
  // Cercle
  app.post('/api/member/rechterhand/cercle', auth, doe((k) => cercle(k)));
  app.post('/api/member/rechterhand/cercle/club', auth, doe((k, b) => crClub(k, b)));
  app.post('/api/member/rechterhand/cercle/club/weg', auth, doe((k, b) => crClubWeg(k, String(b.id || ''))));
  /* Gastpassen met een boekhouding en de reciprociteitsvraag "waar kan ik in
     deze stad terecht" -- elders werk voor een conciergedienst. */
  app.post('/api/member/rechterhand/cercle/gast', auth, doe((k, b) => crGast(k, b)));
  app.post('/api/member/rechterhand/cercle/gast/terug', auth, doe((k, b) => crGastTerug(k, b)));
  app.post('/api/member/rechterhand/cercle/waarheen', auth, doe((k, b) => crWaarheen(k, b)));
  // Hangar
  app.post('/api/member/rechterhand/hangar', auth, doe((k) => hangar(k)));
  app.post('/api/member/rechterhand/hangar/toestel', auth, doe((k, b) => hgToestel(k, b)));
  app.post('/api/member/rechterhand/hangar/toestel/weg', auth, doe((k, b) => hgToestelWeg(k, String(b.id || ''))));
  app.post('/api/member/rechterhand/hangar/vlucht', auth, doe((k, b) => hgVlucht(k, b)));
  app.post('/api/member/rechterhand/hangar/vlucht/weg', auth, doe((k, b) => hgVluchtWeg(k, String(b.id || ''))));
  // Entourage
  app.post('/api/member/rechterhand/entourage', auth, doe((k) => entourage(k)));
  app.post('/api/member/rechterhand/entourage/persoon', auth, doe((k, b) => enPersoon(k, b)));
  app.post('/api/member/rechterhand/entourage/persoon/weg', auth, doe((k, b) => enPersoonWeg(k, String(b.id || ''))));
  /* Documenten met een vervaldatum (elders de betaalde functie van een reisapp)
     en het gezelschap samenstellen met een gereedheidscheck. */
  app.post('/api/member/rechterhand/entourage/doc', auth, doe((k, b) => enDoc(k, b)));
  app.post('/api/member/rechterhand/entourage/doc/weg', auth, doe((k, b) => enDocWeg(k, b)));
  app.post('/api/member/rechterhand/entourage/gezelschap', auth, doe((k, b) => enGezelschap(k, b)));
  // Attenties
  app.post('/api/member/rechterhand/attenties', auth, doe((k) => attenties(k)));
  app.post('/api/member/rechterhand/attenties/relatie', auth, doe((k, b) => atRelatie(k, b)));
  app.post('/api/member/rechterhand/attenties/relatie/weg', auth, doe((k, b) => atRelatieWeg(k, String(b.id || ''))));
  app.post('/api/member/rechterhand/attenties/gift', auth, doe((k, b) => atGift(k, b)));
  app.post('/api/member/rechterhand/attenties/gift/weg', auth, doe((k, b) => atGiftWeg(k, String(b.id || ''))));

  // Rahul als adviseur binnen elke app (u-vorm); async, dus een eigen handler
  app.post('/api/member/rechterhand/ai', auth, async (req, res) => {
    if (!eis(req, res)) return;
    try { stuur(res, await rechterhandAI(req.session.key, String((req.body || {}).app || ''), (req.body || {}).vraag)); }
    catch (e) { res.status(500).json({ error: 'Er ging iets mis. Probeer het opnieuw.' }); }
  });
};
