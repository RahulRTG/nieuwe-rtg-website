'use strict';
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { spawnSync } = require('node:child_process');
const root = path.join(__dirname, '../..');
module.exports = (t, data = {}, enc = '') => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-audit-rijen-'));
  const env = { RTG_DATA_DIR: dir, RTG_STORE: 'sqlite', RTG_ENC_KEY: enc, DATABASE_URL: '', PG_URL: '', REDIS_URL: '' };
  const oud = Object.fromEntries(Object.keys(env).map(k => [k, process.env[k]])); Object.assign(process.env, env);
  for (const k of Object.keys(require.cache)) if (k.startsWith(path.join(root, 'server') + path.sep)) delete require.cache[k];
  const p = require('../../server/db');
  p.db.data = { handelingLog: [], apiSpoor: {}, ander: { waarde: 1 }, ...data }; p.save();
  const conn = new DatabaseSync(path.join(dir, 'store.db')), kluis = require('../../server/kluis');
  const lees = naam => {
    const m = conn.prepare('SELECT * FROM audit_meta WHERE naam=?').get(naam);
    if (!m) return JSON.parse(kluis.ontsleutel(conn.prepare('SELECT val FROM kv WHERE key=?').get(naam).val));
    const l = conn.prepare('SELECT waarde FROM audit_rij WHERE naam=? ORDER BY nr').all(naam).map(r => JSON.parse(kluis.ontsleutel(r.waarde)));
    return naam === 'handelingLog' ? l.reverse() : { ...JSON.parse(kluis.ontsleutel(m.extra)), commandJournaal: l, commandJournaalTotaal: m.totaal };
  };
  const kind = bron => spawnSync(process.execPath, ['-e', bron], { cwd: root, env: process.env, encoding: 'utf8' });
  const handeling = () => require('../../server/lib/handelingsspoor')({ db: p.db, save: p.save });
  const api = () => require('../../server/opzet/auditspoor').maakAuditspoor({ db: p.db, save: p.save });
  t.after(() => { conn.close(); for (const [k, v] of Object.entries(oud)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; } fs.rmSync(dir, { recursive: true, force: true }); });
  return { ...p, conn, kluis, lees, kind, handeling, api, dir };
};
