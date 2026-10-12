/* DE LOGREDACTIE TAK VOOR TAK (server/log-redactie.js).

   Wat dit bestand vasthoudt: welke geheimvormen geheimVrij wegschrijft (PEM,
   wachtwoord in een verbindings-URL, betaal- en AWS-sleutels, Basic en Bearer,
   Cookie, sleutel=waarde, lange hex, querytokens, codes en de twee adressen
   met een geheim pad), hoe veiligeWaarde door objecten en lijsten loopt (met
   een dieptegrens en geheime veldnamen), hoe veiligeFout een fout schoonmaakt,
   wat urlZonderGeheim van een URL overlaat, en dat bewaakConsole maar een keer
   aangaat. De console-bewaking draait op een nepdoel, nooit op de echte
   console van het toetsproces. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

const PAD = require.resolve('../server/log-redactie');
const red = require('../server/log-redactie');

test('geheimVrij: null en undefined worden een lege tekst, een getal een tekst', () => {
  assert.equal(red.geheimVrij(null), '');
  assert.equal(red.geheimVrij(undefined), '');
  assert.equal(red.geheimVrij(42), '42');
  assert.equal(red.geheimVrij('gewone zin zonder geheim'), 'gewone zin zonder geheim');
});

/* De nepsleutels worden uit stukken opgebouwd: als letterlijke tekst zou de
   geheimscan (npm run secrets) ze terecht als lek melden. */
const PRIV = 'PRIVATE' + ' KEY';
test('geheimVrij: een PEM-sleutel verdwijnt, ook zonder slotregel', () => {
  const pem = 'voor -----BEGIN RSA ' + PRIV + '-----\nMIIabc\n-----END RSA ' + PRIV + '----- na';
  assert.equal(red.geheimVrij(pem), 'voor [GEHEIM] na');
  assert.equal(red.geheimVrij('x -----BEGIN ' + PRIV + '-----\nMIIabc afgekapt'), 'x [GEHEIM]');
});

test('geheimVrij: het wachtwoord in een verbindings-URL gaat weg, schema en host blijven', () => {
  assert.equal(red.geheimVrij('redis://gebruiker:Zomer2026@cache.intern:6379'), 'redis://[GEHEIM]@cache.intern:6379');
  assert.equal(red.geheimVrij('postgresql://u:ww@db:5432/rtg'), 'postgresql://[GEHEIM]@db:5432/rtg');
  /* Zonder wachtwoord is er niets weg te halen. */
  assert.equal(red.geheimVrij('https://rtg.nl/pad'), 'https://rtg.nl/pad');
});

test('geheimVrij: betaal-, webhook- en AWS-sleutels', () => {
  assert.equal(red.geheimVrij('sleutel sk_live_abcDEF123456'), 'sleutel [GEHEIM]');
  assert.equal(red.geheimVrij('rk_test_ZZZZZZZZ'), '[GEHEIM]');
  assert.equal(red.geheimVrij('whsec_abc+/=123'), '[GEHEIM]');
  assert.equal(red.geheimVrij('id ' + 'AKIA' + 'ABCDEFGHIJKLMNOP eind'), 'id [GEHEIM] eind');
  /* Te kort om een sleutel te zijn. */
  assert.equal(red.geheimVrij('sk_live_ab'), 'sk_live_ab');
});

test('geheimVrij: Basic, Bearer en Cookie in een kop', () => {
  assert.equal(red.geheimVrij('Authorization: Basic dXNlcjpwYXNz'), 'Authorization: [GEHEIM] [GEHEIM]');
  assert.equal(red.geheimVrij('kop Basic dXNlcjpwYXNz'), 'kop Basic [GEHEIM]');
  assert.equal(red.geheimVrij('Bearer abc.def'), 'Bearer [GEHEIM]');
  assert.equal(red.geheimVrij('x bearer tok123, verder'), 'x Bearer [GEHEIM], verder');
  assert.equal(red.geheimVrij('Cookie: rtg=abc; b=c\nvolgende'), 'Cookie: [GEHEIM]\nvolgende');
});

test('geheimVrij: sleutel=waarde onder een geheime naam, met of zonder aanhalingstekens', () => {
  assert.equal(red.geheimVrij('password=geheim1'), 'password=[GEHEIM]');
  assert.equal(red.geheimVrij('{"wachtwoord":"zomer"}'), '{"wachtwoord":"[GEHEIM]"}');
  assert.equal(red.geheimVrij('api_key: abc&x=1'), 'api_key: [GEHEIM]&x=1');
  assert.equal(red.geheimVrij('client-secret=q1'), 'client-secret=[GEHEIM]');
  assert.equal(red.geheimVrij('naam=jan'), 'naam=jan');
});

test('geheimVrij: lange hex (ook met voorvoegsel), querytokens en codes', () => {
  const hex = 'a'.repeat(32);
  assert.equal(red.geheimVrij('k ' + hex), 'k [GEHEIM]');
  assert.equal(red.geheimVrij('GS.' + 'B'.repeat(32)), '[GEHEIM]');
  assert.equal(red.geheimVrij('GS%2e' + 'C'.repeat(40)), '[GEHEIM]');
  assert.equal(red.geheimVrij('/x?token=abc&y=1'), '/x?token=[GEHEIM]&y=1');
  assert.equal(red.geheimVrij('/x#kassacode=99'), '/x#kassacode=[GEHEIM]');
  assert.equal(red.geheimVrij('kamercode: ABC12'), 'kamercode=[GEHEIM]');
  assert.equal(red.geheimVrij('uitnodigingscode=Q9'), 'uitnodigingscode=[GEHEIM]');
  assert.equal(red.geheimVrij('code=77'), 'code=[GEHEIM]');
});

