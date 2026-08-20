/* ============================================================================
   DE WERKSCHERMEN: WIE ZIT ER ACHTER, EN WAT MAG DIE ZIEN.

   De laatste grote groep uit TAKEN 4.9. Dit zijn de schermen van mensen die bij
   een zaak, een redactie of een kantoor horen -- en van de twee zwaarste deuren
   van het hele huis.

   DE DRIE SOORTEN DIE HIER LANGSKOMEN

   1. ZAAK EN REDACTIE (redactie, redactie-pda, redactiekantoor,
      leverancier-rtmail). Een journalist logt in op zijn nieuwsbedrijf, niet op
      RTG. Deze schermen horen dat te zeggen in plaats van leeg te blijven --
      een verslaggever die een wit scherm ziet, denkt dat het systeem stuk is.

   2. DE LOKALE WERKBANK (sitemaker, websitestudio, klankwerk-kantoor). Die
      bouwen zonder server: je maakt een site of een uitgave en pas bij bewaren
      gaat er iets de deur uit. Ze horen dus meteen bruikbaar te zijn.

   3. DE TWEE ZWAARSTE DEUREN. techniek.html zegt zelf dat het een beveiligde
      pagina is voor de eigenaar en wie hij handmatig toegang gaf; boardroom.html
      is waar de schakelaars van het platform staan. Een gewoon lid hoort daar
      een aanmelding te zien en geen enkele knop die iets schakelt. Dat is
      dezelfde regel die de paniekkamer bewaakt (kantoordienst.test.js), maar dan
      aan de schermkant.

   EN TWEE APPS DIE HIER NOG WEGSTUURDEN. foundation/kantoor.html en
   foundation/societeit.html hadden dezelfde kwaal als de acht uit TAKEN 5.5 en
   de Arena: een uitgelogde bezoeker werd doorgestuurd en verloor waar hij heen
   wilde. Ze tonen nu hun eigen deur, en dat ligt hier vast.

   Draait alleen waar een browser is.
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, letOpFouten, laadPlaywright, browserOpties, geenBrowser, volgVerzoeken, wachtOpRust } = require('./helper');

const pw = laadPlaywright();
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-werkscherm-'));

const ZAAK_EN_REDACTIE = [
  { app: 'redactie', eist: /zaak-app|nieuwsbedrijf/i },
  { app: 'redactie-pda', eist: /zaak-app|nieuwsbedrijf|verslaggever/i },
  { app: 'redactiekantoor', eist: /kantoor-?inlog|backoffice|kantoorcode/i },
  { app: 'leverancier-rtmail', eist: /leverancier-app|log eerst in|postvak/i },
  { app: 'overheidspda', eist: /rijksoverheid|personeel|werktelefoon/i },
  { app: 'meldkamer', eist: /meldkamer|meldingen|eenheden/i }
];

const WERKBANK = [
  { app: 'sitemaker', eist: /website-?maker|blok|telefoon/i },
  { app: 'websitestudio', eist: /website-?studio|atelier|blok/i },
  { app: 'klankwerk-kantoor', eist: /klankwerk|codenaam|uitgeven/i }
];

async function nieuwLid(base) {
  const u = Date.now().toString().slice(-8) + Math.floor(Math.random() * 90 + 10);
  const reg = await fetch(base + '/api/auth/register', { method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Werker', email: 'wk' + u + '@x.nl', phone: '06' + u.slice(0, 8),
      password: 'geheim12345', geboortedatum: '1979-09-09', tier: 'rtg' }) }).then(r => r.json());
  assert.ok(reg.token, 'het lid is aangemeld: ' + JSON.stringify(reg).slice(0, 160));
  return reg.token;
}

async function toon(page, base, app, token) {
  const pad = '/apps/' + app + '.html';
  await page.goto(base + pad, { waitUntil: 'domcontentloaded' });
  await page.evaluate(t => {
    localStorage.setItem('rtg_cookieinfo_v1', '1');
    if (t) localStorage.setItem('rtg_member_token', t); else localStorage.removeItem('rtg_member_token');
    // met opzet geen zaak-, kantoor- of gezinssessie
    localStorage.removeItem('rtg_office_token');
    localStorage.removeItem('rtg_sup_token');
    localStorage.removeItem('rtf_sessie');
  }, token || null);
  await page.goto(base + pad, { waitUntil: 'domcontentloaded' });
  await wachtOpRust(page);
  return page.evaluate(() => ({
    pad: location.pathname,
    deur: !!document.querySelector('.rtgdeur'),
    tekst: document.body.innerText.replace(/\s+/g, ' ')
  }));
}

async function opstelling() {
  const browser = await pw.chromium.launch(browserOpties(pw));
  const ctx = await browser.newContext({ serviceWorkers: 'block' });
  const page = await ctx.newPage();
  await volgVerzoeken(page);
  const fouten = [];
  letOpFouten(page, fouten);
  return { browser, page, fouten };
}

test('zes werkschermen zeggen bij welke zaak of welk kantoor ze horen',
  { skip: geenBrowser(pw) }, async () => {
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    const token = await nieuwLid(base);
    const o = await opstelling();
    browser = o.browser;

    const stuk = [];
    for (const s of ZAAK_EN_REDACTIE) {
      const r = await toon(o.page, base, s.app, token);
      if (r.pad !== '/apps/' + s.app + '.html') { stuk.push(s.app + ': stuurt weg naar ' + r.pad); continue; }
      if (r.tekst.trim().length < 60) { stuk.push(s.app + ': bijna leeg (' + r.tekst.trim().length + ' tekens)'); continue; }
      if (!s.eist.test(r.tekst)) stuk.push(s.app + ': zegt niet waar het bij hoort -- ' + r.tekst.slice(0, 130));
    }
    assert.deepEqual(stuk, [], 'de zes werkschermen wijzen de weg:\n  ' + stuk.join('\n  '));
    assert.deepEqual(o.fouten, [], 'paginafouten: ' + o.fouten.join(' | '));
  } finally {
    if (browser) await browser.close();
    child.kill();
  }
});

test('de lokale werkbanken zijn meteen bruikbaar, ook zonder zaak',
  { skip: geenBrowser(pw) }, async () => {
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    const token = await nieuwLid(base);
    const o = await opstelling();
    browser = o.browser;

    const stuk = [];
    for (const s of WERKBANK) {
      const r = await toon(o.page, base, s.app, token);
      if (r.pad !== '/apps/' + s.app + '.html') { stuk.push(s.app + ': stuurt weg naar ' + r.pad); continue; }
      if (!s.eist.test(r.tekst)) stuk.push(s.app + ': zegt niet waar het voor is -- ' + r.tekst.slice(0, 130));
      /* Een werkbank die lokaal bouwt hoort ook echt knoppen te hebben; een
         lege editor is een editor die niet werkt. */
      const knoppen = await o.page.evaluate(() => document.querySelectorAll('button').length);
      if (knoppen < 3) stuk.push(s.app + ': maar ' + knoppen + ' knop(pen) -- een werkbank zonder gereedschap');
    }
    assert.deepEqual(stuk, [], 'de drie werkbanken staan klaar:\n  ' + stuk.join('\n  '));
    assert.deepEqual(o.fouten, [], 'paginafouten: ' + o.fouten.join(' | '));
  } finally {
    if (browser) await browser.close();
    child.kill();
  }
});

