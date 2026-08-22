/* RTG LINK aan de gezinskant (LINK.md par. 4, en de openstaande regel uit
   kern/link/intenties.js).

   WAAROM DIT EEN EIGEN DEUR IS EN GEEN EXTRA ROL OP DE BESTAANDE. De linkdeur
   (server/routes/link.js) staat op een Bearer-sessie: een lid, een zaak, een
   medewerker. Een gezinslid heeft die niet -- zijn sessie is een gezinscode met
   een profieltoken in het LIJF van het verzoek. Dat is geen detail dat je in
   kern/link/wie.js kunt bijschuiven: het is een andere geloofsbrief, met een
   andere poort ervoor. Vandaar dezelfde vorm als bij de contactpin: dezelfde
   laag eronder, een eigen loket erboven.

   DE TWEE POORTEN KOMEN UIT ../gezinnen.js en staan hier niet opnieuw. De
   tweede -- `nietBeschermd` -- is hier het belangrijkste: voor een kind van 15
   of jonger staat elk pinloket dicht, en scannen hoort daar niet de uitzondering
   op te zijn. Een kind dat een QR voorhoudt zou anders een kaart krijgen met een
   knop die de kern alsnog weigert; nu leest het dezelfde zin als overal:
   je ouder of verzorger doet dit.

   WAT HIER NIET STAAT: capabilities. Een gezinsprofiel heeft geen portemonnee,
   dus `geld.ontvangen` en `geld.kassa` noemen 'gezin' niet als aanvaarder --
   het scherm toont dan geen knop, en dit loket bestaat niet. Komt er ooit een
   handeling die WEL van een gezinslid kan zijn, dan hoort die rol in het
   register te staan en hier een loket te krijgen, en niet een van de twee.

   Gemount vanuit routes/social/gezinnen.js op de gedeelde context. */
module.exports = (sctx) => {
  const { kern, gezinsPoort, nietBeschermd } = sctx;
  const { app } = kern;

/* linkLos en linkKoppelingen worden OP AANROEPMOMENT uit de kern gehaald. De
   sociale routes hangen eerder dan RTG Link (opzet/aanbouw2.js), dus een
   `const { linkLos } = kern` hierboven is voor altijd undefined -- en dan
   antwoordt dit loket met een 500 op een verzoek dat prima was. Dezelfde
   stille breuk als bij de bon in ../pin.js, en dezelfde reparatie. */

/* Wie er scant: een gezinslid, met zijn profielhandle als sleutel. Dezelfde
   handle waarop zijn pin, zijn banden en zijn bonnen staan -- de laag eronder
   kent hem al, en er komt hier dus geen tweede identiteit bij. */
const alsGezin = (req) => ({ soort: 'gezin', key: req.gezinslid.handle });

// wat is dit, en wat kan ik ermee? (kijken; er gebeurt niets)
app.post('/api/rtf/link/los', gezinsPoort, nietBeschermd, async (req, res) => {
  const r = await kern.linkLos(alsGezin(req), req.body && req.body.tekst);
  if (r.error) return res.status(r.status || 400).json({ error: r.error, soort: r.soort || undefined });
  res.json({ type: r.type, wat: r.wat, vorm: r.vorm, onderwerp: r.onderwerp, intenties: r.intenties });
});

/* Mijn koppelingen: wat er van mij openstaat, wat er gebeurde, en met wie. Voor
   een gezinslid is de eerste lijst altijd leeg -- hij geeft geen capabilities
   uit -- en dat is geen gat maar de waarheid: er staat niets van hem open. */
app.post('/api/rtf/link/koppelingen', gezinsPoort, nietBeschermd, (req, res) => {
  res.json(kern.linkKoppelingen(req.gezinslid.handle, alsGezin(req)));
});
};
