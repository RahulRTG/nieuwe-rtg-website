/* ============================================================================
   TOESTELSLEUTELS -- de pure cryptografie, zonder opslag.

   Afgesplitst van ./toestellen.js op dezelfde naad als accounts/intreklijst.js
   ooit van accounts/tokens.js: al het andere daar schrijft naar de database,
   dit rekent alleen. Twee soorten werk met heel verschillende faalwijzen -- een
   rekenfout hier is een handtekening die niet klopt, een fout daar is een
   ingetrokken toestel dat toch nog tekent.

   Er staat hier geen enkele opslag en geen enkele lidsleutel: dit bestand weet
   niet van wie een sleutel is, alleen of hij klopt.
   ========================================================================== */
'use strict';

const { webcrypto, createHash } = require('crypto');

const ALG = { name: 'ECDSA', namedCurve: 'P-256' };
const TEKEN = { name: 'ECDSA', hash: 'SHA-256' };

/* De toestelId is een AFGELEIDE van de publieke sleutel en geen los nummer.
   Daardoor kan een toestel zijn eigen id niet kiezen: wie een andere id wil,
   heeft een andere sleutel nodig, en dan is hij ook echt een ander toestel. */
function idVan(jwk) {
return createHash('sha256')
    .update(JSON.stringify({ kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y }))
    .digest('hex').slice(0, 32);
}
function schoneJwk(j) {
if (!j || typeof j !== 'object') return null;
if (j.kty !== 'EC' || j.crv !== 'P-256') return null;
if (typeof j.x !== 'string' || typeof j.y !== 'string') return null;
if (j.x.length > 64 || j.y.length > 64) return null;
if (j.d !== undefined) return null;   // een PRIVATE sleutel hoort hier nooit binnen te komen
return { kty: 'EC', crv: 'P-256', x: j.x, y: j.y, ext: true };
}

/* De handtekening nakijken. Geeft ALLEEN true of false terug: wat er misging
   hoort de aanbieder niet te weten, want dat is precies de informatie waarmee
   je een handtekening kunt bijschaven. */
async function klopt(jwk, tekst, handtekening) {
try {
    const pub = await webcrypto.subtle.importKey('jwk', jwk, ALG, false, ['verify']);
    return await webcrypto.subtle.verify(TEKEN, pub, handtekening, Buffer.from(tekst, 'utf8'));
} catch (e) { return false; }
}

module.exports = { idVan, schoneJwk, klopt, ALG, TEKEN };
