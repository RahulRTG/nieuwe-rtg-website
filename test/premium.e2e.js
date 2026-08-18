/* Scherm-test voor de premium-laag: meenemen (shared/uitvoer.js) en
   sneltoetsen (shared/sneltoets.js).

   Waarom deze twee. Gemeten over de app-catalogus was dit het verschil
   tussen de apps die hier volwaardig heten en de rest: sneltoetsen 65% tegen
   28%, uitvoer 25% tegen 5%. Het zijn de twee kenmerken die een scherm tot
   gereedschap maken, en ze ontbraken het vaakst.

   Wat deze toets vastlegt, en vooral wat hij WEIGERT:
   1. meenemen levert ECHTE velden, geen aan elkaar geplakte schermtekst.
      De eerste versie schraapte de grootste lijst van het scherm en gaf
      "01PassenElke pas heeft een eigen stem" in een kolom; dat is een vinkje
      dat op een functie lijkt. Zonder aangemelde bron en zonder echte tabel
      hoort er GEEN uitvoer te zijn.
   2. meenemen is met een AANWIJZER te bedienen. De laag had alleen de letter
      "e" uit sneltoets.js als aanroeper; op een telefoon is dat geen
      bediening, en dan is de hele exportlaag er wel en nergens te bereiken.
      Daarom staat de maat hier op 390x844 en wordt die maat ook beweerd:
      een viewport-stap die stil niets doet is precies wat LAT regel 3
      verbiedt.
   3. de sneltoetsen wijzen naar knoppen die de app echt heeft, en doen
      niets in een invoerveld of met Ctrl/Cmd erbij.
   4. de knop staat NIET in de balk van het deelmenu, de cijfers openen de
      delen die het deelmenu zelf noemt, en een open venster legt de
      sneltoetsen eronder stil.
   Draait alleen waar een browser is. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, letOpFouten, laadPlaywright, browserOpties, geenBrowser } = require('./helper');

const pw = laadPlaywright();

/* Vierentwintig zelfstandige RTG- en kantoorruimtes werden alleen door de
   algemene paginascan aangeraakt. Dit is hun eigen zichtbare contract zonder
   sessie: het adres blijft staan, de kamer noemt zichzelf, en er is een echte
   bediening of veilige deur. Daardoor kan een lege premiumtegel niet groen
   blijven omdat een generieke scan alleen HTTP 200 zag. */
const PREMIUM_ZELFSTANDIG = [
  ['arrival', /RTG Invisible Arrival/i, /Vertel het één keer|arrival/i],
  ['leverancier-aanvragen', /Aanvragen uit de Mall/i, /Aanvragen/i],
  ['loonstrook', /Mijn loon/i, /Mijn loon|Loonstroken/i],
  ['merken', /Merken.*vestigingen/i, /Merken|vestigingen/i],
  ['mijnmall', /Mijn Mall/i, /Mijn Mall|toegang|pas/i],
  ['ovcontrol', /Mobility Control Tower/i, /Mobility Control Tower|operatie/i],
  ['partner-worden', /Partner worden/i, /Partneraanvraag|Partner worden/i],
  ['rit', /RTG Rit/i, /Geen rit gekozen|Rit/i],
  ['voertuig', /RTG Voertuig/i, /Geen voertuig gekozen|Voertuig/i],
  ['zaakweb', /Mijn RTG-website/i, /Mijn RTG-website|Nog geen website/i]
];
const PREMIUM_ALIASSEN = [
  ['bank', '/apps/geld.html', '#bank'],
  ['codewoord', '/apps/veilig.html', '#codewoord'],
  ['labfonds', '/apps/geld.html', '#labfonds'],
  ['mecenaat', '/apps/geld.html', '#mecenaat'],
  ['metier', '/apps/geld.html', '#metier'],
  ['nalatenschap', '/apps/geld.html', '#nalatenschap'],
  ['rtgcode', '/apps/geld.html', '#rtgcode'],
  ['thuisrust', '/apps/veilig.html', '#rust'],
  ['thuiswacht', '/apps/veilig.html', '#wacht'],
  ['vitaal', '/apps/veilig.html', '#vitaal'],
  ['wbw', '/apps/geld.html', '#wbw']
];
const PREMIUM_TOEGANG = [
  ['magnaat-kantoor', '/apps/personeel.html'],
  ['magnaat', '/apps/app.html'],
  ['rtgone', '/apps/rtgkantoor.html']
];

