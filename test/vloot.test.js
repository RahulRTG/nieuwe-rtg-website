/* Integratietests voor de foutisolatie: elke app draait als eigen proces in de
   vloot (server/vloot.js) achter de poortwachter. Een bug in een route raakt
   alleen die ene aanvraag; een crash van een groep raakt alleen dat domein en
   wordt automatisch hersteld, terwijl de andere apps gewoon doordraaien.
   Draai los: node --experimental-sqlite --test test/vloot.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const POORT = 4200 + Math.floor(Math.random() * 60);  // de gateway
const BASIS = POORT + 100;                            // groepspoorten: leden, kantoor, rtf
const BASE = 'http://127.0.0.1:' + POORT;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-vloot-'));
let vloot;

function post(pad, body, poort) {
  return fetch('http://127.0.0.1:' + (poort || POORT) + pad, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {})
  });
}
async function wachtTot(fn, ms = 20000) {
  const tot = Date.now() + ms;
  while (Date.now() < tot) {
    try { if (await fn()) return true; } catch (e) {}
    await new Promise(r => setTimeout(r, 250));
  }
  return false;
}

test.before(async () => {
  vloot = spawn(process.execPath, [path.join(__dirname, '..', 'server', 'vloot.js')], {
    env: {
      ...process.env, NODE_ENV: 'test', RTG_DATA_DIR: TMP, SMTP_URL: '',
      RTG_POORT: String(POORT), RTG_VLOOT_BASIS: String(BASIS),
      RTG_VLOOT_GROEPEN: 'leden:auth,member,social,zakelijk|kantoor:office,techniek|rtf:-'
    },
    stdio: ['ignore', 'ignore', 'inherit']
  });
  // alle drie de groepen en de gateway moeten opkomen
  const klaar = await wachtTot(async () => {
    const a = await fetch(BASE + '/api/health');                    // via gateway -> groep leden
    const b = await post('/api/office/login', { code: 'RTG-OFFICE' }); // via gateway -> groep kantoor
    const c = await fetch(BASE + '/api/foundation/health');        // via gateway -> groep rtf
    return a.ok && b.ok && c.ok;
  }, 30000);
  assert.ok(klaar, 'de vloot (3 groepen + poortwachter) komt op');
});
test.after(() => {
  if (vloot) try { vloot.kill('SIGTERM'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('een bug in een route geeft die ene aanvraag 500; het proces leeft door', async () => {
  // de opzettelijke async-bug (alleen in NODE_ENV=test aanwezig)
  const r = await post('/api/test/bug', {}, BASIS); // rechtstreeks op de leden-groep
  assert.equal(r.status, 500, 'de kapotte route geeft netjes 500');
  assert.ok((await r.json()).error, 'met een nette foutmelding');
  // en hetzelfde proces beantwoordt de volgende aanvraag gewoon
  assert.equal((await post('/api/login', { tier: 'rtg', pasApp: 'rtg' })).status, 200, 'de leden-app doet het nog');
});

test('crasht de kantoor-groep, dan valt ALLEEN kantoor uit; de rest draait door', async () => {
  // laat het kantoor-proces echt sterven (rechtstreeks op zijn eigen poort)
  await post('/api/test/crash', {}, BASIS + 1).catch(() => {});
  await new Promise(r => setTimeout(r, 400));

  // kantoor is nu (even) onbereikbaar via de gateway: 502, geen hangende aanvraag
  const kantoorPlat = await wachtTot(async () =>
    (await post('/api/office/login', { code: 'RTG-OFFICE' })).status === 502, 5000);
  assert.ok(kantoorPlat, 'de gateway geeft 502 voor alleen het kantoor-domein');

  // de andere apps merken er NIETS van
  assert.equal((await post('/api/login', { tier: 'business', pasApp: 'business' })).status, 200, 'leden draait door');
  assert.equal((await fetch(BASE + '/api/foundation/health')).status, 200, 'de foundation draait door');

  // de vloot herstart de groep vanzelf; daarna doet kantoor het weer
  const terug = await wachtTot(async () =>
    (await post('/api/office/login', { code: 'RTG-OFFICE' })).status === 200, 25000);
  assert.ok(terug, 'de kantoor-groep is automatisch herstart en werkt weer');
});
