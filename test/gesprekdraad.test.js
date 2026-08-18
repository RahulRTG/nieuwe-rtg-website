/* Het gesprek met Rahul als EEN draadje, met een grens erin.

   De balk in het OS praat met de assistent (/api/fluister); de chat in de app
   leest het doorlopende gesprek (/api/chat/history). Dat waren twee losse dingen,
   dus stond er in de balk een gesprek dat in de app niet bestond. De server legt
   de uitwisseling nu vast (kern/ai.js: noteerBeurt).

   Maar niet overal, en dat is de kern van deze test. Bij Lifestyle en Business is
   de chat de lijn naar een MENS: het lid stelt een vraag, needsConcierge gaat aan
   en iemand van RTG antwoordt via de backoffice. Zou de AI daar beurten in het
   draadje zetten, dan leest die concierge straks antwoorden die zij niet gaf, en
   lijkt het alsof de AI in haar naam sprak. Dat is precies de grens die het
   merk stelt, en toets 2 en 3 houden hem vast.

   Draai los: node --test test/gesprekdraad.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop, elevateTier } = require('./helper');
const fs = require('fs');
const os = require('os');
const path = require('path');

function verseDataDir() { return fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-draad-')); }
async function api(base, pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  const r = await fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) });
  return { status: r.status, body: await r.json().catch(() => ({})) };
}
async function registreer(base, tier) {
  const u = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  // zelf-registreren geeft altijd RTG; Lifestyle/Business komt na een menselijk
  // akkoord, dus registreren als RTG en optillen langs de office-flow.
  const regTier = (tier === 'lifestyle' || tier === 'business') ? 'rtg' : tier;
  const r = await api(base, '/api/auth/register', {
    name: 'Draad Lid', email: u + '@x.nl',
    phone: '06' + u.replace(/\D/g, '').padEnd(8, '1').slice(0, 8),
    password: 'geheim123', geboortedatum: '1990-01-01', tier: regTier, pasApp: regTier
  });
  assert.equal(r.status, 200, 'registreren met pas ' + tier);
  if (tier === 'lifestyle' || tier === 'business') {
    const office = (await api(base, '/api/office/login', { code: 'RTG-OFFICE' })).body.token;
    await elevateTier(base, r.body.token, tier, office);
  }
  return r.body.token;
}

let srv, base, TMP;
test.before(async () => {
  TMP = verseDataDir();
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('1. RTG Pass: wat je de assistent vraagt komt in het gesprek te staan', async () => {
  const lid = await registreer(base, 'rtg');
  const leeg = await api(base, '/api/chat/history', {}, lid);
  const voor = (leeg.body.messages || []).length;

  const vraag = 'waar staat mijn volgende reis op de planning';
  const r = await api(base, '/api/fluister', { q: vraag }, lid);
  assert.equal(r.status, 200);
  assert.ok(r.body.antwoord, 'de assistent hoort iets terug te geven');

  const na = await api(base, '/api/chat/history', {}, lid);
  const m = na.body.messages || [];
  assert.equal(m.length, voor + 2, 'twee beurten erbij: de vraag en het antwoord');
  const mijn = m[m.length - 2], zijn = m[m.length - 1];
  assert.equal(mijn.from, 'member');
  assert.equal(mijn.text, vraag, 'jouw vraag staat er woordelijk in');
  assert.equal(zijn.from, 'rahul');
  assert.ok(zijn.text, 'en zijn antwoord erachter');
  assert.equal(zijn.channel, 'assistent', 'herkenbaar als een beurt van de assistent');
});

test('2. Lifestyle: de assistent schrijft NIET in het concierge-draadje', async () => {
  const lid = await registreer(base, 'lifestyle');
  const voor = ((await api(base, '/api/chat/history', {}, lid)).body.messages || []).length;
  const r = await api(base, '/api/fluister', { q: 'hoe staat het met mijn aanvraag' }, lid);
  assert.equal(r.status, 200, 'de assistent werkt wel gewoon');
  assert.ok(r.body.antwoord, 'en geeft antwoord');
  const na = ((await api(base, '/api/chat/history', {}, lid)).body.messages || []).length;
  assert.equal(na, voor, 'maar het gesprek met de concierge blijft ongemoeid');
});

test('3. Business: idem, de lijn naar een mens blijft schoon', async () => {
  const lid = await registreer(base, 'business');
  const voor = ((await api(base, '/api/chat/history', {}, lid)).body.messages || []).length;
  await api(base, '/api/fluister', { q: 'zet even mijn kwartaalcijfers op een rij' }, lid);
  const na = ((await api(base, '/api/chat/history', {}, lid)).body.messages || []).length;
  assert.equal(na, voor);
});

test('4. de gewone chat blijft doen wat hij deed', async () => {
  // /api/chat/send is de eigen lijn: bij de RTG Pass antwoordt Rahul meteen,
  // en dat moet ongewijzigd blijven werken naast het vastleggen hierboven.
  const lid = await registreer(base, 'rtg');
  const r = await api(base, '/api/chat/send', { text: 'goedemiddag' }, lid);
  assert.equal(r.status, 200);
  const m = r.body.messages || [];
  assert.ok(m.length >= 2, 'de eigen beurt en een antwoord');
  assert.equal(m[m.length - 2].from, 'member');
  assert.equal(m[m.length - 1].from, 'rahul');
});

test('5. een leeg antwoord komt niet in het gesprek', async () => {
  // Anders zou een mislukte AI-beurt een lege bubbel in je geschiedenis zetten.
  const lid = await registreer(base, 'rtg');
  const voor = ((await api(base, '/api/chat/history', {}, lid)).body.messages || []).length;
  await api(base, '/api/fluister', { q: '   ' }, lid);
  const na = ((await api(base, '/api/chat/history', {}, lid)).body.messages || []).length;
  assert.equal(na, voor, 'niets gezegd, niets vastgelegd');
});
