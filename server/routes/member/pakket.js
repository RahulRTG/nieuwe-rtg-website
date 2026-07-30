/* Domein "member", deelmodule pakket: de RTG Bedrijfspakketten. Een lid dat
   onderneemt kiest zijn bedrijfstype en krijgt de juiste indeling voor zijn
   zaak (werkplekken, werk-apps, technieken, 3D-plattegrond en een passend
   gehuurd kantoor). De interne RTG-kantoorfuncties blijven bedrijfsgeheim
   (zie kern/pakketten.js). Alleen routes; de catalogus woont in de kern. */
module.exports = (kern) => {
  const { app, auth, anthropic } = kern;
  const { maakPakketten } = require('../../kern/pakketten');
  const pak = maakPakketten({ anthropic });

  // de bedrijfstypen om uit te kiezen
  app.post('/api/pakket/typen', auth, (req, res) => res.json({ typen: pak.typenLijst() }));

  // het volledige advies voor één bedrijfstype; met 'situatie' kleurt Rahul
  // het (als er een AI-sleutel is) op maat bij
  app.post('/api/pakket/advies', auth, async (req, res) => {
    const id = String((req.body && req.body.type) || '').trim();
    const situatie = (req.body && req.body.situatie) || '';
    const a = situatie ? await pak.adviesAI(id, situatie) : pak.advies(id);
    if (!a) return res.status(404).json({ error: 'Onbekend bedrijfstype.' });
    res.json({ advies: a });
  });
};
