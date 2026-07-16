/* Domein "tiener": de toetsplanner en het zakgeldpotje. Alleen via de
   RTFoundation (gezinscode + profieltoken); dit zijn de eigen spullen van het
   profiel, dus gasten (oppas, familie) blijven erbuiten. */
module.exports = (kern) => {
  const { app, rtf, tiener } = kern;

  function gezinslid(req, res) {
    const sess = rtf.verifieerProfiel(req.body.code, req.body.token);
    if (!sess) { res.status(403).json({ error: 'Log opnieuw in bij je gezin.' }); return null; }
    if (sess.gast) { res.status(403).json({ error: 'Dit is van de gezinsleden zelf.' }); return null; }
    return sess;
  }
  const stuur = (res, r) => r.error ? res.status(r.status).json({ error: r.error }) : res.json(r);

  const ACTIES = {
    toetsen: (s) => tiener.toetsen(s),
    'toets-maak': (s, b) => tiener.toetsMaak(s, { vak: b.vak, wat: b.wat, datum: b.datum }),
    'toets-stap': (s, b) => tiener.toetsStap(s, { id: String(b.id || ''), dag: String(b.dag || ''), af: b.af }),
    'toets-weg': (s, b) => tiener.toetsWeg(s, String(b.id || '')),
    potje: (s) => tiener.potje(s),
    boek: (s, b) => tiener.boek(s, { centen: b.centen, wat: b.wat }),
    'doel-maak': (s, b) => tiener.doelMaak(s, { naam: b.naam, doelCenten: b.doelCenten }),
    'doel-inleg': (s, b) => tiener.doelInleg(s, { id: String(b.id || ''), centen: b.centen }),
    'doel-weg': (s, b) => tiener.doelWeg(s, String(b.id || ''))
  };
  // vangnet: Express 4 vangt async-fouten niet zelf (zie routes/spellen.js)
  async function veilig(res, werk) {
    try { stuur(res, await werk()); }
    catch (e) { res.status(500).json({ error: 'Er ging iets mis. Probeer het opnieuw.' }); }
  }
  for (const [naam, doe] of Object.entries(ACTIES)) {
    app.post('/api/rtf/tiener/' + naam, (req, res) => {
      const s = gezinslid(req, res); if (!s) return;
      veilig(res, () => doe(s, req.body || {}));
    });
  }
};
