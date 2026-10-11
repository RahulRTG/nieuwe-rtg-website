#!/usr/bin/env node
/* ============================================================================
   HOEVEEL VAN DE SCHIL START ER BIJ ELKE TIK OPNIEUW OP -- GEMETEN.

   WAAROM DIT SCRIPT ER IS

   Het gevoel "elk scherm is een eigen app" hoort een getal te zijn en geen
   gevoel. Het einddoel staat in WERKRUIMTE.md par. 12 ("De permanente
   schil"): een doorlopende applicatie waarin bij gewone navigatie geen schil
   herstart. Deze meter is de nulmeting voor die weg, en de liniaal die laat
   zien of elke stap ernaartoe werkelijk iets wegneemt.

   DE WEG DIE EEN DUIM NEEMT, EN NIET DE ADRESBALK

   De eerste versie van deze meter liep met page.goto van adres naar adres. Dat
   is niet wat een lid doet, en het verschil is de hele vraag. Een ingelogd lid
   staat op de werktafel (/apps/app.html, RTG Command), en een tik op een wereld
   in de bank roept RTGCommand.open() aan (shared/command/bank.js), dat de
   wereld als BLAD in een iframe zet (shared/command/werktafel.js, toon()). De
   buitenste schil blijft dan staan -- maar het blad start zijn eigen volledige
   stapel op: basis.js, de Edge-laag, de sessie. Een link binnen het blad laadt
   alleen het blad opnieuw; Home gaat langs de host.

   Daarom is de route hier een reeks HANDELINGEN en geen lijst adressen:
     laad     de werktafel als document openen (inloggen, of een kale
              /apps/app.html van buiten de werktafel)
     wereld   een wereld openen zoals de bank dat doet: RTGCommand.open(url)
     binnen   in het actieve blad een echte link aantikken (bestaat de link
              niet, dan zegt de stap dat en navigeert hij het blad zelf)
     thuis    Home, zoals de host dat afhandelt: RTGCommand.open('/apps/app.html')

   WAT HET MEET, PER STAP

     documenten   hoeveel nieuwe documenten de stap kostte, in ELK kader:
                  `buiten` (de werktafel zelf) en `blad` (een iframe). Elk
                  nieuw document is een herstart van zijn stapel. Een buiten-
                  document na de eerste lading betekent dat de host zelf
                  herlaadde; meer dan een document in een stap betekent dat een
                  scherm zichzelf na het opstarten nog eens laadde.
     schillen     hoeveel Edge-balken (`.rtg-edge-chrome`, zichtbaar) er na de
                  stap tegelijk in beeld staan, over alle kaders. Een is een
                  schil. Twee is de werktafel plus een blad dat zijn eigen schil
                  meebracht -- letterlijk "verschillende schillen op een scherm".
     scripts      scripts en KB JavaScript (gedecodeerd: wat de motor moet
                  parsen, ook uit de cache) in de nieuwe documenten van de stap.
     api          API-verzoeken van de stap, en welke DUBBEL gingen: dezelfde
                  methode en hetzelfde adres twee keer in hetzelfde kader.
     tijden       ms van het begin van de handeling tot het nieuwe document zijn
                  load had en tot zijn Edge-balk er stond.
     hoofddraad   de blokkerende tijd van lange animatieframes tijdens de stap
                  (Long Animation Frames; terugval longtask - 50 ms), gelezen op
                  het HOOFDvenster: de werktafel en zijn bladen delen een
                  hoofddraad, en een teller in het blad zelf zag zijn eigen werk
                  niet (de eerste versie meldde 0 ms bij 49 scripts op een
                  vertraagde CPU). Zolang die loopt, reageert een tik niet.
     geheugen     de JS-heap na de stap (CDP Performance.getMetrics), zodat te
                  zien is of een lange rondgang blijft groeien.

   HOE EERLIJK DE GETALLEN ZIJN -- de graden staan ook in het register.

   DOCUMENTEN en SCHILLEN zijn hard: de browser zegt het zelf. De TELLINGEN
   (scripts, api, dubbel) zijn gemeten; een dubbel telt pas als STRUCTUREEL als
   het in ELKE ronde optreedt, en een dubbel dat soms optreedt staat er apart
   bij (`dubbelSoms`) -- ook verspilling, maar een ratel die op een race
   wiebelt leert niemand iets.

   De TIJDEN zijn graad `vermoed`: Chromium op deze machine met de CPU vier
   keer vertraagd om een gewone telefoon te benaderen. Een echt toestel is dit
   niet. Ze staan als mediaan over de rondes in het register en hangen met
   opzet NIET aan de ratel: een ratel op een stopwatch zakt op een drukke
   CI-machine en leert mensen dat rood niets betekent.

   Elke meting begint met een OPWARMRONDE die niet telt: de service worker
   installeert zich en vult zijn cache, zoals bij een lid dat de app al eerder
   opende. Gemeten wordt de WARME tik -- die een lid honderd keer per dag doet.

   WAT HET NIET MEET

   Echte telefoons, echte netwerken, INP over interacties binnen een scherm, en
   of een herstart ZICHTBAAR is. Een herstart met een mooie overgang blijft een
   herstart; deze meter telt wat er gebeurt, niet hoe het eruitziet.

   DE RATEL. Twee tanden in NORM.json, allebei omlaag:
     schilHerstarts           nieuwe documenten over de route (buiten + blad),
                              behalve het allereerste document van de werktafel. Daalt doordat een stap
                              binnen een doorlopende schil komt -- en alleen
                              zo: een stap uit de route halen is een besluit,
                              en dan hoort de tand met de hand omlaag, met een
                              notitie.
     schilDubbeleVerzoeken    structureel dubbele API-verzoeken over de route.

   Draai:  npm run schilherstart            (meet en schrijft SCHILHERSTART.json)
           node scripts/schilherstart.js --rondes 5
           node scripts/schilherstart.js --droog   (meet, schrijft niets)
           node scripts/schilherstart.js --uit /tmp/voor.json
   ========================================================================== */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { stempel } = require('./lib/stempel');

