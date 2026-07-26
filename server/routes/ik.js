/* Routes "ik": wie ben ik voor Rahul.

   Alles hier is van het lid zelf, alles is optioneel, en alles is weer weg te
   halen. Er staat met opzet geen enkel verplicht veld in: wie niets invult
   krijgt precies dezelfde Rahul als wie alles invult, alleen zonder de dingen
   die je zonder invulling niet kunt weten.

   Dat is ook de reden dat dit los staat van het paspoortgedeelte. Wat er in
   je paspoort staat en hoe je genoemd wilt worden zijn twee verschillende
   dingen, en het tweede telt hier. */
module.exports = (kern) => {
  const { app, auth, schoon, accounts, geloof } = kern;

  const uid = (req) => (req.session && req.session.account) ? req.session.account.id : null;
  const uit = (res, r) => res.status(r.status || 200).json(r.error ? { error: r.error } : r);
  const OMGANG = ['maatje', 'plagerig', 'zakelijk', 'rustig'];

  function beeld(id) {
    const md = (id != null && accounts.getMemberState(id)) || {};
    return {
      omgang: OMGANG.includes(md.omgang) ? md.omgang : 'maatje',
      voornaamwoord: md.voornaamwoord || '',
      aanhef: md.aanhef || '',
      geloof: geloof.profielVan(id),
      keuzes: {
        omgang: [
          { id: 'maatje', naam: 'Maatje', uitleg: 'Warm, loyaal, recht voor zijn raap. De standaard.' },
          { id: 'plagerig', naam: 'Plagerig', uitleg: 'Brutaal, gevat, licht rebels. Alleen als u dat zelf wilt, en alleen vanaf 18 jaar.' },
          { id: 'zakelijk', naam: 'Zakelijk', uitleg: 'Antwoord, klaar. Geen gezelligheid vooraf.' },
          { id: 'rustig', naam: 'Rustig', uitleg: 'Kalm tempo, weinig prikkels, geen aandrang.' }
        ],
        geloof: geloof.KEUZES,
        methodes: Object.entries(geloof.tijden.METHODES).map(([id, m]) => ({ id, naam: m.naam }))
      }
    };
  }

  app.post('/api/ik', auth, (req, res) => {
    const id = uid(req);
    if (id == null) return res.status(403).json({ error: 'Alleen voor leden met een eigen account.' });
    res.json(beeld(id));
  });

  app.post('/api/ik/zet', auth, (req, res) => {
    const id = uid(req);
    if (id == null) return res.status(403).json({ error: 'Alleen voor leden met een eigen account.' });
    const md = accounts.getMemberState(id) || {};
    if ('omgang' in req.body) md.omgang = OMGANG.includes(req.body.omgang) ? req.body.omgang : 'maatje';
    // Vrij tekstveld, met opzet: er bestaat geen lijst met alle juiste
    // voornaamwoorden, en een keuzelijst sluit altijd iemand uit.
    if ('voornaamwoord' in req.body) md.voornaamwoord = schoon(req.body.voornaamwoord, 40);
    if ('aanhef' in req.body) md.aanhef = schoon(req.body.aanhef, 40);
    accounts.saveMemberState(id, md);
    res.json(beeld(id));
  });

  app.post('/api/ik/geloof', auth, (req, res) => {
    const id = uid(req);
    if (id == null) return res.status(403).json({ error: 'Alleen voor leden met een eigen account.' });
    const r = geloof.profielZet(id, req.body || {});
    if (r.error) return uit(res, r);
    res.json(beeld(id));
  });

  /* Wat er vandaag speelt: feestdagen, gebedstijden en de richting van Mekka.
     De plek komt uit het verzoek en wordt NIET bewaard; hij is alleen nodig om
     de zonnestand uit te rekenen. Zonder plek geen tijden, en dat zeggen we. */
  app.post('/api/ik/vandaag', auth, (req, res) => {
    const id = uid(req);
    if (id == null) return res.status(403).json({ error: 'Alleen voor leden met een eigen account.' });
    const lat = Number(req.body.lat), lon = Number(req.body.lon);
    const plek = (Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180)
      ? { lat, lon } : null;
    const d = geloof.vandaagVoor(id, plek);
    res.json({ ...d, plekNodig: !plek, tijdzoneNoot: 'Tijden staan in UTC; het scherm rekent ze om naar uw eigen tijd.' });
  });

  /* De stemming van Rahul. Iedereen mag zien hoe hij erbij zit; dat hoort bij
     iemand die een bui heeft. Alleen de boardroom mag hem vastzetten. */
  app.post('/api/rahul/stemming', auth, (req, res) => res.json({ stemming: kern.stemmingToon() }));
};
