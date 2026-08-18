/* ============================================================================
   DE TWAALF LIFESTYLE-SCHERMEN: LEGT EEN TOETS DE WEG ECHT AF?

   WAAROM JUIST DEZE TWAALF

   Bij het afsluiten van TAKEN 4.1 heb ik zelf de openstaande rest opgeschreven:
   "wat er nog steeds niet is: dezelfde weg door het SCHERM (de twaalf
   app-pagina's zelf), alleen door de API". Dat gat staat exact op de lijst van
   scripts/schermen.js -- alle twaalf horen bij de 104 schermen waar geen enkele
   toets de weg aflegt. Ze worden wel geopend (leven.e2e.js veegt langs voor een
   teken van leven), maar dat is geen bewijs; een veeg ziet niet of een scherm
   de goede dingen toont.

   TWEE STANDEN, want alleen de mooie stand toetsen is de halve waarheid:

   1. ZONDER PAS staat er een POORT. Dat is de scherpste van de twee. Een
      RTG-lid dat cellier.html opent hoort een eerlijke uitleg te zien -- geen
      leeg scherm, geen JS-fout, en vooral: geen invoervelden. Een scherm dat
      wel velden toont maar bij het opslaan een 403 geeft, is een deur die van
      buiten open lijkt. De API-kant hiervan ligt vast in ledenladder.test.js;
      dit is de kant die het lid ziet.

   2. MET PAS toont het scherm DE EIGEN GEGEVENS. Niet "de pagina laadt" maar:
      wat via de API in de kelder is gezet, staat op het scherm. Dat is de brug
      tussen test/rechterhand-reis.test.js (het getal klopt in de API) en wat
      een mens werkelijk voor zich ziet. Zonder die brug kan de API perfect
      kloppen terwijl het scherm nul flessen toont.

   WAAR NODIG WORDT ER DOORGEKLIKT. Zeven van de twaalf tonen hun lijst pas na
   een tik op een tabblad, en dat is precies wat een gebruiker ook doet. Een
   toets die alleen het openingsscherm leest zou die zeven overslaan of, erger,
   op een leeg tabblad slagen.

   Draait alleen waar een browser is.
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, letOpFouten, elevateTier, laadPlaywright, browserOpties, geenBrowser } = require('./helper');

const pw = laadPlaywright();
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-lsscherm-'));

/* Per app: het scherm, wat we er via de API in zetten, op welk tabblad de lijst
   staat (leeg = meteen zichtbaar) en welke tekst er daarna op het scherm hoort.

   Die laatste is met opzet iets dat het SCHERM heeft uitgerekend of opgehaald,
   niet iets dat in de HTML gebakken zit. "6" bij de kelder is de optelsom van
   het aantal flessen; "1.080" is 6 x 180. Zou de pagina de API niet lezen, dan
   staat er 0 en zakt dit. */
const APPS = [
  { app: 'reisboek', zet: 'reis/zet', body: { naam: 'Ronde om de Middellandse Zee', bestemming: 'Milaan' },
    toont: 'Ronde om de Middellandse Zee' },
  { app: 'cellier', zet: 'cellier/zet', body: { naam: 'Barolo Riserva', aantal: 6, waarde: 180 },
    tab: 'UW KELDER', toont: 'Barolo Riserva', ook: '1.080' },
  { app: 'table', zet: 'table/zet', body: { naam: 'Kerstdiner', datum: '2026-12-24' },
    tab: 'GELEGENHEDEN', toont: 'Kerstdiner' },
  { app: 'maison', zet: 'maison/staf', body: { naam: 'Mevrouw Duarte', rol: 'huishouding' },
    toont: 'Mevrouw Duarte' },
  { app: 'garderobe', zet: 'garderobe/stuk', body: { naam: 'Grijs krijtstreep', categorie: 'pak' },
    toont: 'Grijs krijtstreep' },
  { app: 'cercle', zet: 'cercle/club', body: { naam: 'Circolo Filologico', stad: 'Milaan', gastpassen: 2 },
    tab: 'UW CLUBS', toont: 'Circolo Filologico' },
  { app: 'hangar', zet: 'hangar/toestel', body: { naam: 'De Zilverreiger', type: 'jet', basis: 'EHAM' },
    tab: 'VLOOT', toont: 'De Zilverreiger' },
  { app: 'entourage', zet: 'entourage/persoon', body: { naam: 'Iris Mendes', band: 'partner' },
    tab: 'UW GEZELSCHAP', toont: 'Iris Mendes' },
  { app: 'attenties', zet: 'attenties/relatie', body: { naam: 'Familie Duarte', band: 'vriend' },
    tab: 'UW RELATIES', toont: 'Familie Duarte' }
];

