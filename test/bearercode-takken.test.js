/* TAKKEN VAN kern/bearercode.js DIE GEEN TOETS RAAKTE.

   test/bearercode.test.js legt v1 vast, test/bearercode-v2.test.js en
   test/bearercode-vernieuw.test.js de v2-werkwoorden. Toch bleven er armen
   ongedekt, en het zijn juist de WEIGER-armen: een ontbrekende namespace, een
   lege opdracht, een record zonder scope, een vernieuwing zonder oude toegang
   of met een leeg doel, en de losse hulpfuncties `hashGelijk`/`vindOpHash`
   die kern/codelevenscyclus.js gebruikt maar die hier nooit rechtstreeks werden
   aangeroepen. Dit is beveiligingscode: elke toets hieronder bewijst dat iets
   WORDT GEWEIGERD (vervalst, verkeerde lengte of soort, gemanipuleerd), niet
   alleen dat de regel draait.

   Draai los: node --test test/bearercode-takken.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const maakLaag = require('../server/kern/bearercode');

const DAG = 86400000;
const T0 = '2026-10-04T12:00:00.000Z';
function laag(ns = 'takken', extra = {}) {
  const klok = { t: T0 };
  const l = maakLaag(Object.assign({ crypto, namespace: ns, nu: () => klok.t }, extra));
  return Object.assign(l, { klok });
}
const basis = { issuer: 'zaak:PROEF', doel: 'deur', scope: ['openen'] };
const v2spec = extra => Object.assign({ ...basis, geldigheid: { duurMs: DAG }, gebruik: { max: 3 }, afgeleid: 'geen' }, extra || {});
const verwacht = { doel: 'deur', scope: ['openen'] };
/* Een toetshash: de hash van een toetswoord, geen sleutel. */
const h = woord => crypto.createHash('sha256').update('toets|' + woord).digest('hex');

test('hashGelijk weigert alles wat geen twee keer 64 hextekens is, aan BEIDE kanten', () => {
  const a = h('a');
  assert.equal(maakLaag.hashGelijk(crypto, a, a), true);
  assert.equal(maakLaag.hashGelijk(crypto, a, a.toUpperCase()), true, 'hoofdletters zijn dezelfde hex');
  assert.equal(maakLaag.hashGelijk(crypto, a, h('b')), false);
  for (const fout of [undefined, null, '', 0, a.slice(2), a + 'ab', 'g'.repeat(64), ' ' + a.slice(1), { toString: () => 'x' }]) {
    assert.equal(maakLaag.hashGelijk(crypto, fout, a), false, 'links: ' + String(fout));
    assert.equal(maakLaag.hashGelijk(crypto, a, fout), false, 'rechts: ' + String(fout));
  }
  assert.equal(maakLaag.hashGelijk(crypto, null, null), false, 'twee keer niets is geen treffer');
  assert.equal(maakLaag.hashGelijk(crypto, '', ''), false, 'twee keer leeg is geen treffer');
});

test('vindOpHash loopt alle rijen af, laatste treffer wint, en vindt niets in niets', () => {
  const doel = h('doel');
  const rijen = [null, { code_hash: 'kapot' }, { code_hash: doel, n: 1 }, undefined, { code_hash: doel, n: 2 }, { code_hash: h('ander') }];
  assert.equal(maakLaag.vindOpHash(crypto, rijen, doel).n, 2, 'hij stopt niet bij de eerste treffer');
  assert.equal(maakLaag.vindOpHash(crypto, rijen, h('niemand')), null);
  assert.equal(maakLaag.vindOpHash(crypto, rijen, 'kapot'), null, 'een kapotte gezochte hash vindt de kapotte rij NIET');
  assert.equal(maakLaag.vindOpHash(crypto, null, doel), null);
  assert.equal(maakLaag.vindOpHash(crypto, undefined, doel), null);
  assert.equal(maakLaag.vindOpHash(crypto, [], doel), null);
  assert.equal(maakLaag.vindOpHash(crypto, [{ eigen: doel }], doel, 'eigen').eigen, doel, 'een eigen veldnaam');
  assert.equal(maakLaag.vindOpHash(crypto, [{ code_hash: doel }], doel, 'eigen'), null, 'het standaardveld telt niet als een ander veld is gevraagd');
});

