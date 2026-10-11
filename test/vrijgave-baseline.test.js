/* DE V1-BASELINE (server/kern/vrijgave/baseline.js) EN DE RELEASECONTROLE
   (scripts/lib/vrijgave-baseline.js, scripts/golive.js, scripts/release-gate.js).

   Wat hier vastligt:
     1. de baseline is het besluit van de eigenaar van 6 oktober 2026, letterlijk:
        vijf capabilities IN, vier uitdrukkelijk NIET, twee BESLUIT-OPEN -- en
        iedere capability uit het register heeft er een soort (een vergeten
        besluit is geen "niet");
     2. de baseline is geen schakelaar: hij draagt geen stand en geen uitkomst;
     3. het oordeel ZAKT (geen waarschuwing) als een baselinecapability niet
        beschikbaar is, met de assen die ontbreken, en als een capability buiten
        de baseline open staat -- ook als dat alleen over een andere provider is;
     4. de releasecontrole rekent in de RELEASEconfiguratie, wat de omgeving van
        de aanroeper ook zegt: in DEZE omgeving, zonder Stripe-bewijs, zakt hij,
        en `npm run vrijgave:stand -- --controle` geeft uitgang 1. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const B = require('../server/kern/vrijgave/baseline');
const reg = require('../server/kern/vrijgave/register');
const { maakVrijgave } = require('../server/kern/vrijgave');
const { maakStand } = require('../server/kern/vrijgave/stand');
const L = require('../scripts/lib/vrijgave-baseline');

const ROOT = path.join(__dirname, '..');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-vrijgave-baseline-'));
test.after(() => fs.rmSync(TMP, { recursive: true, force: true }));

test('1 de baseline is het besluit van 6 oktober 2026, en dekt het hele register', () => {
  assert.equal(B.NAAM, 'V1'); assert.equal(B.VASTGESTELD, '2026-10-06');
  const per = s => Object.keys(B.BASELINE).filter(id => B.BASELINE[id].soort === s).sort();
  assert.deepEqual(per('in-baseline'), ['geld.inkomend', 'geld.partnerafrekening', 'geld.provider.stripe',
    'geld.provider.stripe_connect', 'geld.terugbetaling']);
  assert.deepEqual(per('niet'), ['geld.lid_iban_uitbetaling', 'geld.provider.adyen', 'geld.provider.mollie', 'geld.terugstortbaar_saldo']);
  assert.deepEqual(per('besluit-open'), ['geld.intern_saldo', 'geld.opwaarderen']);
  assert.equal(B.BASELINE['geld.inkomend'].via, 'stripe', 'inkomend is beloofd VIA Stripe');
  assert.deepEqual(Object.keys(B.BASELINE).sort(), reg.REGISTER.map(c => c.id).sort(), 'een capability zonder baselinesoort');
});

test('2 de baseline is geen schakelaar: geen stand, geen uitkomst, alleen een soort en een reden', () => {
  for (const [id, b] of Object.entries(B.BASELINE)) {
    assert.ok(B.SOORTEN.includes(b.soort), id);
    for (const k of Object.keys(b)) assert.ok(['soort', 'waarom', 'via'].includes(k), id + ' draagt ' + k);
    assert.ok(String(b.waarom).length > 10, id + ' zonder reden');
  }
  const bron = fs.readFileSync(path.join(ROOT, 'server/kern/vrijgave/baseline.js'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  /* Hij leest geen stand en schrijft er geen: geen require van de stand of de
     schakelaar, geen `zet(`, en het woord `enabled` komt in code niet voor. */
  assert.doesNotMatch(bron, /require\('\.\/(stand|schakelen|oordeel)'\)|\.zet\(|\benabled\b|\bstand\s*:/, 'de baseline zet iets');
  /* En geen lezer van het register of de stand gebruikt hem om iets te OPENEN. */
  for (const f of ['oordeel.js', 'stand.js', 'schakelen.js', 'autorisatie.js', 'bewijs.js'])
    assert.doesNotMatch(fs.readFileSync(path.join(ROOT, 'server/kern/vrijgave', f), 'utf8'), /require\('\.\/baseline'\)/, f);
});

/* Een overzicht in de vorm van ./index.js overzicht(): per capability de assen. */
function overzicht(open, perProviderOpen = {}) {
  const assen = a => ({ geimplementeerd: true, geverifieerd: a, geautoriseerd: a, ingeschakeld: a, afhankelijkhedenGezond: a,
    beschikbaarVoorRechthebbende: a, code: a ? null : 'tijdelijk-uit', intern: a ? 'beschikbaar' : 'stand:disabled' });
  return { capabilities: reg.REGISTER.map(c => Object.assign({ id: c.id }, assen(open.includes(c.id)),
    { perProvider: c.provider === 'per-verzoek' ? Object.fromEntries(['stripe', 'mollie', 'adyen'].map(p =>
      [p, assen((perProviderOpen[c.id] || []).includes(p))])) : null })) };
}
const IN = ['geld.inkomend', 'geld.terugbetaling', 'geld.partnerafrekening', 'geld.provider.stripe', 'geld.provider.stripe_connect'];
const VIA = { 'geld.inkomend': ['stripe'], 'geld.terugbetaling': ['stripe'] };

