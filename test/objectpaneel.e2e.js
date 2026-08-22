/* Schermtoets voor het objectpaneel op RTG Sociaal (LIFE.md fase 2).

   Deze toets bewaakt EEN ding, en het is de reden dat de objectlaag bestaat:
   het scherm kent geen enkele cap bij naam. Wat er in het paneel staat komt van
   de server, en een cap erbij hoort dus een regel in kern/objectlaag/caps.js te
   zijn en niets in dit scherm. Zou het scherm zijn eigen lijst bijhouden, dan
   weten twee plekken dezelfde waarheid -- precies de fout die de personeels-PDA
   had voordat kern/pda/modules.js er kwam (LAT.md regel 4).

   Daarom wordt hier op de GERENDERDE tekst gemeten en niet op de bron: een
   scherm dat de server volgt, toont de cap die de server verzint, ook als het
   die naam nergens kent. Dat is met een cap-naam die alleen in deze toets
   bestaat niet te faken.

   Draait alleen waar een browser beschikbaar is; anders overgeslagen. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, letOpFouten, laadPlaywright, browserOpties, geenBrowser } = require('./helper');
const fs = require('fs');
const os = require('os');
const path = require('path');

const pw = laadPlaywright();

test('het objectpaneel toont wat de server stuurt, en kent zelf geen cap',
  { skip: geenBrowser(pw) }, async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-objpaneel-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    const t = Date.now();
    const api = async (pad, body, tok) => (await fetch(base + pad, {
      method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json' },
        tok ? { Authorization: 'Bearer ' + tok } : {}),
      body: JSON.stringify(body || {})
    })).json();

    const reg = await api('/api/auth/register', { name: 'Paneel Lid', email: 'op' + t + '@e.test',
      phone: '06' + String(t).slice(-8), password: 'geheim123', geboortedatum: '1992-03-03', tier: 'rtg' });
    assert.ok(reg.token, 'registreren hoort een token te geven');

    /* Een groep met een bijeenkomst van vandaag: die haalt de kring van
       /api/sociaal/wereld en krijgt dus de knop "wat kan hier". */
    const g = await api('/api/genootschap/richt-op', { naam: 'Paneelkring', soort: 'besloten' }, reg.token);
    const groepId = (g.groep && g.groep.id) || g.id;
    await api('/api/genootschap/roep-bijeen',
      { groep: groepId, wat: 'Paneelborrel', datum: new Date().toISOString().slice(0, 10), tijd: '20:00' },
      reg.token);

    browser = await pw.chromium.launch(browserOpties(pw));
    const ctx = await browser.newContext({ viewport: { width: 430, height: 932 } });
    await ctx.addInitScript((tok) => {
      try {
        localStorage.setItem('rtg_member_token', tok);
        localStorage.setItem('rtg_lang', 'nl');
        localStorage.setItem('rtg_cookieinfo_v1', '1');
      } catch (e) {}
    }, reg.token);
    const page = await ctx.newPage();
    const fouten = [];
    letOpFouten(page, fouten);

    await page.goto(base + '/apps/sociaal.html', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-obj]', { timeout: 15000 });

    await page.click('[data-obj="event"]');
    await page.waitForSelector('#objpaneel .cap', { timeout: 10000 });

    const beeld = await page.evaluate(() => ({
      titel: (document.getElementById('objtitel').textContent || '').trim(),
      soort: (document.getElementById('objsoort').textContent || '').trim(),
      caps: [...document.querySelectorAll('#objpaneel .cap')].map((a) => ({
        naam: (a.querySelector('b') || {}).textContent || '',
        waarom: (a.querySelector('.waarom') || {}).textContent || '',
        link: a.getAttribute('href')
      })),
      stil: (document.getElementById('objstil').textContent || '').trim()
    }));

    assert.equal(beeld.soort, 'Bijeenkomst');
    assert.equal(beeld.titel, 'Paneelborrel',
      'de titel komt uit het domein; leeg zou de fout uit fase 1 herhalen');
    assert.equal(beeld.stil, '', 'geen enkele bron hoort hier stuk te gaan');

    const namen = beeld.caps.map((c) => c.naam).sort();
    assert.deepEqual(namen, ['De groep erachter', 'Laten weten of u komt', 'U bent gastheer']);
    for (const c of beeld.caps) {
      assert.ok(c.waarom, 'cap "' + c.naam + '" staat op het scherm zonder reden');
      assert.match(c.link, /^\/apps\/[a-z]+\.html/, 'elke cap wijst naar een echte app');
    }

    /* DE KERN VAN DEZE TOETS. Een cap die alleen in deze toets bestaat, hoort
       gewoon op het scherm te komen -- want het scherm kent geen enkele cap bij
       naam en toont wat de server stuurt.

       DE MUTATIE: laat sociaal.html de caps filteren op een eigen lijst, of laat
       het de namen zelf bepalen. Deze toets hoort dan te zakken. */
    await page.click('#objdicht');
    await page.waitForFunction(() => !document.getElementById('objpaneel').open, { timeout: 5000 });

    await page.evaluate(() => {
      const echt = window.fetch;
      window.fetch = async (u, o) => {
        if (String(u).includes('/api/sociaal/object')) {
          return new Response(JSON.stringify({
            ok: true, soort: 'groep', id: 'x', titel: 'Verzonnen ding', over: {},
            caps: [{ id: 'nooitvertoond', naam: 'Iets wat dit scherm niet kent',
              wat: 'x', app: 'Genootschap', link: '/apps/genootschap.html', waarom: 'omdat de server het zegt' }],
            stil: []
          }), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }
        return echt(u, o);
      };
    });
    await page.click('[data-obj="event"]');
    await page.waitForFunction(
      () => (document.getElementById('objtitel').textContent || '').trim() === 'Verzonnen ding',
      { timeout: 10000 });
    const vreemd = await page.evaluate(() => [...document.querySelectorAll('#objpaneel .cap b')]
      .map((b) => b.textContent));
    assert.deepEqual(vreemd, ['Iets wat dit scherm niet kent'],
      'het scherm hoort te tonen wat de server stuurt, ook een cap die het niet kent');

    assert.deepEqual(fouten, [], 'geen enkele scherm-fout op dit pad');
  } finally {
    if (browser) try { await browser.close(); } catch (e) {}
    if (child) try { child.kill('SIGKILL'); } catch (e) {}
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
