/* Kantoren, deel "regie-toegang": de sleutel van de boardroom.

   De eigenaar geeft toegang op codenaam en trekt hem ook weer in; de lijst toont
   alleen codenamen, namen blijven in de kluis. Afgesplitst uit ./regie.js toen
   de passkeyvraag bij het INTREKKEN dat bestand over de omvanggrens van de
   keuring duwde -- dezelfde naad als ./regie-schakel.js.

   Geven en intrekken vragen allebei de vinger (kern/zwaarbewijs.js), met elk een
   eigen actienaam, en gaan via zwaar.stuur en niet via veilig(): veilig() geeft
   alleen `error` door, en dan weet het scherm niet dat het een ceremonie moet
   starten, of voor welke actie. test/baliezetel-eigenaar.test.js houdt dat vast. */
module.exports = (ctx) => {
  const { app, boardroomAuth, boardroomLijst, keyVanCodenaam, veilig, afdelingen, save, zwaar, boardroomUser } = ctx;

  app.post('/api/office/boardroom/toegang', boardroomAuth, (req, res) => veilig(res, () =>
    ({ status: 200, ok: true, baas: !!req.boardroomBaas, lijst: boardroomLijst().map(t => ({ codenaam: t.codenaam, sinds: t.at })) })));
  app.post('/api/office/boardroom/toegang/geef', boardroomAuth, async (req, res) => {
    try {
      if (!req.boardroomBaas) return res.status(403).json({ error: 'Alleen de eigenaar geeft boardroom-toegang.' });
      const t = await keyVanCodenaam(req.body.codenaam);
      if (!t) return res.status(404).json({ error: 'Deze codenaam kennen we niet.' });
      /* Iemand anders de sleutel van deze kamer geven is de handeling waarmee
         een gestolen sessie zichzelf een tweede, blijvende ingang maakt -- de
         boardroom vergeet een gegeven toegang niet als het token verloopt.
         Daarom hier de vinger, en pas nadat de codenaam is opgezocht. */
      const bewijs = await zwaar.eis(boardroomUser(req), 'eigenaar-boardroomtoegang',
        zwaar.sessieSleutel(req), req, 'Het geven van boardroom-toegang');
      if (bewijs.error) return zwaar.stuur(res, bewijs);
      const lijst = boardroomLijst();
      if (!lijst.some(x => x.key === t.key)) {
        lijst.push({ key: t.key, codenaam: t.codename, at: new Date().toISOString() });
        save();
        afdelingen.audit('eigenaar', 'Boardroom-toegang gegeven aan ' + t.codename);
      }
      res.json({ ok: true, lijst: lijst.map(x => ({ codenaam: x.codenaam, sinds: x.at })) });
    } catch (e) { console.error('[boardroom]', e); res.status(500).json({ error: 'Er ging iets mis. Probeer het opnieuw.' }); }
  });
  app.post('/api/office/boardroom/toegang/weg', boardroomAuth, async (req, res) => {
    try {
      if (!req.boardroomBaas) return res.status(403).json({ error: 'Alleen de eigenaar trekt boardroom-toegang in.' });
      const bewijs = await zwaar.eis(boardroomUser(req), 'eigenaar-boardroomtoegang-weg',
        zwaar.sessieSleutel(req), req, 'Het intrekken van boardroom-toegang');
      if (bewijs.error) return zwaar.stuur(res, bewijs);
      const wie = String(req.body.codenaam || '').trim().toLowerCase();
      const lijst = boardroomLijst();
      // ter plekke inkorten: boardroomLijst() geeft de lijst zelf, en zo raakt
      // dit bestand de opslag niet rechtstreeks aan (ratel dbDeuren)
      const voor = lijst.length;
      for (let i = lijst.length - 1; i >= 0; i--)
        if (String(lijst[i].codenaam || '').toLowerCase() === wie) lijst.splice(i, 1);
      const rest = lijst;
      if (rest.length !== voor) {
        save();
        afdelingen.audit('eigenaar', 'Boardroom-toegang ingetrokken van ' + req.body.codenaam);
      }
      res.json({ ok: true, lijst: rest.map(x => ({ codenaam: x.codenaam, sinds: x.at })) });
    } catch (e) { console.error('[boardroom]', e); res.status(500).json({ error: 'Er ging iets mis. Probeer het opnieuw.' }); }
  });
};
