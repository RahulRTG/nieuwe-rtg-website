/* DE VIER WERELDHOMES ZIJN HUN EIGEN DASHBOARD.

   Deze proef bewaakt de grens die bij de nieuwe schil het makkelijkst weer
   vervaagt: de gedeelde laag mag de echte Living-, Work-, Travel- en
   Foundation-DOM alleen opmaken. Zij mag geen vijfde inhoudslaag, tweede kop
   of tweede bediening tekenen.

   Daarom meten we in een echte browser op de kleinste telefoon, de gewone
   telefoon en desktop:
   - het expliciete dashboard-commitpunt en de oorspronkelijke main;
   - precies een Edge, met de oude lokale balken uitsluitend in zijn context;
   - geen oude luxe-cover en geen horizontaal afgesneden canvas;
   - meerdere echte panelen uit iedere wereld;
   - een bestaande handeling die na de restyle nog werkelijk iets doet. */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  browserOpties, geenBrowser, geduld, kantoorAlsPersoon, laadPlaywright,
  letOpFouten, postJson, startServer, stop
} = require('./helper');

const pw = laadPlaywright();
const OFFICE_CODE = 'WORLD-DASHBOARD-KEURING';
const BEELDMAP = process.env.RTG_WORLD_DASHBOARD_SHOTS || '';

const WERELDEN = [
  {
    naam: 'LivingOS', wereld: 'living', pad: '/apps/rtg.html', hoofd: '#inhoud',
    panelen: ['.dag', '.kompas', '#reisdossier'],
    context: ['living-bank', 'living-top'],
    oud: [
      '.os-switcher', '.schil > .bank', '.schil > .topbar',
      'body > .rtgdeel-balk', 'body > header.ios-nav', 'body > .ios-thuis', '#osMenuBtn'
    ]
  },
  {
    naam: 'WorkOS', wereld: 'work', pad: '/apps/kantoor.html', hoofd: '#inhoud',
    panelen: ['.doelgroep', '.cv-rij', '#werkdag', '#poorten'],
    context: ['wereldtabs', 'wereldapps'],
    oud: [
      'body > .wereldtabs', 'body > .wereldapps', 'body > .rtgdeel-balk',
      'body > header.ios-nav', 'body > .ios-thuis', '#osMenuBtn'
    ]
  },
  {
    naam: 'TravelOS', wereld: 'travel', pad: '/apps/reizen.html', hoofd: '#inhoud',
    panelen: ['.dagdek', '.strook', '.kaartraster', '.kompas'],
    context: ['travel-header', 'hoofdtabs'],
    oud: [
      '.reisapp > .prestatiekop', '.reisapp > .hoofdtabs', '.tos-topbar', '.tos-nav',
      'body > .rtgdeel-balk', 'body > header.ios-nav', 'body > .ios-thuis', '#osMenuBtn'
    ]
  },
  {
    naam: 'FoundationOS', wereld: 'foundation', pad: '/apps/foundation/os-publiek.html', hoofd: '#main',
    panelen: ['.onthaal', '.tweeluik', '.doen', '.band'],
    context: ['world-shell'],
    oud: [
      'body > .ws-balk', 'body > .rtgdeel-balk', 'body > header.ios-nav',
      'body > .ios-thuis', '#osMenuBtn'
    ]
  }
];

const MATEN = [
  { naam: '320', width: 320, height: 700 },
  { naam: '390', width: 390, height: 844 },
  { naam: 'desktop', width: 1440, height: 900 }
];

async function maakPubliekeStad(base) {
  const post = postJson(base);
  const token = await kantoorAlsPersoon(base, OFFICE_CODE);
  assert.ok(token, 'voor de Foundation-handeling is een herleidbare kantoorsessie nodig');
  const gemaakt = await post('/api/rtfos/stad/maak', { naam: 'Dashboardstad' }, token);
  assert.ok(gemaakt && gemaakt.stad && gemaakt.stad.id,
    'de publieke dashboardstad kon niet worden gemaakt: ' + JSON.stringify(gemaakt));
  const actief = await post('/api/rtfos/stad/status', {
    id: gemaakt.stad.id, status: 'actief'
  }, token);
  assert.ok(actief && !actief.error,
    'de publieke dashboardstad kon niet worden geopend: ' + JSON.stringify(actief));
  return gemaakt.stad.id;
}

