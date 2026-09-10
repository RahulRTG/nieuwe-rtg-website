#!/usr/bin/env node
/* ============================================================================
   DE MOVEPROEF -- kan een lid RTG Move werkelijk gebruiken?

   WAAROM DEZE ER IS. `test/move-keten.test.js` bewijst dat de LAAG werkt: van
   twee echte boekingen naar een oordeel over HTTP. Dat zegt niets over de vraag
   of een mens erbij kan. BETROUWBAARHEID.md bewijs 1 is precies dat verschil,
   en het is hier al een keer duur geweest: RTG Move bestond drie commits lang
   als een API die geen enkel scherm aanriep, en zag er in elk register compleet
   uit.

   WAT HIJ MEET, en met opzet in twee soorten:

     SCHAKELS   handelt de een, en ziet de ander het? Van een echte boeking naar
                een oordeel op het scherm, en van het scherm naar Navigatie.
     STORINGEN  houdt het scherm zijn belofte als het misgaat? Geen sessie,
                geen reis, en een reis die Move NIET kan wegen -- dat laatste is
                de gevaarlijkste, want dan hoort er geen groen te staan.

   Draaien:  node scripts/moveproef.js [--vastleggen]
   ========================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');
const { start } = require('./lib/wegwerpserver');
const { startChromium, herkomst } = require('./lib/scherm');

const WORTEL = path.join(__dirname, '..');
const DOEL = path.join(WORTEL, 'MOVEPROEF.json');
const SCHERM = '/apps/move.html';
const vastleggen = process.argv.includes('--vastleggen');

const morgen = () => new Date(Date.now() + 86400000).toISOString().slice(0, 10);

async function post(basis, pad, lijf, tok) {
  const r = await fetch(basis + pad, { method: 'POST',
    headers: Object.assign({ 'Content-Type': 'application/json' }, tok ? { Authorization: 'Bearer ' + tok } : {}),
    body: JSON.stringify(lijf || {}) }).catch(() => null);
  if (!r) return { status: 0, data: null };
  return { status: r.status, data: await r.json().catch(() => null) };
}

/* Een ECHT lid langs de echte registratieroute; een nagebouwd token meet je
   eigen aanname en niet de deur. */
async function lidToken(basis) {
  const u = Date.now().toString().slice(-8) + Math.floor(Math.random() * 90 + 10);
  const r = await post(basis, '/api/auth/register', { name: 'Proeflid', email: 'mvp' + u + '@voorbeeld.nl',
    phone: '06' + u.slice(0, 8), password: 'geheim12345', geboortedatum: '1985-05-05', tier: 'rtg' });
  return r.data && r.data.token;
}

async function blad(browser, token) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'nl-NL' });
  const page = await ctx.newPage();
  const stuk = [];
  /* Een scriptfout is hier geen bijzaak. De gedeelde schil laadt met `defer` en
     verbouwt de header; wie als eerste in een kop schrijft, sloopt zijn eigen
     werkblad met een TypeError die eruitziet als een willekeurige flake. */
  page.on('pageerror', e => stuk.push(String(e && e.message || e)));
  if (token) {
    await page.addInitScript(t => { try { localStorage.setItem('rtg_member_token', t); } catch (e) {} }, token);
  }
  return { ctx, page, stuk };
}

const schakels = [], storingen = [];
const S = (nr, van, naar, wat, ziet, stand, antwoord) =>
  schakels.push({ nr, van, naar, wat, ziet, stand, antwoord });
const T = (naam, belofte, stand, wat) => storingen.push({ naam, belofte, stand, wat });

/* DE WACHT: dit instrument SCHRIJFT een register, dus hij mag niet gaan lopen
   omdat iemand hem requiret. Dat is geen theorie -- een laadcontrole
   (`node -e "require(...)"`) startte de rolproef een keer met de
   STANDAARDbegrenzing en schreef ROLPROEF.json van 3377 beproefde routes terug
   naar 292. Het register zag er daarna volkomen normaal uit. Zelfde vorm als
   scripts/navigatieproef.js; scripts/meetkeuring.js handhaaft hem. */
