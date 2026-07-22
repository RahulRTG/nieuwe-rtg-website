/* Onze eigen browser-driver in Playwright-vorm, i.p.v. het pakket 'playwright'.
   Precies de API die onze scherm-tests (test/*.e2e.js) en de toegankelijkheids-
   scan (scripts/a11y.js) gebruiken: chromium.launch -> browser -> context ->
   page -> locator. Onder water: CDP over de pipe-transport (server/lib/cdp.js)
   en een in-pagina helper (server/lib/browser-inpage.js) voor selectors, klik
   en typen. Geen dependency; draait waar een Chromium-binary staat.

   Bewust NIET compleet Playwright: alleen de gebruikte methoden, met dezelfde
   namen en semantiek, zodat de tests ongewijzigd draaien. */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const cdp = require('./cdp');
const { BRON } = require('./browser-inpage');
// de Page- en Locator-klassen staan apart, in ./browser-page.js
const { Page, Locator } = require('./browser-page');

const slaap = (ms) => new Promise((r) => setTimeout(r, ms));

async function maakPage(conn, browserContextId, context) {
  const t = await conn.stuur('Target.createTarget', browserContextId ? { url: 'about:blank', browserContextId } : { url: 'about:blank' });
  const att = await conn.stuur('Target.attachToTarget', { targetId: t.targetId, flatten: true });
  const sessionId = att.sessionId;
  const page = new Page(conn, sessionId, t.targetId, context);
  await conn.stuur('Page.enable', {}, sessionId);
  await conn.stuur('Runtime.enable', {}, sessionId);
  await conn.stuur('Page.addScriptToEvaluateOnNewDocument', { source: BRON }, sessionId);
  return page;
}

class Context {
  constructor(browser, browserContextId) { this.browser = browser; this.id = browserContextId; this._pages = []; }
  async newPage() { const p = await maakPage(this.browser.conn, this.id, this); this._pages.push(p); return p; }
  async setOffline(offline) { for (const p of this._pages) await p.setOfflineIntern(offline); }
  async close() { if (this.id) { try { await this.browser.conn.stuur('Target.disposeBrowserContext', { browserContextId: this.id }); } catch (e) {} } }
}

class Browser {
  constructor(conn, profielDir) { this.conn = conn; this.profielDir = profielDir; this._default = new Context(this, null); }
  async newContext() { const r = await this.conn.stuur('Target.createBrowserContext', { disposeOnDetach: true }); return new Context(this, r.browserContextId); }
  async newPage() { return this._default.newPage(); }
  async close() {
    try { await this.conn.stuur('Browser.close', {}); } catch (e) {}
    this.conn.sluit();
    try { fs.rmSync(this.profielDir, { recursive: true, force: true }); } catch (e) {}
  }
}

const chromium = {
  async launch(opts = {}) {
    const bin = cdp.vindBrowser();
    if (!bin) throw new Error('geen Chromium-binary gevonden (zet RTG_CHROMIUM of PLAYWRIGHT_BROWSERS_PATH)');
    const profielDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-cdp-'));
    const conn = cdp.start(bin, opts.args || [], profielDir);
    // wacht tot de transport echt praat (eerste commando slaagt)
    const eind = Date.now() + 15000;
    for (;;) {
      try { await conn.stuur('Browser.getVersion', {}); break; }
      catch (e) { if (Date.now() > eind) { conn.sluit(); throw new Error('Chromium startte niet: ' + e.message); } await slaap(100); }
    }
    return new Browser(conn, profielDir);
  }
};

function beschikbaar() { return !!cdp.vindBrowser(); }

module.exports = { chromium, beschikbaar, Browser, Context, Page, Locator };
