/* Domein "baby": het fotoboekje van de allerkleinsten. Alleen via de
   RTFoundation (gezinscode + profieltoken); dit is het privealbum van het
   gezin, dus gasten (oppas, familie) komen er niet in. */
module.exports = (kern) => {
  const { app, rtf, baby } = kern;

  function gezinslid(req, res) {
    const sess = rtf.verifieerProfiel(req.body.code, req.body.token);
    if (!sess) { res.status(403).json({ error: 'Log opnieuw in bij je gezin.' }); return null; }
    if (sess.gast) { res.status(403).json({ error: 'Het fotoboekje is van het gezin zelf.' }); return null; }
    return sess;
  }
  const stuur = (res, r) => r.error ? res.status(r.status).json({ error: r.error }) : res.json(r);

  const ACTIES = {
    boek: (s) => baby.boekVan(s),
    instellen: (s, b) => baby.instellen(s, { kindNaam: b.kindNaam, geboren: b.geboren }),
    'entry-maak': (s, b) => baby.entryMaak(s, { tekst: b.tekst, foto: b.foto }),
    'entry-weg': (s, b) => baby.entryWeg(s, String(b.id || '')),
    'gezin-zet': (s, b) => baby.gezinZet(s, b.namen),
    'moment-ai': (s) => baby.momentAi(s)
  };
  // vangnet: Express 4 vangt async-fouten niet zelf (zie routes/spellen.js)
  async function veilig(res, werk) {
    try { stuur(res, await werk()); }
    catch (e) { res.status(500).json({ error: 'Er ging iets mis. Probeer het opnieuw.' }); }
  }
  for (const [naam, doe] of Object.entries(ACTIES)) {
    app.post('/api/rtf/baby/' + naam, (req, res) => {
      const s = gezinslid(req, res); if (!s) return;
      veilig(res, () => doe(s, req.body || {}));
    });
  }
};
