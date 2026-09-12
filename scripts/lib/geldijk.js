#!/usr/bin/env node
/* DE IJKPROEF VAN DE GELDWACHT: een schrijfactie met opzet, om te zien of de
   wacht hem opmerkt en goed indeelt.

   WAAROM DIT EEN EIGEN BESTAND IS EN GEEN GEGENEREERDE CODE IN DE TOETS. De
   eerste versie schreef dit programma als string vanuit test/geldkaart.test.js,
   en de keuring wees dat terecht af: een `require` op een samengestelde string is
   niet na te lopen, en een toets die code GENEREERT om een meter te ijken, ijkt
   uiteindelijk zijn eigen generator mee. Hier staat hij als gewoon bestand met
   gewone requires, en de toets kiest alleen nog WELK scenario er draait.

   Het draait als los proces met de wacht als preload:
     node --require scripts/lib/geldwacht.js scripts/lib/geldijk.js <scenario>

   Een kindproces en niet in-process, want de wacht hangt zich in db/state.js en
   die haak wil je niet in de toetsloper laten staan voor wie erna komt. */
'use strict';

const state = require('../../server/db/state.js');

const SCENARIOS = {
  /* Een waardemutatie die om elke poort heen gaat. Dit MOET `buiten-kern`
     opleveren; doet hij dat niet, dan is de nul van de geldkaart niets waard. */
  buitenPoort() {
    state.db.data = {};
    state.db.data.paySaldi = {};
    state.db.data.paySaldi['lid:STIEKEM'] = 999999;
  },
  /* De hele bak vervangen. Dit hoort `container` te heten: een eigen stand, want
     kern/pay/opladen.js vervangt bij een herstart in motor-modus de complete
     saldostand en dat verandert wel degelijk geld. */
  container() {
    state.db.data = {};
    state.db.data.bankSaldi = {};
  },
  /* Een collectie die effectcollecties.js niet kent. De wacht hoort hier NIETS
     van te zien -- niet omdat het onbelangrijk is, maar omdat een nieuwe geldbak
     in dat register hoort te worden aangemeld en nergens anders. */
  onbekendeBak() {
    state.db.data = {};
    state.db.data.verzonnenBak = {};
    state.db.data.verzonnenBak.x = 1;
  }
};

const naam = process.argv[2];
const scenario = SCENARIOS[naam];
if (!scenario) {
  console.error('geldijk: onbekend scenario "' + naam + '". Keuze: ' + Object.keys(SCENARIOS).join(', '));
  process.exit(2);
}
scenario();