test('de fabriek weigert zonder namespace en zonder volledige crypto', () => {
  assert.throws(() => maakLaag({ crypto }), /vaste namespace/);
  assert.throws(() => maakLaag({ crypto, namespace: null }), /vaste namespace/);
  assert.throws(() => maakLaag({ crypto, namespace: '' }), /vaste namespace/);
  assert.throws(() => maakLaag({ crypto: { randomBytes() {}, timingSafeEqual() {} }, namespace: 'x' }), /node:crypto/, 'zonder createHash');
  assert.throws(() => maakLaag({ crypto: { createHash() {}, timingSafeEqual() {} }, namespace: 'x' }), /node:crypto/, 'zonder randomBytes');
  assert.throws(() => maakLaag({ crypto: null, namespace: 'x' }), /node:crypto/);
  assert.throws(() => maakLaag(Object.create(null)), /node:crypto/);
});

test('een eigen normalisatie: de hash volgt hem, en de standaardnormalisatie geldt dan niet meer', () => {
  const eigen = laag('takken-eigen', { normaal: w => String(w == null ? '' : w).replace(/\s+/g, '') });
  const standaard = laag('takken-eigen');
  assert.equal(eigen.normaal(' a b '), 'ab');
  assert.equal(eigen.normaal(42), '42', 'de uitkomst is altijd een tekenreeks');
  const { code, toegang } = eigen.maak({ ...basis, prefix: 'bon' });
  assert.equal(toegang.code_hash, eigen.hash(code), 'de hash in maak() klopt meteen met de eigen normalisatie');
  assert.equal(eigen.vind([toegang], code), toegang);
  assert.equal(eigen.vind([toegang], code.toLowerCase()), null, 'deze normalisatie maakt geen hoofdletters: kleine letters zijn een andere code');
  assert.equal(standaard.hash('abc'), crypto.createHash('sha256').update('rtg-bearer-v1|takken-eigen|ABC').digest('hex'));
  assert.notEqual(eigen.hash('abc'), standaard.hash('abc'), 'zelfde namespace, andere normalisatie, andere hash');
});

test('een vervalste code vindt niets: een teken anders, een andere namespace, of de hash zelf als code', () => {
  const l = laag();
  const ander = laag('takken-ander');
  const { code, toegang } = l.maak({ ...basis, prefix: 'deur' });
  const rijen = [toegang];
  assert.equal(l.vind(rijen, code), toegang);
  const laatste = code.slice(-1);
  assert.equal(l.vind(rijen, code.slice(0, -1) + (laatste === '0' ? '1' : '0')), null, 'een teken anders');
  assert.equal(l.vind(rijen, code.slice(0, -1)), null, 'een teken te kort');
  assert.equal(l.vind(rijen, code + '0'), null, 'een teken te lang');
  assert.equal(l.vind(rijen, code.split('.')[1]), null, 'zonder voorvoegsel is het een andere code');
  assert.equal(l.vind(rijen, toegang.code_hash), null, 'wie de opgeslagen hash heeft, heeft nog geen code');
  assert.equal(ander.vind(rijen, code), null, 'dezelfde code in een andere namespace opent niets');
  for (const leeg of [undefined, null, '', '   ']) assert.equal(l.vind(rijen, leeg), null, 'leeg: ' + String(leeg));
  assert.equal(l.vind({ a: toegang }, code, () => undefined), null, 'een veldfunctie zonder waarde is geen treffer');
  assert.equal(l.vind([null, undefined], code), null);
  assert.equal(l.vind(null, code), null);
});

