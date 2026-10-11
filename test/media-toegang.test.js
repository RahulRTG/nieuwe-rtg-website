/* /media is fail-closed (AUTHORITY.md B4, eigenaarsbesluit 2 van 11 oktober 2026).

   Tot die dag serveerde /media/:naam elk bestand aan iedereen die de naam kende,
   zonder sessie en met `public, max-age=31536000, immutable` -- ook een
   Salon-foto "alleen ik", een verhaal voor vrienden en een foto in het
   babyboekje. Gemeten op een echte server met de seed: anoniem 200.

   Deze toets houdt op een ECHTE server vast:
   1. privébeeld komt niet via /media/:naam, niet anoniem en niet voor een ander
      lid -- met precies hetzelfde antwoord als een naam die niet bestaat;
   2. de kijker die het WEL mag zien krijgt een kort geldige ondertekende link,
      en die link geeft `private, no-store`;
   3. een vervalste of verlopen link opent niets;
   4. bewust openbaar beeld (de etalage van een zaak) blijft openbaar, maar met
      een korte publieke cache en niet een jaar immutable;
   5. een nieuwe upload is standaard privé.

   De bestandsnaam achter een link is versleuteld; de toets kent de sleutel
   (RTG_ENC_KEY) en haalt hem eruit, zodat hij kan bewijzen dat de kale route
   precies DAT bestand weigert. Draai: node --test test/media-toegang.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGBgAAAABQABh6FO1AAAAABJRU5ErkJggg==';
const ENC = 'b'.repeat(64);
const SLEUTEL = crypto.createHash('sha256').update('rtg-media-link-v1\0').update(ENC).digest();
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-media-toegang-'));
let srv, base;

function ontsleutel(token) {
  const raw = Buffer.from(token, 'base64url');
  const d = crypto.createDecipheriv('aes-256-gcm', SLEUTEL, raw.subarray(0, 12));
  d.setAAD(Buffer.from('rtg-media-link-v1'));
  d.setAuthTag(raw.subarray(12, 28));
  return JSON.parse(Buffer.concat([d.update(raw.subarray(28)), d.final()]).toString('utf8'));
}
function maakToken(payload) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', SLEUTEL, iv);
  c.setAAD(Buffer.from('rtg-media-link-v1'));
  const enc = Buffer.concat([c.update(Buffer.from(JSON.stringify(payload))), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), enc]).toString('base64url');
}
const naamUitLink = src => ontsleutel(src.slice('/media/t/'.length)).n;

const api = (pad, body, token) => fetch(base + pad, { method: 'POST',
  headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { Authorization: 'Bearer ' + token } : {}),
  body: JSON.stringify(body || {}) }).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
async function haal(url, token) {
  const r = await fetch(base + url, token ? { headers: { Authorization: 'Bearer ' + token } } : {});
  const bytes = Buffer.from(await r.arrayBuffer());
  return { status: r.status, cc: r.headers.get('cache-control'), bytes };
}
let seq = 0;
async function lid() {
  const u = (Date.now() + (++seq)).toString().slice(-8);
  const r = await api('/api/auth/register', { name: 'Toegang ' + seq, email: 'mt' + u + '@x.nl', phone: '06' + u,
    password: 'geheim123', geboortedatum: '1989-06-06', geslacht: 'm', tier: 'rtg', pasApp: 'rtg' });
  assert.ok(r.body.token, 'registreren lukt');
  return r.body.token;
}

/* Een privébestand hoort er voor een buitenstaander exact uit te zien als een
   bestand dat niet bestaat: zelfde status, geen bytes, geen cachekop. */
async function alsOnbestaand(url, wie, token) {
  const r = await haal(url, token);
  const nep = await haal('/media/' + crypto.randomBytes(16).toString('hex') + '.png', token);
  assert.equal(r.status, 404, wie + ' krijgt het privébestand niet');
  assert.equal(r.bytes.length, 0, wie + ' krijgt geen enkele byte');
  assert.deepEqual([r.status, r.cc, r.bytes.length], [nep.status, nep.cc, nep.bytes.length],
    wie + ': het antwoord verraadt niet dat het bestand bestaat');
}

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, RTG_ENC_KEY: ENC, DEMO_SUPPLIER: 'KIKUNOI' } });
  base = srv.base;
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('Salon "alleen ik": geen kale /media voor anoniem of een ander lid, wel een privélink voor de maker', async () => {
  const A = await lid(), B = await lid();
  const p = await api('/api/salon/plaats', { tekst: 'alleen voor mij', media: [{ beeld: PNG, alt: 'x' }], publiek: 'alleenik' }, A);
  assert.equal(p.status, 200, p.body.error);
  const src = p.body.post.media[0].src;
  assert.match(src, /^\/media\/t\/[A-Za-z0-9_-]+$/, 'de maker krijgt een ondertekende link, geen kale naam');
  const naam = naamUitLink(src);
  assert.match(naam, /^[0-9a-f]{32}\.png$/);
  await alsOnbestaand('/media/' + naam, 'anoniem');
  await alsOnbestaand('/media/' + naam, 'een ander lid', B);
  const eigen = await haal(src, A);
  assert.equal(eigen.status, 200, 'de link levert het beeld');
  assert.ok(eigen.bytes.length > 0);
  assert.equal(eigen.cc, 'private, no-store', 'een privéantwoord wordt nergens gecachet');
  assert.ok(!/public/.test(eigen.cc || ''));
  // het andere lid ziet de post niet in zijn feed, dus krijgt ook geen link
  const feedB = await api('/api/salon/feed', {}, B);
  assert.ok(!JSON.stringify(feedB.body).includes(naam), 'de naam komt nergens in de feed van een ander');
});

