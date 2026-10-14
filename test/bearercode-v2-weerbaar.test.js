/* HET ACCESS/GRANT-CONTRACT ONDER AANVAL (server/kern/bearercode-v2.js).

   v2 is de versie waarin een drager zijn eigen grenzen meedraagt: een
   verplichte, eindige termijn, een gebruiksvorm die nooit per ongeluk
   onbeperkt wordt, een contracthash over de beveiligingsvelden, en een
   intrekking die ook sluit wat er uit de code is ONTSTAAN. test/bearercode-v2.test.js
   houdt de invarianten vast met eigenschapstoetsen; dit bestand neemt de
   aanvaller: een termijn die op een rare manier wordt opgegeven, een record
   waarin na de uitgifte een veld is verschoven (ook velden die de hash niet
   lijkt te dekken), een sluitfunctie die liegt of omvalt, een rotatie of
   afleiding die stilletjes wil verbreden, en een v1-record dat zich als v2
   voordoet.

   Wat hier niet mag sneuvelen:
   1. een termijn is { duurMs } OF { verlooptOp }, eindig en minstens een
      seconde vooruit; beide tegelijk, tekst als duur, een getal als datum of
      een datum in het verleden is een weigering bij uitgifte;
   2. gebruik is { max: 1..10000 } of 'sessie'; nul, breuk, tekst of null is
      een weigering -- nooit een stille standaard;
   3. elk beveiligingsveld dat na uitgifte wijzigt (ook bron_toegang, stapOp,
      afgeleid, gebruiksvorm en een veld diep in het onderwerp) geeft
      `gemanipuleerd`; een record zonder contracthash ook;
   4. een v2-controle zonder doel of zonder scope is dicht, zelfs voor een
      verder geldige code;
   5. trekIn sluit EERST de code; een sluitfunctie die gooit, een negatief of
      gebroken getal teruggeeft of niets zegt, wordt `onbekend` -- nooit nul;
   6. roteren van een v1-record of een ingetrokken record kan, maar een
      verlopen record niet, en de nieuwe code leeft nooit langer;
   7. een kind kan alleen versmallen: ook een ouder met sessiegebruik geeft
      geen bredere scope, en een kind van een opgebruikte ouder bestaat niet;
   8. een sessiecode telt niet af, maar een verlopen of ingetrokken sessiecode
      blijft dicht, en step-up bij gebruik vraagt bewijs;
   9. een kind dat langer wil leven dan zijn ouder wordt ingekort, en dat
      ingekorte einde zit in de contracthash: achteraf rekken sluit het.

   MUTATIES die zijn gedraaid en welke toets erop zakte (LAT.md regel 2):
   - in VELDEN 'bron_toegang' weggehaald
     -> "3. elk beveiligingsveld" ZAKT: een omgehangen bron_toegang bleef
     geldig (RAAK)
   - in trekIn de voorwaarde `uit.gesloten >= 0` weggehaald
     -> "5. trekIn" ZAKT: een negatieve telling werd doorgegeven als gesloten
     (RAAK)
   - in einde de voorwaarde `!('verlooptOp' in g)` weggehaald
     -> "1. de termijn" ZAKT: { duurMs, verlooptOp } samen gaf een code (RAAK)

   Draai: node --test test/bearercode-v2-weerbaar.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const maakLaag = require('../server/kern/bearercode');
const maakV2 = require('../server/kern/bearercode-v2');

const DAG = 86400000;
const T0 = '2026-10-14T08:00:00.000Z';
function laag(extra = {}) {
  const klok = { t: T0 };
  const sporen = [];
  const l = maakLaag(Object.assign({ crypto, namespace: 'v2-weerbaar', nu: () => klok.t, spoor: g => sporen.push(g) }, extra));
  return Object.assign(l, { klok, sporen, schuif: ms => { klok.t = new Date(Date.parse(klok.t) + ms).toISOString(); } });
}
const basis = { prefix: 'G', issuer: 'zaak:W', doel: 'deur', scope: ['openen', 'kijken'],
  geldigheid: { duurMs: 7 * DAG }, gebruik: { max: 3 }, afgeleid: 'geen' };
const verwacht = { doel: 'deur', scope: ['openen'] };
const fout = code => e => e.code === code;

test('1. de termijn: een vorm, eindig, minstens een seconde vooruit', () => {
  const l = laag();
  const slecht = [
    null, 'zeven dagen', 7 * DAG, {}, [],
    { duurMs: 7 * DAG, verlooptOp: '2026-10-20T00:00:00.000Z' },
    { duurMs: '86400000' }, { duurMs: NaN }, { duurMs: Infinity }, { duurMs: 999 }, { duurMs: -DAG }, { duurMs: null },
    { verlooptOp: Date.parse('2026-10-20T00:00:00.000Z') }, { verlooptOp: 'morgen' }, { verlooptOp: null },
    { verlooptOp: T0 }, { verlooptOp: new Date(Date.parse(T0) + 999).toISOString() }, { verlooptOp: '2020-01-01T00:00:00.000Z' }
  ];
  for (const geldigheid of slecht) {
    assert.throws(() => l.maak({ ...basis, geldigheid }), fout('geldigheid-ongeldig'), JSON.stringify(geldigheid) || String(geldigheid));
  }
  assert.equal(l.maak({ ...basis, geldigheid: undefined }).toegang.contractversie, undefined,
    'zonder het veld geldigheid is het bewust v1 (de toegangsdeur tussen de versies)');
  const d = t => Date.parse(t.expires_at) - Date.parse(t.issued_at);
  assert.equal(d(l.maak({ ...basis, geldigheid: { duurMs: 1000 } }).toegang), 1000, 'precies een seconde mag');
  assert.equal(d(l.maak({ ...basis, geldigheid: { duurMs: 1e15 } }).toegang), maakLaag.MAX_GELDIG_MS, 'een te lange duur wordt het plafond');
  const tot = new Date(Date.parse(T0) + 1000).toISOString();
  assert.equal(l.maak({ ...basis, geldigheid: { verlooptOp: tot } }).toegang.expires_at, tot);
  assert.equal(d(l.maak({ ...basis, geldigheid: { verlooptOp: '2099-01-01T00:00:00.000Z' } }).toegang), maakLaag.MAX_GELDIG_MS,
    'een datum ver weg wordt ook het plafond');
  assert.equal(l.sporen.filter(s => s.soort === 'uitgegeven').length, 4, 'alleen echte uitgiftes worden gemeld');
});

test('2. gebruik, afgeleid en stapOp: alleen verklaarde vormen', () => {
  const l = laag();
  for (const gebruik of [undefined, null, 'onbeperkt', 0, 3, {}, { max: 0 }, { max: -1 }, { max: 1.5 }, { max: '3' }, { max: 10001 }, { max: Infinity }]) {
    assert.throws(() => l.maak({ ...basis, gebruik }), fout('gebruik-ongeldig'), JSON.stringify(gebruik) || String(gebruik));
  }
  assert.equal(l.maak({ ...basis, gebruik: { max: 10000 } }).toegang.max_gebruik, 10000);
  const s = l.maak({ ...basis, gebruik: 'sessie' }).toegang;
  assert.equal(s.gebruiksvorm, 'sessie');
  assert.equal(s.max_gebruik, 0);

  for (const afgeleid of [undefined, null, 'alles', 'SLUIT']) {
    assert.throws(() => l.maak({ ...basis, afgeleid }), fout('afgeleid-onverklaard'), String(afgeleid));
  }
  assert.throws(() => l.maak({ ...basis, afgeleid: 'sluit' }), fout('afgeleid-onverklaard'), "'sluit' zonder sluitfunctie is onverklaard");
  for (const stapOp of [null, 'altijd', '']) assert.throws(() => l.maak({ ...basis, stapOp }), fout('stapop-ongeldig'), String(stapOp));
  assert.equal(l.maak({ ...basis, stapOp: undefined }).toegang.stapOp, 'geen', 'zonder stapOp is het geen');

  assert.throws(() => l.maak({ ...basis, issuer: '' }), fout('onvolledig'));
  assert.throws(() => l.maak({ ...basis, doel: undefined }), fout('onvolledig'));
  assert.throws(() => l.maak({ ...basis, scope: [] }), fout('onvolledig'));
  assert.throws(() => l.maak({ ...basis, scope: undefined }), fout('onvolledig'));
  const t = l.maak({ ...basis, onderwerp: undefined, prefix: undefined }).toegang;
  assert.deepEqual(t.onderwerp, {});
  assert.deepEqual(t.geschiedenis, []);
  assert.equal(t.bron_toegang, null);
});

test('3. elk beveiligingsveld dat na uitgifte wijzigt, geeft gemanipuleerd', () => {
  const l = laag();
  const vers = () => l.maak({ ...basis, onderwerp: { lid: 'K1', diep: { zaak: 'Z' } } }).toegang;
  assert.equal(l.reden(vers(), verwacht), null);
  const knoei = {
    issuer: t => { t.issuer = 'zaak:X'; },
    doel: t => { t.doel = 'kluis'; },
    scope: t => { t.scope.push('betalen'); },
    'onderwerp diep': t => { t.onderwerp.diep.zaak = 'Y'; },
    'onderwerp erbij': t => { t.onderwerp.extra = 1; },
    issued_at: t => { t.issued_at = '2026-10-15T00:00:00.000Z'; },
    expires_at: t => { t.expires_at = '2027-10-14T00:00:00.000Z'; },
    max_gebruik: t => { t.max_gebruik = 10000; },
    gebruiksvorm: t => { t.gebruiksvorm = 'sessie'; },
    code_hash: t => { t.code_hash = 'a'.repeat(64); },
    bron_toegang: t => { t.bron_toegang = 'b'.repeat(64); },
    stapOp: t => { t.stapOp = 'uitgifte'; },
    afgeleid: t => { t.afgeleid = 'perAanroep'; },
    'contracthash weg': t => { delete t.contracthash; },
    'contracthash leeg': t => { t.contracthash = ''; }
  };
  for (const [naam, f] of Object.entries(knoei)) {
    const t = vers(); f(t);
    assert.equal(l.reden(t, verwacht), 'gemanipuleerd', naam);
  }
  /* De teller, de intrekking en de geschiedenis veranderen BIJ gebruik en
     staan dus bewust buiten de hash; wat daar misgaat vangt de v1-volgorde. */
  const t = vers(); t.gebruik = 3;
  assert.equal(l.reden(t, verwacht), 'opgebruikt');
  t.gebruik = '1';
  assert.equal(l.reden(t, verwacht), 'ongeldige-gebruiksteller');
  /* Terugzetten naar v1 ontloopt de hash niet: wie de termijn oprekt en dan
     contractversie weghaalt (of op 1 zet), kreeg vroeger een open code met de
     verlengde termijn en zonder step-up. */
  for (const [naam, f] of Object.entries({
    'contractversie weg': t => { delete t.contractversie; },
    'contractversie 1': t => { t.contractversie = 1; },
    'contractversie als tekst': t => { t.contractversie = '2'; }
  })) {
    const t = vers(); t.expires_at = '2027-10-14T00:00:00.000Z'; f(t);
    assert.equal(l.reden(t, verwacht), 'gemanipuleerd', naam + ': geen terugval naar v1');
  }

  const hash = l.contracthash(vers());
  assert.match(hash, /^[a-f0-9]{64}$/);
  const andereNs = maakLaag({ crypto, namespace: 'andere', nu: () => T0 });
  const t2 = vers();
  assert.notEqual(andereNs.contracthash(t2), l.contracthash(t2), 'de namespace zit in de hash');
  assert.equal(andereNs.reden(t2, verwacht), 'gemanipuleerd', 'een record uit een andere namespace opent hier niets');
  assert.deepEqual(maakV2.VELDEN.slice().sort(), ['afgeleid', 'bron_toegang', 'code_hash', 'doel', 'expires_at', 'gebruiksvorm',
    'issued_at', 'issuer', 'max_gebruik', 'onderwerp', 'scope', 'stapOp']);
});

