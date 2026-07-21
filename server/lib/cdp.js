/* CDP-transport voor onze eigen browser-driver (server/lib/browser.js), i.p.v.
   het pakket 'playwright'. We starten Chromium met --remote-debugging-pipe en
   praten het Chrome DevTools Protocol rechtstreeks over file descriptor 3 (wij
   -> browser) en 4 (browser -> wij): losse JSON-berichten, elk met een NUL-byte
   erachter. Geen WebSocket, geen HTTP-upgrade, geen dependency.

   Node's node:http/net zijn kern; deze driver draait alleen waar een Chromium-
   binary aanwezig is (zoals in CI met Playwright-browsers) en vervangt daar het
   Playwright-pakket voor onze scherm- en toegankelijkheidstests. */
'use strict';
const { spawn } = require('child_process');
const { EventEmitter } = require('events');
const fs = require('fs');
const path = require('path');

const NUL = Buffer.from([0]);

class Verbinding extends EventEmitter {
  constructor(kind) {
    super();
    this.setMaxListeners(0);
    this.kind = kind;
    this.schrijf = kind.stdio[3];   // fd3: wij -> browser
    this.lees = kind.stdio[4];      // fd4: browser -> wij
    this._id = 0;
    this._wacht = new Map();
    this._buf = Buffer.alloc(0);
    this._dood = false;
    this.lees.on('data', (c) => this._ontvang(c));
    this.lees.on('error', () => {});
    this.schrijf.on('error', () => {});
    kind.on('exit', () => { this._dood = true; for (const w of this._wacht.values()) w.rej(new Error('browser gestopt')); this._wacht.clear(); });
  }
  _ontvang(c) {
    this._buf = this._buf.length ? Buffer.concat([this._buf, c]) : c;
    let nul;
    while ((nul = this._buf.indexOf(0)) >= 0) {
      const rauw = this._buf.slice(0, nul).toString('utf8');
      this._buf = this._buf.slice(nul + 1);
      if (!rauw) continue;
      let m; try { m = JSON.parse(rauw); } catch (e) { continue; }
      if (m.id && this._wacht.has(m.id)) {
        const { res, rej } = this._wacht.get(m.id); this._wacht.delete(m.id);
        if (m.error) rej(new Error('CDP: ' + (m.error.message || 'fout'))); else res(m.result || {});
      } else if (m.method) {
        this.emit('event', m);
        if (m.sessionId) this.emit('sessie:' + m.sessionId, m);
      }
    }
  }
  stuur(method, params, sessionId) {
    return new Promise((res, rej) => {
      if (this._dood) return rej(new Error('browser gestopt'));
      const id = ++this._id;
      this._wacht.set(id, { res, rej });
      const pak = JSON.stringify({ id, method, params: params || {}, sessionId });
      try { this.schrijf.write(pak); this.schrijf.write(NUL); }
      catch (e) { this._wacht.delete(id); rej(e); }
    });
  }
  sluit() { try { this.kind.kill('SIGKILL'); } catch (e) {} }
}

/* Zoek een bruikbare Chromium-binary (zoals Playwright hem plaatst). */
function vindBrowser() {
  const uit = [];
  if (process.env.RTG_CHROMIUM) uit.push(process.env.RTG_CHROMIUM);
  const wortels = [process.env.PLAYWRIGHT_BROWSERS_PATH, '/opt/pw-browsers'].filter(Boolean);
  for (const w of wortels) {
    uit.push(path.join(w, 'chromium'));
    try {
      for (const d of fs.readdirSync(w)) {
        uit.push(path.join(w, d, 'chrome-linux', 'chrome'));
        uit.push(path.join(w, d, 'chrome-linux', 'headless_shell'));
      }
    } catch (e) { /* map bestaat niet */ }
  }
  for (const p of ['/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome', '/usr/bin/chrome']) uit.push(p);
  for (const p of uit) { try { if (p && fs.existsSync(p)) return fs.realpathSync(p); } catch (e) {} }
  return null;
}

/* Start Chromium met de pipe-transport en geef een Verbinding terug. */
function start(bin, extraArgs, profielDir) {
  const args = ['--headless=new', '--remote-debugging-pipe', '--no-first-run',
    '--no-default-browser-check', '--disable-gpu', '--disable-dev-shm-usage',
    '--user-data-dir=' + profielDir, ...(extraArgs || []), 'about:blank'];
  const kind = spawn(bin, args, { stdio: ['ignore', 'ignore', 'ignore', 'pipe', 'pipe'] });
  return new Verbinding(kind);
}

module.exports = { start, vindBrowser, Verbinding };
