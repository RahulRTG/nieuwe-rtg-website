/* Domein "baby": het fotoboekje van de allerkleinsten. Alleen via de
   RTFoundation (gezinscode + profieltoken); dit is het privealbum van het
   gezin, dus gasten (oppas, familie) komen er niet in. */
module.exports = (kern) => {
  const { app, rtf, baby } = kern;

  /* De poort als ECHTE MIDDLEWARE en niet als aanroep binnenin. Zo staat bij
     elke route zichtbaar WELKE deur hij heeft -- voor een lezer en voor
     scripts/check.js regel 28, die het venster na de route leest en een poort
     in een wrapper dus niet ziet. De sessie reist mee op req. */
  function gezinsPoort(req, res, next) {
    const sess = rtf.verifieerProfiel(req.body.code, req.body.token);
    if (!sess) return res.status(403).json({ error: 'Log opnieuw in bij je gezin.' });
    if (sess.gast) return res.status(403).json({ error: 'Het fotoboekje is van het gezin zelf.' });
    req.gezinslid = sess;
    next();
  }
  const stuur = (res, r) => r.error ? res.status(r.status).json({ error: r.error }) : res.json(r);

  // vangnet: Express 4 vangt async-fouten niet zelf (zie routes/spellen.js)
  async function veilig(res, werk) {
    try { stuur(res, await werk()); }
    catch (e) { res.status(500).json({ error: 'Er ging iets mis. Probeer het opnieuw.' }); }
  }

  /* Hier stond een lus over een ACTIES-tabel, met het pad opgebouwd als
     '/api/rtf/baby/' + naam. Dat leest compact, maar scripts/schakelbaar.js
     telt de schakelbaarheid door letterlijke paden te zoeken: deze acht
     routes bestonden voor de boardroom niet, en waren dus niet uit te zetten
     en niet per stad te sluiten (scripts/check.js regel 45).

     De poort (gezinslid: geen gasten in het prive-album) en het vangnet staan
     nog steeds op EEN plek; alleen de registratie is uitgeschreven. */
  const doe = (fn) => (req, res) => veilig(res, () => fn(req.gezinslid, req.body || {}));

  app.post('/api/rtf/baby/boek', gezinsPoort, doe((s) => baby.boekVan(s)));
  app.post('/api/rtf/baby/instellen', gezinsPoort, doe((s, b) => baby.instellen(s, { kindNaam: b.kindNaam, geboren: b.geboren })));
  app.post('/api/rtf/baby/entry-maak', gezinsPoort, doe((s, b) => baby.entryMaak(s, { tekst: b.tekst, foto: b.foto, dag: b.dag })));
  app.post('/api/rtf/baby/entry-weg', gezinsPoort, doe((s, b) => baby.entryWeg(s, String(b.id || ''))));
  app.post('/api/rtf/baby/tijdlijn', gezinsPoort, doe((s) => baby.tijdlijn(s)));
  app.post('/api/rtf/baby/favoriet', gezinsPoort, doe((s, b) => baby.favoriet(s, String(b.id || ''))));
  app.post('/api/rtf/baby/gezin-zet', gezinsPoort, doe((s, b) => baby.gezinZet(s, b.namen)));
  app.post('/api/rtf/baby/moment-ai', gezinsPoort, doe((s) => baby.momentAi(s)));
};
