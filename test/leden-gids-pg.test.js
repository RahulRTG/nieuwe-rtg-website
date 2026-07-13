/* Integratietest voor de Postgres-ledengids (member_dir): met DATABASE_URL
   gezet staat de codenaam/pas-gids als GEINDEXEERDE RIJEN in Postgres in plaats
   van als object in het geheugen. Een nieuw lid dat zich meldt landt in de gids,
   en het kantoor-ledental komt uit de goedkope Postgres-telling (O(1)).

   Draait alleen als DATABASE_URL is gezet (zoals test/pg.test.js); anders
   overgeslagen. Draai:
     DATABASE_URL=postgresql://postgres@127.0.0.1:5433/rtg \
     node --experimental-sqlite --test test/leden-gids-pg.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

const HEEFT_PG = !!(process.env.DATABASE_URL || process.env.PG_URL);

function api(base, pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) }).then(r => r.json());
}
const wacht = ms => new Promise(r => setTimeout(r, ms));

test('Postgres-ledengids: een nieuw lid landt in de gids en telt mee in de kantoor-totalen',
  { skip: HEEFT_PG ? false : 'geen DATABASE_URL: Postgres-ledengids overgeslagen' }, async () => {
  // verse lokale data-dir (de gedeelde waarheid staat in Postgres, maar de lokale
  // cache/snapshot moet schoon zijn zodat oude runs niet meetellen)
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-gids-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } }); // DATABASE_URL erft van het proces
  try {
    const office = await api(base, '/api/office/login', { code: 'RTG-OFFICE' });
    assert.ok(office.token, 'kantoor-login geeft een token');
    const voor = (await api(base, '/api/office/state', {}, office.token)).state.totals.leden;
    assert.equal(typeof voor, 'number', 'ledental is een getal');

    // uniek telefoon/e-mail per run zodat de registratie niet op een duplicaat botst
    const uniek = Date.now().toString().slice(-8); // 8 cijfers -> 06 + 8 = geldig NL-mobiel (10)
    const reg = await api(base, '/api/auth/register', { name: 'Gids Lid', email: 'gids' + uniek + '@x.nl',
      phone: '06' + uniek, password: 'geheim123', geboortedatum: '1990-01-01', tier: 'business', pasApp: 'business' });
    assert.ok(reg.token, 'lid-registratie geeft een token');

    // een geauthenticeerde call zet het lid via dirTouch in de gids (member_dir).
    // In Postgres-modus kan de account-spiegel kort achterlopen op de registratie,
    // dus we proberen even door tot het lid oplost (dat is losstaand van de gids).
    let st = null;
    for (let i = 0; i < 20 && !(st && st.state && st.state.user); i++) {
      st = await api(base, '/api/state', {}, reg.token);
      if (!(st && st.state && st.state.user)) await wacht(200);
    }
    assert.ok(st && st.state && st.state.user, 'het lid is ingelogd');
    await wacht(400); // de gids-telling ververst kort na de upsert

    let na = voor;
    for (let i = 0; i < 20 && na < voor + 1; i++) {
      na = (await api(base, '/api/office/state', {}, office.token)).state.totals.leden;
      if (na < voor + 1) await wacht(200);
    }
    assert.ok(na >= voor + 1, 'het nieuwe lid telt mee in de kantoor-totalen (uit de Postgres-gids): ' + voor + ' -> ' + na);

    // READ-PAD: een tweede lid zoekt het eerste op codenaam. Dit gaat via de
    // geindexeerde ledengids (socialZoek -> ledenGidsZoek in Postgres), niet via
    // een scan door het geheugen.
    const codename = st.state.user.codename;
    const uniek2 = (Date.now() + 1).toString().slice(-8);
    const regB = await api(base, '/api/auth/register', { name: 'Zoek Lid', email: 'zoek' + uniek2 + '@x.nl',
      phone: '06' + uniek2, password: 'geheim123', geboortedatum: '1990-01-01', tier: 'business', pasApp: 'business' });
    assert.ok(regB.token, 'tweede lid geregistreerd');
    // eerst B's sessie laten oplossen (account-spiegel kan achterlopen)
    let stB = null;
    for (let i = 0; i < 25 && !(stB && stB.state && stB.state.user); i++) {
      stB = await api(base, '/api/state', {}, regB.token);
      if (!(stB && stB.state && stB.state.user)) await wacht(200);
    }
    assert.ok(stB && stB.state && stB.state.user, 'het tweede lid is ingelogd');
    let gevonden = false;
    for (let i = 0; i < 30 && !gevonden; i++) {
      const zoek = await api(base, '/api/member/find', { q: codename }, regB.token);
      gevonden = Array.isArray(zoek.results) && zoek.results.some(r => r.codename === codename);
      if (!gevonden) await wacht(200);
    }
    assert.ok(gevonden, 'het eerste lid is op codenaam vindbaar via de Postgres-gids: ' + codename);
  } finally {
    stop(child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
