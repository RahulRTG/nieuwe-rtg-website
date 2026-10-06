'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const maakPoort = require('../server/middleware/money-credential-productiepoort');

function roep(req, env = { NODE_ENV: 'production' }) {
  let status = 200, json = null, door = 0;
  const res = {
    status(s) { status = s; return this; },
    json(v) { json = v; return v; }
  };
  maakPoort({ env })(Object.assign({ method: 'POST', body: {} }, req), res, () => { door++; });
  return { status, json, door };
}

function serverAanroepBestanden(patroon) {
  const root = path.join(__dirname, '..');
  const gevonden = [];
  function loop(map) {
    for (const naam of fs.readdirSync(map, { withFileTypes: true })) {
      const vol = path.join(map, naam.name);
      if (naam.isDirectory()) loop(vol);
      else if (naam.isFile() && naam.name.endsWith('.js') && patroon.test(fs.readFileSync(vol, 'utf8')))
        gevonden.push(path.relative(root, vol).replace(/\\/g, '/'));
    }
  }
  loop(path.join(root, 'server'));
  return gevonden.sort();
}

test('iedere nog onbewezen money bearer issuer en consumer weigert in productie vóór zijn handler', () => {
  for (const [pad, feature] of maakPoort.EXACT) {
    const geheim = 'MAG-NOOIT-IN-HET-ANTWOORD';
    const r = roep({ path: pad, body: { code: geheim } });
    assert.equal(r.status, 503, pad);
    assert.equal(r.door, 0, pad);
    assert.equal(r.json.code, maakPoort.CODE, pad);
    assert.equal(r.json.feature, feature, pad);
    assert.doesNotMatch(JSON.stringify(r.json), new RegExp(geheim), pad);
  }
});

test('de algemene POS blijft volledig open: cadeaukaart en RTG Pay zijn gemigreerd', () => {
  for (const method of ['contant', 'pin', 'tafel', 'cadeaukaart', 'rtgpay']) {
    const r = roep({ path: '/api/supplier/pos/sale', body: { method } });
    assert.equal(r.door, 1, method);
  }
});

/* De kascode en tikcode zijn gemigreerd (27 september 2026, kern/pay/kasbak.js),
   en de ondertekende Link-drager (link.capability_aanvaarden) sinds 29 september
   2026 ook (besluit B15, kern/link/cap-bak.js): hun routes en de RTG-Pay-tak van
   elke kassa zijn open, ook `geld.kassa` maken en het supplier-loket. Elke
   kascode-inning loopt nog steeds langs EEN claim. */
test('kascode, tik en de Link-drager zijn open; iedere inning blijft op een plek bewaakt', () => {
  for (const pad of ['/api/pay/kascode', '/api/pay/kascode/intrek', '/api/supplier/pay/in',
    '/api/supplier/pay/vooraf', '/api/supplier/pay/vastleg', '/api/pay/tikcode', '/api/pay/tikcode/intrek', '/api/pay/tik'])
    assert.equal(roep({ path: pad, body: { method: 'rtgpay', methode: 'rtgpay' } }).door, 1, pad);
  for (const [pad, body] of [['/api/link/cap/maak', { handeling: 'geld.kassa' }], ['/api/supplier/link/cap/aanvaard', {}],
    ['/api/link/cap/aanvaard', {}], ['/api/link/cap/trek', {}], ['/api/link/cap/maak', { handeling: 'contact.verbinden' }]])
    assert.equal(roep({ path: pad, body }).door, 1, pad);
  assert.equal([...maakPoort.EXACT.values()].includes('link.capability_aanvaarden'), false);
  const deur = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'CODECREDENTIALS.json'), 'utf8'))
    .deuren.find(d => d.id === 'link.capability_aanvaarden');
  assert.equal(deur.status, 'migrated');
  assert.equal(deur.release_blocker, false);
  assert.ok(deur.bewijs.includes('test/linkcap-credential.test.js'));
  assert.ok(deur.bewijs.includes('test/linkcap-credential.pg.test.js'));
  assert.deepEqual(serverAanroepBestanden(/\b(?:pay\.kasInt|kern\.kasInnen)\s*\(/), ['server/kern/pay/kasinnen.js',
    'server/kern/pay/kassacode.js', 'server/routes/festival/verkoop.js', 'server/routes/pay-zaak.js',
    'server/routes/supplier/kassa/afrekenen.js', 'server/routes/supplier/retail.js',
    'server/routes/supplier/kassa/verkoop.js', 'server/routes/supplier/tickets-verkoop.js'].sort());
  const kassa = fs.readFileSync(path.join(__dirname, '..', 'server/kern/pay/kassa.js'), 'utf8');
  assert.match(kassa, /return claim\.neem\(\{ code, soort: 'kas'/, 'kasInt int alleen langs de claim-saga');
  assert.deepEqual(serverAanroepBestanden(/COL: 'pay(?:Kas|Tik)Toegang'/),
    ['server/kern/pay/kassa.js', 'server/kern/pay/tik.js'], 'geen tweede schrijver van de codebakken');
  const reg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'CODECREDENTIALS.json'), 'utf8'));
  for (const id of ['pay.kascode_en_vooraf', 'pay.tikcode']) {
    const deur = reg.deuren.find(d => d.id === id);
    assert.equal(deur.status, 'migrated', id);
    assert.ok(deur.bewijs.includes('test/kascode-routes.test.js'), id);
  }
});