async function lidMetNotities(base) {
  const u = Date.now().toString().slice(-8);
  const reg = await fetch(base + '/api/auth/register', { method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Premlid', email: 'pm' + u + '@x.nl', phone: '06' + u,
      password: 'geheim123', geboortedatum: '1990-01-01', geslacht: 'v', tier: 'rtg', pasApp: 'rtg' }) }).then(r => r.json());
  const H = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + reg.token };
  // vier stuks, bewust: met minder dan drie rijen zou een schermschraper
  // sowieso niets vinden en kan de weigering-bewering hieronder niet zakken
  for (const titel of ['Boodschappen', 'Reis Milaan', 'Klusjes', 'Cadeaus']) {
    await fetch(base + '/api/notities/bewaar', { method: 'POST', headers: H, body: JSON.stringify({ titel }) });
  }
  return reg.token;
}

test('premium: meenemen geeft echte velden, en weigert schermtekst',
  { skip: geenBrowser(pw) }, async () => {
  const { child, base } = await startServer({ env: { SMTP_URL: '' } });
  let browser;
  try {
    const token = await lidMetNotities(base);
    browser = await pw.chromium.launch(browserOpties(pw));
    const page = await browser.newPage();
    const fouten = [];
    letOpFouten(page, fouten);
    await page.goto(base + '/apps/notities.html', { waitUntil: 'domcontentloaded' });
    await page.evaluate(t => { localStorage.setItem('rtg_member_token', t); localStorage.setItem('rtg_cookieinfo_v1', '1'); }, token);
    await page.goto(base + '/apps/notities.html', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.RTGUitvoer && RTGUitvoer.beschikbaar(), null, { timeout: 12000 });

    /* Telefoonmaat, en dat wordt ook beweerd. Hier stond eerder
       `if (page.setViewportSize)`, en de eigen driver had die methode niet:
       de stap draaide nooit en zei er niets over (LAT regel 3). */
    await page.setViewportSize({ width: 390, height: 844 });
    const breed = await page.evaluate(() => innerWidth);
    assert.equal(breed, 390, 'de meting staat echt op telefoonmaat, kreeg ' + breed);

    const d = await page.evaluate(() => RTGUitvoer.gegevens());
    // echte velden: meer dan een kolom, en de titel staat in een EIGEN veld
    assert.ok(d.kolommen.length >= 3, 'meerdere kolommen, kreeg: ' + d.kolommen.join(', '));
    assert.ok(d.rijen.length >= 4, 'de notities zitten erin (' + d.rijen.length + ')');
    const titels = d.rijen.map(r => r[d.kolommen.indexOf('titel')]);
    assert.ok(titels.includes('Boodschappen'), 'de titel staat als eigen veld, kreeg: ' + titels.join(' | '));
    // en niet als een aan elkaar geplakte regel
    assert.ok(!d.rijen.some(r => r.length === 1), 'geen enkele rij is een dichtgeplakte tekstregel');

    /* De bediening zelf. Zonder dit blok kan de toets niet zakken als de
       knop er niet is: RTGUitvoer.gegevens() werkt ook prima zonder dat een
       mens erbij kan. De rand hoort erbij: een knop zonder rand is op deze
       schermen niet te onderscheiden van de tekst ernaast. */
    await page.waitForFunction(() => !!document.querySelector('.rtguitvoer-knop'), null, { timeout: 12000 });
    const bediening = await page.evaluate(() => {
      const k = document.querySelector('.rtguitvoer-knop');
      const st = getComputedStyle(k), vak = k.getBoundingClientRect();
      const uit = {
        label: k.textContent.trim(), hoog: Math.round(vak.height),
        rand: st.borderTopWidth + ' ' + st.borderTopStyle,
        inBeeld: vak.top >= 0 && vak.bottom <= innerHeight && vak.left >= 0 && vak.right <= innerWidth
      };
      k.click();
      // geen venster is hier een uitkomst en geen crash: dan zakt de bewering
      const laag = document.querySelector('.rtguitvoer-laag');
      uit.open = !!(laag && !laag.hidden);
      if (!uit.open) return uit;
      uit.vormen = [].slice.call(laag.querySelectorAll('[data-vorm]')).map((b) => b.getAttribute('data-vorm'));
      laag.querySelector('.rtguitvoer-sluit').click();
      uit.dicht = laag.hidden;
      return uit;
    });
    assert.equal(bediening.label, 'Meenemen', 'de knop heet zoals de laag belooft');
    assert.ok(bediening.hoog >= 44, 'met een duim te raken, kreeg ' + bediening.hoog + 'px');
    assert.equal(bediening.rand, '1px solid', 'de rand die de laag zet is er ook echt, kreeg: ' + bediening.rand);
    assert.equal(bediening.inBeeld, true, 'en hij staat op telefoonmaat binnen beeld');
    assert.equal(bediening.open, true, 'een tik opent het venster');
    assert.deepEqual(bediening.vormen, ['csv', 'json'], 'beide vormen staan erin');
    assert.equal(bediening.dicht, true, 'en de sluitknop sluit het weer, ook zonder Esc');

    /* de weigering: haal de aangemelde bron weg en er hoort NIETS meer te
       zijn -- want deze pagina heeft geen echte tabel */
    const zonder = await page.evaluate(() => { RTGUitvoer.bron(null); return RTGUitvoer.beschikbaar(); });
    assert.equal(zonder, false, 'zonder aangemelde bron weigert de uitvoer (geen schermschraapsel)');

    assert.deepEqual(fouten, [], 'paginafouten: ' + fouten.join(' | '));
  } finally {
    if (browser) await browser.close();
    child.kill();
  }
});

