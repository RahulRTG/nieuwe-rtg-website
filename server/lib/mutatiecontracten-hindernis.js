/* ============================================================================
   MUTATIECONTRACTEN -- ZESTIEN DIE DE PROEFOPSTELLING NOOIT AAN HET WERK KREEG.

   Deel van ./mutatiecontracten.js.

   Deze zestien maten allemaal hetzelfde: de EERSTE kale oproep deed al geen
   werk. Een 409 omdat het ding er niet was, een 404 omdat het ding er niet was,
   een 429 omdat de rem aansloeg, een 401 omdat er geen sessie was, een 400 omdat
   de body niet klopte. Wat de tweede oproep dan doet is niet gemeten, want er is
   nooit een eerste handeling geweest om te herhalen.

   HET IS VERLEIDELIJK OM ZE PROTECTED TE NOEMEN. De kale ronde meldde ze als
   `beschermd`, en dat leest als "de herhaling deed niets". Maar wat er gebeurde
   is dat de EERSTE oproep niets deed, en dan is de tweede niet beschermd maar
   irrelevant. Dat is dezelfde valstrik als "een rem lijkt een deur", en bij de
   geldroutes (./mutatiecontracten-geldgrens.js) viel hij de andere kant op: daar
   WAS de weigering de bescherming, en daar is dat met een tweede meting
   aangetoond in plaats van gehoopt.

   Ze staan daarom op BLOCKED_BY_TEST_FIXTURE: wij weten het niet, en dit is
   waarom de proef er niet bij kwam. `watErMoetKomen` noemt per route de
   voorwaarde die scripts/lib/idemwereld.js moet klaarzetten -- de stand is een
   opdracht met een adres en geen wachtkamer.

   De handlers zijn wel gelezen, en dat is wat de opdracht bruikbaar maakt: er
   staat niet "kreeg 409" maar wat er had moeten bestaan.
   ========================================================================== */
'use strict';

const AFGETEKEND = {
  door: 'Claude (Opus 5), op grond van de gelezen handler naast de kale ronde; de stand zegt bewust ' +
    'dat het gedrag ONBEKEND is en niet dat het goed is; niet door een mens nagelezen',
  op: '2026-08-30'
};

/* DE SEMANTIEK STAAT HIER OP `onbekend`, EN DAT IS DE HELE POINTE. Deze stand
   zegt dat het gedrag bij een herhaling niet is vastgesteld; een van de vijf
   andere klassen invullen zou precies de uitspraak zijn die de meting niet
   draagt. kern/mutatie.js weigert `onbekend` aan de rand van het platform elke
   automatische herhaling -- de voorzichtige kant, en dat hoort hier ook. */
const geblokkeerd = (route, mutatieId, toegang, status, hindernis, watErMoetKomen) => [route, {
  mutatieId, herkomst: 'mens',
  semantiek: { klasse: 'onbekend' },
  toegang,
  stand: 'BLOCKED_BY_TEST_FIXTURE',
  bewijs: {
    gemeten: 'kale ronde: de EERSTE oproep gaf al ' + status + ' -- ' + hindernis + '. Er is dus geen ' +
      'eerste handeling geweest om te herhalen; wat een dubbeltik hier doet is niet vastgesteld',
    op: '2026-08-30'
  },
  watErMoetKomen,
  afgetekend: AFGETEKEND
}];

