/* ============================================================================
   EEN INGEBED SCHERM HEEFT EEN BEDIENING, EN DAT IS DIE VAN ZIJN OUDER.

   ONTWERP.md legt dat al vast: "In een iframe, ?embed=1 of Command-oppervlak
   wordt geen tweede Edge gestart en wordt de lokale vaste chrome van het kind
   onderdrukt." Die belofte werd tot nu toe waargemaakt door een SELECTORLIJST in
   rtg-edge-system.css: elke balk stond er bij naam in. Dat werkt precies zolang
   iemand eraan denkt een nieuwe balk toe te voegen, en dat is het niet.

   GEMETEN IN EEN ECHT KADER, 291 unieke schermen, 17 september 2026: tien
   sociale schermen droegen hun eigen suitebalk EN suitenavigatie, vier
   ops-schermen hun eigen opsnavigatie, Salon en Sociaal hun eigen commandobalk,
   en Berichten daarbovenop een statusstrook met een eigen commandoknop. In een
   werkvlak stond de bediening daar dus twee keer: die van de ouder eromheen, en
   die van het kind erin.

   Sindsdien draagt platformchrome de marker `data-rtg-platform-chrome` op de
   plek waar het gebouwd wordt, en haalt EEN regel het in een embed weg. Deze
   toets bewaakt de UITKOMST en niet het middel, in drie beweringen:

   1. IN EEN ECHT KADER IS ER GEEN PLATFORMCHROME. Niet "de marker staat er",
      maar: niets met die marker is zichtbaar, en de balken die het ooit waren
      zijn met naam en toenaam weg.
   2. DE BESTURINGSPROEF. Dezelfde schermen ZONDER kader tonen die balken wel.
      Zonder deze helft slaagt de toets ook wanneer iemand de balken gewoon
      sloopt, en dan bewaakt hij een verwijdering in plaats van een contract --
      een instrument dat niet kan uitslaan is geen instrument (BEWIJSMACHINE.md
      par. 6a).
   3. SCHERMEIGEN BEDIENING BLIJFT. De tabbladen van Rendez-vous en de mappen
      van RTMail worden door de ouder NIET vervangen; wie die ook weghaalt maakt
      een functie onbereikbaar, en verbergen bestaat niet (ADAPTIEF.md). De
      ruimte die een weggehaalde balk reserveerde gaat wel mee: anders staat er
      geen tweede bediening meer, maar wel het gat waar zij stond.

   Draait alleen waar een browser beschikbaar is. Draai: npm run e2e
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop, laadPlaywright, browserOpties, geenBrowser, elevateTier } = require('./helper');

const pw = laadPlaywright();

/* Per scherm: de balken die PLATFORMchrome zijn en dus van de ouder komen. */
const SUITE = ['.rtg-suitebar', '.rtg-suitenav'];
const SCHERMEN = [
  { pad: '/apps/comm.html', weg: SUITE.concat(['.rtg-intel-strip']) },
  { pad: '/apps/salon.html', weg: ['.rtg-social-commandbar', '.salon-socialnav'] },
  { pad: '/apps/sociaal.html', weg: ['.rtg-social-commandbar'] },
  { pad: '/apps/vonk.html', weg: SUITE },
  { pad: '/apps/cercle.html', weg: SUITE },
  { pad: '/apps/meet.html', weg: SUITE },
  { pad: '/apps/pulse.html', weg: SUITE },
  { pad: '/apps/genootschap.html', weg: SUITE },
  { pad: '/apps/entourage.html', weg: SUITE },
  { pad: '/apps/attenties.html', weg: SUITE },
  { pad: '/apps/sociaal-prive.html', weg: SUITE },
  { pad: '/apps/rendezvous.html', weg: SUITE, blijft: ['#tabs.dating-tabs'] },
  { pad: '/apps/luchthaven.html', weg: ['.tos-opsnav'] },
  { pad: '/apps/ovcontrol.html', weg: ['.tos-opsnav'] },
  { pad: '/apps/ovdienst.html', weg: ['.tos-opsnav'] },
  { pad: '/apps/ovroutes.html', weg: ['.tos-opsnav'] },
  /* RTMail draagt geen platformchrome meer en staat hier als TEGENPROEF: zijn
     eigen mappenbalk hoort in een kader gewoon te blijven staan. Zijn <main>
     is `aria-hidden` en dus geen inhoudsmaat; de zichtbare romp is .rtm-binnen. */
  { pad: '/apps/rtmail.html', weg: [], blijft: ['.rtm-nav'], inhoud: '.rtm-binnen' }
];

