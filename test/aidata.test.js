/* De eigen-AI-dataset: de boardroom-knop die alle logs (Rahul-gesprekken,
   ballotage, audit, transacties, kantoorchat) als JSONL bewaart om later een
   eigen model te trainen. Getest: het bord telt, de export is geldig JSONL met
   een meta-kop, echte gesprekken komen erin mee, en de export bevat NOOIT echte
   namen (privacy by design: alles op codenaam; de kluis blijft dicht).
   Draai los: node --test test/aidata.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let srv, base, lid, office;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-aidata-'));

const api = (pad, body, token) => fetch(base + '/api/' + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, OFFICE_CODE: 'KANTOOR-AIDATA-1' } });
  base = srv.base;
  const l = await (await fetch(base + '/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tier: 'rtg' }) })).json();
  lid = { token: l.token };
  // boardroom-werk vraagt de eigenaar zelf (de boardroom-poort): zijn accountlogin opent ook het kantoor
  const o = await (await fetch(base + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ login: 'roellie.i@gmail.com', password: 'Imran', pasApp: 'business' }) })).json();
  office = { token: o.token };
  assert.ok(lid.token && office.token, 'lid en kantoor loggen in');
  // een echt kantoorchat-bericht zodat de export gegarandeerd inhoud heeft
  const c = await api('office/kachat/stuur', { kamer: 'boardroom', naam: 'Aïsha', tekst: 'Notitie: het jazz-en-zeilen-arrangement loopt goed.' }, office.token);
  assert.equal(c.status, 200, 'de kantoorchat slaat op');
});
/* DE TWEEDE SERVER LIEGT OVER ZIJN OPSLAG, en krijgt daarom een eigen datamap:
   een opslag die schrijfacties weggooit hoort niet in de map van een andere
   toets te wroeten. Zelfde opzet als test/notitiesduurzaam.test.js. */
let leugen, leugenOffice;
const TMP2 = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-aidata-leugen-'));
test.before(async () => {
  leugen = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP2,
    OFFICE_CODE: 'KANTOOR-AIDATA-2', RTG_VERRAAD: 'schrijf-verloren' } });
  const o = await (await fetch(leugen.base + '/api/auth/login', { method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ login: 'roellie.i@gmail.com', password: 'Imran', pasApp: 'business' }) })).json();
  leugenOffice = o.token;
  assert.ok(leugenOffice, 'ook op de liegende server komt de eigenaar binnen (schrijf-verloren houdt de sessie in het geheugen)');
});

test.after(() => {
  stop(srv && srv.child); stop(leugen && leugen.child);
  for (const m of [TMP, TMP2]) { try { fs.rmSync(m, { recursive: true, force: true }); } catch (e) {} }
});

test('het bord telt de bronnen; zonder inlog blijft de deur dicht', async () => {
  const d = await api('office/aidata', {}, office.token);
  assert.equal(d.status, 200);
  assert.ok(d.body.totaal >= 1, 'er staan records klaar');
  assert.ok(d.body.bronnen.kantoorchat >= 1, 'het kantoorchat-bericht telt mee');
  assert.match(d.body.privacy, /codenamen/, 'het bord benoemt de privacy-afspraak');
  const dicht = await fetch(base + '/api/office/aidata', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  assert.equal(dicht.status, 401);
});

test('de export is geldig JSONL met een meta-kop en bevat het echte gesprek', async () => {
  const r = await fetch(base + '/api/office/aidata/export', { method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + office.token }, body: '{}' });
  assert.equal(r.status, 200);
  assert.match(r.headers.get('content-disposition') || '', /rtg-ai-dataset-.*\.jsonl/, 'komt als downloadbestand');
  const tekst = await r.text();
  const regels = tekst.trim().split('\n').map(x => JSON.parse(x)); // elke regel moet geldige JSON zijn
  assert.equal(regels[0].soort, 'meta', 'de eerste regel beschrijft de snapshot');
  assert.ok(regels[0].bronnen.kantoorchat >= 1);
  assert.ok(regels.some(x => x.bron === 'kantoorchat' && /jazz-en-zeilen/.test(x.tekst || '')), 'het echte chatbericht zit erin');
  // privacy: het intakegesprek noemt hooguit codenamen; de kluisvelden (echte
  // naam/e-mail van de demo-personas) mogen nergens opduiken
  assert.ok(!/@gmail|@outlook|persoonsgegevens/.test(tekst), 'geen kluisdata in de export');
});

