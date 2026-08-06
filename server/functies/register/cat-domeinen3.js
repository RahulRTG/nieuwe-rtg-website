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

  // ---------- de kern van de app ----------
  { id: 'kern-state', categorie: 'Leden (RTG-app)', naam: 'De app-staat', standaard: true, doelgroepen: ALLE,
    uitleg: 'De ene aanroep waarmee de app zijn hele beeld ophaalt. Uit betekent een lege app voor iedereen.', paden: ['/api/state', '/api/ik'] },
  { id: 'kern-live', categorie: 'Leden (RTG-app)', naam: 'De live-verbinding', standaard: true, doelgroepen: ALLE,
    uitleg: 'De open lijn (SSE) waarover meldingen en verversingen binnenkomen, plus de verbindingsgegevens voor bellen.', paden: ['/api/stream', '/api/ice'] },
  { id: 'kern-meldingen', categorie: 'Leden (RTG-app)', naam: 'Meldingen en push', standaard: true, doelgroepen: ALLE,
    uitleg: 'De meldingen in de app, de voorkeuren daarvoor en de push naar het toestel.', paden: ['/api/notifications', '/api/meldingen', '/api/push'] },
  { id: 'kern-berichten', categorie: 'Leden (RTG-app)', naam: 'Berichten en gesprekken', standaard: true, doelgroepen: ALLE,
    uitleg: 'De chat met de concierge, prive-berichten op codenaam en de groepsklets.', paden: ['/api/chat', '/api/dm', '/api/klets'] },
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
