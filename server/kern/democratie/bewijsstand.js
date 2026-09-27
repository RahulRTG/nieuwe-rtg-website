/* ============================================================================
   WAT FASE B BEWEERT, EN HOE HARD (POLITIEK.md par. 18.1a).

   Een bewering is BEWEZEN als een toets hem kan laten zakken en dat met een
   mutatie is gezien, en ONBEWEZEN als dat niet zo is -- met een sluitweg. Er
   is geen derde stand "waarschijnlijk", en een onbewezen bewering wordt hier
   nooit weggelaten: een schuld die niet op de lijst staat, leest als een schuld
   die er niet is.

   De meter geeft deze lijst mee (`bewijsstand`), zodat wie het bord leest ook
   leest wat het bord NIET belooft. test/democratie.test.js houdt vast dat elke
   bewezen bewering een toetsbestand noemt dat bestaat, en elke onbewezen een
   sluitweg heeft. */
'use strict';

const BEWIJSSTAND = [
  { code: 'NIEMAND_KWIJT', stand: 'bewezen',
    wat: 'elke geaccepteerde kwestie is terug te vinden en heeft een verklaarbare toestand',
    toets: 'test/democratie.test.js',
    grens: 'bewezen op de meter en zijn zelfijking; onder crashes zie SQLITE_CRASH_CONSISTENCY' },
  { code: 'SQLITE_CRASH_CONSISTENCY', stand: 'bewezen',
    wat: 'honderd kwesties door een storm van crashes op sqlite: nul kwijt, nul onverklaard',
    toets: 'test/democratie-verlies.test.js',
    grens: 'op sqlite is gewoon wegschrijven al synchroon; dit bewijst de samenhang van de keten, niet de duurzaamheid van een andere opslag' },
  { code: 'UNDECLARED_RTG_DEPENDENCY', stand: 'bewezen',
    wat: 'elke afhankelijkheid van RTG staat verklaard in afhankelijkheden.js',
    toets: 'test/democratie-afhankelijk.test.js',
    grens: 'een verklaring is geen verhuizing: proef P3 zelf is niet gedaan' },
  { code: 'POSTGRES_DURABILITY', stand: 'onbewezen',
    wat: 'een bevestigde kwestie overleeft een crash op PostgreSQL',
    sluit: 'een PostgreSQL-versie van de verliesproef met een verse datamap per start; eerst een sterf-na-commit in de ' +
      'responspoort (server/db/postgres-verzoeken.js), want die vuurt op PostgreSQL vandaag nooit. Wat daarmee nog steeds ' +
      'niet te bewijzen is: een crash van de PostgreSQL-server zelf (fsync, synchronous_commit) en failover' },
  { code: 'INBRENG_IDEMPOTENT', stand: 'onbewezen',
    wat: 'opnieuw inbrengen na een verloren antwoord geeft dezelfde kwestie terug en niet een tweede',
    sluit: 'een verzoeksleutel van de client op de koppelingsrij (niet op de kwestie: DO-01), opgezocht en geschreven in ' +
      'dezelfde vastlegging als de kwestie, met een afdruk van het verzoek (409 bij hetzelfde sleutel en een ander ' +
      'onderwerp); daarna de verliesproef met een herhaling na elke dood. De bestaande duplicaatlagen staan in het ' +
      'geheugen en overleven een herstart niet' },
  /* Fase C (aanvalsfase). Elke bewezen bewering is met een mutatie aan het
     zakken gezien; de grens zegt wat de toets NIET dekt. */
  { code: 'NEUTRAAL_C1', stand: 'bewezen',
    wat: 'vier synthetische actoren (Noord, Midden, Zuid en een zonder binding) met hetzelfde scenario eindigen in dezelfde toestand',
    toets: 'test/democratie-aanval.test.js',
    grens: 'deze laag kent geen register van politieke bindingen: de binding staat alleen in wat de burger zelf aanlevert. Een register in een latere fase vraagt deze proef opnieuw' },
  { code: 'MACHTSNEUTRAAL', stand: 'bewezen',
    wat: 'eigenaar, kantoor, gedeelde code, zaak en bord krijgen geen voordeel; wie inbracht beslist niet, en een ingetrokken kwestie heropent het kantoor niet',
    toets: 'test/democratie-aanval.test.js',
    grens: 'een toets beschermt tegen vergissingen en niet tegen de eigenaar die de code verandert: die bescherming zit in statuten, review en een extern anker (POLITIEK.md par. 12)' },
  { code: 'ALLEEN_GLOBAAL', stand: 'bewezen',
    wat: 'het bord kan democratie alleen voor iedereen uitzetten, nooit per persoon, plaats, land, pas, genre of canary',
    toets: 'test/democratie-grondwet.test.js',
    grens: 'de globale noodstop bestaat en mag bestaan: hij zet uit voor iedereen, ook voor de eigenaar' },
  { code: 'PSEUDONIEM_SPOOR', stand: 'bewezen',
    wat: 'het handelingsspoor en het API-spoor dragen bij een burgerpad geen sleutel, geen afdruk en alleen de dag; de zaakdoos-kloon draagt geen DemocratieOS; op schijf staat de sleutel nergens naast een kwestie behalve in de koppeling',
    toets: 'test/democratie-aanval.test.js',
    grens: 'de bezem leest de JSON-opslag; SQLite en PostgreSQL bewaren dezelfde inhoud in een ander doosje, en backups en snapshots zijn een kopie van de opslag en dragen de koppeling dus ook' },
  { code: 'WEK_EERLIJK', stand: 'bewezen',
    wat: 'een wek die de rust of de voorkeur van het lid tegenhield, blijft klaargezet en wordt niet als gewekt geboekt',
    toets: 'test/democratie-grondwet.test.js',
    grens: 'herbezorgen is een kantoorhandeling; er is geen automatische tweede poging na de rust' },
  { code: 'ZIJKANALEN', stand: 'onbewezen',
    wat: 'een inbrenger is ook via tijd en volgorde niet tot een mens terug te voeren',
    sluit: 'drie zijkanalen staan open en zijn niet gemeten: de VOLGORDE van regels in een keten (een pseudonieme regel staat tussen regels op sleutel van hetzelfde moment), het tijdstip van de wek naast een eindstand, en `laatst` in de kostenmeter per lid. Sluiten vraagt een meting van hoe goed een kantoorlezer ze kan koppelen, niet een aanname' }
];

module.exports = { BEWIJSSTAND };
