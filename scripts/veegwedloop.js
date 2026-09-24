#!/usr/bin/env node
/* DE WEDLOOP VAN DE VEEG, KOUD GEMETEN (EDGE.md par. 11, ronde 2, stap 9).

   WAAROM. veegDoor (test/helper.js) heeft twee wegen: de protocolvlucht naar
   Chromium, en een terugval in de renderer voor als de timer van lang drukken
   (shared/gebaar/gebaar-03b.js) de vlucht heeft opgegeten. Hoe vaak die terugval
   afgaat, telde nergens; de enige aantekening was "ongeveer een op de vijf" van
   voor de reparatie, en het grootste gat tussen neerdrukken en de eerste
   beweging was alleen WARM gemeten (51 ms). Voordat gebaar zijn drempels uit de
   grammatica leest, hoort die koude staart er te liggen: een lang drukken dat van
   520 naar 480 ms gaat, maakt het venster kleiner.

   WAT HIJ DOET, per ronde en alles vers: een server met een eigen lege map, een
   lid met twee bestanden, een nieuwe browser, en dan precies wat
   test/gebaar-bestanden.e2e.js doet -- wachten tot de eerste regel een gebaarregel
   is en meteen vegen via veegDoor. Gemeten in de pagina, op performance.now() in
   de luisteraar zelf (daar loopt ook de timer):

     weg   'vlucht' of 'terugval', zoals veegDoor hem teruggeeft;
     gat   ms tussen de echte pointerdown en de eerste echte pointermove die 8 px
           of meer van het neerdrukpunt ligt (de stilgrens van lang drukken), of
           null als die er niet kwam.

   Met --wijze los meet hij ter vergelijking de OUDE reeks, zoals de vier
   omwegen die in stap 9 door veegDoor zijn gaan: mouse.down() en daarna de
   moves, elk met een eigen protocolronde. Dan is `weg` 'begonnen' of
   'opgegeten' (de laag pakte de eerste beweging wel of niet op), want die reeks
   heeft geen terugval. Begon hij niet, dan staat de oorzaak erachter zoals de
   pagina hem ziet: `timer`, `regel-vervangen`, `geen-regel` of `onbekend`.

   WAT HIJ NIET DOET. Hij schrijft niets weg en stempelt niets: de uitslag is een
   meting op een moment, op deze machine, onder deze belasting (die staat erbij),
   en hoort met graad en datum in een document en niet als register. Het is geen
   toets: hij zakt alleen als een ronde niet kon draaien.

   Draai:  node scripts/veegwedloop.js            (20 rondes)
           node scripts/veegwedloop.js --rondes 5
           node scripts/veegwedloop.js --wijze los   (de oude reeks, ter vergelijking) */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop, veegDoor, laadPlaywright, browserOpties, geenBrowser } = require('../test/helper');

const argv = process.argv.slice(2);
const RONDES = Math.max(1, Number(argv[argv.indexOf('--rondes') + 1]) || 20);
const LOS = argv.includes('--wijze') && argv[argv.indexOf('--wijze') + 1] === 'los';

/* De oude reeks, woord voor woord de vorm van de omwegen: erheen, neer, en dan
   stapjes met elk een eigen ronde naar Chromium. */
async function losseReeks(page, doos) {
  const y = doos.y + doos.height / 2, x0 = doos.x + doos.width * 0.8;
  await page.mouse.move(x0, y);
  await page.mouse.down();
  await page.mouse.move(x0 - 10, y);
  /* Begon het niet, dan zegt de pagina WAAROM, en niet de aanname: de timer
     (de actielade staat open), een regel die tussen neer en bewegen werd
     vervangen, of een neerdruk die niet op een regel viel. */
  const stand = await page.evaluate(() => {
    const w = window.__wedloop, blad = document.querySelector('dialog.gb-blad');
    if (document.querySelector('[data-gb]')) return 'begonnen';
    if (blad && blad.open) return 'opgegeten:timer';
    if (!w.rij) return 'opgegeten:geen-regel';
    return w.rij.isConnected ? 'opgegeten:onbekend' : 'opgegeten:regel-vervangen';
  });
  for (let i = 2; i <= 16; i++) await page.mouse.move(x0 - (112 * i) / 16, y);
  await page.mouse.up();
  return stand;
}

