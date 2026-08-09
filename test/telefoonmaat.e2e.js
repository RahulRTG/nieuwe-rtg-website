/* ============================================================================
   DE TELEFOONMAAT, INGELOGD -- de helft die scripts/telefoonmaat.js niet ziet.

   Die scan meet alle 213 schermen, maar uitgelogd en op de eerste render. Dat
   is de brede helft. Wat er ACHTER de inlog staat -- de gevulde lijsten, de
   kaarten met echte namen erin, de bladen die van onder komen -- is precies
   waar de meeste opmaak leeft, en dat meet deze toets: op telefoonmaat, met
   een echt lid, met de bladen open.

   Wat er beweerd wordt: niets is breder dan het scherm, en geen laag die OVER
   het scherm hangt is langer dan het scherm. Een pagina mag langer zijn dan
   het scherm -- daar is scrollen voor.

   DE IJKING ZIT IN DE TOETS ZELF, en dat is geen sier. Deze toets kan op twee
   manieren onzin worden: de viewport blijft stiekem op bureaubladmaat staan
   (dan past alles, altijd), of de meting vindt niets meer omdat de pagina
   anders in elkaar zit dan hij denkt (dan past alles, altijd). Allebei geven
   groen zonder iets gezien te hebben -- LAT regel 9 en 10 in hun zuiverste
   vorm. Daarom hangt er een element van 3000 punten in de pagina voordat er
   iets wordt beweerd: ZIET de meting dat niet, dan zakt de toets op de meter
   en niet op de app.

   DE MUTATIES, met hun uitkomst -- ook de twee die NIET beten, want dat zijn
   hier de nuttigste twee:
     1. een element van 600 punten in oog.html      -> RAAK (+298), en dus
        kijkt de meting door de grendel van maat.css heen.
     2. de reparatie in metier.html teruggedraaid   -> RAAK (+6).
     3. de reparatie in ios.css teruggedraaid       -> RAAK, hier: sitemaker
        loopt ingelogd 672 punten uit. Dat is de mutatie die DEZE toets laat
        zakken; zonder hem bewees hij niets over de app.
     4. de grendel `overflow-x:clip` uit maat.css   -> AFGESLAGEN. Alle 213
        schermen bleven schoon zonder grendel. Dat is geen tegenvaller maar de
        bevinding: de oorzaken zijn echt weg, de grendel dekt niets toe.
     5. de kolomreparatie in sitemaker teruggedraaid -> AFGESLAGEN op DEZE
        toets, en raak op de statische scan. Ingelogd toont dat scherm de
        editor en niet het inlogkaartje, dus die uitloop bestaat alleen
        uitgelogd. Precies daarom zijn het twee metingen en niet een: wie
        alleen deze toets draait, mist de helft van de schermen.
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, letOpFouten } = require('./helper');
const { METING, MATEN } = require('../scripts/telefoonmaat');

function laadBrowser() {
  for (const p of [undefined, '/opt/node22/lib/node_modules', '/usr/lib/node_modules', '/usr/local/lib/node_modules']) {
    try { return require(p ? require.resolve('playwright', { paths: [p] }) : 'playwright'); } catch (e) { /* volgende */ }
  }
  try { const eigen = require('../server/lib/browser'); if (eigen.beschikbaar()) return eigen; } catch (e) { /* geen browser */ }
  return null;
}
const pw = laadBrowser();

/* De vlaggenschepen: de schermen waar een lid zijn tijd doorbrengt, plus de
   twee die op de statische scan het verst uitliepen (de studio's), zodat een
   terugval daar hier alsnog zakt. */
const SCHERMEN = [
  '/apps/app.html',
  '/apps/boardroom.html',
  '/apps/salon.html',
  '/apps/agenda.html',
  '/apps/comm.html',
  '/apps/notities.html',
  '/apps/wallet.html',
  '/apps/sitemaker.html',
  '/apps/websitestudio.html',
];

async function nieuwLid(base) {
  const u = Date.now().toString().slice(-8);
  const reg = await fetch(base + '/api/auth/register', { method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Maatlid', email: 'mt' + u + '@x.nl', phone: '06' + u,
      password: 'geheim123', geboortedatum: '1990-01-01', geslacht: 'v', tier: 'rtg', pasApp: 'rtg' }) })
    .then(r => r.json());
  assert.ok(reg.token, 'het lid is aangemeld en heeft een token');
  return reg.token;
}

test('telefoonmaat: geen ingelogd scherm is breder of langer dan het toestel',
  { skip: pw ? false : 'geen browser beschikbaar in deze omgeving' }, async () => {
  const { child, base } = await startServer({ env: { SMTP_URL: '' } });
  let browser;
  try {
    const token = await nieuwLid(base);
    browser = await pw.chromium.launch({ args: ['--no-sandbox'] });
    const page = await browser.newPage();
    const fouten = [];
    letOpFouten(page, fouten);

    await page.goto(base + '/apps/app.html', { waitUntil: 'domcontentloaded' });
    await page.evaluate((t) => {
      localStorage.setItem('rtg_member_token', t);
      localStorage.setItem('rtg_cookieinfo_v1', '1');
    }, token);

    /* DE IJKING, voor de eerste bewering. Een element van 3000 punten hoort
       gezien te worden; wordt het dat niet, dan meet deze toets niets en
       hoort hij daarop te zakken en niet op de app. */
    for (const maat of MATEN) {
      await page.setViewportSize({ width: maat.breedte, height: maat.hoogte });
      await page.goto(base + '/apps/app.html', { waitUntil: 'load' });
      await page.waitForTimeout(400);
      const ijk = await page.evaluate(new Function(`
        const proef = document.createElement('div');
        proef.style.cssText = 'width:3000px;height:3000px;position:fixed;left:0;top:0;pointer-events:none;opacity:0.01';
        document.body.appendChild(proef);
        const r = ${METING};
        proef.remove();
        return r;`));
      assert.equal(ijk.vw, maat.breedte, `de viewport staat echt op ${maat.naam}, kreeg ${ijk.vw}`);
      assert.ok(ijk.breed.length >= 1, `de meting ziet een element van 3000 punten breed op ${maat.naam}`);
      assert.ok(ijk.lang.length >= 1, `de meting ziet een vaste laag van 3000 punten hoog op ${maat.naam}`);
    }

    /* En dan pas het oordeel over de echte schermen. */
    const buiten = [];
    for (const maat of MATEN) {
      await page.setViewportSize({ width: maat.breedte, height: maat.hoogte });
      for (const pad of SCHERMEN) {
        await page.goto(base + pad, { waitUntil: 'load' });
        await page.waitForTimeout(600);
        const r = await page.evaluate(new Function('return ' + METING));
        assert.equal(r.vw, maat.breedte, `${pad} is gemeten op ${maat.naam}, kreeg ${r.vw}`);
        for (const b of r.breed) buiten.push(`${pad} (${maat.naam}) te breed +${b.uit}px: ${b.waar}`);
        for (const l of r.lang) buiten.push(`${pad} (${maat.naam}) te lang +${l.uit}px: ${l.waar}`);
      }
    }
    assert.deepEqual(buiten, [], 'geen enkel scherm valt buiten de maat:\n  ' + buiten.join('\n  '));
    assert.deepEqual(fouten, [], 'geen paginafouten onderweg');
  } finally {
    if (browser) await browser.close();
    await new Promise((r) => { child.on('exit', r); child.kill(); });
  }
});
