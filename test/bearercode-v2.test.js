/* BEARERCODE VERSIE 2 -- het Access/Grant-contract (kern/bearercode-v2.js).

   De v1-karakterisering staat in test/bearercode.test.js en mag niet bewegen.
   Hier staat wat v2 TOEVOEGT, met per invariant uit het plan (A1-A10) een toets
   en drie eigenschapstoetsen op een geseede generator (geen afhankelijkheid
   erbij: een mislukte seed staat in de melding, zodat hij te herhalen is).

   Draai los: node --test test/bearercode-v2.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const maakLaag = require('../server/kern/bearercode');

const DAG = 86400000;
const T0 = '2026-10-04T12:00:00.000Z';
function laag(extra = {}) {
  const klok = { t: T0 };
  const sporen = [];
  const l = maakLaag(Object.assign({ crypto, namespace: 'proef', nu: () => klok.t, spoor: g => sporen.push(g) }, extra));
  return Object.assign(l, { klok, sporen });
}
const basis = { issuer: 'zaak:PROEF', doel: 'deur', scope: ['openen', 'kijken'], geldigheid: { duurMs: 7 * DAG }, gebruik: { max: 3 }, afgeleid: 'geen' };
const verwacht = { doel: 'deur', scope: ['openen'] };

/* Een kleine geseede generator (mulberry32). */
function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const kies = (r, lijst) => lijst[Math.floor(r() * lijst.length)];

test('A2. geldigheid is verplicht en eindig; geen stille standaard', () => {
  const l = laag();
  const t = l.maak(basis).toegang;
  assert.equal(t.contractversie, 2);
  assert.equal(Date.parse(t.expires_at) - Date.parse(t.issued_at), 7 * DAG);
  const absoluut = l.maak({ ...basis, geldigheid: { verlooptOp: '2026-12-01T00:00:00.000Z' } }).toegang;
  assert.equal(absoluut.expires_at, '2026-12-01T00:00:00.000Z');
  assert.equal(Date.parse(l.maak({ ...basis, geldigheid: { duurMs: 5000 * DAG } }).toegang.expires_at) - Date.parse(T0), 366 * DAG, 'het plafond blijft 366 dagen');
  for (const fout of [null, {}, { duurMs: NaN }, { duurMs: '7' }, { duurMs: 500 }, { duurMs: -DAG }, { duurMs: Infinity },
    { verlooptOp: 'morgen' }, { verlooptOp: '2026-10-01T00:00:00Z' }, { verlooptOp: T0 }, { duurMs: DAG, verlooptOp: '2026-12-01T00:00:00Z' }]) {
    assert.throws(() => l.maak({ ...basis, geldigheid: fout }), e => e.code === 'geldigheid-ongeldig', JSON.stringify(fout));
  }
});

test('gebruik is { max } of sessie, en sessie telt niet af', () => {
  const l = laag();
  for (const fout of [undefined, 0, { max: 0 }, { max: 1.5 }, { max: 10001 }, 'onbeperkt'])
    assert.throws(() => l.maak({ ...basis, gebruik: fout }), e => e.code === 'gebruik-ongeldig', String(fout));
  const s = l.maak({ ...basis, gebruik: 'sessie' }).toegang;
  assert.deepEqual([s.gebruiksvorm, s.max_gebruik], ['sessie', 0]);
  for (let i = 0; i < 5; i++) l.gebruik(s);
  assert.equal(l.reden(s, verwacht), null, 'een sessie raakt niet op');
  const t = l.maak(basis).toegang;
  for (let i = 0; i < 3; i++) l.gebruik(t);
  assert.equal(l.reden(t, verwacht), 'opgebruikt');
});

test('A4. een v2-controle zonder doel of scope is dicht', () => {
  const l = laag();
  const t = l.maak(basis).toegang;
  assert.equal(l.reden(t), 'controle-onvolledig');
  assert.equal(l.reden(t, { doel: 'deur' }), 'controle-onvolledig');
  assert.equal(l.reden(t, { scope: ['openen'] }), 'controle-onvolledig');
  assert.equal(l.reden(t, { doel: 'deur', scope: [] }), 'controle-onvolledig');
  assert.equal(l.reden(t, verwacht), null);
});

