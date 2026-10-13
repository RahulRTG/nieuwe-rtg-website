/* De bezorgproef (scripts/bezorgproef.js) tegen een NAGEMAAKTE server: zegt het
   instrument eerlijk "stuk", "open" en "gebroken" als de keten het niet doet,
   en stopt hij met een duidelijke reden als de actoren of de bestelling er niet
   komen? test/bezorgproef.test.js loopt de echte keten en ziet daardoor alleen
   de gelukkige kant van het instrument; hier staat de andere kant.

   De wegwerpserver wordt vervangen (via de require-cache, alleen in dit
   proces) door een kleine server op 127.0.0.1 die per scenario antwoordt. De
   opdrachtregel draait in een kindproces met dezelfde vervanging als preload,
   geschreven in een tijdelijke map. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const WEGWERP = require.resolve('../scripts/lib/wegwerpserver');
const SCRIPT = path.join(__dirname, '..', 'scripts', 'bezorgproef.js');

/* De nagemaakte server, als functie zodat het kindproces hem ook kan krijgen
   (via toString). `scenario` is een gewoon object met vlaggen. */
function nepServer(scenario) {
  const http = require('node:http');
  let n = 0;
  const antwoord = (pad, b) => {
    const s = scenario;
    if (pad === '/api/supplier/login') {
      if (b.username) return s.geenCode ? [401, { error: 'nee' }] : [200, { state: { supplier: { code: 'Z1' } } }];
      return s.geenPin ? [200, {}] : [200, { token: 'T' + b.staffId }];
    }
    if (pad === '/api/supplier/roster') return [200, s.eenMens ? { staff: [{ id: 1, role: 'manager' }] }
      : { staff: [{ id: 1, role: 'manager', name: 'Mira' }, { id: 2, role: 'bediening', name: 'Bas' }] }];
    if (pad === '/api/login') return s.geenLid ? [403, { error: 'Log in met je account' }] : [200, { token: 'L-' + b.tier }];
    if (pad === '/api/supplier/staff/add') return [200, s.geenCollega ? {} : { staff: { id: 3 }, pin: '0000' }];
    if (pad === '/api/bezorg/partners') return [200, s.geenZaak ? { partners: [] } : { partners: [{ code: 'Z1', name: 'Zaak', bezorgen: true, producten: [{ id: 'p1' }] }] }];
    if (pad === '/api/bezorg/bestel') return s.geenBestelling ? [400, { error: 'gesloten' }] : [200, { order: { ref: 'R' + (++n), items: [{ id: 'p1' }] } }];
    if (pad === '/api/notifications') return [200, 'geen json'];
    if (s.stuk) return pad === '/api/bezorg/volg' ? [200, { order: { status: 'nieuw', geo: null, adres: 'Keizersgracht 1' }, positie: null }] : [500, { error: 'kapot' }];
    if (pad === '/api/bezorg/volg') return [200, { order: { status: 'nieuw' } }];
    if (pad === '/api/supplier/bezorg/overzicht') return [200, {}];
    return [200, {}];
  };
  const srv = http.createServer((req, res) => {
    let ruw = '';
    req.on('data', d => { ruw += d; });
    req.on('end', () => {
      let b = {}; try { b = JSON.parse(ruw || '{}'); } catch (e) { b = {}; }
      const [status, lijf] = antwoord(new URL(req.url, 'http://x').pathname, b);
      res.writeHead(status, { 'content-type': 'application/json' });
      res.end(typeof lijf === 'string' ? lijf : JSON.stringify(lijf));
    });
  });
  return srv;
}

let scenario = {};
const gestart = [];
require.cache[WEGWERP] = { id: WEGWERP, filename: WEGWERP, loaded: true, exports: {
  start: async () => {
    if (scenario.dicht) {
      return { basis: 'http://127.0.0.1:9', klaar() { gestart.push('klaar'); } };
    }
    const srv = nepServer(scenario);
    await new Promise(r => srv.listen(0, '127.0.0.1', r));
    return { basis: 'http://127.0.0.1:' + srv.address().port, klaar() { gestart.push('klaar'); srv.close(); } };
  },
} };
const { meet } = require('../scripts/bezorgproef');

async function metScenario(s) { scenario = s; gestart.length = 0; return meet(); }

test('geen server: de proef stopt met "geen zaaksessie (status 0)" en ruimt op', async () => {
  await assert.rejects(metScenario({ dicht: true }), /geen zaaksessie \(status 0\)/);
  assert.deepEqual(gestart, ['klaar']);
});

test('de actoren: zonder zaakcode, met een mens, zonder pin of zonder lid stopt de proef met de reden', async () => {
  await assert.rejects(metScenario({ geenCode: true }), /geen zaaksessie \(status 401\)/);
  await assert.rejects(metScenario({ eenMens: true }), /geen twee mensen/);
  await assert.rejects(metScenario({ geenPin: true }), /geen persoonlijke inlog/);
  await assert.rejects(metScenario({ geenLid: true }), /geen lidsessies/);
});

