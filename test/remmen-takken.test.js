/* DE REMMEN TAK VOOR TAK (server/middleware/remmen.js).

   Wat dit bestand vasthoudt, zonder een echte server: de deurrem hangt altijd
   de AI-context op en telt alleen als hij aan staat (en dan niet voor een
   stroom of een niet-API-pad); de opslagpoort laat health, ready, techniek en
   cluster door en sluit met 503 en Retry-After zolang de opslag niet klaar is
   of de vraag zelf faalt; de hoofdzekering laat bij onderhoud alleen de
   eigenaar door, via de kop of via een stroomticket dat hij zelf ophaalde; en
   de inlogpauze sluit precies de inlogpaden, ook met een slash erachter. De
   verzoeken en antwoorden zijn kleine nabootsingen met alleen wat de remmen
   lezen. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { remOpDeDeur, opslagPoort, hoofdzekering, inlogpauzePoort, INLOG_PADEN, isInlogPad } =
  require('../server/middleware/remmen');

function verzoek(path, { kop, query, ip = '203.0.113.7' } = {}) {
  return { path, ip, query: query || {}, get: (n) => (String(n).toLowerCase() === 'authorization' ? kop : undefined) };
}
function antwoord() {
  const r = { code: 200, kop: {}, lijf: null };
  r.status = (c) => { r.code = c; return r; };
  r.json = (b) => { r.lijf = b; return r; };
  r.set = (k, v) => { r.kop[k] = v; return r; };
  return r;
}
/* Draait een middleware en meldt of next() werd geroepen; wacht op een belofte als hij die afsplitst. */
async function draai(mw, req) {
  const res = antwoord();
  let door = false;
  await new Promise((klaar) => {
    const next = () => { door = true; klaar(); };
    const oudJson = res.json;
    res.json = (b) => { oudJson(b); klaar(); return res; };
    mw(req, res, next);
    setImmediate(klaar);
  });
  await new Promise(r => setImmediate(r));
  return { door, res };
}

test('remOpDeDeur: uit hangt alleen de AI-context op', () => {
  const gebruikt = [];
  remOpDeDeur({ use: (mw) => gebruikt.push(mw) }, false);
  assert.equal(gebruikt.length, 1);
  assert.equal(typeof gebruikt[0], 'function');
});

test('remOpDeDeur: aan telt per IP, sluit boven 300 met 429, en slaat stromen en niet-API over', () => {
  const gebruikt = [];
  remOpDeDeur({ use: (mw) => gebruikt.push(mw) }, true);
  assert.equal(gebruikt.length, 2);
  const deur = gebruikt[1];
  const tel = (path, ip) => { const res = antwoord(); let door = false; deur(verzoek(path, { ip }), res, () => { door = true; }); return { door, res }; };
  for (let i = 0; i < 300; i++) assert.equal(tel('/api/x', '198.51.100.1').door, true);
  const te = tel('/api/x', '198.51.100.1');
  assert.equal(te.door, false);
  assert.equal(te.res.code, 429);
  assert.match(te.res.lijf.error, /te veel verzoeken/);
  assert.equal(tel('/api/office/stream', '198.51.100.1').door, true, 'een stroom telt niet');
  assert.equal(tel('/site/index.html', '198.51.100.1').door, true, 'geen API, geen rem');
  assert.equal(tel('/api/x', '198.51.100.2').door, true, 'een ander IP heeft een eigen teller');
});

test('opslagPoort: niet-API en de technische paden gaan altijd door', async () => {
  const poort = opslagPoort(() => false);
  for (const p of ['/site/a', '/api/health', '/api/ready', '/api/techniek/stand', '/api/cluster/x'])
    assert.equal((await draai(poort, verzoek(p))).door, true, p);
  const zonderPad = (await draai(poort, { query: {}, get() {} }));
  assert.equal(zonderPad.door, true, 'een verzoek zonder pad is geen API-verzoek');
});

test('opslagPoort: zolang de opslag laadt of de vraag faalt een 503 met Retry-After', async () => {
  const klaar = await draai(opslagPoort(() => true), verzoek('/api/leden'));
  assert.equal(klaar.door, true);
  for (const vraag of [() => false, () => { throw new Error('opslag plat'); }]) {
    const { door, res } = await draai(opslagPoort(vraag), verzoek('/api/leden'));
    assert.equal(door, false);
    assert.equal(res.code, 503);
    assert.equal(res.kop['Retry-After'], '2');
    assert.match(res.lijf.error, /laadt zijn gegevens/);
  }
});

const ACCOUNTS = {
  verifyToken: (t) => {
    if (t === 'kapot') throw new Error('handtekening');
    return t === 'baas-tok' || t === 'lid-tok' ? { id: t } : null;
  }
};
const EIGENAAR = { isEigenaar: (acc, u) => u.id === 'baas-tok' };
const dbMet = (zekering) => ({ data: { techniek: { zekeringen: { onderhoud: zekering } } } });

test('hoofdzekering: zonder gesprongen zekering gaat alles door', async () => {
  for (const db of [{ data: null }, { data: {} }, { data: { techniek: {} } }, dbMet({ aan: true })]) {
    const mw = hoofdzekering({ db, accounts: ACCOUNTS, eigenaar: EIGENAAR, stroom: () => null });
    assert.equal((await draai(mw, verzoek('/api/leden'))).door, true);
  }
});