test('A3. een beveiligingsveld overschrijven na uitgifte maakt de code dicht', () => {
  const l = laag();
  const wijzig = {
    expires_at: t => { t.expires_at = '2099-01-01T00:00:00.000Z'; }, code_hash: t => { t.code_hash = l.hash('ANDERS'); },
    scope: t => { t.scope.push('alles'); }, max_gebruik: t => { t.max_gebruik = 10000; }, doel: t => { t.doel = 'anders'; },
    onderwerp: t => { t.onderwerp.id = 'X'; }, gebruiksvorm: t => { t.gebruiksvorm = 'sessie'; }, stapOp: t => { t.stapOp = 'geen'; },
    afgeleid: t => { t.afgeleid = 'perAanroep'; }, bron_toegang: t => { t.bron_toegang = 'x'; }, issuer: t => { t.issuer = 'ander'; }
  };
  for (const [veld, f] of Object.entries(wijzig)) {
    const t = l.maak({ ...basis, onderwerp: { id: 'K1' }, stapOp: 'uitgifte' }).toegang;
    f(t);
    assert.equal(l.reden(t, { doel: t.doel, scope: ['openen'] }), 'gemanipuleerd', veld);
  }
  const t = l.maak(basis).toegang;
  l.gebruik(t); t.laatst_gebruikt_at = 'iets';
  assert.equal(l.reden(t, verwacht), null, 'gebruik en laatst_gebruikt_at zijn geen beveiligingsvelden');
});

test('P5. eigenschap: elk beveiligingsveld willekeurig gewijzigd -> gemanipuleerd (10.000 gevallen)', () => {
  const seed = 20261004, r = rng(seed);
  const l = laag();
  const waarden = [null, 0, -1, 1e9, 'x', '', [], ['openen'], {}, { a: 1 }, true, '2099-01-01T00:00:00.000Z'];
  const velden = require('../server/kern/bearercode-v2').VELDEN;
  for (let i = 0; i < 10000; i++) {
    const t = l.maak(basis).toegang;
    const veld = kies(r, velden);
    let nieuw = kies(r, waarden);
    if (JSON.stringify(nieuw) === JSON.stringify(t[veld])) nieuw = 'anders-' + i;
    t[veld] = nieuw;
    assert.equal(l.reden(t, verwacht), 'gemanipuleerd', 'seed ' + seed + ' geval ' + i + ' veld ' + veld + ' = ' + JSON.stringify(nieuw));
  }
});

test('P6. eigenschap: elke geldigheid is een weigering of een einde binnen [1 s, plafond] (10.000 gevallen)', () => {
  const seed = 366, r = rng(seed);
  const l = laag();
  let geslaagd = 0;
  const getallen = [NaN, Infinity, -Infinity, -1, 0, 1, 999, 1000, 1001, DAG, 365 * DAG, 366 * DAG, 3650 * DAG, Number.MAX_SAFE_INTEGER];
  for (let i = 0; i < 10000; i++) {
    const soort = Math.floor(r() * 4);
    const g = soort === 0 ? { duurMs: kies(r, getallen) }
      : soort === 1 ? { duurMs: String(kies(r, getallen)) }
        : soort === 2 ? { verlooptOp: new Date(Date.parse(T0) + (r() - 0.3) * 4000 * DAG).toISOString() }
          : kies(r, [null, undefined, 'x', 5, { verlooptOp: 'nooit' }, { duurMs: DAG, verlooptOp: T0 }]);
    let t = null;
    try { t = l.maak({ ...basis, geldigheid: g }).toegang; } catch (e) {
      assert.ok(['geldigheid-ongeldig'].includes(e.code) || g === undefined, 'seed ' + seed + ' geval ' + i + ': ' + e.message);
      continue;
    }
    const duur = Date.parse(t.expires_at) - Date.parse(t.issued_at);
    assert.ok(duur >= 1000 && duur <= 366 * DAG, 'seed ' + seed + ' geval ' + i + ' ' + JSON.stringify(g) + ' -> ' + duur);
    geslaagd++;
  }
  assert.ok(geslaagd > 2000 && geslaagd < 9000, 'de generator raakt beide uitkomsten (' + geslaagd + ' geslaagd)');
});

