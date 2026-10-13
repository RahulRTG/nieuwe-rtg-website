/* TWEE KETENSTAPPEN DIE OOK LOKAAL DRAAIEN (BEWIJSLADDER.json, `alleenKeten`).

   scripts/toetsroutes.js en scripts/kwalificatie.js stonden alleen in de keten:
   de een leest artefacten van vier scherven, de ander een image dat de
   releaseketen net bouwde. De Slotsuite draait ze nu zelf -- de routekaart na
   de volle testronde, de kwalificatie via `--lokaal` in een tijdelijke
   werkboom. Deze toets bewaakt drie dingen: dat het lokale plan van de
   kwalificatie UIT de werkstroom komt (en dus niet kan afdrijven), dat de
   routekaart de duurmeting van precies deze ronde leest, en dat geen van
   beide iets overslaat of in de repository schrijft.

   Draai los: node --test test/ketenlokaal.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const WORTEL = path.join(__dirname, '..');
const kwal = require('../scripts/kwalificatie');
const WAARDEN = { GITHUB_SHA: 'c'.repeat(40), RTG_CANDIDATE_IMAGE: 'lokaal:app', RTG_CANDIDATE_BACKUP_IMAGE: 'lokaal:backup' };

test('het lokale kwalificatieplan is de bouw en de voor-controle van release-image.yml, in die volgorde', () => {
  const plan = kwal.lokaalPlan(WORTEL, WAARDEN).map(s => s.argv.join(' '));
  const ws = fs.readFileSync(path.join(WORTEL, '.github/workflows/release-image.yml'), 'utf8');
  // Geen van deze argumenten draagt een spatie, dus aanhalingstekens weghalen is hier exact.
  const vul = t => t.replace(/\$([A-Z_]+)/g, (m, n) => WAARDEN[n]).replace(/"/g, '');
  const uitWerkstroom = ws.split('\n').map(r => r.trim())
    .filter(r => /^docker build\b/.test(r) || /^node scripts\/kwalificatie\.js --(?:uit-image|controle --fase=voor)/.test(r))
    .map(vul);
  assert.deepEqual(plan, uitWerkstroom, 'elke opdracht letterlijk zoals de keten hem draait, alleen met lokale waarden');
  assert.equal(plan.length, 4);
  assert.ok(plan.every(o => !/--fase=na|--gepubliceerd|docker push/.test(o)),
    'geen na-controle zonder afbouw ertussen (die kan niet zakken) en niets dat een registry vraagt');
});

test('een opdracht die op een andere ketenwaarde leunt, maakt het plan ongeldig in plaats van stil anders', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-ketenlokaal-'));
  try {
    const bron = fs.readFileSync(path.join(WORTEL, '.github/workflows/release-image.yml'), 'utf8');
    fs.mkdirSync(path.join(root, '.github/workflows'), { recursive: true });
    fs.writeFileSync(path.join(root, '.github/workflows/release-image.yml'),
      bron.replace('--tag "$RTG_CANDIDATE_IMAGE" .', '--tag "$RTG_CANDIDATE_IMAGE" --label "$GEHEIM" .'));
    assert.throws(() => kwal.lokaalPlan(root, WAARDEN), /\$GEHEIM/);
    fs.writeFileSync(path.join(root, '.github/workflows/release-image.yml'),
      bron.replace(/^.*kwalificatie\.js --controle --fase=na.*$/m, ''));
    assert.throws(() => kwal.lokaalPlan(root, WAARDEN), /niet af te leiden/, 'zonder na-controle is de grens van het plan weg');
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('woorden: aanhalingen tellen, en een samengestelde opdracht wordt geweigerd', () => {
  assert.deepEqual(kwal.woorden('docker build --build-arg "A=b c" --tag x .'), ['docker', 'build', '--build-arg', 'A=b c', '--tag', 'x', '.']);
  assert.deepEqual(kwal.woorden('x ""'), ['x', '']);
  for (const slecht of ['a && b', 'a; b', 'a | b', 'a `b`', 'a "open'])
    assert.throws(() => kwal.woorden(slecht), /enkelvoudige opdracht|open aanhaling/, slecht);
});

test('de eisen: een vuile werkboom of geen docker-daemon zakt, en er is geen derde uitweg', () => {
  const daemon = { status: 0 };
  assert.equal(kwal.eisen('', daemon), null);
  assert.match(kwal.eisen(' M server/app.js\n', daemon), /niet schoon/);
  assert.match(kwal.eisen('?? nieuw.js\n', daemon), /niet schoon/, 'ook een nieuw bestand zit niet in het image');
  assert.match(kwal.eisen('', { status: 1 }), /docker-daemon/);
  assert.match(kwal.eisen('', { error: new Error('ENOENT') }), /docker-daemon/);
  assert.match(kwal.eisen('', null), /docker-daemon/);
});

test('--lokaal zonder docker-daemon zakt met exitcode 1, en raakt niets aan', () => {
  const r = spawnSync(process.execPath, [path.join(WORTEL, 'scripts/kwalificatie.js'), '--lokaal'],
    { cwd: WORTEL, encoding: 'utf8', env: { ...process.env, DOCKER_HOST: 'unix:///nergens/docker.sock' } });
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.match(r.stderr, /niet schoon|docker-daemon/);
});

test('toetsroutes --naar schrijft de kaart naar dat pad en niet in de repository', () => {
  const map = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-toetsroutes-'));
  try {
    const journaal = path.join(map, 'journaal');
    const duur = path.join(map, 'duur');
    const naar = path.join(map, 'kaart.json');
    fs.writeFileSync(journaal, 'TOETS GET /api/x ketenlokaal.test.js\n');
    fs.writeFileSync(duur, 'ketenlokaal.test.js\t12\tnormaal\tlokaal\n');
    const voor = fs.existsSync(path.join(WORTEL, 'TOETSROUTES.json'));
    const r = spawnSync(process.execPath, [path.join(WORTEL, 'scripts/toetsroutes.js'),
      '--lees', journaal, '--ronde', duur, '--naar', naar], { cwd: WORTEL, encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
    const kaart = JSON.parse(fs.readFileSync(naar, 'utf8'));
    assert.deepEqual(Object.keys(kaart.per['ketenlokaal.test.js'].kanten), ['GET /api/x']);
    assert.equal(fs.existsSync(path.join(WORTEL, 'TOETSROUTES.json')), voor, 'de repository bleef zoals hij was');
    const zonder = spawnSync(process.execPath, [path.join(WORTEL, 'scripts/toetsroutes.js'),
      '--lees', path.join(map, 'bestaat-niet'), '--naar', naar], { cwd: WORTEL, encoding: 'utf8' });
    assert.equal(zonder.status, 2, 'zonder journaal geen ronde, net als in de keten');
  } finally { fs.rmSync(map, { recursive: true, force: true }); }
});

/* Het pad van de duurmeting wordt bij het laden van de Slotsuite gekozen; een
   tweede proces moet een ander pad krijgen. */
