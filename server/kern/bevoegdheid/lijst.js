/* De BEVOEGDHEDENLIJST: welke financiele handelingen dit huis kent en wat elk
   van ze vraagt. Los van de motor die het oordeel velt (./index), want dit is
   het stuk dat een bestuurder of jurist moet kunnen lezen zonder een regel code
   te begrijpen -- en dat stuk hoort niet verstopt te zitten tussen de
   vergelijkingen die het toepassen.

   Wijzigt hier iets, dan verandert wat RTG mag. Dat is geen implementatiedetail
   maar een besluit; behandel het zo. */
'use strict';

const RANG = { betaalinstelling: 1, elektronischgeldinstelling: 2, bank: 3 };
const SOORTEN = Object.keys(RANG);

/* De lijst. `nodig` zegt wat de handeling vraagt; `rail` zegt bij welke rail die
   eis geldt -- 'eigen' betekent: over onze eigen rails is dit vergunningswerk,
   over de partnerrail is het de partner die bevoegd is. */
const VERMOGENS = {
  // -- software: dit mogen we altijd, het is rekenen op eigen gegevens --
  BANK_SCHERM:        { soort: 'software', naam: 'De bank-app tonen' },
  INZICHTEN:          { soort: 'software', naam: 'Uitgaven-inzichten' },
  BUDGETTEREN:        { soort: 'software', naam: 'Budgetten en vaste lasten' },
  SPAARDOELEN:        { soort: 'software', naam: 'Spaardoelen (een streefbedrag tonen)' },

  // -- partner of eigen, afhankelijk van de rail --
  REKENING_HOUDEN:    { soort: 'rail', naam: 'Betaalrekeningen aanhouden', eigenNodig: 'bank', partnerRail: 'rekeningen' },
  KLANTGELD:          { soort: 'rail', naam: 'Klantgeld aanhouden', eigenNodig: 'bank', partnerRail: 'rekeningen' },
  SEPA_UIT:           { soort: 'rail', naam: 'SEPA-overboeking versturen', eigenNodig: 'betaalinstelling', partnerRail: 'sepa' },
  SEPA_IN:            { soort: 'rail', naam: 'SEPA-overboeking ontvangen', eigenNodig: 'betaalinstelling', partnerRail: 'sepa' },
  INCASSO:            { soort: 'rail', naam: 'Automatische incasso', eigenNodig: 'betaalinstelling', partnerRail: 'sepa' },
  PAS_UITGIFTE:       { soort: 'rail', naam: 'Betaalpassen uitgeven', eigenNodig: 'elektronischgeldinstelling', partnerRail: 'passen' },
  GELD_UITGEVEN:      { soort: 'rail', naam: 'Eigen geld in omloop brengen', eigenNodig: 'elektronischgeldinstelling', partnerRail: null },

  PARTNER_UITBETALING: { soort: 'rail', naam: 'Partnersaldo uitbetalen naar de bank', eigenNodig: 'betaalinstelling', partnerRail: 'sepa' },

  /* -- afhankelijk: dezelfde handeling is een ANDERE handeling geworden --

     WALLET_SALDO was jarenlang een `besluit`: toegestaan omdat RTG had
     VASTGESTELD dat het buiten de vergunningplicht viel. De redenering was een
     beperkt netwerk, en hij stond op drie voorwaarden -- saldo alleen binnen RTG
     te besteden, niet uitbetaald aan het lid, en plafonds -- met een
     vervalclausule erbij: verandert een van die drie, dan hoort dit vermogen van
     soort te wisselen.

     Op 24 augustus 2026 is besloten dat leden hun saldo moeten kunnen
     terugstorten. Dat is de tweede voorwaarde. Saldo dat tegen de nominale
     waarde inwisselbaar is voor de houder, IS elektronisch geld; een besluit kan
     dat niet wegschrijven, want het gaat over wat de handeling is en niet over
     hoe we hem noemen.

     EN DAAROM STAAT HIER GEEN KEUZE MAAR EEN AFHANKELIJKHEID. RTG wil beide
     posities kunnen innemen -- dat is een legitieme bedrijfskeuze, en het is
     precies waarom die keuze niet los mag staan van wat hij juridisch betekent.
     Vandaar `soort: 'afhankelijk'`: welk gezicht geldt, hangt af van de
     terugstortstand in de boardroom (kern/bankregie/vergunning.js).

       gesloten -> een BESLUIT. Geen uitbetaling aan het lid, dus een gesloten
                   circuit met plafonds, dus een beperkt netwerk. Geen
                   vergunning nodig, en de grond staat erbij zodat iemand hem
                   kan tegenspreken.
       open     -> een RAIL. Draait de partnerrail (de partij die het geld
                   aanhoudt en bevoegd is), dan levert RTG het scherm en de
                   administratie. Over de EIGEN rails moet RTG het zelf mogen,
                   en dan is de eis elektronischgeldinstelling en niet
                   betaalinstelling: klantgeld aanhouden dat inwisselbaar is, is
                   zwaarder dan een betaling doorgeven.

     Zo kan de knop om zonder dat er ooit een stand bestaat waarin de code iets
     anders doet dan het document zegt. Dat was de fout die dit hele traject
     heeft blootgelegd, en dit is de vorm die hem structureel uitsluit.

     Waar de voorwaarden worden afgedwongen die in BEIDE standen gelden:
       plafond per wallet   kern/waarde/klassen.js  (plafondCenten per klasse)
       plafond per boeking  kern/pay/stand.js       (MAX_CENTEN)
       alleen binnen RTG    kern/waarde/policy.js   (bestedingsgebied)
       en de poort erlangs  kern/pay/poort.js       (bij elke boeking) */
  WALLET_SALDO: { soort: 'afhankelijk', naam: 'Walletsaldo van leden aanhouden',
    hangtAf: 'terugstorting', zonderStand: 'open',   // een rail kan weigeren, een besluit nooit
    gesloten: { soort: 'besluit',
      besluit: 'Een gesloten circuit met harde plafonds: saldo is alleen binnen RTG te besteden, ' +
        'wordt niet uitbetaald aan het lid en kent een maximum per wallet en per boeking. ' +
        'RTG rekent dit tot een beperkt netwerk. Zet de boardroom het terugstorten open, dan ' +
        'vervalt deze grond en wordt dit vermogen een rail met een vergunningseis.' },
    open: { soort: 'rail', eigenNodig: 'elektronischgeldinstelling', partnerRail: 'rekeningen' } },

  /* De terugstorting zelf. Apart van WALLET_SALDO omdat het een andere handeling
     is: het aanhouden van saldo en het uitbetalen ervan kunnen los van elkaar
     dicht staan, en bij een storing op de uitbetaalrail hoort de wallet niet mee
     te vallen. Elke uitbetaalbare waardeklasse noemt haar vermogen bij naam
     (kern/waarde/klassen.js, `uitbetaalVermogen`), zodat uitbetaalbaarheid nooit
     met één boolean aan te zetten is zonder te zeggen waarop hij rust.

     In de stand `gesloten` bestaat deze handeling niet -- niet "hij mag even
     niet", maar hij hoort niet bij wat RTG dan is. Het antwoord zegt dat ook met
     zoveel woorden, want "geweigerd" zonder reden stuurt een lid naar de
     helpdesk voor iets dat een bewuste keuze is. */
  LID_UITBETALING: { soort: 'afhankelijk', naam: 'Walletsaldo terugstorten naar het lid',
    hangtAf: 'terugstorting', zonderStand: 'gesloten',   // bij twijfel gaat er geen geld het huis uit
    gesloten: { soort: 'stand',
      reden: 'RTG betaalt walletsaldo op dit moment niet terug aan leden. Saldo is bedoeld om ' +
        'binnen RTG te besteden.' },
    open: { soort: 'rail', eigenNodig: 'elektronischgeldinstelling', partnerRail: 'sepa' } },

  // -- puur vergunning: geen partner doet dit voor ons, en geen rail verandert het --
  KREDIET_EIGEN_BOEK: { soort: 'vergunning', naam: 'Krediet uit eigen boek', nodig: 'bank' },
  RENTE_OP_DEPOSITO:  { soort: 'vergunning', naam: 'Rente over spaargeld uitkeren', nodig: 'bank' }
};

