/* Integratietests voor het babyboekje (RTF Mini): het dagboek met foto's via de
   mediastore, de rechten (gast erbuiten, weghalen alleen door schrijver of
   beheerder), de gezinsnamen en de AI-gezinsmomenten met demo-terugval, en de
   baby-steuncoach. Draai los: node --experimental-sqlite --test test/baby.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer } = require('./helper');

let BASE;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-baby-'));
let child;

// een piepklein maar geldig 1x1-png'etje als "babyfoto"
const FOTO = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

function fnd(pad, body) {
  return fetch(BASE + '/api/foundation' + pad, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {})
  });
}
function baby(actie, body, sess) {
  return fetch(BASE + '/api/rtf/baby/' + actie, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(Object.assign({ code: sess.code, token: sess.token }, body || {}))
  });
}
const json = r => r.json();

test.before(async () => {
  ({ child, base: BASE } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' }, wachtPad: '/api/foundation/health' }));
});
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

let teller = 0;
async function gezin() {
  const t = Date.now() + '' + (teller++);
  const g = await json(await fnd('/gezin/maak', { gezinsnaam: 'Baby ' + t, naam: 'Mama ' + t, pin: '1234' }));
  return { A: { code: g.code, token: g.token }, code: g.code, gToken: g.token };
}
async function profiel(code, gToken, naam, rol, groep) {
  const p = await json(await fnd('/gezin/profiel/maak', { code, token: gToken, naam, rol, groep }));
  const kies = await json(await fnd('/gezin/profiel/kies', { code, profielId: p.profiel.id }));
  return { code, token: kies.token };
}

test('het boekje: instellen, een momentje met foto en tekst, en weer weghalen', async () => {
  const { A, code, gToken } = await gezin();
  // eerst het kindje voorstellen; zonder naam kan niet
  assert.equal((await baby('instellen', { kindNaam: '  ' }, A)).status, 400);
  const ins = await json(await baby('instellen', { kindNaam: 'Noor', geboren: '2025-11-01' }, A));
  assert.ok(ins.ok && ins.leeftijd, 'het kindje heeft een naam en een leeftijd');
  // leeg momentje wordt geweigerd; met tekst en foto lukt het
  assert.equal((await baby('entry-maak', {}, A)).status, 400);
  const e = await json(await baby('entry-maak', { tekst: 'Vandaag voor het eerst gelachen!', foto: FOTO }, A));
  assert.ok(e.ok && e.entry.foto && e.entry.foto.startsWith('/media/'), 'de foto staat in de mediastore, niet in de data');
  // de foto is echt op te halen
  const img = await fetch(BASE + e.entry.foto);
  assert.equal(img.status, 200);
  assert.match(img.headers.get('content-type') || '', /image\/png/);
  // het boekje toont het momentje met wie het schreef
  const b = await json(await baby('boek', {}, A));
  assert.equal(b.kindNaam, 'Noor');
  assert.equal(b.entries.length, 1);
  assert.match(b.entries[0].tekst, /gelachen/);
  assert.ok(b.entries[0].magWeg, 'wie het schreef mag het weghalen');
  // een ander gezinslid mag andermans momentje niet weghalen; de schrijver wel
  const oom = await profiel(code, gToken, 'Oom', 'gezinslid', 'volw');
  assert.equal((await baby('entry-weg', { id: b.entries[0].id }, oom)).status, 403);
  assert.ok((await json(await baby('entry-weg', { id: b.entries[0].id }, A))).ok);
  // een kapotte foto wordt netjes geweigerd
  assert.equal((await baby('entry-maak', { foto: 'data:image/gif;base64,AAAA' }, A)).status, 400);
});

test('gasten (oppas, familie) komen niet in het boekje', async () => {
  const { A, code, gToken } = await gezin();
  await baby('instellen', { kindNaam: 'Mo' }, A);
  const gast = await profiel(code, gToken, 'Oppas', 'gast', 'volw');
  const r = await baby('boek', {}, gast);
  assert.equal(r.status, 403);
  assert.match((await r.json()).error, /gezin zelf/);
});

test('gezinsnamen en de momenten van de buddy (demo zonder sleutel)', async () => {
  const { A } = await gezin();
  await baby('instellen', { kindNaam: 'Liv' }, A);
  const gz = await json(await baby('gezin-zet', { namen: ['Mila', 'opa Ties', 'Mila', '  '] }, A));
  assert.deepEqual(gz.gezin, ['Mila', 'opa Ties'], 'dubbelen en lege namen vallen weg');
  const m = await json(await baby('moment-ai', {}, A));
  assert.ok(m.ok && m.demo, 'zonder AI-sleutel komt het demosetje');
  assert.equal(m.momenten.items.length, 4);
  const alles = m.momenten.items.map(x => x.titel + ' ' + x.hoe).join(' ');
  assert.match(alles, /Liv/, 'het kindje doet mee in de momenten');
  assert.match(alles, /Mila|opa Ties/, 'de gezinsnamen doen mee');
  // de momenten blijven bewaard in het boekje
  const b = await json(await baby('boek', {}, A));
  assert.equal(b.momenten.items.length, 4);
});

test('de baby-steuncoach praat mee (demo zonder sleutel)', async () => {
  const { A } = await gezin();
  const d = await json(await fnd('/hulp/ai', { code: A.code, token: A.token, kind: 'baby', messages: [{ role: 'user', content: 'Ik ben zo moe, ze slaapt niet door.' }] }));
  assert.ok(d.text && d.text.length > 40, 'de coach geeft een warm antwoord');
  assert.match(d.text, /consultatiebureau/i, 'en wijst de weg naar gratis hulp');
});
