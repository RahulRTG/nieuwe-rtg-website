/* Scherm-test voor RTG Wereld. test/wereldlaag.test.js bewijst de server-kant; deze
   bewijst dat de APP het doet, en vooral dat de NAAD werkt.

   Waarom dit een eigen scherm-toets verdient: het hele ontwerp staat of valt bij
   twee dingen die je alleen in een browser ziet. Ten eerste dat de gesloten
   wereld ook op het scherm gesloten IS -- een knop die er klikbaar uitziet en
   pas bij de server een 403 oplevert, is precies de fout die je krijgt zodra het
   scherm zijn eigen rechtenlijstje bijhoudt. Ten tweede dat "Bericht" je echt in
   de APARTE berichten-app zet, in het juiste gesprek. Dat is de belofte "twee
   apps, één beweging", en een belofte in tekst is een belofte in code.

   Draait alleen waar een browser beschikbaar is; anders overgeslagen.
   Draai: npm run e2e */
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop, letOpFouten, elevateTier } = require('./helper');
const fs = require('fs');
const os = require('os');
const path = require('path');

/* Eén browserkeuze voor alle schermtoetsen: ./browser.js. Die probeert te
   STARTEN in plaats van te laden -- een Playwright zonder bijbehorende Chromium
   liet elke schermtoets anders omvallen op "Executable doesn't exist". */
const { laadBrowser } = require('./browser');
const pw = laadBrowser();
const api = async (base, pad, body, token) => (await fetch(base + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(body || {})
})).json();

