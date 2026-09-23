/* Kantoren, deel "regie-toegang": de sleutel van de boardroom.

   De eigenaar geeft toegang op codenaam en trekt hem ook weer in; de lijst toont
   alleen codenamen, namen blijven in de kluis. Afgesplitst uit ./regie.js toen de
   passkey op het intrekken dat bestand vlak onder de 10 KB van keuringsregel 13
   bracht -- dit is een eigen naad: wie mag de kamer in, tegenover wat er in de
   kamer gebeurt.

   GEVEN EN INTREKKEN ZIJN ALLEBEI ZWAAR. Geven, omdat een gestolen sessie
   zichzelf anders een blijvende tweede ingang maakt; intrekken, omdat diezelfde
   sessie anders de echte medewerkers buitenzet. magBoardroom leest de lijst bij
   elk verzoek, dus wie hier van de lijst gaat, komt de boardroom meteen niet
   meer in -- ook niet met een sessie die al openstond. */
module.exports = (ctx) => {
  const { app, boardroomAuth, boardroomLijst, keyVanCodenaam, veilig, afdelingen,
          save, zwaar, boardroomUser, kern } = ctx;

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
    if (!req.boardroomBaas) return res.status(403).json({ error: 'Alleen de eigenaar trekt boardroom-toegang in.' });
    const bewijs = await zwaar.eis(boardroomUser(req), 'eigenaar-boardroomtoegang-weg',
      zwaar.sessieSleutel(req), req, 'Het intrekken van boardroom-toegang').catch(() => null);
    if (!bewijs) return res.status(500).json({ error: 'Er ging iets mis. Probeer het opnieuw.' });
    if (bewijs.error) return zwaar.stuur(res, bewijs);
    try {
      const wie = String(req.body.codenaam || '').trim().toLowerCase();
      // IN DE LEVENDE LIJST van boardroomLijst(): geen tweede weg naar db.data
      const lijst = boardroomLijst();
      const weg = [];
      for (let i = lijst.length - 1; i >= 0; i--) {
        if (String(lijst[i].codenaam || '').toLowerCase() === wie) weg.push(lijst.splice(i, 1)[0]);
      }
      let sessiesGesloten = 0;
      if (weg.length) {
        save();
        afdelingen.audit('eigenaar', 'Boardroom-toegang ingetrokken van ' + req.body.codenaam);
        /* En de kantoorsessies die al openstonden gaan dicht (AUTHORITY.md
           fase 3): magBoardroom sloot alleen de kamer, niet de deur ernaartoe. */
        for (const t of weg) if (t.key && kern.kantoorIntrekking) {
          sessiesGesloten += (await kern.kantoorIntrekking.sluitKantoorVan(t.key, req)).sessies;
        }
      }
      res.json({ ok: true, sessiesGesloten, lijst: lijst.map(x => ({ codenaam: x.codenaam, sinds: x.at })) });
    } catch (e) { console.error('[regie-toegang]', e); res.status(500).json({ error: 'Er ging iets mis. Probeer het opnieuw.' }); }
  });
};