test('A10 + F5. trekIn: eerst dicht, dan sluiten; een onbekende uitslag wordt nooit nul', async () => {
  const gesloten = [];
  const ok = laag({ sluit: t => { gesloten.push(t.doel); return { gesloten: 2 }; } });
  const t = ok.maak({ ...basis, afgeleid: 'sluit' }).toegang;
  const uit = await ok.trekIn(t, 'kantoor:a', 'gestolen');
  assert.deepEqual(uit.afgeleid, { gesloten: 2 });
  assert.equal(ok.reden(t, verwacht), 'ingetrokken');
  await ok.trekIn(t, 'kantoor:b', 'nog eens');
  assert.deepEqual([t.ingetrokken_door, t.intrekreden], ['kantoor:a', 'gestolen'], 'de eerste intrekking wint');

  const kapot = laag({ sluit: () => { throw new Error('opslag weg'); } });
  const k = kapot.maak({ ...basis, afgeleid: 'sluit' }).toegang;
  const u2 = await kapot.trekIn(k, 'kantoor:a', 'test');
  assert.match(u2.afgeleid.onbekend, /opslag weg/);
  assert.equal(u2.afgeleid.gesloten, undefined);
  assert.equal(kapot.reden(k, verwacht), 'ingetrokken', 'de intrekking staat ook als het sluiten faalt');

  const vaag = laag({ sluit: async () => ({}) });
  const v = vaag.maak({ ...basis, afgeleid: 'sluit' }).toegang;
  assert.ok((await vaag.trekIn(v, 'a', 'b')).afgeleid.onbekend, 'geen telling is onbekend, geen nul');

  const g = ok.maak(basis).toegang;
  assert.deepEqual((await ok.trekIn(g, 'a', 'b')).afgeleid, { nietNodig: 'geen' });
  const oud = ok.maak({ issuer: 'x', doel: 'deur', scope: ['openen'] }).toegang;
  assert.ok((await ok.trekIn(oud, 'a', 'b')).afgeleid.onbekend, 'een v1-record verklaart niets');
  assert.throws(() => laag().maak({ ...basis, afgeleid: 'sluit' }), e => e.code === 'afgeleid-onverklaard', 'sluit zonder functie');
  assert.throws(() => laag().maak({ ...basis, afgeleid: undefined }), e => e.code === 'afgeleid-onverklaard');
});

test('roteer: nieuwe code, oude dicht, einde nooit later, geschiedenis begrensd', () => {
  const l = laag();
  let { code, toegang } = l.maak({ ...basis, geldigheid: { duurMs: 30 * DAG } });
  l.gebruik(toegang);
  const eind = toegang.expires_at;
  for (let i = 0; i < 25; i++) {
    l.klok.t = new Date(Date.parse(T0) + (i + 1) * 3600000).toISOString();
    const oud = toegang;
    ({ code, toegang } = l.roteer(oud, { actor: 'kantoor:a' }));
    assert.equal(oud.intrekreden, 'geroteerd');
    assert.equal(l.reden(oud, verwacht), 'ingetrokken');
    assert.equal(toegang.expires_at, eind, 'een rotatie verlengt niet');
    assert.equal(toegang.gebruik, 1, 'het gebruik reist mee');
    assert.equal(l.vind([oud, toegang], code), toegang);
  }
  assert.equal(toegang.rotatie, 26);
  assert.equal(toegang.geschiedenis.length, 20);
  assert.equal(l.reden(toegang, verwacht), null);
  const gestolen = l.intrekken(toegang, 'kantoor:a', 'gestolen');
  const vervanger = l.roteer(gestolen, { actor: 'kantoor:b' }).toegang;
  assert.deepEqual([gestolen.ingetrokken_door, gestolen.intrekreden], ['kantoor:a', 'gestolen'], 'de eerste intrekking blijft staan');
  assert.equal(l.reden(vervanger, verwacht), null, 'na intrekken krijgt de houder een nieuwe code');
  assert.throws(() => l.roteer(null), e => e.code === 'niet-roteerbaar');
  l.klok.t = new Date(Date.parse(vervanger.expires_at) + 1000).toISOString();
  assert.throws(() => l.roteer(vervanger, { actor: 'a' }), e => e.code === 'geldigheid-ongeldig', 'verlopen roteert niet');
  const v1 = l.maak({ issuer: 'x', doel: 'deur', scope: ['openen'], geldigMs: DAG }).toegang;
  const nieuw = l.roteer(v1, { actor: 'a', afgeleid: 'geen' }).toegang;
  assert.equal(nieuw.contractversie, 2, 'een v1-record wordt bij rotatie v2');
  assert.equal(nieuw.expires_at, v1.expires_at);
});

