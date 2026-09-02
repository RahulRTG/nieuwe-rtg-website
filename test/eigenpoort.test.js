/* ============================================================================
   DE POORT IN DE HANDLER IS IETS ANDERS DAN OPENBAAR.

   WAT ER MIS GING, en het was mijn eigen keuze. Om tien routes meetbaar te
   maken zette ik ze op de openbaar-lijst (scripts/lib/publiek.js). De keuring
   wees dat af, en terecht: keuringsregel 28 controleert ook de ANDERE kant op.
   Staat een pad op de uitzonderingslijst terwijl het inmiddels een eigen poort
   heeft, dan hoort de uitzondering weg -- want een overbodige uitzondering dekt
   straks een poort die iemand weghaalt. Alle tien gingen daarop af.

   De fout was niet de meting maar het middel: een uitzonderingslijst oprekken
   om een meetprobleem op te lossen. Dat is precies wat dit project moet
   voorkomen, en de keuring ving het voor het gebeurd was.

   DRIE LEGE SLEUTELS, DRIE WOORDEN. `openbaar` staat voor iedereen open,
   `omgeving` alleen vanaf een intern adres, `eigen-poort` laat de handler zelf
   oordelen. Ze sturen alle drie geen token mee en betekenen alle drie iets
   anders; ze samenvoegen zou een inlogdeur laten lezen als een open deur.

   DE MUTATIE: zet een pad uit EIGEN_POORT ook op de PUBLIEK-lijst -> de tweede
   toets zakt (en keuringsregel 28 ook).
   ========================================================================== */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { EIGEN_POORT } = require('../scripts/lib/eigenpoort');
const { PUBLIEK, ALLEEN_ANONIEM } = require('../scripts/lib/publiek');
const bk = require('../scripts/lib/bewakers.js');

test('elke route met een eigen poort draagt een uitgeschreven reden', () => {
  assert.ok(EIGEN_POORT.size > 0);
  for (const [pad, reden] of EIGEN_POORT) {
    assert.ok(pad.startsWith('/api/'), pad + ' is geen API-pad');
    assert.ok(reden && reden.length > 30,
      pad + ': geen uitgeschreven reden. Kun je die niet schrijven, dan is het waarschijnlijk een gat');
  }
});

test('geen enkele staat OOK op de openbaar-lijst van de keuring', () => {
  /* Dat is precies wat keuringsregel 28 afwijst: een uitzondering die
     overbodig is, dekt straks een poort die iemand weghaalt. */
  for (const pad of EIGEN_POORT.keys()) {
    assert.ok(!PUBLIEK.has(pad), pad + ' staat in EIGEN_POORT en op de openbaar-lijst');
  }
});

test('maar ALLEEN_ANONIEM mag wel overlappen, en dat is geen slordigheid', () => {
  /* TWEE VERSCHILLENDE VRAGEN, en ik had ze eerst als elkaars tegendeel
     getoetst.

       PUBLIEK        mag deze SCHRIJFroute zonder gezagsfunctie bestaan?
       ALLEEN_ANONIEM mag deze route 2xx antwoorden aan een anonieme klopper?
       EIGEN_POORT    zit de controle in de handler in plaats van ervoor?

     Een wachtwoordherstel antwoordt gewoon 2xx aan iemand zonder sessie -- dat
     IS de bedoeling -- en rekent tegelijk zelf een hersteltoken na. Beide waar,
     en de poortwacht heeft die eerste nodig om hem niet als bevinding te
     melden. Ze uit elkaar houden zou een van de twee instrumenten laten liegen.

     Wat NIET mag is de overlap met PUBLIEK hierboven: die lijst gaat over het
     ONTBREKEN van een poort, en daar is er hier juist wel een. */
  const overlap = [...EIGEN_POORT.keys()].filter(p => ALLEEN_ANONIEM.has(p));
  for (const pad of overlap) {
    assert.ok(EIGEN_POORT.get(pad).length > 30,
      pad + ' staat in twee lijsten en hoort dan zeker een uitgeschreven reden te dragen');
  }
});

test('de bewakerskaart geeft ze een eigen rol, en niet die van openbaar', () => {
  const pad = [...EIGEN_POORT.keys()][0];
  const u = bk.beoordeel({ bewakersBekend: true, bewakers: [], pad, methode: 'POST' });
  assert.equal(u.rol, 'eigen-poort');
  assert.notEqual(u.rol, 'openbaar',
    'een inlogdeur die zelf oordeelt, is geen deur die voor iedereen openstaat');
});

test('de drie lege sleutels blijven drie verschillende woorden', () => {
  const { ROLLEN } = require('../scripts/lib/proefsleutels');
  for (const r of ['openbaar', 'omgeving', 'eigen-poort']) {
    assert.ok(ROLLEN.includes(r), r + ' hoort een eigen rol te zijn');
  }
});
