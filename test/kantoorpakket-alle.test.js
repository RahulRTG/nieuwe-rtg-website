/* RTG Office voor het hele ecosysteem: leden (alle passen), elke
   leverancier en partner (team-drive per zaak) en de eigen RTG-kantoren
   (kantoor-drive). Bewaakt de drie ingangen, de scheiding tussen drives,
   presentaties, meeschrijf-rechten bij delen, de versiegeschiedenis met
   terugzetten, sjablonen en de AI-schrijfhulp (demostand).
   Draai los: node --experimental-sqlite --test test/kantoorpakket-alle.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let srv, base, lidA, lidB, codeB, zaakChef, zaakBediening, anderTeam, kantoor;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-kpa-'));

function api(pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}
let seq = 0;
async function lid() {
  const u = (Date.now() + (++seq)).toString().slice(-8);
  const reg = await api('/api/auth/register', { name: 'Lid ' + seq, email: 'kp' + u + '@x.nl', phone: '06' + u,
    password: 'geheim123', geboortedatum: '1990-05-05', geslacht: 'v', tier: 'rtg', pasApp: 'rtg' });
  const st = await api('/api/state', {}, reg.body.token);
  return { token: reg.body.token, codenaam: st.body.state.user.codename };
}
async function zaak(code, wieNaam) {
  const roster = await api('/api/supplier/roster', { code });
  const wie = wieNaam ? roster.body.staff.find(x => x.name === wieNaam) : roster.body.staff.find(x => x.role === 'manager');
  const pin = wie.role === 'manager' ? '1234' : '5678';
  return (await api('/api/supplier/login', { code, staffId: wie.id, pin })).body.token;
}

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  const a = await lid(); const b = await lid();
  lidA = a.token; lidB = b.token; codeB = b.codenaam;
  zaakChef = await zaak('KIKUNOI');
  zaakBediening = await zaak('KIKUNOI', 'Nora Prins');
  anderTeam = await zaak('PONTO');
  kantoor = (await api('/api/office/login', { code: 'RTG-OFFICE' })).body.token;
  assert.ok(lidA && lidB && zaakChef && zaakBediening && anderTeam && kantoor, 'alle rollen zijn binnen');
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('1. de team-drive van de zaak: het hele team werkt in dezelfde map', async () => {
  const m = await api('/api/supplier/kantoorpakket/maak', { soort: 'tekst', titel: 'Weekmenu' }, zaakChef);
  assert.equal(m.status, 200);
  const id = m.body.id;
  await api('/api/supplier/kantoorpakket/bewaar', { id, inhoud: { tekst: 'Maandag: paella.' } }, zaakChef);
  // een collega van dezelfde zaak ziet het document en schrijft gewoon mee
  const mijn = await api('/api/supplier/kantoorpakket/mijn', {}, zaakBediening);
  assert.ok(mijn.body.docs.some(d => d.id === id), 'de collega ziet het teamdocument');
  const bw = await api('/api/supplier/kantoorpakket/bewaar', { id, inhoud: { tekst: 'Maandag: paella. Dinsdag: vis.' } }, zaakBediening);
  assert.equal(bw.status, 200, 'het hele team heeft schrijfrechten');
  // een andere zaak ziet er niets van
  const ander = await api('/api/supplier/kantoorpakket/mijn', {}, anderTeam);
  assert.ok(!ander.body.docs.some(d => d.id === id), 'de drive is per zaak gescheiden');
  assert.equal((await api('/api/supplier/kantoorpakket/open', { id }, anderTeam)).status, 403);
});

test('2. de kantoor-drive van de eigen RTG-kantoren', async () => {
  const m = await api('/api/office/kantoorpakket/maak', { soort: 'blad', titel: 'Kwartaal' }, kantoor);
  assert.equal(m.status, 200);
  const bw = await api('/api/office/kantoorpakket/bewaar', { id: m.body.id, inhoud: { cellen: { A1: '10', A2: '=SOM(A1:A1)' } } }, kantoor);
  assert.equal(bw.status, 200);
  const op = await api('/api/office/kantoorpakket/open', { id: m.body.id }, kantoor);
  assert.equal(op.body.door, 'RTG Kantoor', 'de kantoor-drive heeft een eigen naam');
  // de zaak-drive en de kantoor-drive zijn strikt gescheiden
  assert.equal((await api('/api/supplier/kantoorpakket/open', { id: m.body.id }, zaakChef)).status, 403);
});

test('3. presentaties: dia\'s maken, bewaren en netjes begrensd', async () => {
  const m = await api('/api/kantoorpakket/maak', { soort: 'presentatie', titel: 'Pitch juli' }, lidA);
  assert.equal(m.status, 200);
  const id = m.body.id;
  const bw = await api('/api/kantoorpakket/bewaar', { id, inhoud: { dias: [
    { titel: 'Opening', tekst: 'Welkom.' }, { titel: 'De cijfers', tekst: 'Groei per kwartaal.' }, { onzin: 'x' }
  ] } }, lidA);
  assert.equal(bw.status, 200);
  const op = await api('/api/kantoorpakket/open', { id }, lidA);
  assert.equal(op.body.soort, 'presentatie');
  assert.equal(op.body.inhoud.dias.length, 3);
  assert.equal(op.body.inhoud.dias[1].titel, 'De cijfers');
  assert.equal(op.body.inhoud.dias[2].titel, '', 'vreemde velden worden schoongemaakt');
});

test('4. delen met meeschrijf-rechten: B schrijft mee; met leesrechten niet', async () => {
  const m = await api('/api/kantoorpakket/maak', { soort: 'tekst', titel: 'Samen stuk' }, lidA);
  const id = m.body.id;
  await api('/api/kantoorpakket/bewaar', { id, inhoud: { tekst: 'Eerste zin.' } }, lidA);
  await api('/api/kantoorpakket/deel', { id, codenaam: codeB, rechten: 'bewerken' }, lidA);
  const opB = await api('/api/kantoorpakket/open', { id }, lidB);
  assert.equal(opB.body.magBewerken, true, 'B is meeschrijver');
  assert.equal(opB.body.eigenaar, false);
  const bwB = await api('/api/kantoorpakket/bewaar', { id, inhoud: { tekst: 'Eerste zin. Tweede zin van B.' } }, lidB);
  assert.equal(bwB.status, 200);
  // terugschakelen naar alleen lezen
  await api('/api/kantoorpakket/deel', { id, codenaam: codeB, rechten: 'lezen' }, lidA);
  assert.equal((await api('/api/kantoorpakket/bewaar', { id, inhoud: { tekst: 'x' } }, lidB)).status, 403, 'als meelezer niet meer');
  assert.equal((await api('/api/kantoorpakket/open', { id }, lidB)).body.magBewerken, false);
});

test('5. de versiegeschiedenis: elke wijziging bewaart de vorige stand, en terugzetten kan', async () => {
  const m = await api('/api/kantoorpakket/maak', { soort: 'tekst', titel: 'Concept' }, lidA);
  const id = m.body.id;
  await api('/api/kantoorpakket/bewaar', { id, inhoud: { tekst: 'Versie een.' } }, lidA);
  await api('/api/kantoorpakket/bewaar', { id, inhoud: { tekst: 'Versie twee.' } }, lidA);
  const v = await api('/api/kantoorpakket/versies', { id }, lidA);
  assert.equal(v.status, 200);
  assert.ok(v.body.versies.length >= 1, 'er staat geschiedenis');
  // nr 0 is de jongste bewaarde vorige stand; terugzetten haalt die terug
  const t = await api('/api/kantoorpakket/terug', { id, nr: 0 }, lidA);
  assert.equal(t.status, 200);
  assert.equal(t.body.inhoud.tekst, 'Versie een.', 'de vorige stand staat terug');
  assert.equal((await api('/api/kantoorpakket/terug', { id, nr: 99 }, lidA)).status, 404);
});

test('6. sjablonen: een vliegende start met een factuurblad en een pitch', async () => {
  const lijst = await api('/api/kantoorpakket/mijn', {}, lidA);
  assert.ok((lijst.body.sjablonen || []).length >= 5, 'de sjablonen staan in de mappenlijst');
  const f = await api('/api/kantoorpakket/maak', { sjabloon: 'factuurblad' }, lidA);
  const opF = await api('/api/kantoorpakket/open', { id: f.body.id }, lidA);
  assert.equal(opF.body.soort, 'blad');
  assert.equal(opF.body.inhoud.cellen.D6, '=SOM(D2:D4)', 'de totaalformule staat klaar');
  const p = await api('/api/kantoorpakket/maak', { sjabloon: 'pitch' }, lidA);
  const opP = await api('/api/kantoorpakket/open', { id: p.body.id }, lidA);
  assert.equal(opP.body.soort, 'presentatie');
  assert.equal(opP.body.inhoud.dias.length, 4);
});

test('7. de AI-schrijfhulp: stelt voor (demostand), en alleen voor wie mag schrijven', async () => {
  const m = await api('/api/kantoorpakket/maak', { soort: 'tekst', titel: 'AI-stuk' }, lidA);
  const id = m.body.id;
  await api('/api/kantoorpakket/bewaar', { id, inhoud: { tekst: 'Wij plannen de zomercampagne.' } }, lidA);
  const s = await api('/api/kantoorpakket/ai', { id, opdracht: 'samenvatten' }, lidA);
  assert.equal(s.status, 200);
  assert.ok(s.body.voorstel && s.body.voorstel.length > 10, 'er komt een voorstel');
  const fm = await api('/api/kantoorpakket/ai', { id, opdracht: 'formule', vraag: 'tel kolom A op' }, lidA);
  assert.match(fm.body.voorstel, /^=SOM\(/, 'een formule-voorstel voor het rekenblad');
  assert.equal((await api('/api/kantoorpakket/ai', { id, opdracht: 'hack' }, lidA)).status, 400);
  assert.equal((await api('/api/kantoorpakket/ai', { id, opdracht: 'samenvatten' }, lidB)).status, 403, 'zonder schrijfrechten geen AI-hulp');
});

test('8. de oude poorten blijven staan: gasten niet, en eigendom blijft beschermd', async () => {
  const gast = (await api('/api/login', { tier: 'guest', pasApp: 'rtg' })).body.token;
  assert.equal((await api('/api/kantoorpakket/mijn', {}, gast)).status, 403, 'de gratis app heeft geen Office');
  assert.equal((await api('/api/supplier/kantoorpakket/mijn', {})).status, 401, 'de team-drive vraagt een zaak-inlog');
  assert.equal((await api('/api/office/kantoorpakket/mijn', {})).status, 401, 'de kantoor-drive vraagt een kantoor-inlog');
  const m = await api('/api/kantoorpakket/maak', { soort: 'tekst' }, lidA);
  assert.equal((await api('/api/kantoorpakket/weg', { id: m.body.id }, lidB)).status, 403, 'alleen de eigenaar verwijdert');
});
