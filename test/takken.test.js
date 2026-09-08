/* DE TAKKENOPRUIMER -- wanneer zegt hij "deze mag weg", en vooral: wanneer niet.

   Dit is het enige gereedschap in dit huis dat iets WEGGOOIT op eigen houtje
   (scripts/takken.js, gestart door .github/workflows/takken.yml). Bij zo'n
   gereedschap is de interessante toets niet of hij opruimt maar of hij zijn
   handen thuis houdt. Daarom staan hier vier werelden naast elkaar, met per
   wereld het antwoord dat eruit moet komen:

     1. een tak die al helemaal in de hoofdtak zit          -> leeg    (weg mag)
     2. een tak met eigen werk                              -> inhoud  (blijft)
     3. een tak die alleen op een GEGENEREERD register botst -> leeg   (weg mag)
     4. een tak die op echte code botst                     -> inhoud  (blijft)

   Nummer 3 is de reden dat dit script bestaat: honderdtwintig oude takken
   botsen uitsluitend op ARCHITECTUUR.md en BEWIJS.md, en die worden toch uit
   de bron herschreven. Nummer 4 is de reden dat het veilig is: zodra er iets
   buiten die lijst botst, houdt hij op met redeneren en laat hij de tak staan.

   Draai los: node --test test/takken.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const takken = require('../scripts/takken.js');

const git = (map, ...args) => execFileSync('git', ['-C', map, ...args], { encoding: 'utf8' }).trim();
function schrijf(map, naam, inhoud) {
  fs.mkdirSync(path.dirname(path.join(map, naam)), { recursive: true });
  fs.writeFileSync(path.join(map, naam), inhoud);
}
function commit(map, boodschap) {
  git(map, 'add', '-A');
  git(map, '-c', 'user.name=proef', '-c', 'user.email=proef@rtg.local', 'commit', '-q', '-m', boodschap);
  return git(map, 'rev-parse', 'HEAD');
}

/* Een echte repo met een echte hoofdtak en vier takken. Geen nepobject: dit
   gereedschap redeneert over merges, en een merge kun je niet nadoen. */
function bouwWereld() {
  const map = fs.mkdtempSync(path.join(os.tmpdir(), 'takkenproef-'));
  git(map, 'init', '-q', '-b', 'main');
  schrijf(map, 'BEWIJS.md', 'basis\n');
  schrijf(map, 'server/x.js', 'basis\n');
  const basis = commit(map, 'basis');

  const tak = (naam, doe) => {
    git(map, 'checkout', '-q', '-B', naam, basis);
    doe();
    const sha = commit(map, naam);
    git(map, 'update-ref', 'refs/remotes/origin/' + naam, sha);
    git(map, 'checkout', '-q', 'main');
  };

  tak('eigen-werk', () => schrijf(map, 'server/nieuw.js', 'iets nieuws\n'));
  tak('alleen-register', () => schrijf(map, 'BEWIJS.md', 'de tak schreef dit register\n'));
  tak('botst-op-code', () => schrijf(map, 'server/x.js', 'de tak veranderde de code\n'));

  // De hoofdtak loopt door en raakt dezelfde twee bestanden, zodat 3 en 4 echt botsen.
  git(map, 'checkout', '-q', 'main');
  schrijf(map, 'BEWIJS.md', 'de hoofdtak schreef dit register\n');
  schrijf(map, 'server/x.js', 'de hoofdtak veranderde de code\n');
  const hoofdSha = commit(map, 'de hoofdtak loopt door');
  git(map, 'update-ref', 'refs/remotes/origin/main', hoofdSha);

  // Een tak die exact op de hoofdtak staat: nul commits vooruit.
  git(map, 'update-ref', 'refs/remotes/origin/heel-in-main', hoofdSha);

  /* EEN TAK MET EEN EIGEN WORTEL. Die hebben geen gemeenschappelijke voorouder
     met de hoofdtak, en er staan er hier tientallen van. */
  git(map, 'checkout', '-q', '--orphan', 'losse-wortel');
  git(map, 'rm', '-rqf', '--cached', '.');
  fs.rmSync(path.join(map, 'server'), { recursive: true, force: true });
  fs.rmSync(path.join(map, 'BEWIJS.md'), { force: true });
  schrijf(map, 'server/eigen.js', 'werk uit een eigen geschiedenis\n');
  const wortelSha = commit(map, 'losse wortel');
  git(map, 'update-ref', 'refs/remotes/origin/losse-wortel', wortelSha);
  git(map, 'checkout', '-q', '-f', 'main');

  const werkmap = fs.mkdtempSync(path.join(os.tmpdir(), 'takkenwerk-'));
  git(map, 'worktree', 'add', '--quiet', '--detach', werkmap, 'refs/remotes/origin/main');
  return { map, werkmap };
}

