/* Het RTF-kantoor: een spiegel van de RTG-kantoorstructuur (zelfde kamer-ids)
   met de invulling van de stichting, plus de Clubs & steden-afdeling: clubs
   per stad, programma's, RTF-team, afspraken en een gedeeld samenwerkingslog;
   de club zelf kijkt via de clubcode en ziet alleen het eigen dossier. Draai los:
   node --experimental-sqlite --test test/rtfkantoor.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let srv, base, token;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-rtfkantoor-'));
const api = (pad, body) => fetch(base + '/api/rtfkantoor/' + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
const pub = (pad, body) => fetch(base + '/api/rtf/club/' + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, OFFICE_CODE: 'RTF-KEURING-1' } });
  base = srv.base;
  const login = await fetch(base + '/api/office/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: 'RTF-KEURING-1' }) });
  token = (await login.json()).token;
  assert.ok(token, 'het kantoor logt in');
});
test.after(() => { stop(srv && srv.child); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });

test('de RTF-kamers spiegelen de RTG-kantoorstructuur, plus clubs en lab', async () => {
  const dicht = await fetch(base + '/api/rtfkantoor/kamers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  assert.equal(dicht.status, 401, 'zonder inlog blijft de deur dicht');
  const d = await api('kamers');
  assert.equal(d.status, 200);
  // de veertien gespiegelde bedrijfskamers dragen dezelfde ids als het RTG-kantoor
  for (const id of ['sales', 'marketing', 'pr', 'hr', 'financien', 'inkoop', 'verkoop', 'juridisch', 'creatief', 'intern', 'onderzoek', 'klantenservice', 'support', 'kantine'])
    assert.ok(d.body.kamers.some(k => k.id === id), id + ' is gespiegeld');
  for (const id of ['clubs', 'lab']) assert.ok(d.body.kamers.some(k => k.id === id), id + ' is een eigen RTF-kamer');
  const k = await api('kamer', { id: 'clubs' });
  assert.equal(k.status, 200);
  assert.ok(Array.isArray(k.body.kpis) && k.body.kpis.length >= 3, 'de clubs-kamer draagt cijfers');
});

test('taken per kamer: maken, afvinken, en het overzicht telt mee', async () => {
  const m = await api('kamer/taak', { id: 'sales', tekst: 'Bel de eerste stadionclub' });
  assert.equal(m.status, 200);
  const id = m.body.taken[0].id;
  assert.equal((await api('kamer/taak-zet', { id: 'sales', taakId: id, af: true })).status, 200);
  const o = await api('overzicht');
  assert.equal(o.status, 200);
  assert.equal(o.body.kamers, 16, 'zestien kamers in het overzicht');
});

let clubA, clubB;
test('clubs per stad: aanmelden, status, programma, team en afspraak', async () => {
  clubA = (await api('club/maak', { naam: 'FC Havenstad Jeugd', stad: 'Rotterdam', sport: 'voetbal', contact: 'Jeugdbestuur' })).body.club;
  clubB = (await api('club/maak', { naam: 'BC Sterrenwijk', stad: 'Utrecht', sport: 'basketbal' })).body.club;
  assert.ok(clubA.code.startsWith('CLUB-') && clubB.code.startsWith('CLUB-'), 'elke club krijgt een clubcode');
  assert.equal((await api('club/zet', { id: clubA.id, status: 'actief' })).body.club.status, 'actief');
  assert.equal((await api('club/zet', { id: clubA.id, status: 'kwijt' })).status, 400, 'een rare status wordt geweigerd');
  const p = await api('club/programma', { id: clubA.id, naam: 'Gezonde kantine', doel: 'Fruit en water als standaard' });
  assert.equal(p.status, 200);
  const t = await api('club/team', { id: clubA.id, namen: ['Noor van RTF', 'Sam van RTF'] });
  assert.equal(t.body.club.team.length, 2, 'RTF-teamleden gekoppeld');
  assert.equal((await api('club/afspraak', { id: clubA.id, tekst: 'Elke woensdag huiswerkklas na de training' })).status, 200);
  const ov = await api('clubs');
  assert.equal(ov.body.totaal, 2);
  assert.ok(ov.body.steden.some(s => s.stad === 'Rotterdam') && ov.body.steden.some(s => s.stad === 'Utrecht'), 'gegroepeerd per stad');
});

test('het clubportaal: eigen dossier op clubcode, nooit dat van een ander, en het log gaat twee kanten op', async () => {
  const fout = await pub('portaal', { code: 'CLUB-BESTAATNIET' });
  assert.equal(fout.status, 404);
  const p = await pub('portaal', { code: clubA.code });
  assert.equal(p.status, 200);
  assert.equal(p.body.club.naam, 'FC Havenstad Jeugd');
  assert.ok(!JSON.stringify(p.body).includes('Sterrenwijk'), 'club A ziet club B nooit');
  assert.ok(!JSON.stringify(p.body).includes(clubA.code), 'het portaal kaatst de code niet terug');
  // de club schrijft, het kantoor leest (en andersom)
  assert.equal((await pub('bericht', { code: clubA.code, naam: 'Trainer Bas', tekst: 'De huiswerkklas loopt vol, top!' })).status, 200);
  assert.equal((await api('club/bericht', { id: clubA.id, naam: 'Noor van RTF', tekst: 'Mooi! We komen woensdag kijken.' })).status, 200);
  const na = await pub('portaal', { code: clubA.code });
  assert.ok(na.body.club.log.some(m => m.wie === 'club') && na.body.club.log.some(m => m.wie === 'rtf'), 'beide kanten staan in het log');
});
