/* DE WACHTWOORDREM TEGEN EEN GOKKER (server/kern/identiteit/wachtwoordrem.js,
   met ./lopend.js voor de pogingen die nog lopen).

   Wat deze module beschermt: elke deur die een RTG-wachtwoord toetst, deelt
   dezelfde drie emmers -- adres plus account (10, dan 429), het adres alleen
   (50, dan 429) en het account alleen (25, dan een VERTRAGING en geen slot,
   zodat een vreemde een lid niet uit zijn eigen account kan houden). De
   emmers van het account hangen aan het ACCOUNT dat findByLogin vond, niet aan
   de ingetikte tekst. Hier wordt de rem los van een server bediend met een
   kleine, eerlijke nabootsing van tooManyTries/noteFailedTry/loginFails; de
   echte deuren staan in test/werkplek-rem.test.js en test/rem-gelijktijdig.test.js.

   Wat hier niet mag sneuvelen:
   1. een deur die het account vergeet mee te geven, faalt luid in plaats van
      stil terug te vallen op de tekst (dan krijgt elke spelling verse gokken);
   2. hetzelfde account onder elke inlognaam is EEN emmer; een onbekende naam
      telt op zijn genormaliseerde tekst; in geen enkele emmernaam staat een
      e-mailadres of id in klare tekst;
   3. pogingen tellen vanaf dicht(): tien gelijktijdige pogingen vullen de
      emmer van adres plus account, de elfde krijgt 429 zonder dat er een
      wachtwoord is getoetst;
   4. een fout wachtwoord telt in alle drie de emmers, met de juiste grens, en
      een dichte accountemmer VERTRAAGT (twee seconden) maar sluit niet;
   5. een geslaagde inlog leegt alleen wat over dit account gaat, nooit de
      adresemmer;
   6. een dichte emmer antwoordt zelf (429) en de deur gaat niet verder.

   MUTATIES die zijn gedraaid en welke toets erop zakte (LAT.md regel 2):
   - in gelukt() de regel `loginFails.delete(e.paar);` vervangen door
     `loginFails.delete(e.bron);`
     -> "5. een geslaagde inlog leegt alleen wat over dit account gaat" ZAKT (RAAK).
   - in dicht() `+ lopend.aantal(k)` weggehaald
     -> "3. pogingen tellen vanaf dicht()" ZAKT (RAAK).

   Draai: node --test test/wachtwoordrem-weerbaar.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { maakWachtwoordRem, VERTRAGING_MS } = require('../server/kern/identiteit/wachtwoordrem');

/* Een nabootsing van de drie kernfuncties uit server.js: noteFailedTry telt
   per emmer en zet hem dicht op de grens (standaard 10); tooManyTries
   antwoordt 429 zolang een emmer dicht is. */
function kern() {
  const loginFails = new Map();
  const genoteerd = [];
  const noteFailedTry = (k, ip, grens = 10) => {
    genoteerd.push([k, ip, grens]);
    const r = loginFails.get(k) || { n: 0, until: 0 };
    r.n += 1;
    if (r.n >= grens) r.until = Date.now() + 15 * 60 * 1000;
    loginFails.set(k, r);
  };
  const tooManyTries = (res, k) => {
    const r = loginFails.get(k);
    if (r && r.until > Date.now()) { res.status(429).json({ error: 'dicht: ' + k }); return true; }
    return false;
  };
  return { loginFails, genoteerd, rem: maakWachtwoordRem({ tooManyTries, noteFailedTry, loginFails }) };
}
function res() {
  const r = { code: null, body: null };
  r.status = (c) => { r.code = c; return r; };
  r.json = (b) => { r.body = b; return r; };
  return r;
}
let teller = 0;
const ip = () => '192.0.2.' + (++teller);
const LID = { id: 31337 };

test('1. een deur die het account vergeet mee te geven, faalt luid', async () => {
  const { rem } = kern();
  assert.throws(() => rem.dicht(res(), ip(), 'kat@example.org'), /geef het account van findByLogin mee/);
  await assert.rejects(rem.mis(ip(), 'kat@example.org'), /geef het account/);
  assert.throws(() => rem.gelukt(ip(), 'kat@example.org'), /geef het account/);
  assert.throws(() => rem.account.gok(ip(), 'kat'), /geef het account/);
  // null is wel een antwoord: "er is geen account".
  assert.equal(rem.dicht(res(), ip(), 'kat@example.org', null), false);
});

