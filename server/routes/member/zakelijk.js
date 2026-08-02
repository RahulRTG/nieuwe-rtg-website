/* Member-submodule: de zakelijke tools van de Business Pass. De zzp-
   belastingtool (zelfde berekening als de zaak-kant, kern/fiscaal.js) en de
   AI-boekhouder per land. Gemount vanuit routes/member.js. */
module.exports = (kern) => {
  const { app, auth, db, LANDEN, ZZP, anthropic, ordersVanKlant } = kern;

  app.post('/api/member/zzp', auth, (req, res) => {
    if (req.session.tier !== 'business') return res.status(403).json({ error: 'De zzp-belastingtool is onderdeel van de Business Pass.' });
    // dezelfde berekening als de belastingtool van elke zaak (kern/fiscaal.js)
    const out = require('../../kern/fiscaal').zzpBerekening(req.body.land, req.body.winst,
      { urencriterium: req.body.urencriterium, starter: req.body.starter });
    if (out.error) return res.status(out.status || 400).json({ error: 'Vul uw verwachte jaarwinst in.' });
    res.json(out);
  });

  app.post('/api/member/accountant', auth, async (req, res) => {
    if (req.session.tier !== 'business') return res.status(403).json({ error: 'De AI-boekhouder is onderdeel van de Business Pass.' });
    const landCode = LANDEN[req.body.land] ? req.body.land : 'NL';
    const L = LANDEN[landCode];
    /* De rijke kernlanden dragen uitgeschreven aftrekregels; de wereldtabel
       geeft een eerlijke indicatie op de eigen tarieven van dat land. */
    const zak = L.zakelijk || {
      horeca: 'Indicatie (wereldtabel): horeca valt op ' + L.tarieven.eten + '% btw; of die aftrekbaar is verschilt per land -- bewaar volledige facturen op bedrijfsnaam.',
      logies: 'Indicatie (wereldtabel): logies valt op ' + L.tarieven.logies + '%; zakelijke overnachtingen zijn doorgaans aftrekbaar met factuur.',
      vervoer: 'Indicatie (wereldtabel): personenvervoer valt op ' + L.tarieven.vervoer + '%.',
      jet: 'Internationaal personenvervoer valt vrijwel overal onder het 0%-tarief.'
    };
    const zzpR = ZZP[landCode] || { regime: 'Zelfstandige (wereldtabel, indicatie)',
      regels: ['Het echte regime van ' + L.naam + ' kent eigen drempels en aftrekposten; de zzp-rekentool geeft een indicatie en de Regelwacht houdt de tarieven automatisch bij.'] };
    const vraag = String(req.body.question || '').trim().slice(0, 400);
    if (!vraag) return res.status(400).json({ error: 'Stel een vraag.' });
    const key = req.session.key;
    const horeca = ordersVanKlant(key).filter(o => o.paid).reduce((x, o) => x + o.total, 0);
    const vervoer = db.data.rides.filter(r => (r.customerKey || r.customerTier) === key && r.paid).reduce((x, r) => x + (r.quote || 0), 0);
    let answer = null;
    if (anthropic) {
      try {
        const msg = await anthropic.messages.create({
          model: 'claude-sonnet-5', max_tokens: 450,
          system: 'Je bent de AI-boekhouder van de RTG Business Pass. Het lid reist zakelijk; het gekozen land is ' + L.naam + '. ' +
            'Aftrekregels daar: horeca: ' + zak.horeca + ' logies: ' + zak.logies + ' vervoer: ' + zak.vervoer + ' jet: ' + zak.jet + ' ' +
            'Voor zelfstandigen geldt daar het regime ' + zzpR.regime + ': ' + zzpR.regels.join(' ') + ' Er is een zzp-rekentool in de app voor een indicatie van belasting en nettowinst. ' +
            'Uitgaven via RTG: horeca € ' + horeca + ', vervoer € ' + vervoer + '. Facturen staan boekhoudklaar in het portaal met afboekcode en btw-specificatie. ' +
            'Antwoord in het Nederlands, maximaal 120 woorden, praktisch, in de u-vorm. ' +
            'Beloof nooit iets namens RTG: geen toegang tot een pas of dienst, geen goedkeuring, en bevestig ' +
            'nooit dat iets al geboekt of verwerkt is. Sluit af met: dit is voorlichting, geen bindend fiscaal advies.',
          messages: [{ role: 'user', content: vraag }]
        });
        answer = msg.content[0].text;
      } catch (err) { answer = null; }
    }
    if (!answer) {
      const v = vraag.toLowerCase();
      if (/zzp|zelfstandig|eenmanszaak|freelan|kor\b|urencriterium|autonomo|micro-?entre|freiberuf/.test(v))
        answer = 'Voor zelfstandigen in ' + L.naam + ' (' + zzpR.regime + '): ' + zzpR.regels.join(' ') + ' Gebruik de zzp-rekentool hieronder voor een indicatie van uw belasting, nettowinst en hoeveel u maandelijks opzij zet.';
      else if (/hotel|overnacht|logies|slapen/.test(v)) answer = L.naam + ': ' + zak.logies;
      else if (/taxi|vervoer|rit|jet|vlieg/.test(v)) answer = L.naam + ': ' + zak.vervoer + ' ' + zak.jet + ' Via RTG gaf u € ' + vervoer + ' uit aan vervoer.';
      else if (/eten|diner|restaurant|horeca|lunch|terugvorder|aftrek|btw/.test(v)) answer = L.naam + ': ' + zak.horeca + ' Via RTG gaf u € ' + horeca + ' uit in de horeca. Uw facturen staan boekhoudklaar in het portaal, met afboekcode en btw-specificatie.';
      else answer = 'Voor ' + L.naam + ' geldt: ' + zak.horeca + ' ' + zak.logies + ' ' + zak.vervoer + ' Vraag me gerust naar een specifieke uitgave.';
      answer += ' Dit is voorlichting, geen bindend fiscaal advies.';
    }
    res.json({ answer, land: landCode, landen: Object.entries(LANDEN).map(([k, v2]) => ({ code: k, naam: v2.naam })).sort((a, b) => a.naam.localeCompare(b.naam)), ai: !!anthropic });
  });
};
