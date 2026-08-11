/* Functiecatalogus, deel "zaakregie": de commandolaag van een zaak.

   Apart bestand en niet bij ./cat-partners.js, om de reden die het huis zelf
   stelt: dat bestand stond op 10,7 KB en de omvangregel is een dakpan, geen
   wet -- een bestand dat er net overheen gaat, draagt een tweede onderwerp. Dit
   IS een tweede onderwerp: de andere partnerfuncties gaan over wat een zaak
   kan verkopen en bedienen, deze twee over hoe hij zichzelf bestuurt. */
module.exports = [
  /* DE REGIE VAN DE ZAAK staat bij de PARTNERS en niet bij de backoffice, want
     het is een functie van de zaak-app en niet van het RTG-kantoor. Twee
     schakelaars langs dezelfde naad als bij RTG Command: kijken en op de lijst
     zetten is voor iedereen in de zaak (ook de PDA op de vloer), rechtzetten en
     regels wijzigen is management. Zet je ze samen, dan haalt wie het
     rechtzetten dichtdoet ook het kijken weg bij de vloer. */
  { id: 'zaakregie', categorie: 'Partners (leveranciers)', naam: 'Regie: zien & op de lijst zetten', standaard: true, doelgroepen: ['leverancier'],
    uitleg: 'De stand van de eigen zaak, de zoekbalk erover, het objectdossier en de uitzonderingenrij -- ook op de PDA van de vloer.',
    paden: ['/api/supplier/command/start', '/api/supplier/command/puls', '/api/supplier/command/zoek',
      '/api/supplier/command/object', '/api/supplier/command/signalen', '/api/supplier/command/signaal',
      '/api/supplier/command/zaken', '/api/supplier/command/zaak', '/api/supplier/command/runbooks',
      '/api/supplier/command/runs'] },
  { id: 'zaakregie-beheer', categorie: 'Partners (leveranciers)', naam: 'Regie: rechtzetten & regels', standaard: true, doelgroepen: ['leverancier'],
    uitleg: 'Administratieve drift rechtzetten, een ronde terugdraaien, de eigen grenzen zetten en het spoor van de zaak lezen.',
    paden: ['/api/supplier/command/runbook', '/api/supplier/command/beleid', '/api/supplier/command/journaal',
      '/api/supplier/command/operator', '/api/supplier/command/werk',
      '/api/supplier/command/kwaliteit', '/api/supplier/command/graaf', '/api/supplier/command/herkomst'] }
];
