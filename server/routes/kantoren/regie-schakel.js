/* Kantoren, deel "regie-schakel": de schakelroutes van de boardroom-kast.

   Globaal en per doelgroep, gericht per plaats/land/persoon, per genre zaken,
   de grote hendel en de uitrolfases. Afgesplitst uit ./regie.js toen dat
   bestand door de 10 KB van keuringsregel 13 ging; de rest van de regie
   (papierwerk, geld, Mall, paniekkamer, wereldkaart) bleef daar.

   Elke route hier loopt door dezelfde boardroom-poort en meldt zijn wijziging
   over de office-SSE, zodat het bord live meekleurt. */
module.exports = (ctx) => {
  const { app, boardroomAuth, keyVanCodenaam, veilig, stuur, afdelingen, sseToOffice } = ctx;

  app.post('/api/office/boardroom/schakel', boardroomAuth, (req, res) => veilig(res, () => {
    const r = afdelingen.schakel(String(req.body.functie || ''), req.body.aan === true, req.body.doelgroep ? String(req.body.doelgroep) : null, req.body.naam ? String(req.body.naam) : 'boardroom');
    if (r.ok) sseToOffice('sync', { scope: 'boardroom' });
    return r;
  }));
  /* De fijne assen: een functie gericht dicht (of weer open) voor EEN plaats,
     land of persoon. De persoon mag als codenaam binnenkomen; die herleiden we
     hier naar de user-sleutel -- de boardroom denkt in codenamen, de kast in
     sleutels. aan=true haalt de beperking weg. */
  app.post('/api/office/boardroom/schakel-fijn', boardroomAuth, async (req, res) => {
    try {
      let sleutel = String(req.body.sleutel || '');
      const as = String(req.body.as || '');
      if (as === 'persoon' && !/^user-\d+$/.test(sleutel)) {
        const t = await keyVanCodenaam(sleutel);
        if (!t) return res.status(404).json({ error: 'Deze codenaam kennen we niet.' });
        sleutel = t.key || t;
      }
      const r = afdelingen.schakelFijn(String(req.body.functie || ''), as, sleutel,
        req.body.aan === true, req.body.naam ? String(req.body.naam) : 'boardroom');
      if (r.ok) sseToOffice('sync', { scope: 'boardroom' });
      stuur(res, r);
    } catch (e) { console.error('[boardroom]', e); res.status(500).json({ error: 'Er ging iets mis. Probeer het opnieuw.' }); }
  });
  app.post('/api/office/boardroom/verbeter', boardroomAuth, (req, res) => veilig(res, () => ({ ok: true, verbeterkamer: afdelingen.voorstellen(true) })));
  // Rahul kijkt over het hele huis: adviserend, uit de verbeterkamer-signalen en de drukte per kamer
  app.post('/api/office/boardroom/ai', boardroomAuth, async (req, res) => {
    try { const r = await afdelingen.boardroomAdvies(req.body.q); r.error ? res.status(r.status || 400).json({ error: r.error }) : res.json(r); }
    catch (e) { console.error('[boardroom]', e); res.status(500).json({ error: 'Rahul kon nu even niet meedenken.' }); }
  });
  // de leveranciers-regie: een functie per genre zaken open of dicht
  app.post('/api/office/boardroom/genre', boardroomAuth, (req, res) => veilig(res, () => {
    const r = afdelingen.schakelGenre(String(req.body.functie || ''), String(req.body.genre || ''),
      req.body.aan === true, req.body.naam ? String(req.body.naam) : 'boardroom');
    if (r.ok) sseToOffice('sync', { scope: 'boardroom' });
    return r;
  }));
  // de grote hendel: alles bij iedereen beschikbaar zetten of sluiten (intern blijft open)
  app.post('/api/office/boardroom/alles', boardroomAuth, (req, res) => veilig(res, () => {
    const r = afdelingen.schakelAlles(req.body.aan === true, req.body.naam ? String(req.body.naam) : 'boardroom');
    if (r.ok) sseToOffice('sync', { scope: 'boardroom' });
    return r;
  }));
  // de uitrolfases: in EEN klik de hele kast in de stand van een fase
  app.post('/api/office/boardroom/fase', boardroomAuth, (req, res) => veilig(res, () => {
    const r = afdelingen.schakelFase(String(req.body.fase || ''), req.body.naam ? String(req.body.naam) : 'boardroom');
    if (r.ok) sseToOffice('sync', { scope: 'boardroom' });
    return r;
  }));
};
