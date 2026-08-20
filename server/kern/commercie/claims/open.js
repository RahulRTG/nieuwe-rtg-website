/* WAT RTG BELOOFT MAAR NOG NIET AFDWINGT.

   ../claims.js draagt de beweringen die WEL gedekt zijn: een prijs uit de ladder,
   een vergoeding uit de tarieventabel, een afdracht uit het allocatiebeleid. Dit
   bestand draagt de andere soort, en die hoort apart te staan omdat het een ander
   soort ding is: hier staat wat er is BESLOTEN en nog niet gebouwd.

   ELKE REGEL HIER DRAAGT EEN KANTTEKENING die zegt wat eraan ontbreekt. Dat is
   geen beleefdheid maar de eis van ./poort.js: een belofte zonder kanttekening
   wordt geweigerd. Een gat dat eerlijk BELOFTE heet is werkvoorraad; een gat dat
   zich AFGEDWONGEN noemt is een leugen met een nette naam. */
'use strict';

const ladder = require('../../pasladder');
const caps = require('../capaciteiten');
const { DEKKING } = require('./poort');

function openBeloften() {
  const uit = [];
  uit.push({
    id: 'claim.partner.entry_fee',
    onderwerp: 'Partner-entree',
    waarde: 'GEEN',
    tekst: 'een partnerplek hoort bij een zakelijk abonnement (' +
      caps.tredenMet('can_be_partner').map(t => (ladder.trede(t) || {}).naam || t).join(' of ') +
      '); er is geen entree, geen aparte contributie en geen doorbelasting van onderhoudskosten',
    bron: 'kern/commercie/capaciteiten.js + kern/pasladder.js',
    /* Stond hier als BELOFTE met waarde TE_HERZIEN: de partnervoorwaarden
       noemden een entree van 10.000 euro plus 500 per jaar, naast een Business
       Lite van 150 per maand. Twee toegangsprijzen naast elkaar is onuitlegbaar,
       en 10.000 euro sluit precies de kleine zaak buiten voor wie die trede
       bedoeld is. De entree is ingetrokken; wat overblijft is het abonnement, en
       dat komt uit de ladder. */
    dekking: DEKKING.AFGEDWONGEN,
    toets: 'test/commercie.test.js'
  });
  uit.push({
    id: 'claim.member.price_guarantee',
    onderwerp: 'Ledenprijsgarantie',
    waarde: 'PLAFOND_EN_RECHTZETTING',
    tekst: 'een lid betaalt nooit meer dan de publieke prijs van de partner',
    bron: 'kern/util.js + routes/supplier/menukaart.js',
    /* Stond op GEBOUWD met "geen meldknop en geen terugbetaalstroom". Allebei
       bestaan ze nu: kern/commercie/prijsmelding.js met zijn routes, en de
       commerciele ronde die het verschil ook echt boekt. */
    dekking: DEKKING.AFGEDWONGEN,
    toets: 'test/partner.test.js + test/prijsmelding.test.js + test/ronde.test.js'
  });

  /* WAT ER MET EEN VASTGELEGDE VERPLICHTING GEBEURT. Deze claim bestond niet, en
     dat was precies het gat: drie lagen legden bedragen vast en niets pakte ze
     op. Een functie zonder beller is stiller dan een ontbrekende functie. */
  uit.push({
    id: 'claim.settlement.rounds',
    onderwerp: 'Vastgelegde verplichtingen worden opgepakt',
    waarde: 'RONDE_ELKE_5_MIN',
    tekst: 'een vastgelegde verplichting blijft niet liggen: een terugkerende ronde boekt het ' +
      'ledenvoordeel aan de zaak, zet een rechtgezet prijsverschil bij het lid terug, herkanst ' +
      'mislukte betaaldienstboekingen en zet aflopende contracten op verlengbaar',
    bron: 'kern/commercie/ronde.js + kern/commercie/verrekening.js',
    dekking: DEKKING.AFGEDWONGEN,
    toets: 'test/ronde.test.js + test/commercie-ronde.e2e.js'
  });

  /* De bundelprijs. Stond in COMMERCIE.md als "bewust niet gebouwd" omdat de
     inkoopkant ontbrak -- en dat was eerlijk, maar geen eindstand: de klant
     krijgt te horen dat hij een bundel kan kopen, en dan hoort er te staan wat
     die kost. De som bestaat nu; of er een PRIJS uitkomt hangt aan een
     boardroom-instelling, en zonder die instelling is de bundel niet te koop. */
  uit.push({
    id: 'claim.ai.bundle_price',
    onderwerp: 'Prijs van een AI-bundel',
    waarde: 'GEREKEND_NIET_GEKOZEN',
    tekst: 'de verkoopprijs van een bundel volgt uit inkoopkosten, veiligheidsmarge en ' +
      'platformmarge; zonder ingestelde inkoopkosten is er geen prijs en is de bundel niet te koop',
    bron: 'kern/commercie/bundelprijs.js',
    dekking: DEKKING.AFGEDWONGEN,
    toets: 'test/bundelprijs.test.js'
  });

  /* WAT EEN ABONNEMENT BEVAT, en dat het ook echt wordt afgedwongen. Dit was tot
     20 augustus 2026 een folder: het profiel stond er en zes van de acht
     capabilities werden nergens gevraagd -- omdat een zaak helemaal geen
     abonnement droeg. */
  uit.push({
    id: 'claim.subscription.capabilities',
    onderwerp: 'Wat een abonnement bevat',
    waarde: Object.keys(caps.CAPS).length + '_CAPABILITIES',
    tekst: 'elke trede heeft een productprofiel dat zegt wat het abonnement bevat, en een zaak ' +
      'draagt de trede waarop zij is toegelaten; de vraag "mag deze klant dit" wordt op een plek ' +
      'beantwoord en niet per bestand opnieuw',
    bron: 'kern/commercie/capaciteiten.js + kern/commercie/zaakabonnement.js',
    dekking: DEKKING.AFGEDWONGEN,
    toets: 'test/zaakabonnement.test.js + test/commercie.test.js'
  });
  return uit;
}

module.exports = { openBeloften };
