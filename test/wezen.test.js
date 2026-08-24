/* BLIJFT ER EEN SERVER STAAN NA EEN TOETSRONDE?

   Op 24 augustus draaide er tijdens een ronde een server/server.js met PPID 1:
   geen ouder meer, achtergebleven uit een toetskind dat zelf netjes afsloot. Hij
   at de hele ronde een van de vier kernen op. Er faalde niets -- de ronde was
   groen, alleen trager, en trager leest als een drukke machine. Twee rondes van
   1130 en 1172 seconden zijn zo gemeten voordat iemand toevallig ps draaide.

   De dader was test/tls-boot.test.js: die stopte server/trio.js met SIGKILL, en
   dat signaal is niet te vangen, dus de afsluiter die trio's drie werkers
   meeneemt draaide nooit. Gerepareerd -- maar de VOLGENDE zo'n lek moet meteen
   opvallen, en daarvoor telt scripts/test-runner.js nu de ouderloze servers voor
   en na elke ronde.

   Die teller is zelf een poort, en een poort die je niet hebt zien vuren bewaakt
   niets (LAT-regel 10). Deze toets maakt daarom een ECHT ouderloos proces en
   kijkt of hij gevonden wordt -- en, minstens zo belangrijk, of een server met
   een gewone ouder juist NIET wordt aangezien voor een lek.

   Draai los: node --experimental-sqlite --test test/wezen.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const cp = require('child_process');
const { ouderlozeServers, nieuweWezen, machinebeeld } = require('../scripts/lib/wezen.js');

const WORTEL = path.join(__dirname, '..');
const SERVERPAD = path.join(WORTEL, 'server', 'server.js');
const even = (ms) => new Promise(r => setTimeout(r, ms));

/* Een proces dat er precies uitziet als een achtergebleven server: het draagt
   het pad van server.js op zijn commandoregel en heeft geen ouder meer. Het
   START geen echte server -- dat zou poorten en data nodig hebben, en de teller
   kijkt naar de commandoregel en de ouder, niet naar wat er luistert.

   TWEE KEER FORKEN, want `detached` is niet genoeg: dat geeft een eigen sessie,
   maar de ouder blijft deze toets zolang die draait. Een proces raakt zijn ouder
   pas kwijt als die AFSLUIT. Dus start een schil het echte proces en verdwijnt
   meteen; wat overblijft hangt bij init. Precies zoals de gelekte server van
   24 augustus ontstond: het toetskind sloot af en liet zijn server los. */
function maakWees() {
  const script = 'setsid "' + process.execPath + '" -e "setTimeout(function(){}, 30000)" "' + SERVERPAD + '" </dev/null >/dev/null 2>&1 &';
  const schil = cp.spawnSync('sh', ['-c', script], { encoding: 'utf8' });
  assert.equal(schil.status, 0, 'de schil hoort te starten: ' + (schil.stderr || ''));
  return null;                       // de pid vinden we via de teller zelf
}

test('een ouderloze server wordt gevonden, met zijn pid', async () => {
  const voor = ouderlozeServers(WORTEL);
  assert.notEqual(voor, null, 'ps hoort leesbaar te zijn; anders zegt deze toets niets');

  maakWees();
  let gelekt = [];
  try {
    /* Even wachten tot de schil weg is en het proces bij init hangt. */
    for (let i = 0; i < 50 && !gelekt.length; i++) {
      await even(100);
      gelekt = nieuweWezen(voor, ouderlozeServers(WORTEL)) || [];
    }
    assert.equal(gelekt.length, 1,
      'er hoort precies EEN nieuwe ouderloze server gevonden te worden, gevonden: ' + JSON.stringify(gelekt));
    assert.match(gelekt[0].cmd, /server\.js/, 'en hij hoort herkenbaar te zijn aan zijn commandoregel');
  } finally { for (const w of gelekt) { try { process.kill(Number(w.pid), 'SIGKILL'); } catch (e) {} } }
});

test('een server MET ouder telt niet als lek', async () => {
  /* Zonder deze regel zou de teller ook de ontwikkelserver aanwijzen, en dan
     staat elke ronde rood om een reden die niemand kan wegnemen. */
  const kind = cp.spawn(process.execPath, ['-e', 'setTimeout(() => {}, 5000)', SERVERPAD], { stdio: 'ignore' });
  try {
    await even(300);
    const nu = ouderlozeServers(WORTEL);
    assert.equal(nu.has(String(kind.pid)), false,
      'dit proces heeft een ouder (deze toets) en hoort dus niet als wees te tellen');
  } finally { try { kind.kill('SIGKILL'); } catch (e) {} }
});