test('2. een account is een emmer onder elke naam, en geen emmer draagt een adres of id in klare tekst', async () => {
  const { rem, genoteerd } = kern();
  const a = ip();
  for (const naam of ['Kat@Example.org', 'kat', '  KAT  ']) await rem.mis(a, naam, LID);
  const doelen = new Set(genoteerd.filter(([k]) => k.startsWith('auth:doel:')).map(([k]) => k));
  assert.equal(doelen.size, 1, 'drie spellingen, een accountemmer');
  const paren = new Set(genoteerd.filter(([k]) => k.startsWith('auth:' + a + ':')).map(([k]) => k));
  assert.equal(paren.size, 1);
  // Onbekende namen: de genormaliseerde tekst, dus hoofdletters en witruimte maken geen verse emmer.
  const g2 = kern();
  await g2.rem.mis(a, 'Niemand@Example.org', null);
  await g2.rem.mis(a, '  niemand@example.org ', null);
  await g2.rem.mis(a, 'iemand-anders', null);
  const doelen2 = new Set(g2.genoteerd.filter(([k]) => k.startsWith('auth:doel:')).map(([k]) => k));
  assert.equal(doelen2.size, 2);
  // Het id-account en een naam die toevallig "id:31337" heet, delen geen emmer.
  const g3 = kern();
  await g3.rem.mis(a, 'x', LID);
  await g3.rem.mis(a, 'id:31337', null);
  assert.equal(new Set(g3.genoteerd.filter(([k]) => k.startsWith('auth:doel:')).map(([k]) => k)).size, 2);
  for (const [k] of [...genoteerd, ...g2.genoteerd]) {
    assert.ok(!/example|kat|niemand|31337/i.test(k), 'emmernaam ' + k + ' verraadt niets');
  }
  // Een id 0 is een account (id != null), geen onbekende naam.
  const g4 = kern();
  await g4.rem.mis(a, 'nul', { id: 0 });
  await g4.rem.mis(a, 'anders', { id: 0 });
  assert.equal(new Set(g4.genoteerd.filter(([k]) => k.startsWith('auth:doel:')).map(([k]) => k)).size, 1);
});

test('3. pogingen tellen vanaf dicht(): de elfde gelijktijdige krijgt 429 zonder toets', async () => {
  const { rem } = kern();
  const a = ip();
  for (let i = 0; i < 10; i++) assert.equal(rem.dicht(res(), a, 'kat', LID), false, 'poging ' + (i + 1) + ' mag langs');
  const elfde = res();
  assert.equal(rem.dicht(elfde, a, 'kat', LID), true);
  assert.equal(elfde.code, 429);
  assert.match(elfde.body.error, /Te veel pogingen/);
  // Een ander account vanaf hetzelfde adres heeft er geen last van (tot de 50 van het adres).
  assert.equal(rem.dicht(res(), a, 'hond', { id: 2 }), false);
  // De uitslag geeft de plek terug: na een geslaagde inlog kan er weer een bij.
  rem.gelukt(a, 'kat', LID);
  assert.equal(rem.dicht(res(), a, 'kat', LID), false);
  for (let i = 0; i < 10; i++) rem.gelukt(a, 'kat', LID);
  rem.gelukt(a, 'hond', { id: 2 });
});

test('3b. vijftig pogingen vanaf een adres op verschillende accounts sluiten het adres', async () => {
  const { rem } = kern();
  const a = ip();
  for (let i = 0; i < 50; i++) assert.equal(rem.dicht(res(), a, 'lid' + i, { id: 1000 + i }), false);
  const r = res();
  assert.equal(rem.dicht(r, a, 'lid-nieuw', { id: 9999 }), true);
  assert.equal(r.code, 429);
  // Een ander adres merkt niets.
  assert.equal(rem.dicht(res(), ip(), 'lid-nieuw', { id: 9999 }), false);
  for (let i = 0; i < 50; i++) await rem.mis(a, 'lid' + i, { id: 1000 + i });
});

test('4. een fout wachtwoord telt in alle drie de emmers, met de juiste grens', async () => {
  const { rem, genoteerd } = kern();
  const a = ip();
  rem.dicht(res(), a, 'kat', LID);
  await rem.mis(a, 'kat', LID);
  assert.equal(genoteerd.length, 3);
  const [paar, bron, doel] = genoteerd;
  assert.match(paar[0], new RegExp('^auth:' + a.replace(/\./g, '\\.') + ':[a-f0-9]{24}$'));
  assert.deepEqual([paar[1], paar[2]], [a, 10]);
  assert.deepEqual([bron[0], bron[1], bron[2]], ['auth:bron:' + a, a, 50]);
  assert.match(doel[0], /^auth:doel:[a-f0-9]{24}$/);
  assert.deepEqual([doel[1], doel[2]], [a, 25]);
});

