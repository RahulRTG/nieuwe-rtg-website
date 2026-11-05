'use strict';
/* Werkelijke menucontroller in een kleine DOM. Geen pixel-, contrast- of
   browserkwalificatie: die blijft onderdeel van de gezamenlijke eindproef. */
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
// Gebruik de bestaande bronparts; de centrale bundel wordt afzonderlijk gegenereerd.
const parts=path.join(__dirname,'../public/shared/appmenu');
const bron=fs.readdirSync(parts).filter(n=>n.endsWith('.js')).sort().map(n=>fs.readFileSync(path.join(parts,n),'utf8')).join('');
function scherm({ ds = true, kop = true, genest = false, werkbalk = false, expliciet = false, verborgen = false, uit = false, thuis = false } = {}) {
  let document, observer;
  const timers = [], events = {}, acties = [], bronnen = {};
  const afstammelingen = n => n.children.flatMap(c => [c, ...afstammelingen(c)]);
  const past = (n, sel) => sel.split(',').some(s => { s = s.trim(); return s === '[inert]' ? !!n.inert :
    s.startsWith('.') ? n.classList.contains(s.slice(1)) : n.tagName === s.toUpperCase(); });
  function node(tag) {
    const n = { tagName: tag.toUpperCase(), className: '', attrs: {}, children: [], events: {}, _text: '', tabIndex: tag === 'button' ? 0 : -1,
      setAttribute(k, v) { this.attrs[k] = String(v); }, getAttribute(k) { return this.attrs[k] ?? null; }, hasAttribute(k) { return k in this.attrs; },
      appendChild(c) { return this.insertBefore(c, null); },
      insertBefore(c, ref) { c.remove(); const at = ref ? this.children.indexOf(ref) : -1; this.children.splice(at < 0 ? this.children.length : at, 0, c); c.parentNode = this; return c; },
      remove() { if (this.parentNode) this.parentNode.children = this.parentNode.children.filter(c => c !== this); this.parentNode = null; },
      addEventListener(k, f) { this.events[k] = f; },
      click() { this.events.click?.({ target: this }); }, focus() { document.activeElement = this; },
      getClientRects() { return this.isConnected ? [{}] : []; }, getBoundingClientRect() { return { top: 0 }; },
      querySelectorAll(sel) {
        const direct = sel.startsWith(':scope > '); if (direct) sel = sel.slice(9);
        return (direct ? this.children : afstammelingen(this)).filter(c => sel.split(',').some(s => past(c, s.trim())));
      },
      querySelector(s) { return this.querySelectorAll(s)[0] || null; },
      closest(s) { return past(this, s) ? this : this.parentNode?.closest(s) || null; },
      contains(c) { return this === c || afstammelingen(this).includes(c); },
      scrollIntoView(options) { acties.push(['scroll', options.behavior, options.block]); }
    };
    n.classList = { contains: c => n.className.split(/\s+/).includes(c),
      add(c) { if (!this.contains(c)) n.className = [n.className, c].filter(Boolean).join(' '); },
      remove(c) { n.className = n.className.split(/\s+/).filter(x => x !== c).join(' '); } };
    Object.defineProperties(n, {
      isConnected: { get() { return this.tagName === 'HTML' || !!this.parentNode?.isConnected; } },
      offsetParent: { get() { return this.isConnected ? this.parentNode : null; } },
      firstChild: { get() { return this.children[0] || null; } }, firstElementChild: { get() { return this.firstChild; } },
      textContent: { get() { return this._text + this.children.map(c => c.textContent).join(''); },
        set(v) { this.children.forEach(c => { c.parentNode = null; }); this.children = []; this._text = v; } }
    }); return n;
  }
  const html = node('html'), head = node('head'), body = node('body'); html.appendChild(head); html.appendChild(body);
  if (ds) html.setAttribute('data-ds', ''); if (uit) body.setAttribute('data-appmenu-uit', ''); if (thuis) body.setAttribute('data-ios-home', '');
  const header = node('header'), terug = node('button'), merk = node('a'), profiel = node('button');
  header.className = ds ? 'ds-kop' : 'kop'; terug.className = 'ds-kop__actie'; merk.className = 'ds-kop__merk'; merk.textContent = 'RTG';
  if (werkbalk) { header.className = 'ds-browser-balk'; body.classList.add('ds-wereldwerkruimte'); }
  if (expliciet) { header.className = 'eigen-kop'; header.setAttribute('data-rtg-menu-host',''); }
  header.hidden = verborgen;
  terug.addEventListener('click', () => acties.push('kop-terug')); profiel.addEventListener('click', () => acties.push('profiel'));
  header.appendChild(terug); header.appendChild(merk); header.appendChild(profiel);
  if (kop) { const host = genest ? node('div') : body; if (genest) { host.className = 'wd-page'; body.appendChild(host); } host.appendChild(header); }
  document = { documentElement: html, head, body, title: 'Reisboek · RTG', activeElement: null,
    createElement: node, createElementNS: (_ns, t) => node(t),
    getElementById: id => afstammelingen(html).find(n => n.id === id) || null,
    querySelectorAll(s) {
      if (s.startsWith('header.kop, header.merkkop, body > header')) {
        return header.isConnected && ((!ds && !expliciet) || header.parentNode === body ||
          (!werkbalk && !expliciet && s.includes('header.ds-kop')) || (expliciet && s.includes('header[data-rtg-menu-host]')) || (werkbalk && s.includes('.ds-wereldwerkruimte .wd-page > header'))) ? [header] : [];
      }
      return bronnen[s] || html.querySelectorAll(s);
    },
    querySelector(s) { return this.querySelectorAll(s)[0] || null; },
    addEventListener(k, f) { events[k] = f; }, removeEventListener(k, f) { if (events[k] === f) delete events[k]; }
  };
  const window = { history: { length: 2, back: () => acties.push('terug') },
    RTGiOS: { thuis: () => acties.push('thuis') }, RTGBediening: { aanwezig: true, open: () => acties.push('instellingen') },
    RTGMetgezel: { rahul: () => acties.push('rahul') }, RTGVol: { mogelijk: () => true, wissel: () => acties.push('randen') },
    navigator: { share: data => { acties.push(['delen', data.title, data.url]); return Promise.resolve(); } },
    MutationObserver: class { constructor(f) { observer = f; } observe() {} }, getComputedStyle: e => ({ display: e.hidden ? 'none' : 'block', visibility: 'visible', opacity: '1' }) };
  const ctx = { window, document, location: { href: 'https://rtg.invalid/apps/reisboek.html' }, setTimeout: (f, ms) => timers.push({ f, ms }) };
  vm.runInNewContext(bron, ctx);
  return { document, header, terug, merk, profiel, body, head, events, acties, bronnen, node, window,
    api: window.RTGAppMenu, opnieuw: () => vm.runInNewContext(bron, ctx), observe: () => observer(),
    flush: () => timers.splice(0).forEach(t => { assert.equal(t.ms, 60); t.f(); }),
    laag: () => body.querySelector('.amn-scrim'), tegels: () => body.querySelectorAll('.amn-tegel'), rijen: () => body.querySelectorAll('.amn-rij') };
}
for (const ds of [false, true]) {
  test(`${ds ? 'DS' : 'legacy'}: één eigenaar, titel, focus, Escape, achtergrond en heropening`, () => {
    const s = scherm({ ds }); const knop = s.api.knop(); s.opnieuw();
    assert.equal(s.body.querySelectorAll('.amn-knop').length, 1);
    assert.equal(s.head.children.length, ds ? 0 : 1);
    if (!ds) { // Ook een oudere host gebruikt dezelfde canonieke DS-root.
      assert.equal(s.head.children[0].tagName, 'LINK');
      assert.equal(s.head.children[0].rel, 'stylesheet');
      assert.equal(s.head.children[0].href, '/ds/rtg-ds.css');
      assert.equal(s.head.children[0].id, 'rtgDsRuntimeCss');
    }
    knop.focus(); knop.click(); const laag = s.laag(), blad = laag.children[0];
    assert.equal(laag.classList.contains('ds-appmenu'), true); assert.equal(blad.classList.contains('ds-dialoog'), true);
    assert.equal(blad.attrs.role, 'dialog'); assert.equal(blad.attrs['aria-modal'], 'true');
    assert.equal(blad.querySelector('b').textContent, 'Reisboek');
    assert.equal(knop.attrs['aria-expanded'], 'true'); assert.equal(s.document.activeElement, blad.querySelector('.amn-x'));
    let gestopt = false; s.events.keydown({ key: 'Escape', stopPropagation() { gestopt = true; } });
    assert.ok(gestopt); assert.equal(s.events.keydown, undefined); assert.equal(s.document.activeElement, knop);
    assert.equal(knop.attrs['aria-expanded'], 'false'); assert.equal(laag.classList.contains('amn-open'), false);
    knop.click(); laag.events.click({ target: blad }); assert.equal(laag.classList.contains('amn-open'), true);
    laag.click(); assert.equal(laag.classList.contains('amn-open'), false);
  });
  test(`${ds ? 'DS' : 'legacy'}: expliciete én ontdekte acties, bestaande hosts en uitloggen behouden`, () => {
    const s = scherm({ ds }); const logout = s.node('button'); logout.id = 'logoutBtn'; logout.addEventListener('click', () => s.acties.push('uitloggen')); s.body.appendChild(logout);
    const tab = s.node('button'); tab.textContent = 'Overzicht'; tab.addEventListener('click', () => s.acties.push('tab')); s.body.appendChild(tab);
    s.bronnen['[role="tab"], [data-tab], .tabs button'] = [tab];
    s.api.zet([{ label: 'Mijn aanvraag', doe: () => { assert.equal(s.laag().classList.contains('amn-open'), false); s.acties.push('aanvraag'); } }]);
    s.api.voegToe({ label: 'Document', spring: tab });
    assert.deepEqual(Array.from(s.api.functies(), x => x.label), ['Mijn aanvraag', 'Document', 'Overzicht']);
    s.api.open(); s.tegels()[0].click(); assert.deepEqual(s.acties, []); s.flush(); assert.deepEqual(s.acties, ['aanvraag']);
    s.api.open(); s.tegels()[1].click(); s.flush(); assert.deepEqual(s.acties.at(-1), ['scroll', 'smooth', 'start']);
    s.api.open(); s.tegels()[2].click(); s.flush(); assert.equal(s.acties.at(-1), 'tab');
    for (const label of ['Beginscherm', 'Een stap terug', 'Instellingen', 'Vraag Rahul', 'Rand tot rand', 'Deel dit scherm', 'Uitloggen']) {
      s.api.open(); const b = s.rijen().find(n => n.textContent === label); assert.ok(b, label); b.click(); s.flush();
    }
    assert.deepEqual(s.acties.slice(3), ['thuis', 'terug', 'instellingen', 'rahul', 'randen', ['delen', 'Reisboek · RTG', 'https://rtg.invalid/apps/reisboek.html'], 'uitloggen']);
  });
  test(`${ds ? 'DS' : 'legacy'}: weggeveegde body herstelt knop en dialoog zonder tweede instantie`, () => {
    const s = scherm({ ds }); const knop = s.api.knop(); knop.click(); const oud = s.laag();
    s.body.textContent = ''; s.observe(); assert.equal(knop.isConnected, true); assert.equal(knop.classList.contains('amn-zweef'), true);
    knop.click(); assert.notEqual(s.laag(), oud); assert.equal(s.body.querySelectorAll('.amn-knop').length, 1);
    assert.equal(s.laag().classList.contains('amn-open'), true);
  });
  test(`${ds ? 'DS' : 'legacy'}: Tab-cirkel, uitgevallen actie en focusherstel na herhaald open`, () => {
    const s = scherm({ ds }), trigger = s.api.knop(); trigger.focus(); trigger.click(); s.api.open();
    const blad = s.laag().children[0], knoppen = blad.querySelectorAll('button'), eerste = knoppen[0], laatste = knoppen.at(-1);
    const toets = shiftKey => { let gestopt = false; s.events.keydown({ key: 'Tab', shiftKey, preventDefault() { gestopt = true; } }); return gestopt; };
    eerste.focus(); assert.equal(toets(true), true); assert.equal(s.document.activeElement, laatste);
    laatste.focus(); assert.equal(toets(false), true); assert.equal(s.document.activeElement, eerste);
    laatste.disabled = true; eerste.focus(); assert.equal(toets(true), true); assert.equal(s.document.activeElement, knoppen.at(-2));
    trigger.focus(); assert.equal(toets(false), true); assert.equal(s.document.activeElement, eerste);
    s.api.sluit(); assert.equal(s.document.activeElement, trigger, 'herhaald open bewaart de oorspronkelijke ingang');
    const origin = s.node('button'); s.body.appendChild(origin); origin.focus(); s.api.open(); origin.remove(); s.api.sluit();
    assert.equal(s.document.activeElement, trigger, 'verdwenen ingang valt terug op de verbonden menuknop');
  });
}
for (const genest of [false, true]) test('DS-kop: bestaande actie, merk en profiel behouden in ' + (genest ? 'World Desktop' : 'body'), () => {
  const s = scherm({ genest }); assert.equal(s.header.children.length, 3);
  const cel = s.header.children[0]; assert.ok(cel.classList.contains('ds-appmenu__links'));
  assert.deepEqual(cel.children, [s.api.knop(), s.terug]); assert.equal(s.header.children[1], s.merk); assert.equal(s.header.children[2], s.profiel);
  s.terug.click(); s.profiel.click(); assert.deepEqual(s.acties, ['kop-terug', 'profiel']);
  s.api.knop().remove(); s.observe(); assert.equal(s.header.children.length, 3); assert.equal(cel.children.length, 2);
  assert.equal(s.api.knop().classList.contains('amn-zweef'), false);
});
test('appmenu: expliciete uitsluiting en beginscherm blijven zonder extra controller', () => {
  for (const opties of [{ uit: true }, { thuis: true }]) { const s = scherm(opties); assert.equal(s.api, undefined); assert.equal(s.head.children.length, 0); assert.equal(s.body.querySelector('.amn-knop'), null); }
});
test('DS-werkbalk: World Desktop behoudt de eigen rij zonder zwevende menu-overlap', () => {
  const s = scherm({ genest: true, werkbalk: true }), knop = s.api.knop();
  assert.equal(knop.parentNode, s.header);
  assert.deepEqual(s.header.children, [knop, s.terug, s.merk, s.profiel]);
  assert.equal(knop.classList.contains('amn-zweef'), false);
  s.terug.click(); s.profiel.click(); assert.deepEqual(s.acties, ['kop-terug', 'profiel']);
});
test('Rand tot rand volgt actuele beschikbaarheid, ook als die na openen verandert', () => {
  const s = scherm(); s.window.RTGVol.mogelijk = () => false; s.api.open();
  assert.equal(s.rijen().some(n => n.textContent === 'Rand tot rand'), false);
  s.api.sluit(); s.window.RTGVol.mogelijk = () => true; s.api.open();
  const rij = s.rijen().find(n => n.textContent === 'Rand tot rand'); assert.ok(rij);
  assert.equal(s.rijen().some(n => n.textContent === 'Volledig scherm'), false);
  s.window.RTGVol.mogelijk = () => false; rij.click(); s.flush();
  assert.deepEqual(s.acties, [], 'resize kan een inmiddels onmogelijke handeling niet alsnog uitvoeren');
});
test('instellingenknoppen worden geen eigen appfuncties via tab- of segmentdiscovery', () => {
  for (const viaTabs of [false, true]) {
    const s = scherm(), main = s.node('main'), dialoog = s.node('dialog'), rij = s.node('section');
    dialoog.className = 'bdn-scrim'; main.appendChild(dialoog); dialoog.appendChild(rij); s.body.appendChild(main);
    const knoppen = ['Draaien', 'Volledig', 'Rand tot rand'].map(label => {
      const b = s.node('button'); b.textContent = label; rij.appendChild(b); return b;
    });
    if (viaTabs) s.bronnen['[role="tab"], [data-tab], .tabs button'] = knoppen;
    const kop = s.node('h2'); kop.textContent = 'Eigen inhoud'; main.appendChild(kop);
    const functies = Array.from(s.api.functies(), f => f.label);
    assert.deepEqual(functies, ['Eigen inhoud'], 'alleen de eigen inhoud, ook na het bouwen van instellingen');
  }
});
test('appmenu: eigen bundel, canonieke import, DS-contract en gebruikte semantische tokens sluiten', () => {
  assert.equal(bron, require('../scripts/bundel').bundel('shared/appmenu.js').toString('utf8'));
  const ds = path.join(__dirname, '../public/ds/'), css = fs.readFileSync(path.join(ds, 'componenten/appmenu.css'), 'utf8');
  const tokens = fs.readFileSync(path.join(ds, 'tokens.css'), 'utf8');
  for (const m of css.matchAll(/var\((--ds-[\w-]+)\)/g)) assert.ok(tokens.includes(m[1] + ':'), m[1]);
  assert.equal(require('../scripts/ontwerpsysteem').contractFouten({ paginas: {} }).filter(f => f.includes('componenten/appmenu.css')).length, 0);
  assert.ok(JSON.parse(fs.readFileSync(path.join(ds, 'contract.json'), 'utf8')).componenten.includes('appmenu'));
  assert.match(fs.readFileSync(path.join(ds, 'bediening.css'), 'utf8') + fs.readFileSync(path.join(ds, 'rtg-ds.css'), 'utf8'), /@import url\("componenten\/appmenu\.css"\)/);
  assert.match(css, /min-block-size: var\(--ds-doel\)/); assert.match(css, /safe-area-inset-bottom/);
});
test('expliciete geneste DS-header draagt dezelfde menuknop; verborgen host valt veilig terug',()=>{
 const s=scherm({genest:true,expliciet:true}),knop=s.api.knop();assert.equal(knop.parentNode,s.header);assert.equal(knop.classList.contains('amn-zweef'),false);
 s.header.hidden=true;knop.remove();s.observe();assert.equal(knop.parentNode,s.body);assert.equal(knop.classList.contains('amn-zweef'),true);
 s.header.hidden=false;knop.remove();s.observe();assert.equal(knop.parentNode,s.header);assert.equal(knop.classList.contains('amn-zweef'),false);
 assert.equal(s.body.querySelectorAll('.amn-knop').length,1);s.terug.click();s.profiel.click();assert.deepEqual(s.acties,['kop-terug','profiel']);
 const hidden=scherm({genest:true,expliciet:true,verborgen:true});assert.equal(hidden.api.knop().parentNode,hidden.body);
 const legacy=scherm({ds:false,genest:true,expliciet:true});assert.equal(legacy.api.knop().parentNode,legacy.body,'nieuwe hostoptie geldt uitsluitend DS');
});
