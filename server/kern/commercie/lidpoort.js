/* LOOPT DE AFSPRAAK VAN DIT LID NOG? -- de vraag die in dit huis nog nergens
   gesteld werd.

   DE METING DIE HIERONDER LIGT, en ze is scherper dan een ontbrekende functie.
   Geteld op 11 september 2026 over server/routes/: 46 bestanden met een
   ledenroute toetsen de pas van het lid, 45 daarvan vragen hetzelfde --
   `tier === 'guest'`, oftewel *is dit uberhaupt een lid* -- en precies een
   (borden.js) vraagt naar een specifieke betalende pas. Het aantal dat vraagt of
   de OVEREENKOMST nog loopt is nul.

   Dat is geen slordigheid maar een gat in de bedrading. `../commercie/contract.js`
   is een volwaardige overeenkomstmotor met acht standen en een overgangstabel, en
   de toegang van een lid hangt aan `sess.tier` -- een veld dat een mens een keer
   omhoog zet (`accounts.setTier`) en dat daarna nooit meer beweegt. Een opgezegd
   contract laat de pas dus staan, en geen van die 46 toetsen merkt dat.

   WAT DIT BESTAND WEL EN NIET IS. Het beoordeelt, en het beslist niets. Geen db,
   geen opslag, geen schaduwlaag: de aanroeper geeft de pas en het contract, en
   krijgt een stand met een reden terug. Dat is de vorm van
   ../identiteit/vertrouwen.js, dat met opzet niets bewaart -- AFSPRAAK.md par.
   5.3: de projectie wordt GEREKEND en nooit met de hand gezet.

   VIER STANDEN, EN DE DERDE IS HET HELE PUNT:

     NIET_BETALEND   de gratis app; er is geen afspraak en dat hoort zo
     LOOPT           er is een contract en het loopt
     GEEINDIGD       er IS een afspraak, en die is afgelopen -- de pas staat nog
     GEEN_CONTRACT   er is geen afspraak gevonden bij een BETALENDE pas

   GEEN_CONTRACT IS MET OPZET GEEN GEEINDIGD, en wie die twee samenvoegt maakt het
   getal waardeloos. De meeste betalende leden van vandaag hebben hun pas langs een
   andere weg gekregen -- een demo-persona, een geseed account, een aanmelding van
   voor de contractmotor. "Ik vind geen afspraak" betekent dus *ik weet het niet*
   en niet *er is niets afgesproken*. CONTROLPLANE.md zegt dat in een regel:
   `ONBEKEND` is geen synoniem van `WEIGEREN` -- een storing hoort niet te klinken
   als een overtreding. Zou je ze optellen, dan meldt de schaduw dat vrijwel elk
   lid tegengehouden zou worden, leest iedereen dat als ruis, en is het echte
   getal (hoeveel passen hun eigen afspraak overleven) niet meer te vinden.

   DAAROM TWEE SCHADUWREGELS EN NIET EEN. ./schaduw.js rekent rijpheid, vrijstelling
   en stand per REGEL uit, en deze twee vragen een ander besluit:

     lidcontract.geeindigd   afdwingen is verdedigbaar: de afspraak is voorbij
     lidcontract.ontbreekt   afdwingen sluit elk bestaand lid buiten -- een
                             productbesluit (AFSPRAAK.md stap 7) en geen techniek

   Met een regel zou een mens die de eerste aanzet de tweede meekrijgen, en dat is
   precies het soort beslissing dat niemand bewust neemt.

   WAT ER NIET IN STAAT: een pad-tabel. Bij ./routepoort.js hoort die er wel, want
   daar verschilt de vraag per route (kassa is niet personeel). Hier is de vraag
   voor elke ledenroute dezelfde -- loopt de afspraak -- en een tabel zou een lijst
   GOKKEN zijn over welke van de 46 bestanden "echt" een betalende pas nodig heeft.
   Die 46 dragen die kennis vandaag niet; ze vragen iets anders. Een tabel
   verzinnen zou de meting vervangen door een mening. */
'use strict';

const { BETALEND, pasVan } = require('../passen');
const { LOPEND } = require('./contract/vorm');

const STAND = {
  NIET_BETALEND: 'NIET_BETALEND',
  LOOPT: 'LOOPT',
  GEEINDIGD: 'GEEINDIGD',
  GEEN_CONTRACT: 'GEEN_CONTRACT'
};

/* De twee regels, met per stuk waarom hij apart staat. Geen vrijstelling: een
   vrijstelling beweert dat een regel NIEMAND iets afpakt, en dat is hier
   aantoonbaar onwaar -- beide pakken een lid zijn pas af. ./routepoort.js mag die
   som maken omdat daar elke trede het onderdeel kan bevatten; hier niet. */
const REGELS = [
  { id: 'lidcontract.geeindigd', stand: STAND.GEEINDIGD,
    wat: 'de pas van dit lid is betalend, en zijn overeenkomst is afgelopen' },
  { id: 'lidcontract.ontbreekt', stand: STAND.GEEN_CONTRACT,
    wat: 'de pas van dit lid is betalend, en er is geen overeenkomst gevonden' }
];

