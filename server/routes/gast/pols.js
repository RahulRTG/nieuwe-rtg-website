/* Gast OS (deellaag): de pols lezen en zelf melden.

   WAAROM MELDEN ACHTER `gastAuth` ZIT EN NIET ACHTER EEN INLOG. Wie zegt hoe
   luid het bij Sal de Mar is, moet er zitten. De tafelsleutel is daar het
   bewijs voor dat er toch al is: hij hoort bij EEN open rekening op EEN plek in
   EEN zaak, en verloopt als die rekening dichtgaat. Een openbare meldknop zou
   binnen een week het speelveld van de concurrent ernaast zijn.

   De melding hangt aan `deelnemer.hash` -- dezelfde afdruk die de rekening al
   gebruikt om je te herkennen. Dat is geen naam en geen ledensleutel; we weten
   dus dat er iemand aan tafel 12 iets zei, en verder niets (CLAUDE.md, privacy
   by design). Een tweede melding over hetzelfde onderwerp vervangt de eerste,
   zodat een tafel van vier hooguit vier keer telt. */
module.exports = (ctx) => {
  const { app, gastAuth, stuur, polslaag } = ctx;

  /* Wat de gast gevraagd mag worden, met de keuzes erbij. Het scherm haalt de
     lijst hier op in plaats van hem zelf te kennen: een onderwerp dat erbij
     komt hoort niet op twee plekken te worden toegevoegd. */
  const meldbaar = () => Object.entries(polslaag.ONDERWERPEN)
    .filter(([, o]) => o.bronnen.includes('gasten'))
    .map(([sleutel, o]) => ({ sleutel, naam: o.naam, standen: o.standen }));

  app.post('/api/gast/pols', gastAuth, (req, res) => {
    res.json(Object.assign({ ok: true }, polslaag.pols(req.gast.zaakcode), { meldbaar: meldbaar() }));
  });

  app.post('/api/gast/pols/meld', gastAuth, (req, res) => {
    stuur(res, polslaag.meld(req.gast.zaakcode, req.gast.deelnemer.hash, (req.body || {}).standen));
  });
};
