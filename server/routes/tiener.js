/* Domein "tiener": de toetsplanner en het zakgeldpotje. Alleen via de
   RTFoundation (gezinscode + profieltoken); dit zijn de eigen spullen van het
   profiel, dus gasten (oppas, familie) blijven erbuiten. */
module.exports = (kern) => {
  const { app, rtf, tiener } = kern;

  /* De poort als ECHTE MIDDLEWARE en niet als aanroep binnenin. Zo staat bij
     elke route zichtbaar WELKE deur hij heeft -- voor een lezer en voor
     scripts/check.js regel 28, die het venster na de route leest en een poort
     in een wrapper dus niet ziet. De sessie reist mee op req. */
  function gezinsPoort(req, res, next) {
    const sess = rtf.verifieerProfiel(req.body.code, req.body.token);
    if (!sess) return res.status(403).json({ error: 'Log opnieuw in bij je gezin.' });
    if (sess.gast) return res.status(403).json({ error: 'Dit is van de gezinsleden zelf.' });
    req.gezinslid = sess;
    next();
  }
  const stuur = (res, r) => r.error ? res.status(r.status).json({ error: r.error }) : res.json(r);

  // vangnet: Express 4 vangt async-fouten niet zelf (zie routes/spellen.js)
  async function veilig(res, werk) {
    try { stuur(res, await werk()); }
    catch (e) { res.status(500).json({ error: 'Er ging iets mis. Probeer het opnieuw.' }); }
  }

  /* Hier stond een lus over een actie-tabel met het pad opgebouwd als
     '/api/rtf/tiener/' + naam. Voor scripts/schakelbaar.js bestonden deze
     routes daardoor niet: niet uit te zetten en niet per stad te sluiten
     (scripts/check.js regel 45). De poort (geen gasten) en het vangnet staan
     nog op EEN plek; alleen de registratie is uitgeschreven. */
  const doe = (fn) => (req, res) => veilig(res, () => fn(req.gezinslid, req.body || {}));

  app.post('/api/rtf/tiener/toetsen', gezinsPoort, doe((s) => tiener.toetsen(s)));
  app.post('/api/rtf/tiener/toets-maak', gezinsPoort, doe((s, b) => tiener.toetsMaak(s, { vak: b.vak, wat: b.wat, datum: b.datum })));
  app.post('/api/rtf/tiener/toets-stap', gezinsPoort, doe((s, b) => tiener.toetsStap(s, { id: String(b.id || ''), dag: String(b.dag || ''), af: b.af })));
  app.post('/api/rtf/tiener/toets-weg', gezinsPoort, doe((s, b) => tiener.toetsWeg(s, String(b.id || ''))));
  app.post('/api/rtf/tiener/potje', gezinsPoort, doe((s) => tiener.potje(s)));
  app.post('/api/rtf/tiener/boek', gezinsPoort, doe((s, b) => tiener.boek(s, { centen: b.centen, wat: b.wat })));
  app.post('/api/rtf/tiener/doel-maak', gezinsPoort, doe((s, b) => tiener.doelMaak(s, { naam: b.naam, doelCenten: b.doelCenten })));
  app.post('/api/rtf/tiener/doel-inleg', gezinsPoort, doe((s, b) => tiener.doelInleg(s, { id: String(b.id || ''), centen: b.centen })));
  app.post('/api/rtf/tiener/doel-weg', gezinsPoort, doe((s, b) => tiener.doelWeg(s, String(b.id || ''))));
};