test('geheimVrij: een werkplekcode en een projectiecredential in een pad', () => {
  assert.equal(red.geheimVrij('GET /werken/ABCD-1234?x'), 'GET /werken/:code?x');
  assert.equal(red.geheimVrij('/api/projectie/zz9/scherm'), '/api/projectie/:credential/scherm');
});

test('urlZonderGeheim: alleen schema, host, poort en een echt pad', () => {
  assert.equal(red.urlZonderGeheim('redis://u:ww@cache:6379'), 'redis://cache:6379');
  assert.equal(red.urlZonderGeheim('postgres://u:ww@db:5432/rtg?ssl=1'), 'postgres://db:5432/rtg');
  assert.equal(red.urlZonderGeheim('https://rtg.nl/'), 'https://rtg.nl');
  assert.equal(red.urlZonderGeheim('geen url met u:ww@'), '[onleesbare url]');
  assert.equal(red.urlZonderGeheim(undefined), '[onleesbare url]');
});

test('veiligeWaarde: tekst wordt geredigeerd, getallen en null blijven', () => {
  assert.equal(red.veiligeWaarde('password=x1'), 'password=[GEHEIM]');
  assert.equal(red.veiligeWaarde(7), 7);
  assert.equal(red.veiligeWaarde(null), null);
  assert.equal(red.veiligeWaarde(undefined), undefined);
  assert.equal(red.veiligeWaarde(true), true);
});

test('veiligeWaarde: een geheime veldnaam maakt de waarde geheim, welke vorm hij ook heeft', () => {
  const uit = red.veiligeWaarde({ wachtwoord: 'zomer2026', Pin: '1234', naam: 'jan', token: '', otp: 5,
    nieuwwachtwoord: 'x', herstelcode: 'y', kop: 'Bearer q' });
  assert.deepEqual(uit, { wachtwoord: '[GEHEIM]', Pin: '[GEHEIM]', naam: 'jan', token: '', otp: 5,
    nieuwwachtwoord: '[GEHEIM]', herstelcode: '[GEHEIM]', kop: 'Bearer [GEHEIM]' });
});

test('veiligeWaarde: lijsten worden afgekapt op 100 en lopen door', () => {
  const lijst = Array.from({ length: 150 }, (_, i) => i === 0 ? 'secret=a' : i);
  const uit = red.veiligeWaarde(lijst);
  assert.equal(uit.length, 100);
  assert.equal(uit[0], 'secret=[GEHEIM]');
  assert.equal(uit[99], 99);
});

test('veiligeWaarde: onder diepte 3 wordt er niet verder gekeken', () => {
  const diep = { a: { b: { c: { d: { e: 'password=x' } } } } };
  const uit = red.veiligeWaarde(diep);
  /* Diepte 0..3 wordt gekopieerd; het object op diepte 4 komt ongewijzigd terug. */
  assert.notEqual(uit.a, diep.a);
  assert.equal(uit.a.b.c.d, diep.a.b.c.d);
  assert.equal(uit.a.b.c.d.e, 'password=x');
  const ondiep = red.veiligeWaarde({ a: { b: 'password=y' } });
  assert.equal(ondiep.a.b, 'password=[GEHEIM]');
});

test('veiligeFout: bericht, stapel en code worden geredigeerd; naam blijft', () => {
  const e = new TypeError('verbinding redis://u:geheim@h:1 mislukt');
  e.code = 'token=abc';
  const v = red.veiligeFout(e);
  assert.ok(v instanceof Error);
  assert.equal(v.name, 'TypeError');
  assert.equal(v.message, 'verbinding redis://[GEHEIM]@h:1 mislukt');
  assert.ok(!v.stack.includes('geheim@'));
  assert.equal(v.code, 'token=abc');
  const metQuery = new Error('x'); metQuery.code = '/p?token=z';
  assert.equal(red.veiligeFout(metQuery).code, '/p?token=[GEHEIM]');
});

test('veiligeFout: een niet-fout wordt een fout; zonder code geen code, zonder naam Error, zonder stapel een eigen', () => {
  const v = red.veiligeFout('password=abc');
  assert.ok(v instanceof Error);
  assert.equal(v.message, 'password=[GEHEIM]');
  assert.equal('code' in v, false);
  const naamloos = new Error('m'); naamloos.name = ''; naamloos.stack = '';
  const w = red.veiligeFout(naamloos);
  assert.equal(w.name, 'Error');
  assert.ok(typeof w.stack === 'string' && w.stack.length > 0);
  const nulcode = new Error('n'); nulcode.code = 0;
  assert.equal(red.veiligeFout(nulcode).code, '0');
});

test('bewaakConsole: gaat een keer aan, redigeert argumenten en fouten, slaat ontbrekende methoden over', () => {
  delete require.cache[PAD];
  const vers = require(PAD);
  try {
    const gezien = [];
    const doel = {
      log: (...a) => gezien.push(['log', ...a]),
      error: (...a) => gezien.push(['error', ...a]),
      warn: 'geen functie'
    };
    assert.equal(vers.bewaakConsole(doel), true);
    assert.equal(vers.bewaakConsole(doel), false, 'een tweede keer wikkelt niet opnieuw');
    assert.equal(doel.warn, 'geen functie');
    assert.equal('info' in doel, false);
    doel.log('password=x', { secret: 'y' }, 3);
    doel.error(new Error('Bearer abc'));
    assert.equal(gezien.length, 2);
    assert.deepEqual(gezien[0], ['log', 'password=[GEHEIM]', { secret: '[GEHEIM]' }, 3]);
    assert.equal(gezien[1][0], 'error');
    assert.ok(gezien[1][1] instanceof Error);
    assert.equal(gezien[1][1].message, 'Bearer [GEHEIM]');
  } finally {
    delete require.cache[PAD];
    require(PAD);
  }
});