async function ronde(pw, i) {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-veegwedloop-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    const t = Date.now() + i;
    const reg = await (await fetch(base + '/api/auth/register', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Wedloop ' + t, email: 'w' + t + '@v.test', phone: '06' + String(t).slice(-8),
        password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg' })
    })).json();
    if (!reg.token) throw new Error('geen lid: ' + JSON.stringify(reg).slice(0, 120));
    const dataUrl = 'data:text/plain;base64,' + Buffer.from('een klein bestand').toString('base64');
    for (const naam of ['Contract-2026.txt', 'Paspoort-scan.txt']) {
      await fetch(base + '/api/bestanden/upload', { method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + reg.token },
        body: JSON.stringify({ naam, dataUrl }) });
    }
    browser = await pw.chromium.launch(browserOpties(pw));
    const page = await browser.newPage({ viewport: { width: 900, height: 900 } });
    await page.addInitScript((tok) => {
      localStorage.setItem('rtg_member_token', tok);
      localStorage.setItem('rtg_lang', 'nl'); localStorage.setItem('rtg_cookieinfo_v1', '1');
      const w = window.__wedloop = { neer: null, x0: 0, eerste: null };
      document.addEventListener('pointerdown', (e) => {
        if (!e.isTrusted) return;
        w.neer = performance.now(); w.x0 = e.clientX; w.eerste = null;
        w.rij = e.target && e.target.closest ? e.target.closest('.gb-rij') : null;
      }, true);
      document.addEventListener('pointermove', (e) => {
        if (e.isTrusted && w.neer !== null && w.eerste === null && Math.abs(e.clientX - w.x0) >= 8) w.eerste = performance.now();
      }, true);
    }, reg.token);
    await page.goto(base + '/apps/bestanden.html', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#lijst .item.gb-rij', { timeout: 20000 });
    const doos = await page.locator('#lijst .item').first().boundingBox();
    const weg = LOS ? await losseReeks(page, doos) : await veegDoor(page, doos, { afstand: -112, stappen: 16 });
    const m = await page.evaluate(() => ({ neer: window.__wedloop.neer, eerste: window.__wedloop.eerste }));
    const gat = m && m.neer !== null && m.eerste !== null ? Math.round((m.eerste - m.neer) * 10) / 10 : null;
    return { weg, gat };
  } finally {
    if (browser) await browser.close();
    stop(child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
}

async function main() {
  const pw = laadPlaywright();
  const waarom = geenBrowser(pw);
  if (waarom) { console.error('veegwedloop: ' + waarom); process.exitCode = 1; return; }
  const uit = [];
  const last = [];
  for (let i = 0; i < RONDES; i++) {
    last.push(Math.round(os.loadavg()[0] * 100) / 100);
    const r = await ronde(pw, i);
    uit.push(r);
    console.log('ronde ' + (i + 1) + ': ' + r.weg + ', gat ' + (r.gat === null ? 'geen' : r.gat + ' ms'));
  }
  const gaten = uit.map((r) => r.gat).filter((g) => g !== null).sort((a, b) => a - b);
  const kwantiel = (q) => gaten.length ? gaten[Math.min(gaten.length - 1, Math.floor(q * gaten.length))] : null;
  console.log(JSON.stringify({
    datum: new Date().toISOString().slice(0, 10), wijze: LOS ? 'losse reeks' : 'veegDoor', rondes: RONDES,
    wegen: uit.reduce((t, r) => Object.assign(t, { [r.weg]: (t[r.weg] || 0) + 1 }), {}),
    gatMs: { min: gaten[0] ?? null, mediaan: kwantiel(0.5), p90: kwantiel(0.9), max: gaten[gaten.length - 1] ?? null, zonder: RONDES - gaten.length },
    belasting: { kernen: os.cpus().length, loadavg1: { min: Math.min(...last), max: Math.max(...last) } }
  }, null, 2));
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
