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

test('de algemene POS blijft open behalve voor RTG Pay', () => {
  for (const method of ['rtgpay']) {
    const r = roep({ path: '/api/supplier/pos/sale', body: { method } });
    assert.equal(r.status, 503);
    assert.equal(r.door, 0);
  }
  // de cadeaukaart is gemigreerd (kern/cadeaukaart.js) en hangt niet meer aan de grendel
  for (const method of ['contant', 'pin', 'tafel', 'cadeaukaart']) {
    const r = roep({ path: '/api/supplier/pos/sale', body: { method } });
    assert.equal(r.door, 1, method);
  }
});

test('alle alternatieve kassamonts sluiten alleen hun RTG-Pay-tak', () => {
  for (const [pad, veld] of maakPoort.KAS_CONDITIONEEL) {
    const dicht = roep({ path: pad, body: { [veld]: 'rtgpay' } });
    assert.equal(dicht.status, 503, pad);
    assert.equal(dicht.door, 0, pad);
    const open = roep({ path: pad, body: { [veld]: 'contant' } });
    assert.equal(open.door, 1, pad);
  }
  const cap = roep({ path: '/api/link/cap/maak', body: { handeling: 'geld.kassa' } });
  assert.equal(cap.status, 503);
  assert.equal(cap.door, 0);
  assert.equal(roep({ path: '/api/link/cap/maak', body: { handeling: 'contact.verbinden' } }).door, 1);
});

test('iedere bronaanroep van kasInt/kasInnen hoort bij de uitputtende productiegrendel', () => {
  const routeNaarBron = new Map([
    ['/api/supplier/pay/in', 'server/routes/pay-zaak.js'],
    ['/api/festival/verkoop/rond', 'server/routes/festival/verkoop.js'],
    ['/api/supplier/pos/checkout', 'server/routes/supplier/kassa/afrekenen.js'],
    ['/api/supplier/pos/sale', 'server/routes/supplier/kassa/verkoop.js'],
    ['/api/supplier/retail/verkoop', 'server/routes/supplier/retail.js'],
    ['/api/supplier/ticket/deurverkoop', 'server/routes/supplier/tickets.js']
  ]);
  const intern = ['server/kern/pay/kasinnen.js', 'server/kern/pay/kassacode.js'];
  assert.deepEqual(serverAanroepBestanden(/\b(?:pay\.kasInt|kern\.kasInnen)\s*\(/),
    [...routeNaarBron.values(), ...intern].sort());
  for (const [route, bron] of routeNaarBron) {
    assert.ok(maakPoort.EXACT.has(route) || maakPoort.KAS_CONDITIONEEL.has(route), route);
    assert.match(fs.readFileSync(path.join(__dirname, '..', bron), 'utf8'),
      new RegExp("app\\.post\\('" + route.replace(/\//g, '\\/') + "'"), bron);
  }
  assert.ok(maakPoort.EXACT.has('/api/supplier/link/cap/aanvaard'),
    'de Link-consumer in kassacode.js heeft een externe grendel');
  assert.equal(roep({ path: '/api/link/cap/maak', body: { handeling: 'geld.kassa' } }).status, 503,
    'ook de Link-issuer is dicht');
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
  for (const pad of ['/API/PAY/KASCODE', '/api/pay/kascode/', '/api/pay/%6Bascode',
    '/API/PAY/TIK/?x=1']) {
    const r = roep({ url: pad, path: undefined });
    assert.equal(r.status, 503, pad);
    assert.equal(r.door, 0, pad);
  }
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
  for (const id of ['pay.kascode_en_vooraf', 'pay.tikcode']) {
    const deur = register.deuren.find(d => d.id === id);
    assert.ok(deur, id);
    assert.equal(deur.classificatie, 'money_credential', id);
    assert.equal(deur.status, 'remaining', id);
    assert.equal(deur.release_blocker, true, id);
  }
});

test('de gemigreerde afhaalcode is uit de grendel en staat als bewezen deur in het register', () => {
  /* Pas als elke control in code staat en door een toets wordt bewezen, mag een
     geld-dragende code uit deze grendel. Voor de afhaalcode is dat gebeurd
     (server/kern/afhaalcode.js); de bestel- en betaalroutes zijn in productie
     dus weer open, en de kassa geeft alleen uit op de 128-bit afhaalcode. */
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
    const tik = require('../server/kern/pay/tik')({
      crypto, save() { saves++; }, nu: () => 1, tikcodes: () => [], grootboek: () => [],
      rekLid: c => 'lid:' + c, KASCODE_MS: 1000,
      stuur() { throw new Error('geldpad mocht niet worden bereikt'); }
    });
    assert.equal(tik.tikCode({ codenaam: 'A' }).code, maakPoort.CODE);
    assert.equal((await tik.tikBetaal({ van: 'A', code: 'ruw' })).code, maakPoort.CODE);

    /* De tegoedbon is gemigreerd en hangt NIET meer aan deze grendel. Wat hem
       in productie wel tegenhoudt: zonder collectietransactie weigert de bon
       zelf (kern/pay/tegoed-bon.js), zodat een kernaanroep buiten de echte
       opslag nooit een proceslokale claim krijgt. */
    const data = {};
    const bon = require('../server/kern/pay/tegoed-bon')({ d: () => data, save() { saves++; },
      crypto, nu: () => 1 });
    assert.throws(() => bon.transactie(() => ({})), /collectietransactie/);

    const kassa = require('../server/kern/pay/kassa')({
      crypto, save() { saves++; }, nu: () => 1, kascodes: () => [], grootboek: () => [],
      rekLid: c => 'lid:' + c, rekPartner: c => 'partner:' + c, saldoVan: () => 0,
      metIdem() { throw new Error('idem mocht niet worden bereikt'); },
      boek() {}, boekAsync() {}, betaalUit() { throw new Error('geldpad mocht niet worden bereikt'); },
      zorgSaldo() {}, seintje() {}, betaaldienstKosten: () => 0, bijOntvangst: () => ({}),
      opdrachten: { registreerTeruggang() {} }, db: { data: {} }, waarde: null,
      economischeBoekingEenmaal() {}, geldModus: 'schaduw',
      MIN_CENTEN: 1, MAX_CENTEN: 500000, KASCODE_MS: 1000, KASCODE_MAX: 50000
    });
    assert.equal(kassa.kasCode({ codenaam: 'A', maxCenten: 100 }).code, maakPoort.CODE);
    assert.equal((await kassa.kasInt({ supplierCode: 'S', code: 'ruw', centen: 100 })).code, maakPoort.CODE);
    assert.equal(kassa.kasStand('ruw'), null);

    const vooraf = require('../server/kern/pay/vooraf')({});
    assert.equal((await vooraf.kasVooraf({ supplierCode: 'S', code: 'ruw' })).code, maakPoort.CODE);
    assert.equal((await vooraf.kasVastleg({ supplierCode: 'S', reservering: 'R' })).code, maakPoort.CODE);
    assert.equal(vooraf.kasVrijgeef({ supplierCode: 'S', reservering: 'R' }).status, 501,
      'veilig vrijgeven krijgt bewust niet de money-credentialgrendel');

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
