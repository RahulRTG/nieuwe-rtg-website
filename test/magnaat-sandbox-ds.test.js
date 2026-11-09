'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const { fixture, bron } = require('./lib/magnaat-sandbox-fixture');

test('zonder expliciete Magnaat-1 blijven opslag, apparaten, transport en DOM ongemoeid', () => {
  for (const search of ['', '?magnaat=0', '?magnaat=true']) {
    const f = fixture({ ds: true, search }); f.ready();
    assert.equal(f.window.RTG_MAGNAAT_PROEF, undefined); assert.equal(f.window.RTG_MAGNAAT_URL, undefined);
    assert.equal(f.window.localStorage, f.originalLocal); assert.equal(f.window.sessionStorage, f.originalSession);
    assert.equal(f.window.fetch, f.originalFetch); assert.equal(typeof f.window.WebSocket, 'function');
    assert.equal(f.marker(), null); assert.equal(f.styles().length, 0); assert.deepEqual(Object.keys(f.events), []);
  }
});

test('sandbox vóór DS-shell blokkeert direct maar tekent later het DS-keurmerk zonder injectie', async () => {
  const f = fixture();
  assert.equal(f.marker(), null); assert.equal(f.styles().length, 0);
  assert.equal((await f.window.fetch('/api/staff/ritten')).status, 409);
  assert.notEqual(f.window.localStorage, f.originalLocal);
  f.document.documentElement.setAttribute('data-ds', '1'); f.ready(); f.ready();
  const mark = f.marker();
  assert.ok(mark.isConnected); assert.equal(mark.hidden, false); assert.equal(mark.hasAttribute('hidden'), false);
  assert.equal(mark.className, 'ds-magnaatproef'); assert.equal(mark.textContent, 'Magnaat Test');
  assert.equal(mark.getAttribute('role'), 'status');
  assert.equal(mark.getAttribute('aria-label'), 'Magnaat Test. Geen productieomgeving.');
  assert.equal(f.document.body.children.length, 1); assert.equal(f.styles().length, 0);
});

test('reeds opgebouwde DS-pagina toont hetzelfde keurmerk onmiddellijk zonder legacy-stijl', () => {
  const f = fixture({ ds: true, ready: 'complete' });
  assert.equal(f.marker().className, 'ds-magnaatproef'); assert.ok(f.marker().isConnected);
  assert.equal(f.styles().length, 0); assert.equal(f.events.DOMContentLoaded, undefined);
});

test('legacy behoudt exact het oorspronkelijke keurmerkblad en maakt één marker', () => {
  for (const ready of ['loading', 'complete']) {
    const f = fixture({ ready }); f.ready(); f.ready();
    assert.equal(f.styles().length, 1); assert.equal(f.marker().className, '');
    assert.equal(f.marker().textContent, 'Magnaat Test'); assert.equal(f.marker().hidden, false);
    assert.equal(crypto.createHash('sha256').update(f.styles()[0].textContent).digest('hex'),
      '7db8124ed0663b7d330039c0f7a95bcabdb1decfb2a789e94e1f32b438e92a51');
    assert.equal(f.document.body.children.length, 1);
  }
});

