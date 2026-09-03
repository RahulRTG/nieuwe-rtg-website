/* ============================================================================
   DE BEDOELING PER SCHRIJFROUTE VAN RTG SERVICE -- DE KANT VAN HET LID.

   Eenentwintig routes, allemaal nieuw, dus allemaal met een contract voordat ze
   bestaan: MUTATIECONTRACT.md zegt dat `onbekend` geen waarde is maar een
   weigering zodra iets NIEUW publiek aanroepbaar wordt. Ze in
   LEGACY_PENDING_CLASSIFICATION laten vallen zou het enige getal dat naar nul
   moet met eenentwintig laten groeien.

   ER IS ECHT GEMETEN, EN DAT WAS DE MOEITE WAARD. Elke route hieronder is twee
   keer aangeroepen met exact hetzelfde lijf en zonder sleutel -- de kale ronde --
   met voor en na een opname van de collecties van deze laag. Die ronde vond vier
   fouten die geen enkele toets zag:

     1. Een bevestiging werd onbruikbaar zodra de zaak van team wisselde, en dat
        gebeurt juist bij "ik wil een mens". Het lid kreeg dan een weigering over
        een team waar hij nooit van gehoord had, voor toegang die hij net had
        goedgekeurd. Opgelost met `binnenTeam` in kern/service/machtiging.js.
     2. Het hergebruik van een lopend verzoek keek naar (zaak, mens) en NIET naar
        wat er gevraagd werd. Een medewerker die om iets anders vroeg kreeg
        stilletjes het oude verzoek terug, en het lid keurde iets anders goed dan
        er gevraagd was. Opgelost in kern/service/bevestiging.js.

     3. Twee keer bundelen stuurde elke gekoppelde melder een tweede keer
        dezelfde mededeling. `koppel()` ving de dubbele koppeling wel af, maar
        het BERICHT eronder niet -- en juist daar zit de schaal: bij twintig
        melders is een dubbelklik twintig overbodige berichten.
     4. Twee keer "hersteld" stuurde iedereen opnieuw dat de storing verholpen
        was. Een tweede exemplaar van dat bericht maakt het eerste
        ongeloofwaardig.

   Dat is precies waarom deze standen een meting eisen en geen lezing: alle vier
   die takken zagen er bij het lezen prima uit.

   DE AFTEKENING IS EERLIJK OVER WAT ZE IS: gemeten en voorgesteld door Claude,
   niet door een mens nagelezen. Wie er een naleest en zijn naam eronder wil
   zetten, vervangt hem hier.

   "Eenentwintig" hierboven is inmiddels zevenentwintig: de patroon-, status- en
   foutlaag kwamen er later bij en zijn door dezelfde ronde gehaald.

   De kantoorkant staat in ./mutatiecontracten-service-kantoor.js -- samen gingen
   ze over de omvangsgrens, en de naad ligt op de LEZER, net als bij de routes
   zelf. De helpers hieronder worden daar hergebruikt en niet overgeschreven.
   ========================================================================== */
'use strict';

const AFGETEKEND = {
  door: 'Claude (Opus 5), uit een kale meetronde over deze routes (twee keer hetzelfde lijf, ' +
    'zonder sleutel, met een opname van de servicecollecties incl. de tijdlijn voor en na); ' +
    'niet door een mens nagelezen',
  op: '2026-09-02'
};
const OP = '2026-09-02';
const zetel = 'balie-zetel (kern/ledenbalie-zetels.js)';

/* Een leesroute. `nagekeken` sluit het gat dat de opslagmeter laat: die ziet
   alleen collecties, en niet een bestand, een teller of een externe dienst. */
const LEEST = (route, mutatieId, wat) => ({
  [route]: {
    mutatieId,
    semantiek: { klasse: 'idempotent' },
    toegang: { klasse: route.includes('/office/') ? 'CAPABILITY_GATED' : 'AUTHENTICATED',
      bevoegdheid: route.includes('/office/') ? zetel : null },
    stand: 'NOT_APPLICABLE',
    herkomst: 'mens',
    afgetekend: AFGETEKEND,
    bewijs: { gemeten: 'kale ronde: beide aanroepen lieten de servicecollecties (zaken, tijdlijnen, ' +
      'machtigingen, bevestigingen) byte voor byte gelijk', op: OP },
    nagekeken: 'Claude las de handler en alles wat hij aanroept: ' + wat + '. Geen schrijfvorm, ' +
      'geen bestand, geen uitgaand bericht.'
  }
});

/* Een tweede aanroep IS een tweede handeling. De meting bevestigt het: de
   tweede oproep veranderde de opslag opnieuw. */
const TWEEDE = (route, mutatieId, waarom, objectVeld) => ({
  [route]: {
    mutatieId,
    semantiek: { klasse: 'nietHerhaalbaar' },
    toegang: objectVeld
      ? { klasse: 'OBJECT_SCOPED', objectVeld,
          uitleg: 'de zaak uit `' + objectVeld + '`, en alleen die van de melder zelf' }
      : { klasse: route.includes('/office/') ? 'CAPABILITY_GATED' : 'AUTHENTICATED',
          bevoegdheid: route.includes('/office/') ? zetel : null },
    stand: 'INTENTIONALLY_NON_IDEMPOTENT',
    herkomst: 'mens',
    afgetekend: AFGETEKEND,
    bewijs: { gemeten: 'kale ronde: de TWEEDE aanroep veranderde de opslag opnieuw -- precies wat ' +
      'deze klasse belooft', op: OP },
    waarom
  }
});