async function nieuwLid(base) {
  const u = Date.now().toString().slice(-8) + Math.floor(Math.random() * 90 + 10);
  const reg = await fetch(base + '/api/auth/register', { method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Schermlid', email: 'ls' + u + '@x.nl', phone: '06' + u.slice(0, 8),
      password: 'geheim12345', geboortedatum: '1980-04-04', geslacht: 'v', tier: 'rtg', pasApp: 'rtg' })
  }).then(r => r.json());
  assert.ok(reg.token, 'het lid is aangemeld: ' + JSON.stringify(reg).slice(0, 160));
  return reg.token;
}

// het token in de opslag zetten en de pagina daarna opnieuw laden (zoals de app zelf ook doet)
async function open(page, base, app, token) {
  await page.goto(base + '/apps/' + app + '.html', { waitUntil: 'domcontentloaded' });
  await page.evaluate(t => {
    localStorage.setItem('rtg_member_token', t);
    localStorage.setItem('rtg_cookieinfo_v1', '1');
  }, token);
  await page.goto(base + '/apps/' + app + '.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(900);   // de pagina haalt zijn gegevens na het laden op
}
const schermtekst = (page) => page.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));

test('zonder pas staat er een poort op alle ' + APPS.length + ' schermen, en geen invoerveld',
  { skip: geenBrowser(pw) }, async () => {
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, OFFICE_CODE: 'KANTOOR-LSSCHERM' } });
  let browser;
  try {
    const token = await nieuwLid(base);
    browser = await pw.chromium.launch(browserOpties(pw));
    /* DE SERVICE WORKER ERUIT. Zonder dit blokje meet deze toets iets anders
       dan hij denkt: de RTF-schil registreert een service worker die tientallen
       schermen vooruit ophaalt, en die staan daarna in het schermjournaal alsof
       DEZE toets ze heeft afgelegd. Bij rtfkinderschermen liep dat op tot 55
       schermen -- boven de veeggrens van scripts/schermen.js, waardoor de toets
       als veegtoets telde en zijn eigen acht schermen niet meer meetelden.
       test/leven.e2e.js blokkeerde ze al; hier stond het nog niet. */
    const ctx = await browser.newContext({ serviceWorkers: 'block' });
    const page = await ctx.newPage();
    const fouten = [];
    letOpFouten(page, fouten);

    const stuk = [];
    for (const a of APPS) {
      await open(page, base, a.app, token);
      const tekst = await schermtekst(page);

      /* Een dichte app mag NIET leeg zijn. Dood is stiller dan stuk: een wit
         scherm ziet eruit als een laadprobleem en niet als een gesloten deur. */
      if (tekst.trim().length < 60) { stuk.push(a.app + ': leeg scherm (' + JSON.stringify(tekst.slice(0, 60)) + ')'); continue; }

      /* Hij moet zeggen WAT er aan de hand is, in de woorden van het merk: de
         Lifestyle Pass gaat op uitnodiging. Niet "geen toegang" of "403". */
      if (!/Lifestyle Pass/i.test(tekst)) stuk.push(a.app + ': noemt de Lifestyle Pass niet');
      if (!/uitnodiging|aanvra|ballotage|gesprek/i.test(tekst)) {
        stuk.push(a.app + ': legt niet uit hoe je binnenkomt -- ' + tekst.slice(0, 120));
      }

      /* En de kern: geen invoervelden VAN DE APP. Een dichte deur waar je wel
         iets in kunt typen is een deur die van buiten open lijkt; je merkt het
         pas bij het opslaan.

         Waarom binnen #main en niet op de hele pagina: de eerste versie telde
         alles en vond er overal twee. Dat waren niet de app maar de RTG-schil
         eromheen -- de assistentbalk ("bv. boek een taxi naar huis") en de
         spraakbalk, die op ieder scherm staan en niets met deze app te maken
         hebben. Op de hele pagina tellen zou dus altijd zakken, ongeacht wat de
         poort doet, en dat is geen toets maar ruis. Binnen #main staat de poort
         op nul en de open app op negen, en dat is precies het verschil dat deze
         bewering bedoelt. */
      const velden = await page.evaluate(() => {
        const m = document.querySelector('#main');
        return m ? m.querySelectorAll('input:not([type=hidden]), textarea, select').length : -1;
      });
      if (velden < 0) stuk.push(a.app + ': geen #main op het scherm, dus dit is niet vast te stellen');
      else if (velden > 0) stuk.push(a.app + ': toont ' + velden + ' invoerveld(en) in de app terwijl hij dicht is');
    }
    assert.deepEqual(stuk, [], 'de poort staat op alle ' + APPS.length + ':\n  ' + stuk.join('\n  '));
    assert.deepEqual(fouten, [], 'paginafouten: ' + fouten.join(' | '));
  } finally {
    if (browser) await browser.close();
    child.kill();
  }
});

