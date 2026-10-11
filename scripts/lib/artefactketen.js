'use strict';
/* ============================================================================
   DE ARTEFACTKETEN -- commit -> build -> digest -> test -> promotie -> rollback
   als ONDERTEKENDE, aan elkaar geketende records in een machineleesbaar bestand
   (.release/artefactketen.json).

   De regel die alles draagt: een artefact IS zijn digest. Een tag, een branch,
   een commit of een versie noemt een artefact niet; een herbouw van dezelfde
   commit is een ANDER artefact (ander digest, nieuwe testplicht). Daarom kent
   dit bestand maar vier soorten record, en elke soort noemt digests en niets
   anders om naar een artefact te verwijzen:

     gebouwd     (BUILD)      commit + run + digest van image en backup
     getest      (BUILD)      de tests draaiden tegen EXACT dit digest: het
                              digest dat de testrun waarnam is gelijk aan het
                              digest dat gebouwd werd
     gepromoveerd (PROMOTION) alleen een digest met een geslaagd testrecord
     terugdraai  (PROMOTION)  alleen naar een digest dat al eerder gepromoveerd
                              was (dus eerder goedgekeurd en getest), en altijd
                              VANAF het digest dat nu actief is

   Hergebruik: de handtekeningen zijn die van server/config/release-trust.js
   (vaste Ed25519-ankers in deploy/*.pub, domeinscheiding per rol). Er komt geen
   tweede sleutelmodel bij.

   FAIL-CLOSED. `controleer()` weigert bij elke afwijking -- onbekende soort,
   onbekend veld, ontbrekend veld, een handtekening van de verkeerde rol, een
   gebroken keten, een verwijzing naar een record dat er niet (eerder) staat.
   Een gate (`eis*`) die iets niet kan bewijzen, GOOIT; er is geen "waarschuwing".
   Schrijven gebeurt door `voegToe()`, dat de nieuwe keten eerst volledig
   controleert en pas dan, atomair, wegschrijft: een ongeldig record kan er niet
   in.

   WAT DIT NIET IS: het is geen transparantielogboek. Het bestand staat in een
   CI-artefact en de promotiehost; de PostgreSQL-auditkant (server/kern/auditboek)
   legt dezelfde gebeurtenissen vast en verankert ze buiten de database.
   ========================================================================== */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const trust = require('../../server/config/release-trust');

const FORMAAT = 'rtg-artefactketen-v1';
const REL = '.release/artefactketen.json';
const MAX = 4 * 1024 * 1024;
const DIGEST = /^sha256:[a-f0-9]{64}$/;
const HEX64 = /^[a-f0-9]{64}$/;
const COMMIT = /^[a-f0-9]{40,64}$/;
const TOKEN = /^[A-Za-z0-9_.:-]{1,128}$/;
const OMGEVING = /^(staging|pilot|productie)$/;
const TIJD = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

const SOORTEN = Object.freeze({
  gebouwd: { rol: 'BUILD', velden: { commit: COMMIT, run: TOKEN, digest: DIGEST, backupDigest: DIGEST,
    imageId: DIGEST, backupImageId: DIGEST } },
  getest: { rol: 'BUILD', velden: { commit: COMMIT, digest: DIGEST, backupDigest: DIGEST, waargenomenDigest: DIGEST,
    waargenomenBackupDigest: DIGEST, testBewijsSha256: HEX64, geslaagd: 'bool', gebouwdRecord: HEX64 } },
  gepromoveerd: { rol: 'PROMOTION', velden: { commit: COMMIT, digest: DIGEST, backupDigest: DIGEST, imageId: DIGEST,
    backupImageId: DIGEST, omgeving: OMGEVING, besluit: TOKEN, goedgekeurdDoor: TOKEN, testRecord: HEX64 } },
  terugdraai: { rol: 'PROMOTION', velden: { vanDigest: DIGEST, naarDigest: DIGEST, naarBackupDigest: DIGEST,
    naarImageId: DIGEST, naarBackupImageId: DIGEST, omgeving: OMGEVING, besluit: TOKEN, goedgekeurdDoor: TOKEN,
    doelRecord: HEX64 } }
});