test('4. een v2-controle zonder doel of scope is dicht', () => {
  const l = laag();
  const t = l.maak(basis).toegang;
  assert.equal(l.reden(t), 'controle-onvolledig');
  assert.equal(l.reden(t, {}), 'controle-onvolledig');
  assert.equal(l.reden(t, { doel: 'deur' }), 'controle-onvolledig');
  assert.equal(l.reden(t, { doel: 'deur', scope: [] }), 'controle-onvolledig');
  assert.equal(l.reden(t, { scope: ['openen'] }), 'controle-onvolledig');
  assert.equal(l.reden(t, { doel: 'deur', scope: 'openen' }), null, 'een losse scope is een volledige controle');
  assert.equal(l.reden(t, { doel: 'kluis', scope: 'openen' }), 'verkeerd-doel');
  assert.equal(l.reden(t, { doel: 'deur', scope: 'betalen' }), 'scope-ontbreekt');
});

test('5. trekIn: eerst dicht, dan sluiten -- en een twijfelachtige uitslag is nooit nul', async () => {
  let antwoord;
  const gezien = [];
  const l = laag({ sluit: async t => { gezien.push(t.ingetrokken_at); return antwoord(); } });
  const zaak = () => l.maak({ ...basis, afgeleid: 'sluit' }).toegang;
  const gevallen = [
    [() => ({ gesloten: 4 }), { gesloten: 4 }],
    [() => ({ gesloten: 0 }), { gesloten: 0 }],
    [() => ({ gesloten: -1 }), { onbekend: 'de sluitfunctie gaf geen telling' }],
    [() => ({ gesloten: 1.5 }), { onbekend: 'de sluitfunctie gaf geen telling' }],
    [() => ({ gesloten: '3' }), { onbekend: 'de sluitfunctie gaf geen telling' }],
    [() => ({ onbekend: 'opslag half bereikbaar' }), { onbekend: 'opslag half bereikbaar' }],
    [() => null, { onbekend: 'de sluitfunctie gaf geen telling' }],
    [() => undefined, { onbekend: 'de sluitfunctie gaf geen telling' }],
    [() => { throw new Error('netwerk weg ' + 'x'.repeat(200)); }, null],
    [() => { throw 'kale tekst'; }, { onbekend: 'de sluitfunctie faalde: kale tekst' }],
    [() => { throw null; }, { onbekend: 'de sluitfunctie faalde: null' }]
  ];
  for (const [f, uitslag] of gevallen) {
    antwoord = f;
    const t = zaak();
    const uit = await l.trekIn(t, 'mw', 'gestolen');
    assert.equal(uit.toegang, t);
    assert.equal(l.reden(t, verwacht), 'ingetrokken', 'de code is dicht, wat de sluitfunctie ook doet');
    assert.equal(gezien.at(-1), T0, 'de sluitfunctie ziet een al ingetrokken record');
    if (uitslag) assert.deepEqual(uit.afgeleid, uitslag);
    else {
      assert.match(uit.afgeleid.onbekend, /^de sluitfunctie faalde: netwerk weg x+$/);
      assert.equal(uit.afgeleid.onbekend.length, 'de sluitfunctie faalde: '.length + 120, 'de foutmelding is begrensd');
    }
    assert.ok(!('gesloten' in uit.afgeleid) || Number.isSafeInteger(uit.afgeleid.gesloten) && uit.afgeleid.gesloten >= 0);
  }

  const geen = l.maak({ ...basis, afgeleid: 'perAanroep' }).toegang;
  assert.deepEqual((await l.trekIn(geen, 'mw')).afgeleid, { nietNodig: 'perAanroep' });
  assert.equal(geen.intrekreden, 'ingetrokken');
  const v1 = l.maak({ issuer: 'i', doel: 'deur', scope: ['openen'], geldigMs: DAG }).toegang;
  assert.deepEqual((await l.trekIn(v1, 'mw', 'r')).afgeleid, { onbekend: 'een v1-record verklaart geen afgeleide toegang' });
  assert.equal(v1.ingetrokken_door, 'mw');
  assert.ok(l.sporen.filter(s => s.soort === 'ingetrokken').length >= gevallen.length + 2);
});

