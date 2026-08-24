/* Functiecatalogus, deel "command": de drie schakelaars van RTG Command.

   Een eigen bestand, en niet alleen omdat cat-partners.js door de 10 kB ging.
   Deze drie horen bij elkaar en bij niets anders: ze knippen EEN app langs de
   scheiding die de app zelf al maakt, en elke laag die er in Command bij komt
   (de gezondheidskaart, het incident, de tijdlijn) landt hier en niet tussen de
   leveranciers. Zo is er ook één plek om te kijken wat het kantoor kan
   dichtzetten. */
'use strict';

module.exports = [
  /* RTG COMMAND IN DRIE SCHAKELAARS EN NIET IN EEN.

     Command is de bestuurslaag van het kantoor, en juist daarom hoort hij in de
     kast en niet erbuiten: /api/office staat er ook in, en een bestuurslaag die
     zichzelf van de knoppenlijst afschermt is een uitzondering die zichzelf
     uitlegt. Maar hem als EEN schakelaar opnemen zou betekenen dat wie het
     kijken dichtzet, ook het herstellen en het beleid dichtzet -- of andersom,
     dat wie de operator open wil zetten het hele bestuur meelevert.

     Vandaar de knip langs de scheiding die de app zelf al maakt: zien, doen,
     besturen. Alle drie staan op `standaard: true`, en dat is geen slordigheid
     maar de huisregel: test/functies.test.js eist dat er zonder stand NIETS
     dichtstaat. Een functie die standaard uit is, is een deur waarvan niemand
     weet dat hij bestaat, en de boardroom is juist de plek waar je hem sluit.
     Het derde blok apart houden is dus geen slot maar een handvat: wie beleid,
     rechten en de nooddeur wil dichtzetten voor een kantoor, doet dat met een
     knop en raakt het zien en het herstellen niet. */
  { id: 'command-zien', categorie: 'RTG-Backoffice', naam: 'RTG Command: zien', standaard: true, doelgroepen: ['intern'],
    uitleg: 'De puls van alle domeinen, de zoekbalk over alles en het objectdossier met zijn tijdlijn.',
    paden: ['/api/command/start', '/api/command/puls', '/api/command/zoek', '/api/command/object', '/api/command/journaal',
      '/api/command/kwaliteit', '/api/command/graaf', '/api/command/herkomst', '/api/command/alarm',
      '/api/command/slo', '/api/command/sonde',
      /* De gezondheidskaart hoort bij het ZIEN, ook al DOET /gezondheid/controleer
         iets: die ronde MEET (een sonderonde, een hashketen narekenen, een
         back-up openmaken) en verandert niets aan de bedrijfsvoering. Dezelfde
         afweging als bij /api/command/sonde hierboven, waar /draai ook een
         handeling is. Eén prefix volstaat: langste-prefix wint, dus /gezondheid
         dekt ook /vermogen en /controleer -- een vierde route erbij is dan
         geschakeld zoals de rest en niet ongeschakeld. */
      '/api/command/gezondheid', '/api/command/tijdlijn',
      /* De meldingsingang van de sonde hoort bij het zien en niet bij het doen:
         hij verandert niets aan de bedrijfsvoering, hij levert metingen aan. Wie
         het zien dichtzet, zet ook het aanleveren dicht, en dat is de bedoelde
         samenhang -- een meter die blijft binnenlopen terwijl het scherm eruit
         staat, vult stilletjes een schijf. */
      '/api/sonde/melding'] },
  { id: 'command-doen', categorie: 'RTG-Backoffice', naam: 'RTG Command: doen', standaard: true, doelgroepen: ['intern'],
    uitleg: 'De operator, de runbooks en de uitzonderingenrij: herstellen en afhandelen.',
    /* incident EN incidenten allebei: prefixLengte is segmentbewust, dus
       "/incident" dekt "/incidenten" niet -- vandaar dat zaak en zaken hier ook
       los staan. Bij DOEN en niet bij ZIEN: net als de uitzonderingenrij is de
       lijst hier onderdeel van het afhandelen en niet van het kijken. */
    paden: ['/api/command/operator', '/api/command/runbook', '/api/command/runbooks', '/api/command/runs',
      '/api/command/zaak', '/api/command/zaken', '/api/command/werk',
      '/api/command/incident', '/api/command/incidenten',
      /* Bijstand en de vloot bij DOEN: een sessie betreden en een handeling
         uitvoeren is geen kijken, en de vlootlijst hoort bij dezelfde knop --
         wie support dichtzet, hoort niet nog een half beeld over te houden. */
      '/api/command/bijstand', '/api/command/vloot'] },
  { id: 'command-besturen', categorie: 'RTG-Backoffice', naam: 'RTG Command: besturen', standaard: true, doelgroepen: ['intern'],
    uitleg: 'Beleidsregels zetten, simuleren, agents begrenzen en zware rechten tijdelijk uitdelen.',
    paden: ['/api/command/beleid', '/api/command/simulatie', '/api/command/agent', '/api/command/agents',
      '/api/command/recht', '/api/command/rechten', '/api/command/mandaat',
      '/api/command/canary', '/api/command/zandbak', '/api/command/mdm',
      '/api/command/overname', '/api/command/apipoort', '/api/command/land', '/api/command/stad'] }
];
