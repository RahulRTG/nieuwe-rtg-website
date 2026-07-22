/* Browser-driver, deel "pagina": de Page- en Locator-klassen in Playwright-vorm.
   Precies de methoden die onze scherm-tests (test/*.e2e.js) en de a11y-scan
   gebruiken: navigeren, wachten, selecteren, klikken, typen, evalueren en het
   onderscheppen van verzoeken (route). Werkt via CDP op de meegegeven sessie.
   Afgesplitst uit browser.js zodat elk deel klein blijft. */
'use strict';

const S = (v) => JSON.stringify(v);
const slaap = (ms) => new Promise((r) => setTimeout(r, ms));

function globNaarRe(glob) {
  const esc = String(glob).replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*+/g, '.*');
  return new RegExp('^' + esc + '$');
}

class Locator {
  constructor(page, sel, index) { this.page = page; this.sel = sel; this.index = index == null ? 0 : index; }
  first() { return new Locator(this.page, this.sel, 0); }
  locator(sub) { return new Locator(this.page, this.sel + ' ' + sub, this.index); }
  count() { return this.page._roep('function(sel){return __rtgdrv.zoekAlle(sel).length;}', [this.sel]); }
  textContent() { return this.page._roep('function(sel,i){var el=__rtgdrv.zoekAlle(sel)[i]||null;return el?el.textContent:null;}', [this.sel, this.index]); }
  async click() { await this.page._roep('function(sel,i){var el=__rtgdrv.zoekAlle(sel)[i]||null;__rtgdrv.klik(el);return true;}', [this.sel, this.index]); }
  async waitFor(opts) {
    const t = (opts && opts.timeout) || 15000;
    await this.page._wachtRoep('function(sel,i){var el=__rtgdrv.zoekAlle(sel)[i]||null;return !!el&&__rtgdrv.zichtbaar(el);}', [this.sel, this.index], t);
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
  // Roep een CONSTANTE functie aan in de pagina met de waarden als echte CDP-
  // argumenten (Runtime.callFunctionOn). Zo wordt er nooit een waarde in de uit
  // te voeren code geplakt (geen code-injectie); het gedrag blijft identiek.
  async _roep(fnDecl, args = []) {
    const g = await this.conn.stuur('Runtime.evaluate', { expression: 'globalThis', returnByValue: false }, this.sessionId);
    const objectId = g.result && g.result.objectId;
    const r = await this.conn.stuur('Runtime.callFunctionOn', {
      functionDeclaration: fnDecl, objectId,
      arguments: args.map((v) => ({ value: v })),
      returnByValue: true, awaitPromise: true, userGesture: true
    }, this.sessionId);
    if (r.exceptionDetails) {
      const d = r.exceptionDetails;
      throw new Error('evaluate: ' + ((d.exception && (d.exception.description || d.exception.value)) || d.text));
    }
    return r.result ? r.result.value : undefined;
  }
  async _wachtRoep(fnDecl, args, timeout = 15000, interval = 50) {
    const eind = Date.now() + timeout;
    for (;;) {
      let ok = false;
      try { ok = await this._roep(fnDecl, args); } catch (e) { ok = false; }
      if (ok) return true;
      if (Date.now() > eind) throw new Error('time-out (' + timeout + 'ms)');
      await slaap(interval);
    }
  }
  async evaluate(fn, ...args) {
    if (typeof fn === 'function') return this._roep(fn.toString(), args);
    return this._roep('function(s){return eval(s);}', [String(fn)]); // string-expressie als waarde-argument
  }
  async addInitScript(fn, arg) {
    const src = typeof fn === 'string' ? fn : '(' + fn.toString() + ')(' + (arg === undefined ? '' : S(arg)) + ')';
    await this.conn.stuur('Page.addScriptToEvaluateOnNewDocument', { source: src }, this.sessionId);
  }
  async addScriptTag({ content }) {
    await this.conn.stuur('Runtime.evaluate', { expression: String(content), returnByValue: true }, this.sessionId);
  }
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
    let fn;
    if (state === 'hidden') fn = 'function(sel){var el=__rtgdrv.zoek(sel);return !el||!__rtgdrv.zichtbaar(el);}';
    else if (state === 'attached') fn = 'function(sel){return !!__rtgdrv.zoek(sel);}';
    else fn = 'function(sel){var el=__rtgdrv.zoek(sel);return !!el&&__rtgdrv.zichtbaar(el);}';
    await this._wachtRoep(fn, [sel], timeout);
    return true;
  }
  async waitForFunction(fn, arg, opts = {}) {
    if (typeof fn === 'function') await this._wachtRoep(fn.toString(), arg === undefined ? [] : [arg], opts.timeout || 15000);
    else await this._wachtRoep('function(s){return eval(s);}', [String(fn)], opts.timeout || 15000);
  }
  async waitForTimeout(ms) { await slaap(ms); }
  locator(sel) { return new Locator(this, sel); }
  async click(sel) { await this._roep('function(sel){var el=__rtgdrv.zoek(sel);if(!el)throw new Error("klik: niet gevonden "+sel);__rtgdrv.klik(el);return true;}', [sel]); }
  async fill(sel, waarde) { await this._roep('function(sel,w){var el=__rtgdrv.zoek(sel);if(!el)throw new Error("vul: niet gevonden "+sel);__rtgdrv.vul(el,w);return true;}', [sel, waarde]); }
  textContent(sel) { return this._roep('function(sel){var el=__rtgdrv.zoek(sel);return el?el.textContent:null;}', [sel]); }
  getAttribute(sel, attr) { return this._roep('function(sel,a){var el=__rtgdrv.zoek(sel);return el?el.getAttribute(a):null;}', [sel, attr]); }
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

module.exports = { Page, Locator };
