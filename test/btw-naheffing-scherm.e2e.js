/* Schermtoets: de naheffing zoals de ONDERNEMER hem ziet, en het bezwaar dat
   hij er vanaf datzelfde scherm tegen maakt.

   Dit was het laatste gat in de dekking van de btw-laag. Het gedrag zit in
   test/btw-naheffing.test.js en de keten over de routes in
   test/btw-naheffing-keten.test.js, maar dit stuk OPMAAK had nog nooit een
   toets gezien -- en een blok dat niemand ooit heeft zien tekenen is precies
   waar scripts/schermen.js over gaat: "af" is geen bewering.

   Dezelfde horde als in de keten-toets, en dezelfde weg eromheen: naheffen kan
   alleen over een AFGESLOTEN tijdvak en elke factuur is van vandaag, dus gaat de
   server uit, wordt de datum in de opslag gezet, en komt hij terug. De
   facturatiemotor krijgt geen backdate-knop; die hoort daar niet.
   Draai: npm run e2e */
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop, letOpFouten } = require('./helper');
const fs = require('fs');
const os = require('os');
const path = require('path');

function laadPlaywright() {
  for (const p of [undefined, '/opt/node22/lib/node_modules', '/usr/lib/node_modules', '/usr/local/lib/node_modules']) {
    try { return require(p ? require.resolve('playwright', { paths: [p] }) : 'playwright'); } catch (e) { /* volgende */ }
  }
  try { const eigen = require('../server/lib/browser'); if (eigen.beschikbaar()) return eigen; } catch (e) { /* geen browser */ }
  return null;
}
const pw = laadPlaywright();
const api = (base, pad, body, token) => fetch(base + pad, { method: 'POST',
  headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { Authorization: 'Bearer ' + token } : {}),
  body: JSON.stringify(body || {}) }).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
const wacht = (ms) => new Promise(r => setTimeout(r, ms));

function vorigKwartaal() {
  const d = new Date();
  let jaar = d.getUTCFullYear(), kw = Math.floor(d.getUTCMonth() / 3) + 1;
  kw -= 1; if (kw === 0) { kw = 4; jaar -= 1; }
  return { periode: jaar + 'K' + kw, datum: jaar + '-' + String((kw - 1) * 3 + 2).padStart(2, '0') + '-15' };
}

