'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { bewijsBronnen, leesProductiestatus } = require('./productie-vrijgave');
const trust = require('../../server/config/release-trust');

const REL = Object.freeze({ document:'.release/productie-promotie.json',
  handtekening:'.release/productie-promotie.sig', sleutel:'deploy/promotie-sleutel.pub' });
/* Het bronmanifest noemt duizenden getrackte bestanden en kan daardoor ruim
   boven een halve MiB uitkomen; het blijft bewust begrensd. */
const MAX = 16 * 1024 * 1024;
const HASH = /^[a-f0-9]{64}$/;
const ID = /^sha256:[a-f0-9]{64}$/;
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

function leesRegulier(pad, max = MAX) {
  const vlaggen = fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0);
  let fd;
  try {
    const voor = fs.lstatSync(pad);
    if (!voor.isFile() || voor.isSymbolicLink() || voor.size < 1 || voor.size > max)
      throw new Error('geen begrensd regulier bestand');
    fd = fs.openSync(pad, vlaggen);
    const stat = fs.fstatSync(fd);
    const bytes = fs.readFileSync(fd);
    if (!stat.isFile() || bytes.length !== stat.size || fs.fstatSync(fd).size !== stat.size)
      throw new Error('bestand veranderde tijdens lezen');
    return bytes;
  } finally { if (fd !== undefined) fs.closeSync(fd); }
}

function geldigeKandidaat(k) {
  return !!k && ID.test(String(k.id || '')) && ID.test(String(k.digest || '')) &&
    typeof k.immutable === 'string' && k.immutable.endsWith('@' + k.digest) &&
    HASH.test(String(k.bewijsBestandSha256 || k.herkomstSha256 || ''));
}

function bewijskaart(root, soort = 'oci') {
  const uit = {};
  for (const [naam, rel] of Object.entries(bewijsBronnen(soort))) {
    if (rel.endsWith('.rtgp')) {
      const file = path.join(root, rel);
      uit[naam] = { pad:rel, sha256:require('./native-artifact').hashFile(file), bytes:fs.statSync(file).size };
    } else {
      const bytes = leesRegulier(path.join(root, rel));
      uit[naam] = { pad:rel, sha256:sha256(bytes), bytes:bytes.length };
    }
  }
  return uit;
}

/* GARANTIE 1+2: een promotiedocument wordt alleen gemaakt (en een uitrol alleen
   toegelaten) voor het digest waarvoor de artefactketen een geslaagd testrecord
   op exact die bytes EN een actief, ondertekend promotiebesluit heeft. */
function eisKetenbesluit(root, commit, kandidaat, env = process.env) {
  const k = require('./artefactketen');
  return k.eisGepromoveerd(k.geverifieerd(root), { commit, digest:kandidaat.image.digest, backupDigest:kandidaat.backup.digest,
    imageId:kandidaat.image.id, backupImageId:kandidaat.backup.id, omgeving:String(env.RTG_OMGEVING || 'productie') });
}

function maak(root, commit, env = process.env) {
  const status = leesProductiestatus(commit, root);
  const isNative = status.artifactSoort === 'native';
  const approver = String(env.RTG_PROMOTION_APPROVER || '').trim();
  const ticket = String(env.RTG_PROMOTION_TICKET || '').trim();
  const bevestiging = String(env.RTG_PROMOTION_CONFIRM || '');
  if (approver.length < 3 || approver.length > 160 || /[\0\r\n]/.test(approver) ||
      ticket.length < 3 || ticket.length > 160 || /[\0\r\n]/.test(ticket))
    throw new Error('Promotie vereist een geldige release-authority en besluitreferentie.');
  /* Een beperkte release (READY_ZONDER_RAIL) vraagt een ANDER bevestigingswoord:
     wie promoveert, typt dat er geen kaartrail is. Het woord voor een volle
     release promoveert een beperkte niet, en omgekeerd. */
  const zonderRail = status.PRODUCTION_STATUS === 'READY_ZONDER_RAIL';
  const verwacht = (zonderRail ? 'PROMOVEER-ZONDER-RAIL-' : 'PROMOVEER-') + commit.slice(0, 12);
  if (bevestiging !== verwacht)
    throw new Error('Expliciete RTG_PROMOTION_CONFIRM voor deze commit ontbreekt (verwacht ' +
      (zonderRail ? 'PROMOVEER-ZONDER-RAIL-' : 'PROMOVEER-') + '<commit12>).');
  const kandidaat = isNative ? require('./native-kandidaat').controleer(root, commit)
    : require('./live-kandidaat').controleer(root, commit);
  if (!isNative) eisKetenbesluit(root, commit, kandidaat, env);
  return { formaat:isNative ? 'rtg-native-promotie-v1' : 'rtg-productie-promotie-v2', ondertekenDomein:trust.ROLES.PROMOTION.domain, gemaakt:new Date().toISOString(),
    commit, release:status.release, goedgekeurdDoor:approver, besluit:ticket,
    productieStand:status.PRODUCTION_STATUS,
    productionStatus:{ pad:'.release/productie-status.json',
      sha256:sha256(leesRegulier(path.join(root, '.release', 'productie-status.json'))),
      bewijsSha256:status.bewijsSha256 },
    kandidaat:isNative ? kandidaat : { image:{ immutable:kandidaat.image.immutable, id:kandidaat.image.id,
      digest:kandidaat.image.digest, bewijsBestandSha256:kandidaat.image.bewijsBestandSha256 },
    backup:{ immutable:kandidaat.backup.immutable, id:kandidaat.backup.id,
      digest:kandidaat.backup.digest, herkomstSha256:kandidaat.backup.herkomstSha256 } },
    bewijzen:bewijskaart(root, status.artifactSoort || 'oci'),
    externeBewijzen:status.externeVrijgave && status.externeVrijgave.bewijsBestanden };
}

