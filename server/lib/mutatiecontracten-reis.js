/* ============================================================================
   MUTATIECONTRACT -- DE REISBOEKING, EN WAT ZIJN SLEUTEL WEL EN NIET DICHT.

   Deel van ./mutatiecontracten.js.

   Deze staat hier apart omdat de uitleg niet in de code paste: het bestand
   server/kern/mobiliteit/reis.js zit tegen de grootte-grens van
   scripts/check.js aan, en een opmerking van zeventien regels duwde hem eroverheen.
   Dit register is de plek waar een tweede aanroep hoort te worden beschreven, dus
   dan staat hij hier -- niet ingekort tot iets wat niets meer zegt.

   WAT ER GEBEURDE. /api/mob/reis/boek koopt per OV-etappe een kaartje, en gaf de
   idempotentiesleutel alleen door als de AANROEPER er zelf een meestuurde. Sinds
   de geldgrens (lib/idem.js, besluit van de eigenaar 30 augustus 2026) weigert de
   geldlaag een geldhandeling zonder sleutel; een zakelijke reis met een OV-etappe
   was daarmee niet meer te boeken. test/zakelijkvervoer.test.js kreeg een 400 op
   "de reis is geboekt".

   WAT DE SLEUTEL NU IS. Een reiziger kan er onmogelijk een per ETAPPE bedenken,
   dus hij komt uit de boeking: `reis:<boeking>:<lijn>`. Stuurt de aanroeper zelf
   `idem` mee, dan wint die -- zelfde regel als overal in dit huis: wie een sleutel
   meestuurt, heeft gesproken.

   WAT HIJ WEL DICHT. Binnen EEN boeking koopt een herhaalde poging geen tweede
   kaartje voor dezelfde lijn. Dat is niet theoretisch: stap 1 (de taxiritten) kan
   terugdraaien, en dan wordt stap 2 opnieuw gelopen.

   WAT HIJ NIET DICHT, en dat staat er even groot bij. Twee keer op "boek" drukken
   maakt twee reizen met twee eigen id's, en dus twee kaartjes. Dat was voor de
   geldgrens ook al zo -- het is een apart gat en geen gevolg van deze reparatie --
   en wie het wil dichten stuurt `idem` mee. Deze stand is daarom bewust NIET
   PROTECTED: de bescherming geldt binnen een boeking en niet over twee boekingen
   heen, en een PROTECTED dat dat verschil niet maakt, belooft te veel.
   ========================================================================== */
'use strict';

const CONTRACTEN = {
  'POST /api/mob/reis/boek': {
    mutatieId: 'mob.reis.boek', herkomst: 'mens',
    semantiek: { klasse: 'sleutelVereist' },
    toegang: { klasse: 'AUTHENTICATED' },
    stand: 'INTENTIONALLY_NON_IDEMPOTENT',
    waarom: 'twee keer boeken is twee reizen: elke boeking krijgt een eigen id en dus eigen kaartjes. ' +
      'Wie de tweede druk wil laten samenvallen met de eerste, stuurt `idem` mee -- dan is het dezelfde reis',
    bewijs: {
      gemeten: 'test/zakelijkvervoer.test.js toets 13 boekt een gemengde reis (taxi + OV) en kreeg voor ' +
        'de reparatie een 400 van de geldgrens; na de reparatie loopt de boeking en staan de ritten op de ' +
        'werkgever en het kaartje op de reiziger',
      op: '2026-08-30'
    },
    nagekeken: 'handler gelezen in server/kern/mobiliteit/reis.js: de sleutel per OV-etappe is ' +
      '`reis:<boeking of meegestuurde idem>:<lijn>`. Binnen een boeking koopt een herhaalde poging geen ' +
      'tweede kaartje; over twee boekingen heen wel, en daarom is dit geen PROTECTED',
    afgetekend: {
      door: 'Claude (Opus 5), op grond van de gelezen handler en de toets die de breuk aanwees; ' +
        'niet door een mens nagelezen',
      op: '2026-08-30'
    }
  }
};

module.exports = CONTRACTEN;
