/* ============================================================================
   JWS-verificatie voor de SSO-laag: een ondertekend token van een VREEMDE
   identiteitsprovider controleren, zonder ook maar een dependency.

   Net als webpush.js is dit GEEN eigen cryptografie. We zetten de bekende
   stappen van RFC 7515 op elkaar met Node's standaard-primitieven: RSASSA-
   PKCS1-v1_5 (RS256) en ECDSA op P-256 (ES256), allebei via crypto.verify op
   een sleutel die rechtstreeks uit de JWK van de provider komt.

   DRIE VALKUILEN DIE HIER MET OPZET DICHTSTAAN

   1. ALGORITME-VERWARRING. Een token draagt ZELF zijn `alg` mee. Wie dat
      klakkeloos overneemt, accepteert ook `alg: "none"` (helemaal geen
      handtekening) of `alg: "HS256"` -- en dan zou de verificatie de PUBLIEKE
      sleutel van de provider als HMAC-geheim gebruiken. Die sleutel is publiek.
      Iedereen kan er dan een geldig token mee bakken en als wie dan ook
      binnenkomen. Daarom staat hier een VASTE lijst van twee algoritmen; alles
      daarbuiten gaat eruit, ook als de provider het aanbiedt.

   2. DE HANDTEKENING KLOPT -- MAAR VAN WIE, EN VOOR WIE? Een geldige
      handtekening bewijst alleen dat IEMAND met een sleutel heeft getekend.
      Zonder controle op `iss` (wie beweert dit) en `aud` (voor wie is het
      bedoeld) is een token dat een ANDERE klant bij dezelfde provider kreeg,
      hier net zo geldig. Bij de grote providers zit iedereen bij dezelfde
      provider, dus dit is geen theorie.

   3. TOKENS VERLOPEN. `exp` en `nbf` moeten gecontroleerd worden, met een
      kleine klokspeling omdat servers nooit precies gelijklopen -- maar een
      kleine, want elke seconde speling is een seconde waarin een gestolen
      token nog werkt.
   ========================================================================== */
'use strict';
const crypto = require('crypto');

/* De witte lijst. Twee algoritmen, allebei asymmetrisch. Geen HMAC-varianten
   (zie valkuil 1), geen 'none', en geen 'alg' die we uit het token overnemen. */
const ALGORITMEN = {
  RS256: { hash: 'sha256', opties: null, kty: 'RSA' },
  ES256: { hash: 'sha256', opties: { dsaEncoding: 'ieee-p1363' }, kty: 'EC' }
};
const KLOKSPELING_MS = 60000; // een minuut; servers lopen nooit precies gelijk

const vanB64 = (s) => Buffer.from(String(s), 'base64url');
function leesDeel(s) { return JSON.parse(vanB64(s).toString('utf8')); }

/* De drie stukken uit elkaar halen zonder ook maar iets te geloven. */
function ontleed(token) {
  const delen = String(token || '').split('.');
  if (delen.length !== 3) throw new Error('Token heeft niet de drie delen van een JWS.');
  let kop, claims;
  try { kop = leesDeel(delen[0]); } catch (e) { throw new Error('Tokenkop is geen geldige JSON.'); }
  try { claims = leesDeel(delen[1]); } catch (e) { throw new Error('Tokeninhoud is geen geldige JSON.'); }
  if (!kop || typeof kop !== 'object' || !claims || typeof claims !== 'object')
    throw new Error('Tokenkop of -inhoud is geen object.');
  return { kop, claims, tekenStuk: delen[0] + '.' + delen[1], handtekening: vanB64(delen[2]) };
}

/* De juiste sleutel uit de sleutelbos van de provider. Op `kid` als het token
   er een noemt; anders alleen als er precies een sleutel is die past. Bij twijfel
   weigeren we -- "probeer ze allemaal" is hoe je per ongeluk een uitgefaseerde
   sleutel weer geldig maakt. */