const CONTRACTEN = Object.fromEntries([
  geblokkeerd('POST /api/bedrijf/lid/ontkoppel', 'bedrijf.lid.ontkoppel', { klasse: 'OBJECT_SCOPED', objectVeld: 'lidToken' }, 409,
    'er was niets gekoppeld (server/bedrijf/aansluiting.js weigert dan met "Er is niets gekoppeld")',
    'een werknemer met een GEKOPPELDE rtgKey, zodat de eerste oproep echt loskoppelt en de tweede meet ' +
    'of dat een tweede handeling is'),
  geblokkeerd('POST /api/bestanden/upstart', 'bestanden.upstart', { klasse: 'AUTHENTICATED' }, 429,
    'de rem sloeg aan voordat de handler iets deed',
    'een eigen rem-emmer voor de proefopstelling, of een lid dat de rem nog niet heeft aangeraakt -- ' +
    'zolang de rem antwoordt, meet de ronde de rem en niet de route'),
  geblokkeerd('POST /api/member/pin/nieuw', 'member.pin.nieuw', { klasse: 'AUTHENTICATED' }, 429,
    'de rem sloeg aan; de route vraagt bovendien een bewijs (rtg-pin-vernieuw) dat de ronde niet had',
    'een lid met een geldig handelingsbewijs voor rtg-pin-vernieuw en een verse rem-emmer'),
  geblokkeerd('POST /api/command/zandbak/maak', 'command.zandbak.maak', { klasse: 'AUTHENTICATED' }, 409,
    'de zandbak met die naam bestond al',
    'een verse zandbaknaam per ronde; nu botst de eerste oproep op een zandbak uit een vorige ronde'),
  geblokkeerd('POST /api/command/zandbak/weg', 'command.zandbak.weg', { klasse: 'AUTHENTICATED' }, 404,
    'de zandbak die weg moest bestond niet',
    'eerst maken, dan twee keer weghalen -- de volgorde ontbreekt in de proefopstelling'),
  geblokkeerd('POST /api/logout', 'logout', { klasse: 'AUTHENTICATED' }, 401,
    'er was geen sessie om te beeindigen',
    'een ronde met een ECHTE sessie: uitloggen is bij uitstek de handeling waarvan je wilt weten wat de ' +
    'tweede druk doet, en juist die is hier niet gemeten'),
  geblokkeerd('POST /api/privacy/delete', 'privacy.delete', { klasse: 'AUTHENTICATED' }, 401,
    'er was geen sessie',
    'een wegwerplid dat echt gewist mag worden; test/vergeten.test.js zet die wereld al op en kan de ' +
    'bron zijn'),
  geblokkeerd('POST /api/office/merk/maak', 'office.merk.maak', { klasse: 'AUTHENTICATED' }, 409,
    'het merk bestond al',
    'een verse merknaam per ronde'),
  geblokkeerd('POST /api/office/rtgai/roer/terug', 'office.rtgai.roer.terug', { klasse: 'AUTHENTICATED' }, 400,
    'de body voldeed niet aan wat roerTerug() vraagt',
    'een geldige body voor het roer, plus een roer dat daadwerkelijk verzet IS -- terugzetten wat nooit ' +
    'verzet is, is geen handeling'),
  geblokkeerd('POST /api/pay/verzoek/betaal', 'pay.verzoek.betaal', { klasse: 'AUTHENTICATED' }, 409,
    'er stond geen openstaand betaalverzoek ("er is geen schuld meer")',
    'een openstaand betaalverzoek. LET OP: deze route bleef bewust buiten ' +
    './mutatiecontracten-geldgrens.js. Met sleutel gaf zij 409, en dat is een TOESTANDSCONTROLE en geen ' +
    'idempotentie -- de kop van ./idem-poort.js waarschuwt daar met zoveel woorden voor. Wie hier de ' +
    'wereld klaarzet, meet dus of de geldlaag de herhaling vangt of dat alleen de schuld op is'),
  geblokkeerd('POST /api/scim/v2/Users', 'scim.v2.users', { klasse: 'SERVICE_TO_SERVICE' }, 400,
    'de SCIM-body was ongeldig',
    'een geldige SCIM-gebruiker met een externalId; SCIM schrijft VAN buiten en is daarmee precies het ' +
    'soort koppeling waar een dubbeltik echt voorkomt'),
  geblokkeerd('POST /api/scim/v2/Groups', 'scim.v2.groups', { klasse: 'SERVICE_TO_SERVICE' }, 400,
    'de SCIM-body was ongeldig',
    'een geldige SCIM-groep, zelfde reden als bij Users'),
  geblokkeerd('POST /api/supplier/horeca/venue/publiceer', 'supplier.horeca.venue.publiceer', { klasse: 'AUTHENTICATED' }, 404,
    'er stond geen venue-concept klaar',
    'een zaak met een klaargezet venueConcept. De handler verhoogt een versie, verplaatst tafels en WIST ' +
    'het concept daarna -- de tweede oproep vindt dan niets meer, en of dat bescherming is of toeval ' +
    'moet gemeten worden'),
  geblokkeerd('POST /api/supplier/magnaat/studio/importeer', 'supplier.magnaat.studio.importeer', { klasse: 'AUTHENTICATED' }, 409,
    'het te importeren stuk bestond al',
    'een verse studio-import per ronde'),
  geblokkeerd('POST /api/supplier/overheid/kvk/inschrijven', 'supplier.overheid.kvk.inschrijven', { klasse: 'AUTHENTICATED' }, 409,
    'de zaak was al ingeschreven',
    'een zaak die NOG NIET is ingeschreven. Een tweede inschrijving is precies de dubbeltik die je hier ' +
    'niet wilt, dus dit is geen formaliteit'),
  geblokkeerd('POST /api/supplier/training/add', 'supplier.training.add', { klasse: 'AUTHENTICATED' }, 409,
    'er bestond al een tip met die titel',
    'een verse tiptitel per ronde; de titelbotsing is een toestandscontrole en niet de duplicaatlaag'),
  geblokkeerd('POST /api/supplier/training/remove', 'supplier.training.remove', { klasse: 'AUTHENTICATED' }, 404,
    'de tip die weg moest bestond niet',
    'eerst toevoegen, dan twee keer verwijderen')
]);

