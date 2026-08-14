/* DE WINGS van de leden-app: de werkbank naast de console.

   Op de computer kan de middenconsole niet groter -- dat is gemeten, niet
   gekozen: --e wordt begrensd door 1.48cqh omdat het beginscherm in EEN scherm
   past zonder scrollen, dus op een 900px hoog venster staat --e op 12,5px,
   dezelfde maat als op een telefoon. De breedte die daardoor overblijft is waar
   de wings voor zijn.

   WAAROM DEZE TOETS ER IS, EN NIET ALLEEN EEN SCHERMSCHOT.

   De eerste versie van deze wings stond in een eigen deelbestand tussen
   app-main-59 en -60. De bron in public/apps/app-main/ is op GROOTTE geknipt en
   niet op functiegrenzen, dus dat bestand belandde midden in een functie die
   nooit wordt aangeroepen. Geen syntaxfout, geen uitzondering in de console, de
   CSS-poort werkte, de elementen stonden in de DOM en de browser haalde de code
   op -- en er gebeurde niets. Precies het beeld waarbij je "hij staat erin"
   zegt.

   Dat is pas gebleken door in de PAGINA te kijken of er iets in de flanken
   stond. Deze toets doet dat elke keer opnieuw:

     1. onder 1100px zijn de wings er niet (display:none EN leeg)
     2. erboven staan de zakelijke apps erin, met echte namen
     3. de naam van een tab-app komt uit de tabbar (itemDef kent hem niet)
     4. de keuze is aanpasbaar en overleeft een herlaadbeurt

   Draait alleen waar Playwright beschikbaar is; anders overgeslagen.
   Draai: npm run e2e */
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop, letOpFouten } = require('./helper');
const fs = require('fs');
const os = require('os');
const path = require('path');

function laadPlaywright() {
  for (const p of [undefined, '/opt/node22/lib/node_modules', '/usr/lib/node_modules', '/usr/local/lib/node_modules']) {
    try { return require(p ? require.resolve('playwright', { paths: [p] }) : 'playwright'); } catch (e) {}
  }
  try { const eigen = require('../server/lib/browser'); if (eigen.beschikbaar()) return eigen; } catch (e) {}
  return null;
}
const pw = laadPlaywright();

async function opzet() {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-wings-'));
  const srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: dataDir } });
  const u = Date.now().toString(36);
  const r = await fetch(srv.base + '/api/auth/register', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Wing Proef', email: 'wing' + u + '@voorbeeld.test', phone: '0612345678',
      password: 'geheim12345', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' })
  });
  const d = await r.json();
  return { srv, token: d.token, dataDir };
}

/* De OS-laag toont zijn springboard pas als #app de klasse `active` draagt. Een
   verse registratie zit nog in de intake, dus die klasse zetten we zelf: we
   toetsen de WINGS en niet de onboarding. */
