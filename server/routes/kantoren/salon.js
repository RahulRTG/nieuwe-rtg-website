/* Kantoren, deel "salon": de curatie van De Salon vanuit de boardroom.

   De Salon-feed laat alleen door wat viraal gaat of maatschappelijk belangrijk
   is (kern/salonviraal.js). Viraliteit rekent zichzelf uit; belang niet. Daarvoor
   is er een AI-oordeel, en dat staat met opzet NIET in het leespad: een lezer mag
   nooit op een AI-aanroep wachten. Het draait hier, op een knop, achter de
   boardroom-deur -- een mens geeft de opdracht, de kosten blijven zichtbaar en
   het oordeel is per ronde na te lezen. RTG cureert.

   Zonder AI-sleutel gebeurt hier niets en blijft de heuristiek in salonviraal
   gelden; de feed werkt dan precies zoals nu. */
module.exports = (ctx) => {
  const { app, boardroomAuth, veilig, db, save, kern, afdelingen } = ctx;
  const viraal = require('../../kern/salonviraal');

  const posts = () => (Array.isArray(db.data.posts) ? db.data.posts : []);

  /* De stand van de curatie: hoeveel posts een echt AI-oordeel hebben, hoeveel
     nog op de heuristiek leunen, en wat een ronde zou kosten. Alles op aantallen;
     er komt geen postinhoud of auteur langs deze route. */
  function stand() {
    const eigen = posts().filter(p => p && !p.partner && !p.featured);
    const wachtend = viraal.belangKandidaten(posts());
    const beoordeeld = eigen.filter(p => typeof p.belangrijk === 'boolean');
    return {
      status: 200, ok: true, ai: !!kern.anthropic, max: viraal.BELANG_MAX,
      posts: eigen.length,
      beoordeeld: beoordeeld.length,
      belangrijk: beoordeeld.filter(p => p.belangrijk === true).length,
      wachtend: wachtend.length,
      opHeuristiek: wachtend.filter(p => viraal.isBelangrijk(p)).length,
      ronde: Math.min(wachtend.length, viraal.BELANG_MAX)
    };
  }

  app.post('/api/office/salon/belang', boardroomAuth, (req, res) => veilig(res, stand));

  app.post('/api/office/salon/belang/beoordeel', boardroomAuth, async (req, res) => {
    if (!kern.anthropic) return res.status(503).json({ error: 'Er staat geen AI-sleutel; de heuristiek doet het werk.' });
    try {
      const r = await viraal.beoordeelBelang(kern.anthropic, posts());
      if (r.gezet) {
        save();
        afdelingen.audit(req.boardroomBaas ? 'eigenaar' : 'boardroom',
          'Salon-curatie: ' + r.gezet + ' post(en) beoordeeld, ' + r.belangrijk + ' als maatschappelijk belangrijk.');
      }
      res.json({ ok: true, ...r, stand: stand() });
    } catch (e) { console.error('[salon-curatie]', e); res.status(500).json({ error: 'Er ging iets mis. Probeer het opnieuw.' }); }
  });
};
