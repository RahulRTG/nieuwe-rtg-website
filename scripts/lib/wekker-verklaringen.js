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

   EN ER IS EEN TWEEDE SOORT REGEL, want niet elke ingang zonder functie is
   onschuldig. Draagt een regel `vertegenwoordigt`, dan zegt hij: deze ingang
   DOET wat een functie doet, maar hij komt niet langs de schakelkast. Zet die
   functie uit en de ingang werkt door. Dat is geen verklaring maar een
   BEVINDING, en hij wordt apart geteld -- wegverklaren zou hier het gat zelf
   dichtplakken.

   Het scherpste voorbeeld staat hieronder: de functie `ov-mail-binnen` heet
   "post van buiten aannemen" en dekt /api/mail/binnen. De SMTP-ontvanger op de
   eigen poort is de TWEEDE weg naar binnen, en die raadpleegt geen enkele
   schakelaar. Op het bord staat dan "post aannemen: uit" terwijl de post
   binnenkomt.

   WAT HIER NIET IN HOORT: een wekker die echt bij een functie hoort. Die
   verklaar je niet weg, die krijgt een functie. */
'use strict';
module.exports = [
  /* EEN BESTAND DAT ZELF NIETS START, en dat is hier het hele punt.

     server/kern/command/tikker.js draagt de vijf regels die alarm.js, canary.js
     en uitrolregie.js elk apart overschreven (een setInterval met een try/catch
     eromheen, unref, en de timer terug). Die drie klokken zijn niet nieuw en ze
     zitten alle drie in de envelop van hun eigen commandfunctie; wat nieuw is,
     is dat de LUS op een plek staat.

     `maakTikker` GEEFT EEN FUNCTIE TERUG en roept hem niet aan. Dit bestand kan
     dus niets in gang zetten: laden levert nul timers op, en pas als een van de
     drie zijn `tikker()` aanroept begint er werk -- binnen zijn eigen envelop en
     met zijn eigen schakelaar. Daarom staat hij hier en niet als bevinding: er is
     geen tweede weg naar binnen bijgekomen, alleen een minder overgeschreven.

     WAT HEM EERLIJK HOUDT: hij vraagt ./tikkerstand.js of hij mag lopen. In een
     meetserver gaan alle drie de lussen daarmee uit -- en dat is precies de regel
     die main drie keer had moeten overschrijven en die nu op een plek staat. */
  { bestand: 'server/kern/command/tikker.js',
    reden: 'de gedeelde achtergrondtik van alarm, canary en uitrolregie. Hij START niets: maakTikker() geeft een functie terug en roept hem niet aan, dus dit bestand levert bij laden nul timers op. De drie aanroepers zitten elk in de envelop van hun eigen commandfunctie en houden hun eigen schakelaar; wat hier weg is, is drie keer dezelfde vijf regels. Hij vraagt bovendien tikkerstand.js of hij mag lopen, zodat de lus in een meetserver uitgaat' },

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
  { bestand: 'server/functies/wachter.js', reden: 'de storingswachter is de automaat van de schakelkast; een schakelaar die de schakelkast uitzet is geen schakelaar' },

  /* DE AFLEVERING EN DE SESSIE. Allebei abonnees op de bus, allebei zonder eigen
     onderwerp: ze dragen niet WAT er gebeurt maar dat het aankomt. */
  { bestand: 'server/kern/sessies.js', reden: 'houdt sessies gelijk over meerdere servers; zet je dat uit, dan logt iemand uit doordat zijn verzoek bij de andere server landt' },
  { bestand: 'server/kern/intreksignaal.js', reden: 'de fail-closed intrekkingsautoriteit voor account- en recordsessies. De busabonnee sluit ingetrokken credentials op alle processen en moet juist blijven werken als een productschakelaar uitgaat; schakelbaarheid zou uitloggen en beveiligingsintrekking onbetrouwbaar maken' },
  { bestand: 'server/kern/sse.js', reden: 'de afleverlaag van realtime-berichten. Staat de functie kern-live uit, dan komt er geen verbinding tot stand en heeft deze abonnee niemand om aan te leveren -- hij begint zelf geen werk' },

  /* EEN WETTELIJKE PLICHT IS GEEN FUNCTIE MET EEN SCHAKELAAR. Zelfde regel als
     /api/privacy in kern/platformregister/bediening.js. */
  { bestand: 'server/bewaarveger.js', reden: 'wist gegevens die over hun bewaartermijn zijn (AVG); een wettelijke plicht hoort niet achter een functieschakelaar, en uitzetten betekent hier bewaren wat weg moet' },
  { bestand: 'server/routes/techniek/bewaren.js', reden: 'de opruimknop van diezelfde bewaartermijnen, en hij hangt onder /api/techniek -- dat is bediening en geen functie (kern/platformregister/bediening.js)' },

  /* TWEE DIE HUN EIGEN SCHAKELAAR AL HEBBEN, en die staat niet in de
     functiecatalogus. Dat is geen gat maar een ANDERE knop; hem hier nog eens
     aan een functie hangen zou twee schakelaars op een ding zetten. */
  { bestand: 'server/kern/zaakdoos/index.js', reden: 'draait alleen in doosmodus (`if (actief)`, gezet met RTG_DOOS_CLOUD): het kastje in de zaak dat doorwerkt als de lijn wegvalt. Buiten die modus bestaat de klok niet' },
  { bestand: 'server/kern/zelfzorg/index.js', reden: 'de stille automaat achter RTG_ZELFZORG_MS, met een eigen knop in de boardroom (api.automaatAan); op nul zetten stopt hem, en hij draait alleen op de leider' },

  /* DE OPSTELLING ZELF. */
  { bestand: 'server/trio.js', reden: 'de hartslag tussen de drie servers van het failover-trio; een failover die je kunt uitzetten is geen failover' },

  /* ---- DE LUISTERAARS DIE DE WEBVOORDEUR ZELF ZIJN ----
     Deze zes maken de HTTP-kant waar de schakelkast IN hangt. Ze zijn geen
     ingang naast de router; ze zijn de router. */
  { bestand: 'server/web/index.js', reden: 'de webserver zelf: alles wat hierachter binnenkomt gaat juist WEL langs de functieschakelaars' },
  { bestand: 'server/poort.js', reden: 'het openen van de luisterpoort voor diezelfde webserver' },
  { bestand: 'server/lib/tls.js', reden: 'de TLS-kant van diezelfde voordeur' },
  { bestand: 'server/lib/tls-acme.js', reden: 'de ACME-uitdaging voor het certificaat van diezelfde voordeur' },
  { bestand: 'server/lib/http1.js', reden: 'de HTTP/1-kant van diezelfde voordeur' },
  { bestand: 'server/lib/http2.js', reden: 'de HTTP/2-kant van diezelfde voordeur' },
  { bestand: 'server/trio-loket.js', reden: 'het CA-loket naast de voordeur: het levert het certificaatbestand uit dat een toestel nodig heeft om de voordeur te kunnen vertrouwen' },

  /* ---- DE WERKERS ---- */
  { bestand: 'server/trio-wacht.js', reden: 'de wacht van het failover-trio; zelfde reden als trio.js' },
  { bestand: 'server/vloot.js', reden: 'het starten en bewaken van de servers zelf; infrastructuur en geen functie' },
  { bestand: 'server/lib/cdp.js', reden: 'de browser die dit huis zelf aanstuurt voor beeld en pdf; hij begint geen werk uit zichzelf maar wordt aangeroepen' },

  /* ---- EN DE DRIE DIE WEL EEN FUNCTIE DOEN EN GEEN SCHAKELAAR KENNEN ----
     Deze staan hier NIET om ze weg te verklaren. Ze zijn geteld, met de functie
     erbij die ze in werkelijkheid uitvoeren. */
  { bestand: 'server/smtp-in-server.js', vertegenwoordigt: 'ov-mail-binnen',
    voorwaarde: 'alleen met MAIL_IN_POORT gezet',
    reden: 'de SMTP-ontvanger op de eigen poort is de tweede weg waarlangs post van buiten binnenkomt en hij raadpleegt geen enkele schakelaar: met ov-mail-binnen UIT komt de post alsnog binnen. WEL alleen als de beheerder MAIL_IN_POORT zet -- opzet/luister-poorten.js doet dat met opzet niet vanzelf, want een mailpoort die overal openstaat is een deur die niemand heeft besloten open te zetten' },
  { bestand: 'server/imap-server.js', vertegenwoordigt: 'member',
    voorwaarde: 'alleen met IMAP_POORT gezet',
    reden: 'de IMAP-server geeft een postvak vrij aan een mailprogramma, buiten elke route om. Hier stond eerst `ov-werkmail`, en dat was FOUT: server/imap.js is een leeslaag boven kern/rtmail-vak.js -- hetzelfde postvak dat over HTTP achter /api/member/rtmail zit, en dat valt onder `member`. `ov-werkmail` gaat over de bezorging van interne werkmail (/api/werkmail) en komt hier niet langs. De vergissing kostte niets in gedrag maar wel in meting: hij liet een ingang als lek tellen die dat niet is, want `member` staat vanaf trede 0 aan' },
  { bestand: 'server/stun.js', vertegenwoordigt: 'kern-live',
    voorwaarde: 'altijd, tenzij STUN_UIT=1',
    reden: 'de eigen STUN-server bedient de ICE-kant van bellen; /api/ice hangt aan kern-live, de UDP-poort aan niets. Hij staat WEL standaard aan -- maar kern-live gaat al op trede 0 open, dus hier loopt de schakelaar niet achter op de deur' }
];
