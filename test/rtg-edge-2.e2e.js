/* DE ENE RAND ROND DE ACHT EERSTE VANDAAG-SCHERMEN.

   Deze proef telt niet alleen dat Edge bestaat. Hij bewijst in een echte
   browser dat er per scherm precies een top-, zij- en onderrand is, dat de
   oude schermbalken alleen nog als context IN die ene rand leven, en dat een
   ingebed scherm niet stiekem een tweede Edge meebrengt.

   De routes zijn bewust een tabel. Een negende migratie hoort één rij toe te
   voegen en niet een negende, net iets andere kopie van dezelfde proef. */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  browserOpties, geenBrowser, laadPlaywright, startServer, stop
} = require('./helper');

const pw = laadPlaywright();

const ROUTES = [
  {
    naam: 'LivingOS Vandaag', pad: '/apps/rtg.html', wereld: 'living',
    context: ['living-bank', 'living-top'],
    oud: [
      '.os-switcher', '.schil > .bank', '.schil > .topbar',
      'body > .rtgdeel-balk', 'body > header.ios-nav', 'body > .ios-thuis', '#osMenuBtn'
    ]
  },
  {
    naam: 'WorkOS Vandaag', pad: '/apps/kantoor.html', wereld: 'work',
    context: ['wereldtabs'],
    oud: [
      'body > .wereldtabs', 'body > .wereldapps', 'body > .rtgdeel-balk',
      'body > header.ios-nav', 'body > .ios-thuis', '#osMenuBtn'
    ]
  },
  {
    naam: 'TravelOS Vandaag', pad: '/apps/reizen.html', wereld: 'travel',
    context: ['travel-header', 'hoofdtabs'],
    oud: [
      '.reisapp > .prestatiekop', '.reisapp > .hoofdtabs', '.tos-topbar', '.tos-nav',
      'body > .rtgdeel-balk', 'body > header.ios-nav', 'body > .ios-thuis', '#osMenuBtn'
    ]
  },
  {
    naam: 'FoundationOS Vandaag', pad: '/apps/foundation/os-publiek.html', wereld: 'foundation',
    context: ['world-shell'],
    oud: [
      'body > .ws-balk', 'body > .rtgdeel-balk', 'body > header.ios-nav',
      'body > .ios-thuis', '#osMenuBtn'
    ]
  },
  {
    naam: 'LivingOS Agenda', pad: '/apps/agenda.html', wereld: 'living',
    context: ['native-header', 'duimbalk'],
    oud: [
      'body > header:not(.rtg-edge-top)', 'body > .rtg-duimbalk', 'body > .rtgdeel-balk',
      'body > .ios-thuis', '#osMenuBtn'
    ]
  },
  {
    naam: 'TravelOS Reisboek', pad: '/apps/reisboek.html', wereld: 'travel',
    context: ['native-header'],
    oud: [
      'body > header:not(.rtg-edge-top)', '.tos-topbar', '.tos-nav',
      'body > .rtgdeel-balk', 'body > .ios-thuis', '#osMenuBtn'
    ]
  },
  {
    naam: 'WorkOS Projecten', pad: '/apps/werk.html#projecten', wereld: 'work',
    context: ['work-bank', 'work-top'],
    oud: [
      '.wk-shell > .wk-bank', '.wk-shell > .wk-main > .wk-top',
      'body > .rtgdeel-balk', 'body > header.ios-nav', 'body > .ios-thuis', '#osMenuBtn'
    ]
  },
  {
    naam: 'FoundationOS Stad', pad: '/apps/foundation/os-publiek.html?stad=zaandam',
    wereld: 'foundation', context: ['world-shell'],
    oud: [
      'body > .ws-balk', 'body > .rtgdeel-balk', 'body > header.ios-nav',
      'body > .ios-thuis', '#osMenuBtn'
    ]
  }
];

const SCHERMEN = [
  { naam: 'desktop', maat: { width: 1440, height: 900 }, overzicht: { top: true, side: true, bottom: true } },
  { naam: 'mobiel', maat: { width: 390, height: 844 }, overzicht: { top: true, side: false, bottom: true } }
];

/* Zichtbaar betekent hier werkelijk in het kijkvlak. `display:block` op een
   balk die met transform buiten beeld staat, is voor een mens niet zichtbaar
   en mag dus ook niet als zichtbaar door deze toets glippen. */
