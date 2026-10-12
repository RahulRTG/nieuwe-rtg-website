/* HET STANDRAPPORT VAN DE VRIJGAVEPOORT (scripts/vrijgave-stand.js): de tabel
   per baselinesoort (klopt, NIET GEHAALD, OPEN TERWIJL NIET, ONBEKEND), de
   lokale-standaardmarkering en de reden bij een dichte regel; het ophalen bij
   een draaiende server (token uit de omgeving, een andere status dan 200 is een
   fout); en het script als proces, met zijn uitgangen 0, 1 en 2 en de
   --controle-stand. De "server" is een kleine http-server op de loopback in
   deze toets; er gaat niets het netwerk op. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFile } = require('node:child_process');
const { tabel, haal } = require('../scripts/vrijgave-stand');
const B = require('../server/kern/vrijgave/baseline');

const SCRIPT = path.join(__dirname, '..', 'scripts', 'vrijgave-stand.js');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-vrijgave-script-'));
test.after(() => fs.rmSync(TMP, { recursive: true, force: true }));

const rij = (id, open, x = {}) => Object.assign({ id, beschikbaarVoorRechthebbende: open, geimplementeerd: true, geverifieerd: true,
  geautoriseerd: true, ingeschakeld: open, afhankelijkhedenGezond: true, stand: open ? 'enabled' : 'disabled',
  standBron: 'vastgelegd', code: open ? undefined : 'bestaat-niet-voor-dit-product', intern: open ? 'beschikbaar' : 'stand:disabled',
  perProvider: null }, x);
const per = open => ({ beschikbaarVoorRechthebbende: open, geimplementeerd: true, geverifieerd: true, geautoriseerd: true,
  ingeschakeld: open, afhankelijkhedenGezond: true, code: open ? null : 'tijdelijk-uit', intern: open ? 'beschikbaar' : 'stand:disabled' });
/* Een overzicht dat de V1-baseline precies haalt. */
function goed() {
  return { versie: 5, configuratiefout: null, besluiten: [{ besluit: 'provider.stripe', vastgelegd: true }, { besluit: 'emoney.b3', vastgelegd: false }],
    capabilities: Object.entries(B.BASELINE).map(([id, b]) => (b.via
      ? rij(id, false, { code: 'provider-niet-beschikbaar', intern: 'provider-onbekend', perProvider: { stripe: per(true), mollie: per(false), adyen: per(false) } })
      : rij(id, b.soort === 'in-baseline'))) };
}
const regel = (t, id) => t.split('\n').find(r => r.startsWith(id + ' '));

test('de tabel: een kop, een regel per capability, en per baselinesoort of het klopt', () => {
  const o = goed();
  o.capabilities.find(c => c.id === 'geld.provider.mollie').beschikbaarVoorRechthebbende = true;            // open terwijl niet
  Object.assign(o.capabilities.find(c => c.id === 'geld.provider.stripe'), rij('geld.provider.stripe', false)); // niet gehaald
  Object.assign(o.capabilities.find(c => c.id === 'geld.intern_saldo'), { stand: 'sandbox', standBron: 'lokale-standaard' });
  o.capabilities.push(rij('geld.nieuw', false, { stand: undefined }));
  const t = tabel(o);
  const kop = t.split('\n')[0];
  assert.match(kop, /^capability +IMPLEMENTED +VERIFIED +AUTHORIZED +ENABLED +AVAILABLE +stand +BASELINE V1 +reden als AVAILABLE nee is$/);
  assert.equal(t.split('\n').length, 1 + o.capabilities.length);
  assert.match(regel(t, 'geld.inkomend'), /in-baseline via stripe \(klopt\)/);
  assert.match(regel(t, 'geld.inkomend'), / ja +ja +disabled /, 'de AVAILABLE-kolom toont het oordeel over stripe');
  assert.match(regel(t, 'geld.provider.mollie'), /niet \(OPEN TERWIJL NIET\)\s*$/);
  assert.match(regel(t, 'geld.provider.stripe'), /in-baseline \(NIET GEHAALD\) +bestaat-niet-voor-dit-product: stand:disabled$/);
  assert.match(regel(t, 'geld.intern_saldo'), /sandbox \(lokaal\)/);
  assert.match(regel(t, 'geld.intern_saldo'), /besluit-open \(klopt\)/);
  assert.match(regel(t, 'geld.nieuw'), / \? +- \(ONBEKEND\)/);
  assert.match(regel(t, 'geld.provider.adyen'), /NEE/);
});

