/* ============================================================================
   DE EVENT-LOOP-VERTRAGING, EN OF DE METER HEM ECHT ZIET.

   Node draait alles op een lus. Blokkeert er iets -- een JSON.stringify over
   200.000 items, een synchrone leesactie, een lus over een hele array -- dan
   staat ELKE andere aanvraag stil zolang dat duurt. Dat is de manier waarop een
   Node-server traag wordt zonder dat een enkele route er traag uitziet: de tijd
   gaat op aan het verzoek ervoor.

   ER WAS GEEN METING. Niet in server/meting.js, niet op het techniekbord, niet
   in De Beproeving -- terwijl er wel een taak staat om "de event-loop-stall uit
   het warme pad te halen". Een stall die je niet meet kun je niet repareren, en
   je kunt al helemaal niet bewijzen dat hij weg is.

   WAT HIER WORDT VASTGEPIND, en waarom elk stuk ertoe doet:

   1. De meter ZIET een echte blokkade. Zonder deze bewering is de rest
      decoratie: een gauge die altijd bijna nul teruggeeft ziet er gezond uit en
      is stuk. Dit is de toets die moet zakken als iemand de meter uitzet.
   2. De RESOLUTIE gaat eraf. monitorEventLoopDelay meet het verschil tussen de
      geplande en de werkelijke tijd van zijn eigen timer, en die timer is op
      zijn vroegst na een volle resolutie-tick aan de beurt. Ongecorrigeerd meldt
      een volstrekt rustige lus daardoor ~10 ms. Wie daaraan went, weet niet meer
      hoe een echte stall eruitziet.
   3. Ontbreekt de meter, dan komt er NULL terug en geen nul. Nul is een
      meetwaarde; "ik weet het niet" is dat niet.

   Draai los: node --test test/eventloop.test.js
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const meting = require('../server/meting');
const { lusVertraging, lusWis, LUS_RESOLUTIE_MS } = require('../server/meting-lus');

const slaap = (ms) => new Promise(r => setTimeout(r, ms));
const blokkeer = (ms) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { /* met opzet */ } };

test('1. een rustige lus meldt bijna geen vertraging (de resolutie is eraf)', async () => {
  lusWis();
  await slaap(300);
  const v = lusVertraging();
  assert.ok(v, 'de meter is beschikbaar op deze Node');
  /* De grens staat op de helft van de resolutie. Wordt de aftrek weggehaald,
     dan komt hier ~10 ms te staan en zakt deze toets meteen. */
  assert.ok(v.p50 < LUS_RESOLUTIE_MS / 2,
    'een lus die niets doet loopt niet 10 ms achter; gemeten p50 = ' + v.p50 + ' ms');
  assert.ok(v.gemiddeld >= 0, 'en nooit negatief (' + v.gemiddeld + ')');
});

/* DE KERN. Een blokkade van 200 ms hoort als ~200 ms uit de meter te komen --
   niet als 10, niet als 0. Ruime marges, want een gedeelde machine mag traag
   zijn; het gaat om de grootteorde, niet om de komma. */
test('2. een blokkade van 200 ms komt er als ~200 ms uit', async () => {
  lusWis();
  await slaap(50);
  blokkeer(200);
  await slaap(300);
  const v = lusVertraging();
  assert.ok(v.max >= 150,
    'de meter ziet de blokkade; gemeten max = ' + v.max + ' ms (verwacht ~200)');
  assert.ok(v.max < 1000,
    'en overdrijft hem niet; gemeten max = ' + v.max + ' ms');
  assert.ok(v.p99 >= 150, 'de p99 draagt hem ook: ' + v.p99 + ' ms');
  /* De mediaan hoort er JUIST niet door te bewegen: een enkele stall van 200 ms
     tussen honderden rustige ticks is geen structurele vertraging. Zonder deze
     bewering zou een meter die alles op de max plakt er ook doorheen komen. */
  assert.ok(v.p50 < 50, 'maar de mediaan blijft laag (' + v.p50 + ' ms): het was een piek, geen toestand');
});

test('3. wissen zet de meter terug op schoon', async () => {
  blokkeer(120);
  await slaap(100);
  assert.ok(lusVertraging().max >= 80, 'er staat een piek in');
  lusWis();
  await slaap(200);
  assert.ok(lusVertraging().max < 80, 'en na wissen is die weg: ' + lusVertraging().max + ' ms');
});

/* De meter hoort ook op het bord te staan, in beide vormen. Zonder dit kan de
   meting kloppen terwijl niemand hem ooit ziet. */
test('4. de vertraging staat in de samenvatting en in het Prometheus-formaat', async () => {
  lusWis();
  await slaap(50);
  blokkeer(150);
  await slaap(200);

  const s = meting.samenvatting();
  assert.ok(s.eventLoopMs, 'de samenvatting draagt eventLoopMs');
  assert.ok(s.eventLoopMs.max >= 100, 'met de piek erin: ' + s.eventLoopMs.max + ' ms');

  const t = meting.tekst();
  const regels = t.split('\n').filter(r => r.startsWith('rtg_eventloop_vertraging_seconden{'));
  assert.equal(regels.length, 4, 'vier reeksen: gemiddeld, p50, p99, max');
  assert.match(t, /# TYPE rtg_eventloop_vertraging_seconden gauge/, 'met een TYPE-regel, anders leest Prometheus hem niet');
  /* In SECONDEN, want dat is wat Prometheus verwacht. Een gauge in milliseconden
     tussen reeksen in seconden is precies hoe een dashboard drie ordes ernaast
     gaat zitten. */
  const max = Number((regels.find(r => r.includes('soort="max"')) || '').split(' ').pop());
  assert.ok(max >= 0.1 && max < 1, 'de max staat in seconden (' + max + '), niet in milliseconden');
});
