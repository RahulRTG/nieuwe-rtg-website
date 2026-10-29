'use strict';
/* De echte image-overdracht moet de vier gebouwde shellbestanden terughalen,
   zonder onbekende runtimeverschillen of lokale wijzigingen te verbergen.
   Alleen Docker/Git zijn fixtures; bestandsoverdracht en bytecontrole zijn echt. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const release = require('../scripts/release-bewijs');
const kw = require('../scripts/lib/kwalificatie');
const APP = 'sha256:' + 'a'.repeat(64), BACKUP = 'sha256:' + 'b'.repeat(64), COMMIT = 'c'.repeat(40);
const SHELL = ['public/apps/app-main.js', 'public/apps/app-main/app-main-01.js', 'public/apps/app.html', 'public/apps/werkruimte.html'];
function fixture(t, { wrongCommit = false, missing = false } = {}) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-image-overdracht-'));
  t.after(() => fs.rmSync(tmp, { recursive: true, force: true }));
  const root = path.join(tmp, 'werk'), image = path.join(tmp, 'image');
  const write = (base, rel, text) => { fs.mkdirSync(path.dirname(path.join(base, rel)), { recursive: true }); fs.writeFileSync(path.join(base, rel), text); };
  const files = { 'package.json': '{"name":"fixture","version":"1"}', 'package-lock.json': '{}',
    'server/app.js': 'server-bron', 'public/dist/app.js': 'minified', 'public/sw.js': 'worker',
    'public/apps/foundation/sw.js': 'foundation-worker', 'rtg-motor': 'motor', 'rtg-sentinel': 'sentinel',
    'scripts/docker/backup.sh': 'backup', 'scripts/docker/herstel.sh': 'herstel', '.dockerignore': '' };
  for (const [rel, value] of Object.entries(files)) { write(root, rel, value); write(image, rel, value); }
  for (const rel of SHELL) { write(root, rel, 'bron:' + rel); write(image, rel, 'gebouwd:' + rel); }
  const manifest = release.maakManifest(image);
  manifest.bron.commit = wrongCommit ? 'd'.repeat(40) : COMMIT;
  write(image, 'release-bewijs.json', JSON.stringify(manifest));
  if (missing) fs.unlinkSync(path.join(image, SHELL[3]));
  const result = stdout => ({ status: 0, stdout, stderr: '' });
  const fakeCp = { spawnSync(cmd, args) {
    if (cmd === 'git') {
      if (args.includes('rev-parse')) return result(COMMIT);
      const ref = args.find(a => a.startsWith('HEAD:'));
      if (ref && SHELL.includes(ref.slice(5))) return result(Buffer.from('bron:' + ref.slice(5)));
      throw new Error('Onverwachte git-aanroep: ' + args.join(' '));
    }
    assert.equal(cmd, 'docker');
    if (args[0] === 'image') return result(args.at(-1) === 'app' ? APP : BACKUP);
    if (args[0] === 'create') return result(args[1] === APP ? 'app-container' : 'backup-container');
    if (args[0] === 'rm') return result('');
    assert.equal(args[0], 'cp');
    if (args[2] === '-') {
      const bytes = Buffer.from(args[1].endsWith('rtg-backup') ? 'backup' : 'herstel');
      const tar = Buffer.alloc(1024); tar.write(bytes.length.toString(8).padStart(11, '0'), 124); bytes.copy(tar, 512);
      return result(tar);
    }
    const rel = args[1].replace(/^app-container:\/app\//, '');
    try { fs.cpSync(path.join(image, rel), args[2], { recursive: true }); return result(''); }
    catch (e) { return { status: 1, stderr: e.message }; }
  } };
  const mod = { exports: {} };
  const req = name => name === 'child_process' ? fakeCp : name === './lib/kwalificatie' ? kw : require(name);
  const source = fs.readFileSync(path.join(__dirname, '../scripts/kwalificatie.js'), 'utf8');
  vm.runInNewContext(source, { Buffer, require: req, module: mod, __dirname: path.join(root, 'scripts'),
    process: { argv: ['node', 'kwalificatie.js', '--uit-image', '--image=app', '--backup=backup'] },
    console: { log() {}, error() {} } }, { filename: 'kwalificatie.js' });
  return { root, manifest, run: () => mod.exports.uitImage() };
}
test('image-shell wordt exact overgedragen; herhalen kan en nacontrole betrapt nieuwe drift', t => {
  const f = fixture(t);
  assert.deepEqual(kw.vergelijk(f.root, f.manifest).verschillen.map(x => x.pad).sort(), [...SHELL].sort());
  f.run(); assert.equal(kw.fase(f.root, 'voor').ok, true);
  f.run(); assert.equal(kw.fase(f.root, 'voor').ok, true);
  for (const rel of SHELL) assert.equal(fs.readFileSync(path.join(f.root, rel), 'utf8'), 'gebouwd:' + rel);
  fs.appendFileSync(path.join(f.root, SHELL[0]), 'later');
  assert.equal(kw.fase(f.root, 'na').ok, false);
});
test('onbekende serverdrift wordt niet meegekopieerd of vrijgesteld', t => {
  const f = fixture(t); fs.appendFileSync(path.join(f.root, 'server/app.js'), 'wijziging'); f.run();
  assert.deepEqual(kw.fase(f.root, 'voor').verschillen.map(x => x.pad), ['server/app.js']);
});
test('lokale shellwijziging stopt vóór enige werkboomvervanging', t => {
  const f = fixture(t); fs.appendFileSync(path.join(f.root, SHELL[3]), 'lokaal');
  assert.throws(f.run, /lokale wijziging/i);
  assert.equal(fs.readFileSync(path.join(f.root, SHELL[0]), 'utf8'), 'bron:' + SHELL[0]);
});
test('andere imagecommit of ontbrekend shellbestand levert geen kwalificatie', t => {
  for (const options of [{ wrongCommit: true }, { missing: true }]) {
    const f = fixture(t, options); assert.throws(f.run, options.wrongCommit ? /niet uit de commit/ : /docker cp stopte/);
    assert.equal(fs.existsSync(path.join(f.root, kw.REL.image)), false);
    assert.equal(fs.readFileSync(path.join(f.root, SHELL[0]), 'utf8'), 'bron:' + SHELL[0]);
  }
});
