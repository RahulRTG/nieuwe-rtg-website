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
const { startServer, stop, stopNet, stroomAdres } = require('./helper');
const { registreerGratis } = require('../scripts/lib/gratisaccount');

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
const email = {};
async function lid() {
  const u = (Date.now() + (++seq)).toString().slice(-8);
  const r = await api('/api/auth/register', { name: 'Toegang ' + seq, email: 'mt' + u + '@x.nl', phone: '06' + u,
    password: 'geheim123', geboortedatum: '1989-06-06', geslacht: 'm', tier: 'rtg', pasApp: 'rtg' });
  assert.ok(r.body.token, 'registreren lukt');
  email[r.body.token] = 'mt' + u + '@x.nl';
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

// De route die deze toetsen bewijzen, letterlijk: de deltapoort zoekt hem op naam.
const LINKROUTE = 'GET /media/t/:token';
test(LINKROUTE + ': een vervalste of verlopen link opent niets', async () => {
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
      { id: 4, featured: true, promoMag: true, media: [{ src: '/media/' + n(4) }] },
      { id: 5, featured: true, promoMag: false, photo: '/media/' + n(5) },        // geen toestemming: privé
      { publiek: 'alleenik', photo: '/media/' + n(6) },
      { partner: true, publiek: 'volgers', photo: '/media/' + n(7) },     // zaak, maar alleen volgers
      { partner: true, verborgen: true, photo: '/media/' + n(8) },        // verborgen: weg
      { id: 12, featured: true, promoMag: true, photo: '/media/' + n('c') },   // looptijd verstreken
      { id: 13, featured: true, promoMag: true, publiek: 'vrienden', photo: '/media/' + n('d') }, // uitgelicht, maar voor vrienden
      { id: 14, featured: true, promoMag: true, photo: '/media/' + n('e') }    // featured, maar geen lopende uitlichting
    ],
    salonUitlicht: [
      { post: '4', tot: null, ingetrokken: null },
      { post: '5', tot: null, ingetrokken: null },
      { post: '12', tot: '2020-01-01T00:00:00.000Z', ingetrokken: null },
      { post: '13', tot: null, ingetrokken: null }
    ],
    ledenSites: { fotos: { 'user-1': ['/media/' + n(9)] }, lijst: [{ blokken: [{ src: '/media/' + n('a') }] }] },
    huurFotos: { R1: { voor: [{ foto: '/media/' + n('b') }], na: [] } }
  };
  t.zet({ data: () => data });
  const klasse = i => t.openbaarKlasse(n(i));
  assert.equal(klasse(1), 'zaak-etalage');
  assert.equal(klasse(2), 'zaak-etalage');
  assert.equal(klasse(3), 'salon-zaak');
  assert.equal(klasse(4), 'salon-uitgelicht');
  assert.equal(klasse(9), 'website');
  for (const i of [5, 6, 7, 8, 'a', 'b', 'c', 'd', 'e']) assert.equal(klasse(i), null, 'niet openbaar: ' + i);
  assert.ok(t.toon('/media/' + n(6)).startsWith('/media/t/'), 'privé wordt een link');
  assert.equal(t.toon('/media/' + n(1)), '/media/' + n(1), 'openbaar blijft de kale URL');
  assert.equal(t.toon('prive-' + n(1)), null, 'een prive-bestand krijgt via deze weg nooit een link');
  assert.equal(t.toon('/campagne/hero.jpg'), '/campagne/hero.jpg', 'geen mediabestand: ongewijzigd');
  const insp = t.inspectie(data.huurFotos.R1);
  assert.ok(insp.voor[0].foto.startsWith('/media/t/'), 'een inspectiefoto is nooit openbaar');
  assert.equal(data.huurFotos.R1.voor[0].foto, '/media/' + n('b'), 'de opslag zelf wordt niet aangeraakt');
  // intrekken: de uitlichting wordt ingetrokken, en na verversing is het beeld niet meer openbaar
  data.salonUitlicht[0].ingetrokken = { door: 'x', reden: 'y', at: '2026-10-11T00:00:00.000Z' };
  t.zet({ data: () => data });
  assert.equal(klasse(4), null, 'niet meer uitgelicht = niet meer openbaar');
  t.zet({});
  assert.equal(klasse(1), null, 'zonder bron is niets openbaar (fail-closed)');
});

