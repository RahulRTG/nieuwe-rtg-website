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

  /* -- besluit: toegestaan omdat RTG heeft VASTGESTELD dat het buiten de
     vergunningplicht valt, en niet omdat er een vergunning ligt of een partner
     het doet. Een vierde soort en geen stilzwijgende weglating: wat hier niet
     stond, ontbrak gewoon in de lijst, en dan lijkt "hij staat er niet in" op
     "er is over nagedacht". De reden staat erbij en is daarmee aanvechtbaar --
     dat is het hele punt van hem opschrijven. */
  WALLET_SALDO: { soort: 'besluit', naam: 'Walletsaldo van leden aanhouden',
    besluit: 'Een gesloten circuit met harde plafonds: saldo is alleen binnen RTG te besteden, ' +
      'wordt niet uitbetaald aan het lid en kent een maximum per wallet en per boeking. ' +
      'RTG rekent dit tot een beperkt netwerk. Verandert een van die drie -- uitbetaling aan ' +
      'het lid, besteding buiten RTG, of het loslaten van de plafonds -- dan vervalt de grond ' +
      'onder dit besluit en hoort dit vermogen van soort te wisselen.' },

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
  onbekend: 'Deze handeling staat niet in de bevoegdhedenlijst.'
};

module.exports = { RANG, SOORTEN, VERMOGENS, zinnen };