test('de cadeaukaart is gemigreerd: geen grendel, en alleen de kern maakt of claimt een code', () => {
  /* Een cadeaukaartcode ontstaat en wordt verzilverd in kern/cadeaukaart.js
     (128 bits, hash-only, claim in een collectietransactie). De routes roepen
     die kern aan; geen enkele serverplek maakt nog een eigen code of zoekt er
     een op met ===. */
  assert.deepEqual(serverAanroepBestanden(/\bcadeaukaart\.(?:uitgeef|verzilver|roteer|intrek)\s*\(/), [
    'server/routes/member/cadeaukaart.js',
    'server/routes/supplier/kassa/cadeaukaart.js',
    'server/routes/supplier/kassa/verkoop.js'
  ]);
  assert.deepEqual(serverAanroepBestanden(/\b(?:gcCode|verzilverKaart)\s*\(|['"]RTG-GC-['"]\s*\+/), []);
  for (const route of ['/api/giftcard/buy', '/api/giftcards/mine', '/api/giftcard/roteer',
    '/api/supplier/giftcard/sell', '/api/supplier/giftcard/redeem', '/api/supplier/giftcard/intrek',
    '/api/supplier/giftcard/roteer']) assert.equal(roep({ path: route }).door, 1, route);
  assert.equal(roep({ path: '/api/supplier/pos/sale', body: { method: 'cadeaukaart' } }).door, 1);
  assert.equal([...maakPoort.EXACT.values()].includes('pay.giftcard_value_code'), false);
  const register = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'CODECREDENTIALS.json'), 'utf8'));
  const deur = register.deuren.find(d => d.id === 'pay.giftcard_value_code');
  assert.equal(deur.status, 'migrated');
  assert.equal(deur.release_blocker, false);
  assert.ok(deur.bewijs.includes('test/giftcard-credential.test.js'));
  assert.ok(deur.bewijs.includes('test/giftcard-credential.pg.test.js'));
});

test('ontwikkeling blijft bruikbaar en geld terug vrijgeven blijft in productie bereikbaar', () => {
  assert.equal(roep({ path: '/api/pay/kascode' }, { NODE_ENV: 'test' }).door, 1);
  assert.equal(roep({ path: '/api/pay/kascode', method: 'GET' }).door, 1);
  assert.equal(roep({ path: '/api/supplier/pay/vrijgeef' }).door, 1);
  assert.equal(roep({ url: '/api/onbekend?code=geheim' }).door, 1);
});

test('Express-varianten met encoding, hoofdletters of een eindslash zijn geen omweg', () => {
  /* EXACT is sinds B15 leeg; de canonieke lezing van het pad blijft de regel
     voor de volgende deur die hier dicht gaat. Beproefd met een tijdelijke. */
  maakPoort.EXACT.set('/api/proef/geldcode/innen', 'proef.geldcode');
  try {
    for (const pad of ['/API/PROEF/GELDCODE/INNEN', '/api/proef/geldcode/innen/', '/api/proef/geldcode/%69nnen',
      '/API/PROEF/GELDCODE/INNEN/?x=1']) {
      const r = roep({ url: pad, path: undefined });
      assert.equal(r.status, 503, pad);
      assert.equal(r.door, 0, pad);
    }
  } finally { maakPoort.EXACT.delete('/api/proef/geldcode/innen'); }
  assert.equal(roep({ url: '/API/PROEF/GELDCODE/INNEN', path: undefined }).door, 1, 'weg is weg');
});

test('de poort staat na begrensde body-ontleding en vóór idemopslag en domeinhandlers', () => {
  const bron = fs.readFileSync(path.join(__dirname, '..', 'server', 'opzet', 'lijfpoort.js'), 'utf8');
  const body = bron.indexOf("express.json({ limit: '8mb' })");
  const geld = bron.indexOf("require('../middleware/money-credential-productiepoort')()");
  const idem = bron.indexOf("require('../lib/idem-poort')()");
  assert.ok(body >= 0 && geld > body && idem > geld);
  assert.equal((bron.match(/money-credential-productiepoort/g) || []).length, 1);
});

test('de tegoedbon is gemigreerd: geen grendel, wel een bewezen deur', () => {
  for (const pad of ['/api/pay/tegoed', '/api/pay/tegoed/koop', '/api/pay/tegoed/verzilver',
    '/api/pay/tegoed/terug', '/api/pay/tegoed/roteer', '/api/supplier/pay/tegoed',
    '/api/supplier/pay/tegoed/zet', '/api/supplier/pay/tegoed/terug', '/api/supplier/pay/tegoed/roteer']) {
    assert.equal(maakPoort.EXACT.has(pad), false, pad);
    assert.equal(roep({ path: pad }).door, 1, pad);
  }
  const register = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'CODECREDENTIALS.json'), 'utf8'));
  const deur = register.deuren.find(d => d.id === 'pay.tegoedbon');
  assert.equal(deur.status, 'migrated');
  assert.equal(deur.release_blocker, false);
  assert.ok(deur.bewijs.includes('test/tegoedbon-credential.test.js'));
});

