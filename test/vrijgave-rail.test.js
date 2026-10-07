/* DE VRIJGAVEPOORT AAN DE RAIL EN BIJ HET STARTEN.

   1. Een uitbetaling die de opdrachtenrij aan de rail aanbiedt
      (server/server.js `railInzenden`), draagt de capability van haar SOORT
      (server/kern/betaalopdracht/vrijgave.js) -- en de rail
      (server/betaal/uitbetaling.js) vraagt de poort precies DIE capability.
      Een soort zonder capability is dicht op een echte rail.
   2. De opstartkeuring van de vrijgavepoort staat in server/opzet/startcontrole.js
      en draait in ELKE stand: op een openbaar adres weigert een kapot
      standbestand de start, elders klinkt hij.
   3. De proefwereld (scripts/lib/proefvrijgave.js) is geen servercode: niets
      onder server/ laadt hem, en in productie bestaat hij niet. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.join(__dirname, '..');

test('1 de soort van een opdracht bepaalt de capability, en de rail vraagt precies die', async () => {
  const { capabilityVan, CAPABILITY } = require('../server/kern/betaalopdracht/vrijgave');
  assert.equal(capabilityVan('pay-terug'), 'geld.lid_iban_uitbetaling');
  assert.equal(capabilityVan('pay-uit'), 'geld.partnerafrekening');
  for (const s of ['sepa-uit', 'economic-settlement', 'toString', '__proto__', 'constructor', undefined])
    assert.equal(capabilityVan(s), undefined, s);
  const reg = require('../server/kern/vrijgave/register');
  for (const cap of Object.values(CAPABILITY)) assert.ok(reg.vind(cap), cap + ' staat niet in het register');
  /* De rail, met een nagemaakte Stripe en een poort die vastlegt wat er werd gevraagd. */
  const gevraagd = [];
  const poort = { eis(id, ctx) { gevraagd.push([id, ctx.rail]); const e = new Error('dicht'); e.code = 'VRIJGAVE_DICHT'; throw e; } };
  const rail = require('../server/betaal/uitbetaling')({ betalenUit: false, haalOp: () => null, bewaar: () => {},
    regie: { sepaGeconfigureerd: false, sepaAan: false }, sandbox: {}, stripe: {}, demoBetalen: false,
    aanbieder: () => 'stripe', eisBetaalrail: () => {}, crypto: require('node:crypto'), uitgaandBewustDicht: false, vrijgave: poort });
  for (const soort of ['pay-uit', 'pay-terug', 'sepa-uit']) {
    await assert.rejects(rail({ bedrag: 500, iban: 'NL91ABNA0417164300', referentie: 'r-' + soort,
      idempotentieSleutel: 'i-' + soort, vrijgave: capabilityVan(soort) }), e => e.nietVerstuurd === true);
  }
  assert.deepEqual(gevraagd, [['geld.partnerafrekening', 'stripe'], ['geld.lid_iban_uitbetaling', 'stripe'],
    ['geld.uitbetaling_zonder_capability', 'stripe']]);
  /* En server.js geeft de capability werkelijk mee aan de rail. */
  const server = fs.readFileSync(path.join(ROOT, 'server/server.js'), 'utf8');
  const blok = server.slice(server.indexOf('railInzenden: async (o) =>'), server.indexOf('railInzenden: async (o) =>') + 1600);
  assert.match(blok, /vrijgave: require\('\.\/kern\/betaalopdracht\/vrijgave'\)\.capabilityVan\(o\.soort\)/,
    'railInzenden geeft de capability niet mee');
});

test('2 de opstartkeuring draait in elke stand: openbaar weigert hij te starten, elders waarschuwt hij', () => {
  const map = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-vrijgave-start-'));
  try {
    fs.writeFileSync(path.join(map, 'vrijgave-stand.json'), JSON.stringify({ formaat: 'rtg-vrijgave-stand-v1', versie: 1,
      standen: { 'geld.inkomend': { stand: 'aan' } }, besluiten: {}, geschiedenis: [] }));
    const code = "require('./server/opzet/startcontrole')({ PRODUCTION: false, DEMO: false, accounts: {}, eigenaar: {} });" +
      "process.stdout.write('gestart');";
    const draai = (env) => spawnSync(process.execPath, ['-e', code], { cwd: ROOT, encoding: 'utf8',
      env: Object.assign({}, process.env, { RTG_DATA_DIR: map, NODE_ENV: 'development' }, env) });
    const openbaar = draai({ APP_URL: 'https://rtg.nl' });
    assert.notEqual(openbaar.status, 0, 'een openbare installatie startte met een kapot standbestand');
    assert.match(openbaar.stderr, /VRIJGAVE_CONFIGURATIEFOUT|configuratiefout/);
    const lokaal = draai({ APP_URL: '' });
    assert.equal(lokaal.status, 0, lokaal.stderr);
    assert.match(lokaal.stdout, /gestart/);
    assert.match(lokaal.stderr + lokaal.stdout, /Vrijgavepoort: configuratiefout/, 'de waarschuwing klonk niet');
  } finally { fs.rmSync(map, { recursive: true, force: true }); }
  /* En hij staat niet meer bij de montage van het kantoor. */
  assert.doesNotMatch(fs.readFileSync(path.join(ROOT, 'server/routes/kantoren/vrijgave.js'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, ''),
    /keurBijStart\(/);
});

test('3 de proefwereld is geen servercode, en bestaat niet in productie', () => {
  const geraakt = [];
  const loop = (map) => {
    for (const naam of fs.readdirSync(map)) {
      const p = path.join(map, naam);
      if (fs.statSync(p).isDirectory()) { if (naam !== 'data') loop(p); continue; }
      if (naam.endsWith('.js') && /proefvrijgave/.test(fs.readFileSync(p, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')))
        geraakt.push(path.relative(ROOT, p));
    }
  };
  loop(path.join(ROOT, 'server'));
  assert.deepEqual(geraakt, [], 'servercode laadt de proefwereld');
  const r = spawnSync(process.execPath, ['-e', "require('./scripts/lib/proefvrijgave').proefVrijgave()"],
    { cwd: ROOT, encoding: 'utf8', env: Object.assign({}, process.env, { NODE_ENV: 'production' }) });
  assert.notEqual(r.status, 0); assert.match(r.stderr, /bestaat niet in productie/);
});