const REGEL_VAN = REGELS.reduce((m, r) => (m[r.stand] = r.id, m), {});

/* HET OORDEEL. `contract` is de rij uit ../commercie/contract.js of null; `tier`
   is wat de sessie zegt. Beide komen van de aanroeper, want deze laag kent de
   ledentabel niet en hoort die niet te kennen.

   De pas komt door `pasVan` en niet rechtstreeks uit de tier: een onbekende tier
   valt daar op de instappas terug, en dat besluit hoort op EEN plek te staan
   (../passen.js). Hier nog een keer beslissen wat een onbekende tier betekent,
   zou de tweede plek zijn. */
function beoordeel(tier, contract) {
  const pas = pasVan(tier);
  if (!BETALEND.includes(pas))
    return { stand: STAND.NIET_BETALEND, pas, bezwaar: null, regel: null };

  if (!contract)
    return { stand: STAND.GEEN_CONTRACT, pas, regel: REGEL_VAN[STAND.GEEN_CONTRACT],
      bezwaar: 'de pas is ' + pas + ' en er is geen lidmaatschapsafspraak gevonden' };

  if (LOPEND.has(contract.status))
    return { stand: STAND.LOOPT, pas, bezwaar: null, regel: null,
      contractId: contract.id || null, status: contract.status };

  return { stand: STAND.GEEINDIGD, pas, regel: REGEL_VAN[STAND.GEEINDIGD],
    contractId: contract.id || null, status: contract.status,
    eindigdeOp: contract.eindigtOp || null,
    bezwaar: 'de pas is ' + pas + ' en de overeenkomst staat op ' + contract.status +
      (contract.eindigtOp ? ' sinds ' + contract.eindigtOp : '') };
}

/* WAT DE SCHADUW ERVAN MAAKT. De weging gaat per regel, en een lid levert er
   altijd hoogstens EEN -- de standen sluiten elkaar uit. `NIET_BETALEND` levert er
   geen: een gratis lid in de teller zou het deel verdunnen met mensen over wie de
   regel nooit gaat, en dan zakt `zouTegenhouden / waarnemingen` terwijl er niets
   verbetert.

   ER GAAT GEEN IDENTITEIT IN, EN DAT IS EEN GRENS EN GEEN VERGETELHEID. Deze
   functie nam eerst een `wie` aan en gaf die door als voorbeeld. Dat leek
   onschuldig -- ./schaduw.js bewaart voorbeelden juist omdat "120 keer" zonder
   "van wie, waarop" niet te beoordelen is -- en het was het niet:

   1. wat er dan ontstaat is een LIJST LEDEN VAN WIE DE PAS MOGELIJK VERVALT, in
      een teller, zonder bewaartermijn. Precies het soort spoor dat
      scripts/afleidbaar.js meldt.
   2. en het lid kan hem niet meer kwijt. `test/vergeten-gezelschap.test.js` vond
      dat ook meteen: na het uitoefenen van het recht op vergetelheid stond de
      sleutel nog in `schaduwregels`. Die tak hield tot nu toe alleen zaakcodes
      (../commercie/routepoort.js), dus de bezem kwam er nooit langs.

   De reparatie is NIET de tak vrijstellen en niet de bezem uitbreiden, maar de
   identiteit niet opslaan: het PRODUCT van deze laag is een getal, en wat een mens
   nodig heeft om te besluiten of hij de regel aanzet is de STAND -- loopt er geen
   afspraak, of is er geen gevonden. Die gaat nog steeds mee als `wat`. Er is dus
   geen `wie`-parameter meer, en dat is met opzet: een ongebruikt argument vult de
   volgende aanroeper alsnog.

   Wat dat kost, en dat hoort erbij: een mens kan op het bord niet zien of het
   dezelfde drie leden zijn of driehonderd verschillende. Dat is een bekende prijs
   voor een getal dat niemand hoeft te vergeten.

   ALTIJD `door: true` ZOLANG DE REGEL IN DE SCHADUW STAAT -- dat komt niet uit
   deze functie maar uit ./schaduw.js zelf, waar het structureel is. Hier staat
   alleen dat we het antwoord NIET omzeilen: wat de schaduw teruggeeft is wat de
   aanroeper krijgt. */
function weeg(schaduw, oordeel) {
  if (!schaduw || !oordeel || oordeel.stand === STAND.NIET_BETALEND)
    return { door: true, gewogen: false, oordeel };
  /* Een lid met een lopende afspraak is een WAARNEMING zonder bezwaar op de regel
     die over zijn stand gaat -- anders weet niemand of 12 afgelopen contracten
     veel of weinig is. Hij telt op de geeindigd-regel, want dat is de regel
     waarvan hij het tegenvoorbeeld is. */
  const id = oordeel.regel || REGEL_VAN[STAND.GEEINDIGD];
  const w = schaduw.weeg(id, oordeel.bezwaar, { wie: null, wat: oordeel.stand });
  return { door: w.door !== false, gewogen: true, modus: w.modus, regel: id, oordeel };
}

module.exports = { STAND, REGELS, beoordeel, weeg };
