/* ============================================================================
   WAT WEET RTG VAN MIJ -- het register, en niet de kaart.

   DIT HUIS HAD DRIE VAN DE VIER VRAGEN AL BEANTWOORD, en dat is precies waarom
   deze ontbrak zonder dat iemand hem miste:

     wie MAG er iets van mij      kern/consent-register.js  (openstaande rechten)
     wie HEEFT er gekeken         kern/inzagekaart.js       (wat er gebeurd is)
     wat MIST er voor een handeling  kern/gegevenspoort.js  (wat u nog moet geven)
     wat IS er van mij            -- deze laag

   /api/privacy/export gaf die vierde wel, maar als een dump: een JSON met
   veertien takken waarin een mens moet zoeken. Een uitvoer is een RECHT en een
   antwoord is iets anders dan een bestand.

   WAAROM DIT EEN REGISTER IS EN GEEN AFLEIDING. BEWIJSMACHINE.md waarschuwt
   terecht dat een register naast de code binnen een jaar zelf een botsing
   wordt. Het antwoord daarop is hier niet "dan leiden we het af" -- want
   DOELBINDING en het GEVOLG VAN WEGHALEN staan nergens in de code te lezen; die
   zijn besloten, niet gemeten. Het antwoord is dat elke regel een `bron`
   draagt: het bestand waar dat gegeven werkelijk woont. Verdwijnt dat bestand
   of verhuist het, dan zakt test/gegevenskaart.test.js -- en dan is de regel
   aantoonbaar achterhaald in plaats van stil verkeerd.

   DRIE WOORDEN DIE HIER NIET HETZELFDE BETEKENEN, en dat is met opzet:
     waar      -- waar het fysiek staat (kluis, dossier, operationeel, afgeleid)
     herkomst  -- hoe het bij ons kwam (opgegeven, gemeten, overgenomen)
     doel      -- waarvoor het gebruikt mag worden

   Ze zijn los omdat ze los uit elkaar lopen: uw geboortedatum staat in de
   kluis, is door u opgegeven, en kan LATER overgenomen zijn van een document
   dat een mens aftekende. Dat verschil is de reden dat RTG iD twee bronnen
   toont, en een kaart die alleen "geboortedatum: bekend" zegt, wist het weg.

   EN HET DUURSTE VELD IS `weg`. Een kaart die overal "u kunt dit verwijderen"
   zet, is een belofte die de wet op sommige regels niet toestaat -- een factuur
   blijft zeven jaar staan, of u het wilt of niet. Wie dat niet noemt, laat een
   mens denken dat "alles wissen" alles wist.
   ========================================================================== */
'use strict';

/* De vier plaatsen waar iets van u kan staan. `afgeleid` is er een: het staat
   NERGENS en wordt bij elke vraag opnieuw berekend, en dat is een geruststelling
   die je alleen kunt geven als je hem apart benoemt. */
const WAAR = {
  kluis: 'In de identiteitskluis: versleuteld, gebonden aan uw rij, en gescheiden van de rest van RTG.',
  dossier: 'In uw ledendossier: versleuteld, en alleen leesbaar met uw eigen sleutel.',
  operationeel: 'In de gewone gegevens van RTG, onder uw codenaam en niet onder uw naam.',
  afgeleid: 'Nergens. Dit wordt bij elke vraag opnieuw uitgerekend en niet bewaard.'
};

const HERKOMST = {
  opgegeven: 'U heeft dit zelf opgegeven.',
  gemeten: 'RTG heeft dit waargenomen terwijl u de app gebruikte.',
  overgenomen: 'Overgenomen van een document dat een medewerker van RTG heeft gezien.',
  afgeleid: 'Uitgerekend uit iets anders dat RTG al van u wist.'
};

