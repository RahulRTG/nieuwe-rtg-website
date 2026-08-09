/* Training & tips in de PDA: micro-learning voor het personeel.
   1) De zuivere tip-bibliotheek is rol-bewust en zonder dubbelingen.
   2) In de PDA ziet elk teamlid tips voor de eigen functie plus een tip van de
      dag; een manager kan eigen huistips toevoegen en verwijderen; de coach
      geeft altijd een antwoord (met terugval op de bibliotheek).
   Draai: node --experimental-sqlite --test test/training.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer } = require('./helper');
const training = require('../server/training');

test('bibliotheek: eigen rol-tips plus algemene basis, zonder dubbelingen', () => {
  const bediening = training.tipsVoor('Bediening', 'staff');
  assert.ok(bediening.length >= 4, 'bediening heeft eigen tips');
  assert.ok(bediening.some(t => /rekening/i.test(t.t + t.s)), 'een herkenbare bediening-tip');
  assert.ok(bediening.some(t => t.t === 'Uitblinken zit in details'), 'de algemene basis zit erbij');
  const titels = bediening.map(t => t.t);
  assert.equal(titels.length, new Set(titels).size, 'geen dubbele tips');
});

test('bibliotheek: een manager krijgt ook beheer-tips', () => {
  const staf = training.tipsVoor('Bediening', 'staff');
  const man = training.tipsVoor('Bediening', 'manager');
  assert.ok(man.length > staf.length, 'de manager ziet extra tips');
  assert.ok(man.some(t => /briefing/i.test(t.t + t.s)), 'beheer-tip over de briefing');
});

test('bibliotheek: onbekende functie valt terug op de algemene basis', () => {
  const alg = training.tipsVoor('', 'staff');
  assert.ok(alg.length >= 1);
  assert.ok(alg.every(t => training.ALGEMEEN.some(a => a.t === t.t)), 'alleen algemene tips');
});

test('bibliotheek: de coach kiest een passende tip bij de vraag', () => {
  const hit = training.coachTip('hoe breng ik de rekening netjes?', 'Bediening', 'staff');
  assert.ok(hit && /rekening/i.test(hit.t + hit.s), 'de rekening-tip komt boven');
  const altijd = training.coachTip('iets heel raars zonder trefwoord xyzzy', 'Keuken', 'staff');
  assert.ok(altijd && altijd.t, 'er komt altijd een tip terug');
});

// ---- Endpoint-tests met een draaiende server -----------------------------
let BASE;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-train-'));
let child, kikMan, kikStaf, lidToken;

async function api(pad, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = 'Bearer ' + token;
  return fetch(BASE + pad, { method: 'POST', headers, body: JSON.stringify(body || {}) });
}
const json = r => r.json();
async function login(code, rol) {
  const roster = await json(await api('/api/supplier/roster', { code }));
  const s = roster.staff.find(x => rol === 'manager' ? x.role === 'manager' : x.role !== 'manager');
  return (await json(await api('/api/supplier/login', { code, staffId: s.id, pin: rol === 'manager' ? '1234' : '5678' }))).token;
}

test.before(async () => {
  ({ child, base: BASE } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' } }));
  kikMan = await login('KIKUNOI', 'manager');
  kikStaf = await login('KIKUNOI', 'staff');
  const reg = await json(await api('/api/auth/register', { name: 'Gast Lid', email: 'train@x.nl', phone: '0612345731',
    password: 'geheim123', geboortedatum: '1990-01-01', tier: 'business', pasApp: 'business' }));
  lidToken = reg.token;
});
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('PDA: het teamlid krijgt tips voor de eigen functie en een tip van de dag', async () => {
  const d = await json(await api('/api/supplier/training', {}, kikStaf));
  assert.equal(d.func, 'Bediening', 'de functie komt uit het personeelsdossier');
  assert.ok(d.tipVanDeDag && d.tipVanDeDag.t, 'er is een tip van de dag');
  assert.ok(d.tips.some(t => /rekening/i.test(t.t + t.s)), 'bediening-tips staan erin');
  assert.equal(d.kanBeheren, false, 'gewoon personeel beheert geen tips');
});

test('PDA: de manager voegt een eigen huistip toe; het team ziet hem vooraan', async () => {
  // personeel mag geen huistip toevoegen
  assert.equal((await api('/api/supplier/training/add', { titel: 'Stiekem', tekst: 'mag niet' }, kikStaf)).status, 403);
  // de manager voegt een huistip toe
  const add = await api('/api/supplier/training/add', { titel: 'Onze wijngroet', tekst: 'Noem bij elke fles het huis en het jaar.' }, kikMan);
  assert.equal(add.status, 200);
  // het personeel ziet de huistip nu bovenaan
  const d = await json(await api('/api/supplier/training', {}, kikStaf));
  assert.equal(d.tips[0].t, 'Onze wijngroet', 'de eigen tip staat vooraan');
  assert.ok(d.eigen.some(t => t.t === 'Onze wijngroet'));
  // dubbele titel wordt geweigerd
  assert.equal((await api('/api/supplier/training/add', { titel: 'Onze wijngroet', tekst: 'nogmaals' }, kikMan)).status, 409);
  // en de manager kan hem weer verwijderen
  assert.equal((await api('/api/supplier/training/remove', { titel: 'Onze wijngroet' }, kikMan)).status, 200);
  const na = await json(await api('/api/supplier/training', {}, kikStaf));
  assert.ok(!na.eigen.some(t => t.t === 'Onze wijngroet'), 'de tip is weg');
});

test('PDA: de coach geeft altijd een bruikbaar antwoord', async () => {
  const lege = await api('/api/supplier/coach', { vraag: '' }, kikStaf);
  assert.equal(lege.status, 400, 'een lege vraag wordt geweigerd');
  const d = await json(await api('/api/supplier/coach', { vraag: 'Hoe breng ik de rekening netjes?' }, kikStaf));
  assert.ok(d.antwoord && d.antwoord.length > 5, 'er komt een antwoord');
  assert.ok(d.bron === 'ai' || d.bron === 'bibliotheek', 'de bron is bekend');
});

test('PDA: de coach kent de context van een concrete tafel (allergie mee)', async () => {
  // de manager zet een keukengerecht op de kaart
  assert.equal((await api('/api/supplier/menu', { menu: [{ id: 'ramen', name: 'Ramen', price: 12, station: 'keuken', cat: 'Warm' }] }, kikMan)).status, 200);
  // een gast bestelt aan tafel met een allergie-notitie
  const ord = await json(await api('/api/order', { supplierCode: 'KIKUNOI', items: [{ id: 'ramen', qty: 1 }], table: 'Tafel 9', allergyNote: 'noten' }, lidToken));
  assert.ok(ord.order && ord.order.ref, 'de bestelling is aangemaakt');
  // de coach krijgt de tafel als context mee en echoot de tafel terug
  const c = await json(await api('/api/supplier/coach', { vraag: 'Waar moet ik op letten?', ref: ord.order.ref }, kikStaf));
  assert.equal(c.tafel, 'Tafel 9', 'de coach herkent de tafel');
  assert.ok(c.antwoord && c.antwoord.length > 5, 'er komt een bruikbaar antwoord');
});

test('PDA: voortgang; een gelezen tip blijft bewaard en kan terug', async () => {
  const d0 = await json(await api('/api/supplier/training', {}, kikStaf));
  const titel = d0.tips[0].t;
  assert.ok(!(d0.gelezen || []).includes(titel), 'nog niet gelezen');
  // markeer als gelezen
  const g = await json(await api('/api/supplier/training/gelezen', { titel }, kikStaf));
  assert.ok(g.gelezen.includes(titel), 'staat nu op gelezen');
  // en het blijft bewaard bij een volgende blik
  const d1 = await json(await api('/api/supplier/training', {}, kikStaf));
  assert.ok(d1.gelezen.includes(titel), 'de voortgang is bewaard');
  // terugdraaien kan ook
  const u = await json(await api('/api/supplier/training/gelezen', { titel, uit: true }, kikStaf));
  assert.ok(!u.gelezen.includes(titel), 'weer op ongelezen');
});
