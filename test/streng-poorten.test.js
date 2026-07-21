/* De strenge poorten-veeg over de nieuwe genredomeinen: elke werkplek-API
   weigert anoniemen (401) en zaken zonder het juiste vermogen (403), de
   leden-lagen weigeren gasten (403), en rommel-invoer (HTML-injectie,
   gigastrings, prototype-vergiftiging, diep geneste JSON, onzin-getallen)
   ketst overal netjes af zonder de data of het proces te raken.
   Draai los: node --experimental-sqlite --test test/streng-poorten.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let srv, base, lidTok, restaurant, segur;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-sp-'));

function api(pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}
async function zaak(code) {
  const roster = await api('/api/supplier/roster', { code });
  const wie = roster.body.staff.find(x => x.role === 'manager');
  return (await api('/api/supplier/login', { code, staffId: wie.id, pin: '1234' })).body.token;
}

// de werkplek-basispaden van alle nieuwe genredomeinen (elk achter een eigen cap)
const GENRE_BASES = ['/api/supplier/golf', '/api/supplier/fitclub', '/api/supplier/beauty',
  '/api/supplier/petcare', '/api/supplier/opvang', '/api/supplier/marina',
  '/api/supplier/weddings', '/api/supplier/advies', '/api/supplier/polis',
  '/api/supplier/zorgpolis', '/api/supplier/alpine', '/api/supplier/gebouw'];
// de leden-lagen die om een echte leden-inlog vragen (gasten niet)
const LEDEN_BASES = ['/api/wallet', '/api/kantoorpakket/mijn', '/api/rtgid/inzage', '/api/rtgid/machtig'];

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  const u = Date.now().toString().slice(-8);
  const reg = await api('/api/auth/register', { name: 'Streng Lid', email: 'sp' + u + '@x.nl', phone: '06' + u,
    password: 'geheim123', geboortedatum: '1990-05-05', geslacht: 'v', tier: 'rtg', pasApp: 'rtg' });
  lidTok = reg.body.token;
  restaurant = await zaak('KIKUNOI');
  segur = await zaak('SEGUR');
  assert.ok(lidTok && restaurant && segur, 'alle rollen zijn binnen');
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('1. anoniem komt nergens binnen: elk genredomein geeft 401 zonder zaak-inlog', async () => {
  for (const pad of GENRE_BASES) {
    assert.equal((await api(pad, {})).status, 401, pad + ' hoort 401 te geven zonder inlog');
  }
});

test('2. rol-scheiding: het restaurant heeft geen enkel ander genre-vermogen (overal 403)', async () => {
  for (const pad of GENRE_BASES) {
    assert.equal((await api(pad, {}, restaurant)).status, 403, pad + ' hoort 403 te geven voor een restaurant');
  }
  // en ook op de schrijvende paden, niet alleen op het overzicht
  assert.equal((await api('/api/supplier/zorgpolis/inschrijf', { codenaam: 'x', pakket: 'basis' }, restaurant)).status, 403);
  assert.equal((await api('/api/supplier/golf/tee', { naam: 'x' }, restaurant)).status, 403);
});

test('3. de leden-lagen: anoniem 401, en de gratis gast-laag 403', async () => {
  const gast = (await api('/api/login', { tier: 'guest', pasApp: 'rtg' })).body.token;
  assert.ok(gast, 'de gastinlog werkt');
  for (const pad of LEDEN_BASES) {
    assert.equal((await api(pad, {})).status, 401, pad + ' hoort 401 te geven zonder inlog');
    assert.equal((await api(pad, {}, gast)).status, 403, pad + ' hoort 403 te geven voor een gast');
  }
});

test('4. injectie en vergiftiging: HTML wordt ontsmet, __proto__ raakt niets', async () => {
  const xss = '<img src=x onerror=alert(1)>Boekhandel<script>x</script>';
  const r = await api('/api/wallet/voeg', JSON.parse(JSON.stringify(
    { soort: 'klantenkaart', titel: xss, code: 'K-1', __proto__: { vergiftigd: true }, constructor: { prototype: { vergiftigd: true } } }
  )), lidTok);
  assert.equal(r.status, 200);
  assert.ok(!r.body.item.titel.includes('<') && !r.body.item.titel.includes('>'), 'HTML-tekens zijn eruit');
  assert.equal({}.vergiftigd, undefined, 'het prototype is niet vergiftigd');
  // een gigastring wordt op de veldgrens afgeknipt, niet opgeslagen
  const groot = await api('/api/wallet/voeg', { soort: 'ticket', titel: 'T'.repeat(100000), code: 'C'.repeat(100000) }, lidTok);
  assert.equal(groot.status, 200);
  assert.ok(groot.body.item.titel.length <= 80 && groot.body.item.code.length <= 40, 'veldgrenzen gehandhaafd');
  // een object of array als tekstveld is nooit geldig (schoon maakt het leeg -> 400)
  assert.equal((await api('/api/wallet/voeg', { soort: 'ticket', titel: { a: 1 }, code: ['x'] }, lidTok)).status, 400);
});

test('5. diep geneste JSON ketst af voordat er ook maar iets mee gebeurt', async () => {
  let diep = { einde: true };
  for (let i = 0; i < 300; i++) diep = { d: diep };
  const r = await api('/api/wallet/voeg', { soort: 'klantenkaart', titel: 'x', code: 'y', extra: diep }, lidTok);
  assert.equal(r.status, 400, 'te diep genest hoort 400 te geven');
  // en de server staat gewoon nog overeind
  assert.equal((await api('/api/wallet', {}, lidTok)).status, 200);
});

test('6. onzin-getallen: munten en declaraties weigeren NaN, negatief en te groot', async () => {
  for (const aantal of [-5, 0, 101, 'NaN', 1e9, null]) {
    assert.equal((await api('/api/wallet/munt/koop', { zaak: 'Test', aantal }, lidTok)).status, 400, 'aantal ' + aantal);
  }
  const o = await api('/api/supplier/zorgpolis', {}, segur);
  assert.equal(o.status, 200);
  for (const bedrag of [-1, 0, 25001, 'geen getal', 1e12]) {
    const r = await api('/api/supplier/zorgpolis/declaratie', { pas: 'ZP-0000', omschrijving: 'x', bedrag }, segur);
    assert.ok([400, 409].includes(r.status), 'bedrag ' + bedrag + ' hoort te ketsen (kreeg ' + r.status + ')');
  }
});

test('7. cross-tenant: andermans wallet-item bestaat voor u niet', async () => {
  const k = await api('/api/wallet/voeg', { soort: 'klantenkaart', titel: 'Van lid A', code: 'A-1' }, lidTok);
  assert.equal(k.status, 200);
  const u = (Date.now() + 7).toString().slice(-8);
  const b = await api('/api/auth/register', { name: 'Lid B', email: 'spb' + u + '@x.nl', phone: '06' + u,
    password: 'geheim123', geboortedatum: '1992-02-02', geslacht: 'm', tier: 'rtg', pasApp: 'rtg' });
  assert.equal((await api('/api/wallet/weg', { id: k.body.item.id }, b.body.token)).status, 404, 'weghalen bij een ander kan niet');
  assert.equal((await api('/api/wallet/munt/wissel', { id: k.body.item.id }, b.body.token)).status, 404);
  const wa = await api('/api/wallet', {}, lidTok);
  assert.ok(wa.body.items.some(x => x.id === k.body.item.id), 'het item van A staat er nog gewoon');
});
