/* HET EINDE VAN DE PARTIJMIGRATIE (eigenaarsbesluit 19 oktober 2026, keuze van
   de integrator dezelfde dag: een teller op het kantoor plus een datum als
   vangnet).

   Partijen van voor het besluit komen met hun oude sleutel nog binnen tot er
   een account aan hangt (kern/democratie/partijrol.js). Daarvoor staan de zes
   partijpaden nog in scripts/lib/publiek.js. Dat mag niet blijven hangen:

     1. de kantoorlijst telt de oude partijen (`oudePartijen`), zodat het kantoor
        ziet wanneer het op nul staat;
     2. EINDDATUM 19 JANUARI 2027. Na die dag zakt deze toets zolang de paden nog
        in publiek.js staan. Een toets kan de productiedata niet zien; de datum
        dwingt het opruimen af, ook als de teller niemand opviel. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const { PUBLIEK } = require('../scripts/lib/publiek');
const { maakDemocratie } = require('../server/kern/democratie');

const EINDE = Date.parse('2027-01-19T00:00:00Z');
const PADEN = ['/api/democratie/partij/wie', '/api/democratie/partij/kwesties', '/api/democratie/partij/voorstel/plaats',
  '/api/democratie/partij/voorstel/toelicht', '/api/democratie/partij/voorstel/aanname', '/api/democratie/partij/voorstel/mijn'];
const inschrijving = (aanduiding) => ({ aanduiding, niveau: 'gemeente', categorie: 'geregistreerd',
  bron: 'Register gemeentelijke aanduidingen, besluit 2026-12', gecontroleerd: '2026-10-19' });

test('na 19 januari 2027 staan de partijpaden niet meer op de publieke lijst', () => {
  const lijst = PUBLIEK instanceof Map ? [...PUBLIEK.keys()] : Object.keys(PUBLIEK);
  const nogOpen = PADEN.filter(p => lijst.includes(p));
  if (Date.now() < EINDE) return;
  assert.deepEqual(nogOpen, [], 'de partijmigratie had op 19 januari 2027 klaar moeten zijn: haal de paden uit ' +
    'scripts/lib/publiek.js, zet ze achter auth en verwijder vanOudeSleutel (kern/democratie/partijrol.js)');
});

test('de kantoorlijst telt de oude partijen, en koppelen haalt er een af', async () => {
  const db = { data: {} };
  const d = maakDemocratie({ db, save: () => {}, bijeen: async (fn) => fn(), inBundel: () => true, crypto,
    codenaamVan: (k) => 'Codenaam-' + k, meldLid: (k, n) => n });
  const oud = await d.register.registreer('user-kantoor', inschrijving('Partij Oud'));
  await d.register.registreer('user-kantoor', inschrijving('Partij Nieuw'));
  delete db.data.democratiePartijen[oud.partij.id].model;   // zo stond een partij van voor het besluit erin
  assert.equal(d.register.lijst().oudePartijen, 1, 'een oude partij, de nieuwe telt niet');
  assert.equal((await d.partijKoppel(oud.sleutel, 'user-7')).ok, true);
  assert.equal(d.register.lijst().oudePartijen, 0, 'na het koppelen staat de teller op nul');
});