test('een ondertekende link belandt nooit leesbaar in een verzoeklog', () => {
  const { padVorm } = require('../server/kern/journaalvorm');
  assert.equal(padVorm('/media/t/' + 'Ab_-'.repeat(20)), '/media/t/:ticket');
});

/* ---- de tweede ronde (tegenlezing op PR #587) ---- */

async function vrienden(A, B) {
  const mijA = (await api('/api/member/connections', {}, A)).body;
  const mijB = (await api('/api/member/connections', {}, B)).body;
  await api('/api/member/connect', { key: mijB.me }, A);
  await api('/api/member/connect/respond', { key: mijA.me, action: 'accept' }, B);
}

test('B1: een vriend ziet een post "alleen ik" niet in /api/state, en krijgt er geen link voor', async () => {
  const A = await lid(), B = await lid();
  await vrienden(A, B);
  const tekst = 'geheim moment ' + Date.now();
  const p = await api('/api/salon/plaats', { tekst, media: [{ beeld: PNG, alt: 'x' }], publiek: 'alleenik' }, A);
  assert.equal(p.status, 200, p.body.error);
  const naam = naamUitLink(p.body.post.media[0].src);
  const controle = await api('/api/salon/plaats', { tekst: 'voor vrienden ' + Date.now(), media: [{ beeld: PNG, alt: 'x' }], publiek: 'vrienden' }, A);
  assert.equal(controle.status, 200, controle.body.error);
  const st = await api('/api/state', {}, B);
  assert.equal(st.status, 200);
  const posts = (st.body.state && st.body.state.posts) || [];
  assert.ok(posts.some(x => x.id === controle.body.post.id), 'controle: de vriendenpost staat er wel (anders bewijst dit niets)');
  assert.ok(!posts.some(x => x.text === tekst), 'de post "alleen ik" staat niet in de staat van de vriend');
  for (const x of posts.filter(x => x.photo && x.photo.startsWith('/media/t/')))
    assert.notEqual(naamUitLink(x.photo), naam, 'en er is geen link naar zijn foto');
});

test('een DM: de ontvanger ziet een gedeelde post alleen als HIJ hem mag lezen', async () => {
  /* A post voor vrienden. B (vriend van A) deelt hem met C (geen vriend van A)
     en met D (wel vriend van A). Daarna verwijdert A de post. */
  const A = await lid(), B = await lid(), C = await lid(), D = await lid();
  await vrienden(A, B); await vrienden(B, C); await vrienden(B, D); await vrienden(A, D);
  const geheim = 'alleen voor vrienden ' + Date.now();
  const p = await api('/api/salon/plaats', { tekst: geheim, publiek: 'vrienden' }, A);
  assert.equal(p.status, 200, p.body.error);
  const sleutel = async t => (await api('/api/member/connections', {}, t)).body.me;
  const [kB, kC, kD] = [await sleutel(B), await sleutel(C), await sleutel(D)];
  assert.equal((await api('/api/member/dm/send', { toKey: kC, text: 'kijk', postId: p.body.post.id }, B)).status, 200);
  assert.equal((await api('/api/member/dm/send', { toKey: kD, text: 'kijk', postId: p.body.post.id }, B)).status, 200);
  const gedeeld = async (lezer, ander) => {
    const r = await api('/api/member/dm', { withKey: ander }, lezer);
    assert.equal(r.status, 200, r.body.error);
    return (r.body.messages || []).filter(m => m.post).map(m => m.post);
  };
  const bijC = await gedeeld(C, kB);
  assert.equal(bijC.length, 1, 'C ziet dat er iets gedeeld is');
  assert.equal(bijC[0].nietBeschikbaar, true, 'maar voor C is de post niet beschikbaar');
  const { NIET_BESCHIKBAAR } = require('../server/kern/sociaal/dmpost')({ posts: () => [] });
  assert.ok(!JSON.stringify(bijC).includes(geheim) && bijC[0].text === NIET_BESCHIKBAAR && !bijC[0].author && !bijC[0].photo,
    'zonder tekst van de post, auteur of foto -- alleen de vaste mededeling');
  const bijD = await gedeeld(D, kB);
  assert.equal(bijD[0].text, geheim, 'controle: D, vriend van A, ziet de post wel');
  // A verwijdert de post: niemand ziet nog tekst, ook B en D niet
  assert.equal((await api('/api/salon/weg', { id: p.body.post.id }, A)).status, 200);
  for (const [lezer, ander, wie] of [[D, kB, 'D'], [B, kC, 'B']]) {
    const na = await gedeeld(lezer, ander);
    assert.ok(na.length && na.every(x => x.nietBeschikbaar && !JSON.stringify(x).includes(geheim)), wie + ' ziet na verwijderen geen tekst meer');
  }
  assert.ok(!JSON.stringify(await gedeeld(B, kD)).includes(geheim), 'ook de afzender houdt geen kopie');
});

