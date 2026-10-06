'use strict';

/*
 * De externe meetrunner is een vierde, onafhankelijke trust-domain. Zijn
 * handtekening mag niet verdwijnen achter de latere handtekening van de
 * dossierbeoordelaar: ook bij een historische hercontrole laden we exact het
 * gecommitte, versiegebonden runneranker en verifiëren we de oorspronkelijke
 * meetattestatie opnieuw.
 *
 * Een versie komt nooit uit een vrij pad. `v1` betekent uitsluitend
 * deploy/evidence-runner-v1.pub onder de te beoordelen releasebron. Rotatie is
 * dus een expliciete bronwijziging en oude dossiers blijven met hun eigen
 * releasecommit en ankerversie reproduceerbaar.
 */
const crypto = require('node:crypto');
const path = require('node:path');
const trust = require('./release-trust');
const { canon } = require('../kern/bewijsvlak/canon');

const VERSION = /^v[1-9][0-9]{0,3}$/;
const MEASUREMENT_FORMAT = 'rtg-external-measurement-v2';
const REQUEST_FORMAT = 'rtg-external-measurement-request-v2';
const SIGNATURE_DOMAIN = 'RTG:EXTERNAL-MEASUREMENT:v2';

const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

function keurVersie(version) {
  const waarde = String(version || '').trim();
  if (!VERSION.test(waarde)) throw new Error('de runnersleutelversie ontbreekt of is ongeldig');
  return waarde;
}

function relatiefPad(version) {
  return 'deploy/evidence-runner-' + keurVersie(version) + '.pub';
}

function laad(root, version) {
  const versie = keurVersie(version);
  const relatief = relatiefPad(versie);
  let anker;
  try { anker = trust.readPublic(path.join(root, relatief)); }
  catch (e) { throw new Error('het gepinde runner-vertrouwensanker ontbreekt of is ongeldig: ' + relatief); }
  return Object.freeze({ version:versie, relatiefPad:relatief, key:anker.key,
    bytes:anker.bytes, sha256:sha256(anker.bytes) });
}

function payload(measurement) {
  return Buffer.concat([
    Buffer.from(SIGNATURE_DOMAIN + '\0', 'utf8'),
    Buffer.from(canon(measurement), 'utf8')
  ]);
}

function verifieer(measurement, signature, key) {
  try {
    const publicKey = key && key.type === 'public' ? key : crypto.createPublicKey(key);
    if (publicKey.asymmetricKeyType !== 'ed25519' ||
        !/^[A-Za-z0-9+/]{86}==$/.test(String(signature || ''))) return false;
    const sig = Buffer.from(signature, 'base64');
    return sig.length === 64 && crypto.verify(null, payload(measurement), publicKey, sig);
  } catch (e) { return false; }
}

module.exports = { VERSION, MEASUREMENT_FORMAT, REQUEST_FORMAT, SIGNATURE_DOMAIN,
  keurVersie, relatiefPad, laad, payload, verifieer, sha256 };
