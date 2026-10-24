'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { browserOpties, geenBrowser } = require('./helper');
const { laadBrowser } = require('./browser');
const { luister, beoordeelWeigeringen } = require('../scripts/appwerkt');
const pw = laadBrowser();
const poort = { error: 'Hiervoor heb ik nog je paspoortgegevens nodig; dat vraag ik even.', soort: 'vlucht', ontbreekt: [{ veld: 'reisdocument' }] };
const vraag = { id: 'gesprek-1', veld: 'reisdocument', tekst: 'Voor deze vlucht zijn je paspoortnummer, geldigheid en nationaliteit nodig.' };

test('gegevenspoort: alleen een zichtbare, bedienbare en gekoppelde vervolgvraag verklaart de 428', { skip: geenBrowser(pw) }, async t => {
  const browser = await pw.chromium.launch(browserOpties(pw));
  try {
    for (const geval of [
      { naam: 'echte gegevenscomponent met corresponderende vraag', goed: true },
      { naam: 'geen vervolgrespons', geenStart: true },
      { naam: 'andere soort', soort: 'taxi' },
      { naam: 'ander ontbrekend veld', veld: 'telefoon' },
      { naam: 'mislukte start', status: 500 },
      { naam: 'verborgen dialoog', css: '.rp-waas{display:none!important}' },
      { naam: 'onzichtbare dialoog', css: '.rp-waas{opacity:0!important}' },
      { naam: 'verkeerde vraagtekst', tekst: 'Een ongerelateerde vraag' },
      { naam: 'geen bruikbare vervolgknop', css: '.rp-door{display:none!important}' },
      { naam: 'alleen een oude dialoog', oud: true }
    ]) await t.test(geval.naam, async () => {
      const page = await browser.newPage();
      const bak = { crash: [], config: [], serverfout: [], rem: [], weigering: [] }, gezegd = [];
      await page.route('http://meter.test/**', route => {
        const pad = new URL(route.request().url()).pathname;
        if (pad === '/') return route.fulfill({ contentType: 'text/html', body: '<!doctype html><body>Vluchten</body>' });
        const start = pad === '/api/gegevens/start';
        return route.fulfill({ status: start ? (geval.status || 200) : 428, contentType: 'application/json', body: JSON.stringify(start ? { ...vraag, veld: geval.veld || vraag.veld } : poort) });
      });
      await page.goto('http://meter.test/');
      await page.addScriptTag({ content: fs.readFileSync(path.join(__dirname, '../public/shared/poortgesprek.js'), 'utf8') });
      luister(page, 'http://meter.test', bak);
      await page.evaluate(async ({ poort, vraag, geval }) => {
        const call = async (pad, body) => {
          if (geval.geenStart || geval.oud) return vraag;
          return fetch(pad, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, soort: geval.soort || body.soort }) }).then(r => r.json());
        };
        if (geval.oud) RTGGegevensPoort.los(poort, call);
        await fetch('/api/member/vluchten/boek', { method: 'POST' });
        if (!geval.oud) RTGGegevensPoort.los(poort, call);
      }, { poort, vraag, geval });
      await page.locator('.rp-vraag').filter({ hasText: vraag.tekst }).waitFor();
      if (geval.css) await page.addStyleTag({ content: geval.css });
      if (geval.tekst) await page.locator('.rp-vraag').evaluate((el, tekst) => { el.textContent = tekst; }, geval.tekst);
      for (let n = 0; !bak.weigering.length && n < 100; n++) await new Promise(resolve => setTimeout(resolve, 10));
      assert.equal(bak.weigering.length, 1, 'de echte 428-respons is verwerkt vóór beoordeling');
      await beoordeelWeigeringen(page, bak.weigering, gezegd, bak.serverfout);
      assert.equal(gezegd.length, geval.goed ? 1 : 0);
      assert.ok(geval.goed ? bak.serverfout.length === 0 : bak.serverfout.some(s => s.startsWith('428 ')), JSON.stringify(bak));
      await page.close();
    });
  } finally { await browser.close(); }
});
