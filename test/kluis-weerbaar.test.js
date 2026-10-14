/* DE IDENTITEITSKLUIS, AANGEVALLEN (accounts/kluis.js).

   De kluis is waarom een codenaam een codenaam blijft: naam, e-mail en telefoon
   staan versleuteld (AES-256-GCM, met de VAULT-sleutel), het opzoeken gaat via
   een HMAC-zoekhash in plaats van het adres zelf, en elke handtekening onder
   een token komt hier vandaan -- de sessiesleutel zelf of een met HKDF
   afgeleide sleutel per doel. Deze toets bestookt die laag zoals een indringer
   met de database in handen dat zou doen: bits omdraaien in de ciphertext, een
   blob onder de verkeerde sleutel openen, de markering weghalen, de zoekhash
   proberen terug te rekenen, en een lege sleutel of leeg doel aanbieden in de
   hoop op een vaste handtekening.

   Wat hier niet mag sneuvelen:
   1. een blob die is gewijzigd (ciphertext, IV of authenticatietag), afgekapt,
      of onder een andere sleutel is gezegeld, opent NIET: dec geeft null en
      nooit een half of verkeerd ontsleutelde naam;
   2. dezelfde naam twee keer versleuteld geeft twee verschillende blobs (een
      verse IV), en de blob bevat de naam niet;
   3. een gemarkeerd veld onder een verkeerde sleutel geeft null, niet de
      ruwe blob; alleen een ONgemarkeerd (oud) veld komt als platte tekst terug;
   4. de zoekhash is ongevoelig voor hoofdletters en witruimte, hangt aan de
      kluissleutel (een andere sleutel, een andere hash) en bevat het adres niet;
      telefoonnummers in elke schrijfwijze landen op dezelfde hash;
   5. een lege sleutel of een leeg doel geeft GEEN handtekening en GEEN sleutel
      (fail-closed), en verschillende doelen geven verschillende sleutels;
   6. de zaai-hash bestaat alleen in de testomgeving;
   7. een codenaam verraadt niets: hij komt uit de vaste lijst plus vier hex.

   MUTATIES die zijn gedraaid en welke toets erop zakte (LAT.md regel 2):
   - in dec `d.setAuthTag(buf.subarray(12, 28));` weggehaald -> "1. een
     gewijzigde blob opent niet" ZAKT (RAAK): zonder tag faalt final() niet op
     een omgedraaide bit, maar geeft hij een verminkte naam terug.
   - in signMet de regel `if (!sleutel || ...) return null;` weggehaald
     -> "5. een lege sleutel geeft geen handtekening" ZAKT (RAAK).
   - in emailHash `.trim().toLowerCase()` weggehaald -> "4. de zoekhash"
     ZAKT (RAAK).

   Draai: node --test test/kluis-weerbaar.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const S = require('../server/accounts/state');
const kluis = require('../server/accounts/kluis');

const oud = { SECRET: S.SECRET, VAULT: S.VAULT, omg: Object.assign({}, process.env) };
test.beforeEach(() => { S.VAULT = crypto.randomBytes(32); S.SECRET = crypto.randomBytes(32); });
test.afterEach(() => {
  S.VAULT = oud.VAULT; S.SECRET = oud.SECRET;
  for (const k of Object.keys(process.env)) if (!(k in oud.omg)) delete process.env[k];
  Object.assign(process.env, oud.omg);
});

const NAAM = 'Johanna van der Berg-Ïjsselstein';

test('1. een gewijzigde, afgekapte of verkeerd gesleutelde blob opent niet', () => {
  const blob = kluis.enc(NAAM);
  assert.equal(kluis.dec(blob), NAAM, 'de echte blob opent');
  const buf = Buffer.from(blob, 'base64');
  assert.ok(buf.length > 28, 'iv(12) + tag(16) + ciphertext');
  for (const plek of [0, 11, 12, 27, 28, buf.length - 1]) {
    const kapot = Buffer.from(buf); kapot[plek] ^= 0x01;
    assert.equal(kluis.dec(kapot.toString('base64')), null, 'een omgedraaide bit op plek ' + plek + ' opent niet');
  }
  assert.equal(kluis.dec(buf.subarray(0, 20).toString('base64')), null, 'afgekapt in de tag');
  assert.equal(kluis.dec(buf.subarray(0, buf.length - 1).toString('base64')), null, 'een byte ciphertext minder');
  assert.equal(kluis.dec('dit is geen base64 !!'), null);
  const andereSleutel = S.VAULT; S.VAULT = crypto.randomBytes(32);
  assert.equal(kluis.dec(blob), null, 'onder een andere sleutel opent niets');
  S.VAULT = andereSleutel;
  assert.equal(kluis.dec(blob), NAAM, 'met de goede sleutel weer wel');
  assert.equal(kluis.dec(''), null);
  assert.equal(kluis.dec(null), null);
  assert.equal(kluis.dec(undefined), null);
});

test('2. dezelfde naam twee keer versleuteld geeft twee blobs zonder de naam erin', () => {
  const a = kluis.enc(NAAM), b = kluis.enc(NAAM);
  assert.notEqual(a, b, 'een verse IV per zegel');
  assert.notEqual(a.slice(0, 16), b.slice(0, 16));
  for (const blob of [a, b]) {
    assert.ok(!blob.includes('Johanna'));
    assert.ok(!Buffer.from(blob, 'base64').toString('latin1').includes('Johanna'));
  }
  assert.equal(kluis.enc(null), null);
  assert.equal(kluis.enc(undefined), null);
  assert.equal(kluis.dec(kluis.enc('')), '', 'een lege tekst komt als lege tekst terug, niet als ontbreken');
  assert.equal(kluis.dec(kluis.enc(12345)), '12345', 'getallen worden tekst');
  assert.equal(kluis.dec(kluis.enc('漢字 🔐')), '漢字 🔐', 'utf-8 blijft heel');
  // zonder sleutel kan er niet gezegeld worden: luid, geen stille platte tekst
  S.VAULT = null;
  assert.throws(() => kluis.enc(NAAM));
});

test('3. een gemarkeerd veld onder een verkeerde sleutel geeft null, een oud veld platte tekst', () => {
  const veld = kluis.encVeld(NAAM);
  assert.ok(veld.startsWith('RTGV1:'));
  assert.ok(!veld.includes('Johanna'));
  assert.equal(kluis.decVeld(veld), NAAM);
  assert.equal(kluis.decVeld('nog platte tekst'), 'nog platte tekst', 'ongemigreerd veld blijft leesbaar');
  assert.equal(kluis.decVeld(42), '42');
  assert.equal(kluis.decVeld(null), null);
  assert.equal(kluis.decVeld(undefined), null);
  assert.equal(kluis.encVeld(null), null);
  assert.equal(kluis.encVeld(undefined), null);
  assert.equal(kluis.decVeld(kluis.encVeld(0)), '0', 'nul is een waarde en geen ontbreken');
  S.VAULT = crypto.randomBytes(32);
  assert.equal(kluis.decVeld(veld), null, 'nooit de ruwe blob teruggeven als "platte tekst"');
  assert.equal(kluis.decVeld('RTGV1:'), null, 'een lege markering is geen tekst');
  assert.equal(kluis.decVeld('RTGV1:geknoei'), null);
});

test('4. de zoekhash: ongevoelig voor schrijfwijze, gebonden aan de sleutel, zonder het adres', () => {
  const h = kluis.emailHash('Lid@Voorbeeld.nl');
  assert.match(h, /^[a-f0-9]{64}$/);
  assert.equal(kluis.emailHash('  lid@voorbeeld.NL \n'), h);
  assert.notEqual(kluis.emailHash('ander@voorbeeld.nl'), h);
  assert.ok(!h.includes('voorbeeld'));
  assert.notEqual(h, crypto.createHash('sha256').update('lid@voorbeeld.nl').digest('hex'),
    'geen kale sha256: zonder kluissleutel valt hij niet na te rekenen');
  assert.equal(kluis.emailHash(null), kluis.emailHash(''), 'ontbreken is een lege string, geen crash');
  S.VAULT = crypto.randomBytes(32);
  assert.notEqual(kluis.emailHash('lid@voorbeeld.nl'), h, 'een andere sleutel, een andere hash');

  const vormen = ['06-12345678', '+31 6 1234 5678', '0031612345678', '(06) 123 456 78', '31612345678'];
  const ph = vormen.map(kluis.phoneHash);
  assert.equal(new Set(ph).size, 1, 'elke schrijfwijze landt op hetzelfde account');
  assert.equal(kluis.normalizePhone('06-12345678'), '31612345678');
  assert.equal(kluis.normalizePhone('0049 30 123456'), '4930123456');
  assert.equal(kluis.normalizePhone('12345'), '12345', 'te kort voor een landcode: blijft wat het is');
  assert.equal(kluis.normalizePhone(null), '');
  assert.equal(kluis.phoneHash(''), null, 'geen nummer, geen hash (en zeker niet de hash van leeg)');
  assert.equal(kluis.phoneHash('geen cijfers'), null);
  assert.notEqual(kluis.phoneHash('+49 30 123456'), ph[0]);
});

test('5. een lege sleutel of leeg doel geeft geen handtekening en geen sleutel', () => {
  const sleutel = kluis.sleutelVoor('actie:verify-email');
  assert.ok(Buffer.isBuffer(sleutel) && sleutel.length === 32);
  assert.notDeepEqual(kluis.sleutelVoor('actie:2fa'), sleutel, 'ander doel, andere sleutel');
  assert.deepEqual(kluis.sleutelVoor('actie:verify-email'), sleutel, 'deterministisch per doel');
  assert.notDeepEqual(sleutel, S.SECRET, 'nooit de sessiesleutel zelf');
  assert.equal(kluis.sleutelVoor(''), null);
  assert.equal(kluis.sleutelVoor('   '), null, 'alleen witruimte is geen doel');
  assert.equal(kluis.sleutelVoor(), null);
  assert.equal(kluis.afleidSleutel(null, 'x'), null);
  assert.equal(kluis.afleidSleutel(Buffer.alloc(0), 'x'), null, 'een lege buffer is geen sleutel');
  assert.equal(kluis.afleidSleutel('', 'x'), null);
  assert.deepEqual(kluis.afleidSleutel('tekstsleutel', 'x'), kluis.afleidSleutel(Buffer.from('tekstsleutel'), 'x'),
    'een tekstsleutel en dezelfde bytes als buffer geven dezelfde afleiding');
  S.SECRET = null;
  assert.equal(kluis.sleutelVoor('actie:x'), null, 'zonder kluis geen afgeleide sleutel');

  assert.equal(kluis.signMet(null, 'body'), null);
  assert.equal(kluis.signMet(Buffer.alloc(0), 'body'), null);
  assert.equal(kluis.signMet('', 'body'), null);
  const s1 = kluis.signMet(sleutel, 'body');
  assert.match(s1, /^[a-f0-9]{32}$/);
  assert.notEqual(kluis.signMet(kluis.afleidSleutel(Buffer.alloc(32, 1), 'actie:2fa'), 'body'), s1);
  assert.equal(kluis.signMet(sleutel, 12), kluis.signMet(sleutel, '12'), 'de body wordt als tekst getekend');

  S.SECRET = crypto.randomBytes(32);
  const sig = kluis.sign('7.123.1');
  assert.match(sig, /^[a-f0-9]{32}$/);
  assert.notEqual(kluis.sign('7.123.2'), sig);
  S.SECRET = crypto.randomBytes(32);
  assert.notEqual(kluis.sign('7.123.1'), sig, 'een andere sessiesleutel tekent anders');
});

test('6. de zaai-hash bestaat alleen in de testomgeving', () => {
  const testomgeving = require('../server/testomgeving');
  const echt = testomgeving.actief;
  testomgeving.actief = () => false;
  try {
    assert.throws(() => kluis.zaaiHash('demo'), /alleen in Magnaat Test/);
  } finally { testomgeving.actief = echt; }
});

test('7. een codenaam komt uit de vaste lijst plus vier hex en verraadt niets', () => {
  const gezien = new Set();
  for (let i = 0; i < 40; i++) {
    const c = kluis.makeCodename();
    const m = /^(.+) ([0-9A-F]{4})$/.exec(c);
    assert.ok(m, c);
    assert.ok(kluis.CODENAMES.includes(m[1]), 'uit de lijst: ' + m[1]);
    gezien.add(c);
  }
  assert.ok(gezien.size > 30, 'niet steeds dezelfde');
});