test('3 het oordeel: precies de baseline open is gehaald; een gat of een extra open capability zakt, met de assen', () => {
  assert.deepEqual(B.beoordeel(overzicht(IN.filter(x => !VIA[x]), VIA)).fouten, []);
  // een baselinecapability dicht: zakt, met de ontbrekende assen en de provider
  const gat = B.beoordeel(overzicht(IN.filter(x => !VIA[x]), { 'geld.terugbetaling': ['stripe'] }));
  assert.equal(gat.ok, false);
  assert.ok(gat.fouten.some(f => /geld\.inkomend: hoort in de V1-baseline beschikbaar te zijn, maar niet: geverifieerd, geautoriseerd, ingeschakeld, afhankelijkhedenGezond \[via stripe\]/.test(f)), gat.fouten.join(' | '));
  // inkomend open via MOLLIE en niet via Stripe: zakt twee keer (niet gehaald, en open buiten de baseline is het niet -- maar wel via de verkeerde provider)
  const verkeerd = B.beoordeel(overzicht(IN.filter(x => !VIA[x]), { 'geld.inkomend': ['mollie'], 'geld.terugbetaling': ['stripe'] }));
  assert.equal(verkeerd.ok, false, 'inkomend via Mollie telde als inkomend via Stripe');
  // een capability buiten de baseline open
  for (const id of ['geld.lid_iban_uitbetaling', 'geld.terugstortbaar_saldo', 'geld.provider.mollie', 'geld.provider.adyen', 'geld.intern_saldo']) {
    const r = B.beoordeel(overzicht(IN.filter(x => !VIA[x]).concat([id]), VIA));
    assert.equal(r.ok, false, id + ' stond open buiten de baseline zonder dat het zakte');
    assert.ok(r.fouten.some(f => f.startsWith(id + ':')), id);
  }
  // opwaarderen open over ALLEEN een provider (per verzoek): ook dat telt als open
  const viaProvider = B.beoordeel(overzicht(IN.filter(x => !VIA[x]), Object.assign({}, VIA, { 'geld.opwaarderen': ['adyen'] })));
  assert.equal(viaProvider.ok, false, 'opwaarderen via Adyen viel buiten het oordeel');
  // een capability die het register niet meer kent, of een overzicht zonder capabilities
  assert.equal(B.beoordeel({ capabilities: [] }).ok, false);
  assert.equal(B.beoordeel(null).ok, false);
  assert.equal(B.beoordeel(Object.assign(overzicht(IN), { configuratiefout: 'kapot' })).ok, false);
});

test('4 in de releaseconfiguratie, met NODE_ENV=test in de omgeving: zonder bewijs zakt de baseline en is de rest dicht', async () => {
  /* De omgeving zegt test (lokaal, dus sandbox) -- de releasecontrole rekent
     toch met productie: geen sandbox, en een stand die niemand zette is dicht. */
  const env = { NODE_ENV: 'test', RTG_DATA_DIR: TMP };
  const u = await L.beoordeelRelease({ env });
  assert.equal(u.ok, false, 'de baseline werd gehaald zonder Stripe-bewijs');
  assert.equal(u.modus, 'baseline');
  for (const id of IN) assert.ok(u.fouten.some(f => f.startsWith(id + ':')), id + ' zakte niet');
  for (const r of u.regels) if (r.baseline !== 'in-baseline') assert.equal(r.beschikbaar, false, r.id + ' stond open');
  for (const r of u.regels) assert.notEqual(r.code, null, r.id + ' zonder veilige code');
  const zonderRail = await L.beoordeelRelease({ env, zonderRail: true });
  assert.equal(zonderRail.modus, 'zonder-rail');
  assert.equal(zonderRail.ok, true, 'in een release zonder kaartrail is hier alles dicht: ' + zonderRail.fouten.join(' | '));
  /* De vrijgave van die releaseconfiguratie is echt een productieoordeel. */
  const v = maakVrijgave({ env: L.releaseEnv(env), stand: maakStand({ bestand: path.join(TMP, 'vrijgave-stand.json') }) });
  assert.equal(v.beoordeel('geld.intern_saldo', { recht: true, rail: 'intern' }).stand, 'disabled');
});

test('5 de opdrachtregel: `vrijgave:stand` toont de baselinekolom, en `--controle` geeft uitgang 1 in deze omgeving', () => {
  const env = Object.assign({}, process.env, { RTG_DATA_DIR: TMP, NODE_ENV: 'test' });
  delete env.RTG_VRIJGAVE_URL;
  const tabel = spawnSync(process.execPath, ['scripts/vrijgave-stand.js'], { cwd: ROOT, env, encoding: 'utf8' });
  assert.equal(tabel.status, 0, tabel.stderr);
  assert.match(tabel.stdout, /BASELINE V1/);
  assert.match(tabel.stdout, /geld\.inkomend\s.*in-baseline via stripe \(NIET GEHAALD\)/);
  assert.match(tabel.stdout, /geld\.lid_iban_uitbetaling\s.*niet \(klopt\)/);
  const controle = spawnSync(process.execPath, ['scripts/vrijgave-stand.js', '--controle'], { cwd: ROOT, env, encoding: 'utf8' });
  assert.equal(controle.status, 1, 'de baseline werd hier gehaald: ' + controle.stdout);
  assert.match(controle.stderr, /BASELINE NIET GEHAALD/);
  assert.match(controle.stderr, /geld\.provider\.stripe: hoort in de V1-baseline beschikbaar te zijn/);
});

test('6 de releasepoort en de go-live-keuring dragen de baseline', () => {
  const gate = fs.readFileSync(path.join(ROOT, 'scripts/release-gate.js'), 'utf8');
  assert.match(gate, /\['Vrijgavebaseline V1', process\.execPath, \['scripts\/vrijgave-stand\.js', '--controle'\]\]/);
  const golive = fs.readFileSync(path.join(ROOT, 'scripts/golive.js'), 'utf8');
  assert.match(golive, /require\('\.\/lib\/vrijgave-baseline'\)\.beoordeelRelease\(/);
  assert.match(golive, /else for \(const f of vrijgaveRelease\.fouten\) blokkeer\(/, 'een gezakte baseline is een blokkade, geen waarschuwing');
});
