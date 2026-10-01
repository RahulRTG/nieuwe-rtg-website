/* De livegang: in productie start het platform schoon en op slot.
   - geen demozaken in de catalogus, geen demopersoneel, geen voorbeeldposts
   - de demo-inlog is dicht (leden en zaken)
   - de rate-limiter staat aan
   Draai: node --test test/livegang.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer } = require('./helper');

let BASE, child;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-live-'));

async function api(pad, body) {
  return fetch(BASE + pad, {
    method: 'POST',
    // productie stuurt http door naar https; achter de proxy telt dit header-bewijs
    headers: { 'Content-Type': 'application/json', 'X-Forwarded-Proto': 'https' },
    body: JSON.stringify(body || {})
  });
}

test.before(async () => {
  ({ child, base: BASE } = await startServer({ env: {
    /* RTG_DEMO EXPLICIET UIT, en dat is precies wat deze toets aantoont.
       test/helper.js zet hem standaard op '1' omdat vrijwel elke toets op de
       demostand leunt (vaste inlog, bekend eigenaarsaccount). Deze toets start
       juist een ECHTE productieserver, en die weigert sindsdien te starten met
       demo aan: "[config] RTG_DEMO=1 in productie: de demo-inlog zou
       openstaan." Dat is de grendel uit dezelfde ronde die deze toets bewaakt.

       Het gevolg was dat alle drie de toetsen omvielen met "server stopte
       tijdens opstarten (exit 1)" -- de grendel werkte, en de toets die hem
       bewijst kwam er niet meer doorheen. */
    NODE_ENV: 'production', RTG_DEMO: '0', RTG_DATA_DIR: TMP,
    APP_URL: 'https://livegang.voorbeeld.test/',
    SMTP_URL: 'smtp://rtg:test@mail.voorbeeld.test:587', OPENAI_API_KEY: 'test-ai-key',
    ERR_WEBHOOK_URL: 'https://alarm.voorbeeld.test/rtg',
    RTG_ENC_KEY: 'k'.repeat(64), RTG_OWNER_EMAIL: 'eigenaar@echtdomein.nl',
    // sinds de sleutel-hardening (config fail-fast) eist een productiestart de
    // gedeelde kluis- en tokensleutel; zonder deze weigert de server te starten.
    RTG_VAULT_KEY: 'v'.repeat(64), RTG_SECRET_KEY: 's'.repeat(64),
    TURN_URL: 'turns:turn.livegang.voorbeeld.test:5349', TURN_SECRET: 't'.repeat(48),
    RTG_ISOLATIE_AFDWINGEN: '1',
    /* Deze toets bewijst de schone productiestart, toegang en limiter, niet de
       providerketen. Geld staat daarom expliciet fail-closed uit. De aparte
       go-live- en geldproeven eisen voor READY juist een echte provider,
       duurzame motor en settlement; een testsleutel hier zou dat onderscheid
       vertroebelen. */
    RTG_BETALEN_UIT: '1', RTG_HERSTEL_SMS_UIT_BEWUST: '1'
  } }));
});
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('productie start schoon: geen demozaken, geen demopersoneel, geen voorbeeldposts', async () => {
  // de openbare personeelskiezer is in productie dicht, vóór een zaak wordt opgezocht
  assert.equal((await api('/api/supplier/roster', { code: 'KIKUNOI' })).status, 403);
  assert.equal((await api('/api/supplier/roster', { code: 'VORA' })).status, 403);
  // een gast ziet een lege Salon (geen geseede verhalen) en lege catalogus
  const gast = await (await api('/api/login', { tier: 'guest' })).json();
  const state = gast.state;
  assert.equal((state.posts || []).filter(p => typeof p.id === 'number' && p.id <= 6).length, 0, 'geen voorbeeldposts');
  assert.equal((state.suppliers || []).length, 0, 'geen demozaken in de catalogus');
});

test('productie is op slot: demo-inloggen zijn dicht en de gedeelde kantoordeur bestaat niet', async () => {
  // demo-inlog voor leden en zaken is dicht
  assert.equal((await api('/api/login', { username: 'Rahul', password: 'Imran' })).status, 403);
  assert.equal((await api('/api/supplier/login', { username: 'Rahul', password: 'Imran' })).status, 403);
  /* geen gedeelde kantoorcode opent in productie het kantoor, ook de echte met
     tweede factor niet (besluit B10): alleen op naam met een passkey */
  for (const lijf of [{ code: 'RTG-OFFICE' }, { code: 'OUDE-KANTOORCODE', totp: '123456' }])
    assert.equal((await api('/api/office/login', lijf)).status, 403, 'de kantoorcode opent in productie niets');
});

test('de rate-limiter staat aan in productie (429 boven de grens)', async () => {
  let laatste = 200;
  for (let i = 0; i < 320; i++) {
    const r = await api('/api/reviews', { supplierCode: 'X' });
    laatste = r.status;
    if (laatste === 429) break;
  }
  assert.equal(laatste, 429, 'boven de 300 verzoeken per minuut komt een nette 429');
});