test('een ps die niets teruggeeft levert null, geen lege lijst', () => {
  /* De tak die met een ECHTE ps nooit gehaald wordt: die slaagt altijd. Een
     mutatie die hem op een lege Map zette bleef daardoor groen -- en een lege
     Map leest als "geen enkele wees", dus als "alles in orde". Precies het
     verschil tussen "in orde" en "ik heb niet gekeken" (LAT-regel 3). */
  for (const [wat, lezer] of [
    ['ps gooit', () => { throw new Error('geen ps'); }],
    ['ps geeft niets', () => null],
    ['ps geeft een foutcode', () => ({ status: 1, stdout: '' })],
    ['ps geeft lege uitvoer', () => ({ status: 0, stdout: '' })]
  ]) {
    let uitslag;
    try { uitslag = ouderlozeServers(WORTEL, lezer); } catch (e) { uitslag = 'GOOIDE'; }
    assert.equal(uitslag, null, 'met "' + wat + '" hoort er null uit te komen, niet ' + JSON.stringify(uitslag));
  }
  /* En de tegenproef: een lezer die WEL iets zegt, geeft gewoon een Map. */
  const echt = ouderlozeServers(WORTEL, () => ({ status: 0, stdout: '  123     1 node ' + SERVERPAD + '\n' }));
  assert.ok(echt instanceof Map && echt.has('123'), 'een bruikbare lezer hoort gewoon te tellen');
});

test('niet kunnen kijken is iets anders dan niets vinden', () => {
  /* LAT-regel 3. Ontbreekt een van de twee metingen, dan hoort het antwoord
     `null` te zijn en geen lege lijst -- een lege lijst leest als "alles in
     orde" en zou de ronde groen laten terwijl er niet gekeken is. */
  const echt = ouderlozeServers(WORTEL);
  assert.equal(nieuweWezen(null, echt), null, 'geen voormeting: dan weten we niets');
  assert.equal(nieuweWezen(echt, null), null, 'geen nameting: idem');
  assert.deepEqual(nieuweWezen(echt, echt), [], 'twee gelijke metingen: dan is er echt niets bijgekomen');
});

/* ============================================================================
   EN DE OMSTANDIGHEDEN VAN EEN RONDE.

   Een rondetijd zonder zijn omstandigheden is geen meting maar een indruk. Op
   24 augustus stond hier een grondmeting van 920 s naast rondes van 1130 en
   1172 s, en dat verschil is eerst voor een regressie aangezien. Het was er
   geen: tussen die metingen door kwam er een ontwikkelserver bij (drie werkers)
   en draaide er een gelekte server mee -- op vier kernen de halve machine, en
   geen van beide stond in de uitvoer.
   ========================================================================== */
test('het machinebeeld telt de servers en kent de kernen', () => {
  const beeld = machinebeeld(WORTEL);
  assert.notEqual(beeld, null, 'ps hoort leesbaar te zijn');
  assert.equal(typeof beeld.servers, 'number', 'het aantal serverprocessen hoort een getal te zijn');
  assert.ok(beeld.kernen >= 1, 'er hoort minstens een kern te zijn (' + beeld.kernen + ')');

  /* Een verzonnen processenlijst, zodat de telling zelf vastligt en niet
     afhangt van wat er toevallig draait. */
  const nep = () => ({ status: 0, stdout: [
    '  101     1 node ' + path.join(WORTEL, 'server', 'server.js'),
    '  102   101 node ' + path.join(WORTEL, 'server', 'server.js'),
    '  103     1 node ' + path.join(WORTEL, 'server', 'trio.js'),
    '  104     1 node /ergens/anders/server.js',
    '  105     1 bash -c iets'
  ].join('\n') });
  const geteld = machinebeeld(WORTEL, nep);
  assert.equal(geteld.servers, 3,
    'twee server.js en een trio.js van DEZE boom horen te tellen; een server.js elders niet');
});

test('geen leesbare processenlijst geeft ook hier null en geen nul', () => {
  /* Anders zou de ronde "0 servers actief" melden terwijl er niet gekeken is,
     en dan is die regel erger dan geen regel (LAT-regel 3). */
  for (const lezer of [() => { throw new Error('geen ps'); }, () => null, () => ({ status: 1, stdout: '' })]) {
    assert.equal(machinebeeld(WORTEL, lezer), null);
  }
});
