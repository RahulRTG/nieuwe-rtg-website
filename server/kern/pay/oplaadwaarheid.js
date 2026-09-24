/* RTG Pay, opladen via de betaalwaarheid (MONEY-012, de inkomende kant).

   WAAROM. laadOp riep hier een kale betaal.maakBetaling aan, en daarmee zaten
   er drie gaten in het enige pad waar geld van buiten de wallet in komt:
     - zonder `idem` was de providersleutel bij elke poging anders, dus een
       herhaling na een verloren antwoord belastte de kaart twee keer;
     - bij een fout werd er NIETS vastgelegd, dus de eerste betaling werd nooit
       bijgeschreven en niemand wist dat hij bestond;
     - een wachtende betaling ging naar kaartWachtend, zonder veegronde en met
       een stille wis boven de 20.000 rijen.
   kern/betaalwaarheid legt de betaling vast VOOR de aanroep, gebruikt een
   vaste sleutel en vraagt na wat geen uitsluitsel gaf (./hervat.js daar).

   DIT BESTAND is de afhandelaar: de enige plek waar een bevestigde oplading
   wordt bijgeschreven, of hij nu meteen, via een webhook of via de veegronde
   bevestigd werd. Precies een keer:
     - het bewijs (`w.geboekt`) staat in DEZELFDE opslag als de boeking en gaat
       mee met dezelfde save, dus na een herstart is er beide of geen van beide;
     - in motorstand ontdubbelt de motor op de economische sleutel;
     - een boeking die een fout TERUGGEEFT heeft niets geboekt, dus dan gaat het
       bewijs weg; een boeking die GOOIT kan in het geheugen al gelopen zijn,
       dus dan blijft het staan. */
'use strict';

module.exports = function hangOplaadwaarheid({ betaalWaarheid, oplaadAfronden, nu }) {
  if (!betaalWaarheid) return;
  betaalWaarheid.registreerAfhandeling('pay-oplaad', async (w) => {
    if (w.geboekt) return;
    const c = w.context || {};
    w.geboekt = { at: nu() };
    const r = await oplaadAfronden({ codenaam: c.codenaam, centen: w.centen, oms: c.oms, ref: w.id,
      economischeSleutel: 'pay-oplaad:' + w.id });
    if (r && r.error) { delete w.geboekt; throw new Error(r.error); }
  });
};