test('met de pas tonen alle ' + APPS.length + ' schermen de eigen gegevens, niet alleen een lege huls',
  { skip: geenBrowser(pw) }, async () => {
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, OFFICE_CODE: 'KANTOOR-LSSCHERM' } });
  let browser;
  try {
    const token = await nieuwLid(base);
    const office = await fetch(base + '/api/office/login', { method: 'POST',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: 'KANTOOR-LSSCHERM' }) })
      .then(r => r.json()).then(r => r.token);
    assert.ok(office, 'het kantoor logt in');
    await elevateTier(base, token, 'lifestyle', office);

    /* Eerst via de API vullen -- dat pad ligt al vast in rechterhand-reis en
       rechterhand-huis. Deze toets gaat over de vraag of het SCHERM datzelfde
       laat zien. */
    for (const a of APPS) {
      const r = await fetch(base + '/api/member/rechterhand/' + a.zet, { method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify(a.body) }).then(r => r.json());
      assert.ok(!r.error, a.app + ' is gevuld via de API: ' + JSON.stringify(r).slice(0, 140));
    }

    browser = await pw.chromium.launch(browserOpties(pw));
    /* DE SERVICE WORKER ERUIT. Zonder dit blokje meet deze toets iets anders
       dan hij denkt: de RTF-schil registreert een service worker die tientallen
       schermen vooruit ophaalt, en die staan daarna in het schermjournaal alsof
       DEZE toets ze heeft afgelegd. Bij rtfkinderschermen liep dat op tot 55
       schermen -- boven de veeggrens van scripts/schermen.js, waardoor de toets
       als veegtoets telde en zijn eigen acht schermen niet meer meetelden.
       test/leven.e2e.js blokkeerde ze al; hier stond het nog niet. */
    const ctx = await browser.newContext({ serviceWorkers: 'block' });
    const page = await ctx.newPage();
    const fouten = [];
    letOpFouten(page, fouten);

    const stuk = [];
    for (const a of APPS) {
      await open(page, base, a.app, token);

      /* De poort hoort nu WEG te zijn. Zonder deze controle zou een scherm dat
         de pas niet herkent maar toevallig de naam ergens toont, alsnog slagen. */
      const eerst = await schermtekst(page);
      if (/uitsluitend op uitnodiging/i.test(eerst)) { stuk.push(a.app + ': toont nog steeds de poort'); continue; }

      /* Waar de lijst achter een tabblad zit: erop tikken, zoals een gebruiker
         ook doet. Een tab die niet te vinden is, is zelf een bevinding. */
      if (a.tab) {
        const knop = page.locator('text=' + a.tab).first();
        if (!await knop.count()) { stuk.push(a.app + ': tabblad "' + a.tab + '" staat er niet'); continue; }
        try { await knop.click({ timeout: 4000 }); } catch (e) { stuk.push(a.app + ': tabblad "' + a.tab + '" is niet aan te tikken'); continue; }
        await page.waitForTimeout(400);
      }

      const tekst = await schermtekst(page);
      if (!tekst.includes(a.toont)) {
        stuk.push(a.app + ': "' + a.toont + '" staat niet op het scherm -- ' + tekst.slice(0, 160));
        continue;
      }
      /* Waar het scherm zelf rekent, toetsen we ook de uitkomst: 6 flessen van
         180 hoort 1.080 kelderwaarde te geven. Dat kan geen vaste tekst zijn. */
      if (a.ook && !tekst.includes(a.ook)) {
        stuk.push(a.app + ': het uitgerekende getal "' + a.ook + '" staat er niet -- ' + tekst.slice(0, 160));
      }
    }
    assert.deepEqual(stuk, [], 'alle twaalf schermen tonen hun eigen gegevens:\n  ' + stuk.join('\n  '));
    assert.deepEqual(fouten, [], 'paginafouten: ' + fouten.join(' | '));
  } finally {
    if (browser) await browser.close();
    child.kill();
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
