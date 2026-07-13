/* De kantoor-totalen tellen de leden met een goedkope, onderhouden teller
   (ledenAantal) i.p.v. Object.keys(memberDir).length, dat O(N) is en bij
   miljoenen leden seconden per verzoek kost. Deze test bewaakt dat de teller
   klopt: een nieuw lid dat zich meldt hoogt het kantoor-ledental met precies 1
   op. Draai: npm test */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

function api(base, pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) }).then(r => r.json());
}

test('kantoor-ledental hoogt met precies 1 op als een nieuw lid zich meldt', async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-teller-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  try {
    const office = await api(base, '/api/office/login', { code: 'RTG-OFFICE' });
    assert.ok(office.token, 'kantoor-login geeft een token');
    const voor = (await api(base, '/api/office/state', {}, office.token)).state.totals.leden;
    assert.equal(typeof voor, 'number', 'ledental is een getal');

    // een nieuw lid registreert en doet één geauthenticeerde call (dirTouch zet
    // het in de codenaam-gids en hoogt de teller op)
    const reg = await api(base, '/api/auth/register', { name: 'Teller Lid', email: 'teller@x.nl',
      phone: '0612340333', password: 'geheim123', geboortedatum: '1990-01-01', tier: 'business', pasApp: 'business' });
    assert.ok(reg.token, 'lid-registratie geeft een token');
    await api(base, '/api/state', {}, reg.token);

    const na = (await api(base, '/api/office/state', {}, office.token)).state.totals.leden;
    assert.equal(na, voor + 1, 'precies één lid erbij in de kantoor-totalen');

    // nog een keer hetzelfde lid: geen dubbeltelling
    await api(base, '/api/state', {}, reg.token);
    const na2 = (await api(base, '/api/office/state', {}, office.token)).state.totals.leden;
    assert.equal(na2, na, 'hetzelfde lid telt niet dubbel');
  } finally {
    stop(child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
