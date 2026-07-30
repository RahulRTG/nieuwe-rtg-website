/* Domein "welzijn": het gevoelsdagboek. Alleen via de RTFoundation
   (gezinscode + profieltoken), en STRIKT van het profiel zelf: gasten
   blijven erbuiten, en er bestaat bewust geen route waarmee een ander
   gezinslid het dagboek van een kind kan lezen. */
module.exports = (kern) => {
  const { app, rtf, welzijn } = kern;

  function gezinslid(req, res) {
    const sess = rtf.verifieerProfiel(req.body.code, req.body.token);
    if (!sess) { res.status(403).json({ error: 'Log opnieuw in bij je gezin.' }); return null; }
    if (sess.gast) { res.status(403).json({ error: 'Het gevoelsdagboek is van de gezinsleden zelf.' }); return null; }
    return sess;
  }
  const stuur = (res, r) => r.error ? res.status(r.status).json({ error: r.error }) : res.json(r);

  const ACTIES = {
    dagboek: (s) => welzijn.dagboek(s),
    stemming: (s, b) => welzijn.stemming(s, { gevoel: b.gevoel, notitie: b.notitie })
  };
  // vangnet: Express 4 vangt async-fouten niet zelf (zie routes/spellen.js)
  async function veilig(res, werk) {
    try { stuur(res, await werk()); }
    catch (e) { res.status(500).json({ error: 'Er ging iets mis. Probeer het opnieuw.' }); }
  }
  for (const [naam, doe] of Object.entries(ACTIES)) {
    app.post('/api/rtf/welzijn/' + naam, (req, res) => {
      const s = gezinslid(req, res); if (!s) return;
      veilig(res, () => doe(s, req.body || {}));
    });
  }
};