test('premium: sneltoetsen wijzen naar knoppen die er echt zijn',
  { skip: geenBrowser(pw) }, async () => {
  const { child, base } = await startServer({ env: { SMTP_URL: '' } });
  let browser;
  try {
    const token = await lidMetNotities(base);
    browser = await pw.chromium.launch(browserOpties(pw));
    const page = await browser.newPage();
    await page.goto(base + '/apps/notities.html', { waitUntil: 'domcontentloaded' });
    await page.evaluate(t => { localStorage.setItem('rtg_member_token', t); localStorage.setItem('rtg_cookieinfo_v1', '1'); }, token);
    await page.goto(base + '/apps/notities.html', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !!window.RTGSneltoets, null, { timeout: 12000 });

    const gevonden = await page.evaluate(() => ({
      zoek: !!RTGSneltoets.zoekVeld(),
      nieuw: RTGSneltoets.nieuwKnop() ? RTGSneltoets.nieuwKnop().textContent.trim() : null
    }));
    assert.ok(gevonden.zoek, 'de laag vindt het zoekveld van deze app');
    assert.ok(gevonden.nieuw, 'en de knop waarmee je iets nieuws maakt');

    // ? toont het overzicht, met alleen wat deze app echt kan
    await page.keyboard.press('?');
    const rijen = await page.$$eval('.rtgsnel dt', ds => ds.map(d => d.textContent));
    assert.ok(rijen.includes('/') && rijen.includes('n'), 'het overzicht noemt de toetsen: ' + rijen.join(' '));
    await page.keyboard.press('Escape');
    const dicht = await page.evaluate(() => document.querySelector('.rtgsnel').hidden);
    assert.equal(dicht, true, 'Esc sluit het overzicht');

    /* in een invoerveld gaat typen voor: "n" mag daar geen knop indrukken */
    const voor = await page.evaluate(() => document.querySelectorAll('.rtgsnel').length);
    await page.evaluate(() => { const z = RTGSneltoets.zoekVeld(); z.focus(); });
    await page.keyboard.type('n');
    const inVeld = await page.evaluate(() => ({
      waarde: RTGSneltoets.zoekVeld().value,
      bladen: document.querySelectorAll('.rtgsnel').length
    }));
    assert.equal(inVeld.waarde, 'n', 'in een veld komt de letter gewoon in het veld');
    assert.equal(inVeld.bladen, voor, 'en er verschijnt niets extra');
  } finally {
    if (browser) await browser.close();
    child.kill();
  }
});

