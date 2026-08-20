/* Integratietests voor Rendez-vous: de besloten AI-datingapp van de Lifestyle
   Pass. Twee leden zetten een profiel op, liken elkaar (wederzijds = match), en
   Rahul stelt een jetset-date voor op een gedeelde locatie. Gated op de Lifestyle
   Pass EN op de ontmoetpoort (18+ met geverifieerd paspoort, kern/ontmoetpoort.js).
   Op codenaam. Draai los:
   node --experimental-sqlite --test test/rendezvous.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, elevateTier } = require('./helper');

let BASE;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-rendezvous-'));
let child;

const raw = (pad, body, token) => fetch(BASE + '/api' + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(body || {})
});
const json = r => r.json();
const rv = (pad, body, token) => raw('/member/rendezvous/' + pad, body, token);

test.before(async () => {
  ({ child, base: BASE } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' } }));
});
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

let teller = 0;
const officeTok = async () => (await json(await raw('/office/login', { code: 'RTG-OFFICE' }))).token;
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

/* Het paspoort door de balie halen. Zonder dit komt een lid de ontmoetpoort niet
   door, ook niet met een Lifestyle Pass: de leeftijd wordt uit member_state.geboren
   gerekend en die staat er pas als het kantoor een document heeft gezien. */
async function verifieer(token) {
  const st = await json(await raw('/state', {}, token));
  const codename = st.state.user.codename;
  await raw('/verify/upload', { image: PNG }, token);
  await raw('/verify/selfie', { image: PNG }, token);
  const office = await officeTok();
  const pend = await json(await raw('/office/verifications', {}, office));
  const mij = (pend.pending || []).find(x => x.codename === codename);
  if (!mij) throw new Error('verifieer: lid niet in de wachtrij');
  await raw('/office/verify', { userId: mij.id, decision: 'approve', faceMatch: true, geslacht: 'v' }, office);
}

