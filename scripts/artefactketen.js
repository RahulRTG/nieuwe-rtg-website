#!/usr/bin/env node
'use strict';
/* ============================================================================
   De bediening van de artefactketen (scripts/lib/artefactketen.js).

     gebouwd     --commit --run --digest --backup-digest --image-id --backup-image-id
     testen      --commit --repo --digest --backup-repo --backup-digest
     promoveer   --digest --omgeving --besluit --door
     terugdraai  --naar=sha256:... --omgeving --besluit --door
     controleer
     eis-promotie  --commit --digest --backup-digest --image-id --backup-image-id --omgeving
     eis-rollback  --naar=sha256:... --omgeving       (drukt id's van het doel af)
     eis-actief    --image-id --omgeving              (is het draaiende image bewezen?)
     noteer-uitgevoerd --soort=promotie|rollback --omgeving   (na de wissel)

   Met --auditboek (of RTG_AUDITBOEK_EIS=1) gaat elke stap EERST door het
   PostgreSQL-auditboek en wordt pas daarna het ketenrecord geschreven: lukt het
   vastleggen of verankeren niet, dan gebeurt er niets (audit-dan-handelen).
   Elke fout is een exitcode 1; er is geen waarschuwingsstand.
   ========================================================================== */
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const keten = require('./lib/artefactketen');

const ROOT = path.join(__dirname, '..');
const args = Object.fromEntries(process.argv.slice(3).filter(a => a.startsWith('--')).map(a => { const i = a.indexOf('='); return i < 0 ? [a.slice(2), '1'] : [a.slice(2, i), a.slice(i + 1)]; }));
const eis = n => { if (!args[n]) throw Object.assign(new Error('--' + n + ' ontbreekt'), { code: 'ARGUMENT' }); return args[n]; };
const auditAan = () => args.auditboek === '1' || process.env.RTG_AUDITBOEK_EIS === '1';

async function audit(type, uitkomst, actor, context) {
  if (!auditAan()) return null;
  return require('../server/kern/auditboek').deelbaar().noteerEnAnker({ type, uitkomst, actor, context });
}
const door = () => { const d = eis('door'); return { soort: 'release-authority', ref: d }; };

