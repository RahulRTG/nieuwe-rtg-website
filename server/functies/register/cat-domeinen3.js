/* Functiecatalogus, deel "domeinen 3": toegang, identiteit en de kern van de
   leden-app.

   Zelfde bedoeling en zelfde regels als ./cat-domeinen.js -- zie de kop daar.
   Dit blok is de gevoeligste van de vier, en dat verdient een waarschuwing die
   in de kast zelf niet past:

   WIE HIER IETS UITZET, SLUIT EEN DEUR WAAR MENSEN DOOR MOETEN. De inlog uit
   zetten betekent dat geen enkel lid meer binnenkomt. Dat is een echte,
   bruikbare noodknop (een aanval afslaan, een lek dichthouden) en daarom hoort
   hij in de kast -- maar het is geen knop om per ongeluk om te zetten. De
   eigenaar zelf komt altijd binnen via het techniekbord, dat bewust buiten de
   kast staat, dus terugzetten kan altijd.

   Wat hier NIET in staat en ook nooit in mag: /api/privacy. Inzage, export en
   verwijdering zijn wettelijke rechten van de betrokkene; een knop waarmee RTG
   die kan uitzetten hoort niet te bestaan. Zie de bestuurslaag in
   scripts/schakelbaar.js. */
const { DOELGROEPEN, LEDEN, LEDEN_RTF } = require('./doelgroepen');
const ALLE = DOELGROEPEN.map(d => d.id).filter(d => d !== 'intern');
const LEDEN_GAST = ['rtg', 'lifestyle', 'business', 'gast'];

