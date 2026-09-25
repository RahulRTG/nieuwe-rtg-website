/* DE STAND VAN DE BEDRIJFSMATEN tegen een echte server
   (POST /api/office/bedrijfsmaat; server/kern/bedrijfsmaat/stand.js).

   Wat hier vastligt:
   1. de deur is de boardroom: geen sessie 401, de gedeelde kantoorcode 403, de
      eigenaar 200 -- en twee keer lezen geeft dezelfde vorm;
   2. elke maat draagt zijn definitie (versie en regel) en wat hij NIET dekt;
   3. de groepspoort werkt in de route en niet alleen in een unittoets: onder de
      tien nieuwe leden in de maand staat er TE_KLEINE_GROEP zonder waarde en
      zonder aantal, en na tien echte registraties een getal;
   4. een registratie laat een pasovergang na (kern/pasgeschiedenis.js via de
      accountlaag), en die telt als nieuw lid in het cohort van deze week;
   5. de omzet staat in centen zonder btw, met het aantal termijnen erbij.

   Draai los: node --test test/bedrijfsmaat-stand.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');
const { isoWeek } = require('../server/kern/bedrijfsmaat/projecties');

const CODE = 'BEDRIJFSMAAT-KANTOOR';
const mappen = [];
let srv, gedeeld, eig;
function api(pad, body, token) {
  return fetch(srv.base + pad, { method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: JSON.stringify(body || {}) }).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}
const stand = () => api('/api/office/bedrijfsmaat', {}, eig);
const maatVan = (b, id) => (b.maten || []).find(m => m.id === id);
let n = 0;
async function registreer() {
  n += 1;
  const r = (await api('/api/auth/register', { name: 'Maat Lid ' + n, email: 'maatlid' + n + '-' + Date.now() + '@voorbeeld.test',
    password: 'geheim123', geboortedatum: '1985-05-05', pasApp: 'rtg' })).body;
  assert.ok(r.token, 'registreren lukt');
  return r;
}

test.before(async () => {
  const m = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-bedrijfsmaat-')); mappen.push(m);
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: m, OFFICE_CODE: CODE } });
  gedeeld = (await api('/api/office/login', { code: CODE })).body.token;
  eig = (await api('/api/auth/login', { login: 'roellie.i@gmail.com', password: 'Imran', pasApp: 'business' })).body.token;
  assert.ok(gedeeld && eig);
});
test.after(() => {
  stop(srv && srv.child);
  for (const m of mappen) { try { fs.rmSync(m, { recursive: true, force: true }); } catch (e) {} }
});

test('1. de boardroom is de deur, en lezen verandert niets', async () => {
  assert.equal((await api('/api/office/bedrijfsmaat', {})).status, 401);
  assert.equal((await api('/api/office/bedrijfsmaat', {}, gedeeld)).status, 403, 'de gedeelde code komt er niet in');
  const a = await stand(), b = await stand();
  assert.equal(a.status, 200);
  assert.deepEqual(b.body.maten.map(m => m.id), a.body.maten.map(m => m.id), 'twee keer lezen, dezelfde maten');
  assert.deepEqual(a.body.besluiten.map(x => x.id), ['C1', 'C2']);
});

test('2. elke maat draagt zijn definitie en wat hij niet dekt', async () => {
  const b = (await stand()).body;
  assert.ok(b.maten.length >= 6);
  for (const m of b.maten) {
    assert.ok(m.definitie && m.definitie.versie >= 1 && m.definitie.regel.length > 20, m.id + ' zonder definitie');
    assert.ok(Array.isArray(m.dektNiet) && m.dektNiet.length > 0, m.id + ' zegt niet wat hij niet dekt');
  }
});

test('3 en 4. de groepspoort in de route, en een registratie is een nieuw lid in dit cohort', async () => {
  const voor = maatVan((await stand()).body, 'acquisitie.nieuwe-leden');
  if (voor.stand === 'TE_KLEINE_GROEP') {
    assert.deepEqual(Object.keys(voor).filter(k => ['waarde', 'n'].includes(k)), [], 'geen waarde en geen aantal onder de grens');
    assert.equal(voor.grens, 10);
  }
  for (let i = 0; i < 10; i++) await registreer();
  const na = (await stand()).body;
  const nieuw = maatVan(na, 'acquisitie.nieuwe-leden');
  assert.equal(nieuw.stand, 'TOONBAAR', 'na tien registraties is de groep groot genoeg');
  assert.ok(nieuw.waarde >= 10, 'en telt hij ze: ' + nieuw.waarde);
  const cohort = maatVan(na, 'cohort.aanmeldweek').cohorten.find(c => c.cohort === isoWeek(Date.now()));
  assert.equal(cohort.grootte.stand, 'TOONBAAR');
  assert.ok(cohort.grootte.waarde >= 10, 'het cohort van deze week draagt de nieuwe leden');
  assert.equal(cohort.activatie.stand, 'TE_KLEINE_GROEP', 'een cohort van vandaag heeft zijn venster nog niet gehad: noemer nul');
});

test('5. omzet in centen zonder btw, met het aantal termijnen', async () => {
  const b = (await stand()).body;
  for (const id of ['omzet.leden-gefactureerd', 'omzet.leden-ontvangen']) {
    const m = maatVan(b, id);
    assert.equal(m.stand, 'TOONBAAR', id + ' gaat over RTG zelf en heeft geen groepsgrens');
    assert.ok(Number.isInteger(m.waarde) && Number.isInteger(m.termijnen), id);
    assert.match(m.eenheid, /zonder btw/);
  }
});

test('6. het ledenregister en de werelden gaan langs de groepspoort, ook voor het kantoorscherm', async () => {
  const r = (await api('/api/office/ledenregister', {}, eig)).body;
  for (const veld of ['perPas', 'perGeslacht', 'perLand', 'perStad', 'perBedrijf'])
    for (const x of r[veld] || [])
      assert.ok(x.aantal == null || x.aantal === 0 || x.aantal >= 10, veld + ' ' + x.naam + ' toont ' + x.aantal + ', onder de grens van tien');
  for (const o of r.omzet || [])
    if (o.aantal == null) assert.equal(o.maandOmzet, null, 'een pas zonder aantal toont ook geen omzet: prijs maal aantal verraadt het');
  const w = (await api('/api/office/economie/werelden', {}, eig)).body;
  for (const x of w.werelden) {
    const grens = { consument: 10, commercieel: 5, rtfoundation: 10 }[x.id];
    if (grens) assert.ok(x.gebruikers == null || x.gebruikers === 0 || x.gebruikers >= grens, x.id + ': ' + x.gebruikers + ' gebruikers onder de grens');
  }
});
