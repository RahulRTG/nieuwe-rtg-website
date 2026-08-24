/* Sociale laag RTF (deelmodule): de contactpin aan de gezinskant.

   Dezelfde pin en dezelfde levende code als in de leden-app -- een gezinslid en
   een RTG-lid voegen elkaar er gewoon mee toe. Stond eerst in ./vrienden.js,
   maar dat bestand droeg toen vijf onderwerpen (onboarding, vrienden, dm, snaps,
   verhalen) plus dit, en ging daarmee over de 10 kB-lat. De knip loopt langs het
   onderwerp: hier de pin, daar de rest.

   VOOR EEN BESCHERMD PROFIEL (15 of jonger) STAAT ELK LOKET HIER DICHT. Dat is
   geen dubbelop bovenop de kern -- die weigert al -- maar het antwoord dat het
   scherm nodig heeft: een kind hoort te lezen dat zijn ouder dit doet, en niet
   een lege pin te zien. Het toevoegen loopt via /oudervoeg in ./vrienden.js, en
   de ouder krijgt de pin van zijn kind mee in /connections.

   Gemount vanuit routes/social/gezinnen.js op de gedeelde context. */
module.exports = (sctx) => {
  const { kern, rtfSociaal } = sctx;
  const pinClusterRem = sctx.pinClusterRem;
  const { app, pinKaart, pinVernieuw, pinUit, pinZoek, pinVerbind,
          liveMaak, liveKijk, liveVerbind } = kern;

/* TWEE POORTEN ALS ECHTE MIDDLEWARE en niet als aanroep binnenin, zodat bij
   elke route zichtbaar staat welke deuren hij heeft -- voor een lezer en voor
   scripts/check.js regel 28, die een poort in een wrapper niet ziet. Zelfde
   patroon en dezelfde reden als gezinsPoort in routes/tiener.js.

   Ze staan los omdat het twee verschillende vragen zijn: hoor je bij dit gezin,
   en ben je oud genoeg om zelf contacten te leggen. */
function gezinsPoort(req, res, next) {
  const sess = rtfSociaal(req, res);        // antwoordt zelf met 403 als er niets klopt
  if (!sess) return;
  req.gezinslid = sess;
  next();
}
// het kind hoort te lezen waarom dit dicht staat, en met dezelfde woorden als
// bij zoeken en verbinden (./vrienden.js)
function nietBeschermd(req, res, next) {
  if (req.gezinslid.beschermd) return res.status(403).json({ error: 'Je ouder of verzorger voegt vrienden voor je toe.' });
  next();
}

app.post('/api/rtf/social/pin', gezinsPoort, nietBeschermd, (req, res) => {
  const s = req.gezinslid;
  res.json(pinKaart(s.handle));
});
app.post('/api/rtf/social/pin/nieuw', gezinsPoort, nietBeschermd, (req, res) => {
  const s = req.gezinslid;
  const r = pinVernieuw(s.handle);
  if (r.error) return res.status(r.status).json({ error: r.error });
  res.json({ pin: r.pin, toon: r.toon, uit: r.uit, versie: r.versie,
    gemaaktOp: r.gemaaktOp, laatstGewijzigd: r.laatstGewijzigd,
    bevroren: r.bevroren, bevrorenSinds: r.bevrorenSinds,
    gebeurtenissen: r.gebeurtenissen });
});
app.post('/api/rtf/social/pin/uit', gezinsPoort, nietBeschermd, (req, res) => {
  const s = req.gezinslid;
  const opties = Object.prototype.hasOwnProperty.call(req.body || {}, 'bevroren')
    ? { bevroren: req.body.bevroren !== false } : null;
  const r = pinUit(s.handle, req.body.uit !== false, opties);
  if (r.error) return res.status(r.status).json({ error: r.error });
  res.json({ pin: r.pin, toon: r.toon, uit: r.uit, versie: r.versie,
    gemaaktOp: r.gemaaktOp, laatstGewijzigd: r.laatstGewijzigd,
    bevroren: r.bevroren, bevrorenSinds: r.bevrorenSinds,
    gebeurtenissen: r.gebeurtenissen });
});
app.post('/api/rtf/social/pin/zoek', gezinsPoort, nietBeschermd, async (req, res) => {
  const s = req.gezinslid;
  const deur = await pinClusterRem.voor({ actor: s.handle, bron: req.ip });
  if (!deur.ok) return res.status(deur.status).json({ error: deur.error });
  const r = pinZoek(s.handle, req.body.pin, { bron: req.ip });
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
app.post('/api/rtf/social/pin/connect', gezinsPoort, nietBeschermd, async (req, res) => {
  const s = req.gezinslid;
  const r = await pinVerbind(s.handle, req.body.pin, req.body.bevestiging);
  if (r.error) return res.status(r.status).json({ error: r.error });
  res.json({ ok: true, status: r.st, codename: r.codename });
});

/* De levende code: een verse, ondertekende QR die na 45 seconden niets meer is
   en de vaste pin niet draagt (kern/sociaal/pin-live.js). Juist hier nuttig --
   twee gezinnen die elkaar op een verjaardag treffen houden een telefoon op in
   plaats van een codenaam te spellen.

   De gescande code heet in het lijf `livecode` en niet `token`: dat laatste is
   hier al bezet door de profielsessie (zie gezinsPoort hierboven). Met dezelfde
   naam overschreef de code de sessie, en antwoordde dit loket "log opnieuw in
   bij je gezin" op een code die niets mankeerde. */
app.post('/api/rtf/social/pin/live', gezinsPoort, nietBeschermd, (req, res) => {
  const s = req.gezinslid;
  const r = liveMaak(s.handle);
  if (r.error) return res.status(r.status).json({ error: r.error });
  res.json({ token: r.token, exp: r.exp, ttlMs: r.ttlMs, doel: r.doel });
});
app.post('/api/rtf/social/pin/live/kijk', gezinsPoort, nietBeschermd, (req, res) => {
  const s = req.gezinslid;
  const r = liveKijk(s.handle, req.body.livecode);
  if (r.error) return res.status(r.status).json({ error: r.error });
  res.json({ codename: r.codename, tier: r.tier, status: r.st,
    bevestiging: r.bevestiging, bevestigingVervalt: r.bevestigingVervalt });
});
app.post('/api/rtf/social/pin/live/verbind', gezinsPoort, nietBeschermd, async (req, res) => {
  const s = req.gezinslid;
  const r = await liveVerbind(s.handle, req.body.livecode, req.body.bevestiging);
  if (r.error) return res.status(r.status).json({ error: r.error });
  res.json({ ok: true, status: r.st, codename: r.codename });
});
};