function lagenVanEenProces() {
  const r = spawnSync(process.execPath, ['-e',
    'process.stdout.write(JSON.stringify(require(' + JSON.stringify(path.join(WORTEL, 'scripts/slotsuite.js')) + ').LAGEN))'],
    { cwd: WORTEL, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  return JSON.parse(r.stdout);
}

test('de Slotsuite: de routekaart leest de duurmeting van precies haar eigen testronde', () => {
  const lagen = lagenVanEenProces();
  const tests = lagen.find(l => l.id === 'tests');
  const [, [, draaier, env]] = tests.stappen[0];
  const [naam, [, kaartArgs]] = tests.stappen[1];
  assert.equal(draaier[0], 'scripts/test-runner.js');
  assert.equal(naam, 'toets-routekaart');
  assert.equal(kaartArgs[0], 'scripts/toetsroutes.js');
  const arg = v => kaartArgs[kaartArgs.indexOf(v) + 1];
  assert.equal(arg('--ronde'), env.RTG_TOETSDUUR, 'dezelfde duurmeting die de testronde schreef');
  assert.equal(arg('--lees'), '.routejournaal', 'het journaal dat de draaier bij het begin leeggooit');
  assert.equal(arg('--vorige'), 'TOETSROUTES.json');
  assert.ok(!path.resolve(WORTEL, env.RTG_TOETSDUUR).startsWith(WORTEL + path.sep), 'de duurmeting staat buiten de repository');
  assert.ok(!path.resolve(WORTEL, arg('--naar')).startsWith(WORTEL + path.sep), 'en de kaart ook');
  assert.equal(fs.existsSync(env.RTG_TOETSDUUR), false, 'een nieuw pad: er staat nog niets van een eerdere ronde');
  assert.notEqual(lagenVanEenProces().find(l => l.id === 'tests').stappen[0][1][2].RTG_TOETSDUUR, env.RTG_TOETSDUUR,
    'elke ronde een eigen pad');
});

test('de Slotsuite: de kwalificatie is een harde laag die --lokaal draait', () => {
  const laag = lagenVanEenProces().find(l => l.id === 'kwalificatie');
  assert.ok(laag, 'de laag bestaat');
  assert.equal(laag.hard, true);
  assert.deepEqual(laag.stappen.map(s => s[1][1]), [['scripts/kwalificatie.js', '--lokaal']]);
});

/* DE GRENS STAAT IN HET REGISTER, NIET ALLEEN IN DEZE TOETS. Dat kwalificatie
   lokaal draait, mag niet lezen als "lokaal gelijkwaardig": de bewijsladder
   zet bij het mechanisme wat lokaal ontbreekt, telt het apart, en geeft het
   nooit de graad `bewezen`. */
test('de lokale grens van de kwalificatie: precies de na-controle en de publicatie, met reden', () => {
  const grens = kwal.lokaalGrens(WORTEL);
  assert.deepEqual(grens.map(g => g.opdracht.split(' ').slice(2, 4).join(' ')), ['--controle --fase=na', '--gepubliceerd --image="$RTG_CANDIDATE_IMAGE"']);
  assert.ok(grens.every(g => g.waarom.length > 30), 'elke uitzondering draagt een reden');
});

test('de bewijsladder: kwalificatie telt als lokaal, staat als DEELS lokaal en haalt nooit `bewezen`', () => {
  const ladder = require('../scripts/bewijsladder');
  const uit = ladder.meet();
  const m = uit.sporten.flatMap(s => s.mechanismen).find(x => x.doel === 'scripts/kwalificatie.js');
  assert.equal(m.lokaal, true);
  assert.equal(m.lokaalNiet.length, 2);
  assert.equal(uit.telling.deelsLokaal, 1, 'zichtbaar geteld naast alleenKeten');
  const t = uit.sporten.flatMap(s => s.mechanismen).find(x => x.doel === 'scripts/toetsroutes.js');
  assert.equal(t.lokaal, true);
  assert.equal(t.lokaalNiet, undefined, 'de routekaart doet lokaal wat de keten doet');
  const vol = { lokaal: true, keten: ['x.yml'], register: 'X.json', stempel: true };
  assert.equal(ladder.graadVan(vol), 'bewezen');
  assert.equal(ladder.graadVan({ ...vol, lokaalNiet: [{ opdracht: 'x', waarom: 'y' }] }), 'gemeten');
  assert.equal(ladder.standVan([{ ...vol, lokaalNiet: [{}] }]).stand, 'stap', 'deels lokaal draagt geen `staat`');
});
