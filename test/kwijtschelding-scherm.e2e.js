/* Schermtoets: de kwijtschelding in het Belastingkantoor gaat door TWEE
   inspecteurs, en dat moet je op het scherm ook ZIEN.

   De regel zelf staat vast in test/belastingkantoor.test.js (de server weigert
   dezelfde ogen). Maar een vier-ogen-regel die alleen op de server bestaat, is
   op het scherm een knop die het soms niet doet: de tweede inspecteur ziet niet
   dat er al een voordracht ligt, ziet niet van wie, en loopt pas NA zijn klik
   tegen de weigering aan. Daarom is dit blok apart getoetst -- "af" is geen
   bewering (scripts/schermen.js).

   Wat hier wordt vastgelegd:
     1  zonder voordracht staat er "Voordragen", en geen kwijtscheldknop
     2  na het voordragen staat de naam van de voordrager en zijn grond op het
        scherm, en verschijnen de twee besluitknoppen
     3  wie voordroeg krijgt zijn eigen weigering te zien in plaats van een
        stille mislukking
     4  de ANDERE inspecteur schrijft hem wel kwijt, en dan is de zaak dicht
   Draai: npm run e2e */
const test = require('node:test');
const assert = require('node:assert/strict');
const { laadScherm, startServer, stop, letOpFouten } = require('./helper');
const fs = require('fs');
const os = require('os');
const path = require('path');

/* Een browser KIEZEN door hem te starten, niet door hem te laden: zie de
   kop van ./browser.js. Dit bestand droeg nog een eigen kopie van de oude
   lader, en die zakte op 'Executable doesn't exist' zodra het pakket er wel
   was en de bijbehorende Chromium niet -- een rode toets die niets over zijn
   onderwerp zei. */
const { laadBrowser } = require('./browser');
const pw = laadBrowser();
const api = async (base, pad, body, token) => (await fetch(base + pad, { method: 'POST',
  headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { Authorization: 'Bearer ' + token } : {}),
  body: JSON.stringify(body || {}) })).json();

// het scherm vraagt de grond met een prompt(); die wordt hier beantwoord
const zegJa = (page, antwoord) => {
  page.on('dialog', d => d.accept(antwoord === undefined ? '' : antwoord));
};

async function open(pw, base, token, fouten) {
  const page = await (await pw.chromium.launch({ args: ['--no-sandbox'] })).newPage();
  letOpFouten(page, fouten);
  await page.addInitScript(t => { localStorage.setItem('rtg_werk_rijk', t); }, token);
  await page.goto(base + '/apps/belastingkantoor.html', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#app:not([hidden])', { timeout: 20000 });
  await page.click('.tab[data-t="aan"]');
  await page.waitForSelector('#aanLijst .item', { timeout: 15000 });
  return page;
}

test('Belastingkantoor: kwijtschelden is voordragen en beslissen, door twee mensen',
  { skip: pw ? false : 'playwright niet beschikbaar in deze omgeving' }, async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-kwijt-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let p1, p2;
  try {
    // een inwoner met een openstaande aanslag
    const u = Date.now().toString().slice(-8);
    const lid = (await api(base, '/api/auth/register', { name: 'Inwoner Kwijt', email: 'k' + u + '@x.nl',
      phone: '063' + u.slice(1), password: 'geheim123', geboortedatum: '1985-04-04', tier: 'rtg', pasApp: 'rtg' })).token;
    await api(base, '/api/overheid/aangifte', { inkomen: 90000, aftrek: 1000, ingehouden: 0 }, lid);

    // twee inspecteurs
    const roster = await api(base, '/api/supplier/roster', { code: 'RIJK' });
    const man = roster.staff.find(m => m.role === 'manager');
    const rijk = (await api(base, '/api/supplier/login', { code: 'RIJK', staffId: man.id, pin: '1234' })).token;
    const tweede = await api(base, '/api/supplier/staff/add', { name: 'Inspecteur Vos', role: 'manager' }, rijk);
    assert.ok(tweede.staff, 'er is een tweede inspecteur');
    const rijk2 = (await api(base, '/api/supplier/login',
      { code: 'RIJK', staffId: tweede.staff.id, pin: tweede.pin })).token;

    const fouten = [];
    p1 = await open(pw, base, rijk, fouten);

    // ---- 1. nog niets voorgedragen ----
    assert.ok(await p1.$('[data-kwijt]'), 'er staat een knop om voor te dragen');
    assert.equal(await p1.$('[data-kwijtja]'), null, 'en NIET meteen een kwijtscheldknop');

    // ---- 2. voordragen, met een grond ----
    zegJa(p1, 'schrijnend geval, geen verhaalsmogelijkheid');
    await p1.click('[data-kwijt]');
    await p1.waitForFunction(() => /Voorgedragen voor kwijtschelding door/
      .test(document.querySelector('#aanLijst').textContent), null, { timeout: 15000 });
    const kaart = (await p1.$eval('#aanLijst', e => e.textContent)).replace(/\s+/g, ' ');
    assert.match(kaart, /Voorgedragen voor kwijtschelding door .+:/, 'met de naam van de voordrager');
    assert.match(kaart, /schrijnend geval/, 'en met zijn grond, leesbaar op het scherm');
    assert.match(kaart, /Een ANDERE inspecteur beslist/, 'en met wat er nu moet gebeuren');
    assert.ok(await p1.$('[data-kwijtja]'), 'nu staan de besluitknoppen er');
    assert.ok(await p1.$('[data-kwijtnee]'), 'ook de afwijzing, want een voordracht mag stranden');
    assert.equal(await p1.$('[data-kwijt]'), null, 'en de voordraagknop is weg: er ligt er al een');

    // ---- 3. dezelfde ogen: het scherm zegt WAAROM het niet gaat ----
    await p1.click('[data-kwijtja]');   // confirm() -> zegJa staat al aan
    await p1.waitForFunction(() => /[Dd]ezelfde ogen/.test(document.body.textContent), null, { timeout: 15000 });

    // ---- 4. de ander beslist wel ----
    p2 = await open(pw, base, rijk2, fouten);
    await p2.waitForSelector('[data-kwijtja]', { timeout: 15000 });
    zegJa(p2);
    await p2.click('[data-kwijtja]');
    await p2.waitForFunction(() => /kwijtgescholden/i.test(document.querySelector('#aanLijst').textContent),
      null, { timeout: 15000 });
    assert.equal(await p2.$('[data-kwijtja]'), null, 'een dichte zaak heeft geen knoppen meer');
    assert.equal(await p2.$('[data-kwijt]'), null);

    // de server weet ervan; het scherm heeft het niet alleen maar getekend
    const na = await api(base, '/api/overheid/bd/aanslagen', {}, rijk);
    const dicht = na.aanslagen.find(a => a.kwijtgescholden);
    assert.ok(dicht, 'de aanslag staat aan de serverkant kwijtgescholden');
    assert.equal(dicht.kwijtVoorstel, null, 'en de voordracht is verbruikt');
    // en de inwoner heeft nu pas bericht, met de grond erbij
    const box = await api(base, '/api/overheid/berichten', {}, lid);
    const b = box.berichten.find(x => /kwijtschelding/i.test(x.titel));
    assert.ok(b, 'de inwoner heeft bericht');
    assert.match(b.tekst, /schrijnend geval/);

    assert.deepEqual(fouten, [], 'geen JS-fouten op het scherm');
  } finally {
    for (const p of [p1, p2]) if (p) { try { await p.context().browser().close(); } catch (e) { /* al dicht */ } }
    stop(child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) { /* opruimen mag falen */ }
  }
});
