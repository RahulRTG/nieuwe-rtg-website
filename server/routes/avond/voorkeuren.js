/* RTG Evening OS (deellaag): de Hospitality DNA -- wat een zaak van je te zien
   krijgt, en wat niet. Hoort bij ../avond.js, waar dit uit is geknipt toen de
   aanvraagweg voor "uitgaan" erbij kwam en het bestand over de 10 kB ging. De
   knip loopt op een onderwerpgrens: hier de toestemming, daar het plan.

   DE REGEL VAN DEZE DRIE ROUTES: het lid bepaalt per soort en per zaak wat er
   uitgaat, en kan het ZELF NAKIJKEN. `proef` is er daarom voor de gast en niet
   voor de zaak: een toestemmingsscherm dat niet laat zien wat er werkelijk over
   de lijn gaat, vraagt om vertrouwen zonder het te verdienen. */
module.exports = (ctx) => {
  const { app, auth, schoon, voorkeuren, stuur } = ctx;

  app.post('/api/avond/voorkeuren', auth, (req, res) => {
    const zaak = schoon((req.body || {}).zaak, 30) || null;
    if ((req.body || {}).zet) voorkeuren.zet(req.session.key, (req.body || {}).zet);
    res.json({ ok: true, profiel: voorkeuren.overzicht(req.session.key, zaak) });
  });

  app.post('/api/avond/voorkeuren/zaak', auth, (req, res) => {
    const b = req.body || {};
    stuur(res, voorkeuren.zetVoorZaak(req.session.key, b.zaak, b.standen));
  });

  app.post('/api/avond/voorkeuren/proef', auth, (req, res) => {
    const b = req.body || {};
    res.json({ ok: true, zaak: schoon(b.zaak, 30) || null,
      ditZietDeZaak: voorkeuren.voorZaak(req.session.key, schoon(b.zaak, 30), { nu: Array.isArray(b.nu) ? b.nu : [] }) });
  });
};
