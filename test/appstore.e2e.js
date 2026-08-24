/* DE CEL IN EEN ECHTE BROWSER -- het enige bewijs dat telt voor deze laag.

   test/appstore.test.js bewijst wat de SERVER doet. Dat is niet hetzelfde als
   wat een browser doet: een naamloze herkomst, een postMessage tussen twee
   documenten en een CSP met `sandbox` erin zijn precies het soort dingen die
   over de lijn kloppen en in een venster stukgaan. Daarom deze toets.

   Wat hij vastlegt:
     1. de cel draait ECHT op een naamloze herkomst -- de ouder kan niet bij
        het document erin, en de app kan niet bij de ouder;
     2. de brug werkt: een app die RTG.roep() aanroept krijgt antwoord;
     3. een machtiging die het lid niet heeft verleend, komt niet door -- ook
        niet in een browser waar de app zelf mag proberen wat hij wil.

   Draait alleen waar Playwright beschikbaar is; anders overgeslagen.
   Draai: npm run e2e */
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop } = require('./helper');
const fs = require('fs');
const os = require('os');
const path = require('path');

function laadPlaywright() {
  for (const p of [undefined, '/opt/node22/lib/node_modules', '/usr/lib/node_modules', '/usr/local/lib/node_modules']) {
    try { return require(p ? require.resolve('playwright', { paths: [p] }) : 'playwright'); } catch (e) { /* volgende */ }
  }
  return null;
}
const pw = laadPlaywright();

async function api(base, pad, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = 'Bearer ' + token;
  const r = await fetch(base + pad, { method: 'POST', headers, body: JSON.stringify(body || {}) });
  return { status: r.status, body: await r.json().catch(() => ({})) };
}

/* Een echte proef-app: hij vraagt zijn stand op bij de brug, schrijft er een
   nieuwe en probeert daarna iets waar hij geen machtiging voor heeft. Alle drie
   de uitkomsten zet hij in de DOM, zodat de toets ze kan lezen. */
const PROEF_JS = [
  'function zet(id, t) { document.getElementById(id).textContent = t; }',
  'RTG.roep("opslag.zet", { sleutel: "stand", waarde: "42" })',
  '  .then(function () { return RTG.roep("opslag.lees", { sleutel: "stand" }); })',
  '  .then(function (r) { zet("uit", "stand=" + r.waarde); })',
  '  .catch(function (e) { zet("uit", "fout: " + e.message); });',
  'RTG.roep("profiel.wieBenIk")',
  '  .then(function (r) { zet("wie", "kreeg: " + JSON.stringify(r)); })',
  '  .catch(function (e) { zet("wie", "geweigerd: " + e.message); });',
  /* En hij probeert bij het venster erboven te komen, LANGS de statische
     keuring heen. De open vorm (`window.parent.…`) wordt bij het inzenden
     afgekeurd -- dat toetst test/appstore-cel.test.js. Hier gaat het om de
     vraag daarna: wat als iemand die keuring omzeilt? Dan hoort de BROWSER hem
     tegen te houden, en dat is precies wat een naamloze herkomst doet. Twee
     sloten, en dit is het tweede. */
  'try { zet("ouder", String(window[["par","ent"].join("")].location.href)); }',
  'catch (e) { zet("ouder", "geen toegang tot de ouder"); }'
].join('\n');
const PROEF_HTML = '<!doctype html><html lang="nl"><head><meta charset="utf-8"><title>Proef</title></head><body>' +
  '<p id="uit">bezig</p><p id="wie">bezig</p><p id="ouder">bezig</p>' +
  '<script src="app.js"></script></body></html>';

