/* RTG Theater: de videobibliotheek op bioscoopniveau. Kanalen gaan pas open
   na menselijke goedkeuring; de bytes blijven exact het origineel (geen
   hercompressie) en komen met range-streaming terug; reacties op codenaam;
   melden landt bij kantoor. Draai los:
   node --experimental-sqlite --test test/theater.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let srv, base, office, maker, kijker, videoId;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-theater-'));

// een piepklein maar geldig webm-begin (EBML-magic) met herkenbare staart
const WEBM = Buffer.concat([Buffer.from([0x1a, 0x45, 0xdf, 0xa3]), Buffer.alloc(2000, 7), Buffer.from('RTGSTAART')]);

function api(pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}
let seq = 0;
async function lid() {
  const u = (Date.now() + (++seq)).toString().slice(-8);
  const reg = await api('/api/auth/register', { name: 'Lid ' + seq, email: 't' + u + '@x.nl', phone: '06' + u,
    password: 'geheim123', geboortedatum: '1990-05-05', geslacht: 'v', tier: 'rtg', pasApp: 'rtg' });
  return reg.body.token;
}

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  office = (await api('/api/office/login', { code: 'RTG-OFFICE' })).body.token;
  maker = await lid(); kijker = await lid();
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('1. een kanaal gaat pas open nadat een mens van kantoor het goedkeurt', async () => {
  const aan = await api('/api/theater/kanaal/aanmeld', { naam: 'Atelier Vega', genre: 'ambacht', bio: 'Handwerk in beeld.' }, maker);
  assert.equal(aan.status, 200);
  assert.equal(aan.body.kanaal.status, 'wacht');
  const dicht = await api('/api/theater/video/maak', { titel: 'Test' }, maker);
  assert.equal(dicht.status, 403, 'uploaden kan pas na goedkeuring');
  assert.ok(/kantoor/i.test(dicht.body.error), 'de reden noemt kantoor: een mens beslist');
  const wacht = await api('/api/office/theater', {}, office);
  const mijn = (wacht.body.wacht || []).find(k => k.naam === 'Atelier Vega');
  assert.ok(mijn);
  const ok = await api('/api/office/theater/beslis', { id: mijn.id, besluit: 'goedgekeurd' }, office);
  assert.equal(ok.status, 200);
});

test('2. upload: alleen echt beeldmateriaal, en de bytes blijven exact het origineel', async () => {
  const kaart = await api('/api/theater/video/maak', { titel: 'De werkbank', omschrijving: 'Een middag hout.', duurS: 74 }, maker);
  assert.equal(kaart.status, 200);
  videoId = kaart.body.id;
  const rauw = (buf, id, token) => fetch(base + '/api/theater/upload/' + id, {
    method: 'POST', headers: { 'Content-Type': 'video/webm', Authorization: 'Bearer ' + token }, body: buf
  }).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
  const nep = await rauw(Buffer.concat([Buffer.from('dit is geen video, echt niet'), Buffer.alloc(300, 32)]), videoId, maker);
  assert.equal(nep.status, 415, 'alleen webm of mp4');
  const ander = await rauw(WEBM, videoId, kijker);
  assert.equal(ander.status, 404, 'alleen de maker uploadt op zijn eigen kaart');
  const echt = await rauw(WEBM, videoId, maker);
  assert.equal(echt.status, 200);
  const dubbel = await rauw(WEBM, videoId, maker);
  assert.equal(dubbel.status, 409, 'een kaart wordt maar een keer gevuld');
});

test('3. de zaal is chronologisch en eerlijk over data; kijken is range-streaming van het origineel', async () => {
  const zaal = await api('/api/theater/zaal', {}, kijker);
  assert.equal(zaal.status, 200);
  const v = [...(zaal.body.nieuw || []), ...(zaal.body.abonnementen || [])].find(x => x.id === videoId);
  assert.ok(v, 'de video staat in de zaal');
  assert.ok(v.mb > 0, 'elke video toont vooraf zijn grootte');
  assert.ok(/hercomprimeren niets/.test(zaal.body.kwaliteit), 'de kwaliteitsbelofte staat er eerlijk in');
  // het token gaat als query mee (een video-element kan geen headers sturen)
  const login = await fetch(base + '/api/theater/kijk/' + videoId);
  assert.equal(login.status, 401, 'kijken kan alleen met een geldige sessie');
  const tok = encodeURIComponent(kijker);
  const stuk = await fetch(base + '/api/theater/kijk/' + videoId + '?token=' + tok, { headers: { Range: 'bytes=0-3' } });
  assert.equal(stuk.status, 206, 'een Range-verzoek krijgt precies dat stuk (206)');
  const bytes = Buffer.from(await stuk.arrayBuffer());
  assert.deepEqual([...bytes], [0x1a, 0x45, 0xdf, 0xa3], 'byte voor byte het origineel');
  assert.equal(stuk.headers.get('content-range'), 'bytes 0-3/' + WEBM.length);
  const staart = await fetch(base + '/api/theater/kijk/' + videoId + '?token=' + tok, { headers: { Range: 'bytes=-9' } });
  assert.equal(Buffer.from(await staart.arrayBuffer()).toString(), 'RTGSTAART', 'ook de staart komt exact terug');
  const alles = await fetch(base + '/api/theater/kijk/' + videoId + '?token=' + tok);
  assert.equal(alles.status, 200);
  assert.equal(Number(alles.headers.get('content-length')), WEBM.length, 'geen byte hercomprimeerd of verloren');
});

test('4. abonneren, reageren op codenaam en melden bij kantoor', async () => {
  const zaal = await api('/api/theater/zaal', {}, kijker);
  const kanaalId = zaal.body.nieuw.find(x => x.id === videoId).kanaalId;
  const abb = await api('/api/theater/abonneer', { kanaalId }, kijker);
  assert.equal(abb.status, 200);
  const zaal2 = await api('/api/theater/zaal', {}, kijker);
  assert.ok((zaal2.body.abonnementen || []).some(x => x.id === videoId), 'abonnementen staan bovenaan, dat is het hele algoritme');
  const re = await api('/api/theater/reactie', { id: videoId, tekst: 'Prachtig licht in dit atelier.' }, kijker);
  assert.equal(re.status, 200);
  assert.ok(!/Lid /.test(re.body.reactie.codenaam), 'de reactie draagt de codenaam, nooit de echte naam');
  const meld = await api('/api/theater/meld', { id: videoId, reden: 'Verkeerd label' }, kijker);
  assert.equal(meld.status, 200);
  const kantoor = await api('/api/office/theater', {}, office);
  assert.ok((kantoor.body.meldingen || []).some(m => /Verkeerd label/.test(m.reden)));
});

test('5. verwijderen haalt ook de bytes weg (maker zelf of kantoor)', async () => {
  const vreemd = await api('/api/theater/verwijder', { id: videoId }, kijker);
  assert.equal(vreemd.status, 403, 'een kijker verwijdert andermans werk niet');
  const weg = await api('/api/office/theater/verwijder', { id: videoId }, office);
  assert.equal(weg.status, 200);
  const kijk = await fetch(base + '/api/theater/kijk/' + videoId + '?token=' + encodeURIComponent(kijker));
  assert.equal(kijk.status, 404, 'de stream is weg');
  assert.ok(!fs.readdirSync(path.join(TMP, 'theater')).some(f => f.startsWith(videoId)), 'het bestand is echt van de schijf');
});
