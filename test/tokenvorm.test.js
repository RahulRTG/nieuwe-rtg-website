/* UITLOGGEN MAG NIET MET EEN ENKEL TEKEN TE OMZEILEN ZIJN.

   DE BUG DIE DEZE TOETS BEWAAKT staat in de kop van server/accounts/tokens.js en
   is subtiel genoeg om twee keer gemaakt te worden. Een sessietoken is hier
   staatloos, dus uitloggen kan niets weggooien; daarvoor is er een INTREKLIJST
   die `kluis.sign(<de rauwe tokenstring>)` bewaart, en die is byte-exact.

   Maar `Buffer.from(x, 'base64url')` NEGEERT elk teken dat niet in het alfabet
   zit. Een spatie voor het token decodeert dus naar precies dezelfde bytes, de
   handtekening klopt gewoon -- terwijl de intreklijst die string niet herkent.
   Uitloggen, en daarna hetzelfde token met een spatie ervoor opsturen: binnen.

   De oplossing was niet nog een normalisatie erbij (dan blijven er vormen over
   die de een wel en de ander niet ziet) maar EEN strikte vorm: wat er niet
   exact uitziet zoals wij het uitgeven, is geen token. Fail closed.

   WAAROM DEZE TOETS ER PAS NU IS. De sabotagemotor (scripts/sabotage.js) zette
   TOKENVORM om naar /^[\s\S]+$/ -- de handhaver dus helemaal uit -- en er werd
   niets rood. accounts.test.js toetst wel `token + 'x'` en `'onzin'`, maar die
   twee vallen af op de HANDTEKENING en niet op de vorm; ze blijven dus groen als
   de vormcontrole verdwijnt. De precieze fout waarvoor die controle is gebouwd,
   had geen enkele toets. Dit is wet RTG-003.

   Draai los: node --experimental-sqlite --test test/tokenvorm.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-tokenvorm-'));
process.env.RTG_DATA_DIR = TMP;
const accounts = require('../server/accounts');
accounts.init();

test.after(() => { try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });

async function lidMetToken() {
  const naam = 'vorm' + Math.floor(Date.now() % 1e6);
  const u = await accounts.createUser({ username: naam, email: naam + '@rtg.example',
    password: 'geheim123', tier: 'rtg', realName: 'Vorm Proef' });
  return { u, token: accounts.issueToken(u.id) };
}

test('een ingetrokken token blijft ingetrokken, ook met een spatie ervoor', async () => {
  const { u, token } = await lidMetToken();
  assert.ok(accounts.verifyToken(token), 'vooraf: het token werkt gewoon');

  accounts.trekIn(token);
  assert.equal(accounts.verifyToken(token), null, 'na uitloggen werkt het token niet meer');

  /* DE AANVAL. Deze vier vormen decoderen allemaal naar dezelfde bytes, omdat
     base64url-decodering tekens buiten het alfabet negeert. Zonder strikte
     vormcontrole komt elk van deze er weer doorheen. */
  for (const variant of [' ' + token, token + ' ', '\t' + token, '\n' + token]) {
    assert.equal(accounts.verifyToken(variant), null,
      'een ingetrokken token met witruimte (' + JSON.stringify(variant.replace(token, '<token>')) +
      ') hoort geweigerd te blijven -- anders is uitloggen met een enkel teken te omzeilen');
  }
});

test('alleen de exacte uitgiftevorm telt als token', async () => {
  const { token } = await lidMetToken();
  assert.ok(accounts.verifyToken(token), 'de eigen vorm werkt');
  /* Vormen die WEL door een losse handtekeningcontrole zouden komen maar niet
     door de vormcontrole: extra punt, hoofdletters in het hex-deel, en een
     spatie middenin. Fail closed betekent: bij twijfel geen token. */
  const [kop, hand] = token.split('.');
  for (const variant of [kop + '..' + hand, kop + '.' + hand.toUpperCase(), kop + ' .' + hand]) {
    assert.equal(accounts.verifyToken(variant), null,
      'wat er niet exact uitziet zoals wij het uitgeven, is geen token: ' + variant.slice(0, 24));
  }
});
