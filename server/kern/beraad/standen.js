/* ============================================================================
   HET BERAAD -- de gesloten woordenlijsten (GEMEENSCHAP-FASE0.md par. 4.3).

   Alles wat een beraad kan ZIJN staat hier, en nergens anders. Een vrije stand
   of een "anders" is de plek waar een beraad later wordt weggeboekt -- dezelfde
   reden als de REDENEN in kern/livinglab/vraagbesluit.js en de EINDSTANDEN van
   DemocratieOS. Die laatste worden hier met opzet NIET geladen: een beraad in een
   genootschap is geen politiek (grens G6), en test/beraad.test.js zakt zodra
   iets in kern/beraad iets uit kern/democratie laadt. De woorden van de
   terugkoppeling zijn wel dezelfde drie, met dezelfde betekenis; ze staan hier
   overgeschreven en niet gedeeld, en dat is de prijs van G6.
   ========================================================================== */
'use strict';

/* De standen van een ronde, van links naar rechts. Terug kan op een plek: een
   nieuw voorstel tijdens het stemmen zet de ronde terug op `voorstel` en de
   stemmen op nul -- wie op versie 1 stemde, heeft niet op versie 2 gestemd. */
const STANDEN = Object.freeze(['open', 'voorstel', 'stemmen', 'besloten']);

const KEUZES = Object.freeze(['voor', 'tegen', 'onthouding']);

/* Wat een lid kan inbrengen. Drie lijsten, en geen ervan krimpt ooit: een
   bezwaar verdwijnt niet als het voorstel wordt aangenomen (bedrijf/besluit.js
   regel 3), en intrekken is een markering en geen verwijdering. */
const SOORTEN = Object.freeze({ inbreng: 'inbreng', bezwaar: 'bezwaren', 'open-punt': 'openPunten' });

/* De eindstanden. Gesloten: er is geen "anders". `geen-besluit` is een
   volwaardige uitkomst en geen fout -- het quorum is niet gehaald, en dat hoort
   iedereen die meedeed te horen in plaats van dat het beraad stil blijft staan. */
const EINDSTANDEN = Object.freeze([
  Object.freeze({ stand: 'aangenomen', uitleg: 'Meer stemmen voor dan tegen, en het quorum is gehaald.' }),
  Object.freeze({ stand: 'verworpen', uitleg: 'Niet meer stemmen voor dan tegen; het quorum is gehaald.' }),
  Object.freeze({ stand: 'geen-besluit', uitleg: 'Het quorum is niet gehaald. Er is niets besloten, ook geen nee.' }),
  Object.freeze({ stand: 'ingetrokken', uitleg: 'Wie het beraad opende of een beheerder heeft het gestopt voordat er besloten werd.' })
]);
const EINDSTAND_VAN = new Map(EINDSTANDEN.map(e => [e.stand, e]));

/* De drie treden van de terugkoppeling, met de betekenis van DemocratieOS:
     klaargezet  de uitkomst staat vast en is te LEZEN in /api/beraad/mijn;
     gewekt      er is bovendien een melding op de sleutel gezet (een wek, geen bewijs);
     gezien      het lid heeft de uitkomst zelf geopend.
   Een trede gaat nooit terug. */
const TREDEN = Object.freeze(['klaargezet', 'gewekt', 'gezien']);

/* DE KLEINE-GROEPSGRENS (besluit 4 en par. 9.1 van GEMEENSCHAP-FASE0.md).
   Onder vijf uitgebrachte stemmen geeft het beraad GEEN aantallen, ook niet na
   het sluiten: bij drie stemmers zegt "2 voor, 1 tegen" de drie mensen in de
   kamer wie de tegenstemmer was. Er komt dan alleen de eindstand uit. Vijf is de
   ondergrens die kern/bedrijfsmaat/poort.js voor de kleinste klasse (zaken)
   hanteert; voorstel (d) van par. 9.1 -- de grens als klasse IN die poort -- is
   een besluit dat nog openstaat, en tot dan staat de grens hier, met naam.
   Unanimiteit en differentie vangt een drempel niet: daartegen helpt alleen dat
   de aantallen nooit tussentijds verschijnen (zie ./zicht.js) en dat een
   GEVOELIG beraad nooit een verhouding toont. */
const MIN_STEMMERS = 5;

const VRAAG_MAX = 300, TEKST_MAX = 1500, VOORSTEL_MAX = 3000, TOELICHTING_MAX = 600;
const ITEMS_PER_RONDE = 400;

module.exports = { STANDEN, KEUZES, SOORTEN, EINDSTANDEN, EINDSTAND_VAN, TREDEN, MIN_STEMMERS,
  VRAAG_MAX, TEKST_MAX, VOORSTEL_MAX, TOELICHTING_MAX, ITEMS_PER_RONDE };
