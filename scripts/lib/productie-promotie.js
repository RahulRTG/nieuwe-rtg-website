'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { BRONNEN, leesProductiestatus } = require('./productie-vrijgave');

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

function privateKey(env = process.env) {
  const ruw = String(env.RTG_PROMOTION_SIGN_KEY || '');
  if (!ruw) throw new Error('RTG_PROMOTION_SIGN_KEY ontbreekt; alleen release-authority mag promoveren.');
  const pem = ruw.includes('BEGIN') ? ruw : Buffer.from(ruw, 'base64').toString('utf8');
  const key = crypto.createPrivateKey(pem);
  if (key.asymmetricKeyType !== 'ed25519') throw new Error('Promotiesleutel moet Ed25519 zijn.');
  return key;
}

function geldigeKandidaat(k) {
  return !!k && ID.test(String(k.id || '')) && ID.test(String(k.digest || '')) &&
    typeof k.immutable === 'string' && k.immutable.endsWith('@' + k.digest) &&
    HASH.test(String(k.bewijsBestandSha256 || k.herkomstSha256 || ''));
}

function bewijskaart(root) {
  const uit = {};
  for (const [naam, rel] of Object.entries(BRONNEN)) {
    const bytes = leesRegulier(path.join(root, rel));
    uit[naam] = { pad:rel, sha256:sha256(bytes), bytes:bytes.length };
  }
  return uit;
}

function maak(root, commit, env = process.env) {
  const status = leesProductiestatus(commit, root);
  const kandidaat = require('./live-kandidaat').controleer(root, commit);
  const approver = String(env.RTG_PROMOTION_APPROVER || '').trim();
  const ticket = String(env.RTG_PROMOTION_TICKET || '').trim();
  const bevestiging = String(env.RTG_PROMOTION_CONFIRM || '');
  if (approver.length < 3 || approver.length > 160 || /[\0\r\n]/.test(approver) ||
      ticket.length < 3 || ticket.length > 160 || /[\0\r\n]/.test(ticket))
    throw new Error('Promotie vereist een geldige release-authority en besluitreferentie.');
  if (bevestiging !== 'PROMOVEER-' + commit.slice(0, 12))
    throw new Error('Expliciete RTG_PROMOTION_CONFIRM voor deze commit ontbreekt.');
  return { formaat:'rtg-productie-promotie-v1', gemaakt:new Date().toISOString(),
    commit, release:status.release, goedgekeurdDoor:approver, besluit:ticket,
    productionStatus:{ pad:'.release/productie-status.json',
      sha256:sha256(leesRegulier(path.join(root, '.release', 'productie-status.json'))),
      bewijsSha256:status.bewijsSha256 },
    kandidaat:{ image:{ immutable:kandidaat.image.immutable, id:kandidaat.image.id,
      digest:kandidaat.image.digest, bewijsBestandSha256:kandidaat.image.bewijsBestandSha256 },
    backup:{ immutable:kandidaat.backup.immutable, id:kandidaat.backup.id,
      digest:kandidaat.backup.digest, herkomstSha256:kandidaat.backup.herkomstSha256 } },
    bewijzen:bewijskaart(root),
    externeBewijzen:status.externeVrijgave && status.externeVrijgave.bewijsBestanden };
}

function teken(documentBytes, key) { return crypto.sign(null, documentBytes, key).toString('base64'); }

function controleerStructuur(document, commit, status, kaart) {
  if (!document || document.formaat !== 'rtg-productie-promotie-v1' ||
      document.commit !== commit || document.release !== status.release ||
      !Number.isFinite(Date.parse(document.gemaakt)) ||
      typeof document.goedgekeurdDoor !== 'string' || document.goedgekeurdDoor.length < 3 ||
      typeof document.besluit !== 'string' || document.besluit.length < 3 ||
      !document.productionStatus || document.productionStatus.pad !== '.release/productie-status.json' ||
      !HASH.test(String(document.productionStatus.sha256 || '')) ||
      document.productionStatus.bewijsSha256 !== status.bewijsSha256 ||
      !geldigeKandidaat(document.kandidaat && document.kandidaat.image) ||
      !geldigeKandidaat(document.kandidaat && document.kandidaat.backup) ||
      JSON.stringify(document.bewijzen) !== JSON.stringify(kaart) ||
      JSON.stringify(document.externeBewijzen) !==
        JSON.stringify(status.externeVrijgave && status.externeVrijgave.bewijsBestanden)) return false;
  const statusKandidaat = status.kandidaatVrijgave || {};
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
    publicBytes = leesRegulier(path.join(root, REL.sleutel), 16 * 1024);
    document = JSON.parse(documentBytes.toString('utf8'));
    key = crypto.createPublicKey(publicBytes);
  } catch (e) { throw new Error('Ondertekende productiepromotie of vaste promotiesleutel ontbreekt.'); }
  if (key.asymmetricKeyType !== 'ed25519') throw new Error('Vaste promotiesleutel is niet Ed25519.');
  const sigTekst = signatureBytes.toString('ascii').trim();
  const sig = Buffer.from(sigTekst, 'base64');
  if (!/^[A-Za-z0-9+/]{86}==$/.test(sigTekst) || sig.length !== 64 ||
      !crypto.verify(null, documentBytes, key, sig))
    throw new Error('Productiepromotie heeft geen geldige release-authority-handtekening.');
  const status = leesProductiestatus(commit, root);
  const kaart = bewijskaart(root);
  const statusHash = sha256(leesRegulier(path.join(root, '.release', 'productie-status.json')));
  if (!controleerStructuur(document, commit, status, kaart) ||
      document.productionStatus.sha256 !== statusHash)
    throw new Error('Productiepromotie hoort niet exact bij READY, kandidaat en bewijsbytes.');
  return document;
}

function schrijf(root, commit, env = process.env) {
  const document = maak(root, commit, env);
  const bytes = Buffer.from(JSON.stringify(document, null, 2) + '\n');
  const key = privateKey(env);
  const publiek = leesRegulier(path.join(root, REL.sleutel), 16 * 1024);
  const proef = Buffer.from('rtg-promotie-sleutelproef-v1');
  if (!crypto.verify(null, proef, crypto.createPublicKey(publiek), crypto.sign(null, proef, key)))
    throw new Error('RTG_PROMOTION_SIGN_KEY hoort niet bij deploy/promotie-sleutel.pub.');
  fs.mkdirSync(path.join(root, '.release'), { recursive:true, mode:0o700 });
  fs.writeFileSync(path.join(root, REL.document), bytes, { mode:0o600 });
  fs.writeFileSync(path.join(root, REL.handtekening), teken(bytes, key) + '\n', { mode:0o600 });
  controleer(root, commit);
  return document;
}

module.exports = { REL, sha256, leesRegulier, bewijskaart, maak, teken,
  controleerStructuur, controleer, schrijf };