const WORTEL = path.join(__dirname, '..');
const DOEL_STANDAARD = path.join(WORTEL, 'SCHILHERSTART.json');
const THUIS = '/apps/app.html';

/* De route. Elke stap noemt waarom hij erin staat, want een route zonder reden
   wordt ingekort zodra hij een slecht getal geeft. */
const ROUTE = [
  { doe: 'laad', pad: THUIS, waarom: 'de werktafel als document: na inloggen, of een kale /apps/app.html van buiten' },
  { doe: 'wereld', pad: '/apps/rtg.html', naam: 'LivingOS', waarom: 'een wereld openen vanuit de bank' },
  { doe: 'binnen', pad: '/apps/life.html', waarom: 'een onderdeel binnen LivingOS (Vandaag)' },
  { doe: 'thuis', pad: THUIS, waarom: 'Home' },
  { doe: 'wereld', pad: '/apps/reizen.html', naam: 'TravelOS', waarom: 'een tweede wereld vanuit de bank' },
  { doe: 'binnen', pad: '/apps/reisboek.html', waarom: 'een onderdeel binnen TravelOS (Reisboek): de kaart die de gedeeld-elementproef draagt' },
  { doe: 'thuis', pad: THUIS, waarom: 'Home' },
  { doe: 'wereld', pad: '/apps/geld.html', naam: 'Geld', waarom: 'Geld rechtstreeks uit de bank' },
  { doe: 'wereld', pad: '/apps/kantoor.html', naam: 'WorkOS', waarom: 'van wereld naar wereld zonder eerst Home' },
  { doe: 'wereld', pad: '/apps/foundation/os-publiek.html', naam: 'FoundationOS', waarom: 'en nog een' },
  { doe: 'thuis', pad: THUIS, waarom: 'Home' }
];

const VIEWPORT = { width: 390, height: 844 };
const CPU_VERTRAGING = 4;
const RUST_MS = 1500;          // zo lang geen nieuw verzoek en geen nieuw document = tot rust
const MAX_WACHT_MS = 20000;    // daarna telt de stap als niet tot rust

const arg = (naam) => { const i = process.argv.indexOf(naam); return i >= 0 ? process.argv[i + 1] : null; };
const RONDES = Math.max(1, Number(arg('--rondes')) || 3);
const DROOG = process.argv.includes('--droog');
/* --uit schrijft naar een ander bestand, voor een voor/na-vergelijking die het
   register in de wortel niet aanraakt. */
const DOEL = arg('--uit') ? path.resolve(arg('--uit')) : DOEL_STANDAARD;

const log = (s) => process.stderr.write(s + '\n');

