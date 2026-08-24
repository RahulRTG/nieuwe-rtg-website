/* Integratietests voor Rendez-vous: de besloten AI-datingapp van de Lifestyle
   Pass. Twee leden zetten een profiel op, liken elkaar (wederzijds = match), en
   Rahul stelt een jetset-date voor op een gedeelde locatie. Gated op de Lifestyle
   Pass; op codenaam. Draai los:
   node --experimental-sqlite --test test/rendezvous.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, elevateTier } = require('./helper');

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
let BASE;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-rendezvous-'));
let child, office;

const raw = (pad, body, token) => fetch(BASE + '/api' + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(body || {})
});
const json = r => r.json();
const rv = (pad, body, token) => raw('/member/rendezvous/' + pad, body, token);

test.before(async () => {
  ({ child, base: BASE } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' } }));
  office = (await json(await raw('/office/login', { code: 'RTG-OFFICE' }))).token;
});
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

let teller = 0;
async function lidMet(tier, opties = {}) {
  const t = Date.now() + '' + (teller++);
  // zelf-registreren geeft altijd RTG; Lifestyle/Business komt na een menselijk
  // akkoord, dus registreren als RTG en optillen langs de office-flow.
  const regTier = (tier === 'lifestyle' || tier === 'business') ? 'rtg' : tier;
  const r = await json(await raw('/auth/register', { name: 'Lid ' + t, email: 'r' + t + '@v.test', phone: '06' + String(t).slice(-8),
    password: 'geheim123', geboortedatum: opties.geboortedatum || '1985-05-05', tier: regTier }));
  if (tier === 'lifestyle' || tier === 'business') await elevateTier(BASE, r.token, tier, office);
  if (opties.verifieer !== false) {
    const staat = await json(await raw('/state', {}, r.token));
    const codenaam = staat.state.user.codename;
    await raw('/verify/upload', { image: PNG }, r.token);
    await raw('/verify/selfie', { image: PNG }, r.token);
    const wachtrij = await json(await raw('/office/verifications', {}, office));
    const aanvraag = (wachtrij.pending || []).find(p => p.codename === codenaam);
    assert.ok(aanvraag, 'identiteitsverificatie staat bij kantoor klaar');
    await raw('/office/verify', { userId: aanvraag.id, decision: 'approve', faceMatch: true, geslacht: 'x' }, office);
  }
  return r.token;
}

test('twee leden liken elkaar -> match, en Rahul stelt een date voor op een gedeelde locatie', async () => {
  const a = await lidMet('lifestyle');
  const b = await lidMet('lifestyle');
  await rv('profiel/zet', { aan: true, over: 'Houdt van zeilen en kunst.', zoekt: 'iemand met humor', wensen: 'reizen, cultuur', locaties: 'Ibiza, Saint-Tropez' }, a);
  await rv('profiel/zet', { aan: true, over: 'Reist graag en houdt van diners.', locaties: 'Saint-Tropez, Gstaad' }, b);

  // A ziet B als kandidaat, met Saint-Tropez als gedeelde locatie
  const kand = await json(await rv('kandidaten', {}, a));
  const zB = kand.kandidaten.find(k => k.gedeeldeLocaties.includes('Saint-Tropez'));
  assert.ok(zB, 'B is een kandidaat met een gedeelde locatie');
  assert.equal(zB.status, 'nieuw');

  // A liket B: nog geen match (eenzijdig)
  let r = await json(await rv('like', { id: zB.id }, a));
  assert.equal(r.match, false);
  // B liket A terug: nu wel een match
  const kandB = await json(await rv('kandidaten', {}, b));
  const zA = kandB.kandidaten.find(k => k.likteMij); // A heeft B al geliked
  assert.ok(zA, 'B ziet dat A al heeft geliked');
  r = await json(await rv('like', { id: zA.id }, b));
  assert.equal(r.match, true, 'wederzijdse like = match');

  // de match staat bij beide leden, met een dategvoorstel op de gedeelde locatie
  const mA = await json(await rv('matches', {}, a));
  assert.equal(mA.matches.length, 1);
  assert.equal(mA.matches[0].voorstel, 'Saint-Tropez');
  const date = await json(await rv('date', { id: mA.matches[0].id }, a));
  assert.ok(date.ok && /Saint-Tropez/.test(date.antwoord), 'de date is op de gedeelde locatie');
  assert.equal(date.locatie, 'Saint-Tropez');
});

test('liken kan niet zonder eigen actief profiel', async () => {
  const a = await lidMet('lifestyle');
  const b = await lidMet('lifestyle');
  await rv('profiel/zet', { aan: true, locaties: 'Ibiza' }, b);
  // A heeft geen actief profiel
  const kand = await json(await rv('kandidaten', {}, a));
  const zB = kand.kandidaten[0];
  assert.ok(zB);
  assert.equal((await rv('like', { id: zB.id }, a)).status, 400);
});

test('een pas verbergt de kandidaat', async () => {
  const a = await lidMet('lifestyle');
  const b = await lidMet('lifestyle');
  await rv('profiel/zet', { aan: true }, a);
  await rv('profiel/zet', { aan: true, over: 'Weg te vegen' }, b);
  let kand = await json(await rv('kandidaten', {}, a));
  const zB = kand.kandidaten.find(k => k.over === 'Weg te vegen');
  assert.ok(zB);
  assert.equal((await rv('pas', { id: zB.id }, a)).status, 200);
  kand = await json(await rv('kandidaten', {}, a));
  assert.ok(!kand.kandidaten.some(k => k.id === zB.id), 'de weggeveegde kandidaat is weg');
});

test('een date zonder wederzijdse match wordt geweigerd', async () => {
  const a = await lidMet('lifestyle');
  const b = await lidMet('lifestyle');
  await rv('profiel/zet', { aan: true, locaties: 'Ibiza' }, a);
  await rv('profiel/zet', { aan: true, locaties: 'Ibiza' }, b);
  const kand = await json(await rv('kandidaten', {}, a));
  await rv('like', { id: kand.kandidaten[0].id }, a); // eenzijdig
  assert.equal((await rv('date', { id: kand.kandidaten[0].id }, a)).status, 400);
});

test('Rendez-vous is gated op de Lifestyle Pass (RTG niet, Business wel)', async () => {
  const rtg = await lidMet('rtg');
  assert.equal((await rv('kandidaten', {}, rtg)).status, 403);
  assert.equal((await rv('profiel', {}, rtg)).status, 403);
  const biz = await lidMet('business');
  assert.equal((await rv('profiel', {}, biz)).status, 200);
});

test('Rendez-vous eist naast de pas ook een geverifieerde identiteit en 18+', async () => {
  const ongeverifieerd = await lidMet('lifestyle', { verifieer: false });
  let r = await rv('profiel', {}, ongeverifieerd);
  assert.equal(r.status, 403);
  assert.equal((await json(r)).code, 'IDENTITY_REQUIRED');

  const minderjarig = await lidMet('lifestyle', { geboortedatum: '2010-05-05' });
  r = await rv('profiel', {}, minderjarig);
  assert.equal(r.status, 403);
  assert.equal((await json(r)).code, 'AGE_REQUIRED');
});

test('blokkeren verwijdert de connectie direct; melden gaat op codenaam naar kantoor', async () => {
  const a = await lidMet('lifestyle');
  const b = await lidMet('lifestyle');
  await rv('profiel/zet', { aan: true, over: 'A', locaties: 'Ibiza' }, a);
  await rv('profiel/zet', { aan: true, over: 'B', locaties: 'Ibiza' }, b);
  const kandidaat = (await json(await rv('kandidaten', {}, a))).kandidaten.find(k => k.over === 'B');
  assert.ok(kandidaat);
  await rv('like', { id: kandidaat.id }, a);
  const andersom = (await json(await rv('kandidaten', {}, b))).kandidaten.find(k => k.over === 'A');
  await rv('like', { id: andersom.id }, b);
  assert.equal((await json(await rv('matches', {}, a))).matches.length, 1);

  const blok = await json(await rv('blokkeer', { id: kandidaat.id, meld: 'Ongepast bericht' }, a));
  assert.equal(blok.gemeld, true);
  assert.equal((await json(await rv('matches', {}, a))).matches.length, 0, 'de match is direct weg voor A');
  assert.equal((await json(await rv('matches', {}, b))).matches.length, 0, 'de match is direct weg voor B');
  assert.ok(!(await json(await rv('kandidaten', {}, b))).kandidaten.some(k => k.id === andersom.id), 'beiden zien elkaar niet meer');

  const meldingen = await json(await raw('/office/rendezvous/meldingen', {}, office));
  assert.ok(meldingen.meldingen.some(m => m.reden === 'Ongepast bericht'), 'kantoor ontvangt de melding');
  assert.ok(meldingen.meldingen.every(m => m.van && m.over), 'de melding gebruikt codenamen');
});
