/* KARAKTERISERING VAN kern/bearercode.js (v1) -- vóór er iets aan verandert.

   Fase 1 van het Authority-plan bouwt een v2 van deze laag (geldigheid,
   sessiegebruik, afgeleide codes, rotatie). Twintig domeinen staan er
   vandaag op, en geen enkele toets hield het gedrag van de laag ZELF vast:
   alleen het gedrag van een domein erboven. Deze toetsen leggen v1 vast
   zoals hij IS, inclusief de randen die niemand zou kiezen (NaN wordt 30
   dagen, een negatieve duur wordt 1 seconde), zodat v2 bewust van v1
   afwijkt of niet afwijkt -- nooit per ongeluk.

   Draai los: node --test test/bearercode.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const maakLaag = require('../server/kern/bearercode');

const DAG = 86400000;
const T0 = '2026-10-04T12:00:00.000Z';
function laag(ns = 'proef', tijd = T0) {
  const klok = { t: tijd };
  const l = maakLaag({ crypto, namespace: ns, nu: () => klok.t });
  return Object.assign(l, { klok });
}
const basis = { issuer: 'zaak:PROEF', doel: 'deur', scope: ['openen'] };
const duur = t => Date.parse(t.expires_at) - Date.parse(t.issued_at);

test('1. de duur: standaard 30 dagen, plafond 366 dagen, vloer 1 seconde', () => {
  const l = laag();
  assert.equal(duur(l.maak(basis).toegang), 30 * DAG);
  for (const leeg of [undefined, null, 0, NaN, 'abc']) assert.equal(duur(l.maak({ ...basis, geldigMs: leeg }).toegang), 30 * DAG, String(leeg));
  assert.equal(duur(l.maak({ ...basis, geldigMs: 1000 * DAG }).toegang), 366 * DAG);
  assert.equal(maakLaag.MAX_GELDIG_MS, 366 * DAG);
  assert.equal(duur(l.maak({ ...basis, geldigMs: 5 }).toegang), 1000);
  assert.equal(duur(l.maak({ ...basis, geldigMs: -DAG }).toegang), 1000, 'een negatieve duur wordt de vloer, geen weigering');
  assert.equal(l.maak(basis).toegang.issued_at, T0, 'de uitgiftetijd komt van de meegegeven klok');
});

test('2. de gebruiksteller: standaard 1, afgerond, tussen 1 en 10000', () => {
  const l = laag();
  const m = v => l.maak({ ...basis, maxGebruik: v }).toegang.max_gebruik;
  assert.equal(m(undefined), 1); assert.equal(m(0), 1); assert.equal(m(-4), 1); assert.equal(m(NaN), 1);
  assert.equal(m(2.6), 3); assert.equal(m(99999), 10000);
  const t = l.maak(basis).toegang;
  assert.deepEqual([t.gebruik, t.laatst_gebruikt_at, t.ingetrokken_at, t.rotatie], [0, null, null, 1]);
});

test('3. maak eist issuer, doel en scope, ontdubbelt de scope en kopieert het onderwerp', () => {
  const l = laag();
  for (const mis of ['issuer', 'doel', 'scope']) assert.throws(() => l.maak({ ...basis, [mis]: mis === 'scope' ? [] : '  ' }), /issuer, doel en scope/);
  const onderwerp = { kaart: 'K1' };
  const t = l.maak({ ...basis, scope: ['a', ' a ', '', null, 'b'], onderwerp }).toegang;
  assert.deepEqual(t.scope, ['a', 'b']);
  onderwerp.kaart = 'K2';
  assert.equal(t.onderwerp.kaart, 'K1', 'het onderwerp is een kopie');
  assert.equal(l.maak({ ...basis, issuer: 'x'.repeat(300) }).toegang.issuer.length, 100);
});

test('4. de weigervolgorde: onbekend, doel, scope, ingetrokken, verlopen, teller, opgebruikt', () => {
  const l = laag();
  const t = () => l.maak(basis).toegang;
  assert.equal(l.reden(null), 'onbekend');
  // alles tegelijk fout: het doel wint
  const alles = Object.assign(t(), { ingetrokken_at: T0, expires_at: '2000-01-01T00:00:00Z', gebruik: 5 });
  assert.equal(l.reden(alles, { doel: 'anders', scope: ['x'] }), 'verkeerd-doel');
  assert.equal(l.reden(alles, { doel: 'deur', scope: ['x'] }), 'scope-ontbreekt');
  assert.equal(l.reden(alles, { doel: 'deur', scope: ['openen'] }), 'ingetrokken');
  assert.equal(l.reden(Object.assign(t(), { expires_at: '2000-01-01T00:00:00Z', gebruik: 5 })), 'verlopen');
  assert.equal(l.reden(Object.assign(t(), { gebruik: 1.5 })), 'ongeldige-gebruiksteller');
  assert.equal(l.reden(Object.assign(t(), { max_gebruik: '1' })), 'ongeldige-gebruiksteller');
  assert.equal(l.reden(Object.assign(t(), { gebruik: 1 })), 'opgebruikt');
  assert.equal(l.reden(Object.assign(t(), { gebruik: 1 }), { negeerGebruik: true }), null);
  assert.equal(l.reden(t(), { doel: 'deur', scope: ['openen'] }), null);
  assert.equal(l.reden(t(), {}), null, 'zonder verwachting toetst hij geen doel of scope');
});

test('5. verlopen is op of na de vervaltijd, en een onleesbare vervaltijd telt als verlopen', () => {
  const l = laag();
  const t = l.maak({ ...basis, geldigMs: 60000 }).toegang;
  l.klok.t = new Date(Date.parse(T0) + 59999).toISOString();
  assert.equal(l.reden(t), null);
  l.klok.t = t.expires_at;
  assert.equal(l.reden(t), 'verlopen', 'precies op de vervaltijd is het voorbij');
  l.klok.t = T0;
  assert.equal(l.reden(Object.assign({}, t, { expires_at: 'morgen' })), 'verlopen');
  assert.equal(l.reden(Object.assign({}, t, { expires_at: undefined })), 'verlopen');
});

test('6. gebruik telt op, en de eerste intrekking wint', () => {
  const l = laag();
  const t = l.maak({ ...basis, maxGebruik: 2 }).toegang;
  l.klok.t = '2026-10-05T00:00:00.000Z';
  assert.equal(l.gebruik(t), t);
  assert.deepEqual([t.gebruik, t.laatst_gebruikt_at], [1, '2026-10-05T00:00:00.000Z']);
  l.intrekken(t, 'eerste', 'reden een');
  l.klok.t = '2026-10-06T00:00:00.000Z';
  l.intrekken(t, 'tweede', 'reden twee');
  assert.deepEqual([t.ingetrokken_at, t.ingetrokken_door, t.intrekreden], ['2026-10-05T00:00:00.000Z', 'eerste', 'reden een']);
  const kaal = l.intrekken(l.maak(basis).toegang);
  assert.deepEqual([kaal.ingetrokken_door, kaal.intrekreden], ['onbekend', 'ingetrokken']);
});

test('7. de hash: rtg-bearer-v1|namespace|CODE, genormaliseerd, en per namespace anders', () => {
  const a = laag('a'), b = laag('b');
  const verwacht = crypto.createHash('sha256').update('rtg-bearer-v1|a|ABC.DEF').digest('hex');
  assert.equal(a.hash('abc.def'), verwacht);
  assert.equal(a.hash('  abc.def \n'), verwacht, 'witruimte en kleine letters tellen niet');
  assert.notEqual(b.hash('abc.def'), verwacht, 'een andere namespace geeft een andere hash');
  assert.equal(a.hash(null), crypto.createHash('sha256').update('rtg-bearer-v1|a|').digest('hex'));
});

test('8. de code: voorvoegsel genormaliseerd tot 12 tekens, daarna 128 bits', () => {
  const l = laag();
  assert.match(l.codeNieuw('kaart!'), /^KAART\.[0-9A-F]{32}$/);
  assert.match(l.codeNieuw('heel-lang_voorvoegsel'), /^HEEL-LANG_VO\.[0-9A-F]{32}$/);
  assert.match(l.codeNieuw(''), /^[0-9A-F]{32}$/);
  assert.match(l.codeNieuw('!!!'), /^[0-9A-F]{32}$/, 'een voorvoegsel dat leeg wordt, valt weg');
  const { code, toegang } = l.maak({ ...basis, prefix: 'bon' });
  assert.equal(toegang.code_hash, l.hash(code));
  assert.equal(JSON.stringify(toegang).includes(code.split('.')[1]), false, 'de kale code staat nergens in de toegang');
});

test('9. vind loopt ALLE rijen af, op array en object, op veld of functie', () => {
  const l = laag();
  const een = l.maak(basis), twee = l.maak(basis);
  const rijen = [een.toegang, { code_hash: 'geen-hex' }, null, twee.toegang];
  assert.equal(l.vind(rijen, een.code), een.toegang);
  assert.equal(l.vind(rijen, twee.code.toLowerCase()), twee.toegang);
  assert.equal(l.vind(rijen, 'NIETS'), null);
  assert.equal(l.vind({ x: een.toegang, y: twee.toegang }, twee.code), twee.toegang);
  assert.equal(l.vind([{ h: een.toegang.code_hash }], een.code, 'h').h, een.toegang.code_hash);
  assert.equal(l.vind([{ diep: { h: een.toegang.code_hash } }], een.code, r => r.diep.h).diep.h, een.toegang.code_hash);
  assert.equal(l.vind(undefined, een.code), null);
  // twee rijen met dezelfde hash: de LAATSTE wint, want hij stopt niet bij de eerste
  const dubbel = [{ code_hash: een.toegang.code_hash, n: 1 }, { code_hash: een.toegang.code_hash, n: 2 }];
  assert.equal(l.vind(dubbel, een.code).n, 2);
  // en hij vergelijkt elke rij: tel de aanroepen van de veldfunctie
  let n = 0; l.vind([1, 2, 3, 4].map(() => een.toegang), een.code, r => { n++; return r.code_hash; });
  assert.equal(n, 4);
});

test('10. zelfdeHash weigert alles wat geen 64 hextekens is', () => {
  const l = laag();
  const h = l.hash('x');
  assert.equal(l.zelfdeHash(h, h.toUpperCase()), true);
  for (const fout of [null, '', h.slice(1), h + '0', 'z'.repeat(64)]) assert.equal(l.zelfdeHash(h, fout), false, String(fout));
});

test('11. publiek lekt geen hash, onderwerp of intrekker', () => {
  const l = laag();
  const t = l.intrekken(l.maak({ ...basis, onderwerp: { lid: 'X' } }).toegang, 'kantoor:jan', 'geheim');
  const p = l.publiek(t);
  assert.deepEqual(Object.keys(p).sort(), ['doel', 'expires_at', 'gebruik', 'ingetrokken_at', 'issued_at', 'issuer', 'laatst_gebruikt_at', 'max_gebruik', 'rotatie', 'scope'].sort());
  p.scope.push('extra');
  assert.deepEqual(t.scope, ['openen'], 'de scope in het publieke beeld is een kopie');
  assert.equal(l.publiek(null), null);
});

test('12. de fabriek eist echte crypto en een namespace', () => {
  assert.throws(() => maakLaag({ namespace: 'x' }), /node:crypto/);
  assert.throws(() => maakLaag({ crypto: { randomBytes() {}, createHash() {} }, namespace: 'x' }), /node:crypto/);
  assert.throws(() => maakLaag({ crypto, namespace: '  ' }), /namespace/);
  assert.equal(typeof maakLaag({ crypto, namespace: 'x' }).maak, 'function', 'zonder klok valt hij terug op de systeemtijd');
});

test('13. de stille duur wordt geteld per namespace en doel, en alleen als hij geldt', () => {
  const ns = 'stil-' + process.pid;
  const l = laag(ns), sporen = [];
  const metSpoor = maakLaag({ crypto, namespace: ns + '-s', nu: () => T0, spoor: s => sporen.push(s) });
  const voor = maakLaag.stilleDuur();
  assert.equal(voor[ns + '|deur'], undefined, 'een verse namespace begint zonder telling');
  for (const leeg of [undefined, null, 0, NaN, 'abc']) l.maak({ ...basis, geldigMs: leeg });
  l.maak({ ...basis, geldigMs: DAG });
  l.maak({ ...basis, geldigMs: -DAG });
  l.maak({ ...basis, geldigheid: { duurMs: DAG }, gebruik: { max: 1 }, afgeleid: 'geen' });
  assert.equal(maakLaag.stilleDuur()[ns + '|deur'], 5, 'alleen de vijf lege duren vallen op 30 dagen');
  metSpoor.maak({ ...basis, doel: 'poort' });
  assert.deepEqual(sporen, [{ soort: 'stille-duur', namespace: ns + '-s', doel: 'poort', at: T0 }]);
  assert.equal(maakLaag.stilleDuur()[ns + '-s|poort'], 1);
  const sleutels = Object.keys(maakLaag.stilleDuur()).filter(k => k.startsWith(ns));
  assert.ok(sleutels.every(k => !/ZAAK|PROEF|openen/.test(k)), 'de telling draagt geen uitgever of scope');
});
