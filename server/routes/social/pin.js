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
  const { kern, linkBon: bon } = sctx;
  const { app, auth, geenGast, pinKaart, pinVernieuw, pinUit, pinZoek, pinVerbind,
          liveMaak, liveKijk, liveVerbind, appUrl } = kern;
  const PIN_ACTIES = new Set(['rtg-pin-vernieuw', 'rtg-pin-noodslot-uit', 'rtg-pin-vast-aan']);
  const oorsprong = req => { try { return new URL(appUrl(req)).origin; } catch (e) { return ''; } };
  const gastheer = req => { try { return new URL(oorsprong(req)).hostname; } catch (e) { return req.hostname; } };
  const binding = (req, actie) => 'rtg-pin-security-v1|' + actie + '|' + req.session.key;
  async function bewijs(req, actie) {
    // Demo-/oude tiers zonder eigen account kunnen geen passkey bezitten. Een
    // echt account mét passkey moet hem altijd opnieuw tonen; de kern beslist
    // dit op basis van de opgeslagen credentials, niet op basis van clientdata.
    if (!req.session.account) return { status: 200, ok: true, nodig: false };
    return pinBeveiliging.maak(req.session.account, actie, binding(req, actie),
      req.body.ceremonie, req.body.antwoord, oorsprong(req), gastheer(req));
  }

/* Een action-bound passkeychallenge voor de drie handelingen die een gestolen
   open sessie niet zelfstandig mag doen. Er komt geen algemeen 2FA-token uit:
   de challenge hoort bij exact een actienaam en het huidige account. */
app.post('/api/member/pin/actie/opties', auth, async (req, res) => {
  if (geenGast(req, res)) return;
  const actie = String(req.body.actie || '');
  if (!PIN_ACTIES.has(actie)) return res.status(400).json({ error: 'Onbekende PIN-veiligheidshandeling.' });
  if (!req.session.account) return res.json({ nodig: false });
  const r = await pinBeveiliging.opties(req.session.account, actie, binding(req, actie), gastheer(req));
  if (r.error) return res.status(r.status || 400).json({ error: r.error });
  res.json(r);
});

/* DE BON WORDT GESCHREVEN WAAR DE HANDELING WORDT BEVESTIGD, en dat is hier:
   deze twee loketten zijn de plek waar een verzoek echt de deur uitgaat. Niet
   bij het opzoeken -- een bon per scan zou een register zijn van iedereen die je
   ooit tegenkwam (LINK.md par. 3.8), en niet bij socialVerbind, want die wordt
   ook langs het gewone zoeken op codenaam bereikt en dat is geen link-handeling.

   De schrijver zelf staat in ../social.js, want de gezinskant doet hetzelfde bij
   dezelfde handeling; twee kopieen zouden betekenen dat "mijn koppelingen" aan
   de ene kant wel en aan de andere kant niet vertelt wat je gedaan hebt. */

// mijn eigen pin (wordt bij de eerste keer opvragen gemaakt)
app.post('/api/member/pin', auth, (req, res) => {
  if (geenGast(req, res)) return;
  res.json(pinKaart(req.session.key));
});

/* een nieuwe pin: het intrekken van een adres. Wie de oude nog heeft -- op een
   oude foto van de QR, in een oude groepsapp -- kan er niets meer mee.
   Bestaande vrienden merken er niets van; die staan op de sleutel. */
app.post('/api/member/pin/nieuw', auth, async (req, res) => {
  if (geenGast(req, res)) return;
  const b = await bewijs(req, 'rtg-pin-vernieuw');
  if (b.error) return res.status(b.status || 401).json({ error: b.error });
  const r = pinVernieuw(req.session.key);
  if (r.error) return res.status(r.status).json({ error: r.error });
  res.json({ pin: r.pin, toon: r.toon, uit: r.uit, versie: r.versie,
    gemaaktOp: r.gemaaktOp, laatstGewijzigd: r.laatstGewijzigd,
    bevroren: r.bevroren, bevrorenSinds: r.bevrorenSinds,
    gebeurtenissen: r.gebeurtenissen });
});

