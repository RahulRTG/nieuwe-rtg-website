/* Browsercomponentproef: bestaande backofficebron en echte beslisroute/kern.
   Kantoorsessie en tenant zijn fixtures; geen live toelating of betaling. */
'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const path = require('node:path'), express = require('../server/web');
const { laadPlaywright, browserOpties, geenBrowser, letOpFouten } = require('./helper');
const pw = laadPlaywright();
test('backoffice vraagt expliciete org en prijs; verkeerde org weigert, menselijke juiste keuze wordt vastgelegd',
  { skip: geenBrowser(pw), timeout: 45000 }, async t => {
    const app = express(), fouten = [], requests = [];
    const db = { data: { tenants: { 'ORG-A': { org: 'ORG-A', actief: true, zaken: [], werkruimtes: [] } } } };
    const a = { id: 'business-1', accountId: 1, pas: 'business', pasNaam: 'Business', naam: 'Fixture Aanvrager', status: 'in behandeling', reis: [] };
    const accounts = { getUserById: id => id === 1 ? { id } : null };
    const { beslis } = require('../server/kern/aanmeldingen/besluit')({ vind: id => id === a.id ? a : null,
      beeld: x => JSON.parse(JSON.stringify(x)), kap: (s, n) => String(s || '').slice(0, n),
      nu: () => new Date().toISOString(), accounts, save() {}, zelfservice: true,
      startBetalingen() { throw Error('Geen betaalstart'); }, PASSEN: { business: { naam: 'Business' } },
      organisatieVoor: require('../server/kern/tenant/lezen')({ db }).haal });
    app.use(express.json());
    app.use((req, res, next) => { if (req.path === '/api/aanmelding/beslis') requests.push(req.body); next(); });
    const auth = (req, res, next) => next();
    require('../server/routes/aanmeldingen')({ app, accounts, auth, officeAuth: auth,
      boardroomWie: () => 'persoon:fixture-beoordelaar', aanmeldingen: { beslis,
        lijst: status => ({ ok: true, aanmeldingen: a.status === status ? [a] : [] }), betalingen: () => ({ aantalLeden: 0 }) } });
    app.use('/bron', express.static(path.join(__dirname, '../public/apps/backoffice')));
    app.get('/', (req, res) => res.type('html').send('<!doctype html><html lang="nl"><head><meta charset="utf-8"><title>Toelatingproef</title></head><body>' +
      '<main id="aanmeldingen"></main><script>' +
      'window.T=(k,v)=>v;window.escHtml=v=>String(v||"").replace(/[&<>"\x27]/g,c=>"&#"+c.charCodeAt(0)+";");' +
      'window.call=async(p,b)=>{let r=await fetch("/api"+p,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(b||{})});let d=await r.json();if(!r.ok)throw Error(d.error);return d;};' +
      '</script><script src="/bron/backoffice-01b.js"></script><script>loadAanmeldingen();</script></body></html>'));
    const server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
    t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
    const browser = await pw.chromium.launch(browserOpties()); t.after(() => browser.close());
    const page = await browser.newPage(); letOpFouten(page, fouten);
    await page.goto('http://127.0.0.1:' + server.address().port, { waitUntil: 'domcontentloaded' });
    await page.locator('[data-organisatie]').fill('ONTBREEKT');
    await page.locator('[data-contract-euro]').fill('7300');
    const dialog = page.waitForEvent('dialog').then(async d => {
      const tekst = d.message(); await d.dismiss(); assert.match(tekst, /bestaande actieve organisatie/);
    });
    await page.locator('[data-ok]').click(); await dialog;
    assert.equal(a.status, 'in behandeling');
    await page.locator('[data-organisatie]').fill('org-a');
    await page.locator('[data-ok]').click();
    await page.waitForFunction(() => document.getElementById('aanmeldingen').textContent.includes('Geen openstaande aanmeldingen'));
    assert.equal(a.besluit.organisatie, 'ORG-A'); assert.equal(a.besluit.door, 'persoon:fixture-beoordelaar');
    assert.equal(a.contract.maandCenten, 730000); assert.equal(requests.length, 2);
    assert.equal(requests[1].organisatie, 'org-a'); assert.equal(requests[1].contractEuro, '7300');
    assert.deepEqual(fouten, []);
  });
