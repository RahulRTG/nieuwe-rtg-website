/* Rahul kijkt mee (kern/kijken.js) en de foto-bestemmingen.

   Twee dingen:
   - /api/rahul/kijk    een foto plus een vraag; hij vertelt wat hij ziet. De
                        foto wordt niet bewaard, ook hier niet: hij gaat door
                        naar het model en is daarna weg.
   - /api/rahul/plekken waar deze foto naartoe KAN. Dat is bewust een vraag aan
                        de server en geen lijstje in de app: welke bestemmingen
                        er zijn hangt af van de pas, de vriendenlaag en wat er
                        aan staat, en de app hoort dat niet zelf te raden.

   Het versturen zelf gaat via de bestaande routes (verhaal, snap); die kennen
   hun eigen regels en die willen we niet half nabouwen. */
module.exports = (kern) => {
  const { app, express, auth, geenGast, kijk, socialConnecties } = kern;

  app.post('/api/rahul/kijk', express.json({ limit: '2mb' }), auth, async (req, res) => {
    if (geenGast(req, res)) return;
    const r = await kijk(req.body.foto, req.body.vraag);
    if (r.error) return res.status(r.status || 400).json({ error: r.error });
    res.json(r);
  });

  app.post('/api/rahul/plekken', auth, (req, res) => {
    if (geenGast(req, res)) return;
    let vrienden = 0;
    try { vrienden = (socialConnecties(req.session.key) || {}).connections.length; } catch (e) { vrienden = 0; }
    res.json({
      plekken: [
        { id: 'salon', naam: 'De Salon', uitleg: 'Als verhaal, 24 uur zichtbaar voor je connecties.', pad: '/api/member/story/post' },
        ...(vrienden ? [{ id: 'snap', naam: 'Naar een vriend', uitleg: 'Een snap, alleen voor wie je kiest.', pad: '/api/member/snap/send' }] : [])
      ],
      noot: 'Wat je hier deelt, deel je zelf. Rahul plaatst nooit iets uit zichzelf.'
    });
  });
};