/* DRIE REDENEN WAAROM IETS NIET WEG KAN, en ze zijn niet inwisselbaar. Ze
   stonden eerst alle drie als een kale `kan: false`, en dan komt uw naam op
   dezelfde lijst als uw facturen -- terwijl het ene meegaat als u uw account
   opheft en het andere zeven jaar blijft staan. Dat is het verschil waar deze
   kaart voor bestaat, dus het is een veld en geen zinsnede.

     account-nodig  het account kan niet zonder; het gaat mee als u opheft
     wettelijk      het blijft ook NA het opheffen staan, en dat is geen keuze
     beschermt-u    wissen zou het onbruikbaar maken als bescherming */
const GRONDEN = {
  'account-nodig': 'Dit kan niet los weg, maar het verdwijnt wel als u uw account opheft.',
  wettelijk: 'Dit blijft ook na het opheffen van uw account staan. Dat is een wettelijke plicht en geen keuze van RTG.',
  'beschermt-u': 'Dit kan niet weg omdat het er voor u is: kon u het wissen, dan kon iemand anders dat ook.'
};

/* Elk gegeven met de vier vragen. `meet` zegt WELKE peiling de kaart mag doen;
   een soort zonder `meet` komt op de kaart met "dit peilen wij hier niet" en
   nooit met een gok. */