async function meet(pwBrowser, base, token, breed, hoog) {
  const ctx = await pwBrowser.newContext({ viewport: { width: breed, height: hoog }, serviceWorkers: 'block' });
  const page = await ctx.newPage();
  const fouten = [];
  letOpFouten(page, fouten);
  /* EEN GECONTROLEERD BETAALOVERZICHT.

     Een vers lid heeft geen geschiedenis (en opladen vraagt eerst KYC), dus
     zonder dit blijft de tweede regel van de Payments-widget leeg en zou deze
     toets nooit kunnen zakken op de velden. De VORM hieronder is niet verzonnen
     maar overgenomen uit server/kern/pay/verzoeken.js (overzicht): rijen met
     `oms`, `centen`, `soort`, `tegen`. Mijn eerste versie las `omschrijving` en
     `wat` -- geraden, en dus stil leeg. */
  await page.route('**/api/pay/overzicht', route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ ok: true, codenaam: 'PROEF', saldo: 2550,
      geschiedenis: [{ id: 'x1', at: new Date().toISOString(), oms: 'Opgeladen', soort: 'oplaad', centen: 2550, tegen: 'opgeladen' }],
      aanMij: [], vanMij: [] })
  }));
  await page.addInitScript(t => { try { localStorage.setItem('rtg_member_token', t); } catch (e) {} }, token);
  /* DE OS-STAND WORDT AL TIJDENS HET LADEN GEZET, niet met een evaluate erna.

     Hier stond `goto` gevolgd door `page.evaluate`, en die combinatie zakte
     onder belasting op "Execution context was destroyed": tussen het einde van
     domcontentloaded en de evaluate kon de pagina nog navigeren, en dan is de
     context waarin de evaluate zou draaien verdwenen. Een waarnemer die AL
     draait voordat de pagina bestaat, heeft dat gat niet.

     Wat hier gebeurt is hetzelfde als voorheen: #app krijgt de klasse `active`
     (de OS-laag toont zijn springboard pas dan; een verse registratie zit nog
     in de intake), en het modale onboarding-dialoog #onbGate gaat weg omdat het
     de flanken onaanklikbaar maakt. Wat deze toets dus NIET toetst is of de
     onboarding zelf klopt; daar zijn de aanmeldtoetsen voor. */
  await page.addInitScript(() => {
    const zet = () => {
      const a = document.getElementById('app');
      if (a && !a.classList.contains('active')) a.classList.add('active');
      const gate = document.getElementById('onbGate');
      if (gate) gate.remove();
    };
    const start = () => { zet(); new MutationObserver(zet).observe(document.documentElement, { childList: true, subtree: true }); };
    if (document.documentElement) start();
    else document.addEventListener('readystatechange', start, { once: true });
  });
  await page.goto(base + '/apps/app.html', { waitUntil: 'load', timeout: 45000 });

  /* WACHTEN OP DE TOESTAND, NIET OP DE KLOK.

     Hier stond `waitForTimeout(2500)` met de opmerking "de widgets halen hun
     bron op". Dat is een gok: op een rustige machine te lang, onder belasting
     te kort -- en dan zakt de toets op iets dat niets met de wings te maken
     heeft. De widgets markeren zichzelf nu met `data-wing-bron="klaar"` zodra hun bron
     geantwoord heeft (ook als het antwoord leeg was), dus is er een echte
     toestand om op te wachten. Op smalle schermen bestaan er geen widgets; dan
     is de toestand "de flanken zijn leeg" en die is er meteen. */
  await page.waitForFunction(() => {
    const L = document.getElementById('wingL');
    if (!L) return false;
    const kaarten = document.querySelectorAll('.wing-widget');
    if (!kaarten.length) return getComputedStyle(L).display === 'none' || !L.children.length;
    return [...kaarten].every(k => k.dataset.wingBron === 'klaar');
  }, { timeout: 20000 });
  const uit = await page.evaluate(() => {
    const L = document.getElementById('wingL'), R = document.getElementById('wingR');
    const namen = el => [...el.querySelectorAll('.wing-naam')].map(n => n.textContent.trim());
    /* De SLEUTEL naast de naam: waarop we toetsen dat een app er staat, is de
       sleutel (link:office) en niet zijn label. Dat label is beleidsmatig aan
       verandering onderhevig -- de tegels heten hier functies en geen producten
       -- en deze toets zakte dan ook op "RTG Office" nadat die "Documenten"
       ging heten. De namen blijven we wel meten: ze bewaken hieronder dat er
       geen ruwe sleutel als label in de flank belandt. */
    const sleutels = el => [...el.querySelectorAll('.wing-widget')].map(w => w.dataset.sleutel || '');
    return {
      display: L ? getComputedStyle(L).display : null,
      links: L ? namen(L) : [], rechts: R ? namen(R) : [],
      linksK: L ? sleutels(L) : [], rechtsK: R ? sleutels(R) : [],
      instel: !!document.querySelector('.wing-instel'),
      widgets: document.querySelectorAll('.wing-widget').length,
      pijlen: document.querySelectorAll('.wing-vol').length,
      metWaarde: [...document.querySelectorAll('.wing-widget.heeft-waarde')]
        .map(x => x.querySelector('.wing-naam').textContent.trim() + ' = ' + x.querySelector('.wing-lijf').textContent.trim()),
      leegLijfZichtbaar: [...document.querySelectorAll('.wing-widget:not(.heeft-waarde)')]
        .some(x => { const l = x.querySelector('.wing-lijf'); return l && getComputedStyle(l).display !== 'none'; }),
      onder: [...document.querySelectorAll('.wing-widget.heeft-onder')].map(x => x.querySelector('.wing-onder').textContent.trim()),
      acties: [...document.querySelectorAll('.wing-widget')].filter(x => x.querySelector('.wing-acties'))
        .map(x => x.querySelector('.wing-naam').textContent.trim() + ': ' + [...x.querySelectorAll('.wing-actie')].map(b => b.textContent.trim()).join('/')),
      knopInKnop: !!document.querySelector('button button'),
      /* De VORM van een afgeronde widget. Zie de bewering hieronder: dit meet
         of de kaart zijn eigen uiterlijk houdt en niet dat van een vreemde
         regel erft. */
      vorm: (() => {
        const k = document.querySelector('.wing-widget'); if (!k) return null;
        const s = getComputedStyle(k);
        return { radius: s.borderRadius, bg: s.backgroundColor, klaar: k.dataset.wingBron || null };
      })(),
      shell: Math.round(document.getElementById('shell').getBoundingClientRect().width)
    };
  });
  uit.fouten = fouten;
  return { uit, page, ctx };
}