/* De wacht: dit script schrijft een register, dus het start niet bij het
   requiren (scripts/meetkeuring.js houdt dit vast). */
if (require.main !== module) return;

/* ---------------------------------------------------------------------------
   DE SESSIE: een vers lid met een RTG Pass dat de ledenovereenkomst ECHT heeft
   getekend, langs dezelfde routes als scripts/edgedekking.js. Zonder getekende
   overeenkomst staat de intake voor de werktafel en meet je de deurmat. */
async function maakLid(base) {
  const post = async (pad, body, token) => {
    const r = await fetch(base + pad, { method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { Authorization: 'Bearer ' + token } : {}),
      body: JSON.stringify(body || {}) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(pad + ' gaf ' + r.status + ': ' + (j && j.error || ''));
    return j;
  };
  const u = Date.now().toString(36);
  const naam = 'Schilmeter Lid';
  const acc = await post('/api/auth/register', { name: naam, email: 'schilherstart' + u + '@voorbeeld.test',
    password: 'geheim12345', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' });
  if (!acc || !acc.token) throw new Error('registreren gaf geen token');
  const status = await post('/api/onboarding/status', {}, acc.token);
  const versie = status && status.contract && status.contract.versie;
  if (!Number.isSafeInteger(versie)) throw new Error('de onboardingstatus noemt geen contractversie');
  await post('/api/onboarding/teken', { naam, akkoord: true, contractVersion: versie }, acc.token);
  return acc.token;
}

/* ---------------------------------------------------------------------------
   IN ELK DOCUMENT, vóór zijn eerste script (addInitScript geldt ook in
   iframes): waarnemers voor lange frames en het moment waarop de Edge-balk
   verschijnt. Alleen gewone gegevens op een eigen globale naam. */
function waarnemers() {
  const w = window.__schilmeter = { lang: 0, loaf: false, edge: null };
  try {
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) w.lang += Math.max(0, e.blockingDuration || 0);
    }).observe({ type: 'long-animation-frame', buffered: true });
    w.loaf = true;
  } catch (e) {
    try {
      new PerformanceObserver((l) => {
        for (const e of l.getEntries()) w.lang += Math.max(0, e.duration - 50);
      }).observe({ type: 'longtask', buffered: true });
    } catch (e2) { w.lang = null; }
  }
  const kijk = () => {
    if (w.edge === null && document.querySelector('.rtg-edge-chrome')) w.edge = performance.now();
  };
  new MutationObserver(kijk).observe(document, { childList: true, subtree: true });
}

/* Wat een document over zichzelf zegt. `timeOrigin` is in epoch-ms, zodat de
   tijden tegen het begin van de HANDELING te zetten zijn en niet alleen tegen
   het begin van dit document. */
function inDocument() {
  const w = window.__schilmeter || {};
  const nav = performance.getEntriesByType('navigation')[0] || {};
  const res = performance.getEntriesByType('resource');
  const js = res.filter((x) => x.initiatorType === 'script' || /\.js(\?|$)/.test(x.name));
  const balk = document.querySelector('.rtg-edge-chrome');
  let zichtbaar = false;
  if (balk) {
    const s = getComputedStyle(balk);
    zichtbaar = s.display !== 'none' && s.visibility !== 'hidden' && balk.getClientRects().length > 0;
  }
  return {
    timeOrigin: performance.timeOrigin,
    pad: location.pathname,
    scripts: js.length,
    jsKB: Math.round(js.reduce((a, x) => a + (x.decodedBodySize || 0), 0) / 1024),
    load: nav.loadEventEnd ? nav.loadEventEnd : null,
    edge: w.edge === null || w.edge === undefined ? null : w.edge,
    lang: w.lang === null || w.lang === undefined ? null : Math.round(w.lang),
    schil: zichtbaar
  };
}

