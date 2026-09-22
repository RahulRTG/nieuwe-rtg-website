'use strict';

// No keys are supplied by statements. The three fixed repository anchors define
// authority; domain separation additionally prevents cross-protocol replay.
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const ROLES = Object.freeze({
  BUILD: Object.freeze({ domain:'RTG:BUILD:v1', publicFile:'deploy/release-sleutel.pub', secret:'RTG_RELEASE_SIGN_KEY' }),
  EVIDENCE: Object.freeze({ domain:'RTG:EXTERNAL-EVIDENCE:v1', publicFile:'deploy/evidence-sleutel.pub', secret:'RTG_EVIDENCE_SIGN_KEY' }),
  PROMOTION: Object.freeze({ domain:'RTG:PROMOTION:v1', publicFile:'deploy/promotie-sleutel.pub', secret:'RTG_PROMOTION_SIGN_KEY' })
});
function role(name) {
  if (!Object.hasOwn(ROLES, name)) throw new Error('Onbekende release-trustrol.');
  return ROLES[name];
}
function framed(name, bytes) {
  return Buffer.concat([Buffer.from(role(name).domain + '\0', 'utf8'), Buffer.from(bytes)]);
}
function sign(name, bytes, key) {
  if (!key || key.type !== 'private' || key.asymmetricKeyType !== 'ed25519')
    throw new Error('De rolsleutel moet een private Ed25519-sleutel zijn.');
  return crypto.sign(null, framed(name, bytes), key).toString('base64');
}
function verify(name, bytes, signature, key) {
  role(name);
  try {
    const publicKey = key && key.type === 'public' ? key : crypto.createPublicKey(key);
    if (publicKey.asymmetricKeyType !== 'ed25519' || !/^[A-Za-z0-9+/]{86}==$/.test(String(signature || '')))
      return false;
    const sig = Buffer.from(signature, 'base64');
    return sig.length === 64 && crypto.verify(null, framed(name, bytes), publicKey, sig);
  } catch { return false; }
}
function readPublic(file) {
  let fd;
  try {
    const stat = fs.lstatSync(file);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size < 1 || stat.size > 16384) throw new Error();
    fd = fs.openSync(file, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
    const bytes = fs.readFileSync(fd);
    if (bytes.length !== stat.size || fs.fstatSync(fd).size !== stat.size) throw new Error();
    // createPublicKey also accepts a private PEM: reject that before parsing.
    if (!/^-----BEGIN PUBLIC KEY-----\r?\n[A-Za-z0-9+/=\r\n]+\r?\n-----END PUBLIC KEY-----\s*$/.test(bytes.toString('ascii')))
      throw new Error();
    const key = crypto.createPublicKey(bytes);
    if (key.asymmetricKeyType !== 'ed25519') throw new Error();
    return { key, bytes, der:key.export({ type:'spki', format:'der' }) };
  } catch { throw new Error('Publiek Ed25519-vertrouwensanker ontbreekt of is ongeldig: ' + path.basename(file) + '.'); }
  finally { if (fd !== undefined) fs.closeSync(fd); }
}
function anchors(root) {
  const result = {};
  for (const [name, entry] of Object.entries(ROLES)) result[name] = readPublic(path.join(root, entry.publicFile));
  const fingerprints = Object.values(result).map(value => value.der.toString('hex'));
  if (new Set(fingerprints).size !== Object.keys(ROLES).length)
    throw new Error('Build, evidence en promotie vereisen drie verschillende Ed25519-sleutels.');
  return result;
}
function privateKey(name, env) {
  const secret = role(name).secret;
  const value = String((env || process.env)[secret] || '');
  if (!value) throw new Error(secret + ' ontbreekt.');
  try {
    const key = crypto.createPrivateKey(value.includes('BEGIN') ? value : Buffer.from(value, 'base64'));
    if (key.asymmetricKeyType !== 'ed25519') throw new Error();
    return key;
  } catch { throw new Error(secret + ' is geen geldige private Ed25519-sleutel.'); }
}
function authorizedPrivate(root, name, env) {
  const known = anchors(root);
  const key = privateKey(name, env);
  const actual = crypto.createPublicKey(key).export({ type:'spki', format:'der' });
  if (!actual.equals(known[name].der))
    throw new Error(role(name).secret + ' hoort niet bij het vaste vertrouwensanker voor ' + name + '.');
  return key;
}
module.exports = { ROLES, role, framed, sign, verify, readPublic, anchors, privateKey, authorizedPrivate };
