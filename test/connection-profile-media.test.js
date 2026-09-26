/* RONDE 6 -- veilige Profile Media. De toets loopt via de echte Vonk-routes:
   concept -> publicatie -> projection -> tijdelijke levering -> intrekken en
   blokkeren. Geen opslagref mag ooit in een antwoord terechtkomen. */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Beeld = require('../server/kern/connection-image');
const { padVorm } = require('../server/kern/journaalvorm');
const { startServer, stop, kantoorAlsPersoon } = require('./helper');

const ID_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const FOTO = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAADHRFWHRHUFMANTIuMSw0LjMwjiV2AAAAFUlEQVR4nGOokNP4D8IMJxZE/QdhAEXMCP2u5XZBAAAAAElFTkSuQmCC', 'base64');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-connection-media-'));
let srv, base, office, A, B;

async function json(pad, body, token) {
  const r = await fetch(base + pad, { method:'POST', headers:{ 'Content-Type':'application/json', ...(token ? { Authorization:'Bearer ' + token } : {}) }, body:JSON.stringify(body || {}) });
  return { status:r.status, body:await r.json().catch(() => ({})) };
}
async function upload(bytes, mime, token, visibility, idem) {
  const r = await fetch(base + '/api/vonk/profile-photo', { method:'POST', headers:{
    'Content-Type':mime, Authorization:'Bearer ' + token, 'X-RTG-Visibility':visibility,
    'X-RTG-Alt':'Portret bij avondlicht', 'Idempotency-Key':idem
  }, body:bytes });
  return { status:r.status, body:await r.json().catch(() => ({})) };
}

let volg = 0;
async function lid() {
  const n = Date.now() + (++volg);
  const reg = await json('/api/auth/register', { name:'Fotolid ' + volg, email:'foto' + n + '@x.nl', phone:'06' + String(n).slice(-8),
    password:'geheim123', geboortedatum:'1990-05-05', geslacht:'v', tier:'rtg', pasApp:'rtg' });
  let token = reg.body.token;
  let staat = await json('/api/state', {}, token); let codenaam = staat.body.state.user.codename;
  await json('/api/verify/upload', { image:ID_PNG }, token);
  await json('/api/verify/selfie', { image:ID_PNG }, token);
  const pending = await json('/api/office/verifications', {}, office);
  const rij = pending.body.pending.find(x => x.codename === codenaam);
  await json('/api/office/verify', { userId:rij.id, decision:'approve', faceMatch:true, geslacht:'v' }, office);
  staat = await json('/api/state', {}, token); codenaam = staat.body.state.user.codename;
  await json('/api/vonk/profiel', { over:'Mens met een echt profiel.', stad:'Utrecht', lat:52.09, lng:5.12,
    leeftijdMin:18, leeftijdMax:99, maxKm:100, interesses:['kunst'] }, token);
  return { token, codenaam };
}

test.before(async () => {
  srv = await startServer({ env:{ SMTP_URL:'', RTG_DATA_DIR:TMP, RTG_ENC_KEY:'connection-media-test-key-123456789' } });
  base = srv.base; office = await kantoorAlsPersoon(base, 'RTG-OFFICE');
  A = await lid(); B = await lid();
});
test.after(() => { stop(srv && srv.child); try { fs.rmSync(TMP, { recursive:true, force:true }); } catch (e) {} });

test('beeldgrens verifieert bytes en verwijdert tekstuele GPS-metadata', () => {
  const uit = Beeld.normaliseer(FOTO, 'image/png');
  assert.equal(uit.width, 2); assert.equal(uit.height, 2);
  assert.equal(uit.bytes.includes(Buffer.from('GPS')), false);
  assert.throws(() => Beeld.normaliseer(FOTO, 'image/jpeg'), /komt niet overeen/);
  assert.throws(() => Beeld.normaliseer(Buffer.from('geen foto'), 'image/png'), /echte JPEG- of PNG/);
});

test('delivery-bearers verdwijnen uit verzoek- en foutlogs', () => {
  const token = 'geheimTicket_met-base64urlTekens.voorbeeld';
  assert.equal(padVorm('/api/vonk/profile-photo/delivery/' + token),
    '/api/vonk/profile-photo/delivery/:ticket');
  assert.equal(padVorm('/api/vonk/profile-photo/delivery/' + token).includes(token), false);
});

test('upload accepted is een concept en lekt nooit een opslagreferentie', async () => {
  const r = await upload(FOTO, 'image/png', B.token, 'DISCOVERY', 'profile-photo-upload-0001');
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.media.processingState, 'READY');
  assert.equal(r.body.media.publicationState, 'DRAFT');
  assert.equal(r.body.media.verificationState, 'UNVERIFIED');
  assert.match(r.body.media.src, /^\/api\/vonk\/profile-photo\/delivery\//);
  assert.equal(JSON.stringify(r.body).includes('prive-'), false);
  const opnieuw = await upload(FOTO, 'image/png', B.token, 'DISCOVERY', 'profile-photo-upload-0001');
  assert.equal(opnieuw.body.herhaald, true);
  assert.equal(opnieuw.body.media.id, r.body.media.id);
  B.fotoId = r.body.media.id;
  const volgorde = await json('/api/vonk/profile-photo/order', { ids:[B.fotoId] }, B.token);
  assert.equal(volgorde.status, 200);
  assert.equal(volgorde.body.media[0].id, B.fotoId);
  const s = await json('/api/vonk/selectie', {}, A.token);
  const kaart = s.body.mensen.find(x => x.codenaam === B.codenaam);
  assert.ok(kaart); assert.deepEqual(kaart.media, []);
});