/* De handelingen, uitgevoerd in de pagina zoals een duim ze uitvoert. */
async function voerUit(page, s) {
  if (s.doe === 'laad') {
    await page.goto(page.__base + s.pad, { waitUntil: 'load', timeout: 60000 });
    /* De werktafel is pas de werktafel als de sessie hersteld is. Herlaadt hij
       zichzelf onderweg, dan verdwijnt de context waarin we wachten; dat is
       geen fout van de meting maar precies wat ze telt, dus opnieuw wachten. */
    const tot = Date.now() + 60000;
    for (;;) {
      try {
        await page.waitForFunction(() => {
          const app = document.getElementById('app');
          return !!(window.RTGCommand && app && app.classList.contains('active') && window.RTGCommand.actief());
        }, null, { timeout: 5000 });
        break;
      } catch (e) {
        if (Date.now() > tot) throw new Error('de werktafel kwam niet tot een actieve sessie: ' + e.message.split('\n')[0]);
      }
    }
    return { hoe: 'document' };
  }
  if (s.doe === 'wereld' || s.doe === 'thuis') {
    const ok = await page.evaluate((a) => {
      if (!window.RTGCommand || !window.RTGCommand.actief()) return false;
      window.RTGCommand.open(a.pad, a.naam || '');
      return true;
    }, { pad: s.pad, naam: s.naam });
    if (!ok) throw new Error(s.doe + ' ' + s.pad + ': RTGCommand is niet actief');
    return { hoe: 'RTGCommand.open' };
  }
  if (s.doe === 'binnen') {
    const blad = page.frames().filter((f) => f !== page.mainFrame() && !f.isDetached())
      .find((f) => { try { return new URL(f.url()).pathname === page.__blad; } catch (e) { return false; } });
    if (!blad) throw new Error('binnen ' + s.pad + ': geen actief blad op ' + page.__blad);
    return blad.evaluate((pad) => {
      const a = Array.from(document.querySelectorAll('a[href]')).find((x) => {
        try { return new URL(x.href, location.href).pathname === pad && x.getClientRects().length > 0; } catch (e) { return false; }
      });
      if (a) { a.click(); return { hoe: 'link' }; }
      location.href = pad;
      return { hoe: 'zonder-link' };
    }, s.pad);
  }
  throw new Error('onbekende handeling ' + s.doe);
}