async function maakKomendeReis(base, token) {
  const post = postJson(base);
  const datum = new Date(Date.now() + 20 * 86400000).toISOString().slice(0, 10);
  const gelezen = await post('/api/reis/invoer/lees', {
    tekst: 'Reis naar Ibiza, vertrek ' + datum
  }, token);
  assert.ok(gelezen && gelezen.voorstel && gelezen.voorstel.id,
    'het echte Travel-dashboard kon geen voorstel lezen: ' + JSON.stringify(gelezen));
  const bevestigd = await post('/api/reis/invoer/bevestig', {
    id: gelezen.voorstel.id,
    velden: {
      titel: 'Reis naar Ibiza', soort: 'activiteit', bestemming: 'Ibiza', van_datum: datum
    }
  }, token);
  assert.ok(bevestigd && bevestigd.ok && bevestigd.onderdeel,
    'het echte Travel-dashboard kon geen komende reis vastleggen: ' + JSON.stringify(bevestigd));
}

async function dashboardMeting(page, route) {
  return page.evaluate((cfg) => {
    const layoutZichtbaar = (el) => {
      if (!el || el.hidden) return false;
      const s = getComputedStyle(el), r = el.getBoundingClientRect();
      return s.display !== 'none' && s.visibility !== 'hidden' && Number(s.opacity) !== 0 &&
        r.width > 1 && r.height > 1;
    };
    const inKijkvlak = (el) => {
      if (!layoutZichtbaar(el)) return false;
      const r = el.getBoundingClientRect();
      return r.right > 0 && r.left < document.documentElement.clientWidth &&
        r.bottom > 0 && r.top < document.documentElement.clientHeight;
    };
    const beschrijf = (el, selector) => {
      const r = el.getBoundingClientRect();
      return selector + ' <' + el.tagName.toLowerCase() +
        (el.id ? '#' + el.id : '') + '> @ ' +
        [r.left, r.top, r.width, r.height].map(Math.round).join(',');
    };
    const rechthoek = (el) => {
      const r = el.getBoundingClientRect();
      return { left: r.left, top: r.top, right: r.right, bottom: r.bottom,
        width: r.width, height: r.height };
    };

    const hoofd = document.querySelector(cfg.hoofd);
    const slot = document.querySelector('.rtg-edge-2-context-slot');
    const panelen = [];
    const ontbrekend = [];
    cfg.panelen.forEach((selector) => {
      const gevonden = [...document.querySelectorAll(selector)].filter(layoutZichtbaar);
      if (!gevonden.length) ontbrekend.push(selector);
      gevonden.forEach((el) => { if (!panelen.includes(el)) panelen.push(el); });
    });
    const paneelBuiten = panelen.filter((el) => {
      const r = el.getBoundingClientRect();
      return r.left < -1 || r.right > document.documentElement.clientWidth + 1;
    }).map((el) => beschrijf(el, 'paneel'));

    const oudZichtbaar = [];
    cfg.oud.forEach((selector) => document.querySelectorAll(selector).forEach((el) => {
      if ((!slot || !slot.contains(el)) && inKijkvlak(el))
        oudZichtbaar.push(beschrijf(el, selector));
    }));
    const contextueel = [...document.querySelectorAll('[data-rtg-edge-2-contextual]')];
    const contextBuiten = contextueel.filter((el) => !slot || !slot.contains(el))
      .map((el) => beschrijf(el, 'context'));
    const kopAfgesneden = [...hoofd.querySelectorAll('h1,h2,h3')].filter(layoutZichtbaar)
      .filter((el) => {
        const s = getComputedStyle(el);
        return el.scrollWidth > el.clientWidth + 2 ||
          ((s.overflowY === 'hidden' || s.overflowY === 'clip') &&
            el.scrollHeight > el.clientHeight + 2);
      })
      .map((el) => beschrijf(el, 'kop'));
    const html = document.documentElement, body = document.body;
    const canvas = rechthoek(hoofd);

    return {
      wereld: body.getAttribute('data-rtg-world'),
      dashboard: body.getAttribute('data-rtg-world-dashboard'),
      gereed: body.getAttribute('data-rtg-world-dashboard-ready'),
      render: body.getAttribute('data-rtg-vandaag-render'),
      hoofdId: hoofd && hoofd.id,
      dashboardKnopen: document.querySelectorAll('.rtg-world-dashboard').length,
      dashboardWereld: hoofd && hoofd.getAttribute('data-rtg-dashboard-world'),
      luxe: document.querySelectorAll('#rtg-vandaag-luxe,#rtg-vandaag-surface-cover,.rtg-vandaag-surface-cover').length,
      edge: {
        wortels: document.querySelectorAll('.rtg-edge-chrome').length,
        boven: document.querySelectorAll('.rtg-edge-top').length,
        zij: document.querySelectorAll('.rtg-edge-side').length,
        onder: document.querySelectorAll('.rtg-edge-bottom').length,
        genest: document.querySelectorAll('.rtg-edge-chrome .rtg-edge-chrome').length
      },
      contextTokens: contextueel.map((el) => el.getAttribute('data-rtg-edge-2-contextual')),
      contextBuiten, oudZichtbaar,
      canvas, panelen: panelen.length, ontbrekend, paneelBuiten, kopAfgesneden,
      viewport: html.clientWidth,
      documentOverloop: Math.max(html.scrollWidth, body.scrollWidth) - html.clientWidth,
      canvasOverloop: hoofd.scrollWidth - hoofd.clientWidth
    };
  }, route);
}

