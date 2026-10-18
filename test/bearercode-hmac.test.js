/* HET HMAC-ZEGEL OP BEARERCODE V2 (server/kern/bearercode-zegel.js, de ring
   in bearercode-sleutelring.js, de migratie in bearercode-migratie.js).

   Besluit van de eigenaar, 14 oktober 2026: een kale hash beschermt niet tegen
   wie zowel het record als de hash kan wijzigen. Het contract op een v2-record
   is daarom een domeingescheiden HMAC-SHA-256 met een sleutel buiten de
   database en een sleutelversie (contractkid) voor rotatie. Deze toetsen nemen
   de aanvaller die de OPSLAG heeft maar niet de sleutel.

   Wat hier niet mag sneuvelen:
   1. wie na een greep in het record de oude kale sha256 opnieuw uitrekent,
      krijgt `gemanipuleerd`; wie de kid weghaalt `ongezegeld` -- nooit open;
   2. een onbekende of uit de ring verwijderde kid is `sleutel-ontbreekt`;
      zonder (leesbare) ring faalt zowel de verificatie als de uitgifte, ook
      roteren, vernieuwen en afleiden; een kapotte ring is geen ring;
   3. rotatie: een oudere kid blijft verifieerbaar zolang hij in de ring staat,
      een nieuwe uitgifte krijgt de nieuwste, en herzegelen met `roteer`
      maakt de oude kid overbodig;
   4. een record met alleen een kale sha256 (van voor de migratie) valt niet
      terug op v1 en niet op een kale controle; de migratie zegelt het alleen
      als die kale hash NU klopt, laat dode en (met maxRestMs) te lang
      openstaande records dicht, en is herhaalbaar;
   5. domeinscheiding: een zegel uit een andere namespace, onder een andere
      kid, of met de ruwe sleutel zonder afleiding, opent niets;
   6. de standaardring komt uit RTG_BEARER_RING of, zonder die, uit
      RTG_SECRET_KEY (afgeleid, met een kid die meeverandert); de
      kandidatenlijst van de migratie mist geen namespace.

   MUTATIES die zijn gedraaid en welke toets erop zakte (LAT.md regel 2):
   - in zegel.toets() `return 'ongezegeld'` vervangen door `return null`
     -> "4. pre-migratie" en "1. herrekende hash" ZAKKEN: een kale hash opende
     weer (RAAK)
   - in de mac de kid uit het bericht gehaald
     -> "5. domeinscheiding" ZAKT: een omgehangen kid met dezelfde
     sleutelbytes bleef geldig (RAAK)
   - in de migratie de voorwaarde `t.contracthash === kaleHash(...)` door
     `true` vervangen
     -> "4. pre-migratie" ZAKT: een vooraf gemanipuleerd record werd
     meegezegeld (RAAK)
   - in leesRing de controle op een dubbele kid weggehaald
     -> "2. zonder sleutel" ZAKT: een ring met twee keer dezelfde kid werd
     aanvaard (RAAK)
   - in zegel() bij een onbekende kid terugvallen op de actieve sleutel
     -> "2. zonder sleutel" ZAKT: herzegelen onder een verwijderde kid lukte
     (RAAK)

   Sleutels maakt deze toets zelf, in het geheugen; er komt niets in de repo.

   Draai: node --test test/bearercode-hmac.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const maakLaag = require('../server/kern/bearercode');
const { kaleHash, maakContractzegel, stabiel, VELDEN } = require('../server/kern/bearercode-zegel');
const sleutelring = require('../server/kern/bearercode-sleutelring');
const { herzegel } = require('../server/kern/bearercode-migratie');

const DAG = 86400000;
const T0 = '2026-10-14T08:00:00.000Z';
const NS = 'hmac-proef';
const sleutel = () => crypto.randomBytes(32);
const ring = (...paren) => ({ actief: paren[0][0], sleutels: new Map(paren) });
const K1 = ['k1', sleutel()], K2 = ['k2', sleutel()];

function laag(r, extra = {}) {
  const klok = { t: T0, ring: r };
  const l = maakLaag(Object.assign({ crypto, namespace: NS, nu: () => klok.t, sleutelring: () => klok.ring }, extra));
  return Object.assign(l, { klok });
}
const basis = { prefix: 'H', issuer: 'zaak:H', doel: 'deur', scope: ['openen'],
  geldigheid: { duurMs: 7 * DAG }, gebruik: { max: 3 }, afgeleid: 'geen' };
const verwacht = { doel: 'deur', scope: ['openen'] };
const fout = code => e => e.code === code;
/* Een record zoals het voor 14 oktober werd uitgegeven: kale sha256, geen kid. */
function oud(l) {
  const t = l.maak(basis).toegang;
  delete t.contractkid;
  t.contracthash = kaleHash(crypto, NS, t);
  return t;
}
const opties = r => ({ crypto, namespaces: ['iets-anders', NS], sleutelring: r, nu: () => T0 });

