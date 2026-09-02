/* ============================================================================
   RTG SERVICE -- de vocabulaire.

   HET PROBLEEM DAT DEZE LAAG OPLOST IS NIET "ER IS GEEN KLANTENSERVICE".

   Er zijn er vier, en ze werken elk goed: de AI van de RTG Pass (kern/ai.js),
   de menselijke concierge van Lifestyle en Business (kern/lifestyle/), de
   ledenbalie van het kantoor (kern/ledenbalie*.js) en RTG Bijstand voor
   organisaties (kern/command/bijstand*.js). Wat er niet was, is een
   GEMEENSCHAPPELIJKE ENVELOP: iets dat over alle vier heen weet wie eraan
   werkt, sinds wanneer, met welke bevoegdheid, en wat de melder ziet.

   DIT BESTAND IS DIE ENVELOP EN GEEN VERVANGING. De vier lagen hierboven
   blijven bepalen wat iets BETEKENT -- een klacht blijft een klacht in
   ledenbalie-zaken.js, een conciergeverzoek blijft van kern/lifestyle. Service
   bepaalt alleen wie, wanneer, waarmee en wat de melder ziet.

   VIER DINGEN STAAN HIER VAST, EN ALLE VIER OM EEN REDEN.

   1. SOORT IS SEMANTIEK EN GEEN LABEL. `ondersteuning` (er is een probleem),
      `opdracht` (er moet iets gedaan worden) en `klacht` (er is iets misgegaan
      en daar hoort een oordeel over) zijn drie DINGEN. Ze delen deze
      infrastructuur -- eigenaar, tijdlijn, klokken -- maar lopen nooit in
      elkaar over: een opgeloste zaak sluit geen klacht, die kan nog onderzoek,
      oordeel en maatregel voor zich hebben. Wie ze samenvoegt, vervuilt het
      objectmodel precies zoals DEVELOPERCLOUD.md par. 2 waarschuwt.

   2. EEN ZAAK WEET WAAROVER HET GAAT EN OPENT NIETS. `betrokken` draagt een
      VERWIJZING (soort + code), nooit gegevens. Dat een zaak over PAY-829192
      gaat mag de wachtrij weten; wat erin staat is een aparte vraag met een
      eigen reden en spoor -- ./machtiging.js draagt die helft.

   3. DE KLOK STOPT ALS RTG WACHT. Een reactietijd die doorloopt terwijl het
      antwoord bij de melder ligt, meet de melder en niet ons. Dat staat daarom
      IN de stand en niet in een tweede lijst, die uit de pas gaat lopen.

   4. ER STAAT NOOIT EEN GETAL WAAR ER GEEN IS. Een zaak zonder gemeten
      reactietijd zegt dat hij niet gemeten is; hij zegt geen nul (KOSTEN.md).
   ========================================================================== */
'use strict';

/* ---------------------------------------------------------------- soorten -- */
/* `eigenaarVanBetekenis` is geen sierlijk veld: het zegt WELKE bestaande laag
   over de inhoud gaat. Service beheert de envelop; wie de zaak inhoudelijk
   afsluit, staat daar. Een soort zonder zo'n eigenaar zou betekenen dat deze
   laag zelf betekenis is gaan dragen, en dat is precies wat ze niet doet. */
