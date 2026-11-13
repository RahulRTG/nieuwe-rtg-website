/* Lokale browsermeting van de bestaande federatieve werktafel, geen release-
   oordeel. Werkelijke HTTP/SQLite; CPU/netwerk/viewport zijn expliciete
   simulatie. Geen route-intercept, fictieve API-body of productinstrumentatie. */
'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const h = require('./helper'), { maakReisketenFixture, goed } = require('./lib/reisketen-fixture');
const { verdeling, waarnemer } = require('./lib/reisketen-prestatiemeter');
const { exactStempel } = require('../scripts/lib/stempel');
const { fingerprint } = require('../scripts/lib/experience/evidence');
const ROOT = path.join(__dirname, '..'), API = '/api/reisbureau/keten';
const PROFIELEN = [
  { id: 'desktop-lokaal', viewport: { width: 1440, height: 900 }, cpu: 1, latency: 0, down: -1, up: -1 },
  { id: 'mobiel-gesimuleerd', viewport: { width: 390, height: 844 }, cpu: 4, latency: 150, down: 1600000 / 8, up: 750000 / 8 }
];
const RONDES = 20, resultaten = [];
let srv, browser, x, map, bronVoor;
const bron = () => ({ stempel: exactStempel({}, { wortel: ROOT }), sha256: fingerprint(ROOT) });
test.before(async () => {
  assert.equal(h.testMotor(), 'chromium', 'de CDP-meetconfiguratie vereist Chromium; geen stille vervanging');
  const pw = h.laadPlaywright({ eigenDriver: false }); assert.ok(pw && pw.chromium, 'echte Chromium verplicht');
  bronVoor = bron(); map = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-reis-prestatie-'));
  srv = await h.startServer({ env: { RTG_DATA_DIR: map, SMTP_URL: '', OFFICE_CODE: 'RTG-OFFICE', RTG_AI_UIT: '1' } });
  x = await maakReisketenFixture(srv.base); browser = await h.startBrowser(pw);
});
test.after(async () => {
  try {
    const bronNa = bron(), out = path.join(ROOT, 'artifacts/experience/reisketen-prestatie.json');
    fs.mkdirSync(path.dirname(out), { recursive: true });
    const pakket = JSON.parse(fs.readFileSync(path.join(ROOT, 'node_modules/playwright/package.json'), 'utf8'));
    const rapport = { instrument: 'test/reisketen-prestatie.e2e.js', gemeten: new Date().toISOString(),
      bronVoor, bronNa, bronGewijzigd: bronVoor?.sha256 !== bronNa.sha256,
      meetdefinities: { verzoekTotAntwoordMs: 'responseEnd − startTime; inclusief browserwachttijd',
        requestTotAntwoordMs: 'responseEnd − requestStart; transport plus server, geen zuivere backendtijd',
        lcpCandidateMs: 'Laatste waargenomen LCP-kandidaat tot koude meetgrens, geen veldpercentiel' },
      omgeving: { node: process.version, playwright: pakket.version, chromium: browser?.version(),
        platform: os.platform(), arch: os.arch(), cpu: os.cpus()[0]?.model, kernen: os.cpus().length, geheugenBytes: os.totalmem() },
      beperkingen: ['Lokale HTTP/SQLite en synthetische accounts/leveranciers; geen externe ketenacceptatie.',
        'Eén koude lading en twintig warme herlezingen per profiel; p99 is bij n=20 het maximum, geen stabiele populatieschatting.',
        'Mobiel is viewport-, CPU- en netwerksimulatie; geen fysiek apparaat, productiebelasting of concurrency-meting.',
        'API-tijd bevat transport en serverwerk; autorisatie- en databasekosten zijn niet afzonderlijk gemeten.',
        'Geen INP: deze korte laboratoriumsessies leveren geen representatieve gebruikspopulatie.',
        'Geen vrijgaveoordeel, normwijziging of Experience-kwalificatie.'], profielen: resultaten };
    fs.writeFileSync(out, JSON.stringify(rapport, null, 2) + '\n');
    console.log('Reisketen prestatieartefact: artifacts/experience/reisketen-prestatie.json; bronGewijzigd=' + rapport.bronGewijzigd);
  } finally {
    if (browser) await browser.close(); if (srv) await h.stop(srv);
    if (map) fs.rmSync(map, { recursive: true, force: true });
  }
});
for (const [index, profiel] of PROFIELEN.entries()) test(profiel.id + ': echte offerte, koude weergave en twintig bronherlezingen', async t => {
  const lid = index ? x.anderLid : x.reiziger;
  let reis = goed(await x.api(API + '/start', { titel: 'Prestatieproef reis', bestemming: 'Ibiza',
    supplierCode: x.bureau.code, idem: 'prestatie-' + index }, lid.token), 'aanvraag').reis;
  reis = goed(await x.api('/api/supplier/reisbureau/keten/offerte', x.offerte(reis), x.bureau.token), 'offerte').reis;
  const verwachting = () => ({ ref: reis.ref, versie: reis.offerte.versie, voorwaarden: reis.offerte.voorwaarden });
  const ctx = await browser.newContext({ viewport: profiel.viewport, isMobile: !!index, hasTouch: !!index,
    deviceScaleFactor: 1, serviceWorkers: 'block', reducedMotion: 'reduce', locale: 'nl-NL' });
  try {
    await ctx.addInitScript(token => { localStorage.setItem('rtg_member_token', token);
      localStorage.setItem('rtg_lang', 'nl'); localStorage.setItem('rtg_cookieinfo_v1', '1'); }, lid.token);
    await ctx.addInitScript(waarnemer, verwachting());
    const p = await ctx.newPage(), fouten = h.letOpFouten(p, []); p.setDefaultTimeout(20000);
    const cdp = await ctx.newCDPSession(p);
    await cdp.send('Performance.enable'); await cdp.send('Network.enable');
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: profiel.cpu });
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: profiel.latency,
      downloadThroughput: profiel.down, uploadThroughput: profiel.up });
    let verzoeken = 0;
    p.on('request', r => { if (new URL(r.url()).pathname === API) { assert.equal(r.method(), 'POST'); verzoeken++; } });
    await p.goto(srv.base + '/apps/reisbureau.html', { waitUntil: 'domcontentloaded' });
    const klaar = async () => { await p.waitForFunction(() => !!window.__reisPrestatie?.klaar); return p.evaluate(() => window.__reisPrestatie.klaar); };
    const koud = await klaar(); assert.equal(verzoeken, 1, 'eerste bronlezing precies eenmaal');
    const kaart = p.locator('[data-reiscontract="' + reis.ref + '"]');
    await kaart.getByRole('button', { name: 'Accepteer deze offerte', exact: true }).scrollIntoViewIfNeeded();
    const bereikbaar = await p.evaluate(() => {
      const b = document.querySelector('#reisKeten [data-keten-actie="akkoord"]'), r = b.getBoundingClientRect();
      return { ms: performance.now(), enabled: !b.disabled, raakvlak: r.height >= 44,
        zichtbaar: r.top >= 0 && r.bottom <= innerHeight,
        onbedekt: document.elementsFromPoint(r.x + r.width / 2, r.y + r.height / 2)[0]?.closest('[data-keten-actie="akkoord"]') === b };
    });
    assert.ok(bereikbaar.enabled && bereikbaar.raakvlak && bereikbaar.zichtbaar && bereikbaar.onbedekt, 'koude offerte is bereikbaar en bruikbaar na scroll');
    const koudePaints = await p.evaluate(() => ({ paints: window.__reisPrestatie.paints,
      lcpCandidateMs: window.__reisPrestatie.lcp, waargenomenTotMs: performance.now() }));
    const monsters = [];
    for (let ronde = 0; ronde < RONDES; ronde++) {
      if (ronde === 10) reis = goed(await x.api('/api/supplier/reisbureau/keten/offerte', x.offerte(reis, {
        idem: 'prestatie-tweede-' + index, voorwaarden: 'Actuele tweede offerte; uitsluitend lokale prestatieproef.'
      }), x.bureau.token), 'nieuwe bronversie').reis;
      await p.evaluate(doel => window.__reisPrestatie.arm(doel), verwachting());
      const antwoord = p.waitForResponse(r => new URL(r.url()).pathname === API);
      await p.locator('[data-keten-actie="ververs"]').click();
      const response = await antwoord; assert.equal(response.status(), 200);
      const body = await response.json(), eigen = body.reizen.find(r => r.ref === reis.ref);
      assert.equal(body.reizen.length, 1); assert.equal(eigen.offerte.hash, reis.offerte.hash);
      const gemeten = await klaar(); assert.equal(gemeten.versie, reis.offerte.versie);
      assert.ok(gemeten.antwoordTotDomFrameMs >= 0); assert.ok(gemeten.requestTotAntwoordMs > 0);
      assert.ok(gemeten.decodedBytes > 0, 'werkelijke ontvangen payload gemeten');
      monsters.push(gemeten);
    }
    assert.equal(verzoeken, 21, 'geen dubbele of achtergrond-bronlezing');
    assert.equal(await kaart.locator('[data-keten-actie="akkoord"]').isDisabled(), false);
    assert.equal(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
    assert.deepEqual(fouten, []);
    const waarnemingen = await p.evaluate(() => ({ ondersteund: window.__reisPrestatie.ondersteund, langeFrames: window.__reisPrestatie.langeFrames }));
    const heap = (await cdp.send('Performance.getMetrics')).metrics.find(m => m.name === 'JSHeapUsedSize');
    const samenvatting = Object.fromEntries(['klikTotDomFrameMs', 'verzoekTotAntwoordMs', 'requestTotAntwoordMs', 'antwoordTotDomFrameMs', 'decodedBytes', 'encodedBytes', 'transferBytes'].map(k => [k, verdeling(monsters.map(m => m[k]))]));
    const uit = { configuratie: { ...profiel, serviceWorkers: 'block', reducedMotion: 'reduce', cache: 'verse context; daarna dezelfde warme pagina',
      netwerkEenheid: 'latency ms; down/up bytes per seconde; -1 is onbeperkt', touch: !!index, isMobile: !!index, deviceScaleFactor: 1, locale: 'nl-NL' },
      koud: { ...koud, documentTotBereikbaarNaScrollMs: bereikbaar.ms, scrollInbegrepen: true, ...koudePaints },
      warm: { samenvatting, monsters, eersteTienOfferteVersie: 1, laatsteTienOfferteVersie: 2 },
      browser: { ...waarnemingen, heapUsedBytes: heap?.value ?? null, cls: { status: 'NIET_GEMETEN' },
        inp: { status: 'NIET_GEMETEN', reden: 'Geen representatieve EventTiming-gebruikssessie; klik→bronrender is niet INP.' } },
      controles: { bronverzoeken: verzoeken, exacteEigenOfferte: true, bronversieWissel: true, actiesBruikbaar: true, horizontaleOverloop: false, browserfouten: fouten.length } };
    resultaten.push(uit); t.diagnostic(JSON.stringify({ profiel: profiel.id, koud: uit.koud, warm: samenvatting, inp: uit.browser.inp }));
  } finally { await ctx.close(); }
});
