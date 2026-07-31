/* Routes "ik": wie ben ik voor Rahul.

   Alles hier is van het lid zelf, alles is optioneel, en alles is weer weg te
   halen. Er staat met opzet geen enkel verplicht veld in: wie niets invult
   krijgt precies dezelfde Rahul als wie alles invult, alleen zonder de dingen
   die je zonder invulling niet kunt weten.

   Dat is ook de reden dat dit los staat van het paspoortgedeelte. Wat er in
   je paspoort staat en hoe je genoemd wilt worden zijn twee verschillende
   dingen, en het tweede telt hier. */
const { coord } = require('../kern/util');
module.exports = (kern) => {
  const { app, auth, schoon, accounts, geloof } = kern;

  const uid = (req) => (req.session && req.session.account) ? req.session.account.id : null;
  const uit = (res, r) => res.status(r.status || 200).json(r.error ? { error: r.error } : r);
  const OMGANG = ['maatje', 'plagerig', 'zakelijk', 'rustig'];
  const fases = require('../kern/rahul-fases');
  // de leeftijd uit het profiel; bepaalt welke fases gekozen mogen worden
  function leeftijdVan(md) {
    if (!md || !md.geboren) return null;
    const g = new Date(md.geboren), nu = new Date();
    let l = nu.getFullYear() - g.getFullYear();
    if (nu < new Date(nu.getFullYear(), g.getMonth(), g.getDate())) l -= 1;
    return l;
  }
  const FASE_NAMEN = {
    kind: ['Kind', 'Rahul is je grote broer: lief, geduldig en beschermend.'],
    scholier: ['Middelbare school', 'Los en beschermend; ruimte om te experimenteren, plus rust en planning.'],
    student: ['Student of net begonnen', 'Studie, rondkomen, balans, en ruimte om dingen mee te maken.'],
    volwassen: ['Midden in het leven', 'Werk, huishouden, gezin, sparen, en af en toe quality time.'],
    senior: ['Opa of oma', 'Alle tijd, gewone woorden, en een luisterend oor.']
  };

  function beeld(id) {
    const md = (id != null && accounts.getMemberState(id)) || {};
    const lft = leeftijdVan(md);
    const jong = lft == null || lft < 18;
    const mag = jong ? fases.JEUGD_FASES : fases.VOLWASSEN_FASES;
    const fase = fases.faseVoor(lft, md.fase);
    return {
      fase,
      faseKeuzes: mag.map(f => ({ id: f, naam: FASE_NAMEN[f][0], uitleg: FASE_NAMEN[f][1] })),
      // staat de geboortedatum niet in het paspoort, dan zeggen we waarom de
      // lijst kort is; anders lijkt het een fout in plaats van een grens
      leeftijdBekend: lft != null,
      omgang: OMGANG.includes(md.omgang) ? md.omgang : 'maatje',
      voornaamwoord: md.voornaamwoord || '',
      aanhef: md.aanhef || '',
      geloof: geloof.profielVan(id),
      keuzes: {
        /* De plagerige stand staat er alleen als hij ook echt kan. Bij een
           jeugdfase negeert kern/rahul-omgang.js hem toch, en een knop die
           niets doet is erger dan geen knop. */
        omgang: [
          { id: 'maatje', naam: 'Maatje', uitleg: 'Warm, loyaal, recht voor zijn raap. De standaard.' },
          ...(fases.isJeugd(fase) || jong ? [] : [
            { id: 'plagerig', naam: 'Plagerig', uitleg: 'Brutaal, gevat, licht rebels. Alleen als u dat zelf wilt, en alleen vanaf 18 jaar.' }]),
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
    /* De fase mag het lid zelf zetten, maar faseVoor() bewaakt de grens: een
       minderjarige kan alleen kind of scholier kiezen. Anders zou iemand van
       veertien zichzelf tot volwassene kunnen verklaren, en daarmee ook
       verschuiven wat Rahul bespreekbaar vindt. */
    if ('fase' in req.body) {
      const gekozen = fases.faseVoor(leeftijdVan(md), req.body.fase);
      if (gekozen) md.fase = gekozen;
    }
    /* De plagerige stand wordt bij een minderjarige niet eens OPGESLAGEN.
       Hij zou toch genegeerd worden (kern/rahul-omgang.js kijkt naar de
       leeftijd), maar dan staat hij er wel, en op de dag dat iemand achttien
       wordt zou de toon vanzelf omslaan zonder dat die persoon daar als
       volwassene voor koos. Dus: hier al weigeren. */
    if ('omgang' in req.body) {
      const gevraagd = OMGANG.includes(req.body.omgang) ? req.body.omgang : 'maatje';
      const lft = leeftijdVan(md);
      md.omgang = (gevraagd === 'plagerig' && (lft == null || lft < 18)) ? 'maatje' : gevraagd;
    }
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
    const lat = coord(req.body.lat, 90), lon = coord(req.body.lon, 180);
    const plek = (Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180)
      ? { lat, lon } : null;
    const d = geloof.vandaagVoor(id, plek);
    res.json({ ...d, plekNodig: !plek, tijdzoneNoot: 'Tijden staan in UTC; het scherm rekent ze om naar uw eigen tijd.' });
  });

  /* De stemming van Rahul. Iedereen mag zien hoe hij erbij zit; dat hoort bij
     iemand die een bui heeft. Alleen de boardroom mag hem vastzetten. */
  app.post('/api/rahul/stemming', auth, (req, res) => res.json({ stemming: kern.stemmingToon() }));
};
