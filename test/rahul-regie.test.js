/* Rahul regelt de regie: de AI-hulp van de boardroom begrijpt gewone taal
   over de app-regie (per pas), de leveranciers-regie (per genre) en de
   geld-regie (pasprijzen, ledenvoordeel, partnervergoeding). Mens beslist:
   de AI stelt alleen voor; er verandert pas iets als de eigenaar toepast.
   Zonder AI-sleutel draait de ingebouwde taal-hulp; die toetsen we hier.
   Draai los: node --experimental-sqlite --test test/rahul-regie.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let srv, base, tech, office, lid, genre;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-rahul-'));

function api(pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  // de eigenaar op de technische pagina (het thuisadres van het schakelbord)
  tech = (await api('/api/techniek/inloggen', { login: 'roellie.i@gmail.com', wachtwoord: 'Imran' })).body.token;
  // boardroom-werk vraagt de eigenaar zelf (de boardroom-poort): zijn accountlogin opent ook het kantoor
  office = (await api('/api/auth/login', { login: 'roellie.i@gmail.com', password: 'Imran', pasApp: 'business' })).body.token;
  const u = Date.now().toString().slice(-8);
  lid = (await api('/api/auth/register', { name: 'Rahultest', email: 'rah' + u + '@x.nl', phone: '06' + u,
    password: 'geheim123', geboortedatum: '1990-05-05', geslacht: 'v', tier: 'rtg', pasApp: 'rtg' })).body.token;
  genre = (await api('/api/office/geld', {}, office)).body.zaken.find(z => z.code === 'KIKUNOI').genre;
  assert.ok(tech && office && lid && genre, 'eigenaar, kantoor en lid zijn ingelogd');
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('1. per pas in gewone taal: Rahul stelt voor, er verandert niets tot de eigenaar toepast', async () => {
  const ai = await api('/api/boardroom/ai', { vraag: 'Zet theater uit voor de rtg leden' }, tech);
  assert.equal(ai.status, 200);
  const w = ai.body.voorstel.find(x => x.id === 'theater' && x.doelgroep === 'rtg' && x.aan === false);
  assert.ok(w, 'het voorstel staat klaar: theater uit voor de RTG Pass');
  assert.equal((await api('/api/theater/zaal', {}, lid)).status, 200, 'mens beslist: er is nog niets veranderd');
  const doe = await api('/api/boardroom/toepassen', { voorstel: ai.body.voorstel }, tech);
  assert.equal(doe.status, 200);
  assert.equal((await api('/api/theater/zaal', {}, lid)).status, 503, 'na toepassen is de pas echt dicht');
  await api('/api/boardroom/toepassen', { voorstel: [{ id: 'theater', doelgroep: 'rtg', aan: true }] }, tech);
  assert.equal((await api('/api/theater/zaal', {}, lid)).status, 200, 'en weer open');
});

test('2. per genre in gewone taal: sluit RTG Eye voor een genre zaken', async () => {
  const ai = await api('/api/boardroom/ai', { vraag: 'Sluit rtg eye voor ' + genre }, tech);
  const w = ai.body.voorstel.find(x => x.id === 'oog' && x.genre === genre && x.aan === false);
  assert.ok(w, 'het genre-voorstel staat klaar: ' + JSON.stringify(ai.body.voorstel));
  await api('/api/boardroom/toepassen', { voorstel: [w] }, tech);
  const bord = await api('/api/office/boardroom', {}, office);
  assert.ok(bord.body.genreRegels.some(r => r.functie === 'oog' && r.genre === genre), 'de regel staat op het bord');
  await api('/api/boardroom/toepassen', { voorstel: [{ id: 'oog', genre, aan: true }] }, tech);
  const na = await api('/api/office/boardroom', {}, office);
  assert.ok(!na.body.genreRegels.some(r => r.functie === 'oog' && r.soort === 'dicht'), 'de sluiting gaat er ook weer af');
});

test('3. de geld-regie in gewone taal: pasprijs en ledenvoordeel, met de vaste grenzen', async () => {
  const ai = await api('/api/boardroom/ai', { vraag: 'Zet de rtg pas op 70 euro per maand' }, tech);
  const w = ai.body.voorstel.find(x => x.soort === 'pasprijs' && x.pas === 'rtg' && x.euro === 70);
  assert.ok(w, 'het pasprijs-voorstel staat klaar');
  assert.equal((await api('/api/pasprijzen', {})).body.passen.rtg.maandCenten, 6500, 'mens beslist: nog niets veranderd');
  await api('/api/boardroom/toepassen', { voorstel: [w] }, tech);
  assert.equal((await api('/api/pasprijzen', {})).body.passen.rtg.maandCenten, 7000, 'na toepassen geldt de nieuwe prijs');
  await api('/api/boardroom/toepassen', { voorstel: [{ soort: 'pasprijs', pas: 'rtg', euro: 65 }] }, tech);
  // ledenvoordeel via taal
  const ai2 = await api('/api/boardroom/ai', { vraag: 'Geef ' + genre + ' 10 procent ledenvoordeel' }, tech);
  const w2 = ai2.body.voorstel.find(x => x.soort === 'korting' && x.genre === genre && x.pct === 10);
  assert.ok(w2, 'het kortingsvoorstel staat klaar: ' + JSON.stringify(ai2.body.voorstel));
  await api('/api/boardroom/toepassen', { voorstel: [w2] }, tech);
  assert.equal((await api('/api/office/geld', {}, office)).body.kortingen[genre], 10);
  await api('/api/boardroom/toepassen', { voorstel: [{ soort: 'korting', genre, pct: 0 }] }, tech);
  // de vaste afspraken blijven vast, ook via taal
  const gratis = await api('/api/boardroom/ai', { vraag: 'Zet de gratis pas op 5 euro' }, tech);
  assert.equal(gratis.body.voorstel.length, 0, 'de gratis app blijft gratis; Rahul stelt niets voor');
  const onzin = await api('/api/boardroom/toepassen', { voorstel: [{ soort: 'pasprijs', pas: 'business', euro: 500 }, { id: 'bestaat-niet', aan: false }] }, tech);
  assert.equal(onzin.body.toegepast, 0, 'onmogelijke voorstellen komen niet door de validatie');
});
