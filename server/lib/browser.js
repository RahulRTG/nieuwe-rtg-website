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

const S = (v) => JSON.stringify(v);
const slaap = (ms) => new Promise((r) => setTimeout(r, ms));

function globNaarRe(glob) {
  const esc = String(glob).replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*+/g, '.*');
  return new RegExp('^' + esc + '$');
}

class Locator {
  constructor(page, sel, index) { this.page = page; this.sel = sel; this.index = index == null ? null : index; }
  first() { return new Locator(this.page, this.sel, 0); }
  locator(sub) { return new Locator(this.page, this.sel + ' ' + sub, this.index); }
  _pak() { return `(function(){var a=__rtgdrv.zoekAlle(${S(this.sel)});return a[${this.index || 0}]||null;})()`; }
  count() { return this.page._eval(`__rtgdrv.zoekAlle(${S(this.sel)}).length`); }
  textContent() { return this.page._eval(`(function(){var el=${this._pak()};return el?el.textContent:null;})()`); }
  async click() { await this.page._eval(`(function(){var el=${this._pak()};__rtgdrv.klik(el);return true;})()`); }
  async waitFor(opts) {
    const t = (opts && opts.timeout) || 15000;
    await this.page._wachtTot(`(function(){var el=${this._pak()};return !!el&&__rtgdrv.zichtbaar(el);})()`, t);
  }
}

