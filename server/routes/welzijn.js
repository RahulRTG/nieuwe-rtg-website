/* Domein "welzijn": het gevoelsdagboek. Alleen via de RTFoundation
   (gezinscode + profieltoken), en STRIKT van het profiel zelf: gasten
   blijven erbuiten, en er bestaat bewust geen route waarmee een ander
   gezinslid het dagboek van een kind kan lezen. */
module.exports = (kern) => {
  const { app, rtf, welzijn } = kern;

  /* De poort als ECHTE MIDDLEWARE en niet als aanroep binnenin. Zo staat bij
     elke route zichtbaar WELKE deur hij heeft -- voor een lezer en voor
     scripts/check.js regel 28, die het venster na de route leest en een poort
     in een wrapper dus niet ziet. De sessie reist mee op req. */
  function gezinsPoort(req, res, next) {
    const sess = rtf.verifieerProfiel(req.body.code, req.body.token);
    if (!sess) return res.status(403).json({ error: 'Log opnieuw in bij je gezin.' });
    if (sess.gast) return res.status(403).json({ error: 'Het gevoelsdagboek is van de gezinsleden zelf.' });
    req.gezinslid = sess;
    next();
  }
  const stuur = (res, r) => r.error ? res.status(r.status).json({ error: r.error }) : res.json(r);

  // vangnet: Express 4 vangt async-fouten niet zelf (zie routes/spellen.js)
  async function veilig(res, werk) {
    try { stuur(res, await werk()); }
    catch (e) { res.status(500).json({ error: 'Er ging iets mis. Probeer het opnieuw.' }); }
  }

  /* Voluit, want een opgebouwd pad ziet de schakelkast niet (scripts/check.js
     regel 45). De poort blijft op EEN plek staan -- en die poort is hier het
     hele punt: het dagboek is van het profiel zelf, gasten blijven erbuiten,
     en er bestaat bewust geen route waarmee een ander gezinslid meeleest. */
  const doe = (fn) => (req, res) => veilig(res, () => fn(req.gezinslid, req.body || {}));

  app.post('/api/rtf/welzijn/dagboek', gezinsPoort, doe((s) => welzijn.dagboek(s)));
  app.post('/api/rtf/welzijn/stemming', gezinsPoort, doe((s, b) => welzijn.stemming(s, { gevoel: b.gevoel, notitie: b.notitie })));
};
