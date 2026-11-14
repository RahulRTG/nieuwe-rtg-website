'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { startServer, stop, laadPlaywright, browserOpties, geenBrowser, letOpFouten } = require('./helper');
const pw = laadPlaywright();

test('werkbord behoudt bediening op DS- en legacy-hosts met één centrale presentatie', { skip: geenBrowser(pw) }, async () => {
  const srv = await startServer({ env: { SMTP_URL: '', RTG_EXTERNE_AI_UIT: '1' } });
  let browser;
  try {
    browser = await pw.chromium.launch(browserOpties(pw));
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', serviceWorkers: 'block' });
    try {
      for (const variant of ['ds','legacy']) {
        const page = await ctx.newPage(), fouten = letOpFouten(page, []), pad = '/__borden-' + variant;
        await page.route('**' + pad, route => route.fulfill({ contentType:'text/html', body:
          '<!doctype html><html lang="nl"' + (variant==='ds'?' data-ds':'') + '><head><meta name="viewport" content="width=device-width,initial-scale=1">' +
          (variant==='ds'?'<link rel="stylesheet" href="/ds/rtg-ds.css">':'') + '</head><body><main id="bord"></main><script src="/shared/borden.js"></script><script>' +
          'window.acties=[];const data={borden:[{id:"b1",naam:"Reis",leden:[],lijsten:[{id:"l1",naam:"Te doen",kaarten:[{id:"k1",titel:"Controleer boeking",notitie:"",due:null,klaar:false,leden:[]}]}]}]};' +
          'BordenUI.mount(document.getElementById("bord"),{laad:async()=>data,doe:async b=>acties.push(b),kanBeheren:()=>false,T:(k,n)=>n});</script></body></html>' }));
        await page.goto(srv.base+pad,{waitUntil:'networkidle'});
        const root=page.locator('#bord'), klaar=page.locator('[data-klaar="k1"]'); await klaar.waitFor(); await klaar.focus();
        const staat=await root.evaluate(el=>({className:el.className,links:document.querySelectorAll('link[href="/ds/rtg-ds.css"]').length,
          breed:document.documentElement.scrollWidth,knoppen:[...el.querySelectorAll('button')].map(b=>{const r=b.getBoundingClientRect();return {w:r.width,h:r.height};}),focus:getComputedStyle(document.activeElement).outlineStyle}));
        assert.match(staat.className,/ds-borden/); assert.equal(staat.links,1); assert.ok(staat.breed<=390,JSON.stringify(staat));
        assert.ok(staat.knoppen.every(m=>m.w>=44&&m.h>=44),JSON.stringify(staat.knoppen)); assert.notEqual(staat.focus,'none');
        await klaar.press('Enter'); await page.waitForFunction(()=>window.acties.length===1);
        assert.deepEqual(await page.evaluate(()=>window.acties[0]),{actie:'kaart-bewerk',id:'b1',kaartId:'k1',klaar:true});
        assert.deepEqual(fouten,[]); await page.close();
      }
    } finally { await ctx.close(); }
  } finally { if(browser) await browser.close(); await stop(srv.child); }
});