function schermToestand(route) {
  const zichtbaar = (el) => {
    if (!el) return false;
    const stijl = getComputedStyle(el), r = el.getBoundingClientRect();
    if (stijl.display === 'none' || stijl.visibility === 'hidden' || Number(stijl.opacity) === 0) return false;
    const breed = Math.max(0, Math.min(document.documentElement.clientWidth, r.right) - Math.max(0, r.left));
    const hoog = Math.max(0, Math.min(document.documentElement.clientHeight, r.bottom) - Math.max(0, r.top));
    return breed * hoog > 1;
  };
  const beschrijf = (el, selector) => {
    const r = el.getBoundingClientRect();
    return selector + ' <' + el.tagName.toLowerCase() +
      (el.id ? '#' + el.id : '') + (el.className ? '.' + String(el.className).trim().replace(/\s+/g, '.') : '') +
      '> @ ' + [r.x, r.y, r.width, r.height].map(Math.round).join(',');
  };
  const balk = (selector) => {
    const el = document.querySelector(selector), stijl = el && getComputedStyle(el);
    return { aanwezig: !!el, zichtbaar: zichtbaar(el), pointer: stijl ? stijl.pointerEvents : null,
      display: stijl ? stijl.display : null, visibility: stijl ? stijl.visibility : null };
  };
  const slot = document.querySelector('.rtg-edge-2-context-slot');
  const contextueel = [...document.querySelectorAll('[data-rtg-edge-2-contextual]')];
  const contextTokens = contextueel.map(el => el.getAttribute('data-rtg-edge-2-contextual'));
  const contextBuitenSlot = contextueel.filter(el => !slot || !slot.contains(el)).map(el => beschrijf(el, 'context'));
  const oudZichtbaar = [];
  route.oud.forEach(selector => {
    document.querySelectorAll(selector).forEach(el => {
      if ((!slot || !slot.contains(el)) && zichtbaar(el)) oudZichtbaar.push(beschrijf(el, selector));
    });
  });
  const reveals = [...document.querySelectorAll('.rtg-edge2-reveal')];
  const revealZichtbaar = reveals.filter(zichtbaar);
  const revealFocusbaar = revealZichtbaar.filter(el => !el.disabled && el.tabIndex >= 0 && getComputedStyle(el).pointerEvents !== 'none');
  const panel = document.querySelector('.rtg-edge-2-context');
  const cs = getComputedStyle(document.body);
  return {
    url: location.pathname + location.search + location.hash,
    wereld: document.body.getAttribute('data-rtg-world'),
    ready: document.body.getAttribute('data-rtg-edge-ready'),
    rendered: document.body.getAttribute('data-rtg-edge-2-rendered'),
    stand: document.body.getAttribute('data-rtg-edge-2-state'),
    roots: document.querySelectorAll('.rtg-edge-chrome').length,
    nested: document.querySelectorAll('.rtg-edge-chrome .rtg-edge-chrome').length,
    toppen: document.querySelectorAll('.rtg-edge-top').length,
    zijkanten: document.querySelectorAll('.rtg-edge-side').length,
    bodems: document.querySelectorAll('.rtg-edge-bottom').length,
    merken: document.querySelectorAll('.rtg-edge-mark').length,
    top: balk('.rtg-edge-top'), side: balk('.rtg-edge-side'), bottom: balk('.rtg-edge-bottom'),
    revealAantal: reveals.length, revealZichtbaar: revealZichtbaar.length,
    revealFocusbaar: revealFocusbaar.length,
    contextPanelen: document.querySelectorAll('.rtg-edge-2-context').length,
    contextKnoppen: document.querySelectorAll('.rtg-edge-2-context-button').length,
    contextDicht: !panel || panel.hidden,
    contextOpenAttr: document.body.hasAttribute('data-rtg-edge-2-context-open'),
    contextTokens, contextBuitenSlot, oudZichtbaar,
    contextHandelingen: slot ? slot.querySelectorAll('a[href],button,input,select,textarea,[tabindex]:not([tabindex="-1"])').length : 0,
    padding: {
      top: parseFloat(cs.paddingTop) || 0, right: parseFloat(cs.paddingRight) || 0,
      bottom: parseFloat(cs.paddingBottom) || 0, left: parseFloat(cs.paddingLeft) || 0
    }
  };
}

