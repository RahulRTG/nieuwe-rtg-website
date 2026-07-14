/* Integratietests: een echte server draaien in een geisoleerde datamap en de
   kernflows over HTTP uitoefenen. Dit bewaakt precies de plekken waar geld en
   wet aan hangen: de fiscale rekenmachine, de leeftijdslaag, De Salon-rechten,
   de bestel- en betaalflow en de AVG-rechten (inzage en vergetelheid).

   Geen externe libraries: Node's testrunner + global fetch. De server start als
   kindproces op een vrije poort met RTG_DATA_DIR naar een tijdelijke map.

   Draai los: node --test test/server.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer } = require('./helper');

let BASE;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-server-'));
let child;

function api(pad, body, token) {
  return fetch(BASE + '/api' + pad, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: JSON.stringify(body || {})
  });
}

test.before(async () => {
  ({ child, base: BASE } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' } }));
});

test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('gezondheid en demo-login', async () => {
  const h = await fetch(BASE + '/api/health');
  assert.equal(h.status, 200);
  const r = await api('/login', { tier: 'business' });
  assert.equal(r.status, 200);
  const j = await r.json();
  assert.ok(j.token, 'login geeft een token');
  assert.equal(j.state.user.tier, 'business');
});

test('ZZP-belastingtool: rekent, hoort bij de Business Pass en toont het peiljaar', async () => {
  const biz = await (await api('/login', { tier: 'business' })).json();
  const r = await api('/member/zzp', { land: 'NL', winst: 60000, urencriterium: true }, biz.token);
  assert.equal(r.status, 200);
  const z = await r.json();
  // Structurele invarianten van de berekening.
  assert.equal(z.peiljaar, 2025, 'het peiljaar gaat mee in de uitkomst');
  assert.equal(z.netto + z.belasting, 60000, 'netto + belasting = winst');
  assert.ok(z.belastbaar < 60000, 'aftrekposten verlagen de grondslag');
  assert.ok(z.belasting > 8000 && z.belasting < 16000, 'belasting in een realistische band, kreeg ' + z.belasting);
  assert.ok(z.reserveerPct >= 20 && z.reserveerPct <= 50);
  assert.equal(z.perMaand, Math.round(z.belasting / 12 * 100) / 100);

  // Monotoon: meer winst betekent meer belasting.
  const laag = await (await api('/member/zzp', { land: 'NL', winst: 30000, urencriterium: true }, biz.token)).json();
  assert.ok(laag.belasting < z.belasting, 'meer winst -> meer belasting');

  // Urencriterium niet gehaald: geen zelfstandigenaftrek, dus meer belasting.
  const zonderUren = await (await api('/member/zzp', { land: 'NL', winst: 60000, urencriterium: false }, biz.token)).json();
  assert.ok(zonderUren.belasting > z.belasting, 'zonder urencriterium vervalt de zelfstandigenaftrek');

  // Buitenland gebruikt het indicatieve regime en levert een ander getal.
  const es = await (await api('/member/zzp', { land: 'ES', winst: 60000 }, biz.token)).json();
  assert.equal(es.land, 'ES');
  assert.ok(es.belasting > 0);
});

test('ZZP-tool is afgeschermd voor niet-Business-leden', async () => {
  const rtg = await (await api('/login', { tier: 'rtg' })).json();
  const r = await api('/member/zzp', { land: 'NL', winst: 60000 }, rtg.token);
  assert.equal(r.status, 403, 'RTG-lid mag niet bij de zzp-tool');
});

test('leeftijdslaag: registratie leidt de leeftijdsgroep uit de geboortedatum af', async () => {
  const nu = new Date();
  const jong = new Date(nu.getFullYear() - 16, nu.getMonth(), nu.getDate()).toISOString().slice(0, 10);
  const email = 'jeugd' + Date.now() + '@voorbeeld.test';
  const r = await api('/auth/register', { name: 'Jeugd Lid', email, phone: '+31611223344', password: 'geheim12', tier: 'rtg', geboortedatum: jong });
  assert.equal(r.status, 200);
  const j = await r.json();
  // De leeftijdsgroep 15-17 zit in de state van het lid.
  const zichtbaar = JSON.stringify(j.state);
  assert.ok(zichtbaar.includes('15-17'), 'jeugdlid valt in groep 15-17');

  // Een geboortedatum onder de 15 wordt geweigerd.
  const teJong = new Date(nu.getFullYear() - 12, nu.getMonth(), nu.getDate()).toISOString().slice(0, 10);
  const r2 = await api('/auth/register', { name: 'Te Jong', email: 'tejong' + Date.now() + '@voorbeeld.test', phone: '+31611223344', password: 'geheim12', tier: 'rtg', geboortedatum: teJong });
  assert.equal(r2.status, 400);
});

test('De Salon: een gast (gratis) bekijkt wel, maar liket en reageert niet bij particulieren; een lid wel', async () => {
  const gast = await (await api('/login', { tier: 'guest' })).json();
  // Zonder pas geen like op een particulier-post (post 1 is een ledenpost).
  const like = await api('/like', { postId: 1, liked: true }, gast.token);
  assert.equal(like.status, 403, 'gast liket geen particulier');
  // Reageren zonder pas mag niet.
  const reactie = await api('/comment', { postId: 1, text: 'Hallo' }, gast.token);
  assert.equal(reactie.status, 403, 'gast kan niet reageren');
  // Een RTG-lid mag wel liken en reageren op een RTG-post.
  const rtg = await (await api('/login', { tier: 'rtg' })).json();
  assert.equal((await api('/like', { postId: 1, liked: true }, rtg.token)).status, 200);
  const biz = await (await api('/login', { tier: 'business' })).json();
  const ok = await api('/comment', { postId: 1, text: 'Mooi!' }, biz.token);
  assert.equal(ok.status, 200);
});

test('bestellen en betalen: een order loopt van open naar betaald', async () => {
  const biz = await (await api('/login', { tier: 'business' })).json();
  const r = await api('/order', { supplierCode: 'KIKUNOI', items: [{ id: 'm2', qty: 1 }], table: 'Table 1' }, biz.token);
  assert.equal(r.status, 200);
  const o = await r.json();
  assert.ok(o.order && o.order.ref, 'order krijgt een referentie');
  const betaald = await api('/order/pay', { ref: o.order.ref }, biz.token);
  assert.equal(betaald.status, 200);
  const b = await betaald.json();
  const status = (b.order && b.order.status) || '';
  assert.ok(status && status !== 'wacht-op-betaling', 'na betaling is de order niet meer open, status: ' + status);
});

test('robuustheid: async-endpoints beantwoorden netjes en laten de server draaien', async () => {
  // De vertaal-endpoint valt netjes terug (geen crash) zonder AI-sleutel.
  const tr = await api('/translate', { text: 'Goedemorgen', to: 'en' });
  assert.equal(tr.status, 200);

  // De server draait nog na al die async-verzoeken.
  assert.equal((await fetch(BASE + '/api/health')).status, 200);
});

test('XSS-preventie: HTML in de naam wordt bij registratie ontdaan van < en >', async () => {
  const email = 'xss' + Date.now() + '@voorbeeld.test';
  const boos = '<img src=x onerror="window.x=1">Bob';
  const reg = await (await api('/auth/register', { name: boos, email, phone: '+31699887766', password: 'geheim12', tier: 'rtg', geboortedatum: '1990-05-05' })).json();
  assert.ok(reg.token, 'registratie lukt');
  const dossier = await (await api('/privacy/export', {}, reg.token)).json();
  const naam = dossier.profile.full;
  assert.ok(!/[<>]/.test(naam), 'de opgeslagen naam bevat geen < of >, kreeg: ' + naam);
  assert.ok(naam.includes('Bob'), 'de gewone tekst blijft staan');
});

test('AVG: een lid kan zijn dossier inzien en definitief laten wissen', async () => {
  const email = 'avg' + Date.now() + '@voorbeeld.test';
  const reg = await (await api('/auth/register', { name: 'AVG Lid', email, phone: '+31655667788', password: 'geheim12', tier: 'rtg', geboortedatum: '1990-01-01' })).json();
  // Inzage (dataportabiliteit).
  const exp = await api('/privacy/export', {}, reg.token);
  assert.equal(exp.status, 200);
  const dossier = await exp.json();
  assert.ok(JSON.stringify(dossier).length > 20, 'het dossier bevat gegevens');
  // Vergetelheid.
  const del = await api('/privacy/delete', { bevestig: true, confirm: true }, reg.token);
  assert.equal(del.status, 200);
  // Na verwijderen werkt het token niet meer.
  const na = await api('/state', {}, reg.token);
  assert.equal(na.status, 401, 'na wissen is de sessie ongeldig');
});