async function stap(page, cdp, s) {
  const base = page.__base;
  const docs = [];                 // [{ frame, buiten, url }]
  const verzoeken = [];            // [{ frame, sleutel }]
  let laatste = Date.now();
  /* EEN DOCUMENT IS EEN timeOrigin. framenavigated gaat ook af bij een
     navigatie BINNEN een document (een #overzicht erachter, replaceState), en de
     eerste versie telde die als herstart: geld.html leek zichzelf te herladen en
     de werktafel ook, terwijl er alleen een adres veranderde. Een binding vanuit
     het document zelf haalde de bladen niet. Dus: bij elke navigatie de
     timeOrigin van het kader lezen, en alleen een NIEUWE telt. */
  const gezien = new Set();
  for (const f of page.frames()) {
    try { gezien.add(await f.evaluate(() => performance.timeOrigin)); } catch (e) { /* kader zonder document */ }
  }
  const lezingen = [];
  const opNav = (f) => {
    laatste = Date.now();
    const url = f.url();
    if (!/^https?:/.test(url)) return;
    lezingen.push(f.evaluate(() => performance.timeOrigin)
      .then((t) => ({ frame: f, buiten: f === page.mainFrame(), url, t }))
      .catch(() => ({ frame: f, buiten: f === page.mainFrame(), url, t: null })));
  };
  const opVerzoek = (q) => {
    const u = new URL(q.url());
    if (u.origin !== base || !u.pathname.startsWith('/api/')) return;
    verzoeken.push({ frame: q.frame(), sleutel: q.method() + ' ' + u.pathname + u.search });
    laatste = Date.now();
  };
  page.on('framenavigated', opNav);
  page.on('request', opVerzoek);
  /* De hoofddraad is er een voor de werktafel en al zijn bladen (zelfde
     herkomst, zelfde proces). Het hoofdvenster ziet dus de lange frames van
     alles wat er in beeld rekent; zijn teller voor en na de stap is de maat. */
  const topVoor = await page.evaluate(() => ({ t: performance.timeOrigin, lang: (window.__schilmeter || {}).lang })).catch(() => null);
  const begin = Date.now();
  let fout = null, hoe = null;
  try { hoe = (await voerUit(page, s)).hoe; }
  catch (e) { fout = e.message.split('\n')[0]; }
  laatste = Math.max(laatste, Date.now());
  while (Date.now() - laatste < RUST_MS && Date.now() - begin < MAX_WACHT_MS) await new Promise((r) => setTimeout(r, 100));
  const rustig = Date.now() - laatste >= RUST_MS;
  page.off('framenavigated', opNav);
  page.off('request', opVerzoek);
  for (const l of await Promise.all(lezingen)) {
    /* t === null: het kader verdween of herlaadde voordat we konden lezen. Dat
       is zelf een nieuw document geweest, dus het telt. */
    if (l.t !== null && gezien.has(l.t)) continue;
    if (l.t !== null) gezien.add(l.t);
    docs.push(l);
  }
  if (!rustig) log('  ' + s.doe + ' ' + s.pad + ': niet tot rust na ' + MAX_WACHT_MS + ' ms');

  const echt = docs;
  const buiten = echt.filter((d) => d.buiten).length;
  const blad = echt.length - buiten;

  /* Per nieuw document wat het kostte. Een kader dat meer dan eens navigeerde
     wordt een keer gelezen (zijn laatste document); de documententelling hierboven
     draagt het herladen. */
  const frames = [...new Set(echt.map((d) => d.frame))].filter((f) => !f.isDetached());
  const metingen = [];
  for (const f of frames) {
    try { metingen.push(await f.evaluate(inDocument)); } catch (e) { /* kader verdween tijdens het lezen */ }
  }
  /* Schillen in beeld: over ALLE kaders van de pagina, ook die niet nieuw zijn. */
  let schillen = 0;
  for (const f of page.frames()) {
    if (f.isDetached()) continue;
    try { if ((await f.evaluate(inDocument)).schil) schillen++; } catch (e) { /* kader zonder toegang */ }
  }
  /* Het actieve blad is het laatste nieuwe kader dat geen host is. */
  const nieuwBlad = echt.filter((d) => !d.buiten).pop();
  if (s.doe === 'thuis') page.__blad = null;
  else if (nieuwBlad) page.__blad = new URL(nieuwBlad.url).pathname;

  let heapMB = null;
  try {
    const { metrics } = await cdp.send('Performance.getMetrics');
    const h = metrics.find((x) => x.name === 'JSHeapUsedSize');
    if (h) heapMB = Math.round(h.value / 1048576 * 10) / 10;
  } catch (e) { heapMB = null; }

  const perKader = new Map();
  for (const v of verzoeken) {
    const k = perKader.get(v.frame) || {};
    k[v.sleutel] = (k[v.sleutel] || 0) + 1;
    perKader.set(v.frame, k);
  }
  const dubbel = [];
  for (const [f, k] of perKader) {
    const waar = f === page.mainFrame() ? 'buiten' : 'blad';
    for (const sl of Object.keys(k)) if (k[sl] > 1) dubbel.push(waar + ' ' + sl);
  }
  const topNa = await page.evaluate(() => ({ t: performance.timeOrigin, lang: (window.__schilmeter || {}).lang })).catch(() => null);
  let blokkeert = null;
  if (topNa && typeof topNa.lang === 'number') {
    blokkeert = topVoor && topVoor.t === topNa.t && typeof topVoor.lang === 'number' ? topNa.lang - topVoor.lang : topNa.lang;
    blokkeert = Math.round(blokkeert);
  }
  const ms = (veld) => {
    const v = metingen.map((m) => (m[veld] === null ? null : m.timeOrigin + m[veld] - begin)).filter((x) => x !== null);
    return v.length ? Math.round(Math.max(...v)) : null;
  };
  return {
    doe: s.doe, pad: s.pad, hoe, fout, rustig,
    buiten, blad, schillen,
    documentAdressen: echt.map((d) => (d.buiten ? 'buiten ' : 'blad ') + (() => { try { const u = new URL(d.url); return u.pathname + u.search + u.hash; } catch (e) { return '?'; } })()),
    scripts: metingen.reduce((a, m) => a + m.scripts, 0),
    jsKB: metingen.reduce((a, m) => a + m.jsKB, 0),
    api: verzoeken.length,
    dubbel: dubbel.sort(),
    load: ms('load'), edge: ms('edge'),
    hoofddraadBlokkeert: blokkeert,
    heapMB
  };
}

async function ronde(browser, base, token) {
  const ctx = await browser.newContext({ viewport: VIEWPORT, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await ctx.addInitScript((t) => {
    try { localStorage.setItem('rtg_member_token', t); localStorage.setItem('rtg_cookieinfo_v1', '1'); } catch (e) {}
  }, token);
  await ctx.addInitScript(waarnemers);
  const page = await ctx.newPage();
  page.__base = base; page.__blad = null;
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Performance.enable');
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU_VERTRAGING });
  const uit = [];
  for (const s of ROUTE) uit.push(await stap(page, cdp, s));
  await ctx.close();
  return uit;
}