/* Een gastheer die zelf niets doet. app.html leek logisch en is het niet: die
   pagina leidt zelf door, en dan verdwijnt de uitvoeringscontext onder de
   meting vandaan. */
const GASTHEER = '/site/404.html';

/* Laadt een scherm in een ECHT iframe en meet het van binnenuit. Alleen
   `self !== top` bewijst de embed-stand die de werktafel en de vensters maken;
   `?embed=1` is de tweede weg en wordt hieronder apart beproefd. */
const inKader = function (opdracht) {
  return new Promise(function (klaar) {
    var oud = document.getElementById('rtg-embedproef');
    if (oud) oud.remove();
    var f = document.createElement('iframe');
    f.id = 'rtg-embedproef';
    f.title = 'Proefkader ingebedde chrome';
    f.style.cssText = 'position:fixed;inset:0;width:1280px;height:860px;border:0';
    var af = false;
    var meet = function () {
      if (af) return;
      af = true;
      setTimeout(function () {
        var doc, win;
        try { doc = f.contentDocument; win = f.contentWindow; } catch (e) { return klaar({ fout: 'geen toegang' }); }
        if (!doc || !doc.body || !win) return klaar({ fout: 'geen document' });
        var zichtbaar = function (el) {
          var s = win.getComputedStyle(el), r = el.getBoundingClientRect();
          return s.display !== 'none' && s.visibility !== 'hidden' && Number(s.opacity) !== 0 &&
            r.width > 0 && r.height > 0;
        };
        var lijst = function (selectors) {
          var uit = [];
          selectors.forEach(function (sel) {
            doc.querySelectorAll(sel).forEach(function (el) { if (zichtbaar(el)) uit.push(sel); });
          });
          return uit;
        };
        var gemarkeerd = [];
        doc.querySelectorAll('[data-rtg-platform-chrome]').forEach(function (el) {
          if (zichtbaar(el)) gemarkeerd.push(el.getAttribute('data-rtg-platform-chrome'));
        });
        var hoofd = doc.querySelector(opdracht.inhoud || 'main, #inhoud, .salon-werkveld, .comm, .private-world');
        klaar({
          pad: win.location.pathname,
          embed: doc.body.classList.contains('rtg-edge-embed'),
          eigenEdge: doc.querySelectorAll('.rtg-edge-chrome').length,
          gemarkeerdZichtbaar: gemarkeerd,
          wegZichtbaar: lijst(opdracht.weg),
          blijftZichtbaar: lijst(opdracht.blijft || []),
          padTop: win.getComputedStyle(doc.body).paddingTop,
          hoofdZichtbaar: !!(hoofd && zichtbaar(hoofd))
        });
      }, 700);
    };
    f.addEventListener('load', meet, { once: true });
    setTimeout(meet, 12000);
    f.src = opdracht.url;
    document.body.appendChild(f);
  });
};

/* Dezelfde vraag op een pagina die GEWOON open staat. */
const opPagina = function (opdracht) {
  var zichtbaar = function (el) {
    var s = getComputedStyle(el), r = el.getBoundingClientRect();
    return s.display !== 'none' && s.visibility !== 'hidden' && Number(s.opacity) !== 0 && r.width > 0 && r.height > 0;
  };
  var lijst = function (selectors) {
    var uit = [];
    selectors.forEach(function (sel) {
      document.querySelectorAll(sel).forEach(function (el) { if (zichtbaar(el)) uit.push(sel); });
    });
    return uit;
  };
  var gemarkeerd = [];
  document.querySelectorAll('[data-rtg-platform-chrome]').forEach(function (el) {
    if (zichtbaar(el)) gemarkeerd.push(el.getAttribute('data-rtg-platform-chrome'));
  });
  return {
    embed: document.body.classList.contains('rtg-edge-embed'),
    gemarkeerdZichtbaar: gemarkeerd,
    wegZichtbaar: lijst(opdracht.weg),
    blijftZichtbaar: lijst(opdracht.blijft || [])
  };
};