/* De derde toets gaat over de plek waar de twee lagen elkaar raken, en die
   plek was stuk. De meeneemknop hoort NIET in de balk van het deelmenu:
   sneltoets.js nummerde daar elke knop als een deel, dus een knop die geen
   deel is verschoof de nummering die het overzicht letterlijk belooft. En
   een open venster hoort de toetsen eronder stil te leggen -- inVeld()
   dekte dat niet, want in een venster staat de focus op een KNOP. */
test('premium: de meeneemknop is geen deel, en een open venster legt de toetsen stil',
  { skip: geenBrowser(pw) }, async () => {
  const { child, base } = await startServer({ env: { SMTP_URL: '' } });
  let browser;
  try {
    const token = await lidMetNotities(base);
    browser = await pw.chromium.launch(browserOpties(pw));
    const context = await browser.newContext();
    await context.addInitScript((t) => {
      localStorage.setItem('rtg_member_token', t);
      localStorage.setItem('rtg_cookieinfo_v1', '1');
    }, token);
    const page = await context.newPage();
    const fouten = [];
    letOpFouten(page, fouten);
    await page.goto(base + '/apps/home.html', { waitUntil: 'domcontentloaded' });
    await page.setViewportSize({ width: 390, height: 844 });
    // Home Kit heeft drie echte delen EN meldt zijn apparatenregister aan
    await page.waitForFunction(() => !!document.querySelector('.rtgdeel-balk') &&
      !!document.querySelector('.rtguitvoer-knop'), null, { timeout: 15000 });

    const balk = await page.evaluate(() => {
      const b = document.querySelector('.rtgdeel-balk');
      return {
        knoppen: [].slice.call(b.querySelectorAll('button')).map(k => k.textContent.trim()),
        delen: RTGDeel.delen().length,
        knopInBalk: b.contains(document.querySelector('.rtguitvoer-knop'))
      };
    });
    assert.equal(balk.knopInBalk, false, 'de meeneemknop hangt niet in de deelbalk');
    assert.equal(balk.knoppen.length, balk.delen,
      'elke knop in de balk is een deel: ' + balk.knoppen.join(' | '));

    // cijfer 3 opent het DERDE deel, niet de derde knop van wie dan ook
    const derde = await page.evaluate(() => RTGDeel.delen()[2]);
    await page.keyboard.press('3');
    const na3 = await page.evaluate(() => {
      const b = [].slice.call(document.querySelectorAll('.rtgdeel-balk button'));
      return { aan: b.findIndex(k => k.getAttribute('aria-current') === 'true'), hash: location.hash };
    });
    assert.equal(na3.aan, 2, 'cijfer 3 zet het derde deel aan, kreeg index ' + na3.aan);
    assert.equal(na3.hash, '#deel-' + derde, 'en het is het deel dat het deelmenu zelf noemt');

    /* Venster open: de toetsen eronder zijn nu van het venster. Een cijfer
       mag niet meer van deel wisselen, en Tab mag het venster niet uit. */
    await page.click('.rtguitvoer-knop');
    await page.keyboard.press('1');
    await page.keyboard.press('n');
    const eronder = await page.evaluate(() => {
      const b = [].slice.call(document.querySelectorAll('.rtgdeel-balk button'));
      const laag = document.querySelector('.rtguitvoer-laag');
      return { aan: b.findIndex(k => k.getAttribute('aria-current') === 'true'), open: !laag.hidden };
    });
    assert.equal(eronder.open, true, 'het venster staat nog open');
    assert.equal(eronder.aan, 2, 'een cijfer wisselt niet van deel achter een open venster');

    const ronde = [];
    for (let i = 0; i < 4; i++) {
      await page.keyboard.press('Tab');
      ronde.push(await page.evaluate(() => document.activeElement.textContent.trim()));
    }
    assert.deepEqual(ronde, ['JSON', 'Sluiten', 'CSV', 'JSON'], 'Tab draait rond in het venster, kreeg: ' + ronde.join(' '));

    await page.keyboard.press('Escape');
    const naEsc = await page.evaluate(() => ({
      dicht: document.querySelector('.rtguitvoer-laag').hidden,
      focus: (document.activeElement.className || '').indexOf('rtguitvoer-knop') >= 0
    }));
    assert.equal(naEsc.dicht, true, 'Esc sluit het venster');
    assert.equal(naEsc.focus, true, 'en de focus gaat terug naar de knop waar de tik vandaan kwam');

    assert.deepEqual(fouten, [], 'paginafouten: ' + fouten.join(' | '));
  } finally {
    if (browser) await browser.close();
    child.kill();
  }
});