const mediaan = (r) => {
  const a = r.filter((x) => typeof x === 'number').sort((x, y) => x - y);
  if (!a.length) return null;
  return a.length % 2 ? a[(a.length - 1) / 2] : Math.round((a[a.length / 2 - 1] + a[a.length / 2]) / 2);
};

(async () => {
  const { laadPlaywright, browserOpties, geenBrowser, startServer, stop } = require(path.join(WORTEL, 'test', 'helper.js'));
  const pw = laadPlaywright({ eigenDriver: false });
  const opties = pw ? browserOpties(pw) : null;
  if (!pw || !opties) {
    console.error('Geen browser: ' + (geenBrowser(pw) || 'onbekend') + '. Dit script meet in een echte browser.');
    process.exit(2);
  }
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-schilherstart-'));
  const srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP }, stderr: 'pipe' });
  srv.child.stderr.on('data', () => {});
  let browser;
  const rondes = [];
  try {
    const token = await maakLid(srv.base);
    browser = await pw.chromium.launch(opties);
    log('opwarmronde (telt niet)...');
    await ronde(browser, srv.base, token);
    for (let i = 0; i < RONDES; i++) {
      log('ronde ' + (i + 1) + '/' + RONDES + '...');
      rondes.push(await ronde(browser, srv.base, token));
    }
  } finally {
    if (browser) await browser.close().catch(() => {});
    try { stop(srv); } catch (e) { /* opruimen mag de meting niet breken */ }
    fs.rmSync(TMP, { recursive: true, force: true });
  }

  const stappen = ROUTE.map((s, i) => {
    const r = rondes.map((rd) => rd[i]);
    const sets = r.map((x) => new Set(x.dubbel));
    const structureel = [...sets[0]].filter((d) => sets.every((set) => set.has(d))).sort();
    const soms = [...new Set(r.flatMap((x) => x.dubbel))].filter((d) => !structureel.includes(d)).sort();
    const vals = (k) => r.map((x) => x[k]);
    return {
      doe: s.doe, pad: s.pad, waarom: s.waarom,
      hoe: [...new Set(vals('hoe').filter(Boolean))],
      documentAdressen: r[r.length - 1].documentAdressen,
      buiten: mediaan(vals('buiten')), blad: mediaan(vals('blad')),
      documentenSpreiding: [Math.min(...r.map((x) => x.buiten + x.blad)), Math.max(...r.map((x) => x.buiten + x.blad))],
      schillen: mediaan(vals('schillen')),
      scripts: mediaan(vals('scripts')), jsKB: mediaan(vals('jsKB')),
      api: mediaan(vals('api')),
      dubbel: structureel, dubbelSoms: soms,
      ms: { load: mediaan(vals('load')), edge: mediaan(vals('edge')) },
      hoofddraadBlokkeertMs: mediaan(vals('hoofddraadBlokkeert')),
      heapMB: mediaan(vals('heapMB')),
      nietTotRust: r.filter((x) => !x.rustig).length,
      fouten: r.map((x) => x.fout).filter(Boolean)
    };
  });

  const som = (k, lijst) => (lijst || stappen).reduce((a, s) => a + (s[k] || 0), 0);
  const naEerste = stappen.slice(1);
  const telling = {
    stappen: stappen.length,
    /* Het EERSTE document van de werktafel is de deur en geen herstart; elk
       document daarna wel -- ook een tweede document in die eerste stap, want
       dat is de werktafel die zichzelf na het opstarten nog eens laadt. */
    herstarts: Math.max(0, som('buiten') + som('blad') - 1),
    hostHerladen: Math.max(0, som('buiten') - 1),
    bladHerstarts: som('blad'),
    zelfherladingen: stappen.reduce((a, s) => a + Math.max(0, (s.buiten + s.blad) - (s.doe === 'thuis' ? 0 : 1)), 0),
    stappenMetTweeSchillen: stappen.filter((s) => s.schillen > 1).length,
    dubbeleVerzoeken: stappen.reduce((a, s) => a + s.dubbel.length, 0),
    dubbeleVerzoekenSoms: stappen.reduce((a, s) => a + s.dubbelSoms.length, 0),
    scripts: som('scripts'), scriptsNaEerste: som('scripts', naEerste),
    jsKB: som('jsKB'), jsKBNaEerste: som('jsKB', naEerste),
    api: som('api'),
    hoofddraadBlokkeertMs: som('hoofddraadBlokkeertMs'),
    heapMBEind: stappen[stappen.length - 1].heapMB,
    nietTotRust: som('nietTotRust'),
    fouten: stappen.reduce((a, s) => a + s.fouten.length, 0)
  };

  const register = {
    stempel: stempel(),
    uitleg: 'Per handeling van een vaste ledenroute over de werktafel (RTG Command) en de vier werelden: hoeveel nieuwe ' +
      'documenten de handeling kostte (buiten = de werktafel zelf, blad = een iframe-blad), hoeveel Edge-balken er daarna ' +
      'tegelijk in beeld stonden, hoeveel scripts en KB JavaScript de nieuwe documenten liepen, hoeveel API-verzoeken en ' +
      'welke dubbel gingen in hetzelfde kader, en hoe lang tot load en tot de Edge-balk van het nieuwe document. Vers lid ' +
      'met RTG Pass en getekende overeenkomst, ' + VIEWPORT.width + 'x' + VIEWPORT.height + ' touch, CPU ' + CPU_VERTRAGING +
      'x vertraagd, service worker aan, na een opwarmronde die niet telt. Per stap de mediaan over de rondes; dubbel = in ' +
      'ELKE ronde dubbel, dubbelSoms = in sommige. herstarts telt elk document behalve het allereerste van de werktafel.',
    graden: {
      documenten: 'gemeten -- een nieuwe performance.timeOrigin in een kader na framenavigated (navigatie binnen een document telt niet)',
      schillen: 'gemeten -- zichtbare .rtg-edge-chrome per kader na de stap',
      tellingen: 'gemeten -- resource timing en onderschepte verzoeken',
      tijden: 'vermoed -- Chromium op deze machine met CPU ' + CPU_VERTRAGING + 'x vertraagd, geen echt toestel',
      hoofddraad: 'vermoed -- som van blockingDuration van Long Animation Frames (terugval: longtask - 50 ms)'
    },
    route: ROUTE,
    rondes: RONDES,
    cpuVertraging: CPU_VERTRAGING,
    stappen,
    telling
  };

  for (const s of stappen) {
    const docs = (s.buiten ? 'buiten ' + s.buiten + ' ' : '') + (s.blad ? 'blad ' + s.blad : '');
    console.log(s.doe.padEnd(7) + s.pad.padEnd(34) + (docs || 'geen nieuw document').padEnd(18) +
      'schillen ' + s.schillen + '  scripts ' + String(s.scripts).padStart(3) + ' (' + s.jsKB + ' KB)' +
      '  api ' + String(s.api).padStart(3) + (s.dubbel.length ? ' dubbel ' + s.dubbel.length : '') +
      '  edge ' + s.ms.edge + ' ms  load ' + s.ms.load + ' ms  blokkeert ' + s.hoofddraadBlokkeertMs + ' ms' +
      (s.hoe.length ? '  [' + s.hoe.join(',') + ']' : ''));
    if (s.documentAdressen.length > 1) console.log('    documenten: ' + s.documentAdressen.join('  ->  '));
    for (const d of s.dubbel) console.log('    dubbel: ' + d);
    for (const f of s.fouten) console.log('    FOUT: ' + f);
  }
  console.log('schilherstart: ' + telling.herstarts + ' herstarts (' + telling.hostHerladen +
    ' van de werktafel zelf, ' + telling.bladHerstarts + ' in een blad); ' + telling.stappenMetTweeSchillen +
    ' stappen met meer dan een schil in beeld; ' + telling.dubbeleVerzoeken + ' structureel dubbele verzoeken (+' +
    telling.dubbeleVerzoekenSoms + ' soms); ' + telling.scriptsNaEerste + ' scripts en ' + telling.jsKBNaEerste +
    ' KB JavaScript na de eerste lading; hoofddraad blokkeert ' + telling.hoofddraadBlokkeertMs + ' ms.');
  if (telling.fouten || telling.nietTotRust) console.log('Let op: ' + telling.fouten + ' fouten, ' +
    telling.nietTotRust + ' keer niet tot rust gekomen.');
  if (telling.fouten) process.exitCode = 1;
  if (!DROOG) fs.writeFileSync(DOEL, JSON.stringify(register, null, 2) + '\n');
})().catch((e) => { console.error(e); process.exit(2); });
