'use strict';
/* RTG VRIJHEID IN EEN ECHTE BROWSER (VRIJHEID.md): de tab Mijn tijd in de
   personeelsapp en de kaart Tijd van het team in het Kantoor.

   Wat dit bewijst dat test/vrijheid-routes.test.js niet kan: dat de schermen
   in hun bundel BEREIKBAAR zijn. Dat is geen formaliteit -- de eerste versie
   van beide delen sorteerde midden in een functie van een ander deel, zodat
   laadTijd en laadTijdKaart binnen die functie woonden en openTab ze niet zag.
   De bundel bouwde, de syntaxis klopte, en het scherm bleef leeg. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop, letOpFouten, laadPlaywright, browserOpties, geenBrowser } = require('./helper');

const pw = laadPlaywright();
const api = (base, p, b) => fetch(base + p, { method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(b || {}) }).then(r => r.json());

test('Mijn tijd en Tijd van het team: bereikbaar, eerlijk over wat ontbreekt, en een besluit gaat naar de server',
  { timeout: 180000, skip: geenBrowser(pw) }, async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-vrijheidscherm-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    const rooster = await api(base, '/api/supplier/roster', { code: 'KIKUNOI' });
    const mw = rooster.staff.find(x => x.role === 'staff'), baas = rooster.staff.find(x => x.role === 'manager');
    const lMw = await api(base, '/api/supplier/login', { code: 'KIKUNOI', staffId: mw.id, pin: '5678' });
    const lBaas = await api(base, '/api/supplier/login', { code: 'KIKUNOI', staffId: baas.id, pin: '1234' });
    assert.ok(lMw.token && lBaas.token);
    browser = await pw.chromium.launch(browserOpties(pw));
    const fouten = [];

    /* ---- de medewerker ---- */
    const p = await browser.newPage({ viewport: { width: 420, height: 900 } });
    letOpFouten(p, fouten);
    await p.addInitScript(t => { localStorage.setItem('rtg_pda_token', t); localStorage.setItem('rtg_pda_code', 'KIKUNOI');
      localStorage.setItem('rtg_lang', 'nl'); localStorage.setItem('rtg_cookieinfo_v1', '1'); }, lMw.token);
    await p.goto(base + '/apps/personeel.html', { waitUntil: 'domcontentloaded' });
    await p.waitForFunction(() => window.RTGTeamRoomBrug && window.RTGTeamRoomBrug.snapshot(), null, { timeout: 20000 });
    /* De Team Room is de ingang, en de weg is die van een mens: het eigen
       profiel en daar Mijn tijd. RTGTeamRoomBrug.open() rechtstreeks aanroepen
       werkt maar even -- de Team Room weet dan niet dat iemand diep ging, en
       zet zich bij de volgende stand weer neer. */
    await p.waitForSelector('[data-trm-profiel]', { state: 'visible', timeout: 20000 });
    await p.click('[data-trm-profiel]');
    await p.click('[data-trm-diep="tijd"]');
    await p.waitForSelector('#tijdDatum', { state: 'visible', timeout: 15000 });
    const eerst = await p.textContent('#tijdWrap');
    assert.match(eerst, /Vakantie: niet bekend/, 'een onbekend saldo is geen nul');
    assert.match(eerst, /Wat het systeem niet weet/);
    const datum = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
    await p.fill('#tijdDatum', datum);
    await p.click('#tijdGo');
    await p.waitForFunction(d => /Je verzoeken/.test(document.getElementById('tijdWrap').textContent) &&
      document.getElementById('tijdWrap').textContent.includes(d), datum, { timeout: 15000 });
    assert.match(await p.textContent('#tijdWrap'), /niet gelukt/, 'zonder dienstverband zegt het verzoek dat het niet lukte');
    assert.match(await p.textContent('#tijdWrap'), /geen dienstverband/, 'en waarom');

    /* ---- de leidinggevende ---- */
    const k = await browser.newPage({ viewport: { width: 1300, height: 1000 } });
    letOpFouten(k, fouten);
    await k.addInitScript(t => { localStorage.setItem('rtg_sup_token', t); localStorage.setItem('rtg_sup_station', 'kantoor');
      localStorage.setItem('rtg_lang', 'nl'); localStorage.setItem('rtg_cookieinfo_v1', '1'); }, lBaas.token);
    await k.goto(base + '/apps/leverancier.html', { waitUntil: 'domcontentloaded' });
    await k.waitForSelector('[data-ksec="hr"]', { state: 'visible', timeout: 20000 });
    await k.click('[data-ksec="hr"]');
    await k.waitForSelector('#tijdEisPlus', { state: 'visible', timeout: 15000 });
    assert.match(await k.textContent('#tijdKaart'), /Nog geen bezetting vastgelegd/);
    await k.selectOption('#tijdDag', '3');
    await k.fill('#tijdMin', '2');
    await k.click('#tijdEisPlus');
    await k.click('#tijdEisBewaar');
    await k.waitForFunction(() => /wo 09:00 tot 17:00/.test(document.getElementById('tijdKaart').textContent) &&
      !/Nog geen bezetting/.test(document.getElementById('tijdKaart').textContent), null, { timeout: 15000 });
    const o = await fetch(base + '/api/supplier/tijd/overzicht', { method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + lBaas.token }, body: '{}' }).then(r => r.json());
    assert.deepEqual(o.eisen.map(e => [e.weekdag, e.minBezetting]), [[3, 2]], 'de bezetting staat op de server, niet alleen op het scherm');

    assert.deepEqual(fouten, [], 'geen JS-fouten: ' + fouten.join(' | '));
  } finally {
    if (browser) await browser.close();
    stop(child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) { /* opruimen mag falen */ }
  }
});
