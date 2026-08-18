/* Sociale laag (deelmodule): de contactpin van een RTG-lid -- tonen, vernieuwen,
   opzoeken en verbinden. De werking staat in kern/sociaal/pin.js; hier staat
   alleen wie er aan welk loket mag komen.

   Opzoeken en verbinden staan met opzet UIT ELKAAR -- twee loketten waar er
   een had gekund: het scherm laat eerst zien wie er achter de pin zit en de
   mens drukt daarna pas op versturen. Een QR die bij het scannen meteen een
   verzoek de deur uit doet, is een verzoek dat niemand bewust deed. De levende
   code (/live/...) volgt precies diezelfde volgorde.

   Gemount vanuit routes/social.js op de gedeelde kern. */
module.exports = (sctx) => {
  const { kern } = sctx;
  const { app, auth, geenGast, pinKaart, pinVernieuw, pinUit, pinZoek, pinVerbind,
          liveMaak, liveKijk, liveVerbind } = kern;

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

/* de pin uitzetten (en weer aan). Vernieuwen helpt tegen een pin die is
   rondgegaan; dit is het andere verzoek: ik wil helemaal niet zo gevonden
   worden. De levende code hieronder blijft wel werken -- zie de uitleg bij
   pinUit in kern/sociaal/pin.js. */
app.post('/api/member/pin/uit', auth, (req, res) => {
  if (geenGast(req, res)) return;
  const r = pinUit(req.session.key, req.body.uit !== false);
  if (r.error) return res.status(r.status).json({ error: r.error });
  res.json({ pin: r.pin, toon: r.toon, uit: r.uit });
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

/* ---------- de levende code: dezelfde volgorde, kortere houdbaarheid ----------
   Een verse, ondertekende code die na een minuut niets meer is en je vaste pin
   niet draagt (kern/sociaal/pin-live.js). Het scherm haalt hem telkens opnieuw
   op zolang hij getoond wordt; daar is de code op gebouwd. */
app.post('/api/member/pin/live', auth, (req, res) => {
  if (geenGast(req, res)) return;
  const r = liveMaak(req.session.key);
  if (r.error) return res.status(r.status).json({ error: r.error });
  res.json({ token: r.token, exp: r.exp, ttlMs: r.ttlMs });
});

// kijken wie er achter een gescande code zit -- de code gaat hier NIET op
app.post('/api/member/pin/live/kijk', auth, (req, res) => {
  if (geenGast(req, res)) return;
  const r = liveKijk(req.session.key, req.body.token);
  if (r.error) return res.status(r.status).json({ error: r.error });
  res.json({ codename: r.codename, tier: r.tier, status: r.st });
});

// en dan pas versturen; nu is de code op
app.post('/api/member/pin/live/verbind', auth, async (req, res) => {
  if (geenGast(req, res)) return;
  const r = await liveVerbind(req.session.key, req.body.token);
  if (r.error) return res.status(r.status).json({ error: r.error });
  res.json({ ok: true, status: r.st, codename: r.codename });
});
};
