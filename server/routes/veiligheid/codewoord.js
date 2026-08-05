/* Routes van het codewoord.

   Let op het antwoord van /api/veiligheid/codewoord/check: dat is ALTIJD
   `{ ok: true }`, of de zin nu raak was of niet. Dat is geen slordigheid maar
   de functie zelf. Zou de server "geraakt: ja" terugsturen, dan zou de app
   dat kunnen tonen, en dan zou degene die over je schouder meekijkt het zien.
   Bovendien zou een verschil in antwoord (of in reactietijd) verraden dat er
   een codewoord bestaat. Buiten deze deur is er geen verschil te zien.

   De echte controle zit niet alleen hier: de gewone Rahul-route roept
   dezelfde controle aan bij elk bericht (zie server.js), zodat je je zin
   gewoon in een gesprek kunt laten vallen zonder deze app te openen. */
module.exports = (kern) => {
  const { app, auth } = kern;

  // De vriendenlaag (en dus de kring) draait op de sessiesleutel; de codenaam
  // is alleen wat mensen te zien krijgen. Die twee niet verwarren.
  const mij = (req) => req.session.key;
  const uit = (res, r) => res.status(r.status || 200).json(r.error ? { error: r.error } : r);

  app.post('/api/veiligheid/codewoord', auth, (req, res) => {
    const h = mij(req);
    if (!h) return res.status(403).json({ error: 'Log eerst in.' });
    res.json({ stand: kern.codewoordStand(h) });
  });

  app.post('/api/veiligheid/codewoord/zet', auth, (req, res) => {
    const h = mij(req);
    if (!h) return res.status(403).json({ error: 'Log eerst in.' });
    uit(res, kern.codewoordZetten(h, req.body.zin));
  });

  app.post('/api/veiligheid/codewoord/schakel', auth, (req, res) => {
    const h = mij(req);
    if (!h) return res.status(403).json({ error: 'Log eerst in.' });
    uit(res, kern.codewoordSchakel(h, req.body.aan !== false));
  });

  app.post('/api/veiligheid/codewoord/wis', auth, (req, res) => {
    const h = mij(req);
    if (!h) return res.status(403).json({ error: 'Log eerst in.' });
    uit(res, kern.codewoordWissen(h));
  });

  // Zie de kop: het antwoord verraadt nooit of het raak was.
  app.post('/api/veiligheid/codewoord/check', auth, (req, res) => {
    const h = mij(req);
    if (!h) return res.status(403).json({ error: 'Log eerst in.' });
    try { kern.codewoordCheck(h, req.body.tekst, 'app'); } catch (e) { /* stil */ }
    res.json({ ok: true });
  });

  /* Oefenen zonder alarm: hier hoor je wel of je zin klopt, maar er wordt
     niemand gewaarschuwd. De enige plek die eerlijk ja of nee zegt, en hij
     zit achter een aparte oefenknop: je oefent als je alleen bent. */
  app.post('/api/veiligheid/codewoord/proef', auth, (req, res) => {
    const h = mij(req);
    if (!h) return res.status(403).json({ error: 'Log eerst in.' });
    if (!kern.codewoordStand(h).ingesteld) return res.status(404).json({ error: 'Er is nog geen codewoord ingesteld.' });
    res.json({ ok: true, raak: kern.codewoordProef(h, req.body.tekst) === true });
  });
};