function teken(documentBytes, key) { return trust.sign('PROMOTION', documentBytes, key); }

function controleerStructuur(document, commit, status, kaart) {
  const isNative = status.artifactSoort === 'native';
  if (!document || document.formaat !== (isNative ? 'rtg-native-promotie-v1' : 'rtg-productie-promotie-v2') ||
      document.ondertekenDomein !== trust.ROLES.PROMOTION.domain ||
      document.commit !== commit || document.release !== status.release ||
      document.productieStand !== status.PRODUCTION_STATUS ||
      !Number.isFinite(Date.parse(document.gemaakt)) ||
      typeof document.goedgekeurdDoor !== 'string' || document.goedgekeurdDoor.length < 3 ||
      typeof document.besluit !== 'string' || document.besluit.length < 3 ||
      !document.productionStatus || document.productionStatus.pad !== '.release/productie-status.json' ||
      !HASH.test(String(document.productionStatus.sha256 || '')) ||
      document.productionStatus.bewijsSha256 !== status.bewijsSha256 ||
      !(isNative ? require('./native-kandidaat').geldig(document.kandidaat)
        : geldigeKandidaat(document.kandidaat && document.kandidaat.image) &&
          geldigeKandidaat(document.kandidaat && document.kandidaat.backup)) ||
      JSON.stringify(document.bewijzen) !== JSON.stringify(kaart) ||
      JSON.stringify(document.externeBewijzen) !==
        JSON.stringify(status.externeVrijgave && status.externeVrijgave.bewijsBestanden)) return false;
  const statusKandidaat = status.kandidaatVrijgave || {};
  if (isNative) return JSON.stringify(document.kandidaat) === JSON.stringify(statusKandidaat);
  return document.kandidaat.image.immutable === ((statusKandidaat.image || {}).immutable) &&
    document.kandidaat.image.id === ((statusKandidaat.image || {}).id) &&
    document.kandidaat.backup.immutable === ((statusKandidaat.backup || {}).immutable) &&
    document.kandidaat.backup.id === ((statusKandidaat.backup || {}).id);
}

function controleer(root, commit) {
  let documentBytes, signatureBytes, publicBytes, document, key;
  try {
    documentBytes = leesRegulier(path.join(root, REL.document));
    signatureBytes = leesRegulier(path.join(root, REL.handtekening), 1024);
    publicBytes = trust.anchors(root).PROMOTION.bytes;
    document = JSON.parse(documentBytes.toString('utf8'));
    key = crypto.createPublicKey(publicBytes);
  } catch (e) { throw new Error('Ondertekende productiepromotie of vaste promotiesleutel ontbreekt.'); }
  if (key.asymmetricKeyType !== 'ed25519') throw new Error('Vaste promotiesleutel is niet Ed25519.');
  const sigTekst = signatureBytes.toString('ascii').trim();
  const sig = Buffer.from(sigTekst, 'base64');
  if (!/^[A-Za-z0-9+/]{86}==$/.test(sigTekst) || sig.length !== 64 ||
      !trust.verify('PROMOTION', documentBytes, sigTekst, key))
    throw new Error('Productiepromotie heeft geen geldige release-authority-handtekening.');
  const status = leesProductiestatus(commit, root);
  const kaart = bewijskaart(root, status.artifactSoort || 'oci');
  const statusHash = sha256(leesRegulier(path.join(root, '.release', 'productie-status.json')));
  if (!controleerStructuur(document, commit, status, kaart) ||
      document.productionStatus.sha256 !== statusHash)
    throw new Error('Productiepromotie hoort niet exact bij READY, kandidaat en bewijsbytes.');
  return document;
}

function schrijf(root, commit, env = process.env) {
  const document = maak(root, commit, env);
  const bytes = Buffer.from(JSON.stringify(document, null, 2) + '\n');
  const key = trust.authorizedPrivate(root, 'PROMOTION', env);
  fs.mkdirSync(path.join(root, '.release'), { recursive:true, mode:0o700 });
  fs.writeFileSync(path.join(root, REL.document), bytes, { mode:0o600 });
  fs.writeFileSync(path.join(root, REL.handtekening), teken(bytes, key) + '\n', { mode:0o600 });
  controleer(root, commit);
  return document;
}

module.exports = { REL, eisKetenbesluit, sha256, leesRegulier, bewijskaart, maak, teken,
  controleerStructuur, controleer, schrijf };