test('DISCOVERY-publicatie verschijnt als kort ticket en levert genormaliseerde bytes', async () => {
  const pub = await json('/api/vonk/profile-photo/publish', { id:B.fotoId, visibility:'DISCOVERY' }, B.token);
  assert.equal(pub.status, 200); assert.equal(pub.body.media.publicationState, 'PUBLISHED');
  const herhaald = await json('/api/vonk/profile-photo/publish', { id:B.fotoId, visibility:'DISCOVERY' }, B.token);
  assert.equal(herhaald.body.herhaald, true);
  assert.equal(herhaald.body.media.version, pub.body.media.version);
  const s = await json('/api/vonk/selectie', {}, A.token);
  const foto = s.body.mensen.find(x => x.codenaam === B.codenaam).media[0];
  assert.ok(foto.src); assert.equal(Object.hasOwn(foto, 'ref'), false);
  assert.ok(Date.parse(foto.expiresAt) > Date.now());
  assert.ok(Date.parse(foto.expiresAt) <= Date.now() + 121000);
  const r = await fetch(base + foto.src);
  const bytes = Buffer.from(await r.arrayBuffer());
  assert.equal(r.status, 200); assert.equal(r.headers.get('cache-control'), 'private, no-store');
  assert.equal(bytes.includes(Buffer.from('GPS')), false);
  A.discoveryTicket = foto.src;
});

test('intrekken maakt een al uitgegeven ticket direct waardeloos', async () => {
  await json('/api/vonk/profile-photo/publish', { id:B.fotoId, publish:false }, B.token);
  assert.equal((await fetch(base + A.discoveryTicket)).status, 404);
  const s = await json('/api/vonk/selectie', {}, A.token);
  assert.deepEqual(s.body.mensen.find(x => x.codenaam === B.codenaam).media, []);
});

test('AFTER_MATCH bestaat niet in discovery en verschijnt pas na twee interesses', async () => {
  await json('/api/vonk/profile-photo/publish', { id:B.fotoId, visibility:'AFTER_MATCH' }, B.token);
  let s = await json('/api/vonk/selectie', {}, A.token);
  assert.deepEqual(s.body.mensen.find(x => x.codenaam === B.codenaam).media, []);
  await json('/api/vonk/like', { codenaam:B.codenaam }, A.token);
  s = await json('/api/vonk/selectie', {}, B.token);
  const a = s.body.mensen.find(x => x.codenaam === A.codenaam);
  const match = await json('/api/vonk/like', { codenaam:a.codenaam }, B.token);
  assert.equal(match.body.match, true);
  const mijn = await json('/api/vonk/mijn', {}, A.token);
  const rij = mijn.body.matches.find(x => x.met === B.codenaam);
  assert.equal(rij.media.length, 1); assert.match(rij.media[0].src, /\/delivery\//);
  A.matchTicket = rij.media[0].src;
});

test('cross-product block sluit ook een reeds uitgegeven matchfoto onmiddellijk', async () => {
  assert.equal((await fetch(base + A.matchTicket)).status, 200);
  const blok = await json('/api/vonk/blokkeer', { codenaam:B.codenaam }, A.token);
  assert.equal(blok.status, 200);
  assert.equal((await fetch(base + A.matchTicket)).status, 404);
  const mijn = await json('/api/vonk/mijn', {}, A.token);
  assert.equal(mijn.body.matches.some(x => x.met === B.codenaam), false);
});

test('verwijderen wist de eigenaarprojectie en maakt het ticket direct waardeloos', async () => {
  const up = await upload(FOTO, 'image/png', A.token, 'PRIVATE', 'profile-photo-upload-remove-0001');
  const ticket = up.body.media.src;
  assert.equal((await fetch(base + ticket)).status, 200);
  const voor = await json('/api/vonk/selectie', {}, A.token);
  assert.ok(voor.body.profiel.media.length >= 1, 'de eigenaarprojectie bevat de foto voor het verwijderen');
  const weg = await json('/api/vonk/profile-photo/remove', { id:up.body.media.id }, A.token);
  assert.equal(weg.status, 200);
  assert.equal((await fetch(base + ticket)).status, 404);
  const weer = await json('/api/vonk/profile-photo/remove', { id:up.body.media.id }, A.token);
  assert.equal(weer.status, 404);
  const selectie = await json('/api/vonk/selectie', {}, A.token);
  assert.deepEqual(selectie.body.profiel.media, []);
});