test('ingebedde schermen tonen geen tweede platformbediening, en zonder kader wel',
  { skip: geenBrowser(pw) }, async (t) => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-embedchrome-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    const api = async (pad, body, token) => (await fetch(base + pad, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
      body: JSON.stringify(body || {})
    })).json();
    const stempel = Date.now();
    const lid = await api('/api/auth/register', { name: 'Kaderproef', email: 'kader' + stempel + '@v.test',
      phone: '06' + String(stempel).slice(-8), password: 'geheim123', geboortedatum: '1990-02-02', tier: 'rtg' });
    const kantoor = (await api('/api/office/login', { code: 'RTG-OFFICE' })).token;
    /* Business ziet alle vier de werelden; een smallere pas zou schermen
       overslaan en dat leest als een geslaagde proef. */
    await elevateTier(base, lid.token, 'business', kantoor);

    browser = await pw.chromium.launch(browserOpties(pw));
    const context = await browser.newContext({ viewport: { width: 1300, height: 900 } });
    await context.addInitScript((sleutel) => {
      try { localStorage.setItem('rtg_member_token', sleutel); } catch (e) {}
      try { localStorage.setItem('rtg_cookieinfo_v1', '1'); } catch (e) {}
    }, lid.token);
    const page = await context.newPage();
    page.on('dialog', d => d.dismiss().catch(() => {}));

    for (const scherm of SCHERMEN) {
      await t.test(scherm.pad, async () => {
        await page.goto(base + GASTHEER, { waitUntil: 'domcontentloaded' });
        const m = await page.evaluate(inKader, { url: base + scherm.pad, weg: scherm.weg,
          blijft: scherm.blijft || [], inhoud: scherm.inhoud || '' });
        assert.equal(m.fout, undefined, scherm.pad + ': het kader liet zich niet meten (' + m.fout + ')');
        assert.equal(m.pad, scherm.pad, scherm.pad + ': het kader landde op ' + m.pad);
        assert.equal(m.embed, true, scherm.pad + ': een echt iframe is niet als embed gemarkeerd');
        assert.equal(m.eigenEdge, 0, scherm.pad + ': het kind bouwt een tweede Edge-casco');
        assert.deepEqual(m.gemarkeerdZichtbaar, [],
          scherm.pad + ': platformchrome staat er nog: ' + m.gemarkeerdZichtbaar.join(', '));
        assert.deepEqual(m.wegZichtbaar, [],
          scherm.pad + ': tweede bediening zichtbaar: ' + m.wegZichtbaar.join(', '));
        /* De ruimte gaat met de balk mee; een gat is net zo goed een spoor. */
        assert.equal(m.padTop, '0px', scherm.pad + ': het kind reserveert nog ruimte voor een balk die weg is');
        assert.equal(m.hoofdZichtbaar, true, scherm.pad + ': na het weghalen staat er geen inhoud meer');
        if (scherm.blijft) {
          assert.deepEqual(m.blijftZichtbaar.slice().sort(), scherm.blijft.slice().sort(),
            scherm.pad + ': schermeigen bediening is meegesneuveld; de ouder vervangt die niet');
        }

        /* DE BESTURINGSPROEF. Zonder kader hoort dezelfde balk er gewoon te
           staan; anders bewaakt deze toets een verwijdering. */
        await page.goto(base + scherm.pad, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(600);
        const open = await page.evaluate(opPagina, { weg: scherm.weg, blijft: scherm.blijft || [] });
        assert.equal(open.embed, false, scherm.pad + ': een gewoon geopende pagina noemt zichzelf ingebed');
        if (scherm.weg.length) {
          assert.deepEqual(open.wegZichtbaar.slice().sort(), scherm.weg.slice().sort(),
            scherm.pad + ': zonder kader ontbreekt de eigen bediening, dus de embed-proef bewijst niets');
          assert.ok(open.gemarkeerdZichtbaar.length > 0,
            scherm.pad + ': zonder kader draagt geen enkele zichtbare balk de marker');
        }
      });
    }

    /* `?embed=1` is de tweede ingang naar dezelfde stand (reizen-veilig.js zet
       hem op zijn kaders) en moet hetzelfde doen als een echt iframe. */
    await t.test('?embed=1 doet hetzelfde als een echt kader', async () => {
      for (const scherm of SCHERMEN.filter(s => s.weg.length).slice(0, 4)) {
        await page.goto(base + scherm.pad + '?embed=1', { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(600);
        const m = await page.evaluate(opPagina, { weg: scherm.weg, blijft: [] });
        assert.equal(m.embed, true, scherm.pad + '?embed=1: de embed-stand wordt niet gezet');
        assert.deepEqual(m.gemarkeerdZichtbaar, [],
          scherm.pad + '?embed=1: platformchrome staat er nog: ' + m.gemarkeerdZichtbaar.join(', '));
        assert.deepEqual(m.wegZichtbaar, [],
          scherm.pad + '?embed=1: tweede bediening zichtbaar: ' + m.wegZichtbaar.join(', '));
      }
    });
  } finally {
    if (browser) await browser.close();
    await stop(child);
  }
});