test('geen bestelling: de proef stopt in plaats van storingen leeg te laten slagen', async () => {
  await assert.rejects(metScenario({ geenBestelling: true }), /de bestelling kwam er niet \(400\)/);
});

test('de zaak staat niet in de bezorglijst: de proef stopt met die reden, niet met een TypeError', async () => {
  await assert.rejects(metScenario({ geenZaak: true }), /de zaak Z1 staat niet in de bezorglijst/);
  assert.deepEqual(gestart, ['klaar']);
});

test('een server die overal 500 geeft: schakels stuk met het antwoord, storingen gebroken, sluit niet', async () => {
  const u = await metScenario({ stuk: true, geenCollega: true });
  assert.equal(u.sluit, false);
  assert.equal(u.zaak, 'Z1');
  assert.match(u.ref, /^R\d+$/);
  const stuk = u.schakels.filter(s => s.stand === 'stuk');
  assert.ok(stuk.length >= 8, 'de meeste schakels zijn stuk: ' + stuk.length);
  assert.ok(stuk.every(s => s.status === 500 && s.antwoord === 'kapot'));
  const s9 = u.schakels.find(s => s.nr === 9);
  assert.equal(s9.stand, 'gesloten', 'het volgscherm zonder positie en met adres is wel gesloten');
  assert.equal(u.telling.storingen, 11);
  assert.equal(u.telling.gebroken, 11 - u.telling.gehouden);
  const collega = u.storingen.find(s => /collega zonder managerrol/.test(s.naam));
  assert.equal(collega.stand, 'gebroken', 'zonder derde collega valt die storing niet te houden');
  assert.match(collega.wat, /collega kreeg 0/);
});

test('een server die leeg antwoordt: schakels open met wat er wel te zien was, niet stil gesloten', async () => {
  const u = await metScenario({});
  assert.equal(u.sluit, false);
  const per = nr => u.schakels.find(s => s.nr === nr);
  assert.equal(per(1).stand, 'gesloten', 'de zaak staat in de lijst met een product');
  assert.equal(per(2).stand, 'open');
  assert.equal(per(2).ziet, 'de zaak ziet niets');
  assert.equal(per(3).ziet, 'volgscherm: nieuw');
  assert.equal(per(4).ziet, 'geen inpak zichtbaar');
  assert.equal(per(5).ziet, 'het lid ziet bezorger undefined');
  assert.equal(per(7).ziet, 'geen positie');
  assert.match(per(8).ziet, /meldingen 0 -> 0/, 'een antwoord dat geen json is, telt als geen meldingen');
  assert.equal(per(9).stand, 'open');
  assert.match(per(9).ziet, /adres weg/);
  assert.equal(per(10).stand, 'open');
  assert.ok(u.schakels.every(s => s.stand !== 'stuk'));
  assert.equal(u.telling.open, u.schakels.length - u.telling.gesloten);
});

function preload(map) {
  const bestand = path.join(map, 'nep-wegwerp.js');
  fs.writeFileSync(bestand, "'use strict';\n" +
    'const nepServer = ' + nepServer.toString() + ';\n' +
    'const scenario = JSON.parse(process.env.NEP_SCENARIO || "{}");\n' +
    'const pad = ' + JSON.stringify(WEGWERP) + ';\n' +
    'require.cache[pad] = { id: pad, filename: pad, loaded: true, exports: { start: async () => {\n' +
    '  if (scenario.dicht) return { basis: "http://127.0.0.1:9", klaar() {} };\n' +
    '  const srv = nepServer(scenario); await new Promise(r => srv.listen(0, "127.0.0.1", r));\n' +
    '  return { basis: "http://127.0.0.1:" + srv.address().port, klaar() { srv.close(); } };\n' +
    '} } };\n');
  return bestand;
}

test('opdrachtregel: --json geeft de uitslag en code 1, zonder vlag de leesbare druk, en een stopreden', () => {
  const map = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-bezorgproef-'));
  try {
    const pre = preload(map);
    const draai = (s, argv) => spawnSync(process.execPath, ['-r', pre, SCRIPT, ...argv],
      { encoding: 'utf8', timeout: 20000, env: Object.assign({}, process.env, { NEP_SCENARIO: JSON.stringify(s) }) });
    const j = draai({ stuk: true }, ['--json']);
    assert.equal(j.status, 1, j.stderr);
    const u = JSON.parse(j.stdout.trim().split('\n').pop());
    assert.equal(u.sluit, false);
    const d = draai({}, []);
    assert.equal(d.status, 1, d.stderr);
    assert.match(d.stdout, /^bezorgproef: 10 schakels/m);
    assert.match(d.stdout, /ziet: volgscherm: nieuw/);
    assert.match(d.stdout, /belooft: /);
    assert.match(d.stdout, /DE KETEN SLUIT NIET\./);
    const k = draai({ stuk: true }, []);
    assert.match(k.stdout, /antwoord: kapot/);
    const f = draai({ dicht: true }, []);
    assert.equal(f.status, 1);
    assert.match(f.stderr, /de bezorgproef kon niet draaien: geen zaaksessie/);
  } finally { fs.rmSync(map, { recursive: true, force: true }); }
});
