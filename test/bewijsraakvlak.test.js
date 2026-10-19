/* HET RAAKVLAK -- een bewijs vervalt alleen door een bestand dat het kan raken.

   scripts/lib/bewijsraakvlak.js vervangt voor APPWERKT de grove regel "er veranderde
   iets in server/ of public/, dus alles is oud" door een raakvlak per bewijs
   per app. Dat mag alleen als het nooit iets vers noemt wat een relevante
   wijziging heeft geraakt. Hier staat dat per tak vast, in een eigen tijdelijke
   repository met twee apps (A en B), een gedeelde poort, een handler met een
   berekende require (C) en een voltooiproef met twee scenario's. Tegen de echte
   boom wordt alleen gelezen.

   Los: node --test test/bewijsraakvlak.test.js */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const R = require('../scripts/lib/bewijsraakvlak');
const { beoordeel } = require('../scripts/appwerkt-vers');

const BESTANDEN = {
  'server/server.js': "require('./middleware/auth');\nrequire('./opzet/routes')(require('./kern/db'));\n",
  'server/middleware/auth.js': "module.exports = function auth(req, res, next) { next(); };\n",
  'server/kern/db.js': "module.exports = { db: {} };\n",
  'server/opzet/routes.js': "module.exports = function (kern) {\n  const grens = () => kern;\n" +
    "  require('../routes/a')(grens('a'));\n  require('../routes/b')(grens('b'));\n  require('../routes/c')(grens('c'));\n};\n",
  'server/routes/a.js': "const hulp = require('./a-hulp');\nmodule.exports = ({ app }) => app.get('/api/a/lijst', (q, s) => s.json(hulp()));\n",
  'server/routes/a-hulp.js': "module.exports = () => [1, 2, 3];\n",
  'server/routes/b.js': "module.exports = ({ app }) => app.get('/api/b', (q, s) => s.json({}));\n",
  'server/routes/c.js': "const naam = process.env.X;\nconst m = require(naam);\nmodule.exports = ({ app }) => app.get('/api/c', m);\n",
  'public/shared/schil.js': "window.schil = 1;\n",
  'public/apps/a.html': '<!doctype html><script src="/shared/schil.js"></script><script src="/apps/a.js"></script>' +
    '<a href="/apps/b.html">B</a><img src="/apps/a.png">\n',
  'public/apps/a.png': 'png',
  'public/apps/a.js': "fetch('/api/a/lijst');\n",
  'public/apps/b.html': "<!doctype html><script src=\"/shared/schil.js\"></script><script>fetch('/api/b');</script>\n",
  'public/apps/c.html': "<!doctype html><script>fetch('/api/c');</script>\n",
  'scripts/instr.js': "require('./lib/hulp');\n",
  'scripts/lib/hulp.js': "module.exports = 1;\n",
  'scripts/ander.js': "module.exports = 2;\n",
  'scripts/voltooiproef.js': "require('./lib/voltooi/a');\nrequire('./lib/voltooi/b');\n",
  'scripts/lib/voltooi/a.js': "module.exports = { pad: '/api/a/lijst' };\n",
  'scripts/lib/voltooi/b.js': "module.exports = { pad: '/api/b' };\n",
  'README.md': '# proef\n'
};
const ROUTES = [
  { methode: 'GET', pad: '/api/a/lijst', bestand: 'server/routes/a.js' },
  { methode: 'GET', pad: '/api/b', bestand: 'server/routes/b.js' },
  { methode: 'GET', pad: '/api/c', bestand: 'server/routes/c.js' }
];