function kiesSleutel(jwks, kop) {
  const lijst = (jwks && Array.isArray(jwks.keys) ? jwks.keys : []).filter(k => k && (!k.use || k.use === 'sig'));
  if (!lijst.length) throw new Error('De sleutelbos van de provider is leeg.');
  if (kop.kid) {
    const treffer = lijst.filter(k => k.kid === kop.kid);
    if (!treffer.length) { const e = new Error('Onbekende sleutel-id (kid) in het token.'); e.onbekendeKid = true; throw e; }
    return treffer[0];
  }
  const past = lijst.filter(k => k.kty === (ALGORITMEN[kop.alg] || {}).kty);
  if (past.length !== 1) throw new Error('Token noemt geen kid en de sleutelbos is niet eenduidig.');
  return past[0];
}

/* ---------- de eigenlijke verificatie ----------

   Volgorde is met opzet: eerst het algoritme (anders bepaalt de aanvaller welke
   controle we doen), dan de handtekening, dan pas de inhoud. Een claim uit een
   token met een ongeldige handtekening is geen claim maar een wens. */
function verifieer(token, jwks, eisen) {
  const e = eisen || {};
  const { kop, claims, tekenStuk, handtekening } = ontleed(token);

  const spec = ALGORITMEN[kop.alg];
  if (!spec) throw new Error('Weigeren: algoritme "' + String(kop.alg) + '" staat niet op de lijst (alleen RS256 en ES256).');

  const jwk = kiesSleutel(jwks, kop);
  if (jwk.kty !== spec.kty) throw new Error('De sleutel past niet bij het opgegeven algoritme.');
  if (jwk.alg && jwk.alg !== kop.alg) throw new Error('De provider zegt zelf dat deze sleutel voor een ander algoritme is.');

  let sleutel;
  try { sleutel = crypto.createPublicKey({ format: 'jwk', key: jwk }); }
  catch (err) { throw new Error('De sleutel van de provider is niet te lezen.'); }

  const arg = spec.opties ? Object.assign({ key: sleutel }, spec.opties) : sleutel;
  if (!crypto.verify(spec.hash, Buffer.from(tekenStuk), arg, handtekening))
    throw new Error('De handtekening klopt niet.');

  /* Pas hier mogen we de inhoud geloven. */
  const nu = Date.now();
  if (e.iss !== undefined && claims.iss !== e.iss)
    throw new Error('Het token komt van een andere uitgever dan de koppeling verwacht.');
  /* `aud` mag een lijst zijn. Staat onze client-id er niet in, dan is dit token
     voor iemand anders bedoeld -- ook als het echt van onze provider komt. */
  if (e.aud !== undefined) {
    const aud = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
    if (!aud.includes(e.aud)) throw new Error('Het token is niet voor ons bestemd.');
    /* Zijn er meer ontvangers, dan MOET azp zeggen dat wij de partij zijn die
       hem heeft aangevraagd (OIDC 3.1.3.7). Anders kan een andere ontvanger het
       token bij ons inleveren. */
    if (aud.length > 1 && claims.azp && claims.azp !== e.aud)
      throw new Error('Het token is bij een andere partij aangevraagd.');
  }
  if (claims.exp === undefined) throw new Error('Het token zegt niet wanneer het verloopt.');
  if (Number(claims.exp) * 1000 + KLOKSPELING_MS < nu) throw new Error('Het token is verlopen.');
  if (claims.nbf !== undefined && Number(claims.nbf) * 1000 - KLOKSPELING_MS > nu)
    throw new Error('Het token is nog niet geldig.');
  /* De nonce koppelt dit token aan ONZE aanvraag. Zonder die controle kan een
     token dat elders is opgevangen hier opnieuw worden ingeleverd. */
  if (e.nonce !== undefined && claims.nonce !== e.nonce)
    throw new Error('De nonce hoort niet bij deze inlogpoging.');
  if (!claims.sub) throw new Error('Het token noemt geen onderwerp (sub).');

  return claims;
}

module.exports = { verifieer, ontleed, ALGORITMEN, KLOKSPELING_MS };