test('4b. een dichte accountemmer vertraagt elke misser twee seconden, maar sluit niet', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { rem, loginFails } = kern();
  // 24 missers vanaf 24 adressen: nog geen vertraging.
  for (let i = 0; i < 24; i++) { const a = ip(); rem.dicht(res(), a, 'kat', LID); await rem.mis(a, 'kat', LID); }
  // De 25e sluit de accountemmer; die misser wacht.
  const a = ip();
  rem.dicht(res(), a, 'kat', LID);
  let klaar = false;
  const p = rem.mis(a, 'kat', LID).then(() => { klaar = true; });
  for (let i = 0; i < 10; i++) await Promise.resolve();
  assert.equal(klaar, false, 'de misser wacht');
  t.mock.timers.tick(VERTRAGING_MS - 1);
  for (let i = 0; i < 10; i++) await Promise.resolve();
  assert.equal(klaar, false);
  t.mock.timers.tick(1);
  await p;
  assert.equal(klaar, true, 'na precies twee seconden');
  assert.equal(VERTRAGING_MS, 2000);
  // Geen slot: wie het wachtwoord weet, komt vanaf een vers adres gewoon langs de rem.
  const b = ip();
  assert.equal(rem.dicht(res(), b, 'kat', LID), false, 'de accountemmer sluit de deur niet');
  rem.gelukt(b, 'kat', LID);
  const doelen = [...loginFails.keys()].filter(k => k.startsWith('auth:doel:'));
  assert.deepEqual(doelen, [], 'en de geslaagde inlog leegt de accountemmer');
  // De wachthulp voor personeel: wachten alleen bij een dichte emmer.
  const g = kern();
  let direct = false;
  const w = g.rem.account.wacht('kat', LID).then(() => { direct = true; });
  for (let i = 0; i < 5; i++) await Promise.resolve();
  assert.equal(direct, true, 'zonder dichte emmer geen wachttijd (de klok staat stil)');
  await w;
});

test('5. een geslaagde inlog leegt alleen wat over dit account gaat, nooit de adresemmer', async () => {
  const { rem, loginFails } = kern();
  const a = ip();
  for (let i = 0; i < 3; i++) { rem.dicht(res(), a, 'ander' + i, { id: 50 + i }); await rem.mis(a, 'ander' + i, { id: 50 + i }); }
  rem.dicht(res(), a, 'kat', LID); await rem.mis(a, 'kat', LID);
  const paarKat = [...loginFails.keys()].find(k => k.startsWith('auth:' + a + ':') && loginFails.get(k).n === 1);
  assert.ok(paarKat);
  assert.equal(loginFails.get('auth:bron:' + a).n, 4);
  rem.dicht(res(), a, 'kat', LID);
  rem.gelukt(a, 'kat', LID);
  assert.equal(loginFails.get('auth:bron:' + a).n, 4, 'de adresemmer blijft staan');
  const katEmmers = [...loginFails.keys()].filter(k => k.startsWith('auth:' + a + ':'));
  assert.equal(katEmmers.length, 3, 'alleen de emmers van de andere accounts staan er nog');
});

test('6. een dichte emmer antwoordt zelf, en de deur gaat niet verder', () => {
  const { rem, loginFails } = kern();
  const a = ip();
  loginFails.set('auth:bron:' + a, { n: 99, until: Date.now() + 60000 });
  const r = res();
  assert.equal(rem.dicht(r, a, 'kat', LID), true);
  assert.equal(r.code, 429);
  assert.equal(r.body.error, 'dicht: auth:bron:' + a, 'het antwoord komt van tooManyTries zelf');
  // Een verlopen slot met een volle teller: de teller alleen sluit ook (de 50).
  loginFails.set('auth:bron:' + a, { n: 50, until: 0 });
  const s = res();
  assert.equal(rem.dicht(s, a, 'kat', LID), true);
  assert.match(s.body.error, /Te veel pogingen/);
  // Personeel deelt alleen de accountemmer, en een gelukte aanmelding leegt die.
  const g = kern();
  g.rem.account.gok(a, 'kat', LID);
  assert.equal(g.genoteerd.length, 1);
  assert.equal(g.genoteerd[0][2], 25);
  g.rem.account.gelukt('kat', LID);
  assert.equal(g.loginFails.size, 0);
});
