/* DE DRAGER ONDER AANVAL (server/kern/bearercode.js, v1 en de fabriek).

   Een bearer-code is een sleutel die zelf een deur opent: wie hem heeft, komt
   binnen. test/bearercode.test.js legt het gewone gedrag van v1 vast; dit
   bestand neemt de kant van wie NIET binnen hoort te komen: een vervalste of
   afgekapte code, een code uit een andere namespace, een verlopen, opgebruikte
   of ingetrokken drager, een gemanipuleerd record in de opslag, en de
   grensgevallen in het formaat (lege, rare of te lange invoer). Elke tak die
   hier faalt, is een inbraakroute.

   Wat hier niet mag sneuvelen:
   1. een code uit een andere namespace, een afgekapte code of een code met
      een omgedraaid teken vindt GEEN rij, ook niet als de opslag rommel bevat;
   2. de hashvergelijking weigert alles wat geen 64 hextekens is -- aan elke
      kant -- en gooit niet op een ongelijke lengte;
   3. bij gelijke hashes wint de LAATSTE rij (er wordt niet vroeg gestopt), en
      een rij zonder hashveld valt stil weg;
   4. een record dat in de opslag is opgerekt (gebruiksteller als tekst, NaN,
      breuk, onleesbare vervaltijd) is een weigering, nooit een open deur;
   5. de weigervolgorde: doel en scope gaan VOOR ingetrokken en verlopen, zodat
      een code voor een andere deur nooit iets over zijn eigen staat verraadt;
   6. intrekken is eenmalig: een tweede intrekking overschrijft wie en waarom
      niet, en een intrekker zonder naam heet `onbekend`;
   7. vernieuwen vraagt een bestaande toegang, een mens op naam, hetzelfde doel
      en dezelfde uitgever, en een eigen termijn -- en de oude is daarna dicht;
   8. de fabriek start niet zonder echte crypto of met een lege namespace.

   MUTATIES die zijn gedraaid en welke toets erop zakte (LAT.md regel 2):
   - in hashGelijk de controle op 64 hextekens voor `b` weggehaald
     (`|| !/^[a-f0-9]{64}$/i.test(String(b || ''))` geschrapt)
     -> "2. hashGelijk" ZAKT: timingSafeEqual gooit op een korte waarde (RAAK)
   - in redenV1 `if (toegang.ingetrokken_at) return 'ingetrokken'` verplaatst
     naar VOOR de doelcontrole
     -> "5. de weigervolgorde" ZAKT (RAAK)
   - in intrekken `if (!toegang.ingetrokken_at)` vervangen door `if (true)`
     -> "6. intrekken is eenmalig" ZAKT (RAAK)

   Draai: node --test test/bearercode-weerbaar.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const maakLaag = require('../server/kern/bearercode');
const { hashGelijk, vindOpHash, MAX_GELDIG_MS, stilleDuur } = maakLaag;

const DAG = 86400000;
const T0 = '2026-10-14T08:00:00.000Z';
function laag(ns = 'weerbaar', extra = {}) {
  const klok = { t: T0 };
  const l = maakLaag({ crypto, namespace: ns, nu: () => klok.t, ...extra });
  l.klok = klok;
  l.schuif = ms => { klok.t = new Date(Date.parse(klok.t) + ms).toISOString(); };
  return l;
}
const basis = { prefix: 'deur', issuer: 'zaak:W', doel: 'deur', scope: ['openen'], geldigMs: DAG };

test('1. een vervalste, afgekapte of vreemde code vindt geen rij', () => {
  const l = laag();
  const andere = laag('andere-namespace');
  const { code, toegang } = l.maak(basis);
  const rijen = [null, undefined, 7, { code_hash: 'x' }, {}, toegang, { code_hash: 'g'.repeat(64) }];

  assert.equal(l.vind(rijen, code), toegang, 'de echte code vindt zijn rij tussen rommel');
  assert.equal(l.vind(rijen, ' ' + code.toLowerCase() + '\n'), toegang, 'normalisatie: spaties en kleine letters tellen niet');
  assert.equal(l.vind(rijen, code.slice(0, -1)), null, 'een afgekapte code opent niets');
  const laatste = code.slice(-1) === 'A' ? 'B' : 'A';
  assert.equal(l.vind(rijen, code.slice(0, -1) + laatste), null, 'een omgedraaid laatste teken opent niets');
  assert.equal(l.vind(rijen, code + '0'), null, 'een verlengde code opent niets');
  assert.equal(l.vind(rijen, ''), null);
  assert.equal(l.vind(rijen, null), null);
  assert.equal(l.vind(rijen, undefined), null);
  assert.equal(andere.vind(rijen, code), null, 'dezelfde kale code in een andere namespace is een andere hash');
  assert.notEqual(andere.hash(code), l.hash(code));

  assert.equal(l.vind(null, code), null, 'geen opslag is geen treffer');
  assert.equal(l.vind(undefined, code), null);
  assert.equal(l.vind({ a: toegang, b: null }, code), toegang, 'een kaart van rijen werkt ook');
  assert.equal(l.vind([{ h: toegang.code_hash }], code), null, 'het standaardveld is code_hash');
  const metH = { h: toegang.code_hash };
  assert.equal(l.vind([metH], code, 'h'), metH, 'een eigen veldnaam wordt gevolgd');
  const r = { binnen: { h: toegang.code_hash } };
  assert.equal(l.vind([r, null], code, rij => rij && rij.binnen.h), r, 'een veldfunctie haalt de hash uit een geneste plek');
  assert.equal(l.vind([r], code, () => undefined), null, 'een veldfunctie zonder waarde vindt niets');
});

test('2. hashGelijk weigert alles wat geen 64 hextekens is, aan beide kanten', () => {
  const h = crypto.createHash('sha256').update('x').digest('hex');
  assert.equal(hashGelijk(crypto, h, h), true);
  assert.equal(hashGelijk(crypto, h.toUpperCase(), h), true, 'hoofdletters zijn dezelfde bytes');
  for (const slecht of [null, undefined, '', 'abc', h.slice(0, 63), h + 'a', 'z'.repeat(64), 42, {}, [h, h]]) {
    assert.equal(hashGelijk(crypto, slecht, h), false, 'links: ' + String(slecht).slice(0, 10));
    assert.equal(hashGelijk(crypto, h, slecht), false, 'rechts: ' + String(slecht).slice(0, 10));
  }
  const ander = crypto.createHash('sha256').update('y').digest('hex');
  assert.equal(hashGelijk(crypto, h, ander), false);

  const l = laag();
  assert.equal(l.zelfdeHash(h, h), true);
  assert.equal(l.zelfdeHash(h, h.slice(1)), false);
});

test('3. vindOpHash loopt alle rijen af: de laatste treffer wint, rommel valt weg', () => {
  const h = crypto.createHash('sha256').update('dubbel').digest('hex');
  const eerste = { code_hash: h, n: 1 };
  const tweede = { code_hash: h, n: 2 };
  assert.equal(vindOpHash(crypto, [eerste, null, { n: 3 }, tweede], h), tweede, 'niet vroeg stoppen: de laatste wint');
  assert.equal(vindOpHash(crypto, null, h), null);
  assert.equal(vindOpHash(crypto, [], h), null);
  assert.equal(vindOpHash(crypto, [eerste], 'niet-hex'), null);
  assert.equal(vindOpHash(crypto, [{ eigen: h }], h, 'eigen').eigen, h, 'een eigen veldnaam');
  assert.equal(vindOpHash(crypto, [{ eigen: h }], h), null, 'zonder veldnaam is het code_hash');

  const l = laag();
  const a = l.maak(basis), b = l.maak(basis);
  const dubbel = { code_hash: a.toegang.code_hash, dubbel: true };
  assert.equal(l.vind([a.toegang, b.toegang, dubbel], a.code), dubbel, 'de laag zelf stopt ook niet bij de eerste');
});

test('4. een opgerekt record in de opslag is een weigering, nooit een open deur', () => {
  const l = laag();
  const v = { doel: 'deur', scope: ['openen'] };
  const vers = () => l.maak(basis).toegang;
  assert.equal(l.reden(vers(), v), null);

  for (const [veld, waarde] of [['gebruik', '0'], ['gebruik', NaN], ['gebruik', 0.5], ['gebruik', null],
    ['max_gebruik', '5'], ['max_gebruik', Infinity], ['max_gebruik', 2 ** 60]]) {
    const t = vers(); t[veld] = waarde;
    assert.equal(l.reden(t, v), 'ongeldige-gebruiksteller', veld + ' = ' + String(waarde));
  }
  for (const einde of ['', 'morgen', null, undefined, 'NaN']) {
    const t = vers(); t.expires_at = einde;
    assert.equal(l.reden(t, v), 'verlopen', 'onleesbare vervaltijd ' + String(einde));
  }
  const t = vers(); t.scope = undefined;
  assert.equal(l.reden(t, v), 'scope-ontbreekt', 'een record zonder scope heeft geen enkele scope');
  assert.equal(l.reden(null, v), 'onbekend');
  assert.equal(l.reden(undefined), 'onbekend');
  assert.equal(l.reden(vers()), null, 'een v1-controle zonder verwachting toetst alleen de staat');
});

test('5. de weigervolgorde: doel en scope eerst, dan ingetrokken, verlopen en opgebruikt', () => {
  const l = laag();
  const v = { doel: 'deur', scope: ['openen'] };
  const t = l.maak({ ...basis, maxGebruik: 1 }).toegang;
  l.gebruik(t);
  l.intrekken(t, 'mw', 'gestolen');
  l.schuif(2 * DAG);
  assert.equal(l.reden(t, { doel: 'kluis', scope: ['openen'] }), 'verkeerd-doel', 'een andere deur hoort niets over de staat');
  assert.equal(l.reden(t, { doel: 'deur', scope: ['openen', 'betalen'] }), 'scope-ontbreekt');
  assert.equal(l.reden(t, { doel: 'deur', scope: 'betalen' }), 'scope-ontbreekt', 'een losse scope telt ook');
  assert.equal(l.reden(t, v), 'ingetrokken');
  t.ingetrokken_at = null;
  assert.equal(l.reden(t, v), 'verlopen');
  l.klok.t = T0;
  assert.equal(l.reden(t, v), 'opgebruikt');
  assert.equal(l.reden(t, { ...v, negeerGebruik: true }), null, 'negeerGebruik laat de teller los, niets anders');
  l.schuif(DAG);
  assert.equal(l.reden(t, { ...v, negeerGebruik: true }), 'verlopen', 'precies op de vervaltijd is verlopen');
  l.klok.t = new Date(Date.parse(T0) + DAG - 1).toISOString();
  assert.equal(l.reden(t, { ...v, negeerGebruik: true }), null, 'een milliseconde ervoor nog niet');
});

test('6. intrekken is eenmalig, en een intrekker zonder naam heet onbekend', () => {
  const l = laag();
  const t = l.maak(basis).toegang;
  assert.equal(l.intrekken(t), t);
  assert.equal(t.ingetrokken_at, T0);
  assert.equal(t.ingetrokken_door, 'onbekend');
  assert.equal(t.intrekreden, 'ingetrokken');
  l.schuif(1000);
  l.intrekken(t, 'aanvaller', 'stil terugdraaien');
  assert.equal(t.ingetrokken_at, T0, 'een tweede intrekking schuift het moment niet op');
  assert.equal(t.ingetrokken_door, 'onbekend', 'en schrijft de intrekker niet over');

  const lang = l.maak(basis).toegang;
  l.intrekken(lang, 'm'.repeat(300), 'r'.repeat(500));
  assert.equal(lang.ingetrokken_door.length, 100);
  assert.equal(lang.intrekreden.length, 200);

  const g = l.gebruik(l.maak(basis).toegang);
  assert.equal(g.gebruik, 1);
  assert.equal(g.laatst_gebruikt_at, l.klok.t, 'het gebruik draagt het moment van nu');
});

test('7. maak: formaat, grenzen en wat er nooit in een record komt', () => {
  const l = laag();
  assert.throws(() => l.maak(), /issuer, doel en scope/, 'een lege opdracht geeft geen code');
  assert.throws(() => l.maak(null), /issuer, doel en scope/);
  assert.throws(() => l.maak({ ...basis, issuer: '   ' }), /issuer, doel en scope/);
  assert.throws(() => l.maak({ ...basis, doel: null }), /issuer, doel en scope/);
  assert.throws(() => l.maak({ ...basis, scope: [null, '', '  '] }), /issuer, doel en scope/, 'een scope van alleen leegte is geen scope');

  const { code, toegang } = l.maak({ ...basis, prefix: 'ab c!d', scope: ['openen', 'openen', ' openen '],
    onderwerp: null, maxGebruik: 'veel', issuer: ' i '.repeat(80), doel: 'd'.repeat(150) });
  assert.match(code, /^ABCD\.[A-F0-9]{32}$/, 'het voorvoegsel verliest wat geen teken mag zijn');
  assert.ok(!JSON.stringify(toegang).includes(code.split('.')[1]), 'de kale code staat nergens in het record');
  assert.deepEqual(toegang.scope, ['openen']);
  assert.deepEqual(toegang.onderwerp, {});
  assert.equal(toegang.max_gebruik, 1, 'onleesbaar maxGebruik wordt 1, niet onbeperkt');
  assert.equal(toegang.issuer.length, 100);
  assert.equal(toegang.doel.length, 100);
  assert.equal(toegang.contractversie, undefined, 'zonder geldigheid is het v1');

  assert.match(l.maak({ ...basis, prefix: '' }).code, /^[A-F0-9]{32}$/, 'zonder voorvoegsel alleen het geheim');
  assert.match(l.maak({ ...basis, prefix: '!!!' }).code, /^[A-F0-9]{32}$/, 'een voorvoegsel van alleen rommel valt weg');
  assert.match(l.codeNieuw('heel-lang-voorvoegsel'), /^HEEL-LANG-VO\.[A-F0-9]{32}$/);
  assert.match(l.codeNieuw(null), /^[A-F0-9]{32}$/);
  assert.notEqual(l.codeNieuw('x'), l.codeNieuw('x'), 'elke code is vers');

  assert.equal(l.maak({ ...basis, geldigheid: { duurMs: DAG }, gebruik: { max: 1 }, afgeleid: 'geen' }).toegang.contractversie, 2,
    'met geldigheid gaat de fabriek naar v2, en daar telt geen stille duur');
  assert.equal(l.maak({ ...basis, maxGebruik: 0 }).toegang.max_gebruik, 1, 'nul is geen onbeperkt');
  assert.equal(l.maak({ ...basis, maxGebruik: -5 }).toegang.max_gebruik, 1);
  assert.equal(l.maak({ ...basis, maxGebruik: 1e9 }).toegang.max_gebruik, 10000);
  assert.equal(l.maak({ ...basis, maxGebruik: 2.6 }).toegang.max_gebruik, 3);
  const d = t => Date.parse(t.expires_at) - Date.parse(t.issued_at);
  assert.equal(d(l.maak({ ...basis, geldigMs: 10 * 366 * DAG }).toegang), MAX_GELDIG_MS, 'het plafond houdt');
  assert.equal(d(l.maak({ ...basis, geldigMs: -1 }).toegang), 1000, 'een negatieve duur wordt de vloer, niet oneindig');
  assert.equal(d(l.maak({ ...basis, geldigMs: '5000' }).toegang), 5000, 'een getal als tekst wordt gelezen');
});

test('7b. de stille duur wordt gemeld aan het spoor en geteld', () => {
  const sporen = [];
  const l = laag('weerbaar-stil', { spoor: s => sporen.push(s) });
  const voor = stilleDuur()['weerbaar-stil|deur'] || 0;
  l.maak({ issuer: 'i', doel: 'deur', scope: ['openen'] });
  l.maak({ issuer: 'i', doel: 'deur', scope: ['openen'], geldigMs: 'geen getal' });
  l.maak({ issuer: 'i', doel: 'deur', scope: ['openen'], geldigMs: 5000 });
  assert.equal(stilleDuur()['weerbaar-stil|deur'], voor + 2, 'alleen de twee zonder bruikbare duur tellen');
  assert.equal(sporen.length, 2);
  assert.deepEqual(sporen[0], { soort: 'stille-duur', namespace: 'weerbaar-stil', doel: 'deur', at: T0 });
  assert.throws(() => l.maak({ scope: ['openen'] }), /issuer, doel en scope/, 'ook zonder doel eerst geteld, dan geweigerd');
  assert.ok(stilleDuur()['weerbaar-stil|'] >= 1);
  assert.equal(sporen[2].doel, '');
});

test('8. publiek: geen hash, geen onderwerp, geen intrekker -- en een kopie van de scope', () => {
  const l = laag();
  assert.equal(l.publiek(null), null);
  assert.equal(l.publiek(undefined), null);
  const t = l.maak({ ...basis, onderwerp: { lid: 'CODENAAM' } }).toegang;
  l.intrekken(t, 'mw-geheim', 'reden-geheim');
  const p = l.publiek(t);
  const tekst = JSON.stringify(p);
  for (const verboden of [t.code_hash, 'CODENAAM', 'mw-geheim', 'reden-geheim']) assert.ok(!tekst.includes(verboden), verboden);
  p.scope.push('betalen');
  assert.deepEqual(t.scope, ['openen'], 'wie de publieke vorm wijzigt, wijzigt de toegang niet');
  const zonder = Object.assign({}, t, { scope: undefined });
  assert.deepEqual(l.publiek(zonder).scope, []);
});

test('9. vernieuwen: alleen een bestaande toegang, door een mens, met eigen termijn', () => {
  const sporen = [];
  const l = laag('weerbaar-vernieuw', { spoor: s => sporen.push(s) });
  const oud = l.maak({ ...basis, onderwerp: { zaak: 'Z1' } });
  const spec = { issuer: 'zaak:W', doel: 'deur', scope: ['openen'], geldigheid: { duurMs: DAG }, gebruik: { max: 1 }, afgeleid: 'geen' };
  assert.throws(() => l.vernieuw(null, spec, 'mw'), e => e.code === 'niet-vernieuwbaar');
  assert.throws(() => l.vernieuw(oud.toegang, spec, '   '), e => e.code === 'actor-ontbreekt');
  assert.throws(() => l.vernieuw(oud.toegang, spec, null), e => e.code === 'actor-ontbreekt');
  assert.throws(() => l.vernieuw(oud.toegang, { ...spec, doel: undefined }, 'mw'), e => e.code === 'ander-doel', 'een ontbrekend doel is een ander doel');
  assert.throws(() => l.vernieuw(oud.toegang, { ...spec, issuer: 'zaak:X' }, 'mw'), e => e.code === 'ander-issuer');
  assert.throws(() => l.vernieuw(oud.toegang, { ...spec, geldigheid: null }, 'mw'), e => e.code === 'geldigheid-ontbreekt');
  assert.equal(oud.toegang.ingetrokken_at, null, 'een geweigerde vernieuwing laat de oude open');

  const nieuw = l.vernieuw(oud.toegang, { ...spec, doel: ' deur ' }, 'mw');
  assert.notEqual(nieuw.code, oud.code);
  assert.deepEqual(nieuw.toegang.onderwerp, { zaak: 'Z1' }, 'het onderwerp gaat mee als de spec het niet noemt');
  assert.equal(nieuw.toegang.rotatie, 2);
  assert.equal(oud.toegang.ingetrokken_door, 'mw');
  assert.equal(oud.toegang.intrekreden, 'vernieuwd');
  assert.equal(l.reden(oud.toegang, { doel: 'deur', scope: ['openen'] }), 'ingetrokken', 'de oude code is dicht');
  assert.equal(l.reden(nieuw.toegang, { doel: 'deur', scope: ['openen'] }), null);
  assert.deepEqual(sporen.map(s => s.soort), ['uitgegeven', 'vernieuwd']);

  const zonderDoel = { ...oud.toegang, doel: '', issuer: '', ingetrokken_at: null };
  assert.throws(() => l.vernieuw(zonderDoel, { ...spec, geldigheid: undefined }, 'mw'), e => e.code === 'geldigheid-ontbreekt',
    'een record zonder doel of uitgever slaat die controle over, maar niet die op de termijn');
});

test('10. de fabriek: echte crypto, een namespace, en een eigen normalisatie', () => {
  assert.throws(() => maakLaag({ namespace: 'x' }), /node:crypto/);
  assert.throws(() => maakLaag({ crypto: { randomBytes() {}, createHash() {} }, namespace: 'x' }), /node:crypto/);
  assert.throws(() => maakLaag({ crypto: { randomBytes() {}, timingSafeEqual() {} }, namespace: 'x' }), /node:crypto/);
  assert.throws(() => maakLaag({ crypto: { createHash() {}, timingSafeEqual() {} }, namespace: 'x' }), /node:crypto/);
  for (const ns of [undefined, null, '', '   ']) assert.throws(() => maakLaag({ crypto, namespace: ns }), /vaste namespace/);

  const eigen = maakLaag({ crypto, namespace: 'eigen', normaal: w => String(w || '').replace(/\s/g, '') });
  assert.equal(eigen.normaal(' a b '), 'ab', 'de eigen normalisatie vervangt de standaard');
  assert.equal(eigen.hash('a b'), eigen.hash('ab'));
  assert.notEqual(eigen.hash('ab'), eigen.hash('AB'), 'zonder hoofdletternormalisatie is AB een andere code');
  const std = maakLaag({ crypto, namespace: 'eigen' });
  assert.equal(std.normaal(null), '');
  assert.equal(std.normaal(' ab '), 'AB');
  assert.equal(std.hash('ab'), std.hash(' AB '));

  const zonderKlok = maakLaag({ crypto, namespace: 'klok' });
  const t = zonderKlok.maak({ issuer: 'i', doel: 'd', scope: 's', geldigMs: DAG }).toegang;
  assert.ok(Number.isFinite(Date.parse(t.issued_at)), 'zonder eigen klok draagt de standaardklok');
  assert.deepEqual(t.scope, ['s'], 'een losse scope wordt een lijst');
});
