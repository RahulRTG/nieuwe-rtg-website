/* De backoffice binnenkomen door met Rahul te praten in plaats van een codeveld
   in te vullen -- zonder dat de deur daar zachter van wordt.

   Dat laatste is de kern van deze test. Een inlog vriendelijker maken is
   makkelijk; het gevaar is dat je hem daarmee ook makkelijker te forceren maakt.
   Daarom wordt hier niet alleen getoetst DAT het gesprek werkt, maar vooral dat
   het precies zo streng is als het formulier: dezelfde teller, dezelfde bucket,
   en een fout antwoord dat niet verklapt welke helft fout was.

   Draai los: node --experimental-sqlite --test test/kantoorgesprek.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop } = require('./helper');
const fs = require('fs'); const os = require('os'); const path = require('path');

async function api(base, pad, body) {
  const r = await fetch(base + pad, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}) });
  return { status: r.status, body: await r.json().catch(() => ({})) };
}

test('het kantoorgesprek laat je binnen, en is even streng als het formulier', async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-kg-'));
  const CODE = 'PROEFCODE123';
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, OFFICE_CODE: CODE } });
  try {
    // 1) Rahul begint, en vraagt om de code -- gemaskeerd, want dit hoort niet leesbaar in beeld
    const start = await api(base, '/api/kantoor/gesprek/start', {});
    assert.equal(start.status, 200);
    assert.equal(start.body.veld, 'code');
    assert.equal(start.body.verborgen, true, 'het scherm moet weten dat het de invoer maskeert');
    assert.match(start.body.tekst, /kantoorcode/i);

    // 2) een fout antwoord verklapt niets en laat je niet binnen
    const fout = await api(base, '/api/kantoor/gesprek/zeg', { id: start.body.id, tekst: 'ZOMAARIETS' });
    assert.equal(fout.status, 401);
    assert.ok(!fout.body.token, 'geen token bij een foute code');
    assert.doesNotMatch(String(fout.body.error), /code|factor/i,
      'hij zegt niet WELKE helft fout was, anders is de deur een orakel');

    // 3) met de goede code ben je binnen, en dat token werkt echt op het kantoor
    const s2 = await api(base, '/api/kantoor/gesprek/start', {});
    const goed = await api(base, '/api/kantoor/gesprek/zeg', { id: s2.body.id, tekst: CODE });
    assert.equal(goed.status, 200);
    assert.equal(goed.body.binnen, true);
    assert.ok(goed.body.token, 'er is een kantoorsessie');
    const proef = await fetch(base + '/api/office/securitylog', { method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + goed.body.token },
      body: '{}' });
    assert.equal(proef.status, 200, 'de kantoorsessie werkt op een echt kantoor-endpoint');

    // 4) hoofdletterongevoelig, net als het formulier
    const s3 = await api(base, '/api/kantoor/gesprek/start', {});
    const klein = await api(base, '/api/kantoor/gesprek/zeg', { id: s3.body.id, tekst: CODE.toLowerCase() });
    assert.equal(klein.body.binnen, true, 'kleine letters mogen ook, net als in het veld');

    // 5) stoppen mag altijd
    const s4 = await api(base, '/api/kantoor/gesprek/start', {});
    const stopt = await api(base, '/api/kantoor/gesprek/zeg', { id: s4.body.id, tekst: 'laat maar' });
    assert.equal(stopt.body.gestopt, true);

    /* 6) HET SLOT. Tien misslagen in het gesprek moeten OOK het formulier
       dichtzetten: het is dezelfde deur, dus het hoort dezelfde teller te zijn.
       Zou het gesprek een eigen teller hebben, dan had je met "alles via Rahul"
       het aantal gratis pogingen verdubbeld. */
    for (let i = 0; i < 10; i++) {
      const s = await api(base, '/api/kantoor/gesprek/start', {});
      if (s.body.id) await api(base, '/api/kantoor/gesprek/zeg', { id: s.body.id, tekst: 'FOUTFOUT' + i });
    }
    const naSlot = await api(base, '/api/kantoor/gesprek/start', {});
    assert.equal(naSlot.status, 429, 'het gesprek zit op slot na tien misslagen');

    const formulier = await api(base, '/api/office/login', { code: CODE });
    assert.equal(formulier.status, 429,
      'en het FORMULIER zit ook op slot: dezelfde deur, dezelfde teller');
  } finally { stop(child); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} }
});

test('met tweede factor vraagt hij er ook echt om, en niet eerder', async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-kg2-'));
  const CODE = 'TWEEFACTOR99';
  // een geldig base32-secret; de codes rekenen we hieronder zelf uit
  const SECRET = 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP';
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP,
    OFFICE_CODE: CODE, OFFICE_TOTP_SECRET: SECRET } });
  try {
    const start = await api(base, '/api/kantoor/gesprek/start', {});
    const naCode = await api(base, '/api/kantoor/gesprek/zeg', { id: start.body.id, tekst: CODE });
    assert.equal(naCode.status, 200);
    assert.ok(!naCode.body.token, 'de goede code alleen laat je NIET binnen als 2FA aanstaat');
    assert.equal(naCode.body.veld, 'totp', 'hij vraagt door naar de tweede factor');
    assert.equal(naCode.body.verborgen, true, 'ook die invoer wordt gemaskeerd');

    const foutTotp = await api(base, '/api/kantoor/gesprek/zeg', { id: naCode.body.id || start.body.id, tekst: '000000' });
    assert.equal(foutTotp.status, 401, 'een foute tweede factor laat je niet binnen');
    assert.ok(!foutTotp.body.token);
  } finally { stop(child); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} }
});
