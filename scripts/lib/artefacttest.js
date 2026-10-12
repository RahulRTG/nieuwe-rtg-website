'use strict';
/* ============================================================================
   TESTEN OP EXACT DE GEPUBLICEERDE BYTES.

   De test haalt het artefact op BIJ DIGEST (`repo@sha256:...`, nooit bij tag),
   leest terug welk digest de container-engine werkelijk heeft, en voert de
   controles UIT HET IMAGE uit. Een tag die tussen bouwen en testen verschuift,
   of een registry die iets anders teruggeeft, levert een ander waargenomen
   digest en dus `geslaagd: false`; dat record kan nooit tot promotie leiden
   (zie artefactketen.js).

   Wat er binnen het image draait: (1) het ingebakken inhoudsbewijs wordt tegen
   de bestanden in het image opnieuw gerekend, (2) test/artefact-image.test.js
   (read-only gemount uit de commit) controleert in het image dat het bij de
   commit hoort en dat de vertrouwenslaag laadt. De VOLLEDIGE unitsuite
   (npm run afbouw:software) draait nog op de werkboom; het image bevat de
   testmap niet. Dat staat zo in RELEASEKETEN/AUDITBOEK en wordt niet verzwegen.
   ========================================================================== */
const cp = require('child_process');
const crypto = require('crypto');
const path = require('path');

const DIGEST = /^sha256:[a-f0-9]{64}$/;
const sha256 = b => crypto.createHash('sha256').update(b).digest('hex');

/* Er is bewust geen omgevingsvariabele om `docker` te vervangen: wie die kon
   zetten kon een test laten slagen die nooit draaide. Toetsen zetten een nep-
   `docker` vooraan het PATH van het kindproces. */
function maakRunner() {
  return args => {
    const r = cp.spawnSync('docker', args, { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, timeout: 15 * 60 * 1000 });
    return { status: r.status === null ? 1 : r.status, uit: String(r.stdout || ''), fout: String(r.stderr || '') };
  };
}

function toetsEenImage({ docker, repo, digest, commit, root, alleenIdentiteit = false }) {
  const ref = repo + '@' + digest;
  const stappen = [];
  const stap = (naam, ok, uit) => { stappen.push({ naam, ok: !!ok, uitSha256: sha256(String(uit || '')) }); return !!ok; };
  let waargenomen = null;
  const pull = docker(['pull', ref]);
  stap('pull-bij-digest', pull.status === 0, pull.uit + pull.fout);
  const ins = pull.status === 0 ? docker(['image', 'inspect', '--format={{index .RepoDigests 0}}', ref]) : { status: 1, uit: '', fout: '' };
  const m = /@(sha256:[a-f0-9]{64})\s*$/.exec(ins.uit.trim());
  waargenomen = ins.status === 0 && m ? m[1] : null;
  stap('waargenomen-digest-gelijk', waargenomen === digest, ins.uit);
  let ok = pull.status === 0 && waargenomen === digest;
  if (ok && !alleenIdentiteit) {
    const b = docker(['run', '--rm', '--entrypoint', 'node', ref, 'scripts/release-bewijs.js', '--controle', '/app/release-bewijs.json']);
    ok = stap('ingebakken-inhoudsbewijs', b.status === 0, b.uit + b.fout) && ok;
    const t = docker(['run', '--rm', '--network', 'none', '-e', 'RTG_IN_IMAGE=1', '-e', 'RTG_VERWACHTE_COMMIT=' + commit,
      '-v', path.join(root, 'test', 'artefact-image.test.js') + ':/app/test/artefact-image.test.js:ro',
      '--entrypoint', 'node', ref, '--test', '/app/test/artefact-image.test.js']);
    ok = stap('toets-in-image', t.status === 0 && /# fail 0/.test(t.uit) && /# pass [1-9]/.test(t.uit), t.uit + t.fout) && ok;
  }
  return { ref, waargenomenDigest: waargenomen, geslaagd: ok, stappen };
}

/* Image en backup horen allebei bij dezelfde release; beide moeten slagen. */
function toets({ docker, repo, digest, backupRepo, backupDigest, commit, root }) {
  if (!DIGEST.test(String(digest)) || !DIGEST.test(String(backupDigest))) throw Object.assign(new Error('Testen benoemt digests (sha256:...), geen tags.'), { code: 'GEEN_DIGEST' });
  const image = toetsEenImage({ docker, repo, digest, commit, root });
  const backup = toetsEenImage({ docker, repo: backupRepo, digest: backupDigest, commit, root, alleenIdentiteit: true });
  const bewijs = { formaat: 'rtg-artefacttest-v1', commit, digest, backupDigest, image, backup };
  const geslaagd = image.geslaagd && backup.waargenomenDigest === backupDigest;
  return { geslaagd, waargenomenDigest: image.waargenomenDigest || digest.replace(/[a-f0-9]/g, '0'),
    waargenomenBackupDigest: backup.waargenomenDigest || backupDigest.replace(/[a-f0-9]/g, '0'),
    bewijs, bewijsSha256: sha256(JSON.stringify(bewijs)) };
}

module.exports = { maakRunner, toets, toetsEenImage };