test('6. roteren: een v1- of ingetrokken record kan, een verlopen niet, en nooit langer', () => {
  const l = laag();
  assert.throws(() => l.roteer(null, { actor: 'mw' }), fout('niet-roteerbaar'));
  assert.throws(() => l.roteer(undefined), fout('niet-roteerbaar'));

  const v1 = l.maak({ issuer: 'zaak:W', doel: 'deur', scope: ['openen'], geldigMs: 2 * DAG, maxGebruik: 4 });
  l.gebruik(v1.toegang);
  assert.throws(() => l.roteer(v1.toegang, { actor: 'mw' }), fout('afgeleid-onverklaard'), 'een v1-record verklaart afgeleid niet uit zichzelf');
  const nieuw = l.roteer(v1.toegang, { actor: 'mw', afgeleid: 'geen', prefix: 'R' });
  assert.match(nieuw.code, /^R\.[A-F0-9]{32}$/);
  assert.equal(nieuw.toegang.contractversie, 2, 'een rotatie tilt v1 op naar v2');
  assert.equal(nieuw.toegang.expires_at, v1.toegang.expires_at);
  assert.equal(nieuw.toegang.max_gebruik, 4);
  assert.equal(nieuw.toegang.gebruik, 1, 'de teller loopt door: rotatie geeft geen nieuwe pogingen');
  assert.equal(nieuw.toegang.stapOp, 'geen');
  assert.equal(nieuw.toegang.bron_toegang, null);
  assert.equal(nieuw.toegang.rotatie, 2);
  assert.equal(v1.toegang.intrekreden, 'geroteerd');
  assert.equal(l.reden(nieuw.toegang, verwacht), null,
    'de teller is na de hash gezet, maar valt bewust buiten de hash: het record is heel');
  assert.equal(l.reden(v1.toegang, { doel: 'deur', scope: ['openen'] }), 'ingetrokken', 'de v1-code is dicht');
});