test('hoofdzekering: in onderhoud alleen techniek, health, ready en de eigenaar; de rest 503', async () => {
  const mw = hoofdzekering({ db: dbMet({ aan: false }), accounts: ACCOUNTS, eigenaar: EIGENAAR, stroom: () => null });
  for (const p of ['/api/techniek/zekering', '/api/health', '/api/ready'])
    assert.equal((await draai(mw, verzoek(p))).door, true, p);
  assert.equal((await draai(mw, verzoek('/api/leden', { kop: 'Bearer baas-tok' }))).door, true);
  for (const kop of [undefined, 'Bearer lid-tok', 'Bearer kapot', 'Bearer onbekend']) {
    const { door, res } = await draai(mw, verzoek('/api/leden', { kop }));
    assert.equal(door, false, String(kop));
    assert.equal(res.code, 503);
    assert.match(res.lijf.error, /onderhoud/);
  }
  /* Een pagina buiten de API gaat wel door: dicht() raakt alleen /api/. */
  assert.equal((await draai(mw, verzoek('/site/onderhoud.html'))).door, true);
});

test('hoofdzekering: een eigenaarstoets die faalt is geen eigenaar', async () => {
  const gooit = { isEigenaar() { throw new Error('register plat'); } };
  const mw = hoofdzekering({ db: dbMet({ aan: false }), accounts: ACCOUNTS, eigenaar: gooit, stroom: () => null });
  const { door, res } = await draai(mw, verzoek('/api/leden', { kop: 'Bearer baas-tok' }));
  assert.equal(door, false);
  assert.equal(res.code, 503);
});

test('hoofdzekering: de stroom van de eigenaar opent met zijn eigen ticket, een ander ticket niet', async () => {
  const tickets = { 'T-BAAS': { token: 'baas-tok' }, 'T-LID': { token: 'lid-tok' }, 'T-KAPOT': { token: 'kapot' } };
  const gekeken = [];
  const dienst = { kijk: (t) => { gekeken.push(t); if (t === 'T-FOUT') return Promise.reject(new Error('x')); return tickets[t] || null; } };
  const mw = hoofdzekering({ db: dbMet({ aan: false }), accounts: ACCOUNTS, eigenaar: EIGENAAR, stroom: () => dienst });
  assert.equal((await draai(mw, verzoek('/api/office/stream', { query: { ticket: 'T-BAAS' } }))).door, true);
  for (const t of ['T-LID', 'T-KAPOT', 'T-ONBEKEND', 'T-FOUT']) {
    const { door, res } = await draai(mw, verzoek('/api/office/stream', { query: { ticket: t } }));
    assert.equal(door, false, t);
    assert.equal(res.code, 503, t);
  }
  assert.deepEqual(gekeken, ['T-BAAS', 'T-LID', 'T-KAPOT', 'T-ONBEKEND', 'T-FOUT']);
});

test('hoofdzekering: zonder ticket, met een niet-tekst-ticket of zonder kijkdienst blijft het dicht', async () => {
  let gevraagd = 0;
  const mw = hoofdzekering({ db: dbMet({ aan: false }), accounts: ACCOUNTS, eigenaar: EIGENAAR,
    stroom: () => { gevraagd++; return { kijk: 'geen functie' }; } });
  for (const query of [{}, { ticket: ['a', 'b'] }, { ticket: 'T-X' }]) {
    const { door, res } = await draai(mw, verzoek('/api/office/stream', { query }));
    assert.equal(door, false);
    assert.equal(res.code, 503);
  }
  assert.equal(gevraagd, 1, 'de stroomdienst wordt alleen met een tekstticket gevraagd');
  const geenQuery = await draai(mw, { path: '/api/x', get: () => undefined });
  assert.equal(geenQuery.res.code, 503);
});

test('isInlogPad: elk inlogpad, ook met een slash erachter; andere paden niet', () => {
  for (const p of INLOG_PADEN) {
    assert.equal(isInlogPad(p), true, p);
    assert.equal(isInlogPad(p + '/'), true, p + '/');
  }
  for (const p of ['/api/auth/me', '/api/login/x', '/API/LOGIN', '', null, '/'])
    assert.equal(isInlogPad(p), false, String(p));
});

test('inlogpauzePoort: alleen bij een gesprongen pauze en alleen op een inlogpad', async () => {
  const dicht = { data: { techniek: { zekeringen: { inlogpauze: { aan: false } } } } };
  const mw = inlogpauzePoort({ db: dicht });
  const { door, res } = await draai(mw, verzoek('/api/auth/login/'));
  assert.equal(door, false);
  assert.equal(res.code, 503);
  assert.equal(res.kop['Retry-After'], '60');
  assert.match(res.lijf.error, /gepauzeerd/);
  assert.equal((await draai(mw, verzoek('/api/leden'))).door, true, 'een bestaande sessie merkt niets');
  for (const db of [{ data: null }, { data: { techniek: { zekeringen: {} } } },
    { data: { techniek: { zekeringen: { inlogpauze: { aan: true } } } } },
    { data: { techniek: { zekeringen: { inlogpauze: { aan: false, tot: 1 } } } } }]) {
    assert.equal((await draai(inlogpauzePoort({ db }), verzoek('/api/login'))).door, true, JSON.stringify(db));
  }
});
