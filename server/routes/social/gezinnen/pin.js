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
  const { kern, gezinsPoort, nietBeschermd, linkBon, pinClusterRem } = sctx;
  const { app, pinKaart, pinVernieuw, pinUit, pinZoek, pinVerbind,
          liveMaak, liveKijk, liveVerbind, liveTrekIn } = kern;

/* De twee poorten staan sinds RTG Link in ../gezinnen.js en komen hier mee: het
   zijn twee besluiten (hoor je bij dit gezin, en ben je oud genoeg om zelf
   contacten te leggen) en die horen op een plek te staan, niet in elk
   deelbestand opnieuw. Ze blijven echte middleware, om de reden die daar staat. */

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
app.post('/api/rtf/social/pin/uit', gezinsPoort, nietBeschermd, async (req, res) => {
  const s = req.gezinslid;
  const opties = Object.prototype.hasOwnProperty.call(req.body || {}, 'bevroren')
    ? { bevroren: req.body.bevroren !== false } : null;
  const r = pinUit(s.handle, req.body.uit !== false, opties);
  if (r.error) return res.status(r.status).json({ error: r.error });
  if (opties && opties.bevroren && liveTrekIn) {
    try { await liveTrekIn(s.handle); } catch (e) {}
  }
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
  /* De bon, net als aan de ledenkant. Hij ontbrak hier, en dat was geen besluit
     maar een vergeten helft: "mijn koppelingen" vertelde een gezinslid niets over
     wat hij zelf had gedaan. De schrijver staat in ../../social.js. */
  linkBon(s.handle, 'vast', r.key);
  res.json({ ok: true, status: r.st, key: r.key, codename: r.codename });
});

/* De levende code: een verse, ondertekende QR die na 45 seconden niets meer is
   en de vaste pin niet draagt (kern/sociaal/pin-live.js). Juist hier nuttig --
   twee gezinnen die elkaar op een verjaardag treffen houden een telefoon op in
   plaats van een codenaam te spellen.

   De gescande code heet in het lijf `livecode` en niet `token`: dat laatste is
   hier al bezet door de profielsessie (zie gezinsPoort hierboven). Met dezelfde
   naam overschreef de code de sessie, en antwoordde dit loket "log opnieuw in
   bij je gezin" op een code die niets mankeerde. */
app.post('/api/rtf/social/pin/live', gezinsPoort, nietBeschermd, async (req, res) => {
  const s = req.gezinslid;
  const r = await liveMaak(s.handle);
  if (r.error) return res.status(r.status).json({ error: r.error });
  res.json({ token: r.token, exp: r.exp, ttlMs: r.ttlMs, doel: r.doel });
});
app.post('/api/rtf/social/pin/live/kijk', gezinsPoort, nietBeschermd, async (req, res) => {
  const s = req.gezinslid;
  const r = await liveKijk(s.handle, req.body.livecode);
  if (r.error) return res.status(r.status).json({ error: r.error });
  res.json({ codename: r.codename, tier: r.tier, status: r.st,
    bevestiging: r.bevestiging, bevestigingVervalt: r.bevestigingVervalt });
});
app.post('/api/rtf/social/pin/live/verbind', gezinsPoort, nietBeschermd, async (req, res) => {
  const s = req.gezinslid;
  const r = await liveVerbind(s.handle, req.body.livecode, req.body.bevestiging);
  if (r.error) return res.status(r.status).json({ error: r.error });
  /* Zonder `naar`, en om dezelfde reden als aan de ledenkant: de levende weg
     geeft met opzet geen sleutel terug. De bon zegt DAT er via een levende code
     een verzoek uitging, en wanneer; wie het was staat in de verbinding zelf. */
  linkBon(s.handle, 'levend', null);
  res.json({ ok: true, status: r.st, codename: r.codename });
});
};
