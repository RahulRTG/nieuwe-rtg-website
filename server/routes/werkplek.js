/* Domein "werkplek": de twee huizen van Rahul (RTG en RTF) als werkplek.
   Alles achter de office-deur; daarbinnen beslist de sleutel per huis wie waar
   binnenkomt. De eigenaar mag in beide huizen en is de enige die sleutels
   uitdeelt en weer intrekt. Wie geen sleutel heeft, krijgt niet te horen wat er
   in dat huis speelt: dan is het gewoon dicht. */
module.exports = (kern) => {
  const { app, boardroomWie, boardroomBaas, werkplek } = kern;
  const stuur = (res, r) => r.error ? res.status(r.status || 400).json({ error: r.error }) : res.json(r);
  const veilig = (res, werk) => { try { stuur(res, werk()); } catch (e) { console.error('[werkplek]', e); res.status(500).json({ error: 'Er ging iets mis. Probeer het opnieuw.' }); } };

  /* De werkplek is een eigen deur, geen zijingang van de backoffice: een
     medewerker van RTF heeft juist GEEN kantoorsessie, en zou daar dus blijven
     staan. Het slot is de sleutel per bedrijf. Wie geen token meestuurt heeft
     ook geen sleutel, en komt dus langs dezelfde weg niet binnen. */
  const wie = req => { const key = boardroomWie(req); return { key, baas: boardroomBaas(key) }; };

  /* De deur van een huis: heeft deze bezoeker er een sleutel van? */
  function huisAuth(req, res, next) {
    const { key, baas } = wie(req);
    const code = String((req.body || {}).bedrijf || '').toLowerCase();
    if (!werkplek.kent(code)) return res.status(404).json({ error: 'Dit bedrijf kennen we niet.' });
    if (!werkplek.magIn(code, key, baas)) {
      return res.status(403).json({ error: 'Deze werkplek is niet van u. Vraag de eigenaar om toegang tot dit bedrijf.' });
    }
    req.werkplekCode = code;
    req.werkplekBaas = baas;
    next();
  }
  /* Sleutels uitdelen doet alleen de eigenaar. */
  function baasAuth(req, res, next) {
    if (!wie(req).baas) return res.status(403).json({ error: 'Alleen de eigenaar deelt sleutels uit.' });
    next();
  }

  // welke huizen kan ik binnen? (de kiezer op het startscherm)
  /* Zonder sleutel gaf dit een keurige 200 met een lege lijst. Geen gegevens
     eruit, maar wel de verkeerde vorm: een dichte deur hoort dicht te KLINKEN,
     anders leest een controle die van buitenaf kijkt (scripts/poortwacht.js)
     "open" waar "niets te halen" bedoeld is -- en verdrinkt het echte geval in
     de ruis. */
  app.post('/api/werkplek/mijn', (req, res) => veilig(res, () => {
    const { key, baas } = wie(req);
    if (!key && !baas) return { status: 401, error: 'Log eerst in.' };
    const alles = werkplek.bedrijven();
    const van_mij = werkplek.mijnHuizen(key, baas);
    return { ok: true, baas, bedrijven: alles.bedrijven.filter(b => van_mij.includes(b.code)) };
  }));

  // een huis van binnen
  app.post('/api/werkplek/overzicht', huisAuth, (req, res) => veilig(res, () => werkplek.overzicht(req.werkplekCode)));

  // de bezetting (op codenaam, nooit de echte naam)
  app.post('/api/werkplek/mens', huisAuth, (req, res) => veilig(res, () => werkplek.mensZet(req.werkplekCode, req.body || {})));
  app.post('/api/werkplek/mens-weg', huisAuth, (req, res) => veilig(res, () => werkplek.mensWeg(req.werkplekCode, String(req.body.id || ''))));

  // de takenlijst van het huis
  app.post('/api/werkplek/taak', huisAuth, (req, res) => veilig(res, () => werkplek.taakMaak(req.werkplekCode, req.body.tekst)));
  app.post('/api/werkplek/taak-zet', huisAuth, (req, res) => veilig(res, () => werkplek.taakZet(req.werkplekCode, String(req.body.taakId || ''), req.body.af)));

  // sleutels: alleen de eigenaar
  app.post('/api/werkplek/toegang', baasAuth, (req, res) => veilig(res, () => werkplek.toegangLijst(String(req.body.bedrijf || ''))));
  app.post('/api/werkplek/toegang-geef', baasAuth, (req, res) => veilig(res, () => werkplek.toegangGeef(String(req.body.bedrijf || ''), req.body.key, req.body.naam)));
  app.post('/api/werkplek/toegang-weg', baasAuth, (req, res) => veilig(res, () => werkplek.toegangWeg(String(req.body.bedrijf || ''), req.body.key)));

  /* De ontwerpbureaus van het huis staan in ./werkplek-bureaus, achter dezelfde
     deur. Die krijgt hij hier mee zodat er maar een slot bestaat. */
  require('./werkplek-bureaus')(kern, huisAuth);
};
