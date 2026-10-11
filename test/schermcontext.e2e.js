/* AGENDA EN NOTITIES ZEGGEN ZELF WAAR JE BENT (EDGE.md besluit 11).

   Beide schermen wijzen een eigen hoofdactie aan en stonden daarom op
   CONTEXT_SCHULD in scripts/edgedekking.js. Nu publiceren ze hun context zelf.
   Wat alleen een echte browser laat zien:

   1. LOS: het blikveld leest context met herkomst `scherm`, de bron van het
      scherm en zijn naam (de documenttitel); de hoofdactie blijft die van het scherm.
   2. IN DE SCHIL: als blad reist die context via adaptief/brug.js naar de schil,
      met herkomst `blad` -- en dat is precies wat Rahul daar leest.
   3. GEEN KNOP VERZONNEN: het scherm publiceert geen handelingen, dus het
      blikveld meldt er ook geen die van dit scherm komen.

   DE MUTATIES, nagetrokken: haal context.js uit agenda.html (1 zakt: herkomst
   `document`), of brug.js (2 zakt: de schil blijft op de titel van de schil).

   Draait alleen waar Playwright beschikbaar is; anders overgeslagen. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop, letOpFouten, laadPlaywright, browserOpties, geenBrowser } = require('./helper');
const fs = require('fs');
const os = require('os');
const path = require('path');

const pw = laadPlaywright();

async function lid(base) {
  const u = Date.now().toString(36);
  const r = await fetch(base + '/api/auth/register', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Schermcontext Proef', email: 'schermctx' + u + '@voorbeeld.test',
      password: 'geheim12345', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' })
  }).then((x) => x.json());
  assert.ok(r.token, 'registratie hoort een token te geven');
  const status = await fetch(base + '/api/onboarding/status', { method: 'POST',
    headers: { Authorization: 'Bearer ' + r.token } }).then((x) => x.json());
  const t = await fetch(base + '/api/onboarding/teken', { method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + r.token },
    body: JSON.stringify({ naam: 'Schermcontext Proef', akkoord: true, contractVersion: status.contract.versie }) });
  assert.equal(t.status, 200);
  return r.token;
}

test('agenda en notities publiceren hun context zelf, los en als blad in de schil', { skip: geenBrowser(pw) }, async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-schermctx-'));
  const srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: dataDir } });
  const browser = await pw.chromium.launch(browserOpties(pw));
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true,
    serviceWorkers: 'block', locale: 'nl-NL' });
  const page = await ctx.newPage();
  const fouten = [];
  letOpFouten(page, fouten);
  try {
    const token = await lid(srv.base);
    await page.addInitScript((t) => {
      localStorage.setItem('rtg_member_token', t); localStorage.setItem('rtg_cookieinfo_v1', '1');
    }, token);

    // 1) Los: herkomst scherm, de eigen bron en de naam van het scherm.
    for (const [scherm, bron] of [['agenda', 'agenda'], ['notities', 'notities']]) {
      await page.goto(srv.base + '/apps/' + scherm + '.html', { waitUntil: 'domcontentloaded', timeout: 45000 });
      await page.waitForFunction(() => !!window.RTGEdgeBlikveld && !!window.RTGAdaptief, null, { timeout: 20000 });
      const v = await page.evaluate(() => ({ c: RTGEdgeBlikveld.lees().velden.context,
        h: RTGEdgeBlikveld.lees().velden.hoofdactie, kop: document.title,
        acties: RTGAdaptief.context().acties }));
      assert.equal(v.c.herkomst, 'scherm', scherm + ': ' + JSON.stringify(v.c));
      assert.equal(v.c.waarde.bron, bron);
      assert.equal(v.c.waarde.titel, v.kop, scherm + ': de titel is de naam van het scherm');
      assert.equal(v.h.herkomst, 'scherm:data-hoofdactie', scherm + ': de hoofdactie blijft van het scherm');
      assert.deepEqual(v.acties, [], scherm + ': het scherm verzint geen handelingen');
    }

    // 2) In de schil: de context van het agendablad komt via de brug aan.
    await page.goto(srv.base + '/apps/app.html?pas=rtg', { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForSelector('#rtgCommand[data-stand="open"] .cmd-leeg', { timeout: 20000 });
    await page.waitForFunction(() => !!window.RTGEdgeBlikveld, null, { timeout: 20000 });
    await page.waitForFunction(() => !!window.RTGCommand && typeof RTGCommand.open === 'function', null, { timeout: 20000 });
    await page.evaluate(() => RTGCommand.open('/apps/agenda.html'));
    await page.waitForFunction(() => { const c = RTGEdgeBlikveld.lees().velden.context;
      return c.herkomst === 'blad' && c.waarde && c.waarde.bron === 'agenda'; }, null, { timeout: 20000 });
    const s = await page.evaluate(() => RTGEdgeBlikveld.lees().velden);
    const blad = page.frames().find((f) => /\/apps\/agenda\.html/.test(f.url()));
    const kop = await blad.evaluate(() => document.title);
    assert.equal(s.context.waarde.titel, kop, 'de schil ziet de naam van het agendablad');
    assert.deepEqual(fouten, []);
  } finally {
    await browser.close();
    await stop(srv);
  }
});