/* ============================================================================
   EN DE LAATSTE, DIE HIER NIET THUISHOORT MAAR NERGENS ANDERS BETER STAAT.

   /api/command/puls kwam als enige uit de ronde met een TEGENSPRAAK in plaats
   van een hindernis: de meting zei `beschermd`, terwijl ./idemsleutels.js hem
   een duplicaatregel `nietIdempotent` geeft ("de puls is een momentopname; twee
   keer vragen hoort twee momenten te geven"). Een stand die daar NOT_APPLICABLE
   van maakt, zou de twee assen tegen elkaar in laten wijzen.

   De handler is gelezen: kern/command/puls.js beeld() telt domeinen, runbooks en
   zaken bij elkaar en schrijft niets weg. Op de mutatie-as is dat inderdaad
   niets. Maar de duplicaatregel is de dragende uitspraak, en hij is juist: een
   laag die de tweede vraag met het eerste antwoord beantwoordt, geeft een
   BEDIENINGSBEELD terug dat niet meer klopt. Dat is dezelfde lezing als de
   controlerondes in ./idemsleutels-kaleronde-b.js -- de tweede ronde hoort met
   recht iets anders te vinden.
   ========================================================================== */
CONTRACTEN['POST /api/command/puls'] = {
  mutatieId: 'command.puls', herkomst: 'mens',
  semantiek: { klasse: 'nietHerhaalbaar' },
  toegang: { klasse: 'AUTHENTICATED' },
  stand: 'INTENTIONALLY_NON_IDEMPOTENT',
  waarom: 'de puls is een momentopname; twee keer vragen hoort twee momenten te geven, en een laag die ' +
    'de tweede vraag met het eerste antwoord beantwoordt toont een bedieningsbeeld dat niet meer klopt',
  bewijs: {
    gemeten: 'kale ronde: twee geslaagde oproepen zonder spoor in de opslag -- terecht, want de handler ' +
      'schrijft niets. Die meting zegt iets over de mutatie-as en niets over de duplicaat-as',
    op: '2026-08-30'
  },
  nagekeken: 'handler gelezen in server/kern/command/puls.js (beeld()): telt domeinen, runbooks en zaken ' +
    'bij elkaar tot een momentopname. NOT_APPLICABLE is daarom NIET gekozen: de duplicaatregel in ' +
    './idemsleutels.js verklaart deze route bewust tot nietIdempotent, en een laag die de tweede vraag ' +
    'met het eerste antwoord beantwoordt, laat een bedieningsbeeld zien dat niet meer klopt',
  afgetekend: AFGETEKEND
};

module.exports = CONTRACTEN;
