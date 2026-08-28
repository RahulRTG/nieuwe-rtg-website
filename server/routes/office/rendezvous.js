/* Backoffice (deelmodule): THE TABLE samenstellen.

   Zes of acht leden aan een tafel die iets aan elkaar hebben. Curatie is
   mensenwerk, dus dit is de enige plek waar een tafel ontstaat -- de leden zien
   alleen hun eigen uitnodiging, nooit wie er nog meer komt
   (kern/rendezvous-tafels.js).

   OP CODENAAM. Het kantoor tikt codenamen in en krijgt codenamen terug. Wie de
   echte naam nodig heeft, gaat langs de kluis met een reden, en dat komt in het
   inzagejournaal. Gemount vanuit routes/office.js. */
module.exports = (octx) => {
  const { kern } = octx;
  const { app, officeAuth, keyVanCodenaam, rvTafelMaak, rvTafelNodig, rvTafelKantoor } = kern;
  const stuur = (res, r) => r && r.error ? res.status(r.status || 400).json({ error: r.error }) : res.json(r);

  app.post('/api/office/rendezvous/tafels', officeAuth, (req, res) => stuur(res, rvTafelKantoor()));

  app.post('/api/office/rendezvous/tafel/maak', officeAuth, async (req, res) => {
    const b = req.body || {};
    /* De codenamen worden een voor een opgezocht. Een naam die niemand aanwijst
       wordt GEMELD en niet stil overgeslagen: anders zet het kantoor een tafel
       van acht neer die er stiekem zes telt (LAT.md regel 5). */
    const genodigden = [], onbekend = [];
    for (const naam of (Array.isArray(b.genodigden) ? b.genodigden : []).slice(0, 12)) {
      const t = await keyVanCodenaam(String(naam || '').trim());
      if (t && t.key) genodigden.push(t.key); else onbekend.push(String(naam || '').trim());
    }
    if (onbekend.length) return res.status(400).json({ error: 'Onbekende codenaam: ' + onbekend.join(', ') });
    stuur(res, rvTafelMaak({ ...b, genodigden }));
  });

  app.post('/api/office/rendezvous/tafel/nodig', officeAuth, async (req, res) => {
    const t = await keyVanCodenaam(String((req.body || {}).codenaam || '').trim());
    if (!t || !t.key) return res.status(404).json({ error: 'Geen lid met die codenaam.' });
    stuur(res, rvTafelNodig(String((req.body || {}).id || ''), t.key));
  });
};