module.exports = [
  // ---------- de deuren waar mensen doorheen moeten ----------
  { id: 'tg-inlog', categorie: 'Toegang en identiteit', naam: 'Inloggen en registreren', standaard: true, doelgroepen: ALLE,
    uitleg: 'De voordeur: inloggen, uitloggen, registreren en wachtwoord vergeten. Uit betekent dat niemand meer binnenkomt; de eigenaar houdt het techniekbord.', paden: ['/api/auth', '/api/login', '/api/logout'] },
  { id: 'tg-account', categorie: 'Toegang en identiteit', naam: 'Account en profiel', standaard: true, doelgroepen: ALLE,
    uitleg: 'Het eigen account: rollen, koppelingen en het cv van een lid.', paden: ['/api/account', '/api/cv'] },
  { id: 'tg-sso', categorie: 'Toegang en identiteit', naam: 'Inloggen via een andere partij (SSO)', standaard: true, doelgroepen: ALLE,
    uitleg: 'De terugkeer van een identiteitsprovider, met de ondertekende state als poort.', paden: ['/api/sso'] },
  { id: 'tg-pin', categorie: 'Toegang en identiteit', naam: 'Pincode en sleutelwoorden', standaard: true, doelgroepen: ALLE,
    uitleg: 'De algemene pin voor prive-apps en de sleutelwoord-inlog met zijn uitdaging.', paden: ['/api/pin', '/api/sleutelwoorden'] },
  { id: 'tg-zegel', categorie: 'Toegang en identiteit', naam: 'Zegel, codes en rechtenbeheer', standaard: true, doelgroepen: ALLE,
    uitleg: 'Het RTG-zegel, dynamische codes, scanbare codes en de rechtenlaag op media.', paden: ['/api/zegel', '/api/code', '/api/drm'] },
  /* RTG Link staat NAAST de codelaag hierboven en niet erin, want het zijn twee
     dingen: daar wordt een code gemaakt en ondertekend, hier wordt hij geduid --
     wat is dit, en wat mag DEZE scanner er nu mee (LINK.md). Uit zetten haalt het
     scannen weg zonder de codes zelf onbruikbaar te maken: een tafelcode blijft
     een tafelcode, alleen het bedoelingsscherm en de capabilities gaan uit.

     Alleen /api/link, en dat is met opzet. De gezinsdeur (/api/rtf/link) en de
     kassadeur (/api/supplier/link) horen bij het oppervlak van die werelden: wie
     de RTFoundation of de partnerkant uitzet, hoort ook hun scanweg mee uit te
     zetten -- en niet andersom. */
  { id: 'tg-link', categorie: 'Toegang en identiteit', naam: 'RTG Link (scannen en capabilities)', standaard: true, doelgroepen: ALLE,
    uitleg: 'De adres- en capabilitylaag: een gescande code duiden, het bedoelingsscherm, tijdelijke capabilities (zoals een vraagcode of een kassacode) en de eigen koppelingenlijst.', paden: ['/api/link'] },
  /* De adresopzoeker hoort bij DE PLEK WAAR EEN ADRES GEVRAAGD MAG WORDEN, en dat
     is deze poort: de intake vraagt er sinds de momenten geen meer. Hij hoort
     dus niet onder Onboarding -- wie daar de schakelaar omzet, zou anders ook de
     adresvraag bij een bezorging stilzetten, en die twee hebben niets met elkaar
     te maken. Staat hij uit, dan typt het lid zijn adres gewoon voluit. */
  { id: 'tg-gegevens', categorie: 'Toegang en identiteit', naam: 'De gegevenspoort', standaard: true, doelgroepen: ALLE,
    uitleg: 'Het gesprek waarin een lid zelf zijn ontbrekende gegevens aanvult, inclusief het opzoeken van een adres bij postcode en huisnummer.',
    paden: ['/api/gegevens', '/api/adres'] },
  { id: 'tg-aanmeld', categorie: 'Toegang en identiteit', naam: 'Aanmelden voor een pas', standaard: true, doelgroepen: ALLE,
    uitleg: 'Het aanmeldgesprek en de aanmeldingen die daaruit volgen; het besluit blijft mensenwerk.', paden: ['/api/aanmeld', '/api/aanmelding'] },
  /* De wervingslink: een werkgever nodigt iemand uit die nog geen RTG-account
     heeft. Dit stond nergens in de kast, dus was hij als enige niet uit te
     zetten -- terwijl juist een uitnodigingslink iets is dat je wilt kunnen
     dichtdraaien als er misbruik van wordt gemaakt. Geen recht en geen
     infrastructuur, dus geen plaats op de BUITEN-lijst. */
  { id: 'tg-werving', categorie: 'Toegang en identiteit', naam: 'Wervingslink van een werkgever', standaard: true, doelgroepen: ALLE,
    uitleg: 'De link /werken/<code> waarmee een werkgever iemand uitnodigt die nog geen account heeft; aanmelden en in dienst treden worden dan een handeling.', paden: ['/api/werving'] },

  // ---------- de kern van de app ----------
  { id: 'kern-state', categorie: 'Leden (RTG-app)', naam: 'De app-staat', standaard: true, doelgroepen: ALLE,
    uitleg: 'De ene aanroep waarmee de app zijn hele beeld ophaalt. Uit betekent een lege app voor iedereen.', paden: ['/api/state', '/api/ik'] },
  { id: 'kern-live', categorie: 'Leden (RTG-app)', naam: 'De live-verbinding', standaard: true, doelgroepen: ALLE,
    uitleg: 'De open lijn (SSE) waarover meldingen en verversingen binnenkomen, plus de verbindingsgegevens voor bellen.', paden: ['/api/stream', '/api/ice'] },
  { id: 'kern-meldingen', categorie: 'Leden (RTG-app)', naam: 'Meldingen en push', standaard: true, doelgroepen: ALLE,
    uitleg: 'De meldingen in de app, de voorkeuren daarvoor en de push naar het toestel.', paden: ['/api/notifications', '/api/meldingen', '/api/push'] },
  { id: 'kern-berichten', categorie: 'Leden (RTG-app)', naam: 'Berichten en gesprekken', standaard: true, doelgroepen: ALLE,
    uitleg: 'De chat met de concierge, prive-berichten op codenaam en de groepsklets.', paden: ['/api/chat', '/api/dm', '/api/klets'] },
  /* Het communicatieplatform (kern/comm). Bewust een EIGEN knop en niet
     ondergebracht bij kern-berichten hierboven: dat gaat over de oude losse
     kanalen, dit over het gespreksmodel waar elke module op aansluit -- een
     rit, een bestelling, een klas. Wie deze knop omzet, zet meer uit dan een
     chatvenster, en dat hoort de boardroom te kunnen zien voor hij hem
     aanraakt. De zakelijke kant (/api/supplier/comm) valt onder de
     leverancierskast en staat daarom niet apart. */
  { id: 'kern-comm', categorie: 'Leden (RTG-app)', naam: 'Communicatieplatform', standaard: true, doelgroepen: ALLE,
    uitleg: 'Het ene gespreksmodel: de inbox met al zijn laden, threads, reacties, zoeken over alles, en @Rahul die opstelt maar nooit verstuurt. Ook de gesprekken die modules aanmaken (een rit, een bestelling) lopen hierlangs.',
    paden: ['/api/comm'] },
  { id: 'kern-taal', categorie: 'Leden (RTG-app)', naam: 'Taal en vertaling', standaard: true, doelgroepen: ALLE,
    uitleg: 'De talenlijst en het vertalen van schermteksten en berichten.', paden: ['/api/vertaal', '/api/translate', '/api/talen'] },
  { id: 'kern-locatie', categorie: 'Leden (RTG-app)', naam: 'Locatie delen', standaard: true, doelgroepen: LEDEN,
    uitleg: 'Het delen van de eigen positie onderweg, en het stoppen daarvan.', paden: ['/api/locatie'] },
  { id: 'kern-klok', categorie: 'Leden (RTG-app)', naam: 'Klok, timer en wekker', standaard: true, doelgroepen: LEDEN_RTF,
    uitleg: 'De klok-app met timers en wekkers.', paden: ['/api/klok'] },
  { id: 'kern-memo', categorie: 'Leden (RTG-app)', naam: 'Memo en samenvatten', standaard: true, doelgroepen: LEDEN,
    uitleg: 'De memo-app en de samenvatting van een opname of transcript.', paden: ['/api/memo'] },
  { id: 'kern-rahul', categorie: 'Leden (RTG-app)', naam: 'Rahul (de assistent)', standaard: true, doelgroepen: ALLE,
    uitleg: 'De assistent zelf: zijn stemming, zijn blik op een scherm en de bibliotheekhulp.', paden: ['/api/rahul', '/api/ai', '/api/bieb'] },
  { id: 'kern-gids', categorie: 'Leden (RTG-app)', naam: 'App-gids en uitleg', standaard: true, doelgroepen: ALLE,
    uitleg: 'De gids die per scherm uitlegt wat je er kunt doen.', paden: ['/api/gids'] },
  { id: 'kern-waardering', categorie: 'Leden (RTG-app)', naam: 'Waarderen en reageren', standaard: true, doelgroepen: LEDEN_GAST,
    uitleg: 'Likes, reacties, reviews en favorieten door het hele platform.', paden: ['/api/like', '/api/comment', '/api/review', '/api/reviews', '/api/favoriet', '/api/favorieten'] }
];
