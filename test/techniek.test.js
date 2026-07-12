/* Tests voor de techniek-motor (server/techniek.js): de gezondheidschecks en de
   zekeringen. Zuiver, met een nagemaakte ctx; geen server of database nodig.
   Draai: node --test test/techniek.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const techniek = require('../server/techniek');

function maakCtx(over) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tech-'));
  return Object.assign({
    db: { data: { a: 1, b: 2 }, writable: true },
    accounts: { count: () => 3 },
    anthropic: null,
    betaal: { AANBIEDER: 'demo' },
    sessions: new Map([['t', {}]]),
    DATA_DIR: dir, fs, path,
    STORE: 'json', pgPing: null,
    mailGeconfigureerd: false,
    zekeringen: {}
  }, over || {});
}

test('techniek: alle checks draaien en geven een geldige status', async () => {
  const res = await techniek.draaiChecks(maakCtx());
  assert.equal(res.length, techniek.CHECKS.length);
  for (const c of res) {
    assert.ok(['ok', 'waarschuwing', 'fout'].includes(c.status), c.id + ' heeft rare status ' + c.status);
    assert.ok(c.code && c.naam && typeof c.detail === 'string');
  }
});

test('techniek: gezonde opslag en accounts zijn ok', async () => {
  const res = await techniek.draaiChecks(maakCtx());
  const opslag = res.find(c => c.id === 'opslag');
  const acc = res.find(c => c.id === 'accounts');
  assert.equal(opslag.status, 'ok');
  assert.equal(acc.status, 'ok');
  assert.match(acc.detail, /3/);
});

test('techniek: kapotte db.data geeft een fout', async () => {
  const res = await techniek.draaiChecks(maakCtx({ db: { data: null, writable: true } }));
  assert.equal(res.find(c => c.id === 'opslag').status, 'fout');
});

test('techniek: een gesprongen zekering zet de check op fout', async () => {
  const res = await techniek.draaiChecks(maakCtx({ zekeringen: { accounts: { aan: false, reden: 'test' } } }));
  const acc = res.find(c => c.id === 'accounts');
  assert.equal(acc.status, 'fout');
  assert.match(acc.detail, /gesprongen/i);
});

test('techniek: postgres-check pingt en meldt de tijd', async () => {
  const res = await techniek.draaiChecks(maakCtx({ STORE: 'postgres', pgPing: async () => 3 }));
  const pg = res.find(c => c.id === 'postgres');
  assert.equal(pg.status, 'ok');
  assert.match(pg.detail, /ms/);
});

test('techniek: postgres onbereikbaar geeft een fout', async () => {
  const res = await techniek.draaiChecks(maakCtx({ STORE: 'postgres', pgPing: async () => { throw new Error('down'); } }));
  assert.equal(res.find(c => c.id === 'postgres').status, 'fout');
});

test('techniek: standaard-zekeringen staan aan en poorten gedrag', () => {
  const z = techniek.standaardZekeringen();
  for (const id of ['onderhoud', 'registratie', 'betalingen', 'ai']) {
    assert.ok(z[id], 'zekering ' + id + ' ontbreekt');
    assert.equal(z[id].aan, true);
    assert.ok(z[id].code);
  }
});