const SOORTEN = {
  ondersteuning: {
    naam: 'Ondersteuning',
    wat: 'Er is een probleem of een vraag. De melder wil dat er iets wordt opgelost of uitgelegd.',
    eigenaarVanBetekenis: 'service',
    sluitbaar: true
  },
  klacht: {
    naam: 'Klacht',
    wat: 'Er is iets misgegaan en daar hoort een oordeel over. Het oordeel overleeft de oplossing.',
    eigenaarVanBetekenis: 'kern/ledenbalie-zaken.js',
    sluitbaar: false   // de zaak sluit; de klacht loopt door -- zie ./zaak.js sluit()
  },
  opdracht: {
    naam: 'Opdracht',
    wat: 'Er is geen probleem. Er moet iets geregeld worden. Dit is conciergewerk.',
    eigenaarVanBetekenis: 'kern/lifestyle/index.js',
    sluitbaar: false
  },
  toegang: {
    naam: 'Toegang',
    wat: 'De melder komt niet bij zijn eigen account of gegevens.',
    eigenaarVanBetekenis: 'service',
    sluitbaar: true
  },
  storing: {
    naam: 'Storing',
    wat: 'Een technisch mankement dat meer dan deze melder kan raken.',
    eigenaarVanBetekenis: 'kern/command/incident.js',
    sluitbaar: true
  }
};

/* ------------------------------------------------------------ doelgroepen -- */
/* WIE er meldt, niet WAAROVER. Dit stuurt de routering en bepaalt of er
   menselijke hulp bestaat -- zie ./mens.js, dat er als enige iets over zegt. */
const DOELGROEPEN = {
  gast:         { naam: 'Gast',           wat: 'Nog geen account, of een account zonder pas.' },
  lid:          { naam: 'Lid',            wat: 'Een lid met een RTG-, Lifestyle- of Business Pass.' },
  zaak:         { naam: 'Zaak',           wat: 'Een leverancier, partner, restaurant of vervoerder.' },
  organisatie:  { naam: 'Organisatie',    wat: 'Een zakelijke klant met een eigen werkruimte (tenant).' },
  kantoor:      { naam: 'Kantoor',        wat: 'RTG zelf, intern gemeld.' }
};

/* ---------------------------------------------------------------- kanalen -- */
/* HET KANAAL IS TRANSPORT EN VERDER NIETS. Een zaak per mail is dezelfde zaak
   als een zaak uit de app; alleen `kanaal` verschilt. Daarom staan hier ook
   kanalen zonder ingang, als `gebouwd: false` -- iets anders dan afwezig. Wie
   er een bouwt, zet de vlag om en raakt de zaak zelf niet aan. */
const KANALEN = {
  app:         { naam: 'In de app',          gebouwd: true },
  balie:       { naam: 'Via de ledenbalie',  gebouwd: true },
  automatisch: { naam: 'Door RTG opgemerkt', gebouwd: true },
  mail:        { naam: 'Per e-mail',         gebouwd: false, waarom: 'RTMail heeft geen ingang die post aan een zaak koppelt.' },
  telefoon:    { naam: 'Telefonisch',        gebouwd: false, waarom: 'Er is geen telefoniekoppeling.' },
  terugbel:    { naam: 'Terugbelverzoek',    gebouwd: false, waarom: 'Volgt op telefonie; los heeft het geen zin.' },
  api:         { naam: 'Via een koppeling',  gebouwd: false, waarom: 'Wacht op de App Store-brug.' }
};

/* --------------------------------------------------------------- standen -- */
/* `klokLoopt: false` betekent: RTG wacht redelijkerwijs op iemand anders, dus
   de reactieklok staat stil. Dat is de enige plek waar dat is opgeschreven --
   ./klok.js leest deze vlag en houdt geen tweede lijst bij.

   `eind: true` betekent dat de zaak niet verder loopt. Let op de asymmetrie
   met SOORTEN: een klachtzaak mag hier eindigen terwijl de KLACHT doorloopt.
   Dat is geen slordigheid maar de reden dat het twee objecten zijn. */
const STANDEN = {
  nieuw:            { naam: 'Nieuw',              klokLoopt: true,  eind: false },
  onderzoek:        { naam: 'In onderzoek',       klokLoopt: true,  eind: false },
  wachtOpMens:      { naam: 'Wacht op een mens',  klokLoopt: true,  eind: false },
  inBehandeling:    { naam: 'In behandeling',     klokLoopt: true,  eind: false },
  wachtOpMelder:    { naam: 'Wacht op de melder', klokLoopt: false, eind: false },
  opgelost:         { naam: 'Opgelost',           klokLoopt: false, eind: true },
  gesloten:         { naam: 'Gesloten',           klokLoopt: false, eind: true }
};

