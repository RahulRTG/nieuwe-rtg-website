'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');
const { DatabaseSync } = require('node:sqlite');

const ROOT = path.join(__dirname, '..');

function omgeving(map) {
  const env = { ...process.env, RTG_DATA_DIR: map, RTG_STORE: 'sqlite',
    RTG_SQLITE_VOLLEDIG_MS: '0', RTG_ENC_KEY: '' };
  delete env.DATABASE_URL;
  delete env.PG_URL;
  delete env.REDIS_URL;
  return env;
}

function kind(map, code) {
  const uit = spawnSync(process.execPath, ['-e', code], {
    cwd: ROOT, env: omgeving(map), encoding: 'utf8', timeout: 15000
  });
  assert.equal(uit.status, 0, 'kindproces faalde:\n' + uit.stderr + uit.stdout);
  const regels = uit.stdout.trim().split('\n').filter(Boolean);
  return regels.length ? JSON.parse(regels.at(-1)) : null;
}

function rij(map, sleutel) {
  const db = new DatabaseSync(path.join(map, 'store.db'));
  try {
    return db.prepare('SELECT key, ver, deleted FROM kv WHERE key = ?').get(sleutel);
  } finally { db.close(); }
}

function maakGrafsteen(map, sleutel) {
  return kind(map, `
    const db = require('./server/db');
    db.db.data = { ${JSON.stringify(sleutel)}: { geheim: 'oude inhoud' }, behouden: { ok: true } };
    db.save();
    delete db.db.data[${JSON.stringify(sleutel)}];
    db.save();
    console.log(JSON.stringify({ klaar: true }));
  `);
}

function wachtBericht(kindproces, type) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => klaar(new Error('geen ' + type + '-bericht van kindproces')), 10000);
    const klaar = (fout, waarde) => {
      clearTimeout(timer);
      kindproces.off('message', bericht);
      kindproces.off('error', foutProces);
      kindproces.off('exit', einde);
      if (fout) reject(fout); else resolve(waarde);
    };
    const bericht = waarde => { if (waarde && waarde.type === type) klaar(null, waarde); };
    const foutProces = fout => klaar(fout);
    const einde = code => klaar(new Error('kindproces stopte voor ' + type + ' (code ' + code + ')'));
    kindproces.on('message', bericht);
    kindproces.on('error', foutProces);
    kindproces.on('exit', einde);
  });
}

test('SQLite-grafsteen overleeft echte procesherstart, vormdefault en gewone save', () => {
  const map = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-sqlite-grafsteen-herstart-'));
  try {
    maakGrafsteen(map, 'sessions');
    const voor = rij(map, 'sessions');
    assert.equal(Number(voor.deleted), 1, 'proces A heeft de collectie gewist');

    const na = kind(map, `
      const db = require('./server/db');
      db.load();
      const ontbrakNaLoad = !Object.hasOwn(db.db.data, 'sessions');
      if (!db.db.data.sessions) db.db.data.sessions = {}; // initdata/deel1-basis.js
      db.save();                                           // een gewone latere request-save
      const { DatabaseSync } = require('node:sqlite');
      const sqlite = new DatabaseSync(process.env.RTG_DATA_DIR + '/store.db');
      const rij = sqlite.prepare("SELECT ver, deleted FROM kv WHERE key='sessions'").get();
      sqlite.close();
      console.log(JSON.stringify({ ontbrakNaLoad,
        bestaatNaSave: Object.hasOwn(db.db.data, 'sessions'),
        ver: Number(rij.ver), deleted: Number(rij.deleted) }));
    `);

    assert.equal(na.ontbrakNaLoad, true, 'de herstart past de grafsteen toe');
    assert.equal(na.bestaatNaSave, false, 'de gewone save neemt de grafsteen ook in RAM over');
    assert.equal(na.deleted, 1, 'de vormdefault heft de grafsteen niet op');
    assert.equal(na.ver, Number(voor.ver), 'een geweigerde herschepping maakt geen nieuwe versie');
  } finally { fs.rmSync(map, { recursive: true, force: true }); }
});