/* Eenmalig. De tweede aanroep wordt GEWEIGERD, en dat is een toestandscontrole
   en geen idempotentie -- MUTATIECONTRACT.md noemt dat onderscheid met zoveel
   woorden. De meting laat allebei de helften zien: geen tweede effect, en een
   foutcode in plaats van een stille herhaling. */
const EENMALIG = (route, mutatieId, uitleg, waarom, code) => ({
  [route]: {
    mutatieId,
    semantiek: { klasse: 'hooguitEens' },
    toegang: uitleg
      ? { klasse: 'OBJECT_SCOPED', objectVeld: 'id', uitleg }
      : { klasse: 'CAPABILITY_GATED', bevoegdheid: zetel },
    stand: 'INTENTIONALLY_NON_IDEMPOTENT',
    herkomst: 'mens',
    afgetekend: AFGETEKEND,
    bewijs: { gemeten: 'kale ronde: de eerste aanroep veranderde de opslag, de tweede niet en gaf ' +
      code + ' -- geweigerd op de toestand, niet stil herhaald', op: OP },
    waarom
  }
});

/* Gemeten beschermd: de tweede aanroep had GEEN tweede effect, en de route
   handelt dat zelf af (geen duplicaatregel in lib/idemsleutels.js nodig). */
const BESCHERMD = (route, mutatieId, hoe) => ({
  [route]: {
    mutatieId,
    semantiek: { klasse: 'idempotent' },
    toegang: { klasse: 'CAPABILITY_GATED', bevoegdheid: zetel },
    stand: 'PROTECTED',
    herkomst: 'mens',
    afgetekend: AFGETEKEND,
    bewijs: { gemeten: 'kale ronde: de tweede aanroep liet de opslag ongewijzigd. Eigen afhandeling ' +
      'in de route: ' + hoe, op: OP }
  }
});

const CONTRACTEN = Object.assign({},
  LEEST('POST /api/service/keuzes', 'service.keuzes',
    'de vaste tabellen uit kern/service/klassen.js plus mens.overname()'),
  LEEST('POST /api/service/mijn', 'service.mijn', 'serviceZaken.lijst(), een filter over de collectie'),
  LEEST('POST /api/service/zaak', 'service.zaak', 'dossier() plus de klokken, allemaal afgeleid uit de tijdlijn'),
  LEEST('POST /api/service/bevestigingen', 'service.bevestigingen', 'bevestiging.voorLid(), een filter'),

  TWEEDE('POST /api/service/open', 'service.open',
    'Twee keer melden is twee meldingen. Wie hetzelfde nog eens instuurt kan een tweede probleem ' +
    'hebben; samenvoegen is een OORDEEL en hoort bij een mens, niet bij een duplicaatregel. De ' +
    'chat-haak in opzet/servicelaag.js hergebruikt wel een lopende zaak, omdat de melder daar geen ' +
    'knop indrukt.'),
  TWEEDE('POST /api/service/bericht', 'service.bericht',
    'Een tweede bericht is een tweede bericht. Wie hetzelfde twee keer stuurt, heeft het twee keer ' +
    'gezegd, en dat mag een medewerker zien.', 'id'),
  TWEEDE('POST /api/service/mens', 'service.mens',
    'Elk verzoek om een mens telt mee: kern/service/mens.js gebruikt dat aantal om te bepalen of de ' +
    'AI nog mag afweren. Zou dit idempotent zijn, dan zou een lid dat drie keer vraagt er nog steeds ' +
    'een keer gevraagd hebben, en dan bestaat die grens niet.', 'id'),

  EENMALIG('POST /api/service/bevestig', 'service.bevestig',
    'de bevestiging uit `id`; de kern weigert wanneer de melder niet die van het verzoek is',
    'Eenmalig zijn IS de functie: een bevestiging die twee keer werkt, is een machtiging die twee ' +
    'keer opengaat. De tweede aanroep loopt op de toestand stuk ("dit verzoek is gebruikt").', '400'),
  EENMALIG('POST /api/service/weiger', 'service.weiger',
    'de bevestiging uit `id`, en alleen die van de melder',
    'Spiegelbeeld van bevestigen: de tweede aanroep loopt op de toestand stuk ("dit verzoek is ' +
    'geweigerd") en niet op een duplicaatregel.', '400'),

  /* De persoonlijke stand. Leest de eigen lopende zaken en wat Service over de
     gekoppelde storingen heeft GEMELD -- en zegt met zoveel woorden dat "niets
     bekend" iets anders is dan "alles werkt". */
  LEEST('POST /api/service/stand', 'service.stand',
    'persoonlijk.stand(): een filter over de eigen zaken plus patronen.gemeldHersteld(), een opzoeking')
);

module.exports = { CONTRACTEN, AFGETEKEND, LEEST, TWEEDE, EENMALIG, BESCHERMD, OP, zetel };