/* de pin uitzetten (en weer aan). Vernieuwen helpt tegen een pin die is
   rondgegaan; dit is het andere verzoek: ik wil helemaal niet zo gevonden
   worden. De levende code hieronder blijft wel werken -- zie de uitleg bij
   pinUit in kern/sociaal/pin.js. */
app.post('/api/member/pin/uit', auth, async (req, res) => {
  if (geenGast(req, res)) return;
  const opties = Object.prototype.hasOwnProperty.call(req.body || {}, 'bevroren')
    ? { bevroren: req.body.bevroren !== false } : null;
  const actie = opties && !opties.bevroren ? 'rtg-pin-noodslot-uit'
    : (!opties && req.body.uit === false ? 'rtg-pin-vast-aan' : null);
  if (actie) {
    const b = await bewijs(req, actie);
    if (b.error) return res.status(b.status || 401).json({ error: b.error });
  }
  const r = pinUit(req.session.key, req.body.uit !== false, opties);
  if (r.error) return res.status(r.status).json({ error: r.error });
  res.json({ pin: r.pin, toon: r.toon, uit: r.uit, versie: r.versie,
    gemaaktOp: r.gemaaktOp, laatstGewijzigd: r.laatstGewijzigd,
    bevroren: r.bevroren, bevrorenSinds: r.bevrorenSinds,
    gebeurtenissen: r.gebeurtenissen });
});

// wie zit er achter deze pin? (kijken, nog niets doen)
app.post('/api/member/pin/zoek', auth, async (req, res) => {
  if (geenGast(req, res)) return;
  const deur = await pinClusterRem.voor({ actor: req.session.key, bron: req.ip });
  if (!deur.ok) return res.status(deur.status).json({ error: deur.error });
  const r = pinZoek(req.session.key, req.body.pin, { bron: req.ip });
  if (r.error) {
    if (r.status === 404) {
      const geteld = await pinClusterRem.misser();
      if (!geteld.ok) return res.status(geteld.status).json({ error: geteld.error });
    }
    return res.status(r.status).json({ error: r.error });
  }
  res.json({ codename: r.codename, tier: r.tier, status: r.st,
    bevestiging: r.bevestiging, bevestigingVervalt: r.bevestigingVervalt });
});

// en dan pas: het verzoek versturen
app.post('/api/member/pin/connect', auth, async (req, res) => {
  if (geenGast(req, res)) return;
  const r = await pinVerbind(req.session.key, req.body.pin, req.body.bevestiging);
  if (r.error) return res.status(r.status).json({ error: r.error });
  bon(req.session.key, 'vast', r.key);
  res.json({ ok: true, status: r.st, key: r.key, codename: r.codename });
});

/* ---------- de levende code: dezelfde volgorde, kortere houdbaarheid ----------
   Een verse, ondertekende code die na 45 seconden niets meer is en je vaste pin
   niet draagt (kern/sociaal/pin-live.js). Het scherm haalt hem telkens opnieuw
   op zolang hij getoond wordt; daar is de code op gebouwd. */
app.post('/api/member/pin/live', auth, (req, res) => {
  if (geenGast(req, res)) return;
  const r = liveMaak(req.session.key);
  if (r.error) return res.status(r.status).json({ error: r.error });
  res.json({ token: r.token, exp: r.exp, ttlMs: r.ttlMs, doel: r.doel });
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
  res.json({ codename: r.codename, tier: r.tier, status: r.st,
    bevestiging: r.bevestiging, bevestigingVervalt: r.bevestigingVervalt });
});

// en dan pas versturen; nu is de code op
app.post('/api/member/pin/live/verbind', auth, async (req, res) => {
  if (geenGast(req, res)) return;
  const r = await liveVerbind(req.session.key, req.body.livecode, req.body.bevestiging);
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