test('een nieuwe Salon-post zonder keuze (publiek "salon") is standaard privé', async () => {
  const A = await lid();
  const p = await api('/api/salon/plaats', { tekst: 'gewoon een moment', media: [{ beeld: PNG, alt: 'x' }] }, A);
  assert.equal(p.status, 200, p.body.error);
  const src = p.body.post.media[0].src;
  assert.ok(src.startsWith('/media/t/'), 'ook de standaard Salon-post is geen openbaar bestand');
  await alsOnbestaand('/media/' + naamUitLink(src), 'anoniem');
});

test('een verhaal voor vrienden: de wereldfeed geeft een link, de kale naam is dicht', async () => {
  const A = await lid();
  const s = await api('/api/member/story/post', { foto: PNG, tekst: 'verhaal' }, A);
  assert.equal(s.status, 200, s.body.error);
  const f = await api('/api/wereld/feed', { modus: 'prive' }, A);
  const tekst = JSON.stringify(f.body);
  assert.ok(!/"\/media\/[0-9a-f]{32}\./.test(tekst), 'geen enkele kale /media-naam in de feed');
  const link = (tekst.match(/\/media\/t\/[A-Za-z0-9_-]+/) || [])[0];
  assert.ok(link, 'het verhaal staat als ondertekende link in de feed');
  await alsOnbestaand('/media/' + naamUitLink(link), 'anoniem');
  assert.equal((await haal(link)).status, 200);
});

test('babyboekje: de gezinsfoto is een privélink, de kale naam is dicht', async () => {
  const g = (await api('/api/foundation/gezin/maak', { gezinsnaam: 'Toegang', naam: 'Mama', pin: '1234' })).body;
  await api('/api/rtf/baby/instellen', { code: g.code, token: g.token, kindNaam: 'Noor', geboren: '2025-11-01' });
  const e = await api('/api/rtf/baby/entry-maak', { code: g.code, token: g.token, tekst: 'x', foto: PNG });
  assert.equal(e.status, 200, e.body.error);
  const src = e.body.entry.foto;
  assert.ok(src.startsWith('/media/t/'), 'het gezin krijgt een link');
  await alsOnbestaand('/media/' + naamUitLink(src), 'anoniem');
  const r = await haal(src);
  assert.equal(r.status, 200);
  assert.equal(r.cc, 'private, no-store');
});

test('een vervalste of verlopen link opent niets', async () => {
  const A = await lid();
  const p = await api('/api/salon/plaats', { tekst: 'test', media: [{ beeld: PNG, alt: 'x' }], publiek: 'alleenik' }, A);
  const src = p.body.post.media[0].src;
  const naam = naamUitLink(src);
  assert.equal((await haal(src)).status, 200, 'de echte link werkt (controle: anders bewijst de rest niets)');
  const verlopen = maakToken({ n: naam, e: Date.now() - 1000 });
  assert.equal((await haal('/media/t/' + verlopen)).status, 404, 'een verlopen link opent niets');
  const nogGeldig = maakToken({ n: naam, e: Date.now() + 60000 });
  assert.equal((await haal('/media/t/' + nogGeldig)).status, 200, 'controle: dezelfde vorm met een geldige tijd werkt wel');
  const t = src.slice('/media/t/'.length);
  const kapot = t.slice(0, 20) + (t[20] === 'A' ? 'B' : 'A') + t.slice(21);
  assert.equal((await haal('/media/t/' + kapot)).status, 404, 'een gewijzigde link opent niets');
  const vreemd = crypto.createHash('sha256').update('een andere sleutel').digest();
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', vreemd, iv);
  c.setAAD(Buffer.from('rtg-media-link-v1'));
  const enc = Buffer.concat([c.update(Buffer.from(JSON.stringify({ n: naam, e: Date.now() + 60000 }))), c.final()]);
  const nep = Buffer.concat([iv, c.getAuthTag(), enc]).toString('base64url');
  assert.equal((await haal('/media/t/' + nep)).status, 404, 'een link met een andere sleutel opent niets');
  assert.equal((await haal('/media/')).status, 404, 'er is geen lijst van de map');
});

test('bewust openbaar: de etalagefoto van een zaak blijft openbaar, met een korte publieke cache', async () => {
  const zaak = (await api('/api/supplier/login', { username: 'rahul', password: 'Imran' })).body.token;
  assert.ok(zaak, 'de zaak logt in');
  const add = await api('/api/supplier/photo/add', { image: PNG }, zaak);
  assert.equal(add.status, 200, add.body.error);
  const A = await lid();
  const prof = await api('/api/salon/profiel', { code: 'KIKUNOI' }, A);
  const fotos = (prof.body.partner && prof.body.partner.photos) || [];
  const foto = fotos[fotos.length - 1];
  assert.match(String(foto), /^\/media\/[0-9a-f]{32}\.png$/, 'een etalagefoto is een gewone /media-URL');
  const r = await haal(foto);
  assert.equal(r.status, 200, 'anoniem zichtbaar: de zaak zette hem op haar openbare pagina');
  assert.equal(r.cc, 'public, max-age=3600', 'openbaar, maar geen jaar immutable');
});

/* De gesloten lijst zelf, zonder server: welke plek is openbaar, en wat valt
   eruit zodra hij er niet meer staat. */
test('de klassen: alleen verklaarde plekken, en intrekken werkt', () => {
  const t = require('../server/media/toegang');
  const n = i => String(i).repeat(32).slice(0, 32) + '.png';
  const data = {
    suppliers: [{ photos: ['/media/' + n(1)], menu: [{ foto: '/media/' + n(2) }] }],
    posts: [
      { partner: true, publiek: 'iedereen', photo: '/media/' + n(3) },
      { featured: true, promoMag: true, media: [{ src: '/media/' + n(4) }] },
      { featured: true, promoMag: false, photo: '/media/' + n(5) },        // geen toestemming: privé
      { publiek: 'alleenik', photo: '/media/' + n(6) },
      { partner: true, publiek: 'volgers', photo: '/media/' + n(7) },     // zaak, maar alleen volgers
      { partner: true, verborgen: true, photo: '/media/' + n(8) }         // verborgen: weg
    ],
    ledenSites: { fotos: { 'user-1': ['/media/' + n(9)] }, lijst: [{ blokken: [{ src: '/media/' + n('a') }] }] },
    huurFotos: { R1: { voor: [{ foto: '/media/' + n('b') }], na: [] } }
  };
  t.zet({ db: { data } });
  const klasse = i => t.openbaarKlasse(n(i));
  assert.equal(klasse(1), 'zaak-etalage');
  assert.equal(klasse(2), 'zaak-etalage');
  assert.equal(klasse(3), 'salon-zaak');
  assert.equal(klasse(4), 'salon-uitgelicht');
  assert.equal(klasse(9), 'website');
  for (const i of [5, 6, 7, 8, 'a', 'b']) assert.equal(klasse(i), null, 'niet openbaar: ' + i);
  assert.ok(t.toon('/media/' + n(6)).startsWith('/media/t/'), 'privé wordt een link');
  assert.equal(t.toon('/media/' + n(1)), '/media/' + n(1), 'openbaar blijft de kale URL');
  assert.equal(t.toon('prive-' + n(1)), null, 'een prive-bestand krijgt via deze weg nooit een link');
  assert.equal(t.toon('/campagne/hero.jpg'), '/campagne/hero.jpg', 'geen mediabestand: ongewijzigd');
  const insp = t.inspectie(data.huurFotos.R1);
  assert.ok(insp.voor[0].foto.startsWith('/media/t/'), 'een inspectiefoto is nooit openbaar');
  assert.equal(data.huurFotos.R1.voor[0].foto, '/media/' + n('b'), 'de opslag zelf wordt niet aangeraakt');
  // intrekken: de uitlichting gaat eraf, en na verversing is het beeld niet meer openbaar
  data.posts[1].featured = false;
  t.zet({ db: { data } });
  assert.equal(klasse(4), null, 'niet meer uitgelicht = niet meer openbaar');
  t.zet({ db: null });
  assert.equal(klasse(1), null, 'zonder bron is niets openbaar (fail-closed)');
});

test('een ondertekende link belandt nooit leesbaar in een verzoeklog', () => {
  const { padVorm } = require('../server/kern/journaalvorm');
  assert.equal(padVorm('/media/t/' + 'Ab_-'.repeat(20)), '/media/t/:ticket');
});