function git(map, args) {
  return execFileSync('git', args, { cwd: map, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
}
function schrijf(map, rel, inhoud) {
  fs.mkdirSync(path.dirname(path.join(map, rel)), { recursive: true });
  fs.writeFileSync(path.join(map, rel), inhoud);
}
function commit(map, bericht) {
  git(map, ['add', '-A']);
  git(map, ['-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-q', '-m', bericht]);
  return git(map, ['rev-parse', '--short', 'HEAD']);
}
const wereld = (map) => R.maakWereld({ wortel: map, routes: ROUTES, bundels: {} });
/* De grove regel als spion: hij zegt altijd "oud" en onthoudt dat hij gevraagd is. */
function grofSpion() {
  const s = (st) => { s.gevraagd++; return { vers: false, reden: 'grof: oud' }; };
  s.gevraagd = 0;
  return s;
}

/* Een meting: per app het raakvlak op HEAD, en de hashes zoals een register
   die zou bewaren. */
function metRepo(doe) {
  const map = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-bewijsraakvlak-'));
  try {
    git(map, ['init', '-q']);
    for (const [rel, inhoud] of Object.entries(BESTANDEN)) schrijf(map, rel, inhoud);
    const sha = commit(map, 'begin');
    const w = wereld(map);
    const st = { op: 'nu', commit: sha, instrument: 'scripts/instr.js', boomVuil: false };
    const recs = {};
    for (const app of ['a', 'b', 'c']) {
      const v = R.versheidVoor(w, { ingang: '/apps/' + app + '.html', soort: 'browser' }, grofSpion())(st);
      recs[app] = v.raakvlak;
    }
    const H = R.hashes(w);
    const nu = (app, opties = {}) => R.controleer(wereld(map), recs[app], opties.H || H, '/apps/' + app + '.html', opties.grof || grofSpion());
    return doe({ map, sha, recs, H, nu, st });
  } finally { fs.rmSync(map, { recursive: true, force: true }); }
}

test('vers op de eigen commit, met het raakvlak erbij', () => metRepo(({ recs, nu }) => {
  assert.ok(recs.a && !recs.a.onbepaald && /^[0-9a-f]{64}$/.test(recs.a.samen));
  assert.equal(nu('a').stand, 'VERS');
  assert.equal(nu('b').stand, 'VERS');
}));

test('een wijziging in de handler van A maakt alleen A oud, met de naam van het bestand', () => metRepo(({ map, nu }) => {
  schrijf(map, 'server/routes/a.js', BESTANDEN['server/routes/a.js'] + '// anders\n');
  const a = nu('a');
  assert.equal(a.stand, 'VERVALLEN');
  assert.deepEqual(a.oorzaak, ['server/routes/a.js']);
  assert.equal(nu('b').stand, 'VERS');
}));

test('ook een bestand dat de handler van A inleest, maakt alleen A oud', () => metRepo(({ map, nu }) => {
  schrijf(map, 'server/routes/a-hulp.js', 'module.exports = () => [];\n');
  assert.equal(nu('a').stand, 'VERVALLEN');
  assert.equal(nu('b').stand, 'VERS');
}));

test('committen maakt een wijziging niet vers: de meetcommit telt, niet HEAD', () => metRepo(({ map, nu }) => {
  schrijf(map, 'server/routes/a.js', BESTANDEN['server/routes/a.js'] + '// anders\n');
  commit(map, 'wijziging');
  assert.equal(nu('a').stand, 'VERVALLEN');
  assert.equal(nu('b').stand, 'VERS');
}));

test('een wijziging in de gedeelde poort (auth-middleware) maakt overal alles oud', () => metRepo(({ map, nu }) => {
  schrijf(map, 'server/middleware/auth.js', "module.exports = function auth(req, res, next) { res.status(401).end(); };\n");
  for (const app of ['a', 'b']) {
    const u = nu(app);
    assert.equal(u.stand, 'VERVALLEN', app);
    assert.ok(u.oorzaak.includes('server/middleware/auth.js'), app);
  }
}));

test('de opzet die de routes ophangt en de kern die zij krijgen, zijn ook gedeeld', () => metRepo(({ map, nu }) => {
  schrijf(map, 'server/kern/db.js', "module.exports = { db: { anders: true } };\n");
  assert.equal(nu('a').stand, 'VERVALLEN');
  assert.equal(nu('b').stand, 'VERVALLEN');
}));

test('een wijziging in een document maakt niets oud', () => metRepo(({ map, nu }) => {
  schrijf(map, 'README.md', '# anders\n');
  schrijf(map, 'BETROUWBAARHEID.md', 'nieuw\n');
  assert.equal(nu('a').stand, 'VERS');
  assert.equal(nu('b').stand, 'VERS');
}));

test('een wijziging in een scherm maakt alleen dat scherm oud; in de schil die het laadt ook', () => metRepo(({ map, nu }) => {
  schrijf(map, 'public/apps/b.html', BESTANDEN['public/apps/b.html'] + '<p>anders</p>\n');
  assert.equal(nu('a').stand, 'VERS');
  assert.equal(nu('b').stand, 'VERVALLEN');
  schrijf(map, 'public/shared/schil.js', 'window.schil = 2;\n');
  assert.equal(nu('a').stand, 'VERVALLEN');
}));

test('een link naar een ander scherm maakt dat scherm geen deel van het raakvlak; een afbeelding wel', () => metRepo(({ map, nu }) => {
  schrijf(map, 'public/apps/b.html', BESTANDEN['public/apps/b.html'] + '<p>anders</p>\n');
  assert.equal(nu('a').stand, 'VERS', 'A linkt naar B, maar B draait niet in A');
  schrijf(map, 'public/apps/a.png', 'andere png');
  assert.equal(nu('a').stand, 'VERVALLEN');
}));

test('een script buiten de sluiting van het instrument maakt niets oud; erbinnen wel', () => metRepo(({ map, nu }) => {
  schrijf(map, 'scripts/ander.js', 'module.exports = 3;\n');
  assert.equal(nu('a').stand, 'VERS');
  schrijf(map, 'scripts/lib/hulp.js', 'module.exports = 4;\n');
  assert.equal(nu('a').stand, 'VERVALLEN');
}));

test('een nieuw serverbestand dat niemand statisch laadt, maakt alles oud: het kan dynamisch geladen worden', () => metRepo(({ map, nu }) => {
  schrijf(map, 'server/kern/los.js', 'module.exports = 1;\n');
  assert.equal(nu('a').stand, 'VERVALLEN');
  assert.ok(nu('a').oorzaak.some((o) => o.startsWith('server/kern/los.js')));
}));

test('een onbepaald raakvlak valt terug op de grove regel, nooit op vers', () => metRepo(({ recs, nu }) => {
  assert.ok(recs.c && recs.c.onbepaald, 'de berekende require in c.js maakt het raakvlak van C onbepaald');
  const spion = grofSpion();
  const u = nu('c', { grof: spion });
  assert.equal(u.stand, 'GROF');
  assert.equal(u.vers, false);
  assert.equal(spion.gevraagd, 1, 'de grove regel heeft beslist');
}));

test('knoeien met een bewaarde hash maakt het bewijs ongeldig, niet geldig', () => metRepo(({ map, H, nu }) => {
  /* 1. Een hash veranderd terwijl de code gelijk bleef. */
  const vals = nu('a', { H: Object.assign({}, H, { 'server/routes/a.js': '0'.repeat(64) }) });
  assert.equal(vals.stand, 'ONGELDIG');
  assert.deepEqual(vals.oorzaak, ['server/routes/a.js'], 'de melding noemt het bestand waarvan de hash niet klopt');
  /* 2. Een hash weggelaten. */
  const zonder = Object.assign({}, H); delete zonder['server/routes/a.js'];
  assert.equal(nu('a', { H: zonder }).stand, 'ONGELDIG');
  /* 3. De code veranderd EN de hash "bijgewerkt" naar de nieuwe inhoud: op de
        meetcommit stond iets anders, dus vervallen. */
  schrijf(map, 'server/routes/a.js', 'module.exports = () => {};\n');
  const w = wereld(map);
  const bijgewerkt = Object.assign({}, H, { 'server/routes/a.js': w.sha('server/routes/a.js') });
  const u = nu('a', { H: bijgewerkt });
  assert.notEqual(u.stand, 'VERS');
  assert.equal(u.vers, false);
}));

test('knoeien met de samengestelde hash maakt het bewijs ongeldig', () => metRepo(({ recs, H, map }) => {
  const rec = Object.assign({}, recs.a, { samen: 'f'.repeat(64) });
  const u = R.controleer(wereld(map), rec, H, '/apps/a.html', grofSpion());
  assert.equal(u.stand, 'ONGELDIG');
}));

test('een meetcommit die er niet meer is, is nooit vers', () => metRepo(({ recs, H, map }) => {
  const rec = Object.assign({}, recs.a, { commit: 'deadbeef' });
  assert.equal(R.controleer(wereld(map), rec, H, '/apps/a.html', grofSpion()).vers, false);
}));

test('de voltooiproef telt alleen het eigen scenario, en wel de routes die het aanroept', () => metRepo(({ map, sha }) => {
  const st = { op: 'nu', commit: sha, instrument: 'scripts/voltooiproef.js', boomVuil: false };
  const invoer = { ingang: '/apps/a.html', soort: 'api', scenario: 'scripts/lib/voltooi/a.js', routeInstrument: 'scripts/lib/voltooi/a.js' };
  const rec = R.versheidVoor(wereld(map), invoer, grofSpion())(st).raakvlak;
  const w0 = wereld(map);
  const H = R.hashes((R.raakvlak(w0, Object.assign({ instrument: st.instrument }, invoer)), w0));
  const nu = () => R.controleer(wereld(map), rec, H, '/apps/a.html', grofSpion());
  assert.equal(nu().stand, 'VERS');
  schrijf(map, 'scripts/lib/voltooi/b.js', "module.exports = { pad: '/api/b', anders: 1 };\n");
  assert.equal(nu().stand, 'VERS', 'het scenario van een andere app raakt deze uitslag niet');
  schrijf(map, 'scripts/lib/voltooi/a.js', "module.exports = { pad: '/api/a/lijst', anders: 1 };\n");
  assert.equal(nu().stand, 'VERVALLEN');
}));

test('versheidVoor zegt niet vers zodra een raakvlakbestand anders is dan op de meetcommit', () => metRepo(({ map, st }) => {
  schrijf(map, 'server/routes/b.js', "module.exports = ({ app }) => app.get('/api/b', (q, s) => s.json({ x: 1 }));\n");
  const vA = R.versheidVoor(wereld(map), { ingang: '/apps/a.html' }, grofSpion())(st);
  const vB = R.versheidVoor(wereld(map), { ingang: '/apps/b.html' }, grofSpion())(st);
  assert.equal(vA.vers, true);
  assert.equal(vB.vers, false);
  assert.match(vB.reden, /server\/routes\/b\.js/);
  /* De voorwaarden van het stempel zelf blijven gelden. */
  assert.equal(R.versheidVoor(wereld(map), { ingang: '/apps/a.html' }, grofSpion())(Object.assign({}, st, { boomVuil: true })).vers, false);
}));

test('de poort: een 8/8 met een vervallen bewijs laat appwerkt:vers zakken', () => metRepo(({ map, recs, H, st }) => {
  const rij = (app, status) => ({ app, functie: 'link:' + app, ingang: '/apps/' + app + '.html', status,
    bewijzen: { bereikbaar: { status: 'BEWEZEN', reden: 'x', bewijs: '/apps/' + app + '.html', raakvlak: [recs[app]] } } });
  const register = { stempel: st, raakvlak: { hashes: H }, regels: [rij('a', 'BEWEZEN'), rij('b', 'NIET_GETEST')] };
  assert.equal(beoordeel(register, { wereld: wereld(map), grof: grofSpion() }).gezakt.length, 0);
  schrijf(map, 'server/routes/b.js', '// b anders\n');
  assert.equal(beoordeel(register, { wereld: wereld(map), grof: grofSpion() }).gezakt.length, 0, 'B is geen 8/8; dat B oud is, zakt de poort niet');
  schrijf(map, 'server/routes/a.js', '// a anders\n');
  const u = beoordeel(register, { wereld: wereld(map), grof: grofSpion() });
  assert.deepEqual(u.gezakt.map((r) => r.app), ['a']);
}));

test('apiPaden: een samenstelling wordt een patroon, een vergelijking telt niet', () => {
  assert.deepEqual([...R.apiPaden("fetch('/api/' + w + '/doe/bevestig')")], ['/api/*/doe/bevestig']);
  assert.deepEqual([...R.apiPaden("fetch('/api/office/' + id)")], ['/api/office/*']);
  assert.deepEqual([...R.apiPaden('fetch(`/api/x/${id}/y`)')], ['/api/x/*/y']);
  assert.deepEqual([...R.apiPaden("fetch('/api/b?x=1')")], ['/api/b']);
  assert.deepEqual([...R.apiPaden("if (url.indexOf('/api/') !== 0) return;")], []);
  assert.deepEqual([...R.apiPaden("const BASIS = '/api/office/';")], ['/api/office/*'], 'een kale basis die later wordt aangevuld, telt als voorvoegsel');
});

test('de echte boom: de kern is vast te stellen, en elke regel in DYNAMISCH is nog nodig', () => {
  const w = R.maakWereld();
  const g = R.gedeeld(w);
  assert.equal(g.bepaald, true, g.reden);
  for (const bestand of Object.keys(R.DYNAMISCH)) {
    const bron = fs.readFileSync(path.join(__dirname, '..', bestand), 'utf8');
    assert.match(bron, /require\(\s*path\.join\(/, bestand + ' laadt niet meer berekend; haal de regel uit DYNAMISCH');
  }
  /* De auth-middleware en de opzet die routes ophangt horen bij het gedeelde deel. */
  for (const p of ['server/server.js', 'server/opzet/routes.js']) assert.ok(g.bestanden.has(p), p);
  assert.ok([...g.bestanden].some((p) => p.startsWith('server/middleware/')));
});

test('het register van de hashes hoort aantoonbaar bij APPWERKT.json, anders tellen ze niet', () => {
  const st = { op: '2026-10-19T00:00:00Z', commit: 'abc1234' };
  const hashes = { 'server/a.js': 'a'.repeat(64), 'public/b.js': 'b'.repeat(64) };
  const appwerkt = { stempel: st, raakvlak: R.verwijzing(st, hashes) };
  assert.equal(appwerkt.raakvlak.hashes, undefined, 'de hashes staan niet in APPWERKT.json zelf');
  assert.deepEqual(R.hashesVoor(appwerkt, R.register(st, hashes)).hashes, hashes);
  /* Een register van een andere meting, of met een hash erbij of eraf. */
  assert.equal(R.hashesVoor(appwerkt, R.register(Object.assign({}, st, { commit: 'fff0000' }), hashes)).hashes, null);
  const geknoeid = R.register(st, hashes);
  geknoeid.hashes['server/a.js'] = 'c'.repeat(64);
  assert.equal(R.hashesVoor(appwerkt, geknoeid).hashes, null);
  assert.equal(R.hashesVoor(appwerkt, null).hashes, null);
});
