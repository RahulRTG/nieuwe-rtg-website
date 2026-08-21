/* Sociaal (deelmodule): DE HINT VAN PIN NAAR LID.

   Eén onderwerp, en het verdient een eigen bestand omdat de uitleg eronder
   langer is dan de code erboven -- dat is meestal het teken dat er iets in zit
   dat je later niet meer navertelt.

   Krijgt de rij-lezer van ./pin.js mee in plaats van db aan te raken: zo kan
   deze laag niets bezitten en niets schrijven, en is er geen twijfel over wie
   de waarheid draagt.

   Van pin naar handle. Hier stond een kale doorloop over alle leden, met als
   reden dat een index naast db.data een tweede waarheid is die stil uit de pas
   loopt. Die zorg is terecht en wordt hieronder niet weggewuifd maar ONTKRACHT:
   deze index is geen waarheid maar een HINT, en elke treffer wordt tegen de
   echte rij nagekeken voordat hij telt.

   Dat is geen theoretische netheid. `vergeten/eigen.js` doet
   `delete db.data.contactPins[key]` volledig buiten deze module om -- een index
   die zichzelf gelooft, wijst een gewist lid daarna nog gewoon aan.

   Twee dingen houden hem eerlijk, en allebei kosten ze niets:
   1. de rij-IDENTITEIT: vervangt de opslaglaag db.data (een externe wijziging,
      een Postgres-synchronisatie), dan is `rij()` een ander object en bouwen we
      opnieuw op. Een vergelijking van twee verwijzingen, meer niet;
   2. de VERIFICATIE bij elke treffer: klopt `rij()[handle].pin` niet meer met
      wat de index zei, dan is de index verdacht, gaat hij overnieuw, en telt pas
      het antwoord daarna.
   Onze eigen schrijfacties (pinVan, pinVernieuw) werken de index bij, dus een
   MISSER op een ongewijzigde rij is ook echt een misser -- anders zou elke
   verkeerde gok een herbouw uitlokken, en dat is een duurdere deur dan de
   doorloop die hij verving.

   HIER STOND OOK EEN CONTROLE OP HET AANTAL RIJEN, en die maakte de hele
   verbetering ongedaan: `Object.keys(r).length` loopt zelf over alles heen en
   bouwt er nog een array bij ook, dus elke opzoeking deed alsnog het werk dat
   de index moest wegnemen -- en dan is een index alleen maar een tweede plek
   waar iets fout kan staan. Hij is ook niet nodig. Wissen doet alleen
   kern/vergeten/eigen.js, en zo'n wissing komt bij het opzoeken vanzelf als
   treffer-die-niet-klopt boven (punt 2); toevoegen gebeurt nergens buiten deze
   laag behalve door een vervangen db.data (punt 1). */
module.exports = (rij) => {
let index = null, geindexeerdeRij = null;
function bouwIndex() {
  const r = rij();
  index = new Map();
  for (const handle of Object.keys(r)) if (r[handle] && r[handle].pin) index.set(r[handle].pin, handle);
  geindexeerdeRij = r;
}
function zoekRuw(pin) {
  const r = rij();
  if (!index || r !== geindexeerdeRij) bouwIndex();
  const handle = index.get(pin);
  if (handle === undefined) return null;
  if (r[handle] && r[handle].pin === pin) return handle;   // de hint klopt
  bouwIndex();                                             // hij klopte niet: opnieuw, en dan telt het antwoord
  const nogmaals = index.get(pin);
  return (nogmaals !== undefined && r[nogmaals] && r[nogmaals].pin === pin) ? nogmaals : null;
}

/* Onze eigen schrijfacties houden de hint bij. Dat is wat een MISSER op een
   ongewijzigde rij betrouwbaar maakt: zonder dit zou elke verkeerde gok een
   herbouw uitlokken, en dan is de index duurder dan de doorloop die hij verving. */
function indexZet(handle, oudePin, nieuwePin) {
  if (!index) return;
  if (oudePin) index.delete(oudePin);
  if (nieuwePin) index.set(nieuwePin, handle);
}

return { zoekRuw, indexZet, bouwIndex };
};