if (require.main === module) (async () => {
  /* startChromium geeft { pw, browser, waarmee } terug en `null` als er geen
     browser te vinden is. Dat laatste hoort te ZAKKEN en niet stil over te
     slaan: een proef die zichzelf overslaat als een dienst ontbreekt, is
     precies wat de norm `zelfpoortendeToetsen` telt. */
  const start3 = await startChromium();
  if (!start3 || !start3.browser) throw new Error('geen Chromium gevonden; deze proef kan niet zonder browser');
  const browser = start3.browser;
  const s = await start({ naam: 'move', env: { SMTP_URL: '', NODE_ENV: 'test', RTG_DEMO: '1' } });
  try {
    const token = await lidToken(s.basis);
    if (!token) throw new Error('geen proeflid: de registratieroute gaf geen token');

    /* --- SCHAKEL 1: een lid zonder reis krijgt geen leeg scherm maar een reden */
    {
      const { ctx, page, stuk } = await blad(browser, token);
      await page.goto(s.basis + SCHERM, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => {
        const o = document.querySelector('#oordeel');
        return o && !/gewogen…/.test(o.textContent);
      }, { timeout: 15000 }).catch(() => {});
      const leeg = await page.locator('.leeg b').first().textContent().catch(() => null);
      const knop = await page.locator('#verder:not([data-leeg])').isVisible().catch(() => false);
      S(1, 'lid zonder reis', 'scherm', 'opent RTG Move met een lege tijdlijn',
        'een uitgeschreven reden en GEEN verderknop naar nergens',
        (leeg && /nog geen reis/i.test(leeg) && !knop) ? 'gesloten' : 'open',
        'kop: "' + (leeg || '(niets)') + '", verderknop zichtbaar: ' + knop);
      T('een scherm zonder reis', 'geen scriptfout en geen verzonnen oordeel',
        stuk.length === 0 ? 'gehouden' : 'gebroken',
        stuk.length ? stuk.join(' | ') : 'nul paginafouten');
      await ctx.close();
    }

    /* --- SCHAKEL 2 en 3: twee echte boekingen worden een oordeel op het scherm */
    const d = morgen();
    const bk = await post(s.basis, '/api/booking/request',
      { supplierCode: 'KAITO', serviceId: 's1', date: d, time: '08:00' }, token);
    if (bk.status === 200) await post(s.basis, '/api/booking/pay', { ref: bk.data.boeking.ref }, token);
    const ch = await post(s.basis, '/api/member/vluchten/charter',
      { soort: 'privejet', bestemming: 'Parijs Le Bourget', datum: d, tijd: '09:30' }, token);
    S(2, 'lid', 'domein', 'boekt een afspraak van 08:00 en vraagt een charter van 09:30 aan',
      'beide staan vast in hun eigen domein', (bk.status === 200 && ch.status === 200) ? 'gesloten' : 'open',
      'boeking ' + bk.status + ', charter ' + ch.status);

    {
      const { ctx, page, stuk } = await blad(browser, token);
      await page.goto(s.basis + SCHERM, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('.naad', { timeout: 15000 }).catch(() => {});
      const oordeel = await page.locator('#oordeel').textContent().catch(() => '');
      const dekking = await page.locator('#mDekking').textContent().catch(() => '');
      const badge = await page.locator('.naad .uit').first().textContent().catch(() => '');
      const cijfers = await page.locator('.naad .cijfers').first().textContent().catch(() => '');
      S(3, 'domein', 'scherm', 'het lid opent Move',
        'een oordeel over de overgang, met de dekking en de minuten erbij',
        (/betrouwbaar|lucht|lukken/i.test(oordeel) && /%/.test(dekking) && /min/.test(cijfers)) ? 'gesloten' : 'open',
        'oordeel "' + oordeel.trim() + '", dekking ' + dekking.trim() + ', naad "' + badge.trim() + '": ' + cijfers.trim());

      /* --- SCHAKEL 4: de verderknop noemt de VOLGENDE PLEK en niet de bestemming */
      const label = await page.locator('#verder').textContent().catch(() => '');
      S(4, 'scherm', 'reiziger', 'de verderknop wordt samengesteld uit /api/move/volgende',
        'hij noemt de luchthaven waar je moet zijn, niet de stad waar het vliegtuig heen gaat',
        (/airport|luchthaven/i.test(label) && !/parijs|bourget/i.test(label)) ? 'gesloten' : 'open',
        'knop: "' + label.trim() + '"');

      /* --- SCHAKEL 5: en hij KOMT ergens aan */
      await page.locator('#verder').click().catch(() => {});
      await page.waitForURL(/navigatie\.html/, { timeout: 10000 }).catch(() => {});
      const url = page.url();
      const q = new URL(url).searchParams;
      const naar = String(q.get('naar') || '').split(',').map(Number);
      S(5, 'reiziger', 'Navigatie', 'tikt op verder',
        'Navigatie krijgt de OPGELOSTE plek mee, dus er wordt niets opnieuw geraden',
        (/navigatie\.html/.test(url) && naar.length === 2 && Number.isFinite(naar[0])) ? 'gesloten' : 'open',
        'url: ' + url.replace(s.basis, ''));
      T('het scherm en de overdracht samen', 'geen enkele paginafout',
        stuk.length === 0 ? 'gehouden' : 'gebroken',
        stuk.length ? stuk.join(' | ') : 'nul paginafouten');
      await ctx.close();
    }

    /* --- STORING: geen sessie */
    {
      const { ctx, page } = await blad(browser, null);
      await page.goto(s.basis + SCHERM, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => {
        const t = document.querySelector('#toelichting');
        return t && t.textContent.trim().length > 0;
      }, { timeout: 15000 }).catch(() => {});
      const uitleg = await page.locator('#toelichting').textContent().catch(() => '');
      const oordeel = await page.locator('#oordeel').textContent().catch(() => '');
      T('zonder sessie', 'zegt dat je moet inloggen, en toont GEEN oordeel',
        (/aan te melden|meld u aan|inloggen/i.test(uitleg) && !/lucht|betrouwbaar/i.test(oordeel))
          ? 'gehouden' : 'gebroken',
        'oordeel "' + oordeel.trim() + '", toelichting "' + uitleg.trim() + '"');
      await ctx.close();
    }

    /* --- STORING: een reis die Move NIET kan wegen mag geen groen opleveren.
       Dit is de gevaarlijkste faalvorm van deze laag (MOVE.md: wie de dekking
       negeert, ziet een oordeel over de helft van een reis als een oordeel over
       de reis). Een reisbureau-onderdeel draagt met opzet geen plek. */
    {
      const t2 = await lidToken(s.basis);
      /* Een reisbureau-aanvraag vraagt een bestaande reis uit de catalogus; die
         wordt hier opgehaald in plaats van een id te verzinnen. */
      const cat = await post(s.basis, '/api/reisbureau', {}, t2);
      const reizen = (cat.data && (cat.data.reizen || cat.data.trips || cat.data.aanbod)) || [];
      const r = reizen[0]
        ? await post(s.basis, '/api/reisbureau/boek', { tripId: reizen[0].id, vertrek: morgen(), personen: 2 }, t2)
        : { status: 0, data: null };
      const { ctx, page } = await blad(browser, t2);
      await page.goto(s.basis + SCHERM, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => {
        const o = document.querySelector('#oordeel');
        return o && !/gewogen…/.test(o.textContent);
      }, { timeout: 15000 }).catch(() => {});
      const oordeel = await page.locator('#oordeel').textContent().catch(() => '');
      const dekking = await page.locator('#mDekking').textContent().catch(() => '');
      T('een reis die niet te wegen is', 'geen groen oordeel, en de dekking zegt het',
        !/lucht/i.test(oordeel) ? 'gehouden' : 'gebroken',
        'reizen in catalogus ' + reizen.length + ', aanvraag ' + r.status +
        ', oordeel "' + oordeel.trim() + '", dekking ' + dekking.trim());
      await ctx.close();
    }
  } finally {
    await browser.close().catch(() => {});
    await s.klaar();
  }

  const open = schakels.filter(x => x.stand === 'open');
  const gebroken = storingen.filter(x => x.stand === 'gebroken');
  const uit = {
    stempel: new Date().toISOString().slice(0, 10),
    uitleg: 'Kan een lid RTG Move werkelijk gebruiken? Schakels: handelt de een en ziet de ander het. ' +
      'Storingen: houdt het scherm zijn belofte als het misgaat.',
    grens: 'Dit is de tafel-keten van Move op een telefoonformaat in een echte browser. Het meet niet ' +
      'of de reistijd juist is (dat doet de routemotor) en niet of een voorstel wordt uitgevoerd -- ' +
      'dat gebeurt met opzet nergens.',
    browser: herkomst(),
    schakels, storingen,
    sluit: open.length === 0 && gebroken.length === 0
  };

  console.log('\nDE MOVEPROEF\n');
  for (const k of schakels) {
    console.log('  ' + (k.stand === 'gesloten' ? '✓' : '✗') + ' schakel ' + k.nr + ': ' + k.wat);
    console.log('      ' + k.antwoord);
  }
  console.log('');
  for (const t of storingen) {
    console.log('  ' + (t.stand === 'gehouden' ? '✓' : '✗') + ' ' + t.naam + ': ' + t.belofte);
    console.log('      ' + t.wat);
  }
  console.log('\n  ' + schakels.filter(x => x.stand === 'gesloten').length + '/' + schakels.length +
    ' schakels gesloten, ' + storingen.filter(x => x.stand === 'gehouden').length + '/' + storingen.length +
    ' storingen gehouden\n');

  if (vastleggen) { fs.writeFileSync(DOEL, JSON.stringify(uit, null, 1) + '\n'); console.log('  MOVEPROEF.json geschreven.\n'); }
  process.exit(uit.sluit ? 0 : 1);
})().catch(e => { console.error('STUK:', e); process.exit(1); });
