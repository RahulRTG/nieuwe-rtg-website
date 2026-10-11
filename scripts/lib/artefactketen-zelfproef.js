'use strict';
/* DE ZELFPROEF VAN DE KETENVERIFICATEUR -- kan hij ook ZAKKEN?

   Een controle die op een echte keten alleen "ok" heeft gezegd, bewijst niet dat
   hij ook weigert. Deze proef draait zonder geheimen, zonder Docker en zonder de
   echte keten (dus ook lokaal, via npm run ci:lokaal): hij maakt in een
   wegwerpmap drie wegwerpsleutels (een per rol), legt een keten gebouwd -> getest
   -> gepromoveerd vast, eist dat die verifieert, en eist daarna dat elke van
   deze aanvallen weigert: een ander digest na de test, een verwijderd record,
   een nagemaakte handtekening, een rollback naar een digest dat nooit
   gepromoveerd is en een promotie van een mislukt geteste kandidaat.
   Geeft een aanval GEEN weigering, dan faalt de proef -- en dus de keten. */
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const trust = require('../../server/config/release-trust');
const k = require('./artefactketen');

const dig = c => 'sha256:' + c.repeat(64);

function proef() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-ketenzelfproef-'));
  try {
    fs.mkdirSync(path.join(root, 'deploy'));
    const env = {};
    for (const rol of Object.values(trust.ROLES)) {
      const p = crypto.generateKeyPairSync('ed25519');
      fs.writeFileSync(path.join(root, rol.publicFile), p.publicKey.export({ type: 'spki', format: 'pem' }));
      env[rol.secret] = p.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
    }
    const commit = 'a'.repeat(40);
    const g = k.voegToe(root, 'gebouwd', { commit, run: 'zelfproef-1', digest: dig('a'), backupDigest: dig('b'), imageId: dig('1'), backupImageId: dig('2') }, { env });
    const t = k.voegToe(root, 'getest', { commit, digest: dig('a'), backupDigest: dig('b'), waargenomenDigest: dig('a'), waargenomenBackupDigest: dig('b'),
      testBewijsSha256: 'c'.repeat(64), geslaagd: true, gebouwdRecord: g.hash }, { env });
    const ankers = trust.anchors(root);
    const eerlijk = JSON.parse(fs.readFileSync(path.join(root, k.REL), 'utf8'));
    if (!k.controleer(eerlijk, ankers).ok) throw new Error('de eerlijke keten verifieert niet');
    const faal = [];
    const moetWeigeren = (naam, f) => { try { f(); faal.push(naam + ': GEEN weigering'); } catch (e) { /* weigering is de bedoeling */ } };
    const kopie = () => JSON.parse(JSON.stringify(eerlijk));
    const zakt = (naam, f) => { const x = kopie(); f(x); if (k.controleer(x, ankers).ok) faal.push(naam + ': keten bleef geldig'); };
    zakt('digest na de test vervangen', x => { x.records[0].velden.digest = dig('9'); });
    zakt('record verwijderd', x => { x.records.splice(0, 1); });
    zakt('handtekening nagemaakt', x => { x.records[1].handtekening = Buffer.alloc(64, 1).toString('base64'); });
    moetWeigeren('promotie van een digest dat nooit gebouwd is', () => k.voegToe(root, 'gepromoveerd', { commit, digest: dig('9'), backupDigest: dig('b'),
      imageId: dig('1'), backupImageId: dig('2'), omgeving: 'productie', besluit: 'ZP-1', goedgekeurdDoor: 'zelfproef', testRecord: t.hash }, { env }));
    moetWeigeren('rollback naar een digest dat nooit gepromoveerd is', () => k.voegToe(root, 'terugdraai', { vanDigest: dig('a'), naarDigest: dig('9'),
      naarBackupDigest: dig('b'), naarImageId: dig('1'), naarBackupImageId: dig('2'), omgeving: 'productie', besluit: 'ZP-2', goedgekeurdDoor: 'zelfproef', doelRecord: t.hash }, { env }));
    if (!k.controleer(JSON.parse(fs.readFileSync(path.join(root, k.REL), 'utf8')), ankers).ok) faal.push('een geweigerde handeling heeft de keten beschadigd');
    return { ok: faal.length === 0, faal };
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
}

module.exports = { proef };