test('Kantoor van de zaak: de naheffing staat op het scherm, en het bezwaar gaat eraf',
  { skip: pw ? false : 'playwright niet beschikbaar in deze omgeving' }, async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-nhscherm-'));
  const env = { SMTP_URL: '', RTG_DATA_DIR: TMP, RTG_STORE: 'json' };
  const K = vorigKwartaal();
  let srv = await startServer({ env });
  let browser;
  try {
    // ---- opzet: een factuur in een afgesloten kwartaal en een tweede inspecteur ----
    const zaak = (await api(srv.base, '/api/supplier/login', { username: 'rahul', password: 'Imran' })).body.token;
    const f = await api(srv.base, '/api/supplier/facturen/maak',
      { omschrijving: 'Diner', aantal: 1, bedrag: 242, koperNaam: 'Gast' }, zaak);
    assert.equal(f.status, 200);
    const roster = await api(srv.base, '/api/supplier/roster', { code: 'RIJK' });
    const chef = roster.body.staff.find(m => m.role === 'manager');
    const chefTok = (await api(srv.base, '/api/supplier/login', { code: 'RIJK', staffId: chef.id, pin: '1234' })).body.token;
    const tweede = await api(srv.base, '/api/supplier/staff/add', { name: 'Inspecteur Bakker', role: 'manager' }, chefTok);
    assert.equal(tweede.status, 200);

    await wacht(1500);
    stop(srv.child);
    await wacht(2500);
    const pad = path.join(TMP, 'db.json');
    const db = JSON.parse(fs.readFileSync(pad, 'utf8'));
    db.facturen[0].datum = K.datum;
    db.facturen[0].at = K.datum + 'T10:00:00.000Z';
    fs.writeFileSync(pad, JSON.stringify(db));
    srv = await startServer({ env });

    // ---- de inspecteurs leggen hem op: opmaken door de een, vaststellen door de ander ----
    const t1 = (await api(srv.base, '/api/supplier/login', { code: 'RIJK', staffId: chef.id, pin: '1234' })).body.token;
    const t2 = (await api(srv.base, '/api/supplier/login',
      { code: 'RIJK', staffId: tweede.body.staff.id, pin: tweede.body.pin })).body.token;
    const maak = await api(srv.base, '/api/overheid/bd/naheffing/maak',
      { periode: K.periode, code: 'KIKUNOI', boetePct: 10, boeteGrond: 'niets aangegeven over dit tijdvak' }, t1);
    assert.equal(maak.status, 200, 'de naheffing is opgemaakt');
    const vast = await api(srv.base, '/api/overheid/bd/naheffing/stelvast', { id: maak.body.naheffing.id }, t2);
    assert.equal(vast.status, 200, 'en door andere ogen vastgesteld');
    const kenmerk = vast.body.naheffing.kenmerk;

    // ---- het scherm van de zaak ----
    const zaakTok = (await api(srv.base, '/api/supplier/login', { username: 'rahul', password: 'Imran' })).body.token;
    browser = await pw.chromium.launch({ args: ['--no-sandbox'] });
    const page = await browser.newPage();
    const fouten = [];
    letOpFouten(page, fouten);
    await page.addInitScript(t => {
      localStorage.setItem('rtg_sup_token', t);
      localStorage.setItem('rtg_sup_station', 'kantoor');
      localStorage.setItem('rtg_lang', 'nl');
      localStorage.setItem('rtg_cookieinfo_v1', '1');
    }, zaakTok);
    await page.goto(srv.base + '/apps/leverancier.html', { waitUntil: 'load' });
    await page.waitForSelector('#app.active', { timeout: 20000 });
    await page.waitForSelector('[data-ksec="fin"]', { state: 'visible', timeout: 15000 });
    await page.click('[data-ksec="fin"]');
    await page.waitForSelector('#btwOp', { timeout: 15000 });

    // het naheffingsblok staat er, met kenmerk, bedrag, boete en grond
    await page.waitForFunction(k => {
      const el = document.querySelector('#btwOp');
      return !!(el && el.closest('.tkc').textContent.includes(k));
    }, kenmerk, { timeout: 15000 });
    const kaart = (await page.$eval('#btwOp', e => e.closest('.tkc').textContent)).replace(/\s+/g, ' ');
    assert.match(kaart, /Naheffing van de Belastingdienst/);
    assert.ok(kaart.includes(kenmerk), 'het kenmerk staat er');
    assert.match(kaart, /stand: vastgesteld/);
    assert.match(kaart, /boete .*niets aangegeven over dit tijdvak/,
      'de grond van de boete staat erbij; een boete zonder leesbare grond is geen boete');
    assert.match(kaart, /vervalt \d{4}-\d{2}-\d{2}/, 'en een vervaldatum');

    // ---- bezwaar vanaf datzelfde scherm ----
    const veld = await page.$('#nhr' + maak.body.naheffing.id);
    assert.ok(veld, 'er staat een bezwaarveld bij een vastgestelde naheffing');
    await veld.fill('Deze omzet is in het volgende tijdvak aangegeven.');
    await page.click('[data-nhbez="' + maak.body.naheffing.id + '"]');
    await page.waitForFunction(() => {
      const el = document.querySelector('#btwOp');
      return !!(el && /Uw bezwaar loopt/.test(el.closest('.tkc').textContent));
    }, null, { timeout: 15000 });
    const na = (await page.$eval('#btwOp', e => e.closest('.tkc').textContent)).replace(/\s+/g, ' ');
    assert.match(na, /stand: bezwaar/, 'de stand is bijgewerkt');
    assert.equal(await page.$('[data-nhbez="' + maak.body.naheffing.id + '"]'), null,
      'en er staat geen tweede bezwaarknop meer');

    // de server weet ervan; het scherm heeft het niet alleen maar getekend
    const serverkant = await api(srv.base, '/api/supplier/btw/naheffingen', {}, zaakTok);
    assert.equal(serverkant.body.naheffingen[0].status, 'bezwaar');
    assert.match(serverkant.body.naheffingen[0].bezwaar.reden, /volgende tijdvak/);

    assert.deepEqual(fouten, [], 'geen JS-fouten tijdens het scherm');
  } finally {
    if (browser) await browser.close();
    if (srv && srv.child) stop(srv.child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) { /* opruimen mag falen */ }
  }
});
