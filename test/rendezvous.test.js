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
  const api = kern({ db, save() {}, crypto: require('crypto'), codenaamVan: k => k,
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

/* ---- PRIVATE AVAILABILITY (kern/beschikbaar.js, ONTMOETEN.md fase 3) ----
   Hetzelfde mechanisme als Vonks Blind Availability, ander gezicht. */

test('private availability: pas bij wederzijdse interesse, en dan een dagdeel', async () => {
  const a = await lidMet('lifestyle');
  const b = await lidMet('lifestyle');
  await rv('profiel/zet', { aan: true, over: 'A-beschikbaar', beschikbaar: ['wo-avond', 'do-avond'] }, a);
  await rv('profiel/zet', { aan: true, over: 'B-beschikbaar', beschikbaar: ['do-avond', 'vr-avond'] }, b);

  // voor de match: de kandidaatkaart draagt niets over dagdelen
  const kand = await json(await rv('kandidaten', {}, a));
  const zB = kand.kandidaten.find(k => k.over === 'B-beschikbaar');
  assert.ok(zB, 'B is een kandidaat');
  assert.ok(!('beschikbaar' in zB), 'zijn dagdelen staan er niet');
  assert.ok(!('wanneer' in zB), 'en er is nog geen doorsnede');

  // na de wederzijdse like wel, en dan precies een
  await rv('like', { id: zB.id }, a);
  const kandB = await json(await rv('kandidaten', {}, b));
  await rv('like', { id: kandB.kandidaten.find(k => k.likteMij).id }, b);
  const m = await json(await rv('matches', {}, a));
  const rij = m.matches.find(x => x.codenaam === zB.codenaam);
  assert.equal(rij.wanneer.samen.slot, 'do-avond', 'het gedeelde dagdeel');
  assert.equal(rij.wanneer.tekst, 'Donderdagavond komt u beiden uit.');
  assert.ok(!/wo-avond|vr-avond/.test(JSON.stringify(rij.wanneer)),
    'de niet-gedeelde dagdelen van beide kanten blijven binnen');
});

test('private availability: een lid ziet zijn eigen dagdelen terug', async () => {
  const a = await lidMet('lifestyle');
  await rv('profiel/zet', { aan: true, beschikbaar: ['za-middag', 'onzin', 'ma-ochtend'] }, a);
  const p = (await json(await rv('profiel', {}, a))).profiel;
  assert.deepEqual(p.beschikbaar, ['ma-ochtend', 'za-middag'],
    'in weekvolgorde, en onbekende hokjes vallen weg');
});

/* EEN MECHANISME, TWEE GEZICHTEN. Vonk en Rendez-vous noemen dit anders maar
   draaien op hetzelfde bestand. Zou er ooit een tweede kopie komen, dan lopen de
   twee uiteen zodra er een verandert -- LAT.md regel 4. */
test('beschikbaarheid is een gedeeld mechanisme, geen twee kopieen', async () => {
  const fs = require('fs');
  const vonk = fs.readFileSync('server/kern/vonk/index.js', 'utf8');
  const rdv = fs.readFileSync('server/kern/rendezvous.js', 'utf8');
  assert.match(vonk, /require\('\.\.\/beschikbaar'\)/, 'Vonk gebruikt de gedeelde module');
  assert.match(rdv, /require\('\.\/beschikbaar'\)/, 'Rendez-vous ook');
  // en ze geven allebei exact dezelfde zin bij dezelfde invoer
  const B = require('../server/kern/beschikbaar');
  assert.equal(B.zin(['do-avond'], ['do-avond']).tekst, 'Donderdagavond komt u beiden uit.');
});

/* ---- ARRANGE IT (kern/rendezvous-arrange.js, ONTMOETEN.md fase 4) ----
   Rahul stelt samen, beiden keuren goed, De Rechterhand regelt. */

const dagdeelBeide = ['do-avond'];

// twee gematchte Lifestyle-leden die tegelijk in dezelfde stad zijn en samen kunnen
async function paarKlaar() {
  const a = await lidMet('lifestyle');
  const b = await lidMet('lifestyle');
  const stad = 'Wenen-' + (teller++);
  await rv('profiel/zet', { aan: true, over: 'A-' + stad, beschikbaar: dagdeelBeide,
    aanwezig: [{ stad, van: dag(2), tot: dag(5) }] }, a);
  await rv('profiel/zet', { aan: true, over: 'B-' + stad, beschikbaar: dagdeelBeide,
    aanwezig: [{ stad, van: dag(3), tot: dag(6) }] }, b);
  const kand = await json(await rv('kandidaten', {}, a));
  const zB = kand.kandidaten.find(k => k.over === 'B-' + stad);
  await rv('like', { id: zB.id }, a);
  const kandB = await json(await rv('kandidaten', {}, b));
  await rv('like', { id: kandB.kandidaten.find(k => k.likteMij && k.over === 'A-' + stad).id }, b);
  const m = await json(await rv('matches', {}, a));
  const rij = m.matches.find(x => x.codenaam === zB.codenaam);
  return { a, b, stad, idVoorA: rij.id, idVoorB: (await json(await rv('matches', {}, b))).matches[0].id };
}

test('arrange it: het voorstel komt uit aanwezigheid en beschikbaarheid, zonder zaaknaam', async () => {
  const { a, stad, idVoorA } = await paarKlaar();
  const r = await json(await rv('arrange', { id: idVoorA }, a));
  const v = r.voorstel;
  assert.equal(v.stad, stad, 'de stad komt uit de overlap in aanwezigheid');
  assert.equal(v.van, dag(3), 'en de dagen zijn de doorsnede van de twee vensters');
  assert.equal(v.dagdeel, 'do-avond', 'het dagdeel komt uit de gedeelde beschikbaarheid');
  assert.match(v.tekst, /donderdagavond/, 'de zin noemt het dagdeel');
  // de merkregel: geen echte zaak opgevoerd als bevestigde partner
  assert.ok(!/supplier|hotel|restaurant/i.test(JSON.stringify(v)), 'er staat geen zaak in het voorstel');
  assert.equal(v.ikAkkoord, false);
  assert.equal(v.anderAkkoord, false);
  assert.ok(r.settings.length === 3, 'drie settings om uit te kiezen');
});

test('arrange it: een akkoord is niet genoeg; twee akkoorden gaan naar De Rechterhand', async () => {
  const { a, b, idVoorA, idVoorB } = await paarKlaar();
  await rv('arrange', { id: idVoorA }, a);
  const een = await json(await rv('akkoord', { id: idVoorA, ja: true }, a));
  assert.equal(een.voorstel.ikAkkoord, true);
  assert.equal(een.voorstel.bijRechterhand, false, 'een kant is niet genoeg');

  const twee = await json(await rv('akkoord', { id: idVoorB, ja: true }, b));
  assert.equal(twee.voorstel.bijRechterhand, true, 'twee akkoorden: het gaat door');

  // bij ALLEBEI staat de gelegenheid in het eigen dossier, en nergens staat "gereserveerd"
  for (const tok of [a, b]) {
    const t = await json(await raw('/member/rechterhand/table', {}, tok));
    const e = (t.events || []).find(x => /Rendez-vous met/.test(x.naam));
    assert.ok(e, 'de gelegenheid staat in het eigen Rechterhand-dossier');
    assert.match(e.notitie, /De Rechterhand regelt de reservering en bevestigt/,
      'en zegt dat een mens het regelt');
    assert.ok(!/bevestigd|gereserveerd\b/.test(e.notitie.replace('bevestigt', '')),
      'er wordt niet geclaimd dat er al iets vaststaat');
  }
});

test('arrange it: van setting wisselen zet de akkoorden terug', async () => {
  const { a, idVoorA } = await paarKlaar();
  await rv('arrange', { id: idVoorA }, a);
  await rv('akkoord', { id: idVoorA, ja: true }, a);
  const gewisseld = await json(await rv('arrange', { id: idVoorA, setting: 'cultuur' }, a));
  assert.equal(gewisseld.voorstel.setting, 'cultuur');
  assert.equal(gewisseld.voorstel.ikAkkoord, false,
    'u keurt niet iets anders goed dan waar u ja op zei');
});

test('arrange it: een akkoord kan terug zolang de ander nog niet akkoord is', async () => {
  const { a, idVoorA } = await paarKlaar();
  await rv('arrange', { id: idVoorA }, a);
  await rv('akkoord', { id: idVoorA, ja: true }, a);
  const terug = await json(await rv('akkoord', { id: idVoorA, ja: false }, a));
  assert.equal(terug.voorstel.ikAkkoord, false);
});

test('arrange it: valt de grond onder het voorstel weg, dan vervalt het', async () => {
  const { a, b, idVoorA, idVoorB } = await paarKlaar();
  await rv('arrange', { id: idVoorA }, a);
  await rv('akkoord', { id: idVoorA, ja: true }, a);
  // B wist zijn aanwezigheid: de gedeelde stad bestaat niet meer
  await rv('aanwezig/wis', {}, b);
  const nu2 = await rv('akkoord', { id: idVoorB, ja: true }, b);
  assert.equal(nu2.status, 409, 'een voorstel over een weekend dat niet meer bestaat, gaat niet door');
  assert.match((await json(nu2)).error, /klopt niet meer/);
});

/* ---- DE KRING (kern/rendezvous-kring.js + -samen.js, ONTMOETEN.md fase 5) ----
   The Table, de tweezijdige ja (Moment en Encounter), en Together. */

test('the table: de gastenlijst verlaat de kern niet', async () => {
  const kern = require('../server/kern/rendezvous.js');
  const db = { data: { rendezvous: {} } };
  const accounts = { getUserById: () => ({ id: 1, verified: 'verified' }), getMemberState: () => ({ geboren: '1985-05-05' }) };
  const api = kern({ db, save() {}, crypto: require('crypto'), codenaamVan: k => 'Naam-' + k,
    anthropic: null, notify() {}, accounts, leeftijdVan: () => 40, tableZet() {}, handleVanPin: () => null });

  const t = api.rvTafelMaak({ naam: 'Diner 04', stad: 'Amsterdam', datum: '2026-09-10', tijd: '20:00',
    thema: 'architectuur', plaatsen: 8, genodigden: ['user-1', 'user-2', 'user-3'] });
  assert.equal(t.status, 200);
  assert.equal(t.tafel.genodigden, undefined, 'zelfs het maak-antwoord draagt de lijst niet');

  const mijn = api.rvTafels('user-1');
  assert.equal(mijn.tafels.length, 1);
  const rij = mijn.tafels[0];
  assert.equal(rij.naam, 'Diner 04');
  assert.equal(rij.plaatsen, 8, 'u ziet hoe groot het gezelschap is');
  assert.ok(!('genodigden' in rij), 'maar niet wie er komen');
  assert.ok(!/user-2|user-3|Naam-user-2/.test(JSON.stringify(mijn)), 'geen enkele medegast lekt door');

  assert.equal(api.rvTafelAntwoord('user-1', rij.id, true).mijnStatus, 'ja');
  // en een ander lid ziet die tafel niet
  assert.equal(api.rvTafels('user-9').tafels.length, 0, 'wie niet is uitgenodigd, ziet niets');
});

test('de tweezijdige ja: wie als eerste ja zegt blijft onzichtbaar, en nee is stil', async () => {
  const kern = require('../server/kern/rendezvous.js');
  const db = { data: { rendezvous: {} } };
  const accounts = { getUserById: () => ({ id: 1, verified: 'verified' }), getMemberState: () => ({ geboren: '1985-05-05' }) };
  const gemeld = [];
  const api = kern({ db, save() {}, crypto: require('crypto'), codenaamVan: k => 'Naam-' + k,
    anthropic: null, notify: (k, m) => gemeld.push([k, m.body]), accounts, leeftijdVan: () => 40,
    tableZet() {}, handleVanPin: () => null });

  api.rvIntroBied('moment', 'user-1', 'user-2', 'allebei op Basel');
  const sl = api.rvIntroducties('user-1').introducties[0].id;
  assert.equal(api.rvIntroducties('user-1').introducties[0].aanleiding, 'allebei op Basel');

  // A zegt ja; B mag daar niets van merken
  assert.equal(api.rvIntroAntwoord('user-1', sl, true).geopend, false);
  const bijB = api.rvIntroducties('user-2').introducties[0];
  assert.equal(bijB.ikAntwoordde, null, 'B heeft zelf nog niets gezegd');
  assert.equal(bijB.geopend, false);
  assert.ok(!('anderJa' in bijB) && !('ja' in bijB), 'en ziet nergens dat A al ja zei');

  // B zegt ook ja: nu pas open
  const open = api.rvIntroAntwoord('user-2', sl, true);
  assert.equal(open.geopend, true);
  assert.equal(open.codenaam, 'Naam-user-1');

  // en een nee blijft stil
  api.rvIntroBied('encounter', 'user-3', 'user-4', 'u heeft elkaar ontmoet');
  const sl2 = api.rvIntroducties('user-3').introducties[0].id;
  gemeld.length = 0;
  assert.equal(api.rvIntroAntwoord('user-3', sl2, false).geopend, false);
  assert.deepEqual(gemeld, [], 'een afwijzing stuurt niemand een bericht');
  assert.equal(api.rvIntroducties('user-4').introducties[0].ikAntwoordde, null,
    'en de ander ziet niet dat er nee is gezegd');
});

test('encounter: een pin alleen is niet genoeg; het moet van twee kanten komen', async () => {
  const kern = require('../server/kern/rendezvous.js');
  const db = { data: { rendezvous: {} } };
  const accounts = { getUserById: () => ({ id: 1, verified: 'verified' }), getMemberState: () => ({ geboren: '1985-05-05' }) };
  const pins = { 'AAA-111': 'user-2', 'BBB-222': 'user-1' };
  const api = kern({ db, save() {}, crypto: require('crypto'), codenaamVan: k => 'Naam-' + k,
    anthropic: null, notify() {}, accounts, leeftijdVan: () => 40, tableZet() {},
    handleVanPin: p => pins[p] || null });

  assert.equal(api.rvEncounter('user-1', 'ONZIN').status, 404, 'een pin die niemand aanwijst doet niets');
  const een = api.rvEncounter('user-1', 'AAA-111');
  assert.equal(een.wacht, true, 'een kant is nog geen ontmoeting');
  assert.equal(api.rvIntroducties('user-2').introducties.length, 0,
    'en de ander krijgt dus nog geen vraag over iemand die hij niet koos');

  const twee = api.rvEncounter('user-2', 'BBB-222');
  assert.equal(twee.wacht, false, 'van twee kanten: nu is het een ontmoeting');
  assert.equal(api.rvIntroducties('user-2').introducties[0].soort, 'encounter');
});

test('together: samen is een projectie over twee eigen verklaringen', async () => {
  const a = await lidMet('lifestyle');
  const b = await lidMet('lifestyle');
  await rv('profiel/zet', { aan: true, over: 'samen-A' }, a);
  await rv('profiel/zet', { aan: true, over: 'samen-B' }, b);
  const kand = await json(await rv('kandidaten', {}, a));
  const zB = kand.kandidaten.find(k => k.over === 'samen-B');
  assert.ok(zB, 'B is eerst gewoon een kandidaat');

  // A verklaart eenzijdig: nog niet samen
  const een = await json(await rv('samen/zet', { met: zB.id }, a));
  assert.equal(een.samen, false, 'een verklaring maakt nog geen relatie');
  assert.equal((await json(await rv('samen', {}, b))).samen, false, 'en B is nergens in gezet');

  // B verklaart terug: nu is het samen
  const kandB = await json(await rv('kandidaten', {}, b));
  const zA = kandB.kandidaten.find(k => k.over === 'samen-A');
  const twee = await json(await rv('samen/zet', { met: zA.id }, b));
  assert.equal(twee.samen, true, 'twee verklaringen naar elkaar: samen');

  // de introducties stoppen, aan beide kanten
  assert.deepEqual((await json(await rv('kandidaten', {}, a))).kandidaten, [], 'A krijgt niemand meer');
  assert.equal((await json(await rv('kandidaten', {}, a))).samen, true);
  const bijAnderen = await lidMet('lifestyle');
  await rv('profiel/zet', { aan: true, over: 'derde' }, bijAnderen);
  const derde = await json(await rv('kandidaten', {}, bijAnderen));
  assert.ok(!derde.kandidaten.some(k => k.over === 'samen-A' || k.over === 'samen-B'),
    'en ze staan ook bij een derde niet meer in de lijst');
});

test('together: je trekt alleen je eigen helft in, en de ander wordt niet gewist', async () => {
  const a = await lidMet('lifestyle');
  const b = await lidMet('lifestyle');
  await rv('profiel/zet', { aan: true, over: 'los-A' }, a);
  await rv('profiel/zet', { aan: true, over: 'los-B' }, b);
  const idB = (await json(await rv('kandidaten', {}, a))).kandidaten.find(k => k.over === 'los-B').id;
  await rv('samen/zet', { met: idB }, a);
  const idA = (await json(await rv('kandidaten', {}, b))).kandidaten.find(k => k.over === 'los-A').id;
  await rv('samen/zet', { met: idA }, b);
  assert.equal((await json(await rv('samen', {}, a))).samen, true);

  // A trekt in: samen valt weg voor allebei, maar B's eigen verklaring staat er nog
  await rv('samen/zet', { ja: false }, a);
  assert.equal((await json(await rv('samen', {}, a))).samen, false);
  const bijB = await json(await rv('samen', {}, b));
  assert.equal(bijB.samen, false, 'de projectie valt weg zodra een helft verdwijnt');
  assert.ok(bijB.ikVerklaarde, 'maar B\'s eigen helft is niet door A gewist');
});

/* ---- HET KANTOOR STELT EEN TAFEL SAMEN (kern/rendezvous-tafels.js) ----
   De twee kanten staan tegenover elkaar: het kantoor MOET de gastenlijst zien,
   een lid mag hem nooit zien. Daarom staan ze in twee bestanden. */

/* Elk lid heeft een EIGEN codenaam. Dit stond hier niet, en daardoor bleef
   maanden onopgemerkt dat liveCodename een sessie verwacht en een sleutel kreeg:
   hij gaf altijd null, en iedereen in Rendez-vous heette "Een lid". Een app die
   volledig op codenamen draait had er dus maar een. */
test('elk lid heeft zijn eigen codenaam, en die is op naam terug te vinden', async () => {
  const a = await lidMet('lifestyle');
  const b = await lidMet('lifestyle');
  await rv('profiel/zet', { aan: true, over: 'naam-A' }, a);
  await rv('profiel/zet', { aan: true, over: 'naam-B' }, b);
  const na = (await json(await rv('profiel', {}, a))).codenaam;
  const nb = (await json(await rv('profiel', {}, b))).codenaam;
  assert.ok(na && nb, 'allebei een codenaam');
  assert.notEqual(na, nb, 'en niet dezelfde');
  assert.notEqual(na, 'Een lid', 'en niet de terugvaltekst');

  // de kandidatenlijst draagt dezelfde naam, en het kantoor vindt hem terug
  const kand = await json(await rv('kandidaten', {}, a));
  const zB = kand.kandidaten.find(k => k.over === 'naam-B');
  assert.equal(zB.codenaam, nb, 'de kandidaat draagt zijn eigen codenaam');
  const office = await officeTok();
  const g = await json(await raw('/office/rendezvous/tafel/maak',
    { naam: 'Rondrit', plaatsen: 2, genodigden: [nb] }, office));
  assert.ok(g.ok, 'het kantoor vindt het lid terug op die codenaam');
});

test('the table: het kantoor stelt samen op codenaam, en ziet wel de lijst', async () => {
  const a = await lidMet('lifestyle');
  const b = await lidMet('lifestyle');
  await rv('profiel/zet', { aan: true, over: 'tafelgast-A' }, a);
  await rv('profiel/zet', { aan: true, over: 'tafelgast-B' }, b);
  const naamA = (await json(await rv('profiel', {}, a))).codenaam;
  const naamB = (await json(await rv('profiel', {}, b))).codenaam;
  const office = await officeTok();

  const gemaakt = await json(await raw('/office/rendezvous/tafel/maak',
    { naam: 'Diner 04', stad: 'Amsterdam', datum: dag(9), tijd: '20:00',
      thema: 'architectuur', plaatsen: 8, genodigden: [naamA, naamB] }, office));
  assert.ok(gemaakt.ok, 'de tafel is samengesteld');
  assert.equal(gemaakt.tafel.aantal, 2);
  assert.equal(gemaakt.tafel.genodigden, undefined, 'ook het maak-antwoord draagt de lijst niet');

  // het kantoor ziet de lijst wel, op codenaam
  const kantoor = await json(await raw('/office/rendezvous/tafels', {}, office));
  const t = kantoor.tafels.find(x => x.naam === 'Diner 04');
  assert.equal(t.genodigden.length, 2);
  assert.ok(t.genodigden.some(g => g.codenaam === naamA), 'op codenaam, niet op echte naam');

  // het lid ziet zijn uitnodiging en niet de medegasten
  const mijn = await json(await rv('tafels', {}, a));
  const rij = mijn.tafels.find(x => x.naam === 'Diner 04');
  assert.ok(rij, 'de uitnodiging staat bij het lid');
  assert.equal(rij.plaatsen, 8);
  assert.ok(!JSON.stringify(mijn).includes(naamB), 'de medegast lekt niet naar het lid');

  assert.equal((await json(await rv('tafel/antwoord', { id: rij.id, ja: true }, a))).mijnStatus, 'ja');
  const na = await json(await raw('/office/rendezvous/tafels', {}, office));
  assert.equal(na.tafels.find(x => x.naam === 'Diner 04').toegezegd, 1, 'het kantoor ziet de toezegging');
});

test('the table: een onbekende codenaam wordt gemeld, niet stil overgeslagen', async () => {
  const a = await lidMet('lifestyle');
  await rv('profiel/zet', { aan: true, over: 'bestaat' }, a);
  const naamA = (await json(await rv('profiel', {}, a))).codenaam;
  const office = await officeTok();
  const r = await raw('/office/rendezvous/tafel/maak',
    { naam: 'Diner 05', plaatsen: 4, genodigden: [naamA, 'Bestaat Niet'] }, office);
  assert.equal(r.status, 400, 'een tafel van vier die er stiekem drie telt, komt er niet');
  assert.match((await json(r)).error, /Bestaat Niet/);
});

test('the table: iemand erbij kan, maar niet voorbij het aantal plaatsen', async () => {
  const office = await officeTok();
  const leden = [];
  for (let i = 0; i < 3; i++) {
    const t = await lidMet('lifestyle');
    await rv('profiel/zet', { aan: true, over: 'plek-' + i }, t);
    leden.push((await json(await rv('profiel', {}, t))).codenaam);
  }
  const g = await json(await raw('/office/rendezvous/tafel/maak',
    { naam: 'Diner 06', plaatsen: 2, genodigden: [leden[0], leden[1]] }, office));
  const vol = await raw('/office/rendezvous/tafel/nodig', { id: g.tafel.id, codenaam: leden[2] }, office);
  assert.equal(vol.status, 409, 'de tafel zit vol');
});