test('A1 + P1. leidAf versmalt alleen (10.000 gevallen)', () => {
  const l = laag();
  const ouder = l.maak({ ...basis, gebruik: { max: 10 } }).toegang;
  l.gebruik(ouder); l.gebruik(ouder);
  assert.throws(() => l.leidAf(ouder, { issuer: 'a', scope: ['openen', 'betalen'], geldigheid: { duurMs: DAG }, gebruik: { max: 1 } }), e => e.code === 'verbreding');
  assert.throws(() => l.leidAf(ouder, { issuer: 'a', scope: ['openen'], geldigheid: { duurMs: DAG }, gebruik: { max: 9 } }), e => e.code === 'verbreding');
  assert.throws(() => l.leidAf(ouder, { issuer: 'a', scope: ['openen'], geldigheid: { duurMs: DAG }, gebruik: 'sessie' }), e => e.code === 'verbreding');
  const k = l.leidAf(ouder, { issuer: 'a', scope: ['openen'], geldigheid: { duurMs: 300 * DAG }, gebruik: { max: 8 } }).toegang;
  assert.equal(k.expires_at, ouder.expires_at, 'een kind leeft niet langer dan zijn ouder');
  assert.equal(k.bron_toegang, ouder.code_hash);
  assert.equal(l.reden(k, verwacht), null, 'het ingekorte einde zit in de contracthash');
  l.intrekken(ouder, 'a', 'b');
  assert.throws(() => l.leidAf(ouder, { issuer: 'a', scope: ['openen'], geldigheid: { duurMs: DAG }, gebruik: { max: 1 } }), e => e.code === 'ouder-ongeldig');

  const seed = 42, r = rng(seed);
  const scopes = ['a', 'b', 'c', 'd'];
  let afgeleid = 0;
  for (let i = 0; i < 10000; i++) {
    const os = scopes.filter(() => r() < 0.6); if (!os.length) os.push('a');
    const o = l.maak({ issuer: 'o', doel: 'deur', scope: os, geldigheid: { duurMs: Math.floor(r() * 30 * DAG) + 1000 },
      gebruik: r() < 0.3 ? 'sessie' : { max: 1 + Math.floor(r() * 5) }, afgeleid: 'geen' }).toegang;
    const gevraagd = scopes.filter(() => r() < 0.5);
    const gebruik = r() < 0.2 ? 'sessie' : { max: 1 + Math.floor(r() * 6) };
    let kind;
    try { kind = l.leidAf(o, { issuer: 'k', scope: gevraagd, geldigheid: { duurMs: Math.floor(r() * 60 * DAG) + 1000 }, gebruik }).toegang; }
    catch (e) { assert.ok(['verbreding', 'ouder-ongeldig'].includes(e.code), 'seed ' + seed + ' geval ' + i + ': ' + e.message); continue; }
    const m = 'seed ' + seed + ' geval ' + i;
    assert.ok(kind.scope.every(s => o.scope.includes(s)), m + ' scope');
    assert.ok(Date.parse(kind.expires_at) <= Date.parse(o.expires_at), m + ' einde');
    if (o.gebruiksvorm !== 'sessie') assert.ok(kind.gebruiksvorm === 'teller' && kind.max_gebruik <= o.max_gebruik - o.gebruik, m + ' gebruik');
    afgeleid++;
  }
  assert.ok(afgeleid > 1000, 'de generator leidt ook echt af (' + afgeleid + ' van de 10.000), anders bewijst hij niets');
});

test('stapOp: een doel dat step-up bij gebruik eist, weigert zonder bewijs', () => {
  const l = laag();
  const t = l.maak({ ...basis, stapOp: 'gebruik' }).toegang;
  assert.equal(l.reden(t, verwacht), 'stap-op-vereist');
  assert.equal(l.reden(t, { ...verwacht, stapBewezen: true }), null);
  assert.equal(l.reden(l.maak({ ...basis, stapOp: 'uitgifte' }).toegang, verwacht), null, 'uitgifte is de zaak van het domein');
  assert.throws(() => l.maak({ ...basis, stapOp: 'soms' }), e => e.code === 'stapop-ongeldig');
});

test('spoor en eigen normalisatie', () => {
  const l = laag({ normaal: s => String(s == null ? '' : s).toUpperCase().replace(/[^0-9A-Z]/g, '') });
  const { code, toegang } = l.maak({ ...basis, prefix: 'GC' });
  assert.equal(l.vind([toegang], code.toLowerCase().replace('.', '-')), toegang, 'de hash volgt de normalisatie van het domein');
  l.roteer(toegang, { actor: 'a' });
  assert.deepEqual(l.sporen.map(s => s.soort), ['uitgegeven', 'uitgegeven', 'geroteerd']);
  assert.equal(JSON.stringify(l.sporen).includes(toegang.code_hash), false, 'het spoor draagt geen hash');
});