test('de cel: naamloze herkomst, werkende brug, en een geweigerde machtiging', { skip: !pw && 'Playwright niet beschikbaar' }, async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-appstore-e2e-'));
  const srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  const base = srv.base;
  let browser = null;
  try {
    // ---- opzetten: uitgever, app, publicatie, lid ----
    const tech = (await api(base, '/api/techniek/inloggen', { login: 'roellie.i@gmail.com', wachtwoord: 'Imran' })).body.token;
    const office = (await api(base, '/api/office/login', { code: 'RTG-OFFICE' })).body.token;
    const roster = (await api(base, '/api/supplier/roster', { code: 'KIKUNOI' })).body;
    const chef = (roster.staff || []).find(x => x.role === 'manager');
    const sup = (await api(base, '/api/supplier/login', { code: 'KIKUNOI', staffId: chef.id, pin: '1234' })).body.token;
    const lid = (await api(base, '/api/auth/register', { name: 'Cel Lid', email: 'cel@x.nl', phone: '0612345677',
      password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' })).body.token;
    assert.ok(tech && office && sup && lid, 'alle vier de sessies staan');

    await api(base, '/api/techniek/tenant', { org: 'O-CEL', naam: 'Cel Uitgeverij' }, tech);
    await api(base, '/api/techniek/tenant/bind', { org: 'O-CEL', soort: 'zaak', code: 'KIKUNOI' }, tech);
    await api(base, '/api/appstore/uitgever/aanvraag', { naam: 'Cel Uitgeverij', contact: 'dev@cel.nl' }, sup);
    await api(base, '/api/appstore/kantoor/uitgever', { org: 'O-CEL', besluit: 'toegelaten', door: 'Sam van RTG' }, office);

    const inz = await api(base, '/api/appstore/uitgever/inzenden', {
      manifest: { sleutel: 'cel-proef', naam: 'Celproef', versie: '1.0.0', categorie: 'leven',
        uitleg: 'Een proefapp die laat zien wat er wel en niet door de brug komt.',
        machtigingen: ['opslag.eigen', 'profiel.basis'] },
      bestanden: [{ pad: 'index.html', inhoud: PROEF_HTML }, { pad: 'app.js', inhoud: PROEF_JS }]
    }, sup);
    assert.equal(inz.status, 200, JSON.stringify(inz.body.bevindingen || inz.body.fouten || inz.body.error));
    assert.equal((await api(base, '/api/appstore/kantoor/besluit',
      { versieId: inz.body.versie.id, besluit: 'gepubliceerd', door: 'Sam van RTG' }, office)).status, 200);

    /* Het lid verleent er EEN van de twee. Dat is de kern van de toets: de app
       probeert straks allebei, in een echte browser, en krijgt er een. */
    assert.equal((await api(base, '/api/appstore/installeer',
      { sleutel: 'cel-proef', machtigingen: ['opslag.eigen'] }, lid)).status, 200);

    // ---- de browser ----
    browser = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
    const page = await browser.newPage();
    const fouten = [];
    page.on('pageerror', (e) => fouten.push(String(e && e.message || e)));
    await page.goto(base + '/apps/app.html');
    await page.evaluate((t) => localStorage.setItem('rtg_member_token', t), lid);
    await page.goto(base + '/apps/appcel.html?app=cel-proef');

    await page.waitForSelector('iframe', { timeout: 15000 });
    const sandbox = await page.getAttribute('iframe', 'sandbox');
    assert.equal(sandbox, 'allow-scripts', 'GRENS 1: precies een vlag, en dat is deze');

    /* De ouder kan niet bij het document in de cel. Dat is geen keuze van ons
       maar het gevolg van de naamloze herkomst -- en het is meteen het bewijs
       dat die herkomst er echt is. */
    const binnen = await page.evaluate(() => {
      try { return document.querySelector('iframe').contentDocument ? 'wel' : 'niet'; }
      catch (e) { return 'niet'; }
    });
    assert.equal(binnen, 'niet', 'de RTG-pagina komt niet in het document van de derde');

    const frame = page.frames().find(f => /\/appcel\//.test(f.url()));
    assert.ok(frame, 'de cel is geladen');
    await frame.waitForFunction(() => document.getElementById('uit').textContent !== 'bezig', null, { timeout: 15000 });
    await frame.waitForFunction(() => document.getElementById('wie').textContent !== 'bezig', null, { timeout: 15000 });

    assert.equal(await frame.textContent('#uit'), 'stand=42',
      'de brug werkt: de app schreef en las zijn eigen kladblok');
    const wie = await frame.textContent('#wie');
    assert.match(wie, /^geweigerd: /, 'wat het lid niet verleende, komt ook in een browser niet door: ' + wie);
    assert.match(wie, /profiel\.basis/, 'en de app hoort te lezen welke machtiging hij mist');
    assert.equal(await frame.textContent('#ouder'), 'geen toegang tot de ouder',
      'de app komt niet bij het venster erboven');

    // en aan de RTG-kant staat de waarde echt
    const gelezen = await api(base, '/api/appstore/brug',
      { sleutel: 'cel-proef', methode: 'opslag.lees', args: { sleutel: 'stand' } }, lid);
    assert.equal(gelezen.body.uit.waarde, '42');
    assert.deepEqual(fouten, [], 'de celpagina boot zonder onopgevangen fouten');
  } finally {
    if (browser) await browser.close().catch(() => {});
    stop(srv && srv.child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