test('maak zonder of met een lege opdracht weigert', () => {
  const l = laag('takken-leeg');
  assert.throws(() => l.maak(), /issuer, doel en scope/);
  assert.throws(() => l.maak(null), /issuer, doel en scope/);
  assert.throws(() => l.maak({}), /issuer, doel en scope/);
  assert.throws(() => l.maak({ issuer: 'x', doel: 'y' }), /issuer, doel en scope/, 'zonder scope');
  assert.throws(() => l.maak({ issuer: 'x', scope: ['y'] }), /issuer, doel en scope/, 'zonder doel');
  assert.throws(() => l.maak({ doel: 'x', scope: ['y'] }), /issuer, doel en scope/, 'zonder issuer');
  assert.throws(() => l.maak({ ...basis, scope: [null, '', '  ', undefined] }), /issuer, doel en scope/, 'een scope van alleen lege waarden is leeg');
});

test('maak: een losse scope wordt een lijst, en een te lange doelnaam wordt afgekapt', () => {
  const l = laag();
  assert.deepEqual(l.maak({ ...basis, scope: 'openen' }).toegang.scope, ['openen']);
  const t = l.maak({ ...basis, doel: ' ' + 'd'.repeat(150) + ' ' }).toegang;
  assert.equal(t.doel, 'd'.repeat(100));
  assert.deepEqual(t.onderwerp, {}, 'zonder onderwerp een leeg object, geen null');
});

test('reden: een record zonder scope weigert elke gevraagde scope, ook een losse', () => {
  const l = laag();
  const t = l.maak(basis).toegang;
  const zonder = Object.assign({}, t); delete zonder.scope;
  assert.equal(l.reden(zonder, { doel: 'deur', scope: ['openen'] }), 'scope-ontbreekt');
  assert.equal(l.reden(zonder, { doel: 'deur', scope: 'openen' }), 'scope-ontbreekt', 'een losse scope telt ook');
  assert.equal(l.reden(t, { doel: 'deur', scope: 'sluiten' }), 'scope-ontbreekt');
  assert.equal(l.reden(t, { doel: 'deur', scope: ['openen', 'sluiten'] }), 'scope-ontbreekt', 'een scope te veel is genoeg voor nee');
  assert.equal(l.reden(Object.assign({}, t, { doel: 'DEUR' }), verwacht), 'verkeerd-doel', 'het doel is hoofdlettergevoelig');
});

test('reden: een gemanipuleerde gebruiksteller weigert in plaats van open te gaan', () => {
  const l = laag();
  const t = () => l.maak({ ...basis, maxGebruik: 2 }).toegang;
  for (const fout of [undefined, null, '0', NaN, Infinity, 0.5, 2 ** 53])
    assert.equal(l.reden(Object.assign(t(), { gebruik: fout }), verwacht), 'ongeldige-gebruiksteller', 'gebruik ' + String(fout));
  for (const fout of [undefined, null, '2', NaN, Infinity, 1.5])
    assert.equal(l.reden(Object.assign(t(), { max_gebruik: fout }), verwacht), 'ongeldige-gebruiksteller', 'max ' + String(fout));
  assert.equal(l.reden(Object.assign(t(), { gebruik: 2 }), verwacht), 'opgebruikt');
  assert.equal(l.reden(Object.assign(t(), { gebruik: 7 }), verwacht), 'opgebruikt', 'boven het maximum is ook opgebruikt');
  const ingetrokkenEnKapot = Object.assign(t(), { ingetrokken_at: T0, gebruik: 'x' });
  assert.equal(l.reden(ingetrokkenEnKapot, verwacht), 'ingetrokken', 'intrekking gaat voor de teller');
});