test('6b. roteren van een ingetrokken sessiecode houdt de eerste intrekking; verlopen roteert niet', () => {
  const l = laag();
  const oud = l.maak({ ...basis, gebruik: 'sessie', stapOp: 'gebruik' });
  l.intrekken(oud.toegang, 'eerste', 'gestolen');
  const nieuw = l.roteer(oud.toegang, { actor: 'tweede' });
  assert.equal(oud.toegang.ingetrokken_door, 'eerste', 'de eerste intrekking blijft staan');
  assert.equal(oud.toegang.intrekreden, 'gestolen');
  assert.equal(nieuw.toegang.gebruiksvorm, 'sessie');
  assert.equal(nieuw.toegang.stapOp, 'gebruik', 'step-up gaat mee');
  assert.equal(l.reden(nieuw.toegang, verwacht), 'stap-op-vereist');
  assert.equal(l.reden(nieuw.toegang, { ...verwacht, stapBewezen: true }), null);
  assert.equal(nieuw.toegang.geschiedenis.at(-1).door, 'tweede');

  const kort = l.maak({ ...basis, geldigheid: { duurMs: 1000 } }).toegang;
  l.schuif(1000);
  assert.throws(() => l.roteer(kort, { actor: 'mw' }), fout('geldigheid-ongeldig'), 'een verlopen code krijgt geen opvolger');
  assert.equal(kort.ingetrokken_at, null, 'een geweigerde rotatie laat het record ongemoeid');
});