test('de tabel valt terug op het oordeel zonder provider als de belofte-provider ontbreekt', () => {
  const o = goed();
  o.capabilities.find(c => c.id === 'geld.inkomend').perProvider = { mollie: per(true) };
  assert.match(regel(tabel(o), 'geld.inkomend'), /in-baseline via stripe \(NIET GEHAALD\) +provider-niet-beschikbaar: provider-onbekend$/);
  /* Een perProvider-regel zonder eigen code leent die van de capability. */
  const p = goed();
  p.capabilities.find(c => c.id === 'geld.terugbetaling').perProvider.stripe = Object.assign(per(false), { code: null, intern: null });
  assert.match(regel(tabel(p), 'geld.terugbetaling'), /provider-niet-beschikbaar: provider-onbekend$/);
});

/* Een kleine server die /api/office/vrijgave nadoet. */
function server(antwoord) {
  const gezien = [];
  const s = http.createServer((req, res) => {
    let lijf = '';
    req.on('data', d => { lijf += d; });
    req.on('end', () => {
      gezien.push({ methode: req.method, pad: req.url, auth: req.headers.authorization, lijf });
      const [status, json] = antwoord(req);
      res.writeHead(status, { 'content-type': 'application/json' });
      res.end(JSON.stringify(json));
    });
  });
  return new Promise(r => s.listen(0, '127.0.0.1', () => r({ s, gezien, url: 'http://127.0.0.1:' + s.address().port })));
}
function metEnv(waarden, fn) {
  const oud = {};
  for (const k of Object.keys(waarden)) { oud[k] = process.env[k]; if (waarden[k] === undefined) delete process.env[k]; else process.env[k] = waarden[k]; }
  const terug = () => { for (const k of Object.keys(oud)) { if (oud[k] === undefined) delete process.env[k]; else process.env[k] = oud[k]; } };
  return Promise.resolve().then(fn).finally(terug);
}

test('haal bij een server: POST met het token uit de omgeving, en een configuratiefout maakt de validatie ongeldig', async () => {
  const o = goed();
  const { s, gezien, url } = await server(() => [200, o]);
  try {
    const r = await metEnv({ RTG_VRIJGAVE_URL: url + '///', RTG_VRIJGAVE_TOKEN: 'geheim-1' }, () => haal());
    assert.equal(r.bron, url + '///');
    assert.deepEqual(r.validatie, { ok: true, fouten: [] });
    assert.equal(r.overzicht.versie, 5);
    assert.deepEqual(gezien[0], { methode: 'POST', pad: '/api/office/vrijgave', auth: 'Bearer geheim-1', lijf: '{}' });
    o.configuratiefout = 'standbestand kapot';
    const k = await metEnv({ RTG_VRIJGAVE_URL: url, RTG_VRIJGAVE_TOKEN: undefined }, () => haal());
    assert.deepEqual(k.validatie, { ok: false, fouten: ['standbestand kapot'] });
    assert.equal(gezien[1].auth.trim(), 'Bearer', 'zonder token een leeg token, geen weglating');
  } finally { s.close(); }
});

test('haal bij een server die geen 200 geeft: een fout met de status', async () => {
  const { s, url } = await server(() => [401, { error: 'nee' }]);
  try {
    await assert.rejects(metEnv({ RTG_VRIJGAVE_URL: url }, () => haal()), /de server gaf 401 op \/api\/office\/vrijgave/);
  } finally { s.close(); }
});

