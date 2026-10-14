/* DE TWEEDE FACTOR, DE RANDEN (server/kern/identiteit/tweefactor.js en
   tweefactor-codes.js).

   test/tweefactor.test.js toetst de hoofdlijn (twee stappen aanzetten, een
   herstelcode is eenmalig, TOTP is geen passkey). Hier staan de randen die
   daar niet stonden: wat er gebeurt met een dossier dat niet bestaat, met een
   tweede begin terwijl de factor al aan staat, met een herstelcode in een
   andere schrijfwijze, en met de waarschuwingen als de codes opraken.

   Wat hier niet mag sneuvelen:
   1. een lid zonder dossier heeft geen factor en hoeft geen code te geven;
      een poging die nooit is bevestigd telt als wachtkamer, niet als aan;
   2. begin() terwijl de factor aan staat overschrijft het geheim NIET (anders
      zet een gekaapte sessie zijn eigen authenticator erop); bevestig() zonder
      begin of voor de tweede keer weigert;
   3. de otpauth-URI draagt uitgever en naam ontsnapt, met RTG/lid als
      terugval;
   4. een TOTP-code werkt één keer (geen herhaling); een herstelcode werkt
      ook in kleine letters en met streepjes, maar één keer; leeg is geen code;
   5. de waarschuwing klopt met het aantal dat over is (0, 1-2, meer), ook als
      de codelijst in het dossier ontbreekt;
   6. nieuweCodes() en uit() vragen een factor die AAN staat.

   MUTATIES die zijn gedraaid en welke toets erop zakte (LAT.md regel 2):
   - in begin() de 409-weigering (`if (md.tweefactor && md.tweefactor.aan)`)
     vervangen door `if (false)` -> "2." ZAKT (RAAK: het geheim werd vervangen);
   - in toets() `hashVan(schoon(inv))` vervangen door `hashVan(inv)` -> "4."
     ZAKT (RAAK);
   - in standVan `over <= 2` vervangen door `over < 2` -> "5." ZAKT (RAAK).

   Draai: node --test test/tweefactor-weerbaar.test.js */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { maakTweefactor } = require('../server/kern/identiteit/tweefactor');
const codes = require('../server/kern/identiteit/tweefactor-codes');
const { totpCode } = require('../server/kern/totp');

function opzet(begin) {
  let md = begin;
  const accounts = { getMemberState: () => md, saveMemberState: (id, o) => { md = o; },
    issueActionToken: (id, doel, ms) => doel + ':' + ms };
  return { tf: maakTweefactor({ accounts }), u: { id: 1 }, dossier: () => md };
}
const code = (g) => totpCode(g, Date.now(), 30);

test('1. geen dossier: geen factor, geen code nodig; onbevestigd is wachtkamer', () => {
  const { tf, u } = opzet(null);
  assert.deepEqual([tf.standVan(u).aan, tf.standVan(u).inWachtkamer], [false, false]);
  assert.deepEqual(tf.toets(u, ''), { ok: true, nvt: true });
  assert.equal(tf.inlogPoort(u), null);
  tf.begin(u);
  assert.deepEqual([tf.standVan(u).aan, tf.standVan(u).inWachtkamer], [false, true]);
  assert.deepEqual(tf.toets(u, 'wat dan ook'), { ok: true, nvt: true }, 'een wachtkamer is nog geen factor');
});

test('2. begin over een actieve factor heen weigert; bevestig zonder begin of dubbel weigert', () => {
  const { tf, u, dossier } = opzet({});
  assert.equal(tf.bevestig(u, '123456').status, 400);
  const g = tf.begin(u).geheim;
  assert.equal(tf.bevestig(u, '000000').status === 403 || code(g) === '000000', true);
  assert.equal(tf.bevestig(u, code(g)).ok, true);
  assert.equal(tf.bevestig(u, code(g)).status, 409);
  const nogmaals = tf.begin(u, 'RTG', 'kaper');
  assert.equal(nogmaals.status, 409);
  assert.equal(dossier().tweefactor.geheim, g, 'het geheim is niet vervangen');
  const p = tf.inlogPoort(u, 'werk2');
  assert.deepEqual([p.tweedeFactorNodig, p.bewijs, p.herstelcodesOver], [true, 'werk2:300000', codes.CODES]);
  assert.equal(tf.inlogPoort(u).bewijs, 'inlog2:300000');
});

