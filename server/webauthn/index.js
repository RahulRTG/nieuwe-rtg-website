/* Eigen WebAuthn-verificatie, i.p.v. het pakket @simplewebauthn/server.

   Let op de nuance bij regel 1 (docs/de-lijn.md): we schrijven hier GEEN eigen
   cryptografie. We zetten alleen de bekende WebAuthn-protocolstappen op elkaar met
   Node's standaard-primitieven -- SHA-256 en handtekeningverificatie (ECDSA P-256,
   RSA PKCS#1v1.5, Ed25519) -- allemaal uit `node:crypto`. Het enige echt "eigen"
   stuk is een kleine CBOR-lezer voor het attestationObject en de COSE-sleutel; dat
   is puur decoderen van een binair formaat, geen crypto.

   Scope: attestationType 'none' (wij vragen geen attestatie op -- we willen niet
   weten welk merk authenticator iemand gebruikt). Er is dus geen attestatie-
   handtekening te controleren; we verifieren de identiteit bij het INLOGGEN via de
   assertion-handtekening over de opgeslagen publieke sleutel. Dat is de kant die
   telt: registratie legt de publieke sleutel vast, login bewijst het bezit ervan.

   Zelfde vorm en veldnamen als het pakket, zodat server/kern/webauthn.js niets
   merkt: generateRegistrationOptions, verifyRegistrationResponse,
   generateAuthenticationOptions, verifyAuthenticationResponse. */
'use strict';
const crypto = require('crypto');
const { b64u, vanB64u, sha256, gelijk, cborLees, ontleedAuthData, coseNaarSleutel, verifieerHandtekening } = require('./cbor');

function controleerClientData(clientDataJSON, verwachtType, verwachteChallenge, verwachteOrigin) {
  let c;
  try { c = JSON.parse(vanB64u(clientDataJSON).toString('utf8')); }
  catch (e) { throw new Error('clientDataJSON is geen geldige JSON'); }
  if (c.type !== verwachtType) throw new Error('clientData.type klopt niet (' + c.type + ')');
  if (!gelijk(Buffer.from(String(c.challenge)), Buffer.from(String(verwachteChallenge))))
    throw new Error('challenge komt niet overeen');
  if (c.origin !== verwachteOrigin) throw new Error('origin komt niet overeen (' + c.origin + ')');
  return c;
}

/* ================= publieke API (zelfde vorm als @simplewebauthn) ================= */

const PUB_KEY_PARAMS = [                              // volgorde als het pakket: EdDSA, ES256, RS256
  { alg: -8, type: 'public-key' },
  { alg: -7, type: 'public-key' },
  { alg: -257, type: 'public-key' }
];

function generateRegistrationOptions(opts) {
  const challenge = b64u(crypto.randomBytes(32));
  return {
    challenge,
    rp: { name: opts.rpName, id: opts.rpID },
    user: { id: b64u(opts.userID), name: opts.userName, displayName: opts.userName },
    pubKeyCredParams: PUB_KEY_PARAMS,
    timeout: 60000,
    attestation: opts.attestationType || 'none',
    excludeCredentials: (opts.excludeCredentials || []).map(c => ({
      id: c.id, type: 'public-key', transports: c.transports })),
    authenticatorSelection: opts.authenticatorSelection || { residentKey: 'preferred', userVerification: 'preferred' },
    extensions: { credProps: true }
  };
}

function generateAuthenticationOptions(opts) {
  return {
    challenge: b64u(crypto.randomBytes(32)),
    timeout: 60000,
    rpId: opts.rpID,
    userVerification: opts.userVerification || 'preferred',
    allowCredentials: (opts.allowCredentials || []).map(c => ({
      id: c.id, type: 'public-key', transports: c.transports }))
  };
}

function verifyRegistrationResponse({ response, expectedChallenge, expectedOrigin, expectedRPID }) {
  const resp = response && response.response;
  if (!resp || !resp.clientDataJSON || !resp.attestationObject) throw new Error('onvolledig registratie-antwoord');
  controleerClientData(resp.clientDataJSON, 'webauthn.create', expectedChallenge, expectedOrigin);

  const att = cborLees(vanB64u(resp.attestationObject), 0).waarde;
  if (!(att instanceof Map)) throw new Error('attestationObject: geen map');
  const fmt = att.get('fmt');
  const authData = ontleedAuthData(Buffer.from(att.get('authData')));

  if (!gelijk(authData.rpIdHash, sha256(Buffer.from(expectedRPID, 'utf8'))))
    throw new Error('rpIdHash komt niet overeen met de verwachte RP-ID');
  if (!authData.up) throw new Error('user-present-vlag ontbreekt');
  if (!authData.at || !authData.credentialId || !authData.credentialPublicKey)
    throw new Error('geen credential in authenticatorData');

  // fmt 'none': geen attestatie-handtekening. Andere formaten steunen we (nog) niet.
  if (fmt !== 'none') throw new Error('attestatieformaat ' + fmt + ' wordt niet ondersteund (verwacht: none)');
  // sanity: de COSE-sleutel moet bruikbaar zijn (gooit anders)
  coseNaarSleutel(authData.credentialPublicKey);

  return {
    verified: true,
    registrationInfo: {
      fmt,
      credential: {
        id: b64u(authData.credentialId),
        publicKey: new Uint8Array(authData.credentialPublicKey),
        counter: authData.signCount,
        transports: (resp.transports || [])
      },
      credentialDeviceType: authData.be ? 'multiDevice' : 'singleDevice',
      credentialBackedUp: authData.bs
    }
  };
}

function verifyAuthenticationResponse({ response, expectedChallenge, expectedOrigin, expectedRPID, credential }) {
  const resp = response && response.response;
  if (!resp || !resp.clientDataJSON || !resp.authenticatorData || !resp.signature)
    throw new Error('onvolledig login-antwoord');
  controleerClientData(resp.clientDataJSON, 'webauthn.get', expectedChallenge, expectedOrigin);

  const authDataBuf = vanB64u(resp.authenticatorData);
  const authData = ontleedAuthData(authDataBuf);
  if (!gelijk(authData.rpIdHash, sha256(Buffer.from(expectedRPID, 'utf8'))))
    throw new Error('rpIdHash komt niet overeen met de verwachte RP-ID');
  if (!authData.up) throw new Error('user-present-vlag ontbreekt');

  // ondertekend wordt: authenticatorData || sha256(clientDataJSON)
  const data = Buffer.concat([authDataBuf, sha256(vanB64u(resp.clientDataJSON))]);
  const cose = Buffer.from(credential.publicKey);
  if (!verifieerHandtekening(cose, data, vanB64u(resp.signature)))
    throw new Error('handtekening klopt niet');

  // teller-regressie: een gekloonde sleutel valt op doordat de teller terugloopt
  const oud = credential.counter || 0;
  const nieuw = authData.signCount;
  if ((oud > 0 || nieuw > 0) && nieuw <= oud && nieuw !== 0)
    throw new Error('teller liep terug (mogelijk gekloonde sleutel)');

  return { verified: true, authenticationInfo: { newCounter: nieuw, credentialDeviceType: authData.be ? 'multiDevice' : 'singleDevice', credentialBackedUp: authData.bs } };
}


module.exports = {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
  // hulpstukken (voor tests / hergebruik)
  _cborLees: cborLees, _ontleedAuthData: ontleedAuthData, _coseNaarSleutel: coseNaarSleutel
};