const sha256 = b => crypto.createHash('sha256').update(b).digest('hex');
function kanoniek(v) {
  if (Array.isArray(v)) return '[' + v.map(kanoniek).join(',') + ']';
  if (v && typeof v === 'object') return '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + kanoniek(v[k])).join(',') + '}';
  return JSON.stringify(v);
}
const lijf = r => ({ nr: r.nr, soort: r.soort, tijd: r.tijd, vorige: r.vorige, velden: r.velden });
const recordHash = r => sha256('RTG:ARTEFACTKETEN:v1\0' + kanoniek({ ...lijf(r), handtekening: r.handtekening }));

function fout(code, tekst) { return Object.assign(new Error(tekst), { code }); }

function veldKlachten(soort, velden) {
  const spec = SOORTEN[soort].velden, k = [];
  if (!velden || typeof velden !== 'object' || Array.isArray(velden)) return ['velden ontbreken'];
  for (const sleutel of Object.keys(spec)) if (!(sleutel in velden)) k.push('veld ontbreekt: ' + sleutel);
  for (const [sleutel, waarde] of Object.entries(velden)) {
    if (!Object.hasOwn(spec, sleutel)) { k.push('veld niet toegestaan: ' + sleutel); continue; }
    const eis = spec[sleutel];
    if (eis === 'bool' ? typeof waarde !== 'boolean' : !(typeof waarde === 'string' && eis.test(waarde))) k.push('veld heeft niet de vorm: ' + sleutel);
  }
  return k;
}

/* Wie actief is in een omgeving is het laatste gepromoveerd- of terugdraai-record. */
function huidigUit(records, omgeving) {
  for (let i = records.length - 1; i >= 0; i--) {
    const r = records[i], v = r.velden;
    if (v.omgeving !== omgeving) continue;
    if (r.soort === 'gepromoveerd') return { digest: v.digest, record: r };
    if (r.soort === 'terugdraai') return { digest: v.naarDigest, record: r };
  }
  return null;
}

/* Controleert de hele keten. Geeft {ok, fouten[], records} -- nooit een gok. */
function controleer(keten, ankers) {
  const f = [];
  const meld = (nr, tekst) => f.push((nr ? 'record ' + nr + ': ' : '') + tekst);
  if (!keten || keten.formaat !== FORMAAT || !Array.isArray(keten.records)) return { ok: false, fouten: ['geen geldige artefactketen'], records: [] };
  if (!ankers || !ankers.BUILD || !ankers.PROMOTION) return { ok: false, fouten: ['vaste vertrouwensankers ontbreken'], records: keten.records };
  const hashes = new Map();
  let vorige = null;
  const gezien = [];
  keten.records.forEach((r, i) => {
    const nr = i + 1;
    if (!r || typeof r !== 'object' || r.nr !== nr || !SOORTEN[r.soort]) return meld(nr, 'onbekende soort of volgnummer');
    if (!TIJD.test(String(r.tijd || '')) || !Number.isFinite(Date.parse(r.tijd))) meld(nr, 'ongeldige tijd');
    if (r.vorige !== vorige) meld(nr, 'de keten is gebroken (vorige hash wijkt af)');
    const kl = veldKlachten(r.soort, r.velden);
    kl.forEach(k => meld(nr, k));
    const rol = SOORTEN[r.soort].rol;
    if (!trust.verify(rol, Buffer.from(kanoniek(lijf(r))), r.handtekening, ankers[rol].key)) meld(nr, 'handtekening is niet van de rol ' + rol);
    const h = recordHash(r);
    if (r.hash !== h) meld(nr, 'recordhash klopt niet');
    if (!kl.length) {
      const v = r.velden;
      if (r.soort === 'gebouwd') {
        if (v.digest === v.backupDigest) meld(nr, 'image en backup hebben hetzelfde digest');
        if (gezien.some(x => x.soort === 'gebouwd' && (x.velden.digest === v.digest || x.velden.backupDigest === v.backupDigest))) meld(nr, 'dit digest is al eerder als gebouwd vastgelegd');
      } else if (r.soort === 'getest') {
        const b = hashes.get(v.gebouwdRecord);
        if (!b || b.soort !== 'gebouwd') meld(nr, 'verwijst naar een gebouwd-record dat er niet eerder staat');
        else if (b.velden.commit !== v.commit || b.velden.digest !== v.digest || b.velden.backupDigest !== v.backupDigest) meld(nr, 'getest hoort niet bij exact het gebouwde digest');
        if (v.geslaagd && (v.waargenomenDigest !== v.digest || v.waargenomenBackupDigest !== v.backupDigest)) meld(nr, 'geslaagd terwijl de test een ander digest waarnam');
      } else if (r.soort === 'gepromoveerd') {
        const t = hashes.get(v.testRecord), b = t && hashes.get(t.velden.gebouwdRecord);
        if (!t || t.soort !== 'getest' || !t.velden.geslaagd) meld(nr, 'promotie zonder eerder geslaagd testrecord');
        else if (t.velden.commit !== v.commit || t.velden.digest !== v.digest || t.velden.backupDigest !== v.backupDigest) meld(nr, 'promotie van een ander digest dan het geteste');
        else if (!b || b.velden.imageId !== v.imageId || b.velden.backupImageId !== v.backupImageId) meld(nr, 'promotie van een ander image-id dan het gebouwde');
      } else if (r.soort === 'terugdraai') {
        const d = hashes.get(v.doelRecord);
        const nu = huidigUit(gezien, v.omgeving);
        if (!d || d.soort !== 'gepromoveerd' || d.velden.omgeving !== v.omgeving) meld(nr, 'terugdraaien naar een digest dat nooit in deze omgeving gepromoveerd was');
        else if (d.velden.digest !== v.naarDigest || d.velden.backupDigest !== v.naarBackupDigest || d.velden.imageId !== v.naarImageId || d.velden.backupImageId !== v.naarBackupImageId) meld(nr, 'terugdraaidoel wijkt af van het goedgekeurde record');
        if (!nu) meld(nr, 'terugdraaien zonder actief digest');
        else if (nu.digest !== v.vanDigest) meld(nr, 'vanDigest is niet het digest dat nu actief is');
        if (v.vanDigest === v.naarDigest) meld(nr, 'terugdraaien naar het actieve digest is geen terugdraaien');
      }
    }
    hashes.set(r.hash, r);
    gezien.push(r);
    vorige = r.hash;
  });
  return { ok: f.length === 0, fouten: f, records: keten.records };
}