test('reden v2: elk overschreven beveiligingsveld is gemanipuleerd, en een lege controle is dicht', () => {
  const l = laag();
  const vers = () => l.maak(v2spec()).toegang;
  assert.equal(l.reden(vers(), verwacht), null);
  const wijzig = {
    expires_at: '2099-01-01T00:00:00.000Z', scope: ['openen', 'alles'], doel: 'kluis', issuer: 'iemand',
    max_gebruik: 10000, code_hash: h('andere'), onderwerp: { lid: 'ANDER' }, gebruiksvorm: 'sessie',
    stapOp: 'geen', afgeleid: 'perAanroep', bron_toegang: h('ouder'), issued_at: '2020-01-01T00:00:00.000Z',
    contracthash: h('nep')
  };
  for (const [veld, waarde] of Object.entries(wijzig)) {
    const t = vers();
    if (veld === 'stapOp') t.stapOp = 'gebruik'; else t[veld] = waarde;
    assert.equal(l.reden(t, { doel: t.doel, scope: t.scope }), 'gemanipuleerd', veld);
  }
  const zonderHash = vers(); delete zonderHash.contracthash;
  assert.equal(l.reden(zonderHash, verwacht), 'gemanipuleerd', 'een weggehaalde contracthash');
  assert.equal(l.reden(vers(), {}), 'controle-onvolledig');
  assert.equal(l.reden(vers(), { doel: 'deur' }), 'controle-onvolledig', 'zonder scope');
  assert.equal(l.reden(vers(), { scope: ['openen'] }), 'controle-onvolledig', 'zonder doel');
  assert.equal(l.reden(vers(), { doel: 'deur', scope: [] }), 'controle-onvolledig', 'een lege scopelijst');
});

test('reden v2: na de v1-volgorde gaat een sessie niet op, maar een step-up zonder bewijs weigert', () => {
  const l = laag();
  const sessie = l.maak(v2spec({ gebruik: 'sessie' })).toegang;
  for (let i = 0; i < 5; i++) l.gebruik(sessie);
  assert.equal(l.reden(sessie, verwacht), null, 'een sessie telt niet af');
  const teller = l.maak(v2spec({ gebruik: { max: 1 } })).toegang;
  l.gebruik(teller);
  assert.equal(l.reden(teller, verwacht), 'opgebruikt');
  for (const stapOp of ['gebruik', 'beide']) {
    const t = l.maak(v2spec({ stapOp })).toegang;
    assert.equal(l.reden(t, verwacht), 'stap-op-vereist', stapOp);
    assert.equal(l.reden(t, { ...verwacht, stapBewezen: true }), null, stapOp + ' met bewijs');
  }
  assert.equal(l.reden(l.maak(v2spec({ stapOp: 'uitgifte' })).toegang, verwacht), null, 'uitgifte vraagt bij gebruik niets');
  const verlopen = l.maak(v2spec()).toegang;
  l.klok.t = verlopen.expires_at;
  assert.equal(l.reden(verlopen, verwacht), 'verlopen');
});

test('intrekken kapt de actor en de reden af, en een lege actor wordt onbekend', () => {
  const l = laag();
  const t = l.intrekken(l.maak(basis).toegang, 'a'.repeat(250), 'r'.repeat(500));
  assert.equal(t.ingetrokken_door.length, 100);
  assert.equal(t.intrekreden.length, 200);
  const leeg = l.intrekken(l.maak(basis).toegang, '', '');
  assert.deepEqual([leeg.ingetrokken_door, leeg.intrekreden], ['onbekend', 'ingetrokken']);
  assert.equal(l.reden(leeg, verwacht), 'ingetrokken');
});

test('publiek van een record zonder scope geeft een lege lijst en lekt geen hash', () => {
  const l = laag();
  const t = l.maak(basis).toegang; delete t.scope;
  const p = l.publiek(t);
  assert.deepEqual(p.scope, []);
  assert.equal('code_hash' in p, false);
  assert.equal('onderwerp' in p, false);
  assert.equal(l.publiek(undefined), null);
});

test('trekIn op een v1-record sluit de code en zegt eerlijk dat hij afgeleide toegang niet kent', async () => {
  const sporen = [];
  const l = laag('takken-trek', { spoor: s => sporen.push(s.soort) });
  const t = l.maak({ ...basis, geldigMs: DAG }).toegang;
  const uit = await l.trekIn(t, 'kantoor:jan', 'gelekt');
  assert.equal(uit.toegang, t);
  assert.equal(l.reden(t, verwacht), 'ingetrokken');
  assert.ok(uit.afgeleid.onbekend, 'een v1-record mag nooit "niets afgeleid" melden');
  assert.equal('gesloten' in uit.afgeleid, false);
  assert.ok(sporen.includes('ingetrokken'));
});