for (const ds of [false, true]) {
  const mode = ds ? 'DS' : 'legacy';
  test(mode + ': fetch en XHR onderscheppen uitsluitend dezelfde lokale API-grens', async () => {
    const f = fixture({ ds }); f.ready();
    for (const input of ['/api/boeking', 'https://rtg.test/api/betaling', { url: 'https://rtg.test/api/upload' }]) {
      const r = await f.window.fetch(input, { method: 'POST' });
      assert.equal(r.status, 409); assert.equal(r.headers.get('content-type'), 'application/json');
      assert.deepEqual(await r.json(), { error: 'Magnaat gebruikt een afgeschermde trainingskopie.', magnaat: true });
    }
    assert.equal(f.calls.length, 0);
    for (const url of ['/apps/chauffeur.js', 'https://extern.test/api/data']) {
      const options = { method: 'GET' }; assert.equal(f.window.fetch(url, options), 'fetch');
      const call = f.calls.at(-1); assert.equal(call.receiver, f.window); assert.deepEqual(call.args, [url, options]);
    }
    const xhr = new f.window.XMLHttpRequest(); xhr.open('POST', '/api/upload');
    assert.throws(() => xhr.send('bestand'), { name: 'NotAllowedError' });
    assert.equal(f.calls.filter(c => c.name === 'xhr-send').length, 0);
    xhr.open('GET', '/apps/chauffeur.js'); assert.equal(xhr.send(null), 'xhr-send');
    assert.equal(f.calls.at(-1).receiver, xhr);
  });

  test(mode + ': opslag blijft volledig lokaal en gescheiden van de gewone sessie', () => {
    const f = fixture({ ds }), local = f.window.localStorage, session = f.window.sessionStorage;
    assert.equal(local.getItem('token'), null); assert.equal(session.getItem('concept'), null);
    local.setItem('a', 1); session.setItem('a', 2);
    assert.equal(local.getItem('a'), '1'); assert.equal(session.getItem('a'), '2');
    assert.equal(local.length, 1); assert.equal(local.key(0), 'a'); assert.equal(local.key(8), null);
    local.removeItem('a'); assert.equal(local.length, 0); session.clear(); assert.equal(session.length, 0);
    assert.deepEqual([...f.originalLocal], [['token', 'echte-sessie']]);
    assert.deepEqual([...f.originalSession], [['concept', 'echt-concept']]);
  });

  test(mode + ': apparaat, realtime, nieuwe vensters en serviceworker blijven onderschept', async () => {
    const f = fixture({ ds }), n = f.navigator, w = f.window;
    assert.equal(w.EventSource, undefined); assert.equal(w.WebSocket, undefined);
    assert.throws(() => new w.RTCPeerConnection(), { name: 'NotAllowedError' });
    await assert.rejects(n.mediaDevices.getUserMedia({ audio: true }), { name: 'NotAllowedError' });
    await assert.rejects(n.serviceWorker.register('/sw.js'), { name: 'NotAllowedError' });
    const errors = [];
    for (const name of ['getCurrentPosition', 'watchPosition']) {
      assert.equal(n.geolocation[name](() => assert.fail('geen apparaatlocatie'), e => errors.push(e.code)), 0);
    }
    assert.deepEqual(errors, [1, 1]); n.geolocation.clearWatch(0);
    assert.equal(n.sendBeacon('/api/puls', 'data'), false); assert.equal(w.open('/apps/wonen.html'), null);
    assert.equal(f.calls.length, 0);
  });

  test(mode + ': formulieren blijven lokaal en alleen app-links behouden Magnaat-context', () => {
    const f = fixture({ ds });
    assert.equal(f.events.submit[0].options, true); assert.equal(f.fire('submit').defaultPrevented, true);
    for (const href of ['/api/export', 'https://extern.test/apps/ander.html', 'javascript:alert(1)']) {
      const a = { getAttribute: () => href, setAttribute(k, v) { this[k] = String(v); } };
      const e = f.fire('click', { target: { closest: () => a } });
      assert.equal(e.defaultPrevented, true); assert.equal(e.stopped, true);
    }
    const href = '/apps/wonen.html?tab=huis#dossier', a = { getAttribute: () => href, setAttribute(k, v) { this[k] = String(v); } };
    const e = f.fire('click', { target: { closest: () => a } });
    assert.equal(e.defaultPrevented, false); assert.equal(a.href, '/apps/wonen.html?tab=huis&magnaat=1#dossier');
    assert.equal(f.window.RTG_MAGNAAT_URL(href), a.href);
    assert.equal(f.window.RTG_MAGNAAT_URL('https://extern.test/apps/a.html'), 'https://extern.test/apps/a.html');
  });
}

test('DS-keurmerk heeft leesbare niet-interactieve vaste presentatie met bestaande tokens', () => {
  const base = path.join(__dirname, '../public/ds');
  const css = fs.readFileSync(path.join(base, 'componenten/magnaatproef.css'), 'utf8');
  const tokens = fs.readFileSync(path.join(base, 'tokens.css'), 'utf8');
  assert.match(css, /@layer\s+rtg\.component/); assert.match(css, /\.ds-magnaatproef\s*\{/);
  assert.match(css, /position:\s*fixed/); assert.match(css, /display:\s*flex/);
  assert.match(css, /pointer-events:\s*none/); assert.match(css, /z-index:\s*2147483647/);
  const inset = css.match(/inset-inline-end:\s*([^;]+)/)[1];
  assert.ok(inset.includes('safe-area-inset-left') && inset.includes('safe-area-inset-right'), 'uitsparing beschermd in LTR én RTL');
  assert.doesNotMatch(css, /display:\s*none|visibility:\s*hidden|opacity:\s*0\b/);
  assert.doesNotMatch(css, /!important|#[0-9a-f]{3,8}\b|rgba?\(|\b(?:top|right|left|bottom):/i);
  for (const m of css.matchAll(/var\((--ds-[\w-]+)/g)) assert.ok(tokens.includes(m[1] + ':'), m[1]);
  assert.ok(Buffer.byteLength(bron) < 10240);
});