test('het oordeel per tak: weg mag alleen wat aantoonbaar niets toevoegt', () => {
  const { map, werkmap } = bouwWereld();
  const oud = process.cwd();
  try {
    process.chdir(map);

    assert.equal(takken.oordeel(werkmap, 'main', 'heel-in-main').stand, 'leeg',
      'een tak die nul commits voorloopt zit er al in');

    const eigen = takken.oordeel(werkmap, 'main', 'eigen-werk');
    assert.equal(eigen.stand, 'inhoud', 'een tak met een nieuw bestand voegt iets toe en blijft staan');

    assert.equal(takken.oordeel(werkmap, 'main', 'alleen-register').stand, 'leeg',
      'alleen een botsing op een gegenereerd register telt niet als inhoud');

    const code = takken.oordeel(werkmap, 'main', 'botst-op-code');
    assert.equal(code.stand, 'inhoud', 'een botsing op echte code laat de tak staan');
    assert.match(code.waarom, /server\/x\.js/, 'en hij zegt waarop hij botste');
  } finally { process.chdir(oud); fs.rmSync(map, { recursive: true, force: true }); fs.rmSync(werkmap, { recursive: true, force: true }); }
});

/* EEN PROEF DIE NIET KON DRAAIEN, IS NOOIT EEN VRIJBRIEF.

   Dit is de duurste regel van het hele gereedschap, en hij is gevonden doordat
   CI hem overtrad. `git merge` eist een committer -- ook met --no-commit -- en
   in een verse CI-job staat die naam nergens. De merge liep dus niet, de index
   bleef staan op de boom van de hoofdtak, en dat las als "voegt niets toe":
   weg ermee. Een gereedschap dat verwijdert, faalde naar de gevaarlijke kant.

   Dezelfde vorm zat er nog een keer in: takken met een EIGEN wortel hebben geen
   gemeenschappelijke voorouder, git weigerde die te mergen, en ook daar bleef de
   index op de hoofdtak staan. Dat trof 66 van de 181 takken in deze repo.

   Beide worden hier vastgehouden, want dit is niet het soort fout dat je een
   tweede keer wilt maken. */
test('een tak met een eigen wortel telt als inhoud en niet als leeg', () => {
  const { map, werkmap } = bouwWereld();
  const oud = process.cwd();
  try {
    process.chdir(map);
    const o = takken.oordeel(werkmap, 'main', 'losse-wortel');
    assert.notEqual(o.stand, 'leeg',
      'zonder gemeenschappelijke voorouder mag de uitkomst nooit "weg mag" zijn');
    assert.equal(o.stand, 'inhoud', 'en hij draagt eigen werk, dus hij blijft staan');
  } finally { process.chdir(oud); fs.rmSync(map, { recursive: true, force: true }); fs.rmSync(werkmap, { recursive: true, force: true }); }
});

test('zonder een naam in de git-instellingen oordeelt hij nog steeds goed', () => {
  const { map, werkmap } = bouwWereld();
  const oud = process.cwd();
  /* Precies de omgeving van een verse CI-job: geen globale en geen
     systeeminstellingen, en niets in de omgevingsvariabelen. */
  const bewaard = {};
  const leegmaken = ['GIT_CONFIG_GLOBAL', 'GIT_CONFIG_SYSTEM', 'GIT_AUTHOR_NAME',
    'GIT_AUTHOR_EMAIL', 'GIT_COMMITTER_NAME', 'GIT_COMMITTER_EMAIL', 'EMAIL', 'HOME'];
  for (const k of leegmaken) bewaard[k] = process.env[k];
  try {
    process.chdir(map);
    process.env.GIT_CONFIG_GLOBAL = '/dev/null';
    process.env.GIT_CONFIG_SYSTEM = '/dev/null';
    process.env.HOME = map;
    for (const k of ['GIT_AUTHOR_NAME', 'GIT_AUTHOR_EMAIL', 'GIT_COMMITTER_NAME',
      'GIT_COMMITTER_EMAIL', 'EMAIL']) delete process.env[k];

    assert.equal(takken.oordeel(werkmap, 'main', 'eigen-werk').stand, 'inhoud',
      'een tak met eigen werk blijft staan, ook zonder git-identiteit');
    assert.equal(takken.oordeel(werkmap, 'main', 'alleen-register').stand, 'leeg',
      'en het oordeel is niet ineens strenger geworden');
  } finally {
    process.chdir(oud);
    for (const k of leegmaken) {
      if (bewaard[k] === undefined) delete process.env[k]; else process.env[k] = bewaard[k];
    }
    fs.rmSync(map, { recursive: true, force: true });
    fs.rmSync(werkmap, { recursive: true, force: true });
  }
});

/* DE GEVAARLIJKE KANT VAN DE REGISTERLIJST. Elke naam die erbij komt, maakt het
   gereedschap losser: een conflict daarin telt voortaan niet meer als inhoud.
   Daarom staat hier wat er in mag -- een bestand dat dit huis uit de bron
   HERSCHRIJFT -- en niet hoeveel het er zijn. */