test('roteer zonder oude toegang weigert, en een geroteerde oude code blijft dicht', () => {
  const l = laag();
  assert.throws(() => l.roteer(null, { actor: 'mw' }), { code: 'niet-roteerbaar' });
  const oud = l.maak(v2spec());
  const nieuw = l.roteer(oud.toegang, { actor: 'mw', prefix: 'deur' });
  assert.notEqual(nieuw.code, oud.code);
  assert.equal(l.vind([oud.toegang, nieuw.toegang], nieuw.code), nieuw.toegang);
  assert.equal(l.reden(oud.toegang, verwacht), 'ingetrokken');
  assert.equal(l.reden(nieuw.toegang, verwacht), null);
});

test('vernieuw weigert zonder oude toegang, zonder mens, of met een leeg doel', () => {
  const l = laag();
  for (const leeg of [null, undefined]) assert.throws(() => l.vernieuw(leeg, v2spec(), 'mw'), { code: 'niet-vernieuwbaar' });
  const oud = l.maak(v2spec()).toegang;
  for (const actor of [undefined, null, '', '   ']) assert.throws(() => l.vernieuw(oud, v2spec(), actor), { code: 'actor-ontbreekt' }, String(actor));
  assert.throws(() => l.vernieuw(oud, v2spec({ doel: undefined }), 'mw'), { code: 'ander-doel' }, 'een ontbrekend doel is niet hetzelfde doel');
  assert.throws(() => l.vernieuw(oud, v2spec({ doel: '' }), 'mw'), { code: 'ander-doel' });
  assert.throws(() => l.vernieuw(oud, v2spec({ issuer: null }), 'mw'), { code: 'ander-issuer' });
  assert.throws(() => l.vernieuw(oud, v2spec({ geldigheid: null }), 'mw'), { code: 'geldigheid-ontbreekt' });
  assert.throws(() => l.vernieuw(oud, v2spec({ geldigheid: { duurMs: 5 } }), 'mw'), { code: 'geldigheid-ongeldig' }, 'een termijn onder de seconde');
  assert.equal(oud.ingetrokken_at, null, 'geen enkele geweigerde vernieuwing trok de oude in');
  assert.equal(l.reden(oud, verwacht), null);
});

test('vernieuw: witruimte rond het doel is hetzelfde doel, en het onderwerp gaat mee tenzij overschreven', () => {
  const l = laag();
  const oud = l.maak(v2spec({ onderwerp: { deur: 'D1' } })).toegang;
  const nieuw = l.vernieuw(oud, v2spec({ doel: '  deur ', onderwerp: undefined }), 'mw');
  assert.equal(nieuw.toegang.doel, 'deur');
  assert.deepEqual(nieuw.toegang.onderwerp, {}, 'een expliciet leeg onderwerp in de spec wint van het oude');
  const zonder = Object.assign({}, v2spec()); delete zonder.onderwerp;
  const oud2 = l.maak(v2spec({ onderwerp: { deur: 'D2' } })).toegang;
  const verder = l.vernieuw(oud2, zonder, 'mw');
  assert.deepEqual(verder.toegang.onderwerp, { deur: 'D2' }, 'zonder onderwerp in de spec gaat het oude mee');
  assert.equal(l.reden(oud, verwacht), 'ingetrokken');
  assert.equal(l.reden(oud2, verwacht), 'ingetrokken');
  assert.equal(l.reden(nieuw.toegang, verwacht), null);
  assert.equal(l.reden(verder.toegang, verwacht), null);
});