test('hard sluiten wordt niet als gemigreerde money lifecycle verkocht', () => {
  const register = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'CODECREDENTIALS.json'), 'utf8'));
  /* Elke deur die deze grendel nog dicht houdt, staat eerlijk als resterende
     releaseblokkade in het register -- nooit als gemigreerd. */
  const dicht = new Set(maakPoort.EXACT.values());
  for (const id of dicht) {
    const deur = register.deuren.find(d => d.id === id);
    assert.ok(deur, id);
    assert.equal(deur.status, 'remaining', id);
    assert.equal(deur.release_blocker, true, id);
  }
});

test('de gemigreerde afhaalcode is uit de grendel en staat als bewezen deur in het register', () => {
  // pas met elke control in code en een toets mag een geld-dragende code uit de grendel
  for (const pad of ['/api/order', '/api/order/pay', '/api/orders/mine',
    '/api/bezorg/bestel', '/api/bezorg/volg', '/api/supplier/pos/redeem',
    '/api/order/afhaalcode', '/api/order/afhaalcode/intrek']) {
    const r = roep({ path: pad });
    assert.equal(r.door, 1, pad);
    assert.equal(r.status, 200, pad);
  }
  assert.equal([...maakPoort.EXACT.values()].includes('pay.order_pickup_code'), false);
  const register = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'CODECREDENTIALS.json'), 'utf8'));
  const deur = register.deuren.find(d => d.id === 'pay.order_pickup_code');
  assert.equal(deur.status, 'migrated');
  assert.equal(deur.release_blocker, false);
  assert.ok(deur.bewijs.includes('test/afhaalcode.test.js'));
  assert.ok(deur.bewijs.includes('test/afhaalcode.pg.test.js'));
});

