/* Sessie-duurzaamheid: een ingelogd lid blijft na een serverherstart ingelogd,
   omdat de sessie (alleen de token-hash) in db.data.sessions staat en bij het
   opstarten terug in de Map wordt geladen. Dit dekt het herstelpad rond de
   maakSessies-fabriek (server/kern/sessies.js). Draai: npm test */
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop } = require('./helper');
const fs = require('fs');
const os = require('os');
const path = require('path');

async function api(base, pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return (await fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })).json();
}

test('een ingelogd lid blijft na een serverherstart ingelogd (zelfde data-dir)', async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-herstart-'));
  try {
    // 1) starten, registreren en het token onthouden
    let s = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
    const reg = await api(s.base, '/api/auth/register', { name: 'Herstart Lid', email: 'herstart@x.nl',
      phone: '0612349777', password: 'geheim123', geboortedatum: '1990-01-01', tier: 'business', pasApp: 'business' });
    assert.ok(reg.token, 'registratie geeft een token');
    const voor = await api(s.base, '/api/state', {}, reg.token);
    assert.ok(voor.state && voor.state.user, 'voor de herstart is het lid ingelogd');
    const codenaam = voor.state.user.codename;
    stop(s.child);
    await new Promise(r => setTimeout(r, 700));

    // 2) herstarten met dezelfde data-dir; hetzelfde token moet nog werken
    s = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
    const na = await api(s.base, '/api/state', {}, reg.token);
    assert.ok(na.state && na.state.user, 'na de herstart is het lid nog ingelogd');
    assert.equal(na.state.user.codename, codenaam, 'het is dezelfde sessie/gebruiker');
    stop(s.child);
  } finally {
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
