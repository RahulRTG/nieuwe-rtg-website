/* Fluister, de persoonlijke assistent met geheugen: onthoudt wat je hem
   vertelt, leert van je schermgebruik (alleen tellers), is volledig
   transparant ("wat weet je over mij") en wisbaar. Voor leden en voor het
   personeel, elk met een eigen, gescheiden geheugen. Draai los:
   node --experimental-sqlite --test test/fluister.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let srv, base;
let lid, pda;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-fluister-'));

const api = (pad, body, t) => fetch(base + '/api/' + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t },
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  lid = (await (await fetch(base + '/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tier: 'rtg' }) })).json()).token;
  const roster = await api('supplier/roster', { code: 'HOSHI' });
  const m = (roster.body.staff || []).find(x => x.role === 'manager');
  pda = (await (await fetch(base + '/api/supplier/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: 'HOSHI', staffId: m.id, pin: '1234' })
  })).json()).token;
  assert.ok(lid && pda);
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('onthouden, opvragen en wissen: het geheugen is van de gebruiker', async () => {
  assert.equal((await api('fluister', { q: '' }, lid)).status, 400, 'zonder vraag geen antwoord');
  const r1 = await api('fluister', { q: 'onthoud dat ik cava drink, nooit rode wijn' }, lid);
  assert.equal(r1.status, 200);
  assert.ok(/Onthouden/i.test(r1.body.antwoord));
  await api('fluister', { q: 'onthoud dat mijn verjaardag op 3 augustus valt' }, lid);
  const prof = (await api('fluister/profiel', {}, lid)).body;
  assert.equal(prof.weetjes.length, 2);
  assert.ok(prof.weetjes.some(w => /cava/.test(w.tekst)));
  // volledige transparantie: hij vertelt precies wat hij weet
  const wat = (await api('fluister', { q: 'wat weet je over mij?' }, lid)).body;
  assert.ok(/cava/.test(wat.antwoord) && /augustus/.test(wat.antwoord));
  // wissen per stuk en in een keer
  assert.equal((await api('fluister/vergeet', { wat: 0 }, lid)).body.weetjes.length, 1);
  const alles = await api('fluister', { q: 'vergeet alles' }, lid);
  assert.ok(/schone lei/i.test(alles.body.antwoord));
  assert.equal((await api('fluister/profiel', {}, lid)).body.weetjes.length, 0);
});

test('Fluister fluistert zelf: seintjes uit datums in weetjes en uit de agenda', async () => {
  // een verjaardag over vijf dagen, gewoon in het Nederlands verteld
  const NL = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'];
  const d = new Date(Date.now() + 5 * 86400000);
  await api('fluister', { q: 'onthoud dat mijn verjaardag op ' + d.getUTCDate() + ' ' + NL[d.getUTCMonth()] + ' valt' }, lid);
  const prof = (await api('fluister/profiel', {}, lid)).body;
  const jarig = (prof.seintjes || []).find(s => s.icoon === '🎂');
  assert.ok(jarig, 'de verjaardag uit het weetje wordt een seintje');
  assert.ok(/over 5 dagen/.test(jarig.tekst));
  // een reservering voor morgen fluistert vanzelf mee
  const morgen = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const r = await api('reserveer', { supplierCode: 'KIKUNOI', datum: morgen, tijd: '20:00', personen: 2 }, lid);
  assert.equal(r.status, 200);
  const prof2 = (await api('fluister/profiel', {}, lid)).body;
  assert.ok(prof2.seintjes.some(s => /morgen 20:00 gereserveerd/.test(s.tekst)));
  // en de seintjes reizen mee in een gewoon antwoord
  const antw = (await api('fluister', { q: 'goedemorgen, iets voor mij?' }, lid)).body;
  assert.ok(/gereserveerd|seintje/i.test(antw.antwoord));
  await api('reservering/annuleer', { id: r.body.reservering.id }, lid);
  await api('fluister', { q: 'vergeet alles' }, lid);
});

test('hij onthoudt het gesprek (kort) en wist het net zo makkelijk', async () => {
  assert.equal((await api('fluister/profiel', {}, lid)).body.gesprek, 0, 'na "vergeet alles" is ook het gesprek weg');
  await api('fluister', { q: 'goedemorgen' }, lid);
  await api('fluister', { q: 'en hoe laat is het ontbijt?' }, lid);
  assert.equal((await api('fluister/profiel', {}, lid)).body.gesprek, 2, 'de laatste beurten blijven hangen');
  await api('fluister', { q: 'vergeet alles' }, lid);
  assert.equal((await api('fluister/profiel', {}, lid)).body.gesprek, 0);
});

test('hij leert van je schermgebruik: alleen tellers, en hij benoemt de top', async () => {
  assert.equal((await api('fluister/focus', { scores: { Tafelplanning: 14, Betalen: 3, Kamers: 8 } }, lid)).status, 200);
  const prof = (await api('fluister/profiel', {}, lid)).body;
  assert.equal(prof.top[0], 'Tafelplanning', 'de meest gebruikte kaart staat bovenaan');
  const wat = (await api('fluister', { q: 'wat weet je over mij?' }, lid)).body;
  assert.ok(/Tafelplanning/.test(wat.antwoord), 'hij vertelt eerlijk waar hij dat van weet');
});

test('het personeel heeft een eigen Fluister, gescheiden van het lid en de zaak', async () => {
  const r = await api('staff/fluister', { q: 'onthoud dat ik op dinsdag altijd de late dienst draai' }, pda);
  assert.equal(r.status, 200);
  const profPda = (await api('staff/fluister/profiel', {}, pda)).body;
  assert.equal(profPda.weetjes.length, 1);
  assert.ok(/late dienst/.test(profPda.weetjes[0].tekst));
  // het geheugen van het lid is en blijft leeg: strikt gescheiden werelden
  assert.equal((await api('fluister/profiel', {}, lid)).body.weetjes.length, 0);
  // en de actuele stand reist mee in een gewoon gesprek
  const antw = (await api('staff/fluister', { q: 'goedemorgen, wat is de stand?' }, pda)).body;
  assert.ok(antw.antwoord && antw.antwoord.length > 10);
});