/* ------------------------------------------------------------------ teams -- */
/* Wat de melder ziet is "RTG Support". Dit is de binnenkant. Elk team noemt de
   BEVOEGDHEDEN die zijn werk vraagt; ./machtiging.js geeft ze per zaak en
   tijdelijk uit, en nooit permanent aan een mens. */
/* WAAROM HIER OOK ZWAAR WERK IN STAAT. De eerste opzet hield de zware
   capabilities uit deze tabel, "voor de zekerheid". Dat leverde een DODE TAK op:
   ./machtiging.js versmalt naar wat het team nodig heeft, dus kon geen aanvraag
   ooit zwaar werk bevatten, en de tweede-handtekening -- de duurste grendel van
   deze laag -- werd nooit uitgevoerd terwijl de toets groen stond. Dezelfde fout
   als de cap `rooms` uit PLATFORM.md. Zwaar werk staat dus bij het team dat het
   doet; de grendel zit op de HANDELING (./machtiging.js ZWAAR), niet op de tabel. */
const TEAMS = {
  leden:      { naam: 'Service · Leden',        capabilities: ['zaak.lezen', 'lid.dossier', 'gegevens.uitvoer'] },
  betalingen: { naam: 'Service · Betalingen',   capabilities: ['zaak.lezen', 'betaling.stand', 'bank.gegevens', 'geld.compensatie'] },
  toegang:    { naam: 'Service · Toegang',      capabilities: ['zaak.lezen', 'identiteit.uitdaging', 'identiteit.openen'] },
  zakelijk:   { naam: 'Service · Zakelijk',     capabilities: ['zaak.lezen', 'organisatie.stand', 'bank.gegevens'] },
  techniek:   { naam: 'Service · Techniek',     capabilities: ['zaak.lezen', 'incident.koppelen'] },
  concierge:  { naam: 'De Rechterhand',         capabilities: ['zaak.lezen'] },
  veiligheid: { naam: 'Service · Veiligheid',   capabilities: ['zaak.lezen', 'identiteit.openen'] }
};

/* ------------------------------------------------------------ onderwerpen -- */
/* De onderwerpen die de routering kent. Bewust kort: een lijst van veertig
   onderwerpen wordt door de melder verkeerd gekozen en door de router genegeerd.
   `team` is een VOORKEUR -- ./router.js mag ervan afwijken op grond van wie er
   meldt, en legt dat dan uit. */
const ONDERWERPEN = {
  betaling:   { naam: 'Een betaling of uitbetaling', team: 'betalingen' },
  bestelling: { naam: 'Een bestelling of levering',  team: 'leden' },
  reis:       { naam: 'Een reis of boeking',         team: 'leden' },
  account:    { naam: 'Inloggen of mijn account',    team: 'toegang' },
  app:        { naam: 'De app of het scherm',        team: 'techniek' },
  zaak:       { naam: 'Mijn zaak of organisatie',    team: 'zakelijk' },
  veiligheid: { naam: 'Veiligheid of misbruik',      team: 'veiligheid' },
  anders:     { naam: 'Iets anders',                 team: 'leden' }
};

/* Een naam opzoeken zonder dat de aanroeper de kaart hoeft te kennen. Geeft de
   sleutel terug als hij onbekend is: liever een ruwe sleutel op het scherm dan
   een leeg vak dat suggereert dat er niets is. */
const naamVan = (kaart, sleutel) => (kaart[sleutel] && kaart[sleutel].naam) || String(sleutel || '');

const geldig = (kaart, sleutel) => Object.prototype.hasOwnProperty.call(kaart, String(sleutel || ''));

module.exports = { SOORTEN, DOELGROEPEN, KANALEN, STANDEN, TEAMS, ONDERWERPEN, naamVan, geldig };