function assertEenRand(m, label) {
  assert.equal(m.ready, 'true', label + ': de basis-Edge heeft zijn commitpunt niet bereikt');
  assert.equal(m.rendered, 'true', label + ': Edge 2 heeft zijn commitpunt niet bereikt');
  assert.equal(m.roots, 1, label + ': er hoort precies één Edge-wortel te zijn');
  assert.equal(m.nested, 0, label + ': een Edge mag nooit een tweede Edge bevatten');
  assert.equal(m.toppen, 1, label + ': precies één bovenrand');
  assert.equal(m.zijkanten, 1, label + ': precies één zijrand');
  assert.equal(m.bodems, 1, label + ': precies één onderrand');
  assert.equal(m.merken, 1, label + ': precies één klein Edge-merkteken');
  assert.ok(m.top.aanwezig && m.side.aanwezig && m.bottom.aanwezig, label + ': de drie randen bestaan niet alle drie');
}

function assertContext(m, route, label) {
  assert.equal(m.contextPanelen, 1, label + ': één contextlade voor de lokale bediening');
  assert.equal(m.contextKnoppen, 1, label + ': één ingang naar de contextlade');
  assert.equal(m.contextDicht, true, label + ': de contextlade begint gesloten');
  assert.equal(m.contextOpenAttr, false, label + ': gesloten lade staat niet als open gemarkeerd');
  assert.deepEqual(m.contextBuitenSlot, [], label + ': context is gekloond of buiten zijn ene slot geraakt');
  for (const token of route.context) {
    assert.ok(m.contextTokens.includes(token), label + ': contextbron ontbreekt: ' + token);
  }
  assert.ok(m.contextHandelingen > 0, label + ': de verhuisde context heeft geen bereikbare handeling meer');
  assert.deepEqual(m.oudZichtbaar, [], label + ': zichtbare oude chrome buiten het contextslot:\n' + m.oudZichtbaar.join('\n'));
}

async function wachtOpEdge2(page, verwachtPad) {
  await page.waitForFunction(pad => pad && location.pathname !== pad || document.body &&
    document.body.getAttribute('data-rtg-edge-ready') === 'true' &&
    document.body.getAttribute('data-rtg-edge-2-rendered') === 'true' &&
    document.querySelectorAll('.rtg-edge-chrome').length === 1 &&
    document.querySelectorAll('.rtg-edge-2-context-slot').length === 1,
  verwachtPad || null, { timeout: 15000 });
}

async function wachtOpStand(page, stand, verwacht) {
  await page.waitForFunction(e => {
    const zichtbaar = (el) => {
      if (!el) return false;
      const stijl = getComputedStyle(el), r = el.getBoundingClientRect();
      if (stijl.display === 'none' || stijl.visibility === 'hidden' || Number(stijl.opacity) === 0) return false;
      const breed = Math.max(0, Math.min(document.documentElement.clientWidth, r.right) - Math.max(0, r.left));
      const hoog = Math.max(0, Math.min(document.documentElement.clientHeight, r.bottom) - Math.max(0, r.top));
      return breed * hoog > 1;
    };
    return document.body.getAttribute('data-rtg-edge-2-state') === e.stand &&
      zichtbaar(document.querySelector('.rtg-edge-top')) === e.top &&
      zichtbaar(document.querySelector('.rtg-edge-side')) === e.side &&
      zichtbaar(document.querySelector('.rtg-edge-bottom')) === e.bottom &&
      zichtbaar(document.querySelector('.rtg-edge2-reveal')) === e.reveal;
  }, { stand, ...verwacht }, { timeout: 6000 });
}

async function zetStand(page, stand, verwacht) {
  const gezet = await page.evaluate(s => !!(window.RTGEdge2 && window.RTGEdge2.setState(s)), stand);
  assert.equal(gezet, true, 'de publieke Edge 2-statepoort weigerde ' + stand);
  await wachtOpStand(page, stand, verwacht);
}

function assertStand(m, verwacht, label) {
  assert.equal(m.top.zichtbaar, verwacht.top, label + ': zichtbaarheid bovenrand');
  assert.equal(m.side.zichtbaar, verwacht.side, label + ': zichtbaarheid zijrand');
  assert.equal(m.bottom.zichtbaar, verwacht.bottom, label + ': zichtbaarheid onderrand');
  assert.equal(m.revealAantal, 1, label + ': herstelgreep bestaat exact één keer');
  assert.equal(m.revealZichtbaar, verwacht.reveal ? 1 : 0, label + ': zichtbaarheid herstelgreep');
  assert.equal(m.revealFocusbaar, verwacht.reveal ? 1 : 0, label + ': focusbaarheid herstelgreep');
  const inert = b => b.pointer === 'none' || b.display === 'none' || b.visibility === 'hidden';
  if (!verwacht.top) assert.ok(inert(m.top), label + ': verborgen bovenrand vangt nog invoer');
  if (!verwacht.side) assert.ok(inert(m.side), label + ': verborgen zijrand vangt nog invoer');
  if (!verwacht.bottom) assert.ok(inert(m.bottom), label + ': verborgen onderrand vangt nog invoer');
  assert.equal(m.contextDicht, true, label + ': statewissel laat geen contextlade open');
  assert.equal(m.contextOpenAttr, false, label + ': statewissel laat geen open contextstatus achter');
}