test('7. leidAf: alleen versmallen, ook vanuit een sessie', () => {
  const l = laag();
  assert.throws(() => l.leidAf(null, {}), fout('ouder-ongeldig'));
  const sessie = l.maak({ ...basis, gebruik: 'sessie' }).toegang;
  for (let i = 0; i < 5; i++) l.gebruik(sessie);
  assert.throws(() => l.leidAf(sessie, null), fout('verbreding'), 'een kind zonder scope bestaat niet');
  assert.throws(() => l.leidAf(sessie, { scope: [] }), fout('verbreding'));
  assert.throws(() => l.leidAf(sessie, { scope: ['openen', 'betalen'] }), fout('verbreding'));
  const kind = l.leidAf(sessie, { issuer: 'kind', scope: 'kijken', geldigheid: { duurMs: DAG }, gebruik: { max: 2 }, afgeleid: 'perAanroep', prefix: 'K' });
  assert.match(kind.code, /^K\./);
  assert.deepEqual(kind.toegang.scope, ['kijken']);
  assert.equal(kind.toegang.afgeleid, 'perAanroep', 'het kind mag een eigen afgeleid-vorm verklaren');
  assert.equal(kind.toegang.bron_toegang, sessie.code_hash);
  assert.equal(kind.toegang.doel, sessie.doel, 'het doel is dat van de ouder, altijd');
  const kindSessie = l.leidAf(sessie, { issuer: 'kind', scope: ['openen'], geldigheid: { duurMs: DAG }, gebruik: 'sessie' });
  assert.equal(kindSessie.toegang.gebruiksvorm, 'sessie', 'onder een sessie mag het kind sessie zijn');
  assert.equal(kindSessie.toegang.afgeleid, 'geen', 'zonder eigen keuze erft het kind');
  assert.equal(l.reden(kindSessie.toegang, { doel: 'deur', scope: 'kijken' }), 'scope-ontbreekt');

  const teller = l.maak({ ...basis, gebruik: { max: 2 } }).toegang;
  l.gebruik(teller); l.gebruik(teller);
  assert.throws(() => l.leidAf(teller, { issuer: 'k', scope: ['openen'], geldigheid: { duurMs: DAG }, gebruik: { max: 1 } }),
    e => e.code === 'ouder-ongeldig' && /opgebruikt/.test(e.message), 'een opgebruikte ouder heeft geen kinderen');
  const half = l.maak({ ...basis, gebruik: { max: 2 } }).toegang;
  l.gebruik(half);
  assert.throws(() => l.leidAf(half, { issuer: 'k', scope: ['openen'], geldigheid: { duurMs: DAG } }), fout('verbreding'), 'zonder gebruik is geen kind');
  assert.throws(() => l.leidAf(half, { issuer: 'k', scope: ['openen'], geldigheid: { duurMs: DAG }, gebruik: { max: '1' } }), fout('gebruik-ongeldig'),
    'een max als tekst glipt langs de vergelijking met de rest, maar maak() weigert hem alsnog');
  assert.equal(l.leidAf(half, { issuer: 'k', scope: ['openen'], geldigheid: { duurMs: DAG }, gebruik: { max: 1 } }).toegang.max_gebruik, 1);
  assert.throws(() => l.leidAf(half, { issuer: 'k', scope: ['openen'], geldigheid: { duurMs: 10 } , gebruik: { max: 1 } }), fout('geldigheid-ongeldig'));

  const geknoeid = l.maak(basis).toegang;
  geknoeid.scope.push('betalen');
  assert.throws(() => l.leidAf(geknoeid, { issuer: 'k', scope: ['betalen'], geldigheid: { duurMs: DAG }, gebruik: { max: 1 } }),
    e => e.code === 'ouder-ongeldig' && /gemanipuleerd/.test(e.message), 'een geknoeide ouder leidt niets af');
  const stap = l.maak({ ...basis, stapOp: 'beide' }).toegang;
  const kindStap = l.leidAf(stap, { issuer: 'k', scope: ['openen'], geldigheid: { duurMs: DAG }, gebruik: { max: 1 } });
  assert.equal(kindStap.toegang.stapOp, 'beide', 'step-up erft altijd mee');
  assert.equal(l.reden(kindStap.toegang, verwacht), 'stap-op-vereist');
});