test('techniek en boardroom laten een gewoon lid niets schakelen',
  { skip: geenBrowser(pw) }, async () => {
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    const token = await nieuwLid(base);
    const o = await opstelling();
    browser = o.browser;

    /* TECHNIEK zegt zelf wat het is: een beveiligde pagina voor de eigenaar. */
    const t = await toon(o.page, base, 'techniek', token);
    assert.equal(t.pad, '/apps/techniek.html', 'techniek blijft op zijn eigen adres');
    assert.match(t.tekst, /beveiligde pagina|alleen de eigenaar/i,
      'en zegt dat het beveiligd is: ' + t.tekst.slice(0, 200));
    assert.match(t.tekst, /aanmelden|inloggen/i, 'met een weg naar binnen voor wie er hoort');

    /* DE BOARDROOM: EEN PAGINA, TWEE KAMERS -- en hier meten we de muur ertussen.

       Deze toets eiste dat een gewoon lid hier een AANMELDING zag, en dat klopte
       toen /apps/boardroom.html het schakelbord van het platform was. Dat is het
       niet meer: het is de EIGEN boardroom van een lid ("zet zelf aan wat je
       gebruikt en uit wat je niet wilt"), en die hoort een ingelogd lid gewoon
       te zien. Een inlogscherm eisen op een pagina die van hem is, is de
       verkeerde belofte -- en de toets zakte er dan ook op.

       Wat er in die pagina WEL achter een deur zit is de eigenaarszetel
       (apps/boardroom-eigenaar.js): de schakelaars van het platform. Die is er
       alleen voor de eigenaar, en dat is de bewering die het waard is om te
       meten. Dus meten we hem, en niet aan de tekst maar aan de DOM: dit scherm
       vertaalt mee met de browser, en een toets die op een Nederlands woord
       wacht zakt op een Engelse machine om iets wat niets met de regel te maken
       heeft.

       Twee kanten, want een van de twee alleen zegt niets: de zetel staat er
       niet, EN de eigenaars-API weigert. Zou de zetel alleen in CSS verstopt
       zijn, dan houdt de tweede regel stand; zou de API openstaan en het scherm
       alleen zwijgen, dan valt de eerste. */
    const b = await toon(o.page, base, 'boardroom', token);
    assert.equal(b.pad, '/apps/boardroom.html', 'de boardroom blijft op zijn eigen adres');
    assert.ok(b.tekst.trim().length > 200, 'een lid hoort zijn eigen boardroom te zien: ' + b.tekst.slice(0, 200));

    const zetel = await o.page.evaluate(() => {
      const el = document.querySelector('.ez');
      return { er: !!el, zichtbaar: !!(el && el.getClientRects().length) };
    });
    assert.equal(zetel.er, false, 'de eigenaarszetel staat op het scherm van een gewoon lid');

    const eigenaarsApi = await o.page.evaluate(async () => {
      const t = localStorage.getItem('rtg_member_token');
      const r = await fetch('/api/boardroom/status', { method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t },
        body: '{}' });
      return r.status;
    });
    assert.ok(eigenaarsApi === 401 || eigenaarsApi === 403,
      'de eigenaars-API hoort een gewoon lid te weigeren (kreeg ' + eigenaarsApi + ')');

    assert.deepEqual(o.fouten, [], 'paginafouten: ' + o.fouten.join(' | '));
  } finally {
    if (browser) await browser.close();
    child.kill();
  }
});

test('het RTF-kantoor en de Societeit tonen hun eigen deur, en sturen niemand weg',
  { skip: geenBrowser(pw) }, async () => {
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    const o = await opstelling();
    browser = o.browser;

    /* Deze twee stuurden tot deze ronde nog weg -- foundation/kantoor naar de
       personeels-app, foundation/societeit naar de RTF-startpagina. Dezelfde
       kwaal als de acht uit TAKEN 5.5 en de Arena, en dezelfde reparatie. */
    for (const app of ['foundation/kantoor', 'foundation/societeit']) {
      const r = await toon(o.page, base, app, null);
      assert.equal(r.pad, '/apps/' + app + '.html', app + ' blijft waar hij is');
      assert.ok(r.deur, app + ' toont een deur: ' + r.tekst.slice(0, 140));
      assert.ok(r.tekst.trim().length > 120, app + ': de deur vertelt wat er achter zit');
    }

    assert.deepEqual(o.fouten, [], 'paginafouten: ' + o.fouten.join(' | '));
  } finally {
    if (browser) await browser.close();
    child.kill();
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
