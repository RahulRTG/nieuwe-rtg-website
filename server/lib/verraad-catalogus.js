/* ============================================================================
   DE CATALOGUS VAN VERRADEN -- de lijst, los van de motor die hem gebruikt.

   WAAROM DIT EEN EIGEN BESTAND IS. Hij stond in ./verraad.js en duwde dat
   bestand over de tienkilobytegrens van keuringsregel 13 zodra er een verraad
   bijkwam. Dat is geen toeval maar de vorm: deze lijst GROEIT met opzet -- elke
   regel met `waar: null` is een faalmoment dat nog gebouwd moet worden, en de
   bedoeling is dat die er op een dag allemaal in staan. Een lijst die hoort te
   groeien, hoort niet onder hetzelfde plafond te leven als de motor ernaast.

   De alternatieven waren slechter: het commentaar wegknippen kost precies de
   redenering die de lijst bruikbaar maakt, en een uitzondering op de
   omvangsregel laat een lijst groeien die juist hoort te krimpen.

   ./verraad.js exporteert `CATALOGUS` gewoon door, dus voor elke lezer
   verandert er niets.
   ========================================================================== */
'use strict';

/* DE CATALOGUS. Elk verraad noemt wat het nabootst, waar het is INGEBOUWD, en
   -- als het dat niet is -- waar het zou moeten. Een catalogusregel zonder
   `waar` is een voornemen, en de dekking van de control telt hem niet mee.

   `waar: null` betekent ONTWORPEN, NIET INGEBOUWD. Dat staat er met opzet in
   plaats van eruit: een lijst die alleen toont wat af is, laat niet zien hoe
   ver hij nog moet. */
const CATALOGUS = [
  { naam: 'schrijf-verloren',
    wat: 'de database bevestigt de schrijfactie en bewaart hem niet',
    waar: 'server/db/index.js save()',
    raakt: 'STATE, ROLLBACK -- de aanroeper krijgt zijn 200 en gelooft dat het vaststaat' },
  { naam: 'schrijf-faalt',
    wat: 'de schijf meldt ruimte, de schrijfactie mislukt alsnog',
    waar: 'server/db/index.js save()',
    raakt: 'FAILURE -- een aanroeper die dit stil wegvangt, meldt succes over niets' },
  /* DRIE DODEN OP DRIE MOMENTEN, en ze horen bij elkaar te staan omdat ze
     samen de interne crashgrenzen van scripts/lib/crashtaxonomie.js afdekken.
     Eerst was er alleen de derde; CRASHAS.json mat daardoor 90 van de 135
     bestaande grenzen als NIET TE BEPROEVEN -- geen onwetendheid maar
     ontbrekend gereedschap.

     Het verschil tussen de drie is het hele punt. Wie ze samenvoegt tot "een
     crash", meet drie keer hetzelfde moment en noemt dat dekking.

     TWEE WOORDENLIJSTEN, EN ZE LIEPEN HIER EEN KEER DOOR ELKAAR. `raakt` noemt
     een SCHAKEL van de bewijsmatrix, `contract` een CRASHCONTRACT uit
     scripts/lib/crashtaxonomie.js. Waarom dat verschil ertoe doet, staat in
     test/verraad.test.js, dat het ook bewaakt. */
  { naam: 'sterf-voor-mutatie',
    wat: 'het proces sterft VOORDAT er iets is gemuteerd',
    waar: 'server/db/bijeen.js bijeen(), voor fn()',
    contract: 'ATOMIC',
    raakt: 'ROLLBACK, STATE -- er hoort geen spoor te zijn, en een retry hoort schoon te beginnen' },
  /* EN DE DERDE IS ER NIET, met een GEMETEN reden in plaats van een voornemen.
     db/sqlite.js schrijft met `BEGIN IMMEDIATE ... COMMIT`, dus de save heeft
     geen waarneembaar middelpunt: geprobeerd tussen schrijfopdracht en
     checkpoint, en scripts/crashgrenzen.js mat er een tweede sterf-na-commit.
     Daarom `waar: null` en geen regel code. Op een opslag die WEL kan scheuren
     hoort hij alsnog -- server/db/duurzaam.js draagt de vindplaats. */
  { naam: 'sterf-in-de-opslag',
    wat: 'het proces sterft MIDDENIN de onderliggende schrijfactie',
    waar: null,
    contract: 'ATOMIC',
    raakt: 'ROLLBACK -- niet te bouwen op een transactionele opslag: er is geen middelpunt' },
  { naam: 'sterf-na-commit',
    wat: 'het proces sterft NA de duurzame schrijfactie en VOOR het antwoord',
    waar: 'server/db/index.js saveDuurzaam()',
    contract: 'RECOVERABLE',
    raakt: 'IDEMPOTENCY, ROLLBACK -- de klant weet niet dat het gelukt is en probeert opnieuw' },
  /* DE VIERDE DOOD, en hij gaat over iets anders dan de drie hierboven: niet of
     de UITKOMST overleeft maar of de MENS het te horen krijgt. CRASHAS.json had
     `na-commit-voor-bericht` op 45 van de 45 routes `onbekend` staan, en niet
     omdat niemand keek maar omdat er geen moment was om in te sterven.

     HET STERFT VOOR DE MELDING BESTAAT, en dat is met opzet de vroege kant.
     Sterven NA de schrijfactie van de melding is de milde variant -- de regel
     staat dan in de lijst van het lid en hij ziet hem bij de eerstvolgende keer
     laden. Wat er werkelijk toe doet is de dure kant: de handeling staat vast en
     er bestaat geen melding, ook niet om later alsnog te bezorgen. */
  { naam: 'sterf-voor-bericht',
    wat: 'het proces sterft NA de handeling en VOORDAT de melding is weggeschreven',
    waar: 'server/opzet/meldaan.js schrijf() EN server/opzet/meldingen.js notify(), voor de melding wordt weggeschreven',
    contract: 'RECOVERABLE',
    raakt: 'STATE -- de uitkomst staat vast en de betrokkene hoort er nooit van' },
  { naam: 'klok-vooruit',
    wat: 'de klok loopt voor of achter',
    waar: 'server/lib/klok.js (RTG_KLOK, eigen schakelaar)',
    raakt: 'FAILURE -- verlopen sessies, mandaten en certificaten' },
  { naam: 'cache-oud',
    wat: 'de cache geeft een correct maar verouderd antwoord',
    waar: null,
    raakt: 'STATE -- een saldo dat al is uitgegeven' },
  { naam: 'dubbel-verzoek',
    wat: 'hetzelfde verzoek komt twee keer binnen',
    waar: null,
    raakt: 'IDEMPOTENCY -- twee keer afschrijven op een herhaalde POST' },
  { naam: 'volgorde-om',
    wat: 'gebeurtenis B arriveert voor gebeurtenis A',
    waar: null,
    raakt: 'STATE -- een annulering die voor de boeking aankomt' },
  { naam: 'traag-antwoord',
    wat: 'een afhankelijkheid antwoordt tergend langzaam',
    waar: null,
    raakt: 'FAILURE -- een timeout die niemand heeft ingesteld' },
  { naam: 'twee-leiders',
    wat: 'twee servers denken allebei de actieve te zijn',
    waar: null,
    raakt: 'STATE -- dubbele verwerking van dezelfde rij' }
];

module.exports = { CATALOGUS };
