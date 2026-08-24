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

  /* HIER STOND EEN BESLUIT, EN DAT IS OP 24 AUGUSTUS 2026 VERVALLEN.

     WALLET_SALDO was jarenlang van de soort `besluit`: toegestaan omdat RTG had
     VASTGESTELD dat het buiten de vergunningplicht viel, en niet omdat er een
     vergunning lag of een partner het deed. De redenering was een beperkt
     netwerk, en hij stond op drie voorwaarden: saldo alleen binnen RTG te
     besteden, niet uitbetaald aan het lid, en een maximum per wallet en per
     boeking. Het besluit droeg zijn eigen vervalclausule -- verandert een van
     die drie, dan hoort dit vermogen van soort te wisselen.

     Rahul heeft besloten dat leden hun saldo moeten kunnen terugstorten op hun
     eigen rekening. Dat is de tweede voorwaarde, en daarmee is de clausule
     ingegaan. Niet als formaliteit: saldo dat tegen de nominale waarde
     inwisselbaar is voor de houder, IS elektronisch geld. Een besluit kan dat
     niet wegschrijven, want het gaat over wat de handeling is en niet over hoe
     we hem noemen.

     Dus wisselt hij van soort, precies zoals afgesproken. Van `besluit` naar
     `rail`: draait de partnerrail (de partij die het geld aanhoudt en bevoegd
     is), dan levert RTG het scherm en de administratie. Over de EIGEN rails
     moet RTG het zelf mogen, en dan is de eis elektronischgeldinstelling en
     niet betaalinstelling -- klantgeld aanhouden dat inwisselbaar is, is een
     zwaardere handeling dan een betaling doorgeven.

     Dit is precies waar deze hele laag voor is gebouwd: de ervaring kon af
     zonder te doen alsof er bevoegdheden waren die er niet zijn, en bij een
     echte vergunning verandert alleen wat er in de boardroom is vastgelegd.

     Wat er van de drie voorwaarden OVER is, en waar het wordt afgedwongen:
       plafond per wallet   kern/waarde/klassen.js  (plafondCenten per klasse)
       plafond per boeking  kern/pay/stand.js       (MAX_CENTEN)
       alleen binnen RTG    kern/waarde/policy.js   (bestedingsgebied)
       en de poort erlangs  kern/pay/poort.js       (bij elke boeking) */
  WALLET_SALDO: { soort: 'rail', naam: 'Walletsaldo van leden aanhouden',
    eigenNodig: 'elektronischgeldinstelling', partnerRail: 'rekeningen' },

  /* De terugstorting zelf. Apart van WALLET_SALDO omdat het een andere handeling
     is: het aanhouden van saldo en het uitbetalen ervan kunnen los van elkaar
     dicht staan, en bij een storing bij de uitbetaalrail hoort de wallet niet
     mee te vallen. Elke uitbetaalbare waardeklasse noemt haar vermogen bij naam
     (kern/waarde/klassen.js, `uitbetaalVermogen`), zodat uitbetaalbaarheid nooit
     met één boolean aan te zetten is zonder te zeggen waarop hij rust. */
  LID_UITBETALING: { soort: 'rail', naam: 'Walletsaldo terugstorten naar het lid',
    eigenNodig: 'elektronischgeldinstelling', partnerRail: 'sepa' },

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
