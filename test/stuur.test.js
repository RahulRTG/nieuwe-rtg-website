/* Het AI-stuur: Rahul voert acties uit op elk toegestaan API-pad via een
   interne aanroep met de eigen inlog van de gebruiker. Dezelfde rechten en
   dezelfde schakelkast als de app-knoppen; infrastructuur is verboden
   terrein en geld-acties vragen eerst een bevestiging. Draai los:
   node --experimental-sqlite --test test/stuur.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let srv, base, lid, zaak, office;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-stuur-'));

function api(pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}
const doe = (pad, body, token, extra) => api('/api/member/doe', { pad, body, ...(extra || {}) }, token);
const bevestig = (voorstel, token) => api('/api/member/doe/bevestig',
  { goedkeuringId: voorstel.body.goedkeuring.id, akkoord: true }, token);

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  const u = Date.now().toString().slice(-8);
  lid = (await api('/api/auth/register', { name: 'Stuurlid', email: 'stuur' + u + '@x.nl', phone: '06' + u,
    password: 'geheim123', geboortedatum: '1990-05-05', geslacht: 'v', tier: 'rtg', pasApp: 'rtg' })).body.token;
  zaak = (await api('/api/supplier/login', { username: 'rahul', password: 'Imran' })).body.token;
  // boardroom-werk vraagt de eigenaar zelf (de boardroom-poort): zijn accountlogin opent ook het kantoor
  office = (await api('/api/auth/login', { login: 'roellie.i@gmail.com', password: 'Imran', pasApp: 'business' })).body.token;
  assert.ok(lid && zaak && office, 'lid, zaak en backoffice zijn ingelogd');
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('1. de AI doet een echte actie via het stuur: een Office-document maken en teruglezen', async () => {
  const voorstel = await doe('/api/kantoorpakket/maak', { soort: 'tekst', titel: 'Via Rahul' }, lid);
  assert.equal(voorstel.status, 428, 'maken verandert gegevens en wacht op de mens');
  const m = await bevestig(voorstel, lid);
  assert.equal(m.status, 200);
  assert.equal(m.body.ok, true, 'de actie zelf is gelukt');
  const id = m.body.antwoord.id;
  assert.ok(id, 'het document bestaat echt');
  const op = await doe('/api/kantoorpakket/open', { id }, lid);
  assert.equal(op.body.antwoord.titel, 'Via Rahul', 'en is met het stuur terug te lezen');
});

test('2. nooit meer rechten dan de persoon zelf: leden-token blijft leden-token', async () => {
  // een lid dat via het stuur een zaak-pad probeert, ketst op de gewone auth
  const fout = await doe('/api/supplier/state', {}, lid);
  assert.equal(fout.status, 403, 'de rol-allowlist stopt het pad al voor de interne aanroep');
  // en de zaak kan via haar eigen stuur wel bij haar eigen state
  const goed = await api('/api/supplier/doe', { pad: '/api/supplier/state', body: {} }, zaak);
  assert.equal(goed.body.ok, true, 'de zaak kan dat via haar eigen stuur wel');
  assert.ok(goed.body.antwoord.state && goed.body.antwoord.state.supplier, 'met echt antwoord');
});

test('3. infrastructuur is verboden terrein en het stuur zingt niet rond', async () => {
  for (const pad of ['/api/auth/register', '/api/techniek/inloggen', '/api/login', '/api/member/doe']) {
    const r = await doe(pad, {}, lid);
    assert.equal(r.status, 403, pad + ' is dicht voor het stuur');
  }
});

test('4. een wijziging vraagt een exact, eenmalig serverakkoord', async () => {
  const eerst = await doe('/api/kantoorpakket/maak', { soort: 'tekst', titel: 'Mens beslist' }, lid);
  assert.equal(eerst.status, 428, 'een mutatie komt eerst terug als voorstel');
  assert.equal(eerst.body.bevestigNodig, true);
  const nep = await doe('/api/kantoorpakket/maak', { soort: 'tekst', titel: 'Mens beslist' }, lid, { bevestigd: true });
  assert.equal(nep.status, 428, 'een door client of model verzonnen boolean is geen akkoord');
  const dan = await bevestig(eerst, lid);
  assert.equal(dan.status, 200, 'het aparte endpoint voert exact het vastgezette voorstel uit');
  assert.equal(dan.body.ok, true);
  const replay = await bevestig(eerst, lid);
  assert.equal(replay.status, 404, 'het akkoord kan niet opnieuw worden gebruikt');
});

test('5. de schakelkast geldt ook hier: boardroom zet het stuur uit voor de RTG Pass', async () => {
  const zet = await api('/api/office/boardroom/schakel', { functie: 'stuur', doelgroep: 'rtg', aan: false }, office);
  assert.equal(zet.status, 200);
  const dicht = await doe('/api/kantoorpakket/mijn', {}, lid);
  assert.equal(dicht.status, 503, 'het stuur is dicht voor deze pas');
  await api('/api/office/boardroom/schakel', { functie: 'stuur', doelgroep: 'rtg', aan: true }, office);
  const open = await doe('/api/kantoorpakket/mijn', {}, lid);
  assert.equal(open.status, 200, 'en weer open');
});

test('6. de kaart: leden zien leden-paden, de zaak ziet werk-paden', async () => {
  const kl = await api('/api/member/doe/kaart', {}, lid);
  assert.equal(kl.status, 200);
  assert.ok(kl.body.paden.includes('/api/kantoorpakket/open'), 'een beoordeeld leespad staat op de kaart');
  assert.ok(kl.body.paden.includes('/api/kantoorpakket/maak'), 'een beoordeeld voorstelpad staat op de kaart');
  assert.ok(!kl.body.paden.includes('/api/auth/register'), 'een nieuw/verboden pad staat er niet op');
  assert.ok(!kl.body.paden.some(p => p.startsWith('/api/supplier')), 'zonder werk-paden');
  const kz = await api('/api/supplier/doe/kaart', {}, zaak);
  assert.ok(kz.body.paden.some(p => p.startsWith('/api/supplier')), 'de zaak ziet haar werk-paden');
  assert.ok(!kz.body.paden.some(p => p.startsWith('/api/member')), 'en geen leden-paden');
});

/* ---- de pure hulpfuncties: dynamisch stappen-budget + deeltaken ---- */
const { classificeer, parseSubs } = require('../server/kern/stuur');

