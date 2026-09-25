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
  { code: 'PSEUDONIMITEIT', stand: 'onbewezen',
    wat: 'een inbrenger is niet via andere gegevens tot een mens terug te voeren',
    sluit: 'fase C: de burgerpaden pseudoniem in het handelingsspoor en apiSpoor (besluit van 25 september 2026), ' +
      'dan een doorzoeking van de hele database op een sleutel en een kwestie samen, en de koppelaanval via alles wat ' +
      'het kantoor kan lezen. Het tijdstip van de wek is nog een zijkanaal' }
];

module.exports = { BEWIJSSTAND };
