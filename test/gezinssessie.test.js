/* Het gezinsprofieltoken op een ECHTE server (foundation.family_profile_token_
   buiten_harde_poort, B17): elke uitgifte een nieuwe 128-bit sessie, roteren en
   afmelden door de houder, de beheerder die een profiel of het hele gezin overal
   afmeldt (en een kind dat dat niet kan), de consumers onder /api/rtf op het
   nieuwe token, een uitnodiging die bij twee gelijktijdige tikken precies een
   profiel oplevert, en het kanaal van een gekoppelde oppas dat met het
   ontkoppelen dichtgaat. De eenheid staat in test/gezinstoken.test.js, de race
   over twee PostgreSQL-instances in test/gezinsuitnodiging.pg.test.js.

   Draai los: node --test test/gezinssessie.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { startServer, stop } = require('./helper');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-gezinssessie-'));
let child, base;
test.before(async () => { ({ child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } })); });
test.after(() => { stop(child); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });

async function post(pad, body, extra) {
  const r = await fetch(base + pad, { method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, extra || {}),
    body: JSON.stringify(body || {}) });
  const tekst = await r.text();
  let lijf = {}; try { lijf = JSON.parse(tekst); } catch (e) {}
  return { status: r.status, body: lijf, tekst, koppen: r.headers };
}
const F = (pad, body, extra) => post('/api/foundation' + pad, body, extra);
const mij = (code, token) => fetch(base + '/api/foundation/gezin/' + code + '/mij', { headers: { Authorization: 'Bearer ' + token } }).then(r => r.status);
const GZ = /^GZ\.[0-9A-F]{32}$/;

async function gezin(naam) {
  const g = await F('/gezin/maak', { gezinsnaam: naam, naam: 'Beheerder', pin: '2468', bevoegdGezin: true, privacyAkkoord: true });
  assert.equal(g.status, 200, g.tekst);
  assert.match(g.body.token, GZ, 'de uitgifte is een 128-bit gezinssessie');
  return g.body;
}

test('1. houder: roteren en afmelden, en geen cache die een sessie herhaalt', async () => {
  const g = await gezin('Gezin Roteer');
  assert.equal(await mij(g.code, g.token), 200);
  const rot = await F('/gezin/sessie/roteer', { code: g.code, token: g.token });
  assert.equal(rot.status, 200, rot.tekst);
  assert.equal(rot.koppen.get('cache-control'), 'no-store');
  assert.match(rot.body.token, GZ);
  assert.equal(await mij(g.code, g.token), 403, 'de oude is weg');
  assert.equal(await mij(g.code, rot.body.token), 200);
  const herhaal = await F('/gezin/sessie/roteer', { code: g.code, token: g.token });
  assert.equal(herhaal.status, 403, 'een geroteerde sessie roteert niet nog eens');
  assert.equal(herhaal.tekst.includes(rot.body.token), false, 'en een herhaling heronthult niets');
  const k = { 'Idempotency-Key': 'gezinssessie-' + Date.now() };
  const k1 = await F('/gezin/sessie/roteer', { code: g.code, token: rot.body.token }, k);
  const k2 = await F('/gezin/sessie/roteer', { code: g.code, token: rot.body.token }, k);
  assert.equal(k1.status, 200);
  assert.equal(k2.tekst.includes(k1.body.token), false, 'de retrycache toont de sessie geen tweede keer');
  const af = await F('/gezin/sessie/intrek', { code: g.code, token: k1.body.token });
  assert.equal(af.status, 200, af.tekst);
  assert.equal(await mij(g.code, k1.body.token), 403, 'afgemeld');
  const nogEens = await F('/gezin/sessie/intrek', { code: g.code, token: k1.body.token });
  assert.deepEqual([nogEens.status, nogEens.body.gesloten], [200, 0], 'afmelden is idempotent en zegt dat er niets meer sloot');
  assert.equal(af.body.gesloten, 1);
  const oud = 'a'.repeat(48);
  assert.equal(await mij(g.code, oud), 403, 'een kaal token van de oude vorm opent niets');
});

test('2. beheerder sluit een profiel of het hele gezin; een kind kan dat niet; de consumers volgen', async () => {
  const g = await gezin('Gezin Sluit');
  const kind = await F('/gezin/profiel/maak', { code: g.code, token: g.token, naam: 'Noor', rol: 'kind',
    geboortedatum: '2016-04-12', pin: '1357' });
  assert.equal(kind.status, 200, kind.tekst);
  const kies = await F('/gezin/profiel/kies', { code: g.code, profielId: kind.body.profiel.id, pin: '1357' });
  assert.match(kies.body.token, GZ);
  const kt = kies.body.token;
  // de consumers onder /api/rtf lezen het nieuwe token
  assert.equal((await post('/api/rtf/toegang', { code: g.code, token: kt })).status, 200);
  assert.equal((await post('/api/rtf/bieb', { code: g.code, token: kt })).status, 200);
  // een kind meldt niemand anders af
  const beheerderId = (await (await fetch(base + '/api/foundation/gezin/' + g.code + '/mij', { headers: { Authorization: 'Bearer ' + g.token } })).json()).profiel.id;
  assert.equal((await F('/gezin/sessie/intrek', { code: g.code, token: kt, profielId: beheerderId })).status, 403);
  assert.equal((await F('/gezin/sessie/intrek', { code: g.code, token: kt, profielId: 'alle' })).status, 403);
  assert.equal(await mij(g.code, g.token), 200, 'de beheerder is er nog');
  // de beheerder sluit het kind: elke sessie tegelijk, ook in /api/rtf
  const dicht = await F('/gezin/sessie/intrek', { code: g.code, token: g.token, profielId: kind.body.profiel.id });
  assert.equal(dicht.status, 200, dicht.tekst);
  assert.equal((await post('/api/rtf/toegang', { code: g.code, token: kt })).status, 403);
  assert.equal(await mij(g.code, kt), 403);
  // het kind komt terug met zijn eigen pincode, en een nieuwe pincode sluit hem weer
  const terug = (await F('/gezin/profiel/kies', { code: g.code, profielId: kind.body.profiel.id, pin: '1357' })).body.token;
  assert.equal(await mij(g.code, terug), 200);
  await F('/gezin/profiel/wijzig', { code: g.code, token: g.token, profielId: kind.body.profiel.id, pin: '9753' });
  assert.equal(await mij(g.code, terug), 403, 'een nieuwe pincode meldt het kind overal af');
  // en 'alle' neemt ook de beheerder mee
  assert.equal((await F('/gezin/sessie/intrek', { code: g.code, token: g.token, profielId: 'alle' })).status, 200);
  assert.equal(await mij(g.code, g.token), 403);
});

test('3. een uitnodiging die twee keer tegelijk wordt ingewisseld, levert een profiel', async () => {
  const g = await gezin('Gezin Race');
  const u = await F('/gezin/uitnodiging/maak', { code: g.code, token: g.token, naam: 'Tweede ouder', rol: 'ouder',
    relatie: 'co-ouder', gezagVerklaard: true });
  assert.equal(u.status, 200, u.tekst);
  const lijf = pin => ({ uitnodiging: u.body.uitnodiging, pin, akkoord: true, privacyAkkoord: true });
  const [a, b] = await Promise.all([F('/gezin/uitnodiging/accepteer', lijf('8642')), F('/gezin/uitnodiging/accepteer', lijf('7531'))]);
  const ok = [a, b].filter(r => r.status === 200);
  assert.equal(ok.length, 1, 'precies een tik wint: ' + [a.status, b.status]);
  assert.match(ok[0].body.token, GZ);
  assert.equal([a, b].filter(r => r.status === 404).length, 1);
  assert.equal([a, b].find(r => r.status === 404).tekst.includes('GZ.'), false, 'de verliezer krijgt geen sessie');
  const lid = await (await fetch(base + '/api/foundation/gezin/' + g.code + '/mij', { headers: { Authorization: 'Bearer ' + g.token } })).json();
  assert.equal(lid.profielen.filter(p => p.naam === 'Tweede ouder').length, 1, 'een profiel, niet twee');
});

test('4. het kanaal van een gekoppelde oppas: een verse sessie per keer, en ontkoppelen sluit hem', async () => {
  const g = await gezin('Gezin Kanaal');
  const reg = await post('/api/auth/register', { name: 'Oma', email: 'oma' + Date.now() + '@v.test', phone: '0612345678',
    password: 'geheim123', geboortedatum: '1955-01-01', tier: 'rtg' });
  assert.ok(reg.body.token, reg.tekst);
  const lid = { Authorization: 'Bearer ' + reg.body.token };
  const u = await F('/gezin/uitnodiging/maak', { code: g.code, token: g.token, naam: 'Oma', rol: 'gast', relatie: 'oma' });
  const koppel = await post('/api/rtf/uitnodiging/accepteer', { uitnodiging: u.body.uitnodiging }, lid);
  assert.equal(koppel.status, 200, koppel.tekst);
  assert.equal(koppel.tekst.includes('GZ.'), false, 'koppelen geeft geen sessie; het kanaal wel');
  assert.equal((await post('/api/rtf/uitnodiging/accepteer', { uitnodiging: u.body.uitnodiging }, lid)).status, 404, 'eenmalig');
  const k1 = await post('/api/rtf/kanaal', { code: g.code }, lid);
  const k2 = await post('/api/rtf/kanaal', { code: g.code }, lid);
  assert.match(k1.body.token, GZ);
  assert.notEqual(k1.body.token, k2.body.token, 'nooit dezelfde sessie terug');
  assert.equal(await mij(g.code, k1.body.token), 200);
  assert.equal((await post('/api/rtf/ontkoppel', { code: g.code }, lid)).status, 200);
  assert.equal(await mij(g.code, k1.body.token), 403, 'ontkoppelen sluit elke kanaalsessie');
  assert.equal(await mij(g.code, k2.body.token), 403);
});
