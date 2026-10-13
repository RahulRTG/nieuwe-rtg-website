/* PROEF (niet mergen): welk mechanisme laat WebKit vallen bij het wisselen van scherm?
   Drie armen, zelfde elf schermen, zelfde server:
   A  zoals reisschermen nu: een pagina, per scherm twee keer goto, na domcontentloaded + rust
   B  verse pagina per scherm (init-script zet de opslag), een goto, rust, sluiten
   C  zoals A, maar eerst naar about:blank en wachten tot die er staat
   Per arm: aantal navigatiefouten en paginafouten, met stack en het scherm. */
'use strict';
const { startServer, laadPlaywright, volgVerzoeken, wachtOpRust } = require('./test/helper');
const fs = require('fs'), os = require('os'), path = require('path');
const pw = laadPlaywright();
const APPS = ['ov','vluchten','reisbureau','hotels','uitgaan','sport','muziek','theater','zaal','residentie','navigatie'];
const RONDES = Number(process.env.RONDES || 6);

(async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-proef-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  const u = Date.now().toString().slice(-8) + '11';
  const reg = await fetch(base + '/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Reiziger', email: 'rz' + u + '@x.nl', phone: '06' + u.slice(0, 8), password: 'geheim12345', geboortedatum: '1988-08-08', tier: 'rtg' }) }).then(r => r.json());
  const token = reg.token;
  const browser = await pw.webkit.launch({});
  const uitslag = {};
  const zet = t => { localStorage.setItem('rtg_cookieinfo_v1','1'); localStorage.setItem('rtg_lang','nl'); localStorage.setItem('rtg_member_token', t); };
  for (const arm of String(process.env.ARMEN || 'A,B,C').split(',')) {
    const u = uitslag[arm] = { nav: [], pagina: [], schermen: 0 };
    for (let r = 0; r < RONDES; r++) {
      const ctx = await browser.newContext({ serviceWorkers: 'block' });
      if (arm === 'B') await ctx.addInitScript(zet, token);
      let page = null, huidig = '';
      const nieuw = async () => {
        const p = await ctx.newPage(); await volgVerzoeken(p);
        p.on('pageerror', e => u.pagina.push(huidig + ' :: ' + e.message + ' :: ' + String(e.stack || '').split('\n').slice(0, 3).join(' | ')));
        return p;
      };
      if (arm !== 'B') page = await nieuw();
      for (const app of APPS) {
        huidig = app; u.schermen++;
        const url = base + '/apps/' + app + '.html';
        try {
          if (arm === 'B') {
            page = await nieuw();
            await page.goto(url, { waitUntil: 'domcontentloaded' });
            await wachtOpRust(page);
            await page.close();
          } else {
            if (arm === 'C') await page.goto('about:blank');
            await page.goto(url, { waitUntil: 'domcontentloaded' });
            await page.evaluate(zet, token);
            if (arm === 'C') await page.goto('about:blank');
            await page.goto(url, { waitUntil: 'domcontentloaded' });
            await wachtOpRust(page);
          }
        } catch (e) {
          u.nav.push(app + ' :: ' + String(e.message).split('\n')[0]);
          try { await page.close(); } catch (x) {}
          if (arm !== 'B') page = await nieuw();
        }
      }
      await ctx.close();
    }
    console.log('ARM ' + arm + ': ' + u.schermen + ' schermen, ' + u.nav.length + ' navigatiefouten, ' + u.pagina.length + ' paginafouten');
    for (const x of u.nav) console.log('  nav   ' + x);
    for (const x of u.pagina) console.log('  pagina ' + x);
  }
  await browser.close(); child.kill();
  console.log('=== UITSLAG ' + JSON.stringify(Object.fromEntries(Object.entries(uitslag).map(([k, v]) => [k, { schermen: v.schermen, nav: v.nav.length, pagina: v.pagina.length }]))));
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