test('alleen collectiepoort met een echte mutatie herschept na herstart', () => {
  const map = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-sqlite-grafsteen-herschep-'));
  try {
    maakGrafsteen(map, 'intrekkingen');
    const voor = rij(map, 'intrekkingen');
    const na = kind(map, `
      const db = require('./server/db');
      db.load();
      db.bewerkCollectie('intrekkingen', () => {});
      const { DatabaseSync } = require('node:sqlite');
      let sqlite = new DatabaseSync(process.env.RTG_DATA_DIR + '/store.db');
      const naNoop = sqlite.prepare("SELECT ver, deleted FROM kv WHERE key='intrekkingen'").get();
      sqlite.close();
      let basis;
      db.bewerkCollectie('intrekkingen', waarde => {
        basis = JSON.parse(JSON.stringify(waarde));
        waarde.nieuw = true;
      });
      sqlite = new DatabaseSync(process.env.RTG_DATA_DIR + '/store.db');
      const naMutatie = sqlite.prepare("SELECT ver, deleted FROM kv WHERE key='intrekkingen'").get();
      sqlite.close();
      console.log(JSON.stringify({ basis, naNoop: { ver: Number(naNoop.ver), deleted: Number(naNoop.deleted) },
        naMutatie: { ver: Number(naMutatie.ver), deleted: Number(naMutatie.deleted) },
        levend: db.db.data.intrekkingen }));
    `);

    assert.deepEqual(na.basis, {}, 'bewuste herschepping begint zonder gewiste inhoud');
    assert.deepEqual(na.naNoop, { ver: Number(voor.ver), deleted: 1 },
      'een collectiepoort-no-op is geen bewuste herschepping');
    assert.equal(na.naMutatie.deleted, 0);
    assert.ok(na.naMutatie.ver > Number(voor.ver), 'de mutatie commit op een nieuwe generatie');
    assert.deepEqual(na.levend, { nieuw: true });
  } finally { fs.rmSync(map, { recursive: true, force: true }); }
});

test('concurrente stale writer kan een nieuwere grafsteen niet laten herrijzen', async () => {
  const map = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-sqlite-grafsteen-stale-'));
  kind(map, `
    const db = require('./server/db');
    db.db.data = { intrekkingen: { geheim: 'oude inhoud' }, behouden: { ok: true } };
    db.save();
    console.log(JSON.stringify({ klaar: true }));
  `);

  const stale = spawn(process.execPath, ['-e', `
    const db = require('./server/db');
    db.load();
    process.send({ type: 'ready', zag: db.db.data.intrekkingen });
    process.on('message', bericht => {
      if (!bericht || bericht.type !== 'save') return;
      db.db.data.intrekkingen.lokaleNaloop = 'mag niet herrijzen';
      db.save();
      const { DatabaseSync } = require('node:sqlite');
      const sqlite = new DatabaseSync(process.env.RTG_DATA_DIR + '/store.db');
      const rij = sqlite.prepare("SELECT ver, deleted FROM kv WHERE key='intrekkingen'").get();
      sqlite.close();
      process.send({ type: 'done', deleted: Number(rij.deleted),
        bestaatInRam: Object.hasOwn(db.db.data, 'intrekkingen') });
      process.exit(0);
    });
  `], { cwd: ROOT, env: omgeving(map), stdio: ['ignore', 'pipe', 'pipe', 'ipc'] });
  let stderr = '';
  stale.stderr.on('data', stuk => { stderr += stuk; });
  try {
    const gereed = await wachtBericht(stale, 'ready');
    assert.deepEqual(gereed.zag, { geheim: 'oude inhoud' }, 'proces A heeft de oude werkkopie');

    kind(map, `
      const db = require('./server/db');
      db.load();
      delete db.db.data.intrekkingen;
      db.save();
      console.log(JSON.stringify({ klaar: true }));
    `);
    assert.equal(Number(rij(map, 'intrekkingen').deleted), 1, 'proces B commit de grafsteen');

    const antwoord = wachtBericht(stale, 'done');
    stale.send({ type: 'save' });
    const na = await antwoord;
    assert.equal(na.deleted, 1, 'de stale save laat de grafsteen staan');
    assert.equal(na.bestaatInRam, false, 'proces A neemt de verwijdering over');
  } finally {
    if (stale.exitCode == null && stale.signalCode == null) stale.kill('SIGKILL');
    fs.rmSync(map, { recursive: true, force: true });
  }
  assert.equal(stderr, '', 'stale writer schreef onverwacht naar stderr');
});