function keurDashboard(m, route, maat) {
  const label = route.naam + ' @ ' + maat.naam;
  assert.equal(m.wereld, route.wereld, label + ': verkeerde wereldrol');
  assert.equal(m.dashboard, route.wereld, label + ': dashboard-opt-in ontbreekt');
  assert.equal(m.gereed, 'true', label + ': dashboard heeft zijn commitpunt niet bereikt');
  assert.equal(m.render, 'dashboard', label + ': verkeerde renderstand');
  assert.equal(m.hoofdId, route.hoofd.slice(1), label + ': niet de oorspronkelijke main is opgemaakt');
  assert.equal(m.dashboardKnopen, 1, label + ': er hoort precies één native dashboardcanvas te zijn');
  assert.equal(m.dashboardWereld, route.wereld, label + ': canvas draagt de verkeerde wereldmarker');
  assert.equal(m.luxe, 0, label + ': oude of dubbele luxe-cover staat nog in de DOM');
  assert.deepEqual(m.edge, { wortels: 1, boven: 1, zij: 1, onder: 1, genest: 0 },
    label + ': niet exact één Edge-casco');
  assert.deepEqual(m.contextBuiten, [], label + ': lokale chrome staat buiten het ene contextslot');
  for (const token of route.context)
    assert.ok(m.contextTokens.includes(token), label + ': contextbron ontbreekt: ' + token);
  assert.deepEqual(m.oudZichtbaar, [],
    label + ': oude balk buiten Edge-context zichtbaar:\n' + m.oudZichtbaar.join('\n'));
  assert.deepEqual(m.ontbrekend, [], label + ': native panelen ontbreken: ' + m.ontbrekend.join(', '));
  assert.ok(m.panelen >= 3, label + ': dashboard toont geen meervoudige native panelen');
  assert.ok(m.canvas.width >= (maat.width >= 1000 ? maat.width * .72 : maat.width * .84),
    label + ': canvas is geen brede werkruimte: ' + JSON.stringify(m.canvas));
  assert.ok(m.canvas.left >= -1 && m.canvas.right <= m.viewport + 1,
    label + ': canvas valt buiten het kijkvlak: ' + JSON.stringify(m.canvas));
  assert.ok(m.documentOverloop <= 1,
    label + ': document is ' + Math.ceil(m.documentOverloop) + 'px horizontaal te breed');
  assert.ok(m.canvasOverloop <= 1,
    label + ': dashboard maskeert ' + Math.ceil(m.canvasOverloop) + 'px horizontale inhoud');
  assert.deepEqual(m.paneelBuiten, [],
    label + ': native paneel valt buiten beeld:\n' + m.paneelBuiten.join('\n'));
  assert.deepEqual(m.kopAfgesneden, [],
    label + ': koptekst is afgesneden:\n' + m.kopAfgesneden.join('\n'));
}

async function raakdoel(page, selector, label) {
  const maat = await page.$eval(selector, (el) => {
    const r = el.getBoundingClientRect(), s = getComputedStyle(el);
    return { width: r.width, height: r.height, left: r.left, right: r.right,
      display: s.display, visibility: s.visibility, pointer: s.pointerEvents };
  });
  assert.ok(maat.width >= 44 && maat.height >= 44,
    label + ': echt raakdoel is kleiner dan 44px: ' + JSON.stringify(maat));
  assert.ok(maat.left >= -1 && maat.right <= await page.evaluate(() => document.documentElement.clientWidth) + 1,
    label + ': echt raakdoel valt buiten beeld: ' + JSON.stringify(maat));
  assert.notEqual(maat.display, 'none', label + ': echt raakdoel is display:none');
  assert.notEqual(maat.visibility, 'hidden', label + ': echt raakdoel is verborgen');
  assert.notEqual(maat.pointer, 'none', label + ': echt raakdoel neemt geen invoer aan');
}