test('RTG Wereld: de schakelaar, de ene feed, en de sprong naar de berichten-app',
  { skip: pw ? false : 'geen browser beschikbaar in deze omgeving' }, async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-wereld-e2e-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    const maak = async (n, tier) => {
      const t = Date.now() + '' + n;
      const d = await api(base, '/api/auth/register', { name: 'Lid ' + t, email: 'e' + t + '@v.test',
        phone: '06' + String(t).slice(-8), password: 'geheim123', geboortedatum: '1990-02-02', tier: 'rtg' });
      if (tier && tier !== 'rtg') {
        const office = (await api(base, '/api/office/login', { code: 'RTG-OFFICE' })).token;
        await elevateTier(base, d.token, tier, office);
      }
      return d.token;
    };
    // A is een gratis lid, B een Lifestyle-lid; ze zijn verbonden
    const a = await maak(1, 'rtg'), b = await maak(2, 'lifestyle');
    const mijA = await api(base, '/api/member/connections', {}, a);
    const mijB = await api(base, '/api/member/connections', {}, b);
    await api(base, '/api/member/connect', { key: mijB.me }, a);
    await api(base, '/api/member/connect/respond', { key: mijA.me, action: 'accept' }, b);
    // B plaatst iets in De Salon; dat hoort in de wereldfeed van A te komen
    await api(base, '/api/salon/plaats', { tekst: 'De boot vertrekt om negen uur' }, b);

    browser = await pw.chromium.launch({ args: ['--no-sandbox'] });
    const page = await browser.newPage();
    const fouten = [];
    letOpFouten(page, fouten);
    await page.addInitScript((tok) => {
      localStorage.setItem('rtg_member_token', tok);
      localStorage.setItem('rtg_lang', 'nl'); localStorage.setItem('rtg_cookieinfo_v1', '1');
    }, a);
    await page.goto(base + '/apps/wereld.html', { waitUntil: 'domcontentloaded' });

    // 1. de vijf werelden staan er, en Business is voor de gratis pas DICHT --
    //    zichtbaar, want wegstoppen wat je niet hebt is oneerlijk naar beide kanten
    await page.waitForSelector('#werelden button', { timeout: 15000 });
    const werelden = await page.evaluate(() => [...document.querySelectorAll('#werelden button')]
      .map(b => ({ naam: b.textContent, dicht: b.disabled })));
    assert.equal(werelden.length, 5, 'er horen vijf werelden te staan: ' + JSON.stringify(werelden));
    const bus = werelden.find(w => w.naam === 'Business');
    assert.ok(bus, 'Business staat niet in de rij');
    assert.equal(bus.dicht, true, 'Business hoort dicht te zijn voor een gratis pas');
    assert.equal(werelden.find(w => w.naam === 'Lifestyle').dicht, false, 'Lifestyle hoort open te staan');

    // 2. de ene feed toont de Salon-post van B, met zijn bron erbij
    await page.waitForSelector('.kaart', { timeout: 15000 });
    const feed = await page.evaluate(() => document.getElementById('feed').textContent);
    assert.ok(/boot vertrekt/.test(feed), 'de Salon-post staat niet in de wereldfeed: ' + feed.slice(0, 160));
    assert.ok(/DE SALON|De Salon/.test(feed), 'de bron staat niet op de kaart');

    // 3. schakelen verandert de wereld zonder de app te verlaten
    await page.click('#werelden button:nth-child(2)');           // Lifestyle
    await page.waitForFunction(() =>
      document.querySelector('#werelden button:nth-child(2)').getAttribute('aria-current') === 'true',
      null, { timeout: 10000 });
    assert.equal(await page.evaluate(() => location.pathname), '/apps/wereld.html',
      'schakelen hoort je niet naar een andere app te sturen');

    // 4. DE NAAD: "Bericht" brengt je in de APARTE berichten-app, in het gesprek
    //    met de auteur -- en de URL draagt een codenaam, nooit een sleutel
    await page.click('.kaart [data-chat]');
    await page.waitForURL(/\/apps\/comm\.html\?met=/, { timeout: 15000 });
    const url = await page.evaluate(() => location.href);
    assert.ok(!url.includes(mijB.me), 'er staat een sleutel in de URL naar de berichten-app');
    await page.waitForSelector('.bubbels', { timeout: 15000 });
    assert.equal(await page.evaluate(() => location.pathname), '/apps/comm.html',
      'we zijn niet in de berichten-app beland');
    // het onderwerp staat als verwijzing klaar in het veld
    assert.match(await page.evaluate(() => document.getElementById('veld').value), /^rtg:\/\/salon\//,
      'de verwijzing naar de post staat niet klaar in het invoerveld');

    // 5. het profiel: de lagen staan er, en de zichtbaarheid die je in het
    //    scherm kiest komt ECHT op de server terecht (niet alleen in de select)
    await page.goto(base + '/apps/wereld.html', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#werelden button', { timeout: 15000 });
    await page.click('#profielTab');
    await page.waitForSelector('.laag .veld select', { timeout: 15000 });

    const bron = await page.evaluate(() => document.querySelector('.laag .bron').textContent);
    assert.match(bron, /De Salon/, 'de laag zegt niet waar je hem invult');

    await page.evaluate(() => {
      const rijen = [...document.querySelectorAll('.laag .veld')];
      const rij = rijen.find(r => r.querySelector('.nm').textContent === 'Over mij');
      const sel = rij.querySelector('select');
      sel.value = 'alleenik';
      sel.dispatchEvent(new Event('change'));
    });
    /* De server is de waarheid: opnieuw ophalen moet de nieuwe stand geven.

       HIER STOND EEN page.waitForFunction MET EEN ASYNC FUNCTIE, en die kon niet
       zakken. Playwright wacht op een truthy uitkomst, en een async functie
       geeft een PROMISE terug -- altijd truthy, dus hij was meteen "klaar" en
       controleerde niets. Gevonden doordat de mutatie (het scherm de keuze niet
       laten versturen) AFSLOEG waar hij had moeten bijten; dat is precies
       waarom LAT-regel 2 vier uitkomsten kent en niet twee.

       Nu haalt Node zelf de stand op, met een korte lus voor de schrijfronde. */
    const zichtNu = async () => {
      const d = await api(base, '/api/wereld/profiel', {}, a);
      const v = d.lagen.flatMap(l => l.velden).find(x => x.pad === 'persoonlijk.over');
      return v && v.zicht;
    };
    let zicht = null;
    for (let i = 0; i < 20 && zicht !== 'alleenik'; i++) {
      zicht = await zichtNu();
      if (zicht !== 'alleenik') await new Promise(r => setTimeout(r, 250));
    }
    assert.equal(zicht, 'alleenik',
      'de keuze uit het scherm is niet op de server geland (stond op ' + zicht + ')');

    /* 6. de Ontdek-tab. A is een GRATIS lid en heeft `zoeken.geavanceerd` niet;
       het scherm hoort hem dan naar het beginscherm te sturen in plaats van een
       leeg paneel te tonen. Die regel komt uit /api/wereld/state en staat niet
       in de HTML -- dat is precies wat hier wordt nagetrokken. */
    await page.click('#ontdekTab');
    await page.waitForURL(/\/apps\/app\.html/, { timeout: 10000 });

    /* 7. dezelfde tab met een pas die het WEL heeft: zoeken werkt, en de
       treffer toont alleen wat zichtbaar is. B is Lifestyle en heeft eerder een
       Salon-post geplaatst; we geven hem een zakelijke kop om op te zoeken. */
    await api(base, '/api/zakelijk/profiel/zet', { naam: 'B', kop: 'Zeilmaker' }, b);
    const page2 = await browser.newPage();
    letOpFouten(page2, fouten);
    await page2.addInitScript((tok) => {
      localStorage.setItem('rtg_member_token', tok);
      localStorage.setItem('rtg_lang', 'nl'); localStorage.setItem('rtg_cookieinfo_v1', '1');
    }, b);
    await page2.goto(base + '/apps/wereld.html', { waitUntil: 'domcontentloaded' });
    await page2.waitForSelector('#werelden button', { timeout: 15000 });
    await page2.click('#ontdekTab');
    await page2.waitForSelector('#zoekform', { timeout: 10000 });
    assert.equal(await page2.evaluate(() => location.pathname), '/apps/wereld.html',
      'met het vermogen hoort Ontdek IN de app te blijven');

    // A heeft geen zakelijk profiel, dus B vindt hem niet op deze term
    await page2.fill('#zoekq', 'zeilmaker');
    await page2.click('#zoekform button');
    await page2.waitForSelector('#zoekuit .kaart, #zoekuit .leeg', { timeout: 10000 });
    const uitslag = await page2.evaluate(() => document.getElementById('zoekuit').textContent);
    assert.match(uitslag, /Niemand gevonden|zeilmaker/i,
      'de zoekuitslag zegt iets zinnigs: ' + uitslag.slice(0, 120));

    // 8. en "wie bekeek mijn profiel" staat op de Profiel-tab van B
    await page2.click('#profielTab');
    await page2.waitForSelector('#bezoekers', { timeout: 10000 });
    const bez = await page2.evaluate(() => document.getElementById('bezoekers').textContent);
    assert.match(bez, /geen onzichtbare stand/i,
      'het scherm zegt niet dat er geen sluipstand is: ' + bez.slice(0, 120));

    assert.deepEqual(fouten, [], 'geen JS-fouten tijdens het scherm');
  } finally {
    if (browser) await browser.close();
    stop(child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
