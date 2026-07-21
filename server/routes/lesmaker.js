/* Domein "lesmaker": de leraar maakt met AI lesstof (uit elk onderwerp of
   een app uit de bibliotheken) en zet die live op de klas-PDA; de kinderen
   doen mee met een klascode + voornaam. Bewust zonder zware inlog (zoals
   een quizbord in de klas): de leraarsleutel beschermt de regie, kinderen
   kunnen alleen antwoorden. Een lichte uurgrens remt misbruik. */
module.exports = (kern) => {
  const { app, lesmaker, schoolbieb, appbieb, reisbieb } = kern;
  const stuur = (res, r) => { const { status, ...rest } = r; res.status(status || 200).json(rest); };

  const maakTellers = new Map(); // ip -> [timestamps]
  app.post('/api/les/maak', async (req, res) => {
    const ip = String(req.ip || req.headers['x-forwarded-for'] || 'x');
    const t = Date.now();
    const rij = (maakTellers.get(ip) || []).filter(x => t - x < 3600000);
    if (rij.length >= 20) return res.status(429).json({ error: 'Rustig aan: maximaal twintig lessen per uur.' });
    rij.push(t); maakTellers.set(ip, rij);
    if (maakTellers.size > 5000) maakTellers.delete(maakTellers.keys().next().value);
    stuur(res, await lesmaker.maakLes(req.body || {}));
  });

  // de leraar zoekt een app om de les aan op te hangen: dwars door de
  // School-, App- en Reis-Bibliotheek heen, de beste treffers eerst
  app.post('/api/les/apps', (req, res) => {
    const zoek = String((req.body || {}).zoek || '').slice(0, 60);
    const groep = ['mini', 'kind', 'tiener', 'jong', 'volw'].includes((req.body || {}).niveau) ? req.body.niveau : 'kind';
    if (!zoek.trim()) return res.json({ apps: [] });
    const uit = [];
    try { for (const a of schoolbieb.catalogus(groep, { zoek, per: 4 }).items || []) uit.push({ naam: a.naam, bieb: 'School-Bibliotheek' }); } catch (e) {}
    try { for (const a of appbieb.catalogus({ zoek, per: 4 }).items || []) uit.push({ naam: a.naam, bieb: 'App-Bibliotheek' }); } catch (e) {}
    try { for (const a of reisbieb.catalogus({ zoek, per: 4 }).items || []) uit.push({ naam: a.naam, bieb: 'Reis-Bibliotheek' }); } catch (e) {}
    res.json({ apps: uit.slice(0, 10) });
  });

  // de regie van de leraar
  app.post('/api/les/leraar', (req, res) => stuur(res, lesmaker.leraar(req.body.code, req.body.leraarToken)));
  app.post('/api/les/volgende', (req, res) => stuur(res, lesmaker.volgende(req.body.code, req.body.leraarToken)));
  app.post('/api/les/sluit', (req, res) => stuur(res, lesmaker.sluit(req.body.code, req.body.leraarToken)));

  // de klas-PDA van de kinderen
  app.post('/api/les/mee', (req, res) => stuur(res, lesmaker.doeMee(req.body.code, req.body.naam)));
  app.post('/api/les/kijk', (req, res) => stuur(res, lesmaker.kijk(req.body.code, req.body.naam, req.body.deelnemerToken)));
  app.post('/api/les/antwoord', (req, res) => stuur(res, lesmaker.antwoord(req.body.code, req.body.naam, req.body.deelnemerToken, req.body.keuze)));
};