test('1. een herrekende kale hash opent niets meer', () => {
  const l = laag(ring(K1));
  const t = l.maak(basis).toegang;
  assert.equal(t.contractkid, 'k1');
  assert.match(t.contracthash, /^[a-f0-9]{64}$/);
  assert.notEqual(t.contracthash, kaleHash(crypto, NS, t), 'het zegel is geen kale hash meer');
  assert.equal(l.reden(t, verwacht), null);

  for (const greep of [
    x => { x.expires_at = new Date(Date.parse(x.expires_at) + 300 * DAG).toISOString(); },
    x => { x.scope = ['openen', 'beheren']; },
    x => { x.max_gebruik = 10000; },
    x => { x.onderwerp = { id: 'iemand-anders' }; }
  ]) {
    const a = JSON.parse(JSON.stringify(t));
    greep(a);
    a.contracthash = kaleHash(crypto, NS, a);           // de aanvaller rekent na
    assert.equal(l.reden(a, verwacht), 'gemanipuleerd');
    const b = JSON.parse(JSON.stringify(a));
    delete b.contractkid;                                // en doet alsof het oud is
    assert.equal(l.reden(b, verwacht), 'ongezegeld');
    delete b.contractversie;                             // en alsof het v1 is
    assert.equal(l.reden(b, verwacht), 'ongezegeld', 'een kid-loos record met een contracthash valt niet terug op v1');
  }
});

test('2. zonder sleutel: geen verificatie en geen uitgifte', () => {
  const l = laag(ring(K1));
  const g = l.maak(basis);
  const t = g.toegang;
  for (const r of [null, undefined, {}, { fout: 'kapot' }, { actief: 'k1', sleutels: new Map() }]) {
    l.klok.ring = r;
    assert.equal(l.reden(t, verwacht), 'sleutel-ontbreekt', JSON.stringify(r));
    assert.throws(() => l.maak(basis), fout('sleutel-ontbreekt'));
    assert.throws(() => l.roteer(t), fout('sleutel-ontbreekt'));
    assert.throws(() => l.vernieuw(t, { ...basis }, 'mens:A'), fout('sleutel-ontbreekt'));
  }
  l.klok.ring = ring(K2);
  assert.equal(l.reden(t, verwacht), 'sleutel-ontbreekt', 'een verwijderde kid opent niets');
  assert.throws(() => l.contracthash(t), fout('sleutel-ontbreekt'), 'en wordt niet stil onder de nieuwste herzegeld');
  const vreemd = Object.assign({}, t, { contractkid: 'k9' });
  l.klok.ring = ring(K2, K1);
  assert.equal(l.reden(vreemd, verwacht), 'sleutel-ontbreekt', 'een onbekende kid opent niets');
  assert.throws(() => l.leidAf(Object.assign({}, t, { contractkid: 'k9' }), { scope: ['openen'], gebruik: { max: 1 }, geldigheid: { duurMs: DAG } }));

  const hex = sleutel().toString('hex');
  for (const [tekst, geheim] of [['', null], ['k1', null], ['k1:' + hex.slice(2), null], ['k1:' + hex + ',k1:' + hex, null],
    ['-x:' + hex, null], ['geheim', null], ['k1:' + hex + ',geheim', null]]) {
    const r = sleutelring.leesRing(tekst, geheim);
    assert.ok(r.fout && !r.sleutels, 'geen ring: ' + JSON.stringify(tekst).slice(0, 30));
  }
  const goed = sleutelring.leesRing('k2:' + hex + ',geheim', Buffer.from('s'.repeat(64)));
  assert.equal(goed.actief, 'k2');
  assert.equal(goed.sleutels.size, 2);
});