async function lidMet(tier, opties) {
  const { kyc = true, geboortedatum = '1985-05-05' } = opties || {};
  const t = Date.now() + '' + (teller++);
  // zelf-registreren geeft altijd RTG; Lifestyle/Business komt na een menselijk
  // akkoord, dus registreren als RTG en optillen langs de office-flow.
  const regTier = (tier === 'lifestyle' || tier === 'business') ? 'rtg' : tier;
  const r = await json(await raw('/auth/register', { name: 'Lid ' + t, email: 'r' + t + '@v.test', phone: '06' + String(t).slice(-8), password: 'geheim123', geboortedatum, tier: regTier }));
  if (tier === 'lifestyle' || tier === 'business') await elevateTier(BASE, r.token, tier, await officeTok());
  if (kyc) await verifieer(r.token);
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

/* DE ONTMOETPOORT. Rendez-vous had lang alleen de pas-eis, waardoor de besloten
   app iedereen met een Lifestyle Pass toeliet -- ook zonder geverifieerd paspoort
   en ook onder de 18 -- terwijl het brede Vonk dat wel eiste. De eis woont nu in
   kern/ontmoetpoort.js en geldt voor allebei. */
test('de ontmoetpoort: zonder geverifieerd paspoort geen Rendez-vous, ook niet met een Lifestyle Pass', async () => {
  const los = await lidMet('lifestyle', { kyc: false });
  const dicht = await rv('profiel', {}, los);
  assert.equal(dicht.status, 403, 'zonder KYC blijft de deur dicht');
  assert.match((await json(dicht)).error, /paspoort/i, 'en de reden noemt het paspoort');
  // ook de schrijvende ingangen zijn dicht, niet alleen het lezen
  assert.equal((await rv('profiel/zet', { aan: true, locaties: 'Ibiza' }, los)).status, 403);
  assert.equal((await rv('kandidaten', {}, los)).status, 403);
  assert.equal((await rv('matches', {}, los)).status, 403);
});

test('de ontmoetpoort: een minderjarige met een Lifestyle Pass komt er niet in', async () => {
  const jaar = new Date().getUTCFullYear();
  const kind = await lidMet('lifestyle', { geboortedatum: (jaar - 16) + '-05-05' });
  const dicht = await rv('profiel', {}, kind);
  assert.equal(dicht.status, 403, '16 jaar is geen 18');
  assert.match((await json(dicht)).error, /18 jaar/, 'en de reden noemt de leeftijdsgrens');
});

/* ---- DE PRESENCE GRAPH (kern/rendezvous-aanwezig.js, ONTMOETEN.md fase 2) ----
   Locatie was een verzameling ("we komen allebei weleens in Parijs") en wordt een
   agenda ("we zijn er allebei van 22 tot 24 augustus"). */

// een datum n dagen vooruit, als JJJJ-MM-DD; toetsen mogen niet op de kalender leunen
const dag = n => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

test('de presence graph: tegelijk in dezelfde stad is een eigen signaal', async () => {
  const a = await lidMet('lifestyle');
  const b = await lidMet('lifestyle');
  await rv('profiel/zet', { aan: true, over: 'A', thuis: 'Amsterdam',
    aanwezig: [{ stad: 'Parijs', van: dag(1), tot: dag(4) }] }, a);
  await rv('profiel/zet', { aan: true, over: 'B-overlap', thuis: 'Londen',
    aanwezig: [{ stad: 'Parijs', van: dag(2), tot: dag(6) }] }, b);

  const kand = await json(await rv('kandidaten', {}, a));
  const zB = kand.kandidaten.find(k => k.over === 'B-overlap');
  assert.ok(zB, 'B staat erbij');
  assert.deepEqual(zB.samen, [{ stad: 'Parijs', van: dag(2), tot: dag(4) }],
    'de overlap is de doorsnede van de twee vensters, niet het hele venster');
  // en het overlapbericht zegt nooit wie er woont
  assert.ok(!JSON.stringify(zB.samen).includes('thuis'), 'geen woonplaats in het signaal');
});

test('de presence graph: wie er woont telt mee, maar wordt niet verklapt', async () => {
  const reiziger = await lidMet('lifestyle');
  const bewoner = await lidMet('lifestyle');
  await rv('profiel/zet', { aan: true, over: 'reiziger', thuis: 'Oslo',
    aanwezig: [{ stad: 'Wenen', van: dag(3), tot: dag(5) }] }, reiziger);
  await rv('profiel/zet', { aan: true, over: 'woont-in-wenen', thuis: 'Wenen' }, bewoner);

  const kand = await json(await rv('kandidaten', {}, reiziger));
  const z = kand.kandidaten.find(k => k.over === 'woont-in-wenen');
  assert.deepEqual(z.samen, [{ stad: 'Wenen', van: dag(3), tot: dag(5) }],
    'zijn woonplaats maakt uw venster tot een overlap');
  const tekst = JSON.stringify(z);
  assert.ok(!/"thuis"/.test(tekst), 'maar zijn thuisstad staat nergens in het antwoord');
});

test('de presence graph: twee stadgenoten zonder venster zijn geen signaal', async () => {
  const x = await lidMet('lifestyle');
  const y = await lidMet('lifestyle');
  await rv('profiel/zet', { aan: true, over: 'x-thuis', thuis: 'Rotterdam' }, x);
  await rv('profiel/zet', { aan: true, over: 'y-thuis', thuis: 'Rotterdam' }, y);
  const kand = await json(await rv('kandidaten', {}, x));
  const z = kand.kandidaten.find(k => k.over === 'y-thuis');
  assert.deepEqual(z.samen, [], 'dezelfde woonplaats is geen tijdsignaal; dat kon de app al');
});

test('de presence graph is grofmazig: een tijdstip komt er niet in, en voorbij vervalt', async () => {
  const a = await lidMet('lifestyle');
  await rv('profiel/zet', { aan: true, aanwezig: [
    { stad: 'Parijs', van: dag(1) + 'T19:30', tot: dag(4) },   // een tijdstip
    { stad: 'Rome', van: dag(-30), tot: dag(-20) },            // al voorbij
    { stad: 'Gstaad', van: dag(9), tot: dag(6) }               // omgedraaid
  ] }, a);
  const p = (await json(await rv('profiel', {}, a))).profiel;
  const steden = p.aanwezig.map(v => v.stad);
  assert.ok(!steden.includes('Parijs'), 'een venster met een tijdstip wordt niet aangenomen');
  assert.ok(!steden.includes('Rome'), 'een venster dat voorbij is, blijft niet staan');
  const g = p.aanwezig.find(v => v.stad === 'Gstaad');
  assert.ok(g && g.van === dag(6) && g.tot === dag(9), 'omgedraaide datums worden rechtgezet, niet geweigerd');
});

test('de presence graph: een lid ziet zijn aanwezigheid en kan hem in een keer wissen', async () => {
  const a = await lidMet('lifestyle');
  await rv('profiel/zet', { aan: true, over: 'wisser', thuis: 'Madrid',
    aanwezig: [{ stad: 'Lissabon', van: dag(2), tot: dag(5) }] }, a);
  let p = (await json(await rv('profiel', {}, a))).profiel;
  assert.equal(p.thuis, 'Madrid', 'het lid ziet wat er van hem bekend is');
  assert.equal(p.aanwezig.length, 1);

  assert.equal((await rv('aanwezig/wis', {}, a)).status, 200);
  p = (await json(await rv('profiel', {}, a))).profiel;
  assert.deepEqual(p.aanwezig, [], 'de aanwezigheid is weg');
  assert.equal(p.thuis, '', 'en de thuisstad ook');
  assert.equal(p.over, 'wisser', 'maar de rest van het profiel blijft staan');
});

/* DE GRENS UIT ONTMOETEN.md PAR. 4.3: aanwezigheid is zelf opgegeven en wordt
   nooit uit RTG Travel gevuld. Dit is een NIET-functie, en die toets je door de
   reis er wel te laten zijn: een lid met een lopende reis in de database houdt
   een lege aanwezigheid tot het zelf iets intikt. */
test('de presence graph komt nooit uit een reis, ook niet als die er is', async () => {
  const kern = require('../server/kern/rendezvous.js');
  const db = { data: {
    // een reis staat pontificaal in dezelfde database die de module krijgt
    trip: { dest: 'Parijs', from: '2026-08-21', to: '2026-08-24', items: [] },
    rendezvous: {}
  } };
  const accounts = { getUserById: () => ({ id: 1, verified: 'verified' }), getMemberState: () => ({
    geboren: '1990-05-05', trip: { dest: 'Parijs', from: '2026-08-21', to: '2026-08-24' } }) };
  const api = kern({ db, save() {}, crypto: require('crypto'), liveCodename: k => k,
    anthropic: null, notify() {}, accounts, leeftijdVan: () => 36 });

  api.rvProfiel('user-1', { aan: true, over: 'reist naar Parijs' });
  const p = api.rvProfielGet('user-1').profiel;
  assert.deepEqual(p.aanwezig, [], 'de reis vult de aanwezigheid niet');
  assert.equal(p.thuis, '', 'en levert ook geen thuisstad');

  // twee leden die allebei "op reis naar Parijs" zijn, zien elkaar niet als overlap
  api.rvProfiel('user-2', { aan: true, over: 'ook naar Parijs' });
  const kandidaten = api.rvKandidaten('user-1').kandidaten;
  assert.equal(kandidaten.length, 1, 'de ander is wel gewoon een kandidaat');
  assert.deepEqual(kandidaten[0].samen, [], 'maar zonder ingetikte aanwezigheid is er geen overlap');
});
