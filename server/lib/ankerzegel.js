/* De handtekening onder het ankerblok (./ankerdienst.js). Geknipt uit dat
   bestand (keuringsregel 13); het WAAROM staat hieronder. */
'use strict';

const crypto = require('crypto');

/* ---------------------------------------------------------------------------
   DE HANDTEKENING (audit P1-3a). Hier stond als enige bescherming `zegel`: een
   kale sha256 over het blok, zonder sleutel. Wie het blok kon wijzigen, kon de
   zegel gewoon opnieuw uitrekenen. Een ankerblok dat terugkomt van de tweede
   machine moet aantoonbaar van DEZE installatie komen; anders schuift een
   aanvaller er een eigen blok onder dat bij zijn herschreven journaal past.

   Ed25519, met een sleutel die NIET in de database staat: RTG_ANKER_SIGN_KEY
   (32 bytes, hex of base64) als die gezet is, en anders afgeleid uit het
   procesgeheim via HKDF met een eigen doel (accounts.sleutelVoor, zie
   accounts/kluis.js -- dezelfde domeinscheiding als het bewijstoken). De
   publieke sleutel gaat mee in het blok, zodat een ontvanger kan nagaan dat
   hij een blok van ons kreeg; bij het TERUGLEZEN telt alleen onze eigen
   publieke sleutel en nooit die in het blok -- anders tekent een vervalser
   zichzelf. */
const PKCS8_ED25519 = Buffer.from('302e020100300506032b657004220420', 'hex');
const DOEL = 'ankerblok-ed25519-v1';

function zaadUit(waarde) {
  const t = String(waarde || '').trim();
  if (!t) return null;
  const b = /^[0-9a-f]{64}$/i.test(t) ? Buffer.from(t, 'hex') : Buffer.from(t, 'base64');
  return b.length === 32 ? b : null;
}

function sleutelpaar(zaad) {
  if (!Buffer.isBuffer(zaad) || zaad.length < 32) return null;
  const prive = crypto.createPrivateKey({ key: Buffer.concat([PKCS8_ED25519, zaad.subarray(0, 32)]),
    format: 'der', type: 'pkcs8' });
  const publiek = crypto.createPublicKey(prive);
  const ruw = publiek.export({ format: 'der', type: 'spki' }).subarray(-32);
  return { prive, publiek, publiekB64: ruw.toString('base64'),
    sleutelId: crypto.createHash('sha256').update(ruw).digest('hex').slice(0, 16) };
}

/* Wat er getekend wordt: sleutels gesorteerd, zodat een ontvanger die de
   velden in een andere volgorde terugstuurt de handtekening niet breekt. */
function kanoniek(v) {
  if (Array.isArray(v)) return '[' + v.map(kanoniek).join(',') + ']';
  if (v && typeof v === 'object')
    return '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + kanoniek(v[k])).join(',') + '}';
  return JSON.stringify(v === undefined ? null : v);
}
const teTekenen = (b) => Buffer.from(kanoniek({ at: b.at, punten: b.punten, zegel: b.zegel }), 'utf8');

module.exports = { zaadUit, sleutelpaar, kanoniek, teTekenen, DOEL };