test('een DM kan geen post delen die de afzender niet mag lezen', async () => {
  const A = await lid(), B = await lid(), C = await lid();
  await vrienden(A, B);
  const prive = await api('/api/salon/plaats', { tekst: 'van C, alleen ik', media: [{ beeld: PNG, alt: 'x' }], publiek: 'alleenik' }, C);
  const eigen = await api('/api/salon/plaats', { tekst: 'van A voor iedereen' }, A);
  const mijB = (await api('/api/member/connections', {}, B)).body.me;
  const zonder = await api('/api/member/dm/send', { toKey: mijB, postId: prive.body.post.id }, A);
  assert.equal(zonder.status, 400, 'zonder tekst en zonder leesbare post is er niets te versturen');
  const met = await api('/api/member/dm/send', { toKey: mijB, postId: eigen.body.post.id }, A);
  assert.equal(met.status, 200, 'controle: een post die A mag lezen deelt hij wel');
});

test('M3: een zaak ziet van een gast alleen wat die aan heel De Salon liet zien', async () => {
  const zaak = (await api('/api/supplier/login', { username: 'rahul', password: 'Imran' })).body.token;
  const A = await lid();
  const geheim = 'gastgeheim ' + Date.now(), open = 'gastopen ' + Date.now();
  await api('/api/salon/plaats', { tekst: geheim, publiek: 'alleenik' }, A);
  await api('/api/salon/plaats', { tekst: open, publiek: 'salon' }, A);
  const chat = await api('/api/partner/chat/send', { supplierCode: 'KIKUNOI', text: 'Hallo' }, A);
  assert.equal(chat.status, 200, chat.body.error);
  const st = await api('/api/supplier/state', {}, zaak);
  const mij = (await api('/api/member/connections', {}, A)).body.me;
  const lijn = ((st.body.state && st.body.state.guestChats) || []).find(c => String(c.key).includes(mij));
  assert.ok(lijn, 'de zaak heeft een lijn met deze gast');
  const r = await api('/api/supplier/klant/salon', { key: lijn.key }, zaak);
  assert.equal(r.status, 200, r.body.error);
  const teksten = (r.body.posts || []).map(x => x.text);
  assert.ok(teksten.includes(open), 'controle: de post voor heel De Salon staat er');
  assert.ok(!teksten.includes(geheim), 'de post "alleen ik" niet');
});

test('M4: een menu neemt geen vreemde /media-naam over, wel de eigen foto', async () => {
  const zaak = (await api('/api/supplier/login', { username: 'rahul', password: 'Imran' })).body.token;
  const A = await lid();
  const p = await api('/api/salon/plaats', { tekst: 'x', media: [{ beeld: PNG, alt: 'x' }], publiek: 'alleenik' }, A);
  const vreemd = '/media/' + naamUitLink(p.body.post.media[0].src);
  const voor = ((await api('/api/supplier/state', {}, zaak)).body.state || {}).menu || [];
  assert.ok(voor.length, 'de zaak heeft een kaart');
  const met = await api('/api/supplier/menu/foto', { id: voor[0].id, foto: PNG }, zaak);
  assert.equal(met.status, 200, met.body.error);
  const menu = voor.map((m, i) => Object.assign({}, m, { foto: i === 0 ? met.body.foto : vreemd }));
  const r = await api('/api/supplier/menu', { menu }, zaak);
  assert.equal(r.status, 200, r.body.error);
  const na = ((await api('/api/supplier/state', {}, zaak)).body.state || {}).menu || [];
  assert.equal(na[0].foto, met.body.foto, 'de eigen foto blijft staan');
  assert.ok(!na.some(m => m.foto === vreemd), 'de vreemde naam is gevallen');
  await alsOnbestaand(vreemd, 'anoniem na de poging');
});

