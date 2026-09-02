/* WEKKERS DIE MET OPZET NIET SCHAKELBAAR ZIJN.

   scripts/wekkers.js telt wat werk kan beginnen zonder dat iemand een pad
   opvraagt, en of er een functie bestaat die die code raakt. Nul functies leest
   als een gat, en voor een deel is dat ook zo -- maar niet voor alles.

   Het platformregister voert die redenering al voor routes
   (kern/platformregister/bediening.js): "een schakelaar die de schakelkast
   uitzet is geen schakelaar", "een gezondheidscontrole die je kunt uitzetten
   meldt nooit meer iets". Voor wekkers geldt hetzelfde: de klok die de database
   schoonhoudt, de bus zelf, de rem en het schild horen niet aan een
   functieschakelaar. Ze horen alleen wel OPGESCHREVEN te zijn, want een
   uitzondering die niemand kent is een gat.

   Een regel is { bestand, reden }. Wat hier niet op staat en geen functie raakt,
   telt als onverklaard -- en dat is het getal dat naar nul moet.

   WAT HIER NIET IN HOORT: een wekker die echt bij een functie hoort. Die
   verklaar je niet weg, die krijgt een functie. */
'use strict';
module.exports = [
  /* DE MACHINE ONDER HET HUIS. Zelfde soort als de bediening in het
     platformregister: dit is niet een functie van RTG maar datgene waarop elke
     functie draait. */
  { bestand: 'server/bus.js', reden: 'de berichtenbus zelf; een bus die je uit kunt zetten levert geen enkel bericht meer af' },
  { bestand: 'server/redis.js', reden: 'de gedeelde verbinding onder die bus' },
  { bestand: 'server/db/redis.js', reden: 'idem: de opslagkant van diezelfde verbinding' },
  { bestand: 'server/db/postgres.js', reden: 'de database; zonder klok geen verbindingsonderhoud en dus geen opslag' },
  { bestand: 'server/db/sqlite.js', reden: 'idem voor de lokale opslag' },
  { bestand: 'server/db/tx/ledger.js', reden: 'het grootboek; een boekhouding met een uitknop is geen boekhouding' },
  { bestand: 'server/rem.js', reden: 'de rem: hij beschermt het huis tegen te veel verkeer, en dat hoort niet af te hangen van een functiestand' },
  { bestand: 'server/ai-rem.js', reden: 'zelfde reden, voor de AI-kant' },
  { bestand: 'server/kern/schild.js', reden: 'het schild; een beveiliging met een schakelaar is een deur met het slot aan de binnenkant' },
  { bestand: 'server/lib/acme.js', reden: 'de certificaten; loopt de vernieuwing niet, dan valt HTTPS om' },

  /* DE BEDRADING. Een setInterval in server/opzet/ is geen wekker van een
     functie maar het ophangen ervan -- zelfde onderscheid als ORKESTRATIE in
     de verstrengelingsmeter. */
  { bestand: 'server/opzet/start.js', reden: 'bedrading: hangt de diensten op, en is zelf geen functie' },
  { bestand: 'server/opzet/diensten2.js', reden: 'bedrading: deze klok hoort bij het OPHANGEN van een dienst en niet bij een functie van RTG; zet je hem uit, dan is de dienst niet uit maar half opgehangen' },
  { bestand: 'server/opzet/kernlaag1.js', reden: 'bedrading: deze klok hoort bij het OPHANGEN van een dienst en niet bij een functie van RTG; zet je hem uit, dan is de dienst niet uit maar half opgehangen' },
  { bestand: 'server/opzet/kernlaag3c.js', reden: 'bedrading: deze klok hoort bij het OPHANGEN van een dienst en niet bij een functie van RTG; zet je hem uit, dan is de dienst niet uit maar half opgehangen' },
  { bestand: 'server/opzet/kernlaag4b.js', reden: 'bedrading: deze klok hoort bij het OPHANGEN van een dienst en niet bij een functie van RTG; zet je hem uit, dan is de dienst niet uit maar half opgehangen' },
  { bestand: 'server/opzet/kernlaag4c.js', reden: 'bedrading: deze klok hoort bij het OPHANGEN van een dienst en niet bij een functie van RTG; zet je hem uit, dan is de dienst niet uit maar half opgehangen' },
  { bestand: 'server/opzet/kernlaag5.js', reden: 'bedrading: deze klok hoort bij het OPHANGEN van een dienst en niet bij een functie van RTG; zet je hem uit, dan is de dienst niet uit maar half opgehangen' },
  { bestand: 'server/opzet/kernlaag7b.js', reden: 'bedrading: deze klok hoort bij het OPHANGEN van een dienst en niet bij een functie van RTG; zet je hem uit, dan is de dienst niet uit maar half opgehangen' },

  /* DE SCHAKELKAST ZELF. De storingswachter zet functies dicht als ze omvallen.
     Hem achter een functieschakelaar zetten is letterlijk de knop die de
     schakelkast uitzet. */
  { bestand: 'server/functies/wachter.js', reden: 'de storingswachter is de automaat van de schakelkast; een schakelaar die de schakelkast uitzet is geen schakelaar' }
];
