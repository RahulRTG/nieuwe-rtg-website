/* Ondertekenen van een manifestregel voor de toestelrekenlaag (TOESTEL.md
   par. 9.3). OFFLINE gereedschap: het draait bij een mens, met een private
   sleutel die niet in de repo en niet op een server woont. De server en de
   browser controleren alleen; tekenen doen ze nooit.

   De bytes die getekend worden komen uit public/shared/toestel/manifest.js
   (`tekst`) en niet uit een tweede kopie hier: twee kanten die elk hun eigen
   canonieke vorm hebben, tekenen en controleren binnen een jaar iets anders. */
'use strict';
const crypto = require('node:crypto');
const Manifest = require('../../public/shared/toestel/manifest.js');

function nieuweSleutel(id) {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  const raw = publicKey.export({ format: 'jwk' }).x; // base64url van de 32 bytes
  const publiek = Buffer.from(raw, 'base64url').toString('base64');
  return { id, publiek, privateKey };
}

function teken(regel, sleutel, privateKey) {
  if (!Manifest.magTekenen(sleutel))
    throw new Error('Met de sleutel ' + (sleutel && sleutel.id) + ' mag niet meer worden getekend (stand ' +
      (sleutel && sleutel.stand) + ').');
  const r = Object.assign({}, regel, { sleutel: sleutel.id });
  delete r.handtekening;
  const sig = crypto.sign(null, Buffer.from(Manifest.tekst(r), 'utf8'), privateKey);
  return Object.assign(r, { handtekening: sig.toString('base64') });
}

function sha256(buf) { return crypto.createHash('sha256').update(buf).digest('hex'); }

module.exports = { nieuweSleutel, teken, sha256 };
