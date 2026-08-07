/* AFGESCHREVEN MOET BIJGESCHREVEN WORDEN.

   WAT ER MISGING. Laadt een lid zijn RTG Pay-wallet op met de kaart, dan zijn er
   twee wegen: de aanbieder bevestigt meteen (demostand), of de klant rondt af in
   het Apple Pay-scherm en de aanbieder bevestigt LATER, via de webhook.

   Die tweede weg liep dood. payOpladen gaf netjes 402 "de betaling wacht op
   bevestiging" en het commentaar beloofde "de webhook crediteert daarna" -- maar
   niets vertelde die webhook welke oplading bij welk lid hoorde. Hij kijkt in
   db.data.kaartWachtend, en daar zette alleen de FACTUUR-stroom iets in. De
   webhook vond dus niets, logde "zonder wachtende betaling" en antwoordde 200.

   Uitkomst bij een echte aanbieder: de kaart van het lid afgeschreven, zijn
   wallet nooit bijgeschreven, en niemand die het merkte. In demostand valt het
   niet op, want daar is de betaling meteen betaald en komt de code hier niet
   eens langs -- exact dezelfde blinde vlek die kern/settlement.js in zijn eigen
   kop beschrijft voor de facturen. Twee keer dezelfde val, jaren uit elkaar.

   Deze toets loopt de trage weg af: registreren, dan bevestigen, dan kijken of
   het geld er staat. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

const { maakSettlement } = require('../server/kern/settlement');

test('een oplading die pas later bevestigd wordt, komt alsnog op de wallet', async () => {
  const geboekt = [];
  const db = { data: { kaartWachtend: {} } };
  const settle = maakSettlement({
    db, save: () => {}, accounts: {}, fonds: {}, log: { info() {}, error() {} },
    dpRegistreerMunt: () => {},
    payOplaadAfronden: async (a) => { geboekt.push(a); return { ok: true, saldo: a.centen, geladen: a.centen }; }
  });

  // wat payOpladen achterlaat als de aanbieder nog niet klaar is
  const wacht = { soort: 'oplaad', codenaam: 'Katja Kiss', centen: 2500, oms: 'Opladen', at: Date.now() };
  await settle(wacht, { id: 'pi_test_1', centen: 2500, hoe: 'Betaald per kaart' });

  assert.equal(geboekt.length, 1, 'de bevestigde oplading hoort bijgeschreven te worden, niet in het niets te vallen');
  assert.equal(geboekt[0].codenaam, 'Katja Kiss');
  assert.equal(geboekt[0].centen, 2500, 'en met het bedrag dat de aanbieder BEVESTIGDE, niet met wat de app vroeg');
  assert.equal(geboekt[0].ref, 'pi_test_1', 'met het betaal-id als verwijzing, zodat het na te lopen is');
});

test('het bedrag komt van de aanbieder, niet van de aanvraag', async () => {
  const geboekt = [];
  const settle = maakSettlement({
    db: { data: {} }, save: () => {}, accounts: {}, fonds: {}, log: { info() {}, error() {} },
    dpRegistreerMunt: () => {},
    payOplaadAfronden: async (a) => { geboekt.push(a); return { ok: true }; }
  });
  // de app vroeg 5000, de aanbieder bevestigde 2500: dan hoort er 2500 op te komen
  await settle({ soort: 'oplaad', codenaam: 'Katja Kiss', centen: 5000, oms: 'Opladen' },
    { id: 'pi_test_2', centen: 2500 });
  assert.equal(geboekt[0].centen, 2500, 'wie het bedrag uit de AANVRAAG boekt, boekt geld dat niet betaald is');
});

/* En als het bijschrijven zelf niet kan: dan mag het niet stil zijn. Een
   afwikkeling die faalt en niets zegt, is precies de fout die hierboven staat. */
test('kan de oplading niet worden bijgeschreven, dan staat dat in het logboek', async () => {
  const fouten = [];
  const settle = maakSettlement({
    db: { data: {} }, save: () => {}, accounts: {}, fonds: {},
    log: { info() {}, error: (m) => fouten.push(String(m)) },
    dpRegistreerMunt: () => {},
    payOplaadAfronden: async () => ({ error: 'grootboek dicht' })
  });
  await settle({ soort: 'oplaad', codenaam: 'Katja Kiss', centen: 2500 }, { id: 'pi_test_3', centen: 2500 });
  assert.equal(fouten.length, 1, 'een mislukte bijschrijving hoort te worden gemeld, niet geslikt');
  assert.match(fouten[0], /NIET bijgeschreven/, 'en de melding hoort te zeggen wat er niet gebeurde: ' + fouten[0]);
});

test('zonder betaalkern wordt een oplading niet stil weggegooid', async () => {
  const fouten = [];
  const settle = maakSettlement({
    db: { data: {} }, save: () => {}, accounts: {}, fonds: {},
    log: { info() {}, error: (m) => fouten.push(String(m)) },
    dpRegistreerMunt: () => {}
    // payOplaadAfronden ontbreekt met opzet: de draad is niet gelegd
  });
  await settle({ soort: 'oplaad', codenaam: 'Katja Kiss', centen: 2500 }, { id: 'pi_test_4', centen: 2500 });
  assert.equal(fouten.length, 1, 'een ontbrekende draad hoort op te vallen; anders verdwijnt het geld opnieuw in stilte');
});
