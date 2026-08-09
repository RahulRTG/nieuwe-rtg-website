/* AFSPEELLIJSTEN OVER DE VIER VORMEN HEEN -- en wat een lijst NIET bewaart.

   Een lijst is het tweede ding dat in geen van de vier media-domeinen bestond
   (het eerste is de bibliotheek). Klankwerk kent uitgaven, Clips kent clips,
   het Theater kent video's -- maar niemand kende "de rit naar Ibiza": een paar
   nummers, een video en een korte clip achter elkaar.

   WAT HIER BEWEZEN MOET WORDEN is dat de lijst niets KOPIEERT:
     - hij bewaart alleen id's; wat een stuk is, blijft van zijn domein;
     - haalt de maker een stuk weg, dan verdwijnt het niet stil uit de lijst
       maar staat het er als verdwenen, met uitleg;
     - een lijst is van u alleen: een ander komt er niet in, ook niet met het id;
     - de volgorde is echt van u (verplaatsen), en verplaatsen voegt niets toe.

   Draai los: node --experimental-sqlite --test test/medialijsten.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-medialijsten-'));
let srv, base, maker, ander, office;
let clipId, trackId, uitgaveId, videoId, kanaalId, lijstId;
const WEBM = Buffer.concat([Buffer.from([0x1A, 0x45, 0xDF, 0xA3]), Buffer.alloc(600, 7)]);

function api(pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}
let seq = 0;
async function lid(naam) {
  const u = (Date.now() + (++seq)).toString().slice(-8);
  return (await api('/api/auth/register', { name: naam, email: 'ml' + u + '@x.nl', phone: '06' + u,
    password: 'geheim123', geboortedatum: '1990-04-04', geslacht: 'x', tier: 'rtg', pasApp: 'rtg' })).body.token;
}

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  maker = await lid('Lijstmaker'); ander = await lid('Iemand anders');
  office = (await api('/api/office/login', { code: 'RTG-OFFICE' })).body.token;

  clipId = (await api('/api/clips/maak', { titel: 'Haven', duurS: 20, mbGeschat: 4 }, maker)).body.id;
  trackId = (await api('/api/muziek/maak', {}, maker)).body.track.id;
  await api('/api/muziek/bewaar', { id: trackId, naam: 'Middernacht', klaar: true }, maker);
  uitgaveId = (await api('/api/muziek/uitgeven', { id: trackId, toelichting: 'Eerste stuk' }, maker)).body.uitgave.id;
  assert.ok(uitgaveId, 'er is een uitgave');

  kanaalId = (await api('/api/theater/kanaal/aanmeld', { naam: 'Atelier', genre: 'ambacht', bio: 'Hout.' }, maker)).body.kanaal.id;
  await api('/api/office/theater/beslis', { id: kanaalId, besluit: 'goedgekeurd' }, office);
  videoId = (await api('/api/theater/video/maak', { titel: 'De werkbank', omschrijving: 'Hout.', duurS: 74 }, maker)).body.id;
  const up = await fetch(base + '/api/theater/upload/' + videoId, {
    method: 'POST', headers: { 'Content-Type': 'video/webm', Authorization: 'Bearer ' + maker }, body: WEBM });
  assert.equal(up.status, 200, 'de video staat er');
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('1. een lijst maken, hernoemen en zonder naam weigeren', async () => {
  const leeg = await api('/api/mediaos/lijst/maak', { naam: '   ' }, maker);
  assert.equal(leeg.status, 400, 'een lijst zonder naam is geen lijst');

  const m = await api('/api/mediaos/lijst/maak', { naam: 'De rit naar Ibiza' }, maker);
  assert.equal(m.status, 200, JSON.stringify(m.body).slice(0, 160));
  lijstId = m.body.lijst.id;
  assert.equal(m.body.lijst.aantal, 0, 'hij begint leeg');

  const her = await api('/api/mediaos/lijst/zet', { id: lijstId, naam: 'De rit terug' }, maker);
  assert.equal(her.body.lijst.naam, 'De rit terug');
  const alle = await api('/api/mediaos/lijsten', {}, maker);
  assert.equal(alle.body.lijsten.length, 1);
});

test('2. drie vormen in EEN lijst -- dat is het hele punt', async () => {
  for (const sid of ['track:' + uitgaveId, 'video:' + videoId, 'clip:' + clipId]) {
    const r = await api('/api/mediaos/lijst/stuk', { id: lijstId, stukId: sid }, maker);
    assert.equal(r.status, 200, sid + ' erin: ' + JSON.stringify(r.body).slice(0, 140));
  }
  const nog = await api('/api/mediaos/lijst/stuk', { id: lijstId, stukId: 'track:' + uitgaveId }, maker);
  assert.equal(nog.status, 409, 'twee keer hetzelfde stuk is geen lijst maar een fout');
  const onzin = await api('/api/mediaos/lijst/stuk', { id: lijstId, stukId: 'muziek/12' }, maker);
  assert.equal(onzin.status, 400, 'en een id dat geen stuk-id is, komt er niet in');

  const l = await api('/api/mediaos/lijst', { id: lijstId }, maker);
  assert.equal(l.status, 200);
  assert.equal(l.body.stukken.length, 3, 'drie stukken');
  assert.deepEqual(l.body.stukken.map(s => s.vorm), ['track', 'video', 'clip'], 'in de volgorde waarin ze erin gingen');
  assert.deepEqual(l.body.verdwenen, [], 'en er is nog niets verdwenen');
});

test('3. de volgorde is van u, en verplaatsen voegt niets toe', async () => {
  const weg = await api('/api/mediaos/lijst/stuk', { id: lijstId, stukId: 'clip:bestaatniet', naar: 0 }, maker);
  assert.equal(weg.status, 404, 'wat er niet in staat, is niet te verplaatsen');
  const naL = await api('/api/mediaos/lijst', { id: lijstId }, maker);
  assert.equal(naL.body.stukken.length, 3, 'en er is er dus ook geen bijgekomen');

  const r = await api('/api/mediaos/lijst/stuk', { id: lijstId, stukId: 'clip:' + clipId, naar: 0 }, maker);
  assert.equal(r.status, 200);
  assert.equal(r.body.volgorde[0], 'clip:' + clipId, 'de clip staat nu vooraan');
  const l = await api('/api/mediaos/lijst', { id: lijstId }, maker);
  assert.deepEqual(l.body.stukken.map(s => s.vorm), ['clip', 'track', 'video']);
});

test('4. een lijst is van u alleen -- ook met het id erbij', async () => {
  const lezen = await api('/api/mediaos/lijst', { id: lijstId }, ander);
  assert.equal(lezen.status, 404, 'een ander kan hem niet openen');
  const schrijven = await api('/api/mediaos/lijst/stuk', { id: lijstId, stukId: 'track:' + uitgaveId }, ander);
  assert.equal(schrijven.status, 404, 'en er niets in zetten');
  const zijne = await api('/api/mediaos/lijsten', {}, ander);
  assert.deepEqual(zijne.body.lijsten, [], 'en ziet er geen enkele staan');
});

test('5. haalt de maker een stuk weg, dan staat het er als verdwenen -- niet stil weg', async () => {
  /* Dit is de toets die het hele ontwerp draagt: de lijst bewaart alleen het
     id, dus wat weg is bij de bron is hier ook weg. Zou de lijst een KOPIE
     bewaren, dan stond er een kaart die niemand meer kan spelen -- en dat is
     erger dan een lege plek, want er staat een leugen op het scherm. */
  const del = await api('/api/clips/weg', { id: clipId }, maker);
  assert.equal(del.status, 200, 'de maker haalt zijn clip weg: ' + JSON.stringify(del.body).slice(0, 140));

  const l = await api('/api/mediaos/lijst', { id: lijstId }, maker);
  assert.equal(l.body.stukken.length, 2, 'de clip speelt niet meer mee');
  assert.equal(l.body.verdwenen.length, 1, 'maar hij is niet stil verdampt');
  assert.equal(l.body.verdwenen[0].id, 'clip:' + clipId);
  assert.match(l.body.uitleg, /weggehaald door de maker|dicht/, 'met uitleg erbij');

  // en hij is er zelf uit te halen; daarna klopt de lijst weer helemaal
  const uit = await api('/api/mediaos/lijst/stuk', { id: lijstId, stukId: 'clip:' + clipId, aan: false }, maker);
  assert.equal(uit.status, 200);
  const na = await api('/api/mediaos/lijst', { id: lijstId }, maker);
  assert.deepEqual(na.body.verdwenen, []);
  assert.equal(na.body.stukken.length, 2);
});

test('6. een lijst weggooien haalt geen enkel stuk weg', async () => {
  const weg = await api('/api/mediaos/lijst/zet', { id: lijstId, weg: true }, maker);
  assert.equal(weg.status, 200);
  assert.deepEqual(weg.body.lijsten, [], 'de lijst is weg');

  /* En het werk staat er nog. Een afspeellijst is een ORDENING, geen bezit:
     wie zijn lijst opruimt, hoort niet zijn muziek kwijt te raken. */
  const wereld = await api('/api/mediaos/wereld', { modus: 'muziek' }, maker);
  assert.ok((wereld.body.stukken || []).some(s => s.id === 'track:' + uitgaveId), 'de uitgave staat er nog');
  const stuk = await api('/api/mediaos/stuk', { id: 'video:' + videoId }, maker);
  assert.equal(stuk.status, 200, 'en de video ook');
});
