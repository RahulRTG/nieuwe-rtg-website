/* RTG Zegel-routes (server.js): een lid maakt een zegel voor een partner, de
   partner haalt de publieke sleutel op en verifieert OFFLINE (met server/lib/
   zegel.controleer). Getoetst: selectieve onthulling (alleen ware, gevraagde
   feiten; geen ruwe gegevens), onkoppelbare pseudoniemen per partner, en dat een
   feit dat niet klopt (onder 18) niet te bewijzen valt.
   Draai los: node --experimental-sqlite --test test/zegelroute.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop } = require('./helper');
const { controleer } = require('../server/lib/zegel');
const fs = require('fs');
const os = require('os');
const path = require('path');

function verseDataDir() { return fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-zegelrt-')); }
async function api(base, pad, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = 'Bearer ' + token;
  const r = await fetch(base + pad, { method: 'POST', headers, body: JSON.stringify(body || {}) });
  return { status: r.status, body: await r.json() };
}
async function registreer(base, extra) {
  const u = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  return (await api(base, '/api/auth/register', Object.assign({
    name: 'Zegel Lid', email: u + '@x.nl', phone: '06' + u.replace(/\D/g, '').padEnd(8, '1').slice(0, 8),
    password: 'geheim123', geboortedatum: '1990-01-01', tier: 'business', pasApp: 'business'
  }, extra))).body.token;
}

test('1. lid maakt zegel, partner verifieert offline; geen ruwe gegevens', async () => {
  const TMP = verseDataDir();
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  try {
    const lid = await registreer(base);
    assert.ok(lid, 'lid geregistreerd');

    // de partner-app haalt eenmalig de publieke sleutel op (daarna offline)
    const sleutel = (await (await fetch(base + '/api/zegel/sleutel')).json()).sleutel;
    assert.ok(sleutel, 'publieke sleutel opgehaald');

    // het lid maakt een zegel voor KIKUNOI: 18+, geldig lid, welke pas
    const mk = await api(base, '/api/zegel/maak', { partner: 'KIKUNOI', claims: ['leeftijd18', 'lid', 'pas'], geldigMin: 5 }, lid);
    assert.equal(mk.status, 200);
    const token = mk.body.token;
    assert.ok(token, 'zegel-token ontvangen');

    // OFFLINE verifiëren met alleen de publieke sleutel
    const r = controleer(token, sleutel);
    assert.equal(r.geldig, true, 'zegel is geldig');
    assert.equal(r.claims.leeftijd18, true);
    assert.equal(r.claims.lid, true);
    assert.equal(r.claims.pas, 'business');
    assert.match(r.sub, /^pw_/, 'onderwerp is een pseudoniem');

    // er zitten GEEN ruwe gegevens in het token
    const payload = Buffer.from(token.split('.')[0], 'base64url').toString();
    assert.doesNotMatch(payload, /Zegel Lid|1990|@x\.nl/, 'geen naam/geboortedatum/e-mail in het zegel');
  } finally {
    stop(child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});

test('2. onkoppelbaar: hetzelfde lid krijgt per partner een ander pseudoniem', async () => {
  const TMP = verseDataDir();
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  try {
    const lid = await registreer(base);
    const bijKiku = (await api(base, '/api/zegel/maak', { partner: 'KIKUNOI', claims: ['lid'] }, lid)).body.sub;
    const bijSakura = (await api(base, '/api/zegel/maak', { partner: 'SAKURA', claims: ['lid'] }, lid)).body.sub;
    assert.ok(bijKiku && bijSakura);
    assert.notEqual(bijKiku, bijSakura, 'twee venues kunnen het lid niet matchen');
    // maar bij dezelfde partner blijft het stabiel
    const bijKiku2 = (await api(base, '/api/zegel/maak', { partner: 'KIKUNOI', claims: ['lid'] }, lid)).body.sub;
    assert.equal(bijKiku, bijKiku2, 'zelfde partner = herkenbaar');
  } finally {
    stop(child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});

test('3. selectieve onthulling: een onwaar feit valt niet te bewijzen', async () => {
  const TMP = verseDataDir();
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  try {
    // een lid van 19 (geboren 2007) vraagt 21+ aan: dat is niet waar, dus het
    // kan niet worden bewezen; 18+ en lidmaatschap wel.
    const lid = await registreer(base, { geboortedatum: '2007-01-01' });
    const mk = await api(base, '/api/zegel/maak', { partner: 'KIKUNOI', claims: ['leeftijd21', 'leeftijd18', 'lid'] }, lid);
    assert.equal(mk.status, 200);
    assert.equal(mk.body.claims.leeftijd21, undefined, '21+ zit NIET in het zegel (niet waar, niet te bewijzen)');
    assert.equal(mk.body.claims.leeftijd18, true, '18+ kan wel');
    assert.equal(mk.body.claims.lid, true, 'lidmaatschap wel');
  } finally {
    stop(child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
