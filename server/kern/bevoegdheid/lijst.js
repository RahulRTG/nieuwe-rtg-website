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
     Ze staan in ./lijst-afhankelijk.js; zie de kop daar voor waarom een
     afhankelijk vermogen een andere VORM heeft dan de rest van deze lijst, en
     waarom elk van ze zijn eigen schakelaar bij naam noemt. */
  ...require('./lijst-afhankelijk').AFHANKELIJK,
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
