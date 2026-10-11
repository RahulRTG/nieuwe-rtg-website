/* EEN FOTO IN EEN PSEUDO-ELEMENT STOPT DE CONTRASTMETING, NET ALS BIJ EEN ELEMENT.

   De hero's van de werelden leggen hun foto in `::before` en een waas in
   `::after`, met de tekst erboven. pseudoLagen() gaf voor de `url()`-laag null
   terug, en null betekent bij gronden() "geen laag": de meting liep door naar de
   body. Met de www-pariteit werd die body ivoor, en toen meldde de keuring de
   lichte titel op een donkere foto als 1,02:1. De meting is daar niet te doen
   zonder pixels, en dan zegt de keuring dat eerlijk in plaats van een grond te
   verzinnen.

   Twee kanten, want een toets die alleen het vals alarm wegneemt, bewijst niet
   dat de keuring nog meet: dezelfde opstelling met alleen een verloop in de
   pseudo (geen foto) blijft gemeld.

   Draait alleen waar een browser is. Los: node --test test/contrastfoto.e2e.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop, laadPlaywright, browserOpties, geenBrowser, wachtOpNetstilte } = require('./helper');
const { BRON } = require('../scripts/a11ykeuring');

const pw = laadPlaywright();
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-contrastfoto-'));
const KEUR = '(function(){' + BRON + '\nreturn window.__a11yKeur()})()';

test('lichte tekst op een foto in ::before wordt niet tegen de grond erachter gemeten',
  { skip: geenBrowser(pw) }, async () => {
  const srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    browser = await pw.chromium.launch(browserOpties(pw));
    const ctx = await browser.newContext({ serviceWorkers: 'block' });
    await ctx.addInitScript(() => { try { localStorage.setItem('rtg_cookieinfo_v1', '1'); } catch (e) {} });
    const page = await ctx.newPage();
    // Hetzelfde schone meetscherm als test/contrastcontext.e2e.js.
    await page.goto(srv.base + '/site/404.html', { waitUntil: 'domcontentloaded' });
    await wachtOpNetstilte(page);
    const schoon = await page.evaluate(KEUR);
    assert.equal(schoon.contrast.reduce((n, v) => n + v.aantal, 0), 0, 'het meetscherm is zelf niet schoon');

    /* Een inline <style> weigert de CSP; een regel via het CSSOM in een
       stijlblad van dezelfde herkomst niet. De foto bestaat niet: wat telt is
       dat het een url() is, niet of hij laadt. */
    const meet = (beeld) => page.evaluate((beeld) => {
      document.querySelectorAll('.fotoproef').forEach(x => x.remove());
      const blad = Array.from(document.styleSheets).find(s => { try { return !!s.cssRules; } catch (e) { return false; } });
      while (blad.cssRules.length && /fotoproef/.test(blad.cssRules[blad.cssRules.length - 1].cssText)) blad.deleteRule(blad.cssRules.length - 1);
      const n = blad.cssRules.length;
      blad.insertRule('.fotoproef{position:fixed;top:150px;left:30px;z-index:9999;padding:20px;width:420px}', n);
      blad.insertRule('.fotoproef::before{content:"";position:absolute;inset:0;background:' + beeld + '}', n + 1);
      blad.insertRule('.fotoproef::after{content:"";position:absolute;inset:0;background:linear-gradient(rgba(10,8,6,.15),rgb(241,238,231))}', n + 2);
      blad.insertRule('.fotoproef p{position:relative;z-index:1}', n + 3);
      document.body.style.background = '#f1eee7';
      const vak = document.createElement('div');
      vak.className = 'fotoproef';
      const regel = document.createElement('p');
      regel.id = 'fotoregel';
      regel.style.color = '#f7f0e3';
      regel.style.fontSize = '14px';
      regel.textContent = 'Lichte tekst op de foto';
      vak.appendChild(regel);
      document.body.appendChild(vak);
    }, beeld).then(() => page.evaluate(KEUR))
      .then(uit => uit.contrast.map(v => v.waar.join(' ')).join(' '));

    assert.doesNotMatch(await meet('url("/images/bestaat-niet.jpg") center/cover'), /#fotoregel/,
      'een foto in ::before telde als geen laag: de tekst werd tegen de body gemeten');
    assert.match(await meet('linear-gradient(rgb(241,238,231),rgb(241,238,231))'), /#fotoregel/,
      'zonder foto hoort dezelfde lichte tekst op ivoor gemeld te worden; dan meet de keuring niet meer');
  } finally {
    if (browser) await browser.close().catch(() => {});
    await stop(srv);
  }
});
