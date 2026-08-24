/* DE VERIFICATIE WORDT BIJ DE INLOG ECHT VASTGELEGD -- laag 2 van de Trust
   Fabric, aan de kant waar hij aan de server hangt.

   WAAROM DEZE TOETS BESTAAT, en dat is een les uit deze ronde zelf. De aanroep
   in routes/auth/inlog.js staat in een try/catch: de inlog mag niet stukgaan
   omdat een meter hapert. Maar een try/catch om iets heen dat er niet is, ziet
   er precies hetzelfde uit als een try/catch om iets dat werkt -- de inlog
   slaagt in beide gevallen en niemand merkt dat de laag stilstaat. Zonder deze
   toets was "de sessie weet nu hoe hard hij is geverifieerd" een bewering
   zonder bron, en dat is precies waar VERTROUWEN.md par. 3.1 over gaat.

   Hij kijkt daarom in de OPSLAG en niet naar het antwoord: dat de sessie het
   weet, is niet aan de buitenkant te zien.

   Draai los: node --experimental-sqlite --test test/vertrouweninlog.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');
const V = require('../server/kern/vertrouwen/verificatie');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-vertrouwen-'));
let srv, base;

const api = (pad, body) => fetch(base + pad, { method: 'POST',
  headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) })
  .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

/* DE OPSLAG RECHTSTREEKS LEZEN, en niet via een deur. Dat de sessie weet hoe
   hard hij is geverifieerd, is aan de buitenkant niet te zien -- daar is deze
   laag juist voor. Een endpoint openzetten om het te kunnen toetsen, zou de
   toets betalen met een deur die niemand nodig heeft. Deze opstelling draait op
   sqlite (server/db/sqlite.js): elke collectie een rij in de kv-tabel. */
const { DatabaseSync } = require('node:sqlite');
const bak = () => {
  const kv = new DatabaseSync(path.join(TMP, 'store.db'), { readOnly: true });
  try {
    const rij = kv.prepare('SELECT val FROM kv WHERE key = ?').get('vertrouwen');
    return rij ? JSON.parse(rij.val) : {};
  } finally { kv.close(); }
};

test.before(async () => { srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } }); base = srv.base; });
test.after(async () => { await stop(srv); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });

test('1. een inlog legt vast HOE en WANNEER er is geverifieerd', async () => {
  const r = await api('/api/auth/login', { login: 'roellie.i@gmail.com', password: 'Imran', pasApp: 'business' });
  assert.equal(r.status, 200, 'de inlog zelf werkt: ' + JSON.stringify(r.body).slice(0, 120));
  assert.ok(r.body.token);

  const v = V.lees(bak(), r.body.token);
  assert.ok(v, 'de sessie staat in het verificatieregister -- zonder deze regel staat laag 2 stil');
  assert.equal(v.hoe, 'wachtwoord');
  assert.equal(v.sterkte, 'gewoon', 'een wachtwoord is niet slecht, het is minder hard dan een passkey');
  assert.equal(v.vers, true, 'net gebeurd');
  assert.equal(v.apparaatNieuw, true, 'de eerste inlog vanaf dit apparaat');
});

test('2. hetzelfde apparaat is de tweede keer niet meer nieuw', async () => {
  const kop = { 'Content-Type': 'application/json', 'user-agent': 'ToetsBrowser/1.0', 'accept-language': 'nl' };
  const inlog = () => fetch(base + '/api/auth/login', { method: 'POST', headers: kop,
    body: JSON.stringify({ login: 'roellie.i@gmail.com', password: 'Imran', pasApp: 'business' }) }).then(r => r.json());

  const een = await inlog();
  assert.equal(V.lees(bak(), een.token).apparaatNieuw, true, 'deze useragent is hier nog niet gezien');
  const twee = await inlog();
  assert.equal(V.lees(bak(), twee.token).apparaatNieuw, false, 'en daarna kent hij hem');

  const anders = await fetch(base + '/api/auth/login', {
    method: 'POST', headers: { ...kop, 'user-agent': 'EenHeelAndereBrowser/9' },
    body: JSON.stringify({ login: 'roellie.i@gmail.com', password: 'Imran', pasApp: 'business' }) }).then(r => r.json());
  assert.equal(V.lees(bak(), anders.token).apparaatNieuw, true, 'een ander apparaat wel');
});

test('3. er staat niets herleidbaars in de opslag', async () => {
  const kop = { 'Content-Type': 'application/json', 'user-agent': 'GeheimeBrowser/42', 'accept-language': 'nl' };
  const r = await fetch(base + '/api/auth/login', { method: 'POST', headers: kop,
    body: JSON.stringify({ login: 'roellie.i@gmail.com', password: 'Imran', pasApp: 'business' }) }).then(x => x.json());

  const ruw = JSON.stringify(bak());
  assert.equal(ruw.includes('GeheimeBrowser'), false, 'geen useragent in de opslag');
  assert.equal(ruw.includes(r.token), false, 'en ook het sessietoken zelf niet -- alleen een hash ervan');
  assert.equal(ruw.includes('roellie'), false, 'en geen e-mailadres');
  /* Wat er WEL staat is een manier en een tijdstip, en dat is precies genoeg. */
  assert.match(ruw, /"hoe":"wachtwoord"/);
});