test('3. rotatie: oud blijft geldig zolang het in de ring staat, nieuw krijgt de nieuwste', () => {
  const l = laag(ring(K1));
  const oudT = l.maak(basis).toegang;
  l.klok.ring = ring(K2, K1);
  const nieuwT = l.maak(basis).toegang;
  assert.equal(nieuwT.contractkid, 'k2');
  assert.equal(l.reden(oudT, verwacht), null, 'k1 staat nog in de ring');
  assert.equal(l.reden(nieuwT, verwacht), null);
  assert.equal(l.roteer(oudT).toegang.contractkid, 'k2', 'roteren zegelt onder de nieuwste');

  const opslag = { rij: l.maak(basis).toegang, oud: JSON.parse(JSON.stringify(oudT)) };
  opslag.oud.ingetrokken_at = null; opslag.oud.ingetrokken_door = null; opslag.oud.intrekreden = null;
  // het ingetrokken_at-veld staat niet in VELDEN, dus het zegel blijft kloppen
  const telling = herzegel(opslag, Object.assign(opties(ring(K2, K1)), { roteer: true }));
  assert.equal(telling.geroteerd, 1);
  assert.equal(telling.inOrde, 1);
  assert.equal(opslag.oud.contractkid, 'k2');
  l.klok.ring = ring(K2);
  assert.equal(l.reden(opslag.oud, verwacht), null, 'na herzegelen kan k1 uit de ring');
  assert.equal(herzegel(opslag, Object.assign(opties(ring(K2)), { roteer: true })).geroteerd, 0, 'herhaalbaar');
});

test('4. pre-migratie: dicht tot de migratie, en alleen wat nu klopt wordt gezegeld', () => {
  const l = laag(ring(K1));
  const kaal = oud(l);
  assert.equal(l.reden(kaal, verwacht), 'ongezegeld', 'geen terugval op een kale controle');
  const v1achtig = Object.assign({}, kaal); delete v1achtig.contractversie; delete v1achtig.gebruiksvorm;
  assert.equal(l.reden(v1achtig, verwacht), 'ongezegeld', 'en ook niet op v1');

  const vooraf = oud(l);
  vooraf.expires_at = new Date(Date.parse(vooraf.expires_at) + DAG).toISOString();   // niet herrekend
  const dood = oud(l); dood.ingetrokken_at = T0;
  const lang = oud(l);
  lang.expires_at = new Date(Date.parse(T0) + 300 * DAG).toISOString();
  lang.contracthash = kaleHash(crypto, NS, lang);   // herrekend: niet te onderscheiden -- behalve op de termijn
  const vreemd = Object.assign(oud(l), { contracthash: kaleHash(crypto, 'onbekend-ns', kaal) });
  const opslag = { a: [kaal, vooraf], b: { dood, lang, vreemd }, v1: l.maak({ ...basis, geldigheid: undefined, geldigMs: DAG }).toegang };

  const telling = herzegel(opslag, Object.assign(opties(ring(K1)), { maxRestMs: 30 * DAG }));
  assert.deepEqual(telling, { bekeken: 5, gemigreerd: 1, geroteerd: 0, inOrde: 0, kaleHashKloptNiet: 2,
    buitenTermijn: 1, nietLevend: 1, sleutelOntbreekt: 0, gemanipuleerd: 0 });
  assert.equal(kaal.contractkid, 'k1');
  assert.equal(l.reden(kaal, verwacht), null, 'na de migratie werkt hij');
  assert.equal(l.reden(vooraf, verwacht), 'ongezegeld', 'een vooraf gemanipuleerd record blijft dicht');
  assert.equal(l.reden(lang, verwacht), 'ongezegeld', 'te lang openstaand: de eigenaar beslist');
  assert.equal(opslag.v1.contractkid, undefined, 'een v1-record wordt niet aangeraakt');
  assert.equal(herzegel(opslag, opties(ring(K1))).gemigreerd, 1, 'zonder termijngrens alsnog het lange record');
  assert.equal(herzegel(opslag, opties(ring(K1))).gemigreerd, 0, 'herhaalbaar: niets dubbel');
  assert.throws(() => herzegel({ x: oud(l) }, opties(null)), fout('sleutel-ontbreekt'), 'zonder sleutel geen migratie');
});

