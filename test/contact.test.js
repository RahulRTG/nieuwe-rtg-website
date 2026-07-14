/* Nooit meer vreemden: zodra een lid echt in contact komt met een partner
   (hier: een bezorgaanvraag) opent er automatisch een open chatlijn. Beide
   kanten zien die lijn, de partner mag vooraf de Salon van het lid bekijken
   (privacy-first: alleen codenaam, pas en eigen posts) en de partner kan het
   lid direct appen. Idempotent: de lijn en het welkomstbericht komen maar een
   keer. Draai: npm test */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

function api(base, pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}

let srv, base, winkel, lid;
const ADRES = 'Carrer de la Mar 10, Ibiza';

test.before(async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-contact-'));
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, DEMO_SUPPLIER: 'MAISON' } });
  base = srv.base;
  winkel = (await api(base, '/api/supplier/login', { username: 'rahul', password: 'Imran' })).body.token;
  await api(base, '/api/supplier/mode/bezorg/setup', { aan: true, kosten: 6.5, gratisVanaf: 150, waardegrensId: 250 }, winkel);
  const u = Date.now().toString().slice(-8);
  lid = (await api(base, '/api/auth/register', { name: 'Contact Lid', email: 'c' + u + '@x.nl',
    phone: '06' + u, password: 'geheim123', geboortedatum: '1990-01-01', tier: 'business', pasApp: 'business' })).body.token;
});
test.after(() => stop(srv && srv.child));

// vind de gastchat van dit lid bij de winkel via de leverancier-state
async function vindChatKey() {
  const st = await api(base, '/api/supplier/state', {}, winkel);
  const chats = (st.body.state && st.body.state.guestChats) || [];
  return chats[0] ? chats[0].key : null;
}

test('1. een contactmoment (bezorgaanvraag) opent automatisch een open lijn met welkomstbericht', async () => {
  const r = await api(base, '/api/mode/bezorg/aanvraag', { supplierCode: 'MAISON', adres: ADRES,
    items: [{ naam: 'Linnen jurk', maat: 'M', prijs: 80, aantal: 1 }] }, lid);
  assert.equal(r.status, 200);
  const hist = await api(base, '/api/partner/chat/history', { supplierCode: 'MAISON' }, lid);
  assert.equal(hist.status, 200);
  assert.ok(hist.body.messages.length >= 1, 'de lijn heeft meteen een systeembericht');
  assert.equal(hist.body.messages[0].from, 'systeem');
  assert.match(hist.body.messages[0].text, /open lijn/i);
});

test('2. de partner ziet de lijn in zijn Gastchat-overzicht', async () => {
  const key = await vindChatKey();
  assert.ok(key, 'de winkel ziet een gastchat met dit lid');
});

test('3. de partner mag vooraf de Salon van het lid bekijken (codenaam, pas, posts)', async () => {
  const key = await vindChatKey();
  const r = await api(base, '/api/supplier/klant/salon', { key }, winkel);
  assert.equal(r.status, 200);
  assert.ok(r.body.codename, 'een codenaam, nooit de echte naam');
  assert.ok(r.body.tier, 'de pas van het lid');
  assert.ok(Array.isArray(r.body.posts), 'de eigen Salon-posts van het lid');
});

test('4. de partner kan het lid direct appen op de open lijn', async () => {
  const key = await vindChatKey();
  const snd = await api(base, '/api/supplier/chat/send', { key, text: 'Welkom! Bekijk gerust onze Salon.' }, winkel);
  assert.equal(snd.status, 200);
  const hist = await api(base, '/api/partner/chat/history', { supplierCode: 'MAISON' }, lid);
  assert.ok(hist.body.messages.some(m => m.from === 'partner' && /Bekijk gerust/.test(m.text)), 'het lid ziet het partnerbericht');
});

test('5. idempotent: een tweede contactmoment maakt geen tweede welkomstbericht', async () => {
  const voor = await api(base, '/api/partner/chat/history', { supplierCode: 'MAISON' }, lid);
  const aantalSysteem = voor.body.messages.filter(m => m.from === 'systeem').length;
  await api(base, '/api/mode/bezorg/aanvraag', { supplierCode: 'MAISON', adres: ADRES,
    items: [{ naam: 'Zijden sjaal', prijs: 40, aantal: 1 }] }, lid);
  const na = await api(base, '/api/partner/chat/history', { supplierCode: 'MAISON' }, lid);
  assert.equal(na.body.messages.filter(m => m.from === 'systeem').length, aantalSysteem, 'maar een welkomstbericht');
});

test('6. de Salon van een klant is alleen te zien met een echte lijn bij deze zaak', async () => {
  const r = await api(base, '/api/supplier/klant/salon', { key: 'MAISON|user-bestaatniet|Team' }, winkel);
  assert.equal(r.status, 404, 'geen gesprek, geen inzage');
});