test('8. een sessiecode telt niet af, maar verloopt en sluit wel; step-up vraagt bewijs', () => {
  const l = laag();
  const s = l.maak({ ...basis, gebruik: 'sessie', geldigheid: { duurMs: DAG } }).toegang;
  for (let i = 0; i < 50; i++) l.gebruik(s);
  assert.equal(l.reden(s, verwacht), null, 'vijftig keer gebruikt en nog open');
  l.schuif(DAG);
  assert.equal(l.reden(s, verwacht), 'verlopen');
  l.klok.t = T0;
  l.intrekken(s, 'mw');
  assert.equal(l.reden(s, verwacht), 'ingetrokken');

  const teller = l.maak({ ...basis, gebruik: { max: 1 } }).toegang;
  l.gebruik(teller);
  assert.equal(l.reden(teller, verwacht), 'opgebruikt', 'een teller telt wel af');
  for (const [stapOp, eis] of [['geen', null], ['uitgifte', null], ['gebruik', 'stap-op-vereist'], ['beide', 'stap-op-vereist']]) {
    const t = l.maak({ ...basis, stapOp }).toegang;
    assert.equal(l.reden(t, verwacht), eis, stapOp);
    assert.equal(l.reden(t, { ...verwacht, stapBewezen: true }), null, stapOp + ' met bewijs');
  }
  const opgebruiktStap = l.maak({ ...basis, gebruik: { max: 1 }, stapOp: 'gebruik' }).toegang;
  l.gebruik(opgebruiktStap);
  assert.equal(l.reden(opgebruiktStap, { ...verwacht, stapBewezen: true }), 'opgebruikt', 'bewijs opent geen opgebruikte code');
});