/* Een knop die ER IS maar niet getekend wordt, is geen knop. /apps/app.html
   sluit zijn eigen gastheer ([role=main] #gate) zodra de app opstart; de
   knop stond daar en had daarna offsetHeight 0 -- aanwezig in de DOM, en
   voor een gebruiker weg. Deze toets meet de getekende maat, niet of het
   element bestaat. */
test('premium: de knop blijft getekend als de app zijn gastheer sluit',
  { skip: geenBrowser(pw) }, async () => {
  const { child, base } = await startServer({ env: { SMTP_URL: '' } });
  let browser;
  try {
    const token = await lidMetNotities(base);
    browser = await pw.chromium.launch(browserOpties(pw));
    const context = await browser.newContext();
    await context.addInitScript((t) => {
      localStorage.setItem('rtg_member_token', t);
      localStorage.setItem('rtg_cookieinfo_v1', '1');
    }, token);
    const page = await context.newPage();
    await page.goto(base + '/apps/app.html', { waitUntil: 'domcontentloaded' });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForFunction(() => !!window.RTGUitvoer, null, { timeout: 12000 });
    /* deze app meldt zijn bron pas aan als er gegevens zijn; we melden er
       zelf een aan zodat plaats() gedwongen wordt te kiezen */
    await page.evaluate(() => RTGUitvoer.bron(function () { return { kolommen: ['a', 'b'], rijen: [['1', '2']] }; }));
    await page.waitForTimeout(3000);
    const zicht = await page.evaluate(() => {
      const k = document.querySelector('.rtguitvoer-knop');
      if (!k) return { knop: false };
      return { knop: true, getekend: k.offsetParent !== null, hoog: k.offsetHeight, ouder: k.parentElement.tagName };
    });
    assert.equal(zicht.knop, true, 'de knop staat er');
    assert.equal(zicht.getekend, true, 'en hij wordt ook getekend (ouder: ' + zicht.ouder + ')');
    assert.ok(zicht.hoog >= 44, 'met zijn volle duimmaat, kreeg ' + zicht.hoog + 'px');
  } finally {
    if (browser) await browser.close();
    child.kill();
  }
});

/* De knop moest op EEN pagina binnen beeld staan (notities), en dat is te
   weinig gebleken: een app-kop is vaak een flexrij die niet afbreekt en
   position:fixed staat, en dan schuift de knop er op telefoonmaat rechts uit
   zonder dat je ernaartoe kunt scrollen. Gemeten op 390 breed viel hij zo van
   het scherm bij navigatie (343..452) en ov (302..410). Deze toets neemt juist
   die twee mee, plus twee die het altijd al goed deden, en dwingt de plaatsing
   om zichzelf te corrigeren. Hij zakt zodra inBeeld() in shared/uitvoer niet
   meer meeweegt. */
test('premium: de meeneemknop staat op telefoonmaat overal binnen beeld',
  { skip: geenBrowser(pw) }, async () => {
  const { child, base } = await startServer({ env: { SMTP_URL: '' } });
  let browser;
  try {
    browser = await pw.chromium.launch(browserOpties(pw));
    const page = await browser.newPage();
    await page.setViewportSize({ width: 390, height: 844 });
    const buiten = [];
    for (const pad of ['/apps/navigatie.html', '/apps/ov.html', '/apps/balans.html', '/apps/home.html']) {
      await page.goto(base + pad, { waitUntil: 'load' });
      await page.waitForFunction(() => !!window.RTGUitvoer, null, { timeout: 12000 });
      // een bron aanmelden zoals een ingelogde app dat doet; zonder bron is er
      // geen knop, en dan meet deze toets niets
      await page.evaluate(() => RTGUitvoer.bron(function () { return { kolommen: ['a'], rijen: [['1']] }; }));
      await page.waitForFunction(() => !!document.querySelector('.rtguitvoer-knop'), null, { timeout: 12000 });
      const r = await page.evaluate(() => {
        const v = document.querySelector('.rtguitvoer-knop').getBoundingClientRect();
        return { links: Math.round(v.left), rechts: Math.round(v.right), breed: innerWidth };
      });
      if (r.links < 0 || r.rechts > r.breed) buiten.push(pad + ' op x ' + r.links + '..' + r.rechts + ' bij ' + r.breed + ' breed');
    }
    assert.deepEqual(buiten, [], 'deze pagina\'s zetten de meeneemknop buiten beeld:\n  ' + buiten.join('\n  '));
  } finally {
    if (browser) await browser.close();
    child.kill();
  }
});