const zinnen = {
  besluit: 'Toegestaan op grond van een vastgesteld besluit, niet op grond van een vergunning.',
  geen: 'RTG mag dit zelf nog niet; hiervoor is een vergunning nodig die nog niet is vastgelegd.',
  rang: 'De vastgelegde vergunning is niet toereikend voor deze handeling.',
  verlopen: 'De vastgelegde vergunning is verlopen.',
  land: 'De vergunning geldt niet voor dit land.',
  rail: 'De partner die dit voor RTG doet, staat op dit moment uit.',
  'alleen-eigen': 'Dit kan alleen over de eigen rails, en die clearen op dit moment niet.',
  /* `stand` is geen storing en geen ontbrekende vergunning maar een KEUZE, en
     het antwoord hoort dat verschil te maken. Wie leest "hiervoor is een
     vergunning nodig" gaat wachten; wie leest "dit doen we niet" weet waar hij
     aan toe is. De echte reden komt uit het gezicht zelf en overschrijft deze
     zin -- hij staat hier alleen voor het geval iemand een stand-gezicht maakt
     zonder reden erbij. */
  stand: 'Deze handeling staat uit; dat is een keuze van RTG en geen storing.',
  onbekend: 'Deze handeling staat niet in de bevoegdhedenlijst.'
};

/* WELK GEZICHT GELDT ER NU? Een vermogen van de soort `afhankelijk` draagt twee
   volledig uitgeschreven gezichten en een `hangtAf` die zegt welke stand
   beslist. Deze functie plakt het geldende gezicht op de naam en het id, zodat
   de rest van de motor er niets van hoeft te weten: hij ziet gewoon een besluit,
   een rail of een stand.

   Ontbreekt de stand (de aanroeper geeft hem niet), dan geldt `zonderStand`:
   het strengste gezicht, en dat is per vermogen een ANDER gezicht. Bij
   WALLET_SALDO is `open` het strengste (een rail die een vergunning vraagt kan
   weigeren, een besluit nooit); bij LID_UITBETALING is `gesloten` het strengste
   (die staat altijd nee). Een terugval die simpelweg altijd `open` koos, zou de
   ene goed doen en de andere juist openzetten -- vandaar dat elk vermogen zelf
   zegt welke het is, in plaats van dat deze functie het raadt. Onwetendheid is
   geen toestemming. */
function gezichtVan(f, stand) {
  if (!f || f.soort !== 'afhankelijk') return f;
  const naam = (stand && f[stand]) ? stand : f.zonderStand;
  return { ...f[naam], naam: f.naam, hangtAf: f.hangtAf, stand: (stand && f[stand]) ? stand : null };
}

module.exports = { RANG, SOORTEN, VERMOGENS, zinnen, gezichtVan };
