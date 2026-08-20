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

/* DE BON WORDT GESCHREVEN WAAR DE HANDELING WORDT BEVESTIGD, en dat is hier:
   deze twee loketten zijn de plek waar een verzoek echt de deur uitgaat. Niet
   bij het opzoeken -- een bon per scan zou een register zijn van iedereen die je
   ooit tegenkwam (LINK.md par. 3.8), en niet bij socialVerbind, want die wordt
   ook langs het gewone zoeken op codenaam bereikt en dat is geen link-handeling.

   Zodra handelingen op de laag zelf komen te staan, verhuist deze aanroep mee:
   de bon hoort naast de daad. */
function bon(wie, vorm, naar) {
  /* linkBon wordt OP AANROEPMOMENT uit de kern gehaald en niet hierboven
     uitgelezen. De sociale routes hangen eerder dan RTG Link (opzet/aanbouw2.js),
     dus een `const { linkBon } = kern` bovenaan is voor altijd undefined -- de
     stille breuk waar de domeingrens over gaat, en precies wat deze toets zag
     zakken voordat dit hier stond.

     De bon mag het verzoek nooit omgooien -- dat is al gelukt als we hier zijn --
     maar hij mag ook niet stil mislukken (LAT.md regel 5): een lege bonnenlijst
     leest als "ik heb niets gedaan", en dat is dan niet waar. */
  try {
    if (typeof kern.linkBon !== 'function') throw new Error('de linklaag draait hier niet');
    kern.linkBon({ wie, type: 'persoon', intentie: 'contact.verbinden', vorm, naar });
  } catch (e) { console.warn('[link] bon niet geschreven voor ' + vorm + '-verbinding: ' + (e && e.message)); }
}

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
  bon(req.session.key, 'vast', r.key);
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

/* kijken wie er achter een gescande code zit -- de code gaat hier NIET op.

   HET VELD HEET `livecode` EN NIET `token`, en dat is geen smaak. Aan de
   gezinskant draagt het lijf al een `token`: dat van de profielsessie
   (rtfSociaal leest req.body.token). Een levende code die daar ook `token`
   heette, overschreef de sessie -- en dan antwoordt het loket "log opnieuw in
   bij je gezin" op een volstrekt geldige code. Hier aan de ledenkant zou
   `token` op zichzelf kunnen, maar twee namen voor hetzelfde ding over twee
   apps is hoe de volgende die dit leest het weer fout doet. */
app.post('/api/member/pin/live/kijk', auth, (req, res) => {
  if (geenGast(req, res)) return;
  const r = liveKijk(req.session.key, req.body.livecode);
  if (r.error) return res.status(r.status).json({ error: r.error });
  res.json({ codename: r.codename, tier: r.tier, status: r.st });
});

// en dan pas versturen; nu is de code op
app.post('/api/member/pin/live/verbind', auth, async (req, res) => {
  if (geenGast(req, res)) return;
  const r = await liveVerbind(req.session.key, req.body.livecode);
  if (r.error) return res.status(r.status).json({ error: r.error });
  /* Zonder `naar`, en dat is geen vergeten veld. De levende weg geeft met opzet
     geen sleutel terug (zie kern/sociaal/pin-live.js: het scherm hoeft niet te
     weten hoe iemand in de database heet), en een bon is geen reden om die
     keuze alsnog te omzeilen. WIE het was staat in de verbinding zelf; de bon
     zegt DAT er via een levende code een verzoek uitging, en wanneer. */
  bon(req.session.key, 'levend', null);
  res.json({ ok: true, status: r.st, codename: r.codename });
});
};
