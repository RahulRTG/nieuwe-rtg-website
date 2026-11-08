'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const bron = fs.readFileSync(path.join(__dirname, '../public/shared/uitvoer.js'), 'utf8');
function scherm(ds) {
  const timers = [], blobs = [], downloads = [], ingetrokken = [], html = [], events = {};
  let document;
  function element(tag) {
    const e = { tagName: tag.toUpperCase(), children: [], listeners: {}, attrs: {}, isConnected: false,
      offsetParent: {}, className: '', hidden: false, textContent: '',
      addEventListener(k, f) { this.listeners[k] = f; },
      setAttribute(k, v) { this.attrs[k] = v; }, getAttribute(k) { return this.attrs[k]; },
      getClientRects() { return this.isConnected ? [{}] : []; },
      getBoundingClientRect() { return { width: 100, left: 0, right: 100 }; },
      closest(sel) { return sel === 'button' && tag === 'button' ? this : null; },
      focus() { document.activeElement = this; },
      click() { if (tag === 'a') downloads.push(this); if(this.listeners.click) this.listeners.click({ target: this }); },
      appendChild(n) { if(n.parentNode)n.remove(); this.children.push(n); n.parentNode=this; n.isConnected=true; return n; },
      insertBefore(n) { return this.appendChild(n); },
      remove() { if(this.parentNode)this.parentNode.children=this.parentNode.children.filter(n => n !== this); this.parentNode=null; this.isConnected=false; },
      querySelectorAll(sel) { return sel === 'button' ? this.children.filter(n => n.tagName === 'BUTTON') : []; },
      querySelector(sel) { return sel === 'p' ? this.children.find(n => n.tagName === 'P') : sel === 'button' ? this.querySelectorAll(sel)[0] : null; },
      insertAdjacentHTML(_pos, markup) {
        html.push(markup); const laag=element('div'); laag.hidden=true;
        laag.appendChild(element('p'));
        for(const m of markup.matchAll(/<button ([^>]+)>([^<]+)<\/button>/g)) {
          const b=element('button'); b.className=(m[1].match(/class="([^"]*)"/)||[])[1]||'';
          b.attrs['data-vorm']=(m[1].match(/data-vorm="([^"]*)"/)||[])[1]; b.textContent=m[2]; laag.appendChild(b);
        }
        this.appendChild(laag);
      }
    };
    e.classList = { contains: c => e.className.split(/\s+/).includes(c) };
    Object.defineProperty(e, 'lastElementChild', { get: () => e.children.at(-1) });
    return e;
  }
  const body=element('body'), head=element('head'); body.isConnected=true;
  document = { body, head, title: 'Mijn gegevens · RTG', readyState: 'complete', activeElement: null,
    documentElement: { hasAttribute: a => a === 'data-ds' && ds, clientWidth: 390 },
    createElement: element, getElementById() { return null; }, querySelector() { return null; }, querySelectorAll() { return []; },
    addEventListener(k, f) { events[k] = f; } };
  const window = { innerWidth: 390 };
  const ctx={window, document, Blob, URL: { createObjectURL(b) { blobs.push(b); return 'blob:local-'+blobs.length; }, revokeObjectURL(u) { ingetrokken.push(u); } },
    setTimeout(f, ms) { timers.push({ f, ms }); return timers.length; }, clearTimeout() {}, requestAnimationFrame(f) { f(); } };
  vm.runInNewContext(bron, ctx);
  function vindKnop(root) {
    for (const n of root.children) {
      if (n.tagName === 'BUTTON') return n;
      const gevonden = vindKnop(n);
      if (gevonden) return gevonden;
    }
  }
  return { api: window.RTGUitvoer, body, head, document, blobs, downloads, ingetrokken, timers, html, events,
    opnieuw() { vm.runInNewContext(bron, ctx); }, knop() { return vindKnop(body); } };
}
const gegevens = { kolommen: ['Naam', 'Tekst'], rijen: [['A', '<script>niet uitvoeren</script>;"\n']] };
for (const ds of [false, true]) {
  test((ds ? 'DS' : 'legacy') + ': werkelijke API behoudt lege bron, exportbytes en URL-opruiming', async () => {
    const s = scherm(ds);
    assert.equal(s.api.beschikbaar(), false);
    assert.equal(s.api.neemMee('json').ok, false);
    assert.equal(s.downloads.length, 0);
    s.api.bron(() => gegevens);
    assert.equal(s.api.beschikbaar(), true);
    assert.equal(s.api.gegevens(), gegevens);
    assert.equal(s.api.neemMee('csv').aantal, 1);
    assert.equal(await s.blobs[0].text(), 'Naam;Tekst\r\nA;"<script>niet uitvoeren</script>;""\n"');
    assert.equal(s.downloads[0].download, 'mijn-gegevens.csv');
    assert.equal(s.blobs[0].type, 'text/csv;charset=utf-8');
    s.api.neemMee('json');
    assert.deepEqual(JSON.parse(await s.blobs[1].text()), [{ Naam: 'A', Tekst: gegevens.rijen[0][1] }]);
    assert.equal(s.downloads[1].download, 'mijn-gegevens.json');
    assert.equal(s.ingetrokken.length, 0);
    assert.ok(s.timers.every(t => t.ms === 2000));
    s.timers.forEach(t => t.f());
    assert.deepEqual(s.ingetrokken, ['blob:local-1', 'blob:local-2']);
    assert.ok(s.downloads.every(a => !a.isConnected));
    s.api.bron(() => null);
    assert.equal(s.api.beschikbaar(), false);
    assert.equal(s.knop(), undefined);
  });
  test((ds ? 'DS' : 'legacy') + ': presentatie kiest één eigenaar; dialoog/focus/sluiten blijven werken', () => {
    const s=scherm(ds); s.opnieuw();
    assert.equal(s.head.children.length, ds ? 0 : 1);
    if(!ds){
      assert.equal(s.head.children[0].tagName, 'LINK');
      assert.equal(s.head.children[0].rel, 'stylesheet');
      assert.equal(s.head.children[0].href, '/ds/rtg-ds.css');
    }
    s.api.bron(() => gegevens); const knop=s.knop();
    assert.equal(knop.classList.contains('ds-knop'), true);
    assert.equal(knop.classList.contains('ds-uitvoer-knop'), true);
    assert.equal(knop.attrs['aria-haspopup'], 'dialog');
    knop.focus(); knop.click();
    assert.equal(s.api.zichtbaar(), true);
    assert.match(s.html[0], /role="dialog" aria-modal="true" aria-label="Meenemen"/);
    assert.equal(s.html[0].includes('ds-dialoog'), true);
    for(const c of ['ds-uitvoer-laag', 'ds-uitvoer-blad', 'ds-uitvoer-titel', 'ds-uitvoer-tekst', 'ds-uitvoer-rij'])
      assert.equal(s.html[0].includes(c), true, c + ' hoort bij iedere host');
    assert.ok(!s.html[0].includes('<script>'));
    const laag=s.body.lastElementChild, knoppen=laag.querySelectorAll('button');
    assert.equal(s.document.activeElement, knoppen[0]);
    assert.ok(knoppen.every(b => b.classList.contains('ds-knop')));
    const event = key => ({ key, preventDefault() {}, stopImmediatePropagation() {} });
    s.events.keydown(event('Tab')); assert.equal(s.document.activeElement, knoppen[1]);
    s.events.keydown(event('Escape')); assert.equal(s.api.zichtbaar(), false);
    assert.equal(s.document.activeElement, knop);
    knop.click(); laag.listeners.click({target: knoppen[2]}); assert.equal(s.api.zichtbaar(), false);
  });
}
test('bundel blijft exact uit eigen parts opgebouwd; DS-component hergebruikt tokens en geen legacy CSS', () => {
  assert.equal(require('../scripts/bundel').bundel('shared/uitvoer.js').toString(), bron);
  const css=fs.readFileSync(path.join(__dirname, '../public/ds/componenten/uitvoer.css'), 'utf8');
  assert.match(css, /@layer rtg\.component/);
  assert.doesNotMatch(css, /rtguitvoer|html\[|\bmargin:|\bpadding:/);
  const fouten = require('../scripts/ontwerpsysteem').contractFouten({ paginas: {} });
  assert.deepEqual(fouten.filter(f => f.includes('componenten/uitvoer.css')), [], 'bestaande DS-contractcontrole voor deze component');
  assert.match(css, /safe-area-inset-bottom/);
  assert.match(css, /\[hidden\].*display: none/);
  assert.doesNotMatch(css, /!important|#[\da-f]{3,8}\b|var\(--(?:txt|paneel|rtg-)/i);
});
