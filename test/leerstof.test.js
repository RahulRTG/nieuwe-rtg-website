/* RTG School golf 2: de leerstof-motor. Elke groep heeft echte leerdoelen
   met een les, de oefensessie is server-authoritatief (antwoorden staan
   nooit in de vraag), een behaald doel komt in het leerpaspoort, en er
   zijn bewust geen scores, reeksen of ranglijsten buiten de sessie.
   Draai los: node --test test/leerstof.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let srv, base, token;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-leerstof-'));

function api(pad, body, tok) {
  return fetch(base + '/api' + pad, { method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (tok || token) },
    body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}

/* De testleerling kan echt rekenen: de vraag komt binnen, wij rekenen hem uit. */
function rekenUit(vraag, opties) {
  const som = vraag.match(/^(\d+(?:,\d+)?)\s*([+x:-])\s*(\d+(?:,\d+)?)\s*=/);
  if (som) {
    const a = Number(som[1].replace(',', '.')), b = Number(som[3].replace(',', '.'));
    const uit = som[2] === '+' ? a + b : som[2] === '-' ? a - b : som[2] === 'x' ? a * b : a / b;
    return String(Math.round(uit * 10) / 10).replace('.', ',');
  }
  const splits = vraag.match(/^(\d+) en hoeveel is samen (\d+)\?/);
  if (splits) return String(Number(splits[2]) - Number(splits[1]));
  const tel = vraag.match(/Tel de stippen: (.*)$/);
  if (tel) return String(tel[1].split('●').length - 1);
  const buur = vraag.match(/Welk getal komt (na|voor) (\d+)/);
  if (buur) return String(Number(buur[2]) + (buur[1] === 'na' ? 1 : -1));
  if (opties && opties.length) return opties[0]; // meerkeuze: gok; de test stuurt hierop niet
  return '???';
}

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  const u = Date.now().toString().slice(-8);
  const r = await fetch(base + '/api/auth/register', { method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Rekenwonder Acht', email: 'ls' + u + '@x.nl', phone: '06' + u,
      password: 'geheim123', geboortedatum: '1995-03-03', geslacht: 'm', tier: 'rtg', pasApp: 'rtg' }) });
  token = (await r.json()).token;
  await api('/onderwijs/inschrijf', { fase: 'po-g3' });
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('1. elke groep heeft echte leerdoelen met een les in gewone taal', async () => {
  for (let g = 1; g <= 8; g++) {
    const v = await api('/leerstof/vakken', { groep: g });
    assert.equal(v.status, 200, 'groep ' + g);
    const alle = v.body.vakken.flatMap(x => x.doelen);
    assert.ok(alle.length >= 4, 'groep ' + g + ' heeft een gevulde leerlijn');
  }
  const les = await api('/leerstof/les', { doel: 'rekenen.g3.optellen-tot-20' });
  assert.equal(les.status, 200);
  assert.ok(les.body.doel.les.length > 40, 'de les is echte uitleg, geen kreet');
  assert.equal((await api('/leerstof/les', { doel: 'bestaat.niet' })).status, 404);
});

test('2. een goede sessie schrijft het leerdoel bij in het leerpaspoort', async () => {
  let r = await api('/leerstof/oefen', { doel: 'rekenen.g3.optellen-tot-20' });
  assert.equal(r.status, 200);
  assert.equal(r.body.totaal, 5);
  assert.ok(!JSON.stringify(r.body).includes('"a":'), 'het antwoord reist nooit mee met de vraag');
  let vraag = r.body.vraag, opties = r.body.opties;
  for (let i = 0; i < 5; i++) {
    r = await api('/leerstof/antwoord', { antwoord: rekenUit(vraag, opties) });
    assert.equal(r.status, 200);
    assert.equal(r.body.goed, true, 'som ' + (i + 1) + ' klopt: ' + vraag);
    vraag = r.body.vraag; opties = r.body.opties;
  }
  assert.equal(r.body.klaar, true);
  assert.equal(r.body.behaald, true);
  const pas = await api('/onderwijs/mijn');
  assert.ok(pas.body.doelen['rekenen.g3.optellen-tot-20'], 'het paspoort kent het behaalde doel');
});

test('3. fouten zijn gewoon oefening: geen behaald, wel een vriendelijk advies, en nergens een ranglijst', async () => {
  let r = await api('/leerstof/oefen', { doel: 'rekenen.g3.aftrekken-tot-20' });
  for (let i = 0; i < 5; i++) r = await api('/leerstof/antwoord', { antwoord: 'nee hoor' });
  assert.equal(r.body.klaar, true);
  assert.equal(r.body.behaald, false);
  assert.match(r.body.advies, /oefening|opnieuw/i, 'de toon blijft vriendelijk');
  const alles = JSON.stringify(r.body) + JSON.stringify((await api('/onderwijs/mijn')).body);
  assert.doesNotMatch(alles, /reeks|streak|ranglijst|score/i, 'leren is geen wedstrijd');
  assert.doesNotMatch(alles, /Rekenwonder/, 'en het draait op de codenaam');
  assert.equal((await api('/leerstof/antwoord', { antwoord: '1' })).status, 400, 'een klare sessie is klaar');
  assert.equal((await api('/leerstof/vakken', { groep: 3 }, 'nep')).status, 401);
});