test('iedere pickupCode-aanroeper maakt een bonnummer, en de kassa zoekt er niet op', () => {
  const root = path.join(__dirname, '..');
  const gevonden = serverAanroepBestanden(/\bpickupCode\(\)/)
    .filter(rel => !/function\s+pickupCode\(\)/.test(fs.readFileSync(path.join(root, rel), 'utf8')));
  assert.deepEqual(gevonden.sort(), [...maakPoort.PICKUP_CODE_ISSUERS.bonnummer].sort());
  const consumer = fs.readFileSync(path.join(root, 'server/routes/supplier/kassa/innen.js'), 'utf8');
  assert.doesNotMatch(consumer, /\.pickup\s*===/, 'de kassa zoekt niet meer op het bonnummer');
  assert.match(consumer, /afhaalcode\.claim\(/, 'de kassa claimt de afhaalcode');
  /* Het bonnummer mag nergens meer als sleutel naar een order dienen: een
     lookup `x.pickup === iets` buiten de keuken- en weergavelagen zou van vier
     tekens alsnog een bearer maken. */
  const zoekers = serverAanroepBestanden(/\.pickup\s*===/);
  assert.deepEqual(zoekers, [], 'geen enkele serverplek zoekt een order op zijn bonnummer');
});

test('kernfuncties kunnen de HTTP-poort in productie niet omzeilen', async () => {
  const oud = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  let saves = 0;
  try {
    /* De tik en de kascode zijn gemigreerd. Zonder collectietransactie weigeren
       ze in productie zelf (kern/pay/kasbak.js), dus een kernaanroep buiten de
       echte opslag krijgt nooit een proceslokale claim of code. */
    const tik = require('../server/kern/pay/tik')({ crypto, save() { saves++; }, nu: () => 1, d: () => ({}),
      grootboek: () => [], rekLid: c => 'lid:' + c, KASCODE_MS: 1000,
      stuur() { throw new Error('geldpad mocht niet worden bereikt'); } });
    await assert.rejects(tik.tikCode({ codenaam: 'A' }), /collectietransactie/);
    await assert.rejects(tik.tikBetaal({ van: 'A', code: 'ruw', idem: 'i' }), /collectietransactie/);

    const data = {};
    const bon = require('../server/kern/pay/tegoed-bon')({ d: () => data, save() { saves++; },
      crypto, nu: () => 1 });
    assert.throws(() => bon.transactie(() => ({})), /collectietransactie/);

    const kassa = require('../server/kern/pay/kassa')({ crypto, save() { saves++; }, nu: () => 1, d: () => data,
      grootboek: () => [], rekLid: c => 'lid:' + c, rekPartner: c => 'partner:' + c, saldoVan: () => 0,
      boek() {}, boekAsync() {}, zorgSaldo() {}, seintje() {}, betaaldienstKosten: () => 0,
      stelSamen() { throw new Error('geldpad mocht niet worden bereikt'); },
      opdrachten: { registreerTeruggang() {} }, db: { data: {} }, waarde: null, schoon: s => s,
      MIN_CENTEN: 1, MAX_CENTEN: 500000, KASCODE_MS: 1000, KASCODE_MAX: 50000 });
    await assert.rejects(kassa.kasCode({ codenaam: 'A', maxCenten: 100 }), /collectietransactie/);
    await assert.rejects(kassa.kasInt({ supplierCode: 'S', code: 'ruw', centen: 100, idem: 'i' }), /collectietransactie/);
    /* De Link-drager is gemigreerd (B15): geen eigen grendel meer, maar ook hier
       geen proceslokale weg -- de kascode eronder en de drager zelf vragen allebei
       een collectietransactie. */
    const def = require('../server/kern/pay/kassacode')({ pay: kassa, schoon: s => s });
    await assert.rejects(def.lees({}, { codenaam: 'A' }), /collectietransactie/);
    await assert.rejects(def.doe({ opdracht: { code: 'ruw' }, invoer: { centen: 100 }, aanvaarder: { code: 'S' }, idem: 'cap:x' }),
      /collectietransactie/);
    const capbak = require('../server/kern/link/cap-bak')({ db: { data: {} }, crypto });
    assert.throws(() => capbak.claim('A'.repeat(32), { door: 'x' }), /collectietransactie/);

    const vooraf = require('../server/kern/pay/vooraf')({});
    assert.equal((await vooraf.kasVrijgeef({ supplierCode: 'S', reservering: 'R' })).status, 501,
      'veilig vrijgeven blijft bereikbaar en krijgt geen grendel');

    /* De cadeaukaart is gemigreerd: zonder collectietransactie bestaat de
       kern niet eens, dus geen kernaanroep kan een proceslokale claim doen. */
    assert.throws(() => require('../server/kern/cadeaukaart')({ db: { data: {} }, crypto }),
      /collectietransactie/);

    assert.equal(saves, 0, 'geen directe kernweigering mag staat bewaren');
  } finally {
    if (oud == null) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = oud;
  }
});