test('de registerlijst bevat alleen bestanden die uit de bron worden herschreven', () => {
  const bron = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'takken.js'), 'utf8');
  for (const naam of takken.REGISTERS) {
    assert.match(bron, new RegExp("'" + naam.replace('.', '\\.') + "',?\\s*//"),
      naam + ' hoort in scripts/takken.js zijn generator als commentaar te dragen');
  }
  for (const naam of takken.REGISTERS) {
    assert.ok(!naam.includes('/'), naam + ': alleen worteldocumenten worden hier automatisch opgelost');
  }
  assert.ok(!takken.REGISTERS.has('CLAUDE.md'), 'CLAUDE.md wordt met de hand geschreven en hoort hier nooit in');
  assert.ok(!takken.REGISTERS.has('package.json'), 'package.json is geen register');
});

/* ZONDER DE LIJST OPEN PULL REQUESTS GEBEURT ER NIETS. Een lege verzameling zou
   lezen als "er staat geen enkele PR open" en dus alles vrijgeven; daarom is de
   uitkomst bij twijfel `null` en stopt de aanroeper erop. */
test('kan de opruimer niet zien welke PRs openstaan, dan verwijdert hij niets', () => {
  const bron = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'takken.js'), 'utf8');
  assert.match(bron, /if \(!token \|\| !repo\) return null;/, 'geen token betekent geen oordeel');
  assert.match(bron, /if \(verwijderen && openPr === null\) \{[\s\S]{0,400}?process\.exit\(1\);/,
    'en zonder dat oordeel stopt hij, in plaats van door te zetten');
});

/* De workflow is de enige plek waar dit gereedschap schrijfrecht krijgt. Wat
   hij mag staat in zijn eigen `permissions:`, en hij start nooit uit zichzelf. */
test('de workflow start alleen met de hand en vraagt een getypt woord', () => {
  const wf = fs.readFileSync(path.join(__dirname, '..', '.github', 'workflows', 'takken.yml'), 'utf8');
  assert.match(wf, /^on:\n  workflow_dispatch:/m, 'alleen met de hand te starten');
  assert.doesNotMatch(wf, /^\s+schedule:/m, 'een opruimer hoort nooit uit zichzelf te lopen');
  assert.match(wf, /inputs\.doen \}\}" = "verwijder"/, 'verwijderen vraagt een letterlijk getypt woord');
  assert.match(wf, /permissions:\n  contents: write\n  pull-requests: read\n/,
    'precies twee rechten, en pull-requests alleen-lezen');
});

/* HET TOKEN BLIJFT NIET IN DE WERKMAP LIGGEN, en dat is hier geen formaliteit:
   dit is de enige job in dit huis die werkelijk iets weghaalt. De checkout laat
   dus niets achter (scripts/ci-keten.js regel 1), en daarmee ligt vast dat het
   verwijderen NIET langs `git push` kan gaan -- die zou zonder credential stil
   op een 403 stuklopen. Deze twee horen bij elkaar; wie de een terugdraait moet
   de ander meenemen, en daarom zakt deze toets op allebei. */
test('de opruimer verwijdert langs de API, en de checkout laat geen token achter', () => {
  const wf = fs.readFileSync(path.join(__dirname, '..', '.github', 'workflows', 'takken.yml'), 'utf8');
  assert.match(wf, /persist-credentials: false/, 'de checkout laat geen credential in .git/config achter');

  const bron = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'takken.js'), 'utf8');
  /* Commentaar is geschiedenis en geen commando -- die uitleg mag `git push`
     gewoon noemen, zoals ook test/ci-keten.test.js dat toestaat. */
  const code = bron.split(/\r?\n/).filter(r => !/^\s*(\/\*|\*|\/\/)/.test(r)).join('\n');
  assert.doesNotMatch(code, /'push'/, 'zonder credential is `git push` geen werkende weg meer');
  assert.match(code, /-X', 'DELETE'/, 'de verwijzing gaat weg met een DELETE op de API');
});

/* EEN VERWIJDERING DIE NIET DOORGING, MAG NIET ALS GELUKT LEZEN. 204 is weg en
   422 is "hij was al weg"; al het andere -- een 403 op een beschermde tak
   voorop -- is een mislukking met zijn code erbij, zodat het logboek zegt wat
   er gebeurde in plaats van te zwijgen. */
test('de uitslag van een verwijdering komt uit de HTTP-status', () => {
  const bron = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'takken.js'), 'utf8');
  assert.match(bron, /code === '204' \|\| code === '422'/, '204 en 422 tellen als weg');
  assert.match(bron, /return \{ ok: false, reden: 'HTTP ' \+ code \}/, 'en de rest draagt zijn code');
  assert.match(bron, /if \(mislukt\) process\.exit\(1\)/, 'een mislukte ronde eindigt met een foutcode');
});