function assertInsets(overzicht, compact, focus, mobiel, label) {
  assert.ok(overzicht.padding.top - compact.padding.top >= 30,
    label + ': compact geeft de ruimte van de bovenrand niet terug');
  assert.ok(overzicht.padding.bottom >= 40, label + ': overzicht reserveert de onderrand niet');
  assert.ok(compact.padding.bottom >= 40, label + ': compact reserveert zijn enige zichtbare rand niet');
  assert.ok(compact.padding.bottom - focus.padding.bottom >= 38,
    label + ': focus geeft de ruimte van de onderrand niet terug');
  if (mobiel) {
    assert.ok(overzicht.padding.left <= 4 && compact.padding.left <= 4 && focus.padding.left <= 4,
      label + ': mobiel reserveert nog ruimte voor de verborgen zijrand');
  } else {
    assert.ok(overzicht.padding.left - compact.padding.left >= 38,
      label + ': compact geeft de ruimte van de zijrand niet terug');
    assert.ok(overzicht.padding.left - focus.padding.left >= 38,
      label + ': focus geeft de ruimte van de zijrand niet terug');
  }
}

async function controleerContextlade(page, label, route) {
  await page.click('.rtg-edge-2-context-button');
  await page.waitForFunction(() => document.body.hasAttribute('data-rtg-edge-2-context-open') &&
    !document.querySelector('.rtg-edge-2-context').hidden);
  const open = await page.evaluate(() => {
    const panel = document.querySelector('.rtg-edge-2-context');
    return {
      expanded: document.querySelector('.rtg-edge-2-context-button').getAttribute('aria-expanded'),
      slot: !!panel.querySelector('.rtg-edge-2-context-slot [data-rtg-edge-2-contextual]'),
      handelingen: panel.querySelectorAll('a[href],button,input,select,textarea,[tabindex]:not([tabindex="-1"])').length
    };
  });
  assert.equal(open.expanded, 'true', label + ': contextknop meldt de open stand niet');
  assert.equal(open.slot, true, label + ': contextlade toont niet de oorspronkelijke bediening');
  assert.ok(open.handelingen > 1, label + ': contextlade heeft naast sluiten geen handeling');
  if (route.pad === '/apps/rtg.html') {
    const contrast = await page.evaluate(() => {
      const kanaal = x => (x / 255 <= .03928 ? x / 3294 : Math.pow((x / 255 + .055) / 1.055, 2.4));
      const rgb = waarde => (waarde.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
      const verhouding = (voor, achter) => {
        const a = rgb(voor), b = rgb(achter);
        const l = c => .2126 * kanaal(c[0]) + .7152 * kanaal(c[1]) + .0722 * kanaal(c[2]);
        const x = l(a), y = l(b);
        return (Math.max(x, y) + .05) / (Math.min(x, y) + .05);
      };
      return ['.bank .merk', '.bank a:not(.actief)', '.bank a.actief', '.bank a span', '.topbar a']
        .map(selector => {
          const el = document.querySelector('.rtg-edge-2-context-slot ' + selector);
          const vlak = el && el.closest('[data-rtg-edge-2-contextual]');
          return { selector, ratio: el && vlak ? verhouding(getComputedStyle(el).color,
            getComputedStyle(vlak).backgroundColor) : 0 };
        });
    });
    contrast.forEach(x => assert.ok(x.ratio >= 4.5,
      label + ': onleesbare Living-context ' + x.selector + ' (' + x.ratio.toFixed(2) + ':1)'));
  }
  await page.click('.rtg-edge-2-context-close');
  await page.waitForFunction(() => !document.body.hasAttribute('data-rtg-edge-2-context-open') &&
    document.querySelector('.rtg-edge-2-context').hidden);
}

async function controleerRoute(page, route, scherm) {
  await page.setViewportSize(scherm.maat);
  await page.goto(route.basis + route.pad, { waitUntil: 'domcontentloaded' });
  const geland = new URL(await page.url());
  const verwachtPad = new URL(route.basis + route.pad).pathname;
  if (geland.pathname !== verwachtPad) return { omgeleid: geland.pathname };
  await wachtOpEdge2(page, verwachtPad);
  const naOpstart = new URL(await page.url());
  if (naOpstart.pathname !== verwachtPad) return { omgeleid: naOpstart.pathname };

  const label = route.naam + ' · ' + scherm.naam;
  await zetStand(page, 'overview', { ...scherm.overzicht, reveal: false });
  const overzicht = await page.evaluate(schermToestand, route);
  assertEenRand(overzicht, label + ' · overzicht');
  assertStand(overzicht, { ...scherm.overzicht, reveal: false }, label + ' · overzicht');
  assert.equal(overzicht.wereld, route.wereld, label + ': verkeerde wereldkleur/context');
  assertContext(overzicht, route, label);
  if (scherm.naam === 'desktop') await controleerContextlade(page, label, route);

  await zetStand(page, 'compact', { top: false, side: false, bottom: true, reveal: false });
  const compact = await page.evaluate(schermToestand, route);
  assertEenRand(compact, label + ' · compact');
  assertStand(compact, { top: false, side: false, bottom: true, reveal: false }, label + ' · compact');
  assert.deepEqual(compact.oudZichtbaar, [], label + ' · compact: oude chrome keert terug');

  await zetStand(page, 'focus', { top: false, side: false, bottom: false, reveal: true });
  const focus = await page.evaluate(schermToestand, route);
  assertEenRand(focus, label + ' · focus');
  assertStand(focus, { top: false, side: false, bottom: false, reveal: true }, label + ' · focus');
  assert.deepEqual(focus.oudZichtbaar, [], label + ' · focus: oude chrome keert terug');
  assertInsets(overzicht, compact, focus, scherm.naam === 'mobiel', label);

  /* Beide beloofde uitwegen uit focus zijn echte invoerwegen. Na elke weg is
     dezelfde Edge hersteld; er wordt dus geen tweede casco opgebouwd. */
  await page.click('.rtg-edge2-reveal');
  await wachtOpStand(page, 'overview', { ...scherm.overzicht, reveal: false });
  let hersteld = await page.evaluate(schermToestand, route);
  assertEenRand(hersteld, label + ' · herstelklik');
  assertStand(hersteld, { ...scherm.overzicht, reveal: false }, label + ' · herstelklik');

  await zetStand(page, 'focus', { top: false, side: false, bottom: false, reveal: true });
  await page.keyboard.press('Escape');
  await wachtOpStand(page, 'overview', { ...scherm.overzicht, reveal: false });
  hersteld = await page.evaluate(schermToestand, route);
  assertEenRand(hersteld, label + ' · Escape');
  assertStand(hersteld, { ...scherm.overzicht, reveal: false }, label + ' · Escape');
  return { omgeleid: null };
}

function ingebeddeToestand(route) {
  const frame = document.getElementById('rtg-edge-2-proefframe');
  const d = frame && frame.contentDocument, w = frame && frame.contentWindow;
  if (!d || !d.body || !w) return null;
  const zichtbaar = (el) => {
    if (!el) return false;
    const stijl = w.getComputedStyle(el), r = el.getBoundingClientRect();
    return stijl.display !== 'none' && stijl.visibility !== 'hidden' && Number(stijl.opacity) !== 0 &&
      r.right > 0 && r.bottom > 0 && r.left < w.innerWidth && r.top < w.innerHeight && r.width > 0 && r.height > 0;
  };
  const oudZichtbaar = [];
  route.oud.forEach(selector => d.querySelectorAll(selector).forEach(el => {
    if (zichtbaar(el)) oudZichtbaar.push(selector + ' <' + el.tagName.toLowerCase() + '>');
  }));
  return {
    geladen: frame.getAttribute('data-geladen'),
    pad: w.location.pathname,
    embed: d.body.classList.contains('rtg-edge-embed'),
    host: d.body.classList.contains('rtg-edge-host'),
    ready: d.body.hasAttribute('data-rtg-edge-ready'),
    rendered: d.body.hasAttribute('data-rtg-edge-2-rendered'),
    roots: d.querySelectorAll('.rtg-edge-chrome').length,
    top: d.querySelectorAll('.rtg-edge-top').length,
    side: d.querySelectorAll('.rtg-edge-side').length,
    bottom: d.querySelectorAll('.rtg-edge-bottom').length,
    vandaag: d.querySelectorAll('#rtg-vandaag-luxe').length,
    context: d.querySelectorAll('.rtg-edge-2-context,[data-rtg-edge-2-contextual]').length,
    oudZichtbaar,
    buitensteRoots: document.querySelectorAll('.rtg-edge-chrome').length
  };
}

test('Edge 2: acht routes hebben één adaptieve rand en embeds nooit een tweede',
  { skip: geenBrowser(pw) }, async (t) => {
  const { child, base } = await startServer({ env: { SMTP_URL: '' } });
  let browser;
  try {
    browser = await pw.chromium.launch(browserOpties(pw));
    const context = await browser.newContext();
    await context.addInitScript(() => {
      try {
        localStorage.removeItem('rtg.edge2.state.v1');
        localStorage.setItem('rtg_cookieinfo_v1', '1');
      } catch (e) {}
    });

    for (const routeVanTabel of ROUTES) {
      const route = { ...routeVanTabel, basis: base };
      for (const scherm of SCHERMEN) {
        await t.test(route.naam + ' · ' + scherm.naam, async (st) => {
          const page = await context.newPage();
          try {
            const uit = await controleerRoute(page, route, scherm);
            if (uit.omgeleid) st.skip('auth-afhankelijke route leidde naar ' + uit.omgeleid + '; geen contract omzeild');
          } finally { await page.close(); }
        });
      }
    }

    await t.test('dezelfde acht routes als echt iframe', async (st) => {
      const page = await context.newPage();
      try {
        await page.setViewportSize({ width: 1440, height: 900 });
        await page.goto(base + '/apps/rtg.html', { waitUntil: 'domcontentloaded' });
        await wachtOpEdge2(page);
        await zetStand(page, 'overview', { top: true, side: true, bottom: true, reveal: false });
        await page.evaluate(() => {
          const frame = document.createElement('iframe');
          frame.id = 'rtg-edge-2-proefframe';
          frame.title = 'Ingebedde Edge 2-proef';
          frame.style.cssText = 'position:fixed;inset:80px 80px 80px 100px;width:720px;height:560px;border:0;z-index:1';
          document.body.appendChild(frame);
        });

        for (const routeVanTabel of ROUTES) {
          const route = { ...routeVanTabel, basis: base };
          await st.test(route.naam, async (routeTest) => {
            await page.evaluate(pad => {
              const frame = document.getElementById('rtg-edge-2-proefframe');
              frame.removeAttribute('data-geladen');
              frame.onload = () => frame.setAttribute('data-geladen', pad);
              frame.src = pad;
            }, route.pad);
            await page.waitForFunction(pad => {
              const frame = document.getElementById('rtg-edge-2-proefframe');
              try {
                return frame.getAttribute('data-geladen') === pad && frame.contentDocument &&
                  frame.contentDocument.readyState === 'complete' && frame.contentDocument.body;
              } catch (e) { return false; }
            }, route.pad, { timeout: 15000 });
            const m = await page.evaluate(ingebeddeToestand, route);
            const verwachtPad = new URL(base + route.pad).pathname;
            if (m.pad !== verwachtPad) {
              routeTest.skip('auth-afhankelijke iframe-route leidde naar ' + m.pad + '; geen contract omzeild');
              return;
            }
            assert.equal(m.embed, true, route.naam + ': iframe is niet als embed gemarkeerd');
            assert.equal(m.host, false, route.naam + ': iframe reserveert nog ruimte voor eigen Edge');
            assert.equal(m.ready, false, route.naam + ': basis-Edge committeert binnen een iframe');
            assert.equal(m.rendered, false, route.naam + ': Edge 2 committeert binnen een iframe');
            assert.deepEqual([m.roots, m.top, m.side, m.bottom], [0, 0, 0, 0],
              route.naam + ': iframe bouwt geneste Edge-chrome');
            assert.equal(m.context, 0, route.naam + ': iframe verhuist lokale bediening naar een niet-bestaande Edge');
            assert.equal(m.vandaag, 0, route.naam + ': iframe bouwt een tweede Vandaag-presentatie');
            assert.deepEqual(m.oudZichtbaar, [],
              route.naam + ': iframe toont nog oude vaste chrome:\n' + m.oudZichtbaar.join('\n'));
            assert.equal(m.buitensteRoots, 1, route.naam + ': de buitenste Edge is tijdens embed vervangen of verdubbeld');
          });
        }
      } finally { await page.close(); }
    });
  } finally {
    if (browser) await browser.close();
    await stop(child);
  }
});
