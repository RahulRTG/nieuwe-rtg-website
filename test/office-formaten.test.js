/* RTG Office in en uit, op een echte server (OFFICE.md punt 23, par. 9 fase 1
   en 2; LAT: elke nieuwe route minstens een treffer op een echte server).

   De waarneming is het BESTAND, niet het antwoord: elke export wordt
   uitgepakt met dezelfde zip-lezer die een import gebruikt, en er wordt in de
   XML gekeken of de classificatie erin staat. En de dragende bewering van de
   import is de RONDREIS: wat eruit gaat als XLSX komt er als hetzelfde blad
   weer in, met dezelfde uitkomsten -- gerekend door de motor van het scherm.

   Draai los: node --test test/office-formaten.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { startServer, stop, kantoorAlsPersoon } = require('./helper');
const { lees } = require('../server/kern/office/zip');
const M = require('../public/shared/rekenmotor.js');

let srv, base, lidA, lidB, codeB;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-office-formaten-'));

function api(pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}
let seq = 0;
async function lid() {
  const u = (Date.now() + (++seq)).toString().slice(-8);
  const reg = await api('/api/auth/register', { name: 'Formaat ' + seq, email: 'fm' + u + '@x.nl', phone: '06' + u,
    password: 'geheim123', geboortedatum: '1990-05-05', geslacht: 'v', tier: 'rtg', pasApp: 'rtg' });
  const st = await api('/api/state', {}, reg.body.token);
  return { token: reg.body.token, codenaam: st.body.state.user.codename };
}
const uitpakken = r => lees(Buffer.from(r.body.bestand, 'base64'));
const tekstIn = (delen, naam) => delen[naam].toString('utf8');
const uitkomsten = cellen => {
  const m = M.maak({ ruw: (b, k, r) => cellen[M.kolNaam(k) + (r + 1)] || '' });
  return Object.keys(cellen).sort().map(ref => ref + '=' + M.tekstVan(m.cel(M.kolIndex(ref.replace(/\d+/, '')), +ref.replace(/\D+/, '') - 1)));
};

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  const a = await lid(), b = await lid();
  lidA = a.token; lidB = b.token; codeB = b.codenaam;
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

const BLAD = { cellen: { A1: 'Post', A2: '12,5', A3: '7', A4: '=SOM(A2:A3)', B4: '=JAAR("2026-03-01")', C1: '0,21' },
  opmaak: { A1: 'kop', A4: 'geld', C1: 'procent' }, rijen: 20, kolommen: 8 };

test('1. een strikt rekenblad gaat eruit als XLSX met de classificatie IN het bestand en een regel in het spoor', async () => {
  const m = await api('/api/kantoorpakket/maak', { soort: 'blad', titel: 'Begroting' }, lidA);
  const id = m.body.id;
  assert.equal((await api('/api/kantoorpakket/bewaar', { id, inhoud: BLAD }, lidA)).status, 200);
  assert.equal((await api('/api/kantoorpakket/beheer', { id, classificatie: 'strikt' }, lidA)).status, 200);
  const r = await api('/api/kantoorpakket/exporteer', { id, formaat: 'xlsx' }, lidA);
  assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 200));
  assert.equal(r.body.naam, 'Begroting (Strikt).xlsx');
  assert.equal(r.body.label, 'Strikt');
  const delen = uitpakken(r);
  assert.match(tekstIn(delen, 'docProps/custom.xml'), /name="RTG-Classificatie"><vt:lpwstr>Strikt</);
  assert.match(tekstIn(delen, 'xl/worksheets/sheet1.xml'), /<oddHeader>&amp;CClassificatie: Strikt</);
  const blad = tekstIn(delen, 'xl/worksheets/sheet1.xml');
  assert.match(blad, /<c r="A4" s="2"><f>SUM\(A2:A3\)<\/f><v>19.5<\/v><\/c>/, 'formule vertaald, uitkomst van de motor bewaard');
  assert.match(blad, /<c r="B4"><v>2026<\/v><\/c>/, 'de waarde van JAAR gaat mee');
  assert.ok(!/<c r="B4"[^>]*><f>/.test(blad), 'JAAR gaat niet als formule mee: datums rekenen in Excel anders');
  assert.deepEqual(r.body.trouw.map(t => t.cel), ['B4'], 'en dat staat in de trouwlijst');
  const open = await api('/api/kantoorpakket/open', { id }, lidA);
  const spoor = open.body.werkstroom.audit[0];
  assert.equal(spoor.actie, 'geexporteerd');
  assert.equal(spoor.formaat, 'xlsx');
  assert.equal(spoor.classificatie, 'strikt');
  // de poort sloot intussen het delen nog steeds
  assert.equal((await api('/api/kantoorpakket/deel', { id, codenaam: codeB }, lidA)).status, 409);
});

test('2. tegenproef: intern draagt geen achtervoegsel; wie niet mag lezen, exporteert niets', async () => {
  const m = await api('/api/kantoorpakket/maak', { soort: 'blad', titel: 'Open blad' }, lidA);
  const r = await api('/api/kantoorpakket/exporteer', { id: m.body.id, formaat: 'csv' }, lidA);
  assert.equal(r.status, 200);
  assert.equal(r.body.naam, 'Open blad.csv');
  const vreemd = await api('/api/kantoorpakket/exporteer', { id: m.body.id, formaat: 'csv' }, lidB);
  assert.equal(vreemd.status, 403);
  assert.ok(!vreemd.body.bestand);
  const fout = await api('/api/kantoorpakket/exporteer', { id: m.body.id, formaat: 'docx' }, lidA);
  assert.equal(fout.status, 400);
  assert.deepEqual(fout.body.kan, ['xlsx', 'csv'], 'een weigering zegt hoe het wel kan');
});

test('3. een tekst gaat eruit als DOCX met koppen, lijsten en een tabel, en de koptekst draagt de classificatie', async () => {
  const m = await api('/api/kantoorpakket/maak', { soort: 'tekst', titel: 'Memo' }, lidA);
  const id = m.body.id;
  await api('/api/kantoorpakket/bewaar', { id, inhoud: { tekst: '<h1>Besluit</h1><p>Wij <b>kiezen</b> optie B.</p>' +
    '<ol><li>eerst</li><li>dan</li></ol><table><tr><td>a</td><td>b</td></tr></table><p><a href="https://x">bron</a></p>' } }, lidA);
  await api('/api/kantoorpakket/beheer', { id, classificatie: 'vertrouwelijk' }, lidA);
  const r = await api('/api/kantoorpakket/exporteer', { id, formaat: 'docx' }, lidA);
  assert.equal(r.status, 200);
  assert.equal(r.body.naam, 'Memo (Vertrouwelijk).docx');
  const delen = uitpakken(r);
  const doc = tekstIn(delen, 'word/document.xml');
  assert.match(doc, /<w:pStyle w:val="Kop1"\/>.*Besluit/);
  assert.match(doc, /<w:b\/><\/w:rPr><w:t xml:space="preserve">kiezen/);
  assert.match(doc, /<w:numId w:val="1"\/>.*eerst/);
  assert.match(doc, /<w:tbl>.*<w:t xml:space="preserve">b<\/w:t>/);
  assert.match(tekstIn(delen, 'word/header1.xml'), /Classificatie: Vertrouwelijk/);
  assert.deepEqual(r.body.trouw, [{ wat: 'link, als tekst zonder adres', aantal: 1 }], 'de link valt niet stil weg');
  const html = await api('/api/kantoorpakket/exporteer', { id, formaat: 'html' }, lidA);
  assert.match(Buffer.from(html.body.bestand, 'base64').toString(), /<meta name="rtg-classificatie" content="Vertrouwelijk">/);
});

test('4. de rondreis: wat er als XLSX uitgaat, komt er als hetzelfde blad weer in', async () => {
  const m = await api('/api/kantoorpakket/maak', { soort: 'blad', titel: 'Rondreis' }, lidA);
  await api('/api/kantoorpakket/bewaar', { id: m.body.id, inhoud: BLAD }, lidA);
  const uit = await api('/api/kantoorpakket/exporteer', { id: m.body.id, formaat: 'xlsx' }, lidA);
  const voor = (await api('/api/kantoorpakket/mijn', {}, lidA)).body.docs.length;
  const inn = await api('/api/kantoorpakket/importeer', { bestand: uit.body.bestand, titel: 'Terug' }, lidA);
  assert.equal(inn.status, 200, JSON.stringify(inn.body).slice(0, 200));
  assert.deepEqual(inn.body.trouw, [], 'niets kwijt op de rondreis');
  const terug = await api('/api/kantoorpakket/open', { id: inn.body.id }, lidA);
  assert.equal(terug.body.titel, 'Terug');
  assert.equal(terug.body.inhoud.cellen.A4, '=SUM(A2:A3)', 'de formule komt terug als formule');
  assert.deepEqual(uitkomsten(terug.body.inhoud.cellen), uitkomsten(BLAD.cellen), 'dezelfde uitkomsten');
  assert.deepEqual(terug.body.inhoud.opmaak, BLAD.opmaak, 'dezelfde opmaak');
  assert.equal((await api('/api/kantoorpakket/mijn', {}, lidA)).body.docs.length, voor + 1, 'een NIEUW blad');
  assert.equal(terug.body.werkstroom.audit[0].actie, 'ingelezen');
  // met opzet een tweede handeling (server/lib/mutatiecontracten-officeformaten.js):
  // nog een keer inlezen is nog een blad, nog een keer exporteren nog een regel in het spoor
  assert.equal((await api('/api/kantoorpakket/importeer', { bestand: uit.body.bestand }, lidA)).status, 200);
  assert.equal((await api('/api/kantoorpakket/mijn', {}, lidA)).body.docs.length, voor + 2, 'twee keer inlezen is twee bladen');
  await api('/api/kantoorpakket/exporteer', { id: m.body.id, formaat: 'csv' }, lidA);
  const spoor = (await api('/api/kantoorpakket/open', { id: m.body.id }, lidA)).body.werkstroom.audit;
  assert.deepEqual(spoor.slice(0, 2).map(a => a.actie + ':' + a.formaat), ['geexporteerd:csv', 'geexporteerd:xlsx']);
});

test('5. een kapot of vreemd bestand wordt geweigerd met een reden en maakt niets aan', async () => {
  const voor = (await api('/api/kantoorpakket/mijn', {}, lidA)).body.docs.length;
  const kapot = await api('/api/kantoorpakket/importeer', { bestand: Buffer.from('geen zip').toString('base64') }, lidA);
  assert.equal(kapot.status, 422);
  assert.match(kapot.body.error, /zip/);
  const leeg = await api('/api/kantoorpakket/importeer', {}, lidA);
  assert.equal(leeg.status, 400);
  assert.equal((await api('/api/kantoorpakket/mijn', {}, lidA)).body.docs.length, voor, 'geen half document achtergelaten');
  assert.equal((await api('/api/kantoorpakket/importeer', { bestand: 'AAAA' })).status, 401, 'zonder sessie niets');
});

test('6. een bord gaat eruit als CSV (de oude export gaf een lege webpagina)', async () => {
  const m = await api('/api/kantoorpakket/maak', { soort: 'bord', titel: 'Planning' }, lidA);
  await api('/api/kantoorpakket/bewaar', { id: m.body.id, inhoud: { lijsten: [{ id: 'l1', titel: 'Doen', kaarten: [{ id: 'k1', titel: 'Offerte', wie: 'Jan' }, { id: 'k2', titel: '=HYPERLINK("http://x")' }] }] } }, lidA);
  const r = await api('/api/kantoorpakket/exporteer', { id: m.body.id, formaat: 'csv' }, lidA);
  assert.equal(r.status, 200);
  const csv = Buffer.from(r.body.bestand, 'base64').toString();
  assert.match(csv, /"Doen","Offerte","","geen","Jan","","nee"/);
  assert.match(csv, /"'=HYPERLINK\(""http:\/\/x""\)"/, 'een formule in een kaart wordt tekst, geen opdracht voor het rekenprogramma');
});

test('6b. een presentatie (TXT) en een schets (SVG) dragen de classificatie ook', async () => {
  const p = await api('/api/kantoorpakket/maak', { soort: 'presentatie', titel: 'Deck' }, lidA);
  await api('/api/kantoorpakket/beheer', { id: p.body.id, classificatie: 'strikt' }, lidA);
  const txt = await api('/api/kantoorpakket/exporteer', { id: p.body.id, formaat: 'txt' }, lidA);
  assert.equal(txt.status, 200);
  assert.match(Buffer.from(txt.body.bestand, 'base64').toString(), /^Classificatie: Strikt\n/);
  const sch = await api('/api/kantoorpakket/maak', { soort: 'schets', titel: 'Plan' }, lidA);
  await api('/api/kantoorpakket/beheer', { id: sch.body.id, classificatie: 'vertrouwelijk' }, lidA);
  const svg = await api('/api/kantoorpakket/exporteer', { id: sch.body.id, formaat: 'svg',
    svg: '<?xml version="1.0"?>\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="5" height="5"/></svg>' }, lidA);
  assert.equal(svg.status, 200);
  assert.match(Buffer.from(svg.body.bestand, 'base64').toString(), /<desc>Classificatie: Vertrouwelijk<\/desc>/);
  const geenSvg = await api('/api/kantoorpakket/exporteer', { id: sch.body.id, formaat: 'svg', svg: '<html>' }, lidA);
  assert.equal(geenSvg.status, 400, 'zonder tekening geen bestand');
});

test('6c. zestig exports duwen een classificatiewijziging niet uit het spoor (eigen ring)', async () => {
  const m = await api('/api/kantoorpakket/maak', { soort: 'blad', titel: 'Druk gelezen' }, lidA);
  await api('/api/kantoorpakket/beheer', { id: m.body.id, classificatie: 'vertrouwelijk' }, lidA);
  for (let i = 0; i < 65; i++) await api('/api/kantoorpakket/exporteer', { id: m.body.id, formaat: 'csv' }, lidA);
  await api('/api/kantoorpakket/beheer', { id: m.body.id, classificatie: 'intern' }, lidA);
  for (let i = 0; i < 65; i++) await api('/api/kantoorpakket/exporteer', { id: m.body.id, formaat: 'csv' }, lidA);
  const spoor = (await api('/api/kantoorpakket/open', { id: m.body.id }, lidA)).body.werkstroom.audit;
  const beheer = spoor.filter(a => a.actie === 'documentbeheer-gewijzigd').map(a => a.classificatie);
  assert.deepEqual(beheer, ['intern', 'vertrouwelijk'], 'beide classificatiewijzigingen staan er nog');
  assert.equal(spoor.filter(a => a.actie === 'geexporteerd').length, 5, 'en de laatste vijf exports ernaast');
});

test('7. de andere vier ingangen: zaak, kantoor, gezin en werkplek exporteren en lezen in', async () => {
  const xlsx = (await (async () => {
    const m = await api('/api/kantoorpakket/maak', { soort: 'blad', titel: 'Bron' }, lidA);
    await api('/api/kantoorpakket/bewaar', { id: m.body.id, inhoud: BLAD }, lidA);
    return api('/api/kantoorpakket/exporteer', { id: m.body.id, formaat: 'xlsx' }, lidA);
  })()).body.bestand;
  const rooster = await api('/api/supplier/roster', { code: 'KIKUNOI' });
  const man = (rooster.body.staff || []).find(x => x.role === 'manager');
  const zaak = (await api('/api/supplier/login', { code: 'KIKUNOI', staffId: man.id, pin: '1234' })).body.token;
  const kantoor = await kantoorAlsPersoon(base);
  const eig = (await api('/api/auth/login', { login: 'roellie.i@gmail.com', password: 'Imran' })).body.token;
  const gezin = await api('/api/foundation/gezin/maak', { gezinsnaam: 'Formaatproef', naam: 'Ouder', pin: '1234' });
  const rtfLijf = { code: gezin.body.code, token: gezin.body.token };
  const ingangen = [
    ['/api/supplier/kantoorpakket/', zaak, {}],
    ['/api/office/kantoorpakket/', kantoor, {}],
    ['/api/rtf/kantoorpakket/', null, rtfLijf],
    ['/api/werkplek/kantoorpakket/', eig, { bedrijf: 'rtg' }]
  ];
  for (const [basis, tok, extra] of ingangen) {
    assert.ok(tok || extra.code, basis + ': sessie');
    const inn = await api(basis + 'importeer', { ...extra, bestand: xlsx, titel: 'Via ' + basis }, tok);
    assert.equal(inn.status, 200, basis + 'importeer: ' + JSON.stringify(inn.body).slice(0, 160));
    const uit = await api(basis + 'exporteer', { ...extra, id: inn.body.id, formaat: 'xlsx' }, tok);
    assert.equal(uit.status, 200, basis + 'exporteer: ' + JSON.stringify(uit.body).slice(0, 160));
    assert.match(tekstIn(uitpakken(uit), 'docProps/custom.xml'), /RTG-Classificatie"><vt:lpwstr>Intern</);
    // de deur geldt: zonder sessie komt er niets uit
    assert.ok([401, 403].includes((await api(basis + 'exporteer', { id: inn.body.id, formaat: 'xlsx', bedrijf: extra.bedrijf })).status), basis + ' zonder sessie');
  }
});