async function main(cmd) {
  const env = process.env;
  switch (cmd) {
    case 'gebouwd': {
      const v = { commit: eis('commit'), run: eis('run'), digest: eis('digest'), backupDigest: eis('backup-digest'),
        imageId: eis('image-id'), backupImageId: eis('backup-image-id') };
      await audit('release.kandidaat.gebouwd', 'vastgelegd', { soort: 'ci', ref: v.run }, { commit: v.commit, digest: v.digest, run: v.run });
      return keten.voegToe(ROOT, 'gebouwd', v, { env }) && 'gebouwd vastgelegd: ' + v.digest;
    }
    case 'testen': {
      const k = keten.geverifieerd(ROOT);
      const g = k.records.filter(r => r.soort === 'gebouwd' && r.velden.digest === eis('digest') && r.velden.backupDigest === eis('backup-digest') && r.velden.commit === eis('commit')).pop();
      if (!g) throw Object.assign(new Error('Dit digest is niet als gebouwd vastgelegd voor deze commit.'), { code: 'GEEN_BOUWRECORD' });
      const at = require('./lib/artefacttest');
      const u = at.toets({ docker: at.maakRunner(), repo: eis('repo'), digest: eis('digest'), backupRepo: eis('backup-repo'), backupDigest: eis('backup-digest'), commit: eis('commit'), root: ROOT });
      fs.mkdirSync(path.join(ROOT, '.release'), { recursive: true });
      fs.writeFileSync(path.join(ROOT, '.release', 'artefacttest-bewijs.json'), JSON.stringify(u.bewijs, null, 2) + '\n');
      const v = { commit: eis('commit'), digest: eis('digest'), backupDigest: eis('backup-digest'), waargenomenDigest: u.waargenomenDigest,
        waargenomenBackupDigest: u.waargenomenBackupDigest, testBewijsSha256: u.bewijsSha256, geslaagd: u.geslaagd, gebouwdRecord: g.hash };
      await audit('release.kandidaat.getest', 'vastgelegd', { soort: 'ci', ref: 'artefacttest' }, { commit: v.commit, digest: v.digest, testBewijsSha256: v.testBewijsSha256, geslaagd: v.geslaagd });
      keten.voegToe(ROOT, 'getest', v, { env });
      if (!u.geslaagd) throw Object.assign(new Error('De test op dit digest is NIET geslaagd; het record staat erin als geslaagd:false.'), { code: 'TEST_MISLUKT' });
      return 'getest op exact ' + v.digest;
    }
    case 'promoveer': {
      const k = keten.geverifieerd(ROOT), digest = eis('digest'), omgeving = eis('omgeving'), a = door();
      const t = k.records.filter(r => r.soort === 'getest' && r.velden.digest === digest && r.velden.geslaagd).pop();
      try {
        if (!t) throw Object.assign(new Error('Dit digest heeft geen geslaagd testrecord; promotie geweigerd.'), { code: 'GEEN_TESTBEWIJS' });
        const b = k.records.find(r => r.hash === t.velden.gebouwdRecord).velden;
        const v = { commit: t.velden.commit, digest, backupDigest: t.velden.backupDigest, imageId: b.imageId, backupImageId: b.backupImageId,
          omgeving, besluit: eis('besluit'), goedgekeurdDoor: a.ref, testRecord: t.hash };
        // De bouw- en testfeiten uit de ondertekende keten gaan mee het auditboek in, zodat
        // het promotiebesluit daar niet zonder zijn voorgeschiedenis staat.
        const b0 = k.records.find(r => r.hash === t.velden.gebouwdRecord);
        await audit('release.kandidaat.gebouwd', 'vastgelegd', { soort: 'ci', ref: b0.velden.run }, { commit: b0.velden.commit, digest: b0.velden.digest, run: b0.velden.run });
        await audit('release.kandidaat.getest', 'vastgelegd', { soort: 'ci', ref: 'artefacttest' }, { commit: t.velden.commit, digest: t.velden.digest, testBewijsSha256: t.velden.testBewijsSha256, geslaagd: true });
        await audit('promotie.aangevraagd', 'toegestaan', a, { digest, naarOmgeving: omgeving, besluitRef: v.besluit });
        keten.voegToe(ROOT, 'gepromoveerd', v, { env });
        return 'promotiebesluit vastgelegd voor ' + digest + ' in ' + omgeving;
      } catch (e) {
        await audit('promotie.geweigerd', 'geweigerd', a, { digest, naarOmgeving: omgeving, reden: String(e.code || 'geweigerd').toLowerCase().replace(/_/g, '-') }).catch(() => {});
        throw e;
      }
    }
    case 'terugdraai': {
      const k = keten.geverifieerd(ROOT), naar = eis('naar'), omgeving = eis('omgeving'), a = door();
      try {
        if (!/^sha256:[a-f0-9]{64}$/.test(naar)) throw Object.assign(new Error('Terugdraaien benoemt een digest (sha256:...), geen tag, branch of commit.'), { code: 'ROLLBACK_GEEN_DIGEST' });
        const d = k.records.filter(r => r.soort === 'gepromoveerd' && r.velden.digest === naar && r.velden.omgeving === omgeving).pop();
        if (!d) throw Object.assign(new Error('Dit digest is nooit eerder in ' + omgeving + ' goedgekeurd; terugdraaien geweigerd.'), { code: 'ROLLBACK_NIET_GOEDGEKEURD' });
        const nu = keten.huidigUit(k.records, omgeving);
        if (!nu) throw Object.assign(new Error('Er is niets actief om vanaf terug te draaien.'), { code: 'GEEN_ACTIEF' });
        const v = { vanDigest: nu.digest, naarDigest: naar, naarBackupDigest: d.velden.backupDigest, naarImageId: d.velden.imageId,
          naarBackupImageId: d.velden.backupImageId, omgeving, besluit: eis('besluit'), goedgekeurdDoor: a.ref, doelRecord: d.hash };
        await audit('rollback.aangevraagd', 'toegestaan', a, { vanDigest: v.vanDigest, naarDigest: naar, naarOmgeving: omgeving, besluitRef: v.besluit });
        keten.voegToe(ROOT, 'terugdraai', v, { env });
        return 'terugdraaibesluit vastgelegd naar ' + naar;
      } catch (e) {
        await audit('rollback.geweigerd', 'geweigerd', a, { naarDigest: /^sha256:[a-f0-9]{64}$/.test(naar) ? naar : 'sha256:' + '0'.repeat(64), naarOmgeving: omgeving, reden: String(e.code || 'geweigerd').toLowerCase().replace(/_/g, '-') }).catch(() => {});
        throw e;
      }
    }
    case 'controleer': { const k = keten.geverifieerd(ROOT); return 'artefactketen verifieert: ' + k.records.length + ' records'; }
    case 'eis-promotie': {
      const k = keten.geverifieerd(ROOT);
      keten.eisGepromoveerd(k, { commit: eis('commit'), digest: eis('digest'), backupDigest: eis('backup-digest'), imageId: eis('image-id'), backupImageId: eis('backup-image-id'), omgeving: eis('omgeving') });
      return 'promotiebesluit klopt met exact dit digest';
    }
    case 'eis-rollback': {
      const k = keten.geverifieerd(ROOT);
      const d = keten.rollbackDoel(k, { naarDigest: eis('naar'), omgeving: eis('omgeving') });
      return [d.digest, d.backupDigest, d.imageId, d.backupImageId].join('\n');
    }
    case 'eis-actief': {
      const k = keten.geverifieerd(ROOT);
      keten.eisBewezenActief(k, { imageId: eis('image-id'), omgeving: eis('omgeving') });
      return 'het draaiende image is een goedgekeurd artefact';
    }
    case 'noteer-uitgevoerd': {
      const k = keten.geverifieerd(ROOT), omgeving = eis('omgeving'), nu = keten.huidigUit(k.records, omgeving);
      if (!nu) throw new Error('geen actief besluit');
      if (!auditAan()) throw Object.assign(new Error('--auditboek is vereist voor uitgevoerd-regels'), { code: 'ARGUMENT' });
      const v = nu.record.velden, a = { soort: 'release-authority', ref: v.goedgekeurdDoor };
      if (args.soort === 'promotie') {
        const t = k.records.find(r => r.hash === v.testRecord).velden;
        await audit('promotie.uitgevoerd', 'uitgevoerd', a, { digest: v.digest, naarOmgeving: omgeving, besluitRef: v.besluit, testBewijsSha256: t.testBewijsSha256 });
      } else await audit('rollback.uitgevoerd', 'uitgevoerd', a, { vanDigest: v.vanDigest, naarDigest: v.naarDigest, naarOmgeving: omgeving, besluitRef: v.besluit });
      return 'uitgevoerd-regel vastgelegd en verankerd';
    }
    default: throw Object.assign(new Error('onbekend commando'), { code: 'ARGUMENT' });
  }
}
main(process.argv[2]).then(t => { console.log(t); process.exit(0); },
  e => { console.error('[artefactketen] ' + (e.code ? e.code + ': ' : '') + e.message); process.exit(1); });