const SOORTEN = [
  { id: 'naam', naam: 'Uw naam', waar: 'kluis', herkomst: 'opgegeven', meet: 'kluis:naam',
    doel: 'U aanspreken, en u legitimeren waar dat wettelijk moet.',
    weg: { kan: false, grond: 'account-nodig', reden: 'Zonder naam bestaat het account niet. Wilt u hem hier weg, dan is dat het verwijderen van uw account -- dat kan, en het staat onder Juridisch.' },
    bron: 'server/accounts/users.js' },

  { id: 'codenaam', naam: 'Uw codenaam', waar: 'operationeel', herkomst: 'afgeleid', meet: 'kluis:codenaam',
    doel: 'Alles wat RTG buiten de kluis van u bewaart, hangt hieraan in plaats van aan uw naam.',
    weg: { kan: false, grond: 'account-nodig', reden: 'Dit IS uw account buiten de kluis. Hem weghalen betekent alles weghalen wat eraan hangt.' },
    bron: 'server/accounts/users.js' },

  { id: 'email', naam: 'Uw e-mailadres', waar: 'kluis', herkomst: 'opgegeven', meet: 'kluis:email',
    doel: 'Inloggen, en u terug binnenlaten als u uw wachtwoord kwijt bent.',
    weg: { kan: false, grond: 'account-nodig', reden: 'Dit is uw herstelkanaal. Wijzigen kan wel, en dat vraagt uw wachtwoord plus een bevestiging op het nieuwe adres.' },
    bron: 'server/routes/member/herstelkanaal.js' },

  { id: 'telefoon', naam: 'Uw telefoonnummer', waar: 'kluis', herkomst: 'opgegeven', meet: 'kluis:telefoon',
    doel: 'Uw tweede herstelkanaal, en een zaak kan u bereiken als er iets verandert aan uw tafel of bestelling.',
    weg: { kan: false, grond: 'account-nodig', reden: 'Ook dit is een herstelkanaal. Vervangen kan, met uw wachtwoord erbij.' },
    bron: 'server/routes/member/herstelkanaal.js' },

  { id: 'geboortedatum', naam: 'Uw geboortedatum', waar: 'dossier', herkomst: 'opgegeven', meet: 'dossier:geboortedatum',
    doel: 'Bepalen waar u wel en niet bij mag -- de 18+-grens is de belangrijkste.',
    weg: { kan: false, grond: 'account-nodig', reden: 'Zonder datum vervalt uw toegang tot alles met een leeftijdsgrens. Is uw identiteitsbewijs gezien, dan staat de datum van het document erbij; dat verschil ziet u in RTG iD.' },
    bron: 'server/kern/paspoort.js' },

  { id: 'adres', naam: 'Uw adres', waar: 'dossier', herkomst: 'opgegeven', meet: 'dossier:adres',
    doel: 'Een bezorging bij u krijgen. Het gaat alleen mee met een bezorging en verder nergens heen.',
    weg: { kan: true, hoe: 'U kunt het adres leegmaken. Lopende bezorgingen houden het adres dat ze al hadden.' },
    bron: 'server/kern/gegevenspoort.js' },

  { id: 'identiteitsbewijs', naam: 'Uw identiteitsbewijs', waar: 'kluis', herkomst: 'overgenomen', meet: 'kluis:verificatie',
    doel: 'Eenmalig vaststellen dat u bent wie u zegt. Daarna is de uitkomst genoeg en niet het document.',
    weg: { kan: true, hoe: 'U kunt de verificatie intrekken. Uw geverifieerde status vervalt dan, en daarmee alles waar die status voor nodig was.' },
    bron: 'server/routes/office/verificaties.js' },

  { id: 'sessies', naam: 'Waar u bent aangemeld', waar: 'operationeel', herkomst: 'gemeten', meet: 'sessies',
    doel: 'U aangemeld houden, en u laten zien waar u nog openstaat zodat u dat kunt sluiten.',
    weg: { kan: true, hoe: 'Elke sessie is los te sluiten, en er is een knop die alles behalve deze sluit.' },
    bron: 'server/kern/identiteit/sessieregister.js' },

  { id: 'toestelbinding', naam: 'Uw gebonden toestellen', waar: 'operationeel', herkomst: 'gemeten', meet: 'toestellen',
    doel: 'Aantonen dat een zware handeling van UW toestel komt en niet van een gekopieerd token.',
    weg: { kan: true, hoe: 'Een binding is in te trekken. RTG bewaart alleen de publieke helft van de sleutel; de geheime helft heeft uw toestel nooit afgegeven.' },
    bron: 'server/kern/identiteit/toestellen.js' },

  { id: 'tweefactor', naam: 'Uw tweede factor', waar: 'dossier', herkomst: 'opgegeven', meet: 'dossier:tweefactor',
    doel: 'Een tweede bewijs bij het inloggen, zodat een gestolen wachtwoord alleen niet genoeg is.',
    weg: { kan: true, hoe: 'Uitzetten kan, met uw wachtwoord erbij. Uw ongebruikte herstelcodes vervallen dan meteen.' },
    bron: 'server/kern/identiteit/tweefactor.js' },

  { id: 'post', naam: 'Waarvoor u post wilt', waar: 'operationeel', herkomst: 'opgegeven', meet: 'post',
    doel: 'Bepalen of RTG u mag benaderen, en via welk kanaal.',
    weg: { kan: true, hoe: 'Alles is met een knop uit te zetten. Wat u eerder aan- of uitzette blijft in de geschiedenis staan, want dat is het bewijs van uw toestemming.' },
    bron: 'server/kern/identiteit/commercieel.js' },

  /* DE TWEE DIE NIET WEG KUNNEN, en ze staan er juist daarom in. */
  { id: 'facturen', naam: 'Uw facturen en betalingen', waar: 'operationeel', herkomst: 'gemeten',
    doel: 'De uitvoering van een overeenkomst, en de administratie die de wet van RTG eist.',
    weg: { kan: false, grond: 'wettelijk', reden: 'De fiscale bewaarplicht is zeven jaar. Ook na het verwijderen van uw account blijven deze regels staan -- zonder uw naam waar dat kan, maar ze blijven. Een belofte dat alles weg kan, zou hier een leugen zijn.' },
    bron: 'server/kern/vergeten.js' },

  { id: 'inzagejournaal', naam: 'Wie er in uw dossier keek', waar: 'operationeel', herkomst: 'gemeten', meet: 'inzage',
    doel: 'U kunnen laten zien wie uw echte naam achter uw codenaam opvroeg, en waarom.',
    weg: { kan: false, grond: 'beschermt-u', reden: 'Dit spoor bestaat om u te beschermen. Zou u het kunnen wissen, dan zou iemand die bij u keek dat ook kunnen -- en dan beschermt het niemand meer.' },
    bron: 'server/inzagelog.js' }
];

module.exports = { SOORTEN, WAAR, HERKOMST, GRONDEN };