test('5. domeinscheiding: een zegel uit een ander domein opent niets', () => {
  const r = ring(K1);
  const l = laag(r);
  const ander = laag(r, { namespace: 'andere-deur' });
  const t = l.maak(basis).toegang;
  const elders = ander.maak(basis).toegang;
  const geleend = Object.assign({}, t, { contracthash: ander.contracthash(t) });
  assert.equal(l.reden(geleend, verwacht), 'gemanipuleerd', 'een andere namespace');
  assert.equal(ander.reden(Object.assign({}, elders, { code_hash: t.code_hash }), verwacht), 'gemanipuleerd');

  const ruw = crypto.createHmac('sha256', K1[1]).update('rtg-bearer-v2|hmac|' + NS + '|k1|' +
    stabiel(Object.fromEntries(VELDEN.map(k => [k, t[k] === undefined ? null : t[k]])))).digest('hex');
  assert.equal(l.reden(Object.assign({}, t, { contracthash: ruw }), verwacht), 'gemanipuleerd', 'de ruwe sleutel zonder afleiding');

  const tweeling = ring(K1, ['k1b', K1[1]]);            // twee kids, dezelfde bytes
  l.klok.ring = tweeling;
  assert.equal(l.reden(Object.assign({}, t, { contractkid: 'k1b' }), verwacht), 'gemanipuleerd', 'de kid zit in het zegel');
  const z = maakContractzegel({ crypto, ns: NS, sleutelring: tweeling });
  assert.notEqual(z.zegel(t, 'k1').contracthash, z.zegel(t, 'k1b').contracthash);
});

test('6. de standaardring en de kandidaten van de migratie', () => {
  const bewaar = { ring: process.env.RTG_BEARER_RING, geheim: process.env.RTG_SECRET_KEY };
  try {
    process.env.RTG_SECRET_KEY = 'a'.repeat(64);
    delete process.env.RTG_BEARER_RING;
    const r1 = sleutelring.ring();
    assert.match(r1.actief, /^s-[0-9a-f]{8}$/, 'zonder eigen ring: de van RTG_SECRET_KEY afgeleide sleutel');
    assert.equal(sleutelring.ring().actief, r1.actief, 'stabiel');
    assert.notDeepEqual(r1.sleutels.get(r1.actief), Buffer.from('a'.repeat(64), 'hex'), 'afgeleid, niet de sessiesleutel zelf');
    process.env.RTG_SECRET_KEY = 'b'.repeat(64);
    assert.notEqual(sleutelring.ring().actief, r1.actief, 'een ander geheim is een andere kid');
    const hex = sleutel().toString('hex');
    process.env.RTG_BEARER_RING = 'b2026:' + hex + ',geheim';
    const r2 = sleutelring.ring();
    assert.equal(r2.actief, 'b2026');
    assert.equal(r2.sleutels.size, 2);
    process.env.RTG_BEARER_RING = 'stuk';
    assert.ok(sleutelring.ring().fout, 'een kapotte ring is geen ring');
    const l = maakLaag({ crypto, namespace: NS });
    assert.throws(() => l.maak(basis), fout('sleutel-ontbreekt'));
  } finally {
    for (const [k, v] of [['RTG_BEARER_RING', bewaar.ring], ['RTG_SECRET_KEY', bewaar.geheim]]) {
      if (v === undefined) delete process.env[k]; else process.env[k] = v;
    }
  }

  const { kandidaten } = require('../scripts/bearercode-herseal');
  const lijst = new Set(kandidaten());
  const dynamisch = new Set(['server/kern/samen-toegang.js', 'server/kern/link/cap-bak.js', 'server/kern/pay/kasbak.js']);
  const wortel = path.join(__dirname, '..');
  const loop = map => fs.readdirSync(map, { withFileTypes: true }).flatMap(d => d.isDirectory()
    ? (d.name === 'data' ? [] : loop(path.join(map, d.name))) : d.name.endsWith('.js') ? [path.join(map, d.name)] : []);
  for (const f of loop(path.join(wortel, 'server'))) {
    const rel = path.relative(wortel, f).split(path.sep).join('/');
    const bron = fs.readFileSync(f, 'utf8');
    if (!/require\([^)]*bearercode'\)\s*\(/.test(bron) || rel.startsWith('server/kern/bearercode')) continue;
    const letterlijk = [...bron.matchAll(/namespace:\s*'([^']+)'/g)].map(m => m[1]);
    if (!letterlijk.length) { assert.ok(dynamisch.has(rel), rel + ' kiest een namespace die de migratie niet kent'); continue; }
    for (const ns of letterlijk) assert.ok(lijst.has(ns), rel + ': ' + ns);
  }
  for (const ns of ['livingos-samen-kamer', 'foundationos-samen-kamer', 'link.capability', 'pay.kascode', 'pay.tikcode'])
    assert.ok(lijst.has(ns), ns);
});
