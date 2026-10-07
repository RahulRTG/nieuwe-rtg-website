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
     - `w.geboekt` is een geheugensteun en GEEN bewijs: kern/pay/opslag.js
       schrijft alleen de pay-collecties, dus de bijschrijving en deze
       afhandeling committen APART. Stond hier eerst dat ze samen gingen, en
       een `kill -9` ertussen plus de herhaalde webhook schreef de oplading
       twee keer bij (test/oplaadwebhook-crash.test.js);
     - het bewijs is de economische sleutel `pay-oplaad:<sha256 van w.id>`: in
       motorstand ontdubbelt de motor erop, in het JS-grootboek commit hij in
       dezelfde transactie als de saldi;
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
    // de sleutel volgt in oplaadAfronden uit w.id: `pay-oplaad:<sha256>`
    const r = await oplaadAfronden({ codenaam: c.codenaam, centen: w.centen, oms: c.oms, ref: w.id });
    if (r && r.error) { delete w.geboekt; throw new Error(r.error); }
  });
};
