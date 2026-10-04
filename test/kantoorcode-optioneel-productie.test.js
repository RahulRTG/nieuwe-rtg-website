/* OFFICE_CODE EN OFFICE_TOTP_SECRET ZIJN GEEN PRODUCTIE-EIS MEER
   (besluit van de eigenaar, 4 oktober 2026).

   In productie opent de gedeelde kantoorcode niets (B10,
   server/kern/kantoor/productiedeur.js) en gebruikt het koppelen van een
   uitnodiging de TOTP niet (B24, server/kern/eenaccount/koppelen.js). Een eis op
   een geheim dat niets opent is een ritueel, dus:

     1. een echte productieserver start ZONDER beide variabelen, en de code
        opent daar nog steeds niets;
     2. MET beide gezet start hij ook, opent de code nog steeds niets (formulier,
        met tweede factor, en het kantoorgesprek), en staat er precies EEN regel
        in het opstartlog dat ze genegeerd worden -- niet stil.

   Buiten productie werken ze zoals altijd; dat bewijst de tegenproef in
   test/kantoordeur-productie.test.js (stap 1).

   Draai los: node --test test/kantoorcode-optioneel-productie.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop } = require('./helper');
const { totpCode } = require('../server/kern/totp');

const CODE = 'GEHEIME-CODE-123';
const TOTP = 'JBSWY3DPEHPK3PXP';
const REGEL = /\[start\] OFFICE_CODE en OFFICE_TOTP_SECRET staan gezet maar worden in productie genegeerd \(B10\/B24\)/g;

const PROD = { NODE_ENV: 'production', RTG_DEMO: '0', APP_URL: 'https://rtg.voorbeeld.test/',
  SMTP_URL: 'smtp://rtg:test@mail.voorbeeld.test:587', ERR_WEBHOOK_URL: 'https://alarm.voorbeeld.test/rtg',
  RTG_ENC_KEY: 'k'.repeat(64), RTG_VAULT_KEY: 'v'.repeat(64), RTG_SECRET_KEY: 's'.repeat(64),
  RTG_OWNER_EMAIL: 'eigenaar@echtdomein.nl', RTG_ISOLATIE_AFDWINGEN: '1',
  RTG_BETALEN_UIT: '1', RTG_AI_UIT: '1', RTG_HERSTEL_SMS_UIT_BEWUST: '1' };

/* Start in productie en lees het opstartlog mee. Een lege string overschrijft
   wat er toevallig in de omgeving van de aanroeper staat: "niet gezet". */
async function start(t, kantoor) {
  const srv = await startServer({ stderr: 'pipe', env: { ...PROD, OFFICE_CODE: '', OFFICE_TOTP_SECRET: '', ...kantoor } });
  t.after(() => stop(srv.child));
  let log = '';
  srv.child.stderr.setEncoding('utf8');
  srv.child.stderr.on('data', d => { log += d; });
  const post = (pad, body) => fetch(srv.base + pad, { method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Forwarded-Proto': 'https' }, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
  /* de startcontrole draait VOOR het luisteren (opzet/start.js), dus de regel
     staat al in de pijp; geef hem alleen de tijd om aan te komen */
  await new Promise(r => setTimeout(r, 200));
  return { post, log: () => log };
}

async function codeOpentNiets(post, lijven) {
  for (const lijf of lijven) {
    const r = await post('/api/office/login', lijf);
    assert.equal(r.status, 403, 'de kantoorcode opent in productie niets: ' + JSON.stringify(r.body).slice(0, 120));
    assert.equal(r.body.code, 'KANTOORCODE_NIET_IN_PRODUCTIE');
    assert.equal(r.body.token, undefined, 'geen sessie');
  }
  const g = await post('/api/kantoor/gesprek/start', {});
  assert.equal(g.status, 403, 'ook het kantoorgesprek neemt geen code aan');
  assert.equal(g.body.code, 'KANTOORCODE_NIET_IN_PRODUCTIE');
}

test('productie start zonder OFFICE_CODE en OFFICE_TOTP_SECRET, en de code opent niets', async t => {
  const { post, log } = await start(t, {});
  await codeOpentNiets(post, [{ code: 'RTG-OFFICE' }, { code: CODE }]);
  assert.equal((log().match(REGEL) || []).length, 0, 'niets gezet, dus ook niets te negeren:\n' + log().slice(0, 600));
});

test('productie start MET beide gezet: genegeerd, met een regel in het opstartlog', async t => {
  const { post, log } = await start(t, { OFFICE_CODE: CODE, OFFICE_TOTP_SECRET: TOTP });
  await codeOpentNiets(post, [{ code: CODE }, { code: CODE, totp: totpCode(TOTP) }]);
  assert.equal((log().match(REGEL) || []).length, 1,
    'precies een regel dat ze genegeerd worden, niet stil en niet herhaald:\n' + log().slice(0, 600));
});