test('beide servicewerkers cachen /media niet en ruimen oud mediabeeld op', () => {
  for (const f of ['public/sw.js', 'public/apps/foundation/sw.js']) {
    const bron = fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
    assert.match(bron, /url\.pathname\.startsWith\('\/media\/'\)\) return;/, f + ': /media gaat langs de schil heen');
    assert.match(bron, /\.filter\(r => r\.url\.includes\('\/media\/'\)\)\.map\(r => c\.delete\(r\)\)/, f + ': oud mediabeeld gaat eruit bij activering');
  }
});

test('het banlog van het schild schrijft een medialink gemaskeerd', () => {
  const bron = fs.readFileSync(path.join(__dirname, '..', 'server/kern/schild.js'), 'latin1');
  assert.ok(!/doel\.slice\(/.test(bron), 'geen ruw doel meer in het banlog');
  assert.match(bron, /logDoel\(doel\)/);
  const { logDoel } = require('../server/kern/schild');
  assert.equal(logDoel('/media/t/' + 'Ab_-'.repeat(20) + '?x=1'), '/media/t/:ticket?x=1', 'de token is weg');
  assert.equal(logDoel('/api/x'), '/api/x');
});


/* ---- de vierde ronde (tegenlezing op 41fd8b7eb) ---- */

/* Een lezer van de live-stroom van een lid, zoals het scherm hem opent: eerst de
   sessie (in de kop) ruilen voor een stroomticket, dan de stroom op dat ticket
   (server/kern/sessiestroom.js; de sessie staat niet meer in het adres). */
async function stroom(token) {
  const ctl = new AbortController();
  const st = { tekst: '', ctl };
  const adres = await stroomAdres(base, '/api/stream', token);
  fetch(adres, { signal: ctl.signal }).then(async r => {
    const rd = r.body.getReader(); const dec = new TextDecoder();
    for (;;) { const { value, done } = await rd.read(); if (done) break; st.tekst += dec.decode(value); }
  }).catch(() => {});
  return st;
}
async function wachtOpTekst(st, stuk, ms) {
  const eind = Date.now() + (ms || 10000);
  while (!st.tekst.includes(stuk)) {
    if (Date.now() > eind) throw new Error('de stroom kreeg "' + stuk + '" niet binnen ' + (ms || 10000) + ' ms');
    await new Promise(r => setTimeout(r, 50));
  }
}

test('N1: het live-seintje van een DM draagt geen post, ook niet voor een gratis vriend van de auteur', async () => {
  /* A post voor vrienden. B deelt hem met C (vreemde) en met G (een GRATIS
     account dat wel vriend is van A). In het gesprek ziet G nietBeschikbaar:
     de leespoort telt een gratis account niet als vriend. Het live-seintje
     loste eerst op met een NAGEMAAKTE sessie zonder pas, en gaf G zo de hele
     post. Nu draagt het alleen het id. */
  const A = await lid(), B = await lid(), C = await lid();
  const g = await registreerGratis(base);
  assert.ok(g && g.token, 'een gratis account (pas guest) kan worden aangemaakt');
  const G = g.token;
  await vrienden(A, B); await vrienden(B, C); await vrienden(A, G); await vrienden(B, G);
  const sleutel = async t => (await api('/api/member/connections', {}, t)).body.me;
  const [kB, kC, kG] = [await sleutel(B), await sleutel(C), await sleutel(G)];
  const geheim = 'live geheim ' + Date.now();
  const p = await api('/api/salon/plaats', { tekst: geheim, media: [{ beeld: PNG, alt: 'x' }], publiek: 'vrienden', plaats: 'PlekLive' }, A);
  assert.equal(p.status, 200, p.body.error);
  const auteur = p.body.post.author;
  const sC = await stroom(C), sG = await stroom(G);
  // de stroom staat open zodra de server zijn begroeting stuurde; daarop wachten en niet op de klok
  await wachtOpTekst(sC, 'hello'); await wachtOpTekst(sG, 'hello');
  for (const [k, wie] of [[kC, 'C'], [kG, 'G']]) {
    const r = await api('/api/member/dm/send', { toKey: k, text: 'kijk ' + wie, postId: p.body.post.id }, B);
    assert.equal(r.status, 200, wie + ': ' + r.body.error);
  }
  await wachtOpTekst(sC, 'kijk C'); await wachtOpTekst(sG, 'kijk G');
  sC.ctl.abort(); sG.ctl.abort();
  for (const [st, wie] of [[sC, 'C'], [sG, 'G']]) {
    for (const naald of [geheim, 'PlekLive', auteur, '/media/t/'])
      assert.ok(!st.tekst.includes(naald), wie + ' kreeg via de live-stroom: ' + naald);
    assert.ok(st.tekst.includes('"postId":' + JSON.stringify(p.body.post.id)), wie + ': het seintje noemt wel welk bericht een post draagt');
  }
  // en in het gesprek zelf: G mag de post niet lezen, dus nietBeschikbaar
  const bijG = ((await api('/api/member/dm', { withKey: kB }, G)).body.messages || []).filter(m => m.post).map(m => m.post);
  assert.ok(bijG.length && bijG.every(x => x.nietBeschikbaar && !JSON.stringify(x).includes(geheim)), 'G ziet in het gesprek geen post');
});

test('de gezinskant (/api/rtf/social/dm) lost een gedeelde post op met de sessie van het gezinslid', async () => {
  /* A post voor vrienden en B deelt hem met twee gezinsleden: O1 is ook vriend
     van A en ziet de post, O2 alleen van B en krijgt nietBeschikbaar. Deze route
     gaf eerst de ruwe berichtvorm door, zonder oplossen. */
  const A = await lid(), B = await lid();
  await vrienden(A, B);
  const kB = (await api('/api/member/connections', {}, B)).body.me;
  const g = (await api('/api/foundation/gezin/maak', { gezinsnaam: 'Deel', naam: 'Ouder', pin: '2468', groep: 'volw' })).body;
  assert.ok(g && g.token, 'een gezin is gemaakt');
  const p2 = (await api('/api/foundation/gezin/profiel/maak', { code: g.code, token: g.token, naam: 'Tweede', rol: 'gezinslid', groep: 'volw' })).body;
  const t2 = (await api('/api/foundation/gezin/profiel/kies', { code: g.code, token: g.token, profielId: p2.profiel.id })).body.token;
  assert.ok(t2, 'een tweede gezinslid is gekozen');
  const O1 = { code: g.code, token: g.token }, O2 = { code: g.code, token: t2 };
  async function sleutelVan(O) {
    const mij = await (await fetch(base + '/api/foundation/gezin/' + O.code + '/mij', { headers: { Authorization: 'Bearer ' + O.token } })).json();
    const cn = mij.profiel.codenaam;
    const res = (await api('/api/member/find', { q: cn.split(' ')[0] }, B)).body.results || [];
    return (res.find(r => r.codename === cn) || {}).key;
  }
  async function koppel(lidT, O, okey) {
    await api('/api/member/connect', { key: okey }, lidT);
    const oc = (await api('/api/rtf/social/connections', O)).body;
    const lidKey = (await api('/api/member/connections', {}, lidT)).body.me;
    const r = await api('/api/rtf/social/respond', Object.assign({ key: lidKey, action: 'accept' }, O));
    assert.equal(r.status, 200, 'het gezinslid aanvaardt: ' + JSON.stringify(r.body) + ' ' + JSON.stringify(oc.requests));
  }
  const k1 = await sleutelVan(O1), k2 = await sleutelVan(O2);
  assert.ok(k1 && k2 && k1 !== k2, 'beide gezinsleden zijn als codenaam te vinden');
  await koppel(B, O1, k1); await koppel(B, O2, k2); await koppel(A, O1, k1);
  const geheim = 'gezinsgeheim ' + Date.now();
  const p = await api('/api/salon/plaats', { tekst: geheim, publiek: 'vrienden', plaats: 'GezinPlek' }, A);
  assert.equal(p.status, 200, p.body.error);
  for (const k of [k1, k2]) assert.equal((await api('/api/member/dm/send', { toKey: k, text: 'kijk', postId: p.body.post.id }, B)).status, 200);
  const posts = async O => {
    const r = await api('/api/rtf/social/dm', Object.assign({ withKey: kB }, O));
    assert.equal(r.status, 200, JSON.stringify(r.body));
    return (r.body.messages || []).filter(m => m.post).map(m => m.post);
  };
  const bij1 = await posts(O1), bij2 = await posts(O2);
  assert.equal(bij1.length && bij1[0].text, geheim, 'O1, vriend van A, ziet de post echt (niet alleen een id)');
  assert.ok(bij2.length && bij2.every(x => x.nietBeschikbaar && !JSON.stringify(x).includes(geheim) && !x.author),
    'O2, geen vriend van A, krijgt nietBeschikbaar');
  assert.ok(!JSON.stringify(bij2).includes('GezinPlek'), 'ook de plek blijft weg');
});

/* LAATSTE TOETS IN DIT BESTAND: hij stopt de server en start hem opnieuw. */
test('N2: een oude bevroren kopie in commBerichten komt via /api/comm/gesprek niet meer naar buiten', async () => {
  const B = await lid(), C = await lid();
  await vrienden(B, C);
  const [kB, kC] = [(await api('/api/member/connections', {}, B)).body.me, (await api('/api/member/connections', {}, C)).body.me];
  assert.equal((await api('/api/member/dm/send', { toKey: kC, text: 'hallo' }, B)).status, 200);
  const A = await lid();
  const p = await api('/api/salon/plaats', { tekst: 'echte post ' + Date.now(), publiek: 'alleenik' }, A);
  await stopNet(srv.child);
  /* Wat er in productie van voor deze wijziging staat: een bericht met een
     bijlage die de hele post bevriest. Rechtstreeks in de opslag gezet. */
  process.env.RTG_ENC_KEY = ENC;
  const kluis = require('../server/kluis');
  const { DatabaseSync } = require('node:sqlite');
  let kv = null;
  for (const f of ['store.db', 'rtg.db']) {
    if (!fs.existsSync(path.join(TMP, f))) continue;
    const d = new DatabaseSync(path.join(TMP, f));
    try { if (d.prepare("SELECT key FROM kv WHERE key = 'commBerichten'").get()) { kv = d; break; } } catch (e) { /* geen kv-tabel hier */ }
    d.close();
  }
  assert.ok(kv, 'de opslag van de communicatiekern is gevonden');
  const lees = k => JSON.parse(kluis.ontsleutel(kv.prepare('SELECT val FROM kv WHERE key = ?').get(k).val));
  const gesprek = lees('commGesprekken').find(g => (g.deelnemers || []).includes(kB) && (g.deelnemers || []).includes(kC));
  assert.ok(gesprek, 'het gesprek tussen B en C staat in de opslag');
  const berichten = lees('commBerichten');
  (berichten[gesprek.id] = berichten[gesprek.id] || []).push({ id: 'brc_bevroren', van: kB, at: new Date().toISOString(),
    tekst: 'oud', soort: 'post', antwoordOp: null, lang: null, reacties: {},
    bijlage: { soort: 'post', id: p.body.post.id, author: 'AuteurBevroren', place: 'PlekBevroren', text: 'TEKST BEVROREN', photo: '/media/bevroren.png' } });
  kv.prepare('UPDATE kv SET val = ?, ver = ver + 1 WHERE key = ?').run(kluis.versleutel(JSON.stringify(berichten)), 'commBerichten');
  kv.close();
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, RTG_ENC_KEY: ENC, DEMO_SUPPLIER: 'KIKUNOI' } });
  base = srv.base;
  const C2 = (await api('/api/auth/login', { email: email[C], password: 'geheim123' })).body.token;
  assert.ok(C2, 'C logt opnieuw in');
  const r = await api('/api/comm/gesprek', { id: gesprek.id }, C2);
  assert.equal(r.status, 200, r.body.error);
  const bericht = (r.body.berichten || r.body.gesprek && r.body.gesprek.berichten || []).find(m => m.id === 'brc_bevroren');
  assert.ok(bericht, 'controle: het bevroren bericht komt mee (anders bewijst dit niets)');
  assert.deepEqual(bericht.bijlage, { soort: 'post', id: p.body.post.id }, 'alleen het id van de post gaat naar buiten');
  for (const naald of ['BEVROREN', 'PlekBevroren', 'AuteurBevroren', 'bevroren.png'])
    assert.ok(!JSON.stringify(r.body).includes(naald), 'het gesprek geeft ' + naald);
  // en de ledenroute lost hem op met de sessie van C: niet beschikbaar
  const dm = ((await api('/api/member/dm', { withKey: kB }, C2)).body.messages || []).filter(m => m.post);
  assert.ok(dm.length && dm.every(x => x.post.nietBeschikbaar && !JSON.stringify(x).includes('BEVROREN')), 'ook de ledenroute geeft geen kopie');
});