/* Het script als proces. Async, zodat de server in dit proces kan antwoorden. */
function draai(args) {
  const env = Object.assign({}, process.env, { RTG_DATA_DIR: TMP });
  delete env.RTG_VRIJGAVE_URL; delete env.RTG_VRIJGAVE_TOKEN;
  return new Promise(r => execFile(process.execPath, [SCRIPT, ...args], { env, timeout: 60000 },
    (err, stdout, stderr) => r({ code: err ? err.code : 0, stdout, stderr })));
}

test('het script: uitgang 0 met de tabel en de besluiten, 2 bij een configuratiefout, 1 als de server weigert', async () => {
  let o = goed();
  let status = 200;
  const { s, gezien, url } = await server(() => [status, o]);
  try {
    const a = await draai(['--url', url, '--token', 'tok-9']);
    assert.equal(a.code, 0, a.stderr);
    assert.match(a.stdout, /^Vrijgavepoort -- bron: http:\/\/127\.0\.0\.1:\d+, standversie: 5\n/);
    assert.match(a.stdout, /\nBesluiten: provider\.stripe=vastgelegd, emoney\.b3=ONTBREEKT\n/);
    assert.equal(gezien[0].auth, 'Bearer tok-9');
    o = Object.assign(goed(), { versie: null, configuratiefout: 'onleesbaar' });
    const b = await draai(['--url', url]);
    assert.equal(b.code, 2);
    assert.match(b.stdout, /standversie: \?/);
    assert.match(b.stderr, /CONFIGURATIEFOUT -- alles staat dicht:\n  onleesbaar/);
    status = 500;
    const c = await draai(['--url', url]);
    assert.equal(c.code, 1);
    assert.match(c.stderr, /^\[vrijgave:stand\] de server gaf 500/);
  } finally { s.close(); }
});

test('het script met --controle: de baseline gehaald (0), niet gehaald (1), of niet op te halen (1)', async () => {
  let o = goed();
  let status = 200;
  const { s, url } = await server(() => [status, o]);
  try {
    const a = await draai(['--controle', '--url', url, '--token', 't']);
    assert.equal(a.code, 0, a.stdout + a.stderr);
    assert.match(a.stdout, /V1-baseline in de releaseconfiguratie; bron: http:\/\/127\.0\.0\.1/);
    assert.match(a.stdout, /  open   geld\.inkomend +in-baseline via stripe/);
    assert.match(a.stdout, /  dicht  geld\.provider\.mollie +niet  ontbreekt: ingeschakeld\n/);
    assert.match(a.stdout, /\nBASELINE GEHAALD\.\n/);
    o = goed();
    Object.assign(o.capabilities.find(c => c.id === 'geld.provider.stripe'), rij('geld.provider.stripe', false));
    const b = await draai(['--controle', '--url', url]);
    assert.equal(b.code, 1);
    assert.match(b.stdout, /dicht  geld\.provider\.stripe +in-baseline  ontbreekt: ingeschakeld/);
    assert.match(b.stderr, /BASELINE NIET GEHAALD:\n  geld\.provider\.stripe: hoort in de V1-baseline/);
    status = 503;
    const c = await draai(['--controle', '--url', url]);
    assert.equal(c.code, 1);
    assert.match(c.stdout, /bron: \?/);
    assert.match(c.stderr, /vrijgaveoverzicht niet op te halen: de releasekandidaat gaf 503/);
  } finally { s.close(); }
});

test('haal zonder adres rekent in dit proces, op de datamap uit RTG_DATA_DIR, en zegt dat de bevoegdheidslaag ontbreekt', async () => {
  const map = fs.mkdtempSync(path.join(TMP, 'lokaal-'));
  const r = await metEnv({ RTG_VRIJGAVE_URL: undefined, RTG_DATA_DIR: map }, () => haal());
  assert.equal(r.bron, 'dit proces (bevoegdheidslaag niet gekoppeld)');
  assert.equal(r.validatie.ok, true, r.validatie.fouten.join('; '));
  assert.deepEqual(r.overzicht.capabilities.map(c => c.id).sort(), Object.keys(B.BASELINE).sort());
  assert.equal(r.overzicht.versie, 0, 'een lege datamap: niets vastgelegd');
  assert.equal(fs.readdirSync(map).length, 0, 'een rapport schrijft niets');
});