test('9. de v2-fabriek los: meld zonder spoor zwijgt, stabiel is volgorde-ongevoelig', () => {
  const nu = () => T0;
  let n = 0;
  const hash = c => crypto.createHash('sha256').update(String(c)).digest('hex');
  const v2 = maakV2({ crypto, ns: 'los', nu, hash, codeNieuw: p => (p || 'X') + '.' + (++n), plafondMs: DAG });
  assert.doesNotThrow(() => v2.meld('uitgegeven', { doel: 'd' }), 'zonder spoor is melden een stille no-op');
  const a = v2.maak({ issuer: 'i', doel: 'd', scope: ['s'], onderwerp: { b: 1, a: [1, { y: 2, x: undefined }] },
    geldigheid: { duurMs: 5 * DAG }, gebruik: { max: 1 }, afgeleid: 'geen' });
  assert.equal(a.code, 'X.1');
  assert.equal(Date.parse(a.toegang.expires_at) - Date.parse(T0), DAG, 'het plafond van de fabriek geldt');
  const kopie = JSON.parse(JSON.stringify(a.toegang));
  kopie.onderwerp = { a: kopie.onderwerp.a, b: kopie.onderwerp.b };
  assert.equal(v2.contracthash(kopie), a.toegang.contracthash, 'een andere sleutelvolgorde is dezelfde inhoud');
  assert.equal(v2.voorReden(kopie, { doel: 'd', scope: ['s'] }), null);
  assert.equal(v2.naReden(kopie, {}, 'opgebruikt'), 'opgebruikt');
  assert.equal(v2.naReden({ gebruiksvorm: 'sessie' }, {}, 'opgebruikt'), null);
  assert.equal(v2.naReden({ gebruiksvorm: 'sessie' }, {}, 'verlopen'), 'verlopen');
  assert.equal(maakV2.GESCHIEDENIS_MAX, 20);
});

test('10. randen van de hash en de afleiding: ontbrekende velden, lege scope-elementen, een te lang kind', () => {
  const l = laag();
  const t = l.maak({ ...basis, scope: ['openen', null, '', ' kijken '] }).toegang;
  assert.deepEqual(t.scope, ['openen', 'kijken'], 'lege scope-elementen vallen weg, de rest wordt getrimd');
  const kaal = { doel: 'deur' };
  const metUndefined = { doel: 'deur', scope: undefined, onderwerp: { a: undefined } };
  assert.equal(l.contracthash(metUndefined), l.contracthash({ doel: 'deur', scope: null, onderwerp: { a: null } }),
    'undefined en null hashen gelijk (stabiel en vast veldenlijstje): weglaten is geen manier om een andere hash te maken');
  assert.notEqual(l.contracthash(kaal), l.contracthash({ doel: 'kluis' }));
  assert.equal(l.reden(Object.assign({}, t, { contracthash: l.contracthash(kaal) }), verwacht), 'gemanipuleerd',
    'een hash van een kaal record past niet op een volledig record');

  const ouder = l.maak({ ...basis, geldigheid: { duurMs: 2 * DAG } }).toegang;
  const kind = l.leidAf(ouder, { issuer: 'k', scope: ['kijken'], geldigheid: { duurMs: 30 * DAG }, gebruik: { max: 1 }, afgeleid: 'geen' }).toegang;
  assert.equal(kind.expires_at, ouder.expires_at, 'een kind leeft nooit langer dan zijn ouder');
  assert.equal(l.reden(kind, { doel: 'deur', scope: ['kijken'] }), null, 'het ingekorte einde zit in de contracthash');
  kind.expires_at = new Date(Date.parse(ouder.expires_at) + DAG).toISOString();
  assert.equal(l.reden(kind, { doel: 'deur', scope: ['kijken'] }), 'gemanipuleerd', 'wie het kind achteraf rekt, sluit het');
});
