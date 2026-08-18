/* Sociale laag (deelmodule): de contactpin van een RTG-lid -- tonen, vernieuwen,
   opzoeken en verbinden. De werking staat in kern/sociaal/pin.js; hier staat
   alleen wie er aan welk loket mag komen.

   Vier loketten en niet drie, omdat opzoeken en verbinden met opzet UIT ELKAAR
   staan: het scherm laat eerst zien wie er achter de pin zit en de mens drukt
   daarna pas op versturen. Een QR die bij het scannen meteen een verzoek de
   deur uit doet, is een verzoek dat niemand bewust deed.

   Gemount vanuit routes/social.js op de gedeelde kern. */
module.exports = (sctx) => {
  const { kern } = sctx;
  const { app, auth, geenGast, pinKaart, pinVernieuw, pinZoek, pinVerbind } = kern;

// mijn eigen pin (wordt bij de eerste keer opvragen gemaakt)
app.post('/api/member/pin', auth, (req, res) => {
  if (geenGast(req, res)) return;
  res.json(pinKaart(req.session.key));
});

/* een nieuwe pin: het intrekken van een adres. Wie de oude nog heeft -- op een
   oude foto van de QR, in een oude groepsapp -- kan er niets meer mee.
   Bestaande vrienden merken er niets van; die staan op de sleutel. */
app.post('/api/member/pin/nieuw', auth, (req, res) => {
  if (geenGast(req, res)) return;
  const r = pinVernieuw(req.session.key);
  if (r.error) return res.status(r.status).json({ error: r.error });
  res.json({ pin: r.pin, toon: r.toon });
});

// wie zit er achter deze pin? (kijken, nog niets doen)
app.post('/api/member/pin/zoek', auth, (req, res) => {
  if (geenGast(req, res)) return;
  const r = pinZoek(req.session.key, req.body.pin);
  if (r.error) return res.status(r.status).json({ error: r.error });
  res.json({ key: r.key, codename: r.codename, tier: r.tier, status: r.st });
});

// en dan pas: het verzoek versturen
app.post('/api/member/pin/connect', auth, async (req, res) => {
  if (geenGast(req, res)) return;
  const r = await pinVerbind(req.session.key, req.body.pin);
  if (r.error) return res.status(r.status).json({ error: r.error });
  res.json({ ok: true, status: r.st, key: r.key, codename: r.codename });
});
};