test('wings: weg op de iPad, gevuld op de computer, en aanpasbaar', { skip: pw ? false : 'geen Playwright' }, async () => {
  const { srv, token, dataDir } = await opzet();
  const browser = await pw.chromium.launch({ args: ['--no-sandbox'] });
  try {
    // 1) op iPad-breedte bestaan de wings niet
    {
      const { uit, ctx } = await meet(browser, srv.base, token, 820, 1180);
      assert.equal(uit.display, 'none', 'onder 1100px horen de wings weg te zijn');
      assert.deepEqual(uit.links, [], 'en leeg: de OS-laag vult ze daar niet');
      assert.deepEqual(uit.rechts, []);
      assert.equal(uit.instel, false, 'ook geen aanpasknop');
      assert.deepEqual(uit.fouten, [], 'geen JS-fouten');
      await ctx.close();
    }

    // 2) op de computer staan de zakelijke apps erin
    {
      const { uit, page, ctx } = await meet(browser, srv.base, token, 1440, 900);
      assert.equal(uit.display, 'flex', 'boven 1100px horen ze er te zijn');
      assert.ok(uit.links.length >= 3, 'de werkbank is gevuld, maar stond op ' + uit.links.length);
      assert.ok(uit.rechts.length >= 3, 'de administratie is gevuld, maar stond op ' + uit.rechts.length);
      assert.ok(uit.linksK.includes('link:office'),
        'RTG Office (document, rekenblad, presentatie) hoort in de werkbank; gevonden: ' + uit.links.join(', '));
      assert.ok(uit.rechtsK.includes('link:balans'),
        'Balans hoort in de administratie; gevonden: ' + uit.rechts.join(', '));
      assert.equal(uit.instel, true, 'en er is een aanpasknop');
      /* De naam van een TAB-app komt niet uit de registry maar uit de tabbar.
         Zonder die weg stond hier letterlijk "tab:bestellen" in de flank. */
      for (const n of [...uit.links, ...uit.rechts]) {
        assert.ok(!/^(tab|link|os):/.test(n), 'een ruwe sleutel als label: ' + n);
      }
      /* WIDGETS, GEEN TEGELS. Elke kaart heeft een uitklappijl (full screen =
         de app), en een kaart ZONDER bron toont geen leeg lijf -- want een lege
         regel leest als "u heeft niets" en dat is een bewering. */
      assert.equal(uit.widgets, uit.links.length + uit.rechts.length, 'elke flank-app hoort een widget te zijn');
      assert.equal(uit.pijlen, uit.widgets, 'elke widget heeft een uitklappijl naar de app');
      assert.equal(uit.leegLijfZichtbaar, false, 'een widget zonder bron toont geen leeg lijf');
      assert.ok(uit.metWaarde.some(w => w.startsWith('Balans')), 'de Balans-widget hoort een echt advies te tonen, kreeg: ' + JSON.stringify(uit.metWaarde));
      assert.ok(uit.metWaarde.some(w => /€/.test(w)), 'een geld-widget hoort een echt bedrag te tonen, kreeg: ' + JSON.stringify(uit.metWaarde));
      assert.ok(uit.metWaarde.some(w => /25[.,]50/.test(w)), 'het saldo hoort uit de bron te komen (25,50), kreeg: ' + JSON.stringify(uit.metWaarde));
      /* De tweede regel: de laatste mutatie. Dit pint de VELDNAMEN vast (oms,
         centen). Leest iemand hier ooit weer `omschrijving`, dan zakt dit. */
      assert.ok(uit.onder.some(o => /Opgeladen/.test(o)), 'de laatste mutatie hoort onder het saldo te staan, kreeg: ' + JSON.stringify(uit.onder));
      /* IN DE FLANK BRUIKBAAR: de Balans-widget heeft een actieknop die Rahul
         met de meegeleverde vraag opent, zonder de console te verlaten. */
      assert.ok(uit.acties.some(a => a.startsWith('Balans')), 'Balans hoort een actie in de flank te hebben, kreeg: ' + JSON.stringify(uit.acties));
      assert.equal(uit.knopInKnop, false, 'een knop in een knop is ongeldige HTML en niet te bedienen met het toetsenbord');
      /* EEN AFGERONDE WIDGET MAG GEEN VREEMD UITERLIJK ERVEN.

         De markering "mijn bron heeft geantwoord" was een KLASSE, `wing-klaar`,
         en die naam bestond al: app.html geeft hem aan de Klaar-knop van de
         instelkaart, een witte pil met border-radius 999px. Elke widget die
         zijn bron had opgehaald werd daarmee overgeschilderd tot een witte pil
         met onleesbare tekst -- en niemand zag het, want de wings stonden
         achter body.rtg-command, dat op elke computer permanent op de body
         hing. De markering is nu een attribuut (die kan geen opmaak erven);
         deze twee beweringen meten de vingerafdruk van die botsing, zodat een
         volgende naam die per ongeluk raak schiet hier zakt in plaats van in
         de app. */
      assert.equal(uit.vorm.klaar, 'klaar', 'een afgeronde widget hoort zich als afgerond te melden');
      assert.notEqual(uit.vorm.radius, '999px', 'een widget is een kaart, geen pil: hij erft het uiterlijk van een knop');
      assert.notEqual(uit.vorm.bg, 'rgb(255, 255, 255)', 'en zeker geen wit vlak op een zwarte flank');
      assert.deepEqual(uit.fouten, [], 'geen JS-fouten');

      // 3) aanpassen: de eerste app links uitzetten en dat moet blijven staan
      const eerste = uit.links[0];
      /* De onboarding-deur wordt opnieuw opgebouwd nadat de pagina is geladen,
         dus een keer weghalen is niet genoeg: vlak voor de klik nog eens. Dit
         is een echte muisklik en geen JS-aanroep -- of de knop BEREIKBAAR is,
         hoort deze toets te controleren. */
      const gateWeg = () => page.evaluate(() => { const g = document.getElementById('onbGate'); if (g) g.remove(); });
      await gateWeg();
      await page.click('.wing-instel');
      await page.waitForSelector('.wing-kaart');
      await page.evaluate(naam => {
        const rij = [...document.querySelectorAll('.wing-rij')].find(r => r.firstChild.textContent.trim() === naam);
        rij.querySelector('.wing-stand').click();          // de eerste stand is "uit"
      }, eerste);
      await page.waitForTimeout(250);
      const na = await page.evaluate(() => [...document.querySelectorAll('#wingL .wing-naam')].map(n => n.textContent.trim()));
      assert.ok(!na.includes(eerste), '"' + eerste + '" hoort na uitzetten weg te zijn');

      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.evaluate(() => {
    const a = document.getElementById('app'); if (a) a.classList.add('active');
    /* Het onboarding-dialoog (#onbGate) ligt modaal over alles heen zolang de
       intake niet af is. Dat is correct gedrag -- en het maakt de flanken
       onaanklikbaar, wat deze toets als een timeout te zien kreeg. We halen hem
       weg om de WINGS te kunnen beproeven, net zoals we hierboven de OS-stand
       forceren. Wat we hier dus NIET toetsen is of de onboarding zelf klopt;
       daar zijn de aanmeldtoetsen voor. */
    const gate = document.getElementById('onbGate'); if (gate) gate.remove();
  });
      await page.waitForTimeout(700);
      const naHerlaad = await page.evaluate(() => [...document.querySelectorAll('#wingL .wing-naam')].map(n => n.textContent.trim()));
      assert.ok(!naHerlaad.includes(eerste), 'de keuze hoort een herlaadbeurt te overleven');
      await ctx.close();
    }
  } finally {
    await browser.close();
    await stop(srv.child);   // stop() wil het KINDPROCES; srv meegeven doet stil niets
    try { fs.rmSync(dataDir, { recursive: true, force: true }); } catch (e) {}
  }
});
