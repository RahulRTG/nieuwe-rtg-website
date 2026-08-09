/* ============================================================================
   REIZEN, UITGAAN EN DE DIENST: ZESTIEN SCHERMEN, VIER SOORTEN.

   Allemaal uit de lijst van TAKEN 4.9. Ze lijken op elkaar -- kaartjes, tijden,
   plaatsen -- maar ze staan in vier verschillende verhoudingen tot de bezoeker,
   en dat verschil is wat hier wordt vastgelegd.

   1. VOOR DE REIZIGER (ov, vluchten, reisbureau, hotels, uitgaan, sport,
      muziek, theater, zaal, residentie, navigatie). Open met een ledenpas, en
      ze dragen allemaal een BELOFTE in hun kop: het reisbureau werkt "tegen de
      nettoprijs zonder opslag", het theater "hercomprimeert niets". Zulke zinnen
      zijn met een tekstopschoning weg, en dan belooft het scherm iets anders
      dan het product doet.

   2. ACHTER DE DIENST (ovroutes, ovdienst, luchthaven, sportclub). Dat zijn de
      werkschermen van personeel. Een reiziger hoort daar een eerlijke
      personeelsinlog te zien -- geen dienstrooster, geen namen van collega's.

   3. HET PODIUM is de bijzondere: 18+, op codenaam, en het vraagt eerst een
      RTG-geverifieerd paspoort. Leeftijdsverificatie is precies het soort poort
      dat "later wel even" wordt aangezet en dan nooit meer. Hij ligt hier vast.

   4. EN OVERAL DE MERKREGEL. Hotels en reisbureau zijn de plek waar een echt
      merk het makkelijkst binnensluipt ("verblijf in het Hilton"), en CLAUDE.md
      is er stellig over: nooit een echt hotel- of luchtvaartmerk als bevestigde
      partner. Op een boekingsscherm leest een lid dat als een toezegging.

   Draait alleen waar een browser is.
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, letOpFouten } = require('./helper');

function laadBrowser() {
  for (const p of [undefined, '/opt/node22/lib/node_modules', '/usr/lib/node_modules', '/usr/local/lib/node_modules']) {
    try { return require(p ? require.resolve('playwright', { paths: [p] }) : 'playwright'); } catch (e) { /* volgende */ }
  }
  try { const eigen = require('../server/lib/browser'); if (eigen.beschikbaar()) return eigen; } catch (e) { /* geen browser */ }
  return null;
}
const pw = laadBrowser();
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-reis-'));

/* Per reizigersscherm de belofte die erop hoort te staan. Steeds iets dat het
   scherm over ZICHZELF zegt en dat een lid erop afrekent. */
const VOOR_DE_REIZIGER = [
  { app: 'ov', eist: /inchecken|live gps|oplichtende code/i },
  { app: 'vluchten', eist: /het bord|mijn reizen|security/i },
  { app: 'reisbureau', eist: /nettoprijs|zonder opslag/i },
  { app: 'hotels', eist: /hotels|appartementen|villa/i },
  { app: 'uitgaan', eist: /gastenlijst/i },
  { app: 'sport', eist: /uitslagen|stand|tickets/i },
  { app: 'muziek', eist: /ongecomprimeerd|samen luisteren/i },
  { app: 'theater', eist: /origineel beeld|hercomprimeren niets/i },
  { app: 'zaal', eist: /wat leden gemaakt hebben|klankwerk/i },
  { app: 'residentie', eist: /lobby|suite|aanwezig/i },
  { app: 'navigatie', eist: /route|kaart|halte/i }
];

const ACHTER_DE_DIENST = [
  { app: 'ovroutes', eist: /personeels-?app|log eerst in/i },
  { app: 'ovdienst', eist: /personeels-?app|log eerst in|geen dienst/i },
  { app: 'luchthaven', eist: /operations|de operatie/i },
  { app: 'sportclub', eist: /clubkantoor|clubkantine|kantine/i }
];

/* Echte merken die dit huis nooit als bevestigde partner opvoert (CLAUDE.md). */
const MERKEN = /\b(Hilton|Marriott|Four Seasons|Ritz[- ]Carlton|Aman|Rosewood|Mandarin Oriental|Emirates|KLM|Lufthansa|Air France|British Airways|Qatar Airways|Singapore Airlines|Booking\.com|Airbnb|Expedia)\b/i;

async function nieuwLid(base) {
  const u = Date.now().toString().slice(-8) + Math.floor(Math.random() * 90 + 10);
  const reg = await fetch(base + '/api/auth/register', { method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Reiziger', email: 'rz' + u + '@x.nl', phone: '06' + u.slice(0, 8),
      password: 'geheim12345', geboortedatum: '1988-08-08', tier: 'rtg' }) }).then(r => r.json());
  assert.ok(reg.token, 'het lid is aangemeld: ' + JSON.stringify(reg).slice(0, 160));
  return reg.token;
}

async function toon(page, base, app, token) {
  const pad = '/apps/' + app + '.html';
  await page.goto(base + pad, { waitUntil: 'domcontentloaded' });
  await page.evaluate(t => {
    localStorage.setItem('rtg_cookieinfo_v1', '1');
    if (t) localStorage.setItem('rtg_member_token', t); else localStorage.removeItem('rtg_member_token');
    localStorage.removeItem('rtg_sup_token');
    localStorage.removeItem('rtg_office_token');
  }, token || null);
  await page.goto(base + pad, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);
  return page.evaluate(() => ({
    pad: location.pathname, tekst: document.body.innerText.replace(/\s+/g, ' ')
  }));
}

async function opstelling(base) {
  const browser = await pw.chromium.launch({ args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ serviceWorkers: 'block' });
  const page = await ctx.newPage();
  const fouten = [];
  letOpFouten(page, fouten);
  return { browser, page, fouten };
}

