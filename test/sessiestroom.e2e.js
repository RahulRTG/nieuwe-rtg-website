/* DE SESSIESTROOM IN EEN ECHTE BROWSER: drie schermen openen hun live-stroom
   met een stroomticket, en GEEN ENKEL verzoek draagt nog een sessie in het
   adres.

   De serverkant staat in test/sessiestroom.test.js. Deze toets gaat over de
   schermen: het lid (de pas-app), de zaak (leverancier.html) en het kantoor
   (backoffice.html). Elk moet eerst POST /api/stroom/ticket doen met de sessie
   in de kop, en daarna de stroom openen met ?ticket=. En over ALLE verzoeken
   die de pagina doet -- ook die van gedeelde lagen (metgezel, clipdeler,
   realtime) -- geldt: er staat geen `token=` in een adres.

   Draai: node --test test/sessiestroom.e2e.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop, laadPlaywright, browserOpties, geenBrowser, kantoorAlsPersoon, pasAppAdres,
  letOpFouten } = require('./helper');

const pw = laadPlaywright();

async function api(base, pad, body, tok) {
  const r = await fetch(base + pad, { method: 'POST',
    headers: Object.assign({ 'content-type': 'application/json' }, tok ? { Authorization: 'Bearer ' + tok } : {}),
    body: JSON.stringify(body || {}) });
  return r.json();
}

test('lid, zaak en kantoor openen hun stroom met een ticket, en geen adres draagt een sessie',
  { skip: geenBrowser(pw), timeout: 240000 }, async () => {
    const srv = await startServer({ env: { SMTP_URL: '' } });
    let browser;
    try {
      const lid = (await api(srv.base, '/api/login', { tier: 'business' })).token;
      const roster = await api(srv.base, '/api/supplier/roster', { code: 'KIKUNOI' });
      const mgr = (roster.staff || []).find(x => x.role === 'manager');
      const zaak = (await api(srv.base, '/api/supplier/login', { code: 'KIKUNOI', staffId: mgr.id, pin: '1234' })).token;
      const kantoor = await kantoorAlsPersoon(srv.base);
      assert.ok(lid && zaak && kantoor, 'een lid, een zaak en een kantoormens staan klaar');

      browser = await pw.chromium.launch(browserOpties(pw));
      const schermen = [
        { naam: 'lid', adres: await pasAppAdres(srv.base, lid), sleutel: 'rtg_member_token', token: lid, stroom: '/api/stream' },
        { naam: 'zaak', adres: srv.base + '/apps/leverancier.html', sleutel: 'rtg_sup_token', token: zaak, stroom: '/api/supplier/stream' },
        { naam: 'kantoor', adres: srv.base + '/apps/backoffice.html', sleutel: 'rtg_office_token', token: kantoor, stroom: '/api/office/stream' }
      ];
      for (const s of schermen) {
        const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
        await ctx.addInitScript(([k, v]) => { try { localStorage.setItem(k, v); } catch (e) {} }, [s.sleutel, s.token]);
        const page = await ctx.newPage();
        const fouten = []; letOpFouten(page, fouten);
        const adressen = [];
        page.on('request', r => adressen.push(r.url()));
        const ticket = page.waitForRequest(r => r.url().endsWith('/api/stroom/ticket') && r.method() === 'POST', { timeout: 60000 });
        const stroom = page.waitForResponse(r => r.url().includes(s.stroom + '?ticket=ST.'), { timeout: 60000 });
        await page.goto(s.adres, { waitUntil: 'domcontentloaded' });
        const vraag = await ticket;
        assert.equal(vraag.headers()['authorization'], 'Bearer ' + s.token, s.naam + ': de sessie gaat in de kop naar de ruilplek');
        const antwoord = await stroom;
        assert.equal(antwoord.status(), 200, s.naam + ': de stroom opent met het ticket');
        const lek = adressen.filter(u => /[?&][A-Za-z]*[tT]oken=/.test(u) || u.includes(encodeURIComponent(s.token)) || u.includes(s.token));
        assert.deepEqual(lek, [], s.naam + ': geen enkel adres draagt een sessie');
        assert.deepEqual(fouten, [], s.naam + ': geen paginafouten');
        await ctx.close();
      }
    } finally {
      if (browser) await browser.close();
      await stop(srv);
    }
  });
