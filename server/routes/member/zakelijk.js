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
            'Aftrekregels daar: horeca: ' + L.zakelijk.horeca + ' logies: ' + L.zakelijk.logies + ' vervoer: ' + L.zakelijk.vervoer + ' jet: ' + L.zakelijk.jet + ' ' +
            'Voor zelfstandigen geldt daar het regime ' + ZZP[landCode].regime + ': ' + ZZP[landCode].regels.join(' ') + ' Er is een zzp-rekentool in de app voor een indicatie van belasting en nettowinst. ' +
            'Uitgaven via RTG: horeca € ' + horeca + ', vervoer € ' + vervoer + '. Facturen staan boekhoudklaar in het portaal met afboekcode en btw-specificatie. ' +
            'Antwoord in het Nederlands, maximaal 120 woorden, praktisch. Sluit af met: dit is voorlichting, geen bindend fiscaal advies.',
          messages: [{ role: 'user', content: vraag }]
        });
        answer = msg.content[0].text;
      } catch (err) { answer = null; }
    }
    if (!answer) {
      const v = vraag.toLowerCase();
      if (/zzp|zelfstandig|eenmanszaak|freelan|kor\b|urencriterium|autonomo|micro-?entre|freiberuf/.test(v))
        answer = 'Voor zelfstandigen in ' + L.naam + ' (' + ZZP[landCode].regime + '): ' + ZZP[landCode].regels.join(' ') + ' Gebruik de zzp-rekentool hieronder voor een indicatie van uw belasting, nettowinst en hoeveel u maandelijks opzij zet.';
      else if (/hotel|overnacht|logies|slapen/.test(v)) answer = L.naam + ': ' + L.zakelijk.logies;
      else if (/taxi|vervoer|rit|jet|vlieg/.test(v)) answer = L.naam + ': ' + L.zakelijk.vervoer + ' ' + L.zakelijk.jet + ' Via RTG gaf u € ' + vervoer + ' uit aan vervoer.';
      else if (/eten|diner|restaurant|horeca|lunch|terugvorder|aftrek|btw/.test(v)) answer = L.naam + ': ' + L.zakelijk.horeca + ' Via RTG gaf u € ' + horeca + ' uit in de horeca. Uw facturen staan boekhoudklaar in het portaal, met afboekcode en btw-specificatie.';
      else answer = 'Voor ' + L.naam + ' geldt: ' + L.zakelijk.horeca + ' ' + L.zakelijk.logies + ' ' + L.zakelijk.vervoer + ' Vraag me gerust naar een specifieke uitgave.';
      answer += ' Dit is voorlichting, geen bindend fiscaal advies.';
    }
    res.json({ answer, land: landCode, landen: Object.entries(LANDEN).map(([k, v2]) => ({ code: k, naam: v2.naam })), ai: !!anthropic });
  });
};