function lees(root) {
  const pad = path.join(root, REL);
  let fd;
  try {
    const voor = fs.lstatSync(pad);
    if (!voor.isFile() || voor.isSymbolicLink() || voor.size < 1 || voor.size > MAX) throw new Error();
    fd = fs.openSync(pad, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0));
    return JSON.parse(fs.readFileSync(fd, 'utf8'));
  } catch (e) { throw fout('KETEN_ONLEESBAAR', 'De artefactketen ontbreekt of is onleesbaar (' + REL + ').'); }
  finally { if (fd !== undefined) fs.closeSync(fd); }
}
function leesOfLeeg(root) {
  if (!fs.existsSync(path.join(root, REL))) return { formaat: FORMAAT, records: [] };
  return lees(root);
}

function geverifieerd(root) {
  const keten = lees(root);
  const u = controleer(keten, trust.anchors(root));
  if (!u.ok) throw fout('KETEN_ONGELDIG', 'Artefactketen verifieert niet: ' + u.fouten.slice(0, 5).join('; '));
  return keten;
}

/* Alleen toevoegen. De nieuwe keten wordt VOLLEDIG gecontroleerd voordat er iets
   wordt weggeschreven, en het schrijven is atomair (tijdelijk bestand + rename). */
function voegToe(root, soort, velden, { env = process.env, nu = Date.now() } = {}) {
  if (!SOORTEN[soort]) throw fout('KETEN_SOORT', 'Onbekende recordsoort.');
  const rol = SOORTEN[soort].rol;
  const ankers = trust.anchors(root);
  const keten = leesOfLeeg(root);
  const was = controleer(keten, ankers);
  if (!was.ok) throw fout('KETEN_ONGELDIG', 'Bestaande artefactketen verifieert niet; er wordt niets aan toegevoegd: ' + was.fouten.slice(0, 3).join('; '));
  const sleutel = trust.authorizedPrivate(root, rol, env);
  const vorige = keten.records.length ? keten.records[keten.records.length - 1].hash : null;
  const r = { nr: keten.records.length + 1, soort, tijd: new Date(nu).toISOString(), vorige, velden };
  r.handtekening = trust.sign(rol, Buffer.from(kanoniek(lijf(r))), sleutel);
  r.hash = recordHash(r);
  const nieuw = { formaat: FORMAAT, records: [...keten.records, r] };
  const na = controleer(nieuw, ankers);
  if (!na.ok) throw fout('KETEN_WEIGERT', 'Record geweigerd: ' + na.fouten.join('; '));
  const pad = path.join(root, REL), tmp = pad + '.' + process.pid + '.tmp';
  fs.mkdirSync(path.dirname(pad), { recursive: true, mode: 0o700 });
  fs.writeFileSync(tmp, JSON.stringify(nieuw, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
  fs.renameSync(tmp, pad);
  return r;
}

/* ---------- de gates -------------------------------------------------------
   Elke gate krijgt een GEVERIFIEERDE keten en gooit als hij het gevraagde niet
   kan bewijzen. Er is geen "geen record gevonden, dus misschien goed". */
function vind(keten, soort, pred) { return keten.records.filter(r => r.soort === soort && pred(r.velden)); }

function eisGetest(keten, { commit, digest, backupDigest }) {
  const t = vind(keten, 'getest', v => v.commit === commit && v.digest === digest && v.backupDigest === backupDigest && v.geslaagd);
  if (!t.length) throw fout('GEEN_TESTBEWIJS', 'Dit digest heeft geen geslaagd testrecord voor exact deze bytes: ' + digest);
  return t[t.length - 1];
}
/* Deploy: het kandidaat moet het ACTIEVE besluit voor de omgeving zijn. */
function eisGepromoveerd(keten, { commit, digest, backupDigest, imageId, backupImageId, omgeving }) {
  const nu = huidigUit(keten.records, omgeving);
  if (!nu || nu.record.soort !== 'gepromoveerd') throw fout('GEEN_PROMOTIEBESLUIT', 'Er is geen actief promotiebesluit voor ' + omgeving + '.');
  const v = nu.record.velden;
  if (v.digest !== digest || v.backupDigest !== backupDigest || v.commit !== commit || v.imageId !== imageId || v.backupImageId !== backupImageId)
    throw fout('ANDER_DIGEST', 'Het kandidaat is niet het digest dat is goedgekeurd voor promotie (' + v.digest + ').');
  eisGetest(keten, { commit, digest, backupDigest });
  return nu.record;
}
/* Rollback: de nieuwste terugdraai-beslissing naar dit digest moet de actieve zijn. */
function eisTerugdraai(keten, { naarDigest, omgeving }) {
  if (!DIGEST.test(String(naarDigest || ''))) throw fout('ROLLBACK_GEEN_DIGEST', 'Terugdraaien benoemt een digest (sha256:...), geen tag, branch of commit.');
  const nu = huidigUit(keten.records, omgeving);
  if (!nu || nu.record.soort !== 'terugdraai' || nu.digest !== naarDigest) throw fout('GEEN_ROLLBACKBESLUIT', 'Er is geen ondertekend terugdraaibesluit naar ' + naarDigest + ' voor ' + omgeving + '.');
  return nu.record;
}
/* Het id dat de host MOET zien als hij een eerder goedgekeurd digest terugzet. */
function rollbackDoel(keten, { naarDigest, omgeving }) {
  const r = eisTerugdraai(keten, { naarDigest, omgeving });
  const v = r.velden;
  return { digest: v.naarDigest, backupDigest: v.naarBackupDigest, imageId: v.naarImageId, backupImageId: v.naarBackupImageId, record: r.hash };
}
/* De voorganger moet een bewezen artefact zijn: anders is er niets om naar terug te draaien. */
function eisBewezenActief(keten, { imageId, omgeving }) {
  const nu = huidigUit(keten.records, omgeving);
  const v = nu && nu.record.soort === 'gepromoveerd' ? nu.record.velden : nu && nu.record.soort === 'terugdraai' ? { imageId: nu.record.velden.naarImageId } : null;
  if (!v || v.imageId !== imageId) throw fout('ACTIEF_ONBEWEZEN', 'Het draaiende image is geen goedgekeurd, getest artefact in de keten.');
  return nu.record;
}

module.exports = { FORMAAT, REL, SOORTEN, controleer, lees, leesOfLeeg, geverifieerd, voegToe, huidigUit,
  eisGetest, eisGepromoveerd, eisTerugdraai, rollbackDoel, eisBewezenActief, kanoniek, sha256 };
