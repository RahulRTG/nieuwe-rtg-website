/* Gekoppelde toestellen (kern/toestellen.js): de tweede herkomst.

   Het zwaartepunt van deze toets is niet dat het werkt, maar dat de sleutel
   SMAL is. Een toestelsleutel mag precies een ding: een dagmeting wegschrijven
   voor het lid dat hem aanmaakte. Hij is geen ledentoken, hij komt niet bij een
   ander lid, en na intrekken is hij meteen niets meer waard.

   Verder: wat een toestel meet komt binnen als 'apparaat' en niet als 'zelf',
   en het overschrijft niet wat het lid zelf zei over dezelfde nacht.
   Draai los: node --experimental-sqlite --test test/toestellen.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let srv, base, lid, lid2, sleutel, toestelId;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-toestel-'));

const api = (pad, body, t) => fetch(base + '/api/' + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t },
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

// de deur van het toestel: eigen kop, geen sessie
const toestelPost = (pad, body, s) => fetch(base + '/api/' + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', 'x-rtg-toestel': s || '' },
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

const gisteren = () => new Date(Date.now() - 86400000).toISOString().slice(0, 10);

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  const login = tier => fetch(base + '/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tier }) }).then(r => r.json()).then(d => d.token);
  lid = await login('rtg');
  lid2 = await login('business');
  assert.ok(lid && lid2);
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('koppelen geeft de sleutel een keer, en bewaart hem niet leesbaar', async () => {
  const zonderNaam = await api('toestellen/koppel', {}, lid);
  assert.equal(zonderNaam.status, 400, 'een toestel zonder naam is later niet in te trekken');

  const r = await api('toestellen/koppel', { naam: 'Horloge' }, lid);
  assert.equal(r.status, 200);
  sleutel = r.body.sleutel;
  toestelId = r.body.toestel.id;
  assert.ok(sleutel && sleutel.length === 48, 'de sleutel komt uit de CSPRNG en is geen raadbaar getal');
  assert.match(r.body.sleutelUitleg, /nooit meer/i, 'en er staat bij dat u hem nu moet bewaren');

  /* De lijst laat hem niet nog een keer zien. Zou dat wel zo zijn, dan is elke
     sessie die de lijst kan opvragen ook een sessie die het toestel kan nadoen. */
  const lijst = await api('toestellen', {}, lid);
  assert.equal(lijst.body.toestellen.length, 1);
  assert.equal(lijst.body.toestellen[0].naam, 'Horloge');
  assert.equal(lijst.body.toestellen[0].sleutel, undefined, 'de sleutel komt nooit terug');
  assert.ok(!JSON.stringify(lijst.body).includes(sleutel), 'ook niet ergens anders in het antwoord');
});

test('wat het toestel meet komt binnen als apparaat, niet als zelf', async () => {
  const r = await toestelPost('toestel/meting', { onderwerp: 'slaap', waarde: 6.5 }, sleutel);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.bron, 'apparaat');
  assert.equal(r.body.toestel, 'Horloge');

  const beeld = (await api('metingen', {}, lid)).body.beeld.slaap;
  assert.equal(beeld.gemeten, true);
  assert.equal(beeld.vandaag, 6.5);
  assert.deepEqual(beeld.herkomsten, ['apparaat']);
});

test('een apparaatmeting overschrijft niet wat u zelf zei, en gaat wel voor', async () => {
  /* Twee beweringen over dezelfde nacht. Het apparaat wint in het gemiddelde --
     die heeft gemeten en u heeft geschat -- maar uw eigen invulling wordt niet
     weggegooid, en het beeld zegt dat er twee herkomsten in zitten. */
  await api('metingen/zet', { onderwerp: 'slaap', waarde: 8 }, lid);
  const beeld = (await api('metingen', {}, lid)).body.beeld.slaap;
  assert.equal(beeld.dagen, 1, 'het blijft een nacht, geen twee');
  assert.equal(beeld.vandaag, 6.5, 'het apparaat gaat voor in de waarde');
  assert.deepEqual(beeld.herkomsten, ['apparaat'], 'het getal komt van het apparaat, en dat zegt hij ook zo');
  assert.deepEqual(beeld.naast, ['zelf'], 'uw eigen invulling staat er nog, apart, en is niet weggegooid');
});