class Page {
  constructor(conn, sessionId, targetId, context) {
    this.conn = conn; this.sessionId = sessionId; this.targetId = targetId; this.context = context;
    this._errCbs = [];
    this._routes = [];
    this._fetchAan = false;
    conn.on('sessie:' + sessionId, (m) => {
      if (m.method === 'Runtime.exceptionThrown') {
        const d = m.params.exceptionDetails || {};
        const msg = (d.exception && (d.exception.description || d.exception.value)) || d.text || 'pagina-fout';
        for (const cb of this._errCbs) { try { cb({ message: String(msg) }); } catch (e) {} }
      } else if (m.method === 'Fetch.requestPaused') {
        this._opVerzoek(m.params);
      }
    });
  }
  on(gebeurtenis, cb) { if (gebeurtenis === 'pageerror') this._errCbs.push(cb); return this; }
  async _eval(expr) {
    const r = await this.conn.stuur('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true, userGesture: true }, this.sessionId);
    if (r.exceptionDetails) {
      const d = r.exceptionDetails;
      throw new Error('evaluate: ' + ((d.exception && (d.exception.description || d.exception.value)) || d.text));
    }
    return r.result ? r.result.value : undefined;
  }
  async _wachtTot(expr, timeout = 15000, interval = 50) {
    const eind = Date.now() + timeout;
    for (;;) {
      let ok = false;
      try { ok = await this._eval(expr); } catch (e) { ok = false; }
      if (ok) return true;
      if (Date.now() > eind) throw new Error('time-out (' + timeout + 'ms) bij: ' + expr.slice(0, 120));
      await slaap(interval);
    }
  }
  _fnExpr(fn, arg) {
    if (typeof fn === 'string') return fn;
    const argsList = arguments.length > 2 ? Array.prototype.slice.call(arguments, 1) : (arg === undefined ? [] : [arg]);
    return '(' + fn.toString() + ')(' + argsList.map((a) => S(a)).join(',') + ')';
  }
  async evaluate(fn, ...args) { return this._eval(this._fnExpr(fn, ...args)); }
  async addInitScript(fn, arg) {
    const src = typeof fn === 'string' ? fn : '(' + fn.toString() + ')(' + (arg === undefined ? '' : S(arg)) + ')';
    await this.conn.stuur('Page.addScriptToEvaluateOnNewDocument', { source: src }, this.sessionId);
  }
  async addScriptTag({ content }) { await this._eval(String(content)); }
  async goto(url, opts) {
    const waitUntil = (opts && opts.waitUntil) || 'load';
    const gebeurtenis = waitUntil === 'domcontentloaded' ? 'Page.domContentEventFired' : 'Page.loadEventFired';
    const klaar = new Promise((res) => {
      const h = (m) => { if (m.method === gebeurtenis) { this.conn.off('sessie:' + this.sessionId, h); res(); } };
      this.conn.on('sessie:' + this.sessionId, h);
      setTimeout(() => { this.conn.off('sessie:' + this.sessionId, h); res(); }, 30000);
    });
    await this.conn.stuur('Page.navigate', { url }, this.sessionId);
    await klaar;
  }
  async waitForSelector(sel, opts = {}) {
    const state = opts.state || 'visible';
    const timeout = opts.timeout || 15000;
    let expr;
    if (state === 'hidden') expr = `(function(){var el=__rtgdrv.zoek(${S(sel)});return !el||!__rtgdrv.zichtbaar(el);})()`;
    else if (state === 'attached') expr = `!!__rtgdrv.zoek(${S(sel)})`;
    else expr = `(function(){var el=__rtgdrv.zoek(${S(sel)});return !!el&&__rtgdrv.zichtbaar(el);})()`;
    await this._wachtTot(expr, timeout);
    return true;
  }
  async waitForFunction(fn, arg, opts = {}) { await this._wachtTot(this._fnExpr(fn, arg), opts.timeout || 15000); }
  async waitForTimeout(ms) { await slaap(ms); }
  locator(sel) { return new Locator(this, sel); }
  async click(sel) { await this._eval(`(function(){var el=__rtgdrv.zoek(${S(sel)});if(!el)throw new Error('klik: niet gevonden '+${S(sel)});__rtgdrv.klik(el);return true;})()`); }
  async fill(sel, waarde) { await this._eval(`(function(){var el=__rtgdrv.zoek(${S(sel)});if(!el)throw new Error('vul: niet gevonden '+${S(sel)});__rtgdrv.vul(el,${S(waarde)});return true;})()`); }
  textContent(sel) { return this._eval(`(function(){var el=__rtgdrv.zoek(${S(sel)});return el?el.textContent:null;})()`); }
  getAttribute(sel, attr) { return this._eval(`(function(){var el=__rtgdrv.zoek(${S(sel)});return el?el.getAttribute(${S(attr)}):null;})()`); }
  async route(glob, handler) {
    this._routes.push({ re: globNaarRe(glob), handler });
    if (!this._fetchAan) { this._fetchAan = true; await this.conn.stuur('Fetch.enable', {}, this.sessionId); }
  }
  async _opVerzoek(p) {
    const url = p.request.url;
    const r = this._routes.find((x) => x.re.test(url));
    const req = p.requestId;
    if (!r) { try { await this.conn.stuur('Fetch.continueRequest', { requestId: req }, this.sessionId); } catch (e) {} return; }
    const route = {
      fulfill: async (resp) => {
        const body = resp.body != null ? Buffer.from(String(resp.body)).toString('base64') : undefined;
        await this.conn.stuur('Fetch.fulfillRequest', {
          requestId: req, responseCode: resp.status || 200,
          responseHeaders: [{ name: 'Content-Type', value: resp.contentType || 'text/plain' }], body
        }, this.sessionId);
      },
      continue: async () => { await this.conn.stuur('Fetch.continueRequest', { requestId: req }, this.sessionId); },
      abort: async () => { await this.conn.stuur('Fetch.failRequest', { requestId: req, errorReason: 'Aborted' }, this.sessionId); }
    };
    try { await r.handler(route); } catch (e) { try { await route.continue(); } catch (er) {} }
  }
  async setOfflineIntern(offline) {
    await this.conn.stuur('Network.enable', {}, this.sessionId);
    await this.conn.stuur('Network.emulateNetworkConditions', {
      offline: !!offline, latency: 0, downloadThroughput: -1, uploadThroughput: -1
    }, this.sessionId);
  }
}

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