test('vernieuw van een oud record zonder doel of uitgever: de spec moet ze zelf leveren', () => {
  const l = laag();
  const oud = l.maak(v2spec()).toegang;
  const kaal = Object.assign({}, oud, { doel: '', issuer: '' });
  assert.throws(() => l.vernieuw(kaal, v2spec({ doel: undefined }), 'mw'), /issuer, doel en scope/, 'zonder doel is er niets uit te geven');
  const nieuw = l.vernieuw(kaal, v2spec(), 'mw');
  assert.equal(nieuw.toegang.doel, 'deur');
  assert.equal(nieuw.toegang.issuer, basis.issuer);
  assert.ok(kaal.ingetrokken_at, 'de oude is dicht');
});

test('leidAf weigert een kind dat breder is dan zijn ouder, of een ouder die niet meer geldt', () => {
  const l = laag();
  const ouder = l.maak(v2spec({ scope: ['openen', 'kijken'], gebruik: { max: 2 } })).toegang;
  const kind = { issuer: basis.issuer, scope: ['kijken'], geldigheid: { duurMs: 2 * DAG }, gebruik: { max: 1 } };
  assert.throws(() => l.leidAf(ouder, { ...kind, scope: ['kijken', 'sluiten'] }), { code: 'verbreding' });
  assert.throws(() => l.leidAf(ouder, { ...kind, scope: [] }), { code: 'verbreding' });
  assert.throws(() => l.leidAf(ouder, { ...kind, gebruik: { max: 3 } }), { code: 'verbreding' });
  assert.throws(() => l.leidAf(ouder, { ...kind, gebruik: 'sessie' }), { code: 'verbreding' });
  const k = l.leidAf(ouder, kind);
  assert.equal(k.toegang.expires_at, ouder.expires_at, 'het kind leeft niet langer dan de ouder');
  assert.equal(l.reden(k.toegang, { doel: 'deur', scope: ['kijken'] }), null);
  assert.equal(l.reden(k.toegang, { doel: 'deur', scope: ['openen'] }), 'scope-ontbreekt');
  const nep = Object.assign({}, ouder, { scope: ['openen', 'kijken', 'alles'] });
  assert.throws(() => l.leidAf(nep, { ...kind, scope: ['alles'] }), { code: 'ouder-ongeldig' }, 'een gemanipuleerde ouder');
  l.intrekken(ouder, 'mw', 'gelekt');
  assert.throws(() => l.leidAf(ouder, kind), { code: 'ouder-ongeldig' });
  assert.throws(() => l.leidAf(null, kind), { code: 'ouder-ongeldig' });
});

test('v1 zonder duur en zonder teller: de stille duur wordt gemeld, de teller wordt 1, en een doelcontrole zonder scope blijft een doelcontrole', () => {
  const sporen = [];
  const l = laag('takken-stil', { spoor: s => sporen.push(s) });
  const t = l.maak({ ...basis, maxGebruik: 0 }).toegang;
  assert.deepEqual(sporen, [{ soort: 'stille-duur', namespace: 'takken-stil', doel: 'deur', at: T0 }]);
  assert.equal(t.max_gebruik, 1, 'nul gebruik wordt geen onbeperkt gebruik');
  assert.equal(l.reden(t, { doel: 'kluis' }), 'verkeerd-doel', 'zonder scope wordt het doel nog steeds getoetst');
  assert.equal(l.reden(t, { doel: 'deur' }), null);
  l.gebruik(t);
  assert.equal(l.reden(t, { doel: 'deur' }), 'opgebruikt', 'na een gebruik is hij dicht');
});

test('een uitgifte zonder doel weigert, ook met een spoor aan, en een spoor draagt nooit een niet-tekst als doel', () => {
  const sporen = [];
  const l = laag('takken-stil-leeg', { spoor: s => sporen.push(s) });
  assert.throws(() => l.maak({ issuer: 'x', scope: ['y'] }), /issuer, doel en scope/);
  assert.throws(() => l.maak({ issuer: 'x', doel: null, scope: ['y'] }), /issuer, doel en scope/);
  assert.ok(sporen.every(s => typeof s.doel === 'string'), 'een leeg doel wordt geen undefined in het spoor');
});