test('3. de otpauth-URI ontsnapt uitgever en naam, met terugval', () => {
  const a = opzet({}); const r = a.tf.begin(a.u);
  assert.ok(r.uri.startsWith('otpauth://totp/RTG%3Alid?secret=' + r.geheim + '&issuer=RTG&'));
  const b = opzet({}); const s = b.tf.begin(b.u, 'RTG & Co', 'piet@x.nl');
  assert.ok(s.uri.startsWith('otpauth://totp/RTG%20%26%20Co%3Apiet%40x.nl?'));
  assert.ok(s.uri.includes('&issuer=RTG%20%26%20Co&digits=6&period=30'));
});

test('4. een herstelcode in andere schrijfwijze werkt, maar één keer; leeg is geen code', () => {
  const { tf, u } = opzet({});
  const g = tf.begin(u).geheim;
  const set = tf.bevestig(u, code(g)).herstelcodes;
  const volgende = totpCode(g, Date.now() + 30000, 30);
  assert.deepEqual(tf.toets(u, ' ' + volgende + ' '), { ok: true, soort: 'totp' });
  assert.equal(tf.toets(u, volgende).ok, false, 'dezelfde code tweemaal is een herhaling');
  const anders = '  ' + set[0].toLowerCase().replace(/(.{4})/, '$1-') + ' ';
  const r = tf.toets(u, anders);
  assert.deepEqual([r.ok, r.soort, r.herstelcodesOver], [true, 'herstelcode', codes.CODES - 1]);
  assert.equal(tf.toets(u, set[0]).ok, false, 'opgebruikt');
  assert.equal(tf.toets(u, undefined).ok, false);
  assert.equal(tf.toets(u, '').ok, false);
  assert.equal(codes.schoon(undefined), '');
  assert.equal(codes.hashVan(undefined), codes.hashVan(''));
});

test('5. de waarschuwing volgt het aantal dat over is', () => {
  const stand = (lijst) => opzet({ tweefactor: { aan: true, geheim: codes.nieuwGeheim(), codes: lijst } });
  const geen = stand(undefined);
  const s0 = geen.tf.standVan(geen.u);
  assert.deepEqual([s0.herstelcodesOver, s0.herstelcodesTotaal, s0.sinds], [0, 0, null]);
  assert.match(s0.let, /Al uw herstelcodes zijn gebruikt/);
  assert.equal(geen.tf.toets(geen.u, 'ABCD-EFGH').ok, false, 'zonder codelijst geen herstelcode');
  const twee = stand(['a', null, 'b']);
  assert.match(twee.tf.standVan(twee.u).let, /nog 2 herstelcode/);
  const drie = stand(['a', 'b', 'c']);
  assert.equal(drie.tf.standVan(drie.u).let, null);
  const x = opzet({}); const g = x.tf.begin(x.u).geheim; const set = x.tf.bevestig(x.u, code(g)).herstelcodes;
  for (const c of set.slice(0, -1)) x.tf.toets(x.u, c);
  assert.match(x.tf.toets(x.u, set[set.length - 1]).let, /laatste herstelcode/);
});

test('6. nieuweCodes en uit vragen een factor die aan staat', () => {
  const { tf, u, dossier } = opzet({});
  assert.equal(tf.nieuweCodes(u).status, 400);
  assert.equal(tf.uit(u, '123456').status, 400);
  tf.begin(u);
  assert.equal(tf.nieuweCodes(u).status, 400, 'een wachtkamer is geen factor');
  assert.equal(tf.uit(u, '123456').status, 400);
  assert.ok(dossier().tweefactor.geheim, 'en de wachtkamer blijft staan');
});