async function bewijsHandeling(page, route, maat) {
  const label = route.naam + ' @ ' + maat.naam;
  if (route.wereld === 'living') {
    const cta = '.dagkop .rtg-dashboard-hero-cta[href="/apps/vandaag.html"]';
    await page.waitForSelector(cta, { state: 'visible', timeout: geduld(8000) });
    await raakdoel(page, cta, label);
    await page.click('[data-paneel="alles"]');
    await page.waitForFunction(() => {
      const knop = document.querySelector('[data-paneel="alles"]');
      const paneel = document.querySelector('[data-inhoud="alles"]');
      return knop && knop.classList.contains('actief') && paneel &&
        getComputedStyle(paneel).display !== 'none';
    }, null, { timeout: geduld(6000) });
    return;
  }
  if (route.wereld === 'work') {
    const actie = '[data-work-kies="ondernemers"]';
    await raakdoel(page, actie, label);
    await page.click(actie);
    await page.waitForFunction(() => {
      const paneel = document.querySelector('[data-work-paneel="ondernemers"]');
      const knop = document.querySelector('[data-work-kies="ondernemers"]');
      return document.body.dataset.workDoelgroep === 'ondernemers' && paneel && !paneel.hidden &&
        knop && knop.getAttribute('aria-current') === 'page';
    }, null, { timeout: geduld(6000) });
    return;
  }
  if (route.wereld === 'travel') {
    const actie = '.kaartraster [data-naar-blad="reizen"]';
    await page.waitForSelector(actie, { state: 'visible', timeout: geduld(15000) });
    await raakdoel(page, actie, label);
    await page.click(actie);
    await page.waitForFunction(() => {
      const blad = document.querySelector('[data-blad="reizen"]');
      const tab = document.querySelector('[data-tab="reizen"]');
      return blad && !blad.hidden && blad.classList.contains('actief') && tab &&
        tab.getAttribute('aria-current') === 'page';
    }, null, { timeout: geduld(6000) });
    return;
  }
  const actie = '#steden [data-stad]';
  await page.waitForSelector(actie, { state: 'visible', timeout: geduld(15000) });
  await raakdoel(page, actie, label);
  await page.click(actie);
  await page.waitForSelector('#uit .buurtkaart', { state: 'visible', timeout: geduld(15000) });
  assert.equal(await page.getAttribute('body', 'data-rtg-world-dashboard-ready'), 'true',
    label + ': stad openen deactiveerde het dashboard');
}

test('vier wereldhomes blijven native dashboards op 320, 390 en desktop',
  { skip: geenBrowser(pw) }, async (t) => {
  const { child, base } = await startServer({ env: { SMTP_URL: '', OFFICE_CODE } });
  let browser;
  try {
    await maakPubliekeStad(base);
    const login = await postJson(base)('/api/auth/login', {
      login: 'roellie.i@gmail.com', password: 'Imran', pasApp: 'business'
    });
    assert.ok(login && login.token, 'geen echte ledensessie voor de werelddata');
    await maakKomendeReis(base, login.token);

    browser = await pw.chromium.launch(browserOpties(pw));
    for (const maat of MATEN) {
      const context = await browser.newContext({
        serviceWorkers: 'block', viewport: { width: maat.width, height: maat.height }
      });
      await context.addInitScript((token) => {
        localStorage.setItem('rtg_cookieinfo_v1', '1');
        localStorage.setItem('rtg_member_token', token);
        localStorage.removeItem('rtg.edge2.state.v1');
      }, login.token);
      try {
        for (const route of WERELDEN) await t.test(route.naam + ' · ' + maat.naam, async () => {
          const page = await context.newPage();
          const fouten = [];
          letOpFouten(page, fouten);
          try {
            await page.goto(base + route.pad, { waitUntil: 'domcontentloaded' });
            await page.waitForFunction((cfg) => {
              const hoofd = document.querySelector(cfg.hoofd);
              return document.body.getAttribute('data-rtg-world-dashboard-ready') === 'true' &&
                document.body.getAttribute('data-rtg-edge-2-rendered') === 'true' &&
                hoofd && hoofd.classList.contains('rtg-world-dashboard') &&
                hoofd.getAttribute('data-rtg-dashboard-world') === cfg.wereld &&
                document.querySelectorAll('.rtg-edge-2-context-slot').length === 1;
            }, route, { timeout: geduld(20000) });
            const meting = await dashboardMeting(page, route);
            keurDashboard(meting, route, maat);
            if (BEELDMAP && (maat.width === 390 || maat.width === 1440)) {
              fs.mkdirSync(BEELDMAP, { recursive: true });
              await page.evaluate(() => document.fonts && document.fonts.ready);
              await page.screenshot({
                path: path.join(BEELDMAP, route.wereld + '-' + maat.width + '.png'),
                fullPage: true
              });
            }
            await bewijsHandeling(page, route, maat);
            assert.deepEqual(fouten, [], labelVoor(route, maat) + ': paginafouten: ' + fouten.join(' | '));
          } finally { await page.close(); }
        });
      } finally { await context.close(); }
    }
  } finally {
    if (browser) await browser.close();
    await stop(child);
  }
});

function labelVoor(route, maat) { return route.naam + ' @ ' + maat.naam; }