test('premium: alle overige zelfstandige ruimtes tonen hun eigen doel en veilige bediening',
  { skip: geenBrowser(pw) }, async () => {
  const { child, base } = await startServer({ env: { SMTP_URL: '' } });
  let browser;
  try {
    browser = await pw.chromium.launch(browserOpties(pw));
    const context = await browser.newContext({ serviceWorkers: 'block' });
    await context.addInitScript(() => {
      try {
        localStorage.clear();
        localStorage.setItem('rtg_cookieinfo_v1', '1');
      } catch (e) {}
    });
    const page = await context.newPage();
    const fouten = [];
    letOpFouten(page, fouten);
    const stuk = [];

    for (const [naam, titel, doel] of PREMIUM_ZELFSTANDIG) {
      const pad = '/apps/' + naam + '.html';
      await page.goto(base + pad, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(350);
      const r = await page.evaluate(() => ({
        pad: location.pathname,
        titel: document.title,
        tekst: document.body.innerText.replace(/\s+/g, ' ').trim(),
        bediening: document.querySelectorAll('a[href], button, input, textarea, select').length
      }));
      if (r.pad !== pad) { stuk.push(naam + ': stuurde weg naar ' + r.pad); continue; }
      if (!titel.test(r.titel)) stuk.push(naam + ': verkeerde titel "' + r.titel + '"');
      if (!doel.test(r.tekst)) stuk.push(naam + ': het eigen doel of de eigen deur staat niet in beeld');
      if (!r.bediening) stuk.push(naam + ': geen enkele bediening of veilige uitweg');
    }

    /* Elf oude bladwijzerpaden zijn bewust standen van de twee brede apps.
       Hun contract is dus geen eigen kamer, maar een exacte, verliesloze
       omleiding naar de juiste stand. */
    for (const [naam, doelpad, hash] of PREMIUM_ALIASSEN) {
      await page.goto(base + '/apps/' + naam + '.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(250);
      const r = await page.evaluate(() => ({ pad: location.pathname, hash: location.hash }));
      if (r.pad !== doelpad || r.hash !== hash) {
        stuk.push(naam + ': alias kwam uit op ' + r.pad + r.hash + ' in plaats van ' + doelpad + hash);
      }
    }

    /* Drie echte werkruimtes zijn zonder account wél dicht. Ze moeten naar
       hun juiste inlogdeur gaan, nooit leeg blijven of een generieke fout
       tonen. De kantooralias bewaart bovendien de veilige terugweg. */
    for (const [naam, doelpad] of PREMIUM_TOEGANG) {
      const bron = '/apps/' + naam + '.html';
      await page.goto(base + bron, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(450);
      const r = await page.evaluate(() => ({
        pad: location.pathname,
        kantoor: new URLSearchParams(location.search).get('kantoor'),
        terug: new URLSearchParams(location.search).get('terug')
      }));
      if (r.pad !== doelpad) stuk.push(naam + ': toegang kwam uit op ' + r.pad + ' in plaats van ' + doelpad);
      if (naam === 'magnaat-kantoor' && (r.kantoor !== '1' || r.terug !== bron)) {
        stuk.push(naam + ': personeelsdeur verloor de kantoorstand of veilige terugweg');
      }
    }

    assert.deepEqual(stuk, [], 'zelfstandige premiumruimtes:\n  ' + stuk.join('\n  '));
    const echt = fouten.filter(f => !/^geen sessie$/.test(String(f).trim()));
    assert.deepEqual(echt, [], 'paginafouten (anders dan de bedoelde sessiestop): ' + echt.join(' | '));
  } finally {
    if (browser) await browser.close();
    child.kill();
  }
});