test('elf reizigersschermen tonen hun eigen belofte, en geen enkel echt merk',
  { skip: pw ? false : 'geen browser beschikbaar in deze omgeving' }, async () => {
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    const token = await nieuwLid(base);
    const o = await opstelling(base);
    browser = o.browser;

    const stuk = [];
    for (const s of VOOR_DE_REIZIGER) {
      const r = await toon(o.page, base, s.app, token);
      if (r.pad !== '/apps/' + s.app + '.html') { stuk.push(s.app + ': stuurt weg naar ' + r.pad); continue; }
      if (r.tekst.trim().length < 80) { stuk.push(s.app + ': bijna leeg (' + r.tekst.trim().length + ' tekens)'); continue; }
      if (!s.eist.test(r.tekst)) stuk.push(s.app + ': de eigen belofte staat er niet -- ' + r.tekst.slice(0, 140));
      const merk = r.tekst.match(MERKEN);
      if (merk) stuk.push(s.app + ': voert "' + merk[0] + '" op, en dit huis noemt geen echte merken als partner');
    }
    assert.deepEqual(stuk, [], 'de elf reizigersschermen staan er:\n  ' + stuk.join('\n  '));
    assert.deepEqual(o.fouten, [], 'paginafouten: ' + o.fouten.join(' | '));
  } finally {
    if (browser) await browser.close();
    child.kill();
  }
});

test('de vier dienstschermen zijn van het personeel, niet van de reiziger',
  { skip: pw ? false : 'geen browser beschikbaar in deze omgeving' }, async () => {
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    const token = await nieuwLid(base);
    const o = await opstelling(base);
    browser = o.browser;

    const stuk = [];
    for (const s of ACHTER_DE_DIENST) {
      const r = await toon(o.page, base, s.app, token);
      if (r.pad !== '/apps/' + s.app + '.html') { stuk.push(s.app + ': stuurt weg naar ' + r.pad); continue; }
      if (!s.eist.test(r.tekst)) stuk.push(s.app + ': zegt niet waar dit scherm voor is -- ' + r.tekst.slice(0, 140));
      if (r.tekst.trim().length < 60) stuk.push(s.app + ': bijna leeg');
    }
    assert.deepEqual(stuk, [], 'de vier dienstschermen melden zich als werkscherm:\n  ' + stuk.join('\n  '));
    assert.deepEqual(o.fouten, [], 'paginafouten: ' + o.fouten.join(' | '));
  } finally {
    if (browser) await browser.close();
    child.kill();
  }
});

test('het Podium vraagt eerst een geverifieerd paspoort, en toont het achterste niet',
  { skip: pw ? false : 'geen browser beschikbaar in deze omgeving' }, async () => {
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    const token = await nieuwLid(base);
    const o = await opstelling(base);
    browser = o.browser;

    const r = await toon(o.page, base, 'podium', token);
    assert.equal(r.pad, '/apps/podium.html', 'het Podium blijft op zijn eigen adres');

    /* DE POORT ZIT OP DE 18+-WERELD EN NIET OP DE VOORDEUR, en dat is het
       ontwerp: het Podium heeft vijf werelden op dezelfde motor, en alleen die
       ene is 18+. Een lid dat binnenkomt landt in Live -- open voor alle leden
       -- en daar hoort geen paspoortvraag te staan. Deze toets keek naar de
       landingspagina en zakte daarom op een scherm dat het goed deed.

       Wat de merkregel WEL eist, staat hieronder: kies de 18+-wereld, en dan
       gaat de deur dicht met de reden erbij. Een leeftijdsgrens die je met een
       klik overslaat is geen grens. */
    assert.match(r.tekst, /18\+/, 'de 18+-wereld is als deur zichtbaar: ' + r.tekst.slice(0, 200));
    assert.match(r.tekst, /codenaam/i, 'op codenaam, zoals de rest van dit huis');

    const poort = await o.page.evaluate(async () => {
      const knop = [...document.querySelectorAll('#zoneBalk button')]
        .find(b => /18\+/.test(b.textContent));
      if (!knop) return { gevonden: false };
      knop.click();
      /* Wachten tot de poort er echt staat: het klikken zet een verzoek uit, en
         meten voordat het antwoord binnen is, meet de vorige wereld. */
      for (let i = 0; i < 40; i++) {
        const p = document.getElementById('vPoort');
        if (p && !p.classList.contains('weg')) break;
        await new Promise(r2 => setTimeout(r2, 100));
      }
      const p = document.getElementById('vPoort');
      return { gevonden: true, dicht: !!(p && !p.classList.contains('weg')),
        tekst: document.body.innerText.replace(/\s+/g, ' ') };
    });
    assert.ok(poort.gevonden, 'de 18+-wereld staat in de balk');
    assert.ok(poort.dicht, 'zonder verificatie gaat de poort dicht: ' + poort.tekst.slice(0, 200));
    assert.match(poort.tekst, /geverifieerd|verifieer|paspoort/i,
      'en er moet een geverifieerd paspoort aan te pas komen: ' + poort.tekst.slice(0, 200));

    /* En het achterste blijft achter de poort. Zonder verificatie hoort er geen
       inhoud van die wereld te staan -- geen namen, geen beelden, geen lijst. */
    assert.ok(!/NU LIVE|ALLE KANALEN/.test(poort.tekst),
      'achter de poort staat geen zaal (' + poort.tekst.slice(0, 300) + ')');

    assert.deepEqual(o.fouten, [], 'paginafouten: ' + o.fouten.join(' | '));
  } finally {
    if (browser) await browser.close();
    child.kill();
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