test('7. classificeer: lichte taken krijgen 4 stappen', () => {
  for (const q of ['zet een timer van 10 minuten', 'zoek lid Amara', 'hoe laat is het', 'wat is mijn saldo']) {
    const c = classificeer(q);
    assert.equal(c.zwaar, false, q);
    assert.equal(c.maxStappen, 4, q);
  }
});

test('8. classificeer: zware taken krijgen 24 stappen', () => {
  for (const q of [
    'plan een complete reis voor 4 personen naar Ibiza met hotel, taxi en tafel',
    'boek een tafel voor vanavond en regel daarna een taxi en bestel bloemen',
    'organiseer een heel weekend weg met diner, hotel en tickets'
  ]) {
    const c = classificeer(q);
    assert.equal(c.zwaar, true, q);
    assert.equal(c.maxStappen, 24, q);
  }
});

test('9. parseSubs: leest JSON of een genummerde lijst, kapt op 3', () => {
  assert.deepEqual(parseSubs('Prima. ["Hotel boeken","Taxi regelen","Tafel reserveren"]'),
    ['Hotel boeken', 'Taxi regelen', 'Tafel reserveren']);
  assert.deepEqual(parseSubs('1. Vlucht zoeken\n2. Hotel boeken\n3. Auto huren\n4. teveel'),
    ['Vlucht zoeken', 'Hotel boeken', 'Auto huren']);
  assert.deepEqual(parseSubs('   '), []);
});