test('de toestelsleutel is GEEN ledentoken', async () => {
  /* De kern van deze laag. Een gestolen horloge mag hooguit verzonnen
     slaapuren opleveren, en niet een sessie. Elk van deze deuren hoort dicht te
     zijn voor een sleutel die alleen mag meten. */
  for (const pad of ['metingen', 'doelen', 'life', 'toestellen', 'ik']) {
    const r = await api(pad, {}, sleutel);
    assert.equal(r.status, 401, '/' + pad + ' hoort dicht te zijn voor een toestelsleutel');
  }
  // en andersom: een ledentoken is geen toestelsleutel
  const metLedentoken = await toestelPost('toestel/meting', { onderwerp: 'slaap', waarde: 5 }, lid);
  assert.equal(metLedentoken.status, 401, 'een ledentoken opent de toesteldeur niet');
});

test('een toestel schrijft alleen bij zijn eigen lid, en onzin komt er niet in', async () => {
  const voorLid2 = (await api('metingen', {}, lid2)).body.beeld.slaap;
  assert.equal(voorLid2.gemeten, false, 'het toestel van lid 1 raakt lid 2 niet');

  /* Voor WIE er geschreven wordt, volgt uit de sleutel. Een meegestuurd lid in
     het verzoek mag daar niets aan veranderen.

     Let op de vorm van deze bewering, want de eerste versie bewees niets: die
     stuurde een verzonnen sleutel mee en keek of lid2 niets kreeg -- en dat
     klopte ook toen de code het lid WEL uit de body haalde, want de meting
     belandde in een derde, niet-bestaande bak. Wat het wel bewijst: de meting
     komt bij de EIGENAAR van de sleutel terecht. */
  await toestelPost('toestel/meting', { onderwerp: 'slaap', waarde: 3, key: 'anders' }, sleutel);
  assert.equal((await api('metingen', {}, lid)).body.beeld.slaap.vandaag, 3,
    'de meting staat bij de eigenaar van de sleutel, ongeacht wat er in het verzoek stond');
  assert.equal((await api('metingen', {}, lid2)).body.beeld.slaap.gemeten, false,
    'en lid 2 heeft er niets van gemerkt');

  assert.equal((await toestelPost('toestel/meting', { onderwerp: 'dromen', waarde: 1 }, sleutel)).status, 404);
  assert.equal((await toestelPost('toestel/meting', { onderwerp: 'slaap', waarde: 99 }, sleutel)).status, 400);
  assert.equal((await toestelPost('toestel/meting', { onderwerp: 'slaap', waarde: 6 }, 'x'.repeat(48))).status, 401,
    'een verzonnen sleutel van de juiste lengte opent niets');
  assert.equal((await toestelPost('toestel/meting', { onderwerp: 'slaap', waarde: 6 }, '')).status, 401);
});

test('intrekken werkt meteen, en wist niet wat er echt gemeten is', async () => {
  await toestelPost('toestel/meting', { onderwerp: 'slaap', waarde: 7, op: gisteren() }, sleutel);
  const voor = (await api('metingen', {}, lid)).body.beeld.slaap;
  assert.equal(voor.dagen, 2, 'twee nachten met een meting');

  const vreemde = await api('toestellen/intrek', { id: toestelId }, lid2);
  assert.equal(vreemde.status, 404, 'het toestel van een ander lid bestaat niet voor jou');

  const weg = await api('toestellen/intrek', { id: toestelId }, lid);
  assert.equal(weg.status, 200);
  assert.equal((await toestelPost('toestel/meting', { onderwerp: 'slaap', waarde: 4 }, sleutel)).status, 401,
    'de sleutel is meteen niets meer waard');

  const na = (await api('metingen', {}, lid)).body.beeld.slaap;
  assert.equal(na.dagen, 2, 'wat het toestel mat blijft staan; dat is echt gemeten');
  assert.ok(na.herkomsten.includes('apparaat'), 'en het blijft als apparaatmeting herkenbaar');
  assert.equal((await api('toestellen', {}, lid)).body.toestellen.length, 0, 'het toestel staat niet meer in de lijst');
});