test('de export komt in het auditlog van de boardroom', async () => {
  await fetch(base + '/api/office/aidata/export', { method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + office.token }, body: JSON.stringify({ naam: 'Aïsha' }) });
  const b = await api('office/boardroom', {}, office.token);
  const audit = (b.body.audit || []).map(a => a.wat).join(' | ');
  assert.match(audit, /AI-dataset geexporteerd/, 'de export staat in het logboek');
});


/* ---------------------------------------------------------------------------
   HET AUDITSPOOR IS HIER GEEN BIJZAAK MAAR DE VOORWAARDE.

   De kop van de route belooft "Elke export komt in het auditlog". Gemeten met
   een A/B en een herstart ertussen stond daar het tegendeel:

     schoon            -> 200, 287 bytes geleverd, na de herstart 1 auditregel
     schrijf-verloren  -> 200, 287 bytes geleverd, na de herstart GEEN sleutel
                          kantoorAudit -- nul regels

   De complete dataset ging de deur uit en er bleef niets van over. Sinds
   kern/afdelingen/bewaking/index.js het spoor duurzaam vastlegt, wacht deze
   route erop en weigert hij als het niet is vastgelegd.
   ------------------------------------------------------------------------- */

test('de export laat een auditregel achter die de boardroom terugleest', async () => {
  const voor = await api('office/boardroom', {}, office.token);
  const tellingVoor = (voor.body.audit || []).filter(r => /AI-dataset geexporteerd/.test(r.wat || '')).length;

  const r = await fetch(base + '/api/office/aidata/export', { method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + office.token },
    body: JSON.stringify({ naam: 'auditproef' }) });
  assert.equal(r.status, 200);
  await r.text();

  const na = await api('office/boardroom', {}, office.token);
  const regels = (na.body.audit || []).filter(r => /AI-dataset geexporteerd/.test(r.wat || ''));
  assert.ok(regels.length > tellingVoor, 'na de export hoort er een regel bij te staan');
  assert.equal(regels[0].wie, 'auditproef', 'en die regel noemt wie het deed');
});

test('onder een liegende opslag gaat de dataset NIET de deur uit', async () => {
  /* Dit is de bewering die eerder sneuvelde. Niet "hij logt netjes een fout"
     maar: er komt geen 2xx, en er komen geen datasetbytes uit. Liever geen
     export dan een export die niemand later kan terugvinden. */
  const r = await fetch(leugen.base + '/api/office/aidata/export', { method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + leugenOffice },
    body: JSON.stringify({ naam: 'auditproef' }) });
  assert.ok(r.status < 200 || r.status >= 300,
    'een export zonder vastgelegd spoor mag niet met een 2xx worden bevestigd (kreeg ' + r.status + ')');

  const tekst = await r.text();
  assert.doesNotMatch(tekst, /"soort"\s*:\s*"meta"/,
    'er mag geen JSONL-dataset in het antwoord staan als het spoor niet vastligt');
});

test('de knop blijft op een gezonde opslag gewoon werken', async () => {
  /* De eerste reparatiepoging op de geldroute brak vier toetsen. Duurzaamheid
     die met een kapotte knop wordt gekocht, is geen reparatie. */
  const r = await fetch(base + '/api/office/aidata/export', { method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + office.token }, body: '{}' });
  assert.equal(r.status, 200);
  const eerste = JSON.parse((await r.text()).trim().split('\n')[0]);
  assert.equal(eerste.soort, 'meta');
});
