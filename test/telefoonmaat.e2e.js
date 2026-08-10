/* ============================================================================
   DE TELEFOONMAAT, INGELOGD -- de helft die scripts/telefoonmaat.js niet ziet.

   Die scan meet alle 213 schermen, maar uitgelogd en op de eerste render. Wat
   er ACHTER de inlog staat -- de gevulde lijsten, de kaarten met echte namen
   erin, de knoppen die er pas zijn als je mag -- is waar de meeste opmaak
   leeft, en dat meet deze toets: dezelfde 213 schermen, met een aangemeld lid.

   Dat het er 213 zijn en niet negen is zelf een bevinding. Zie de lijst
   hieronder.

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

   EN DE MUTATIE DIE DEZE TOETS ZELF WAS. Hij begon met negen vlaggenschepen,
   en op de vraag "past nu ELK scherm?" kon dat geen antwoord geven. Over alle
   213 gedraaid vielen er vijf om die niemand zag -- rtmail, browser, navigatie,
   labfonds en pulse -- en vier daarvan bestaan alleen ingelogd. De ergste was
   rtmail: een inline <span> met nowrap, overflow:hidden en een ellipsis die
   niets deed, want die twee gelden niet op een inline element. 900 punten
   breed, met de lijstrij eraan vast.

   Bij die ronde bleek ook de METER zelf te grof: hij meldde "+999" op
   passkeys.html, waar een label met `left:-999px` bewust alleen voor de
   schermlezer bestaat. Links helemaal buiten beeld is een bedoeling, geen
   uitloop; nu telt links alleen mee zolang de rechterrand nog in beeld steekt.
   Nagetrokken dat die verfijning de echte linkeruitloop niet meeneemt: de
   metier-mutatie (+6, half in beeld) zakt nog steeds.
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer } = require('./helper');
const { METING, MATEN } = require('../scripts/telefoonmaat');

function laadBrowser() {
  for (const p of [undefined, '/opt/node22/lib/node_modules', '/usr/lib/node_modules', '/usr/local/lib/node_modules']) {
    try { return require(p ? require.resolve('playwright', { paths: [p] }) : 'playwright'); } catch (e) { /* volgende */ }
  }
  try { const eigen = require('../server/lib/browser'); if (eigen.beschikbaar()) return eigen; } catch (e) { /* geen browser */ }
  return null;
}
const pw = laadBrowser();

/* ALLE schermen, en niet een handvol vlaggenschepen.

   Hier stond eerst een lijst van negen. Dat leek redelijk -- de schermen waar
   een lid zijn tijd doorbrengt -- en het was precies de verkeerde keuze. Op de
   vraag "is nu ELK scherm voor de telefoon?" kon die lijst geen antwoord geven,
   en toen we hem alsnog over alle 213 lieten lopen stonden er vijf uitlopers
   tussen die geen enkele toets zag: rtmail (een inline span met nowrap, 900
   punten breed, want overflow en text-overflow doen niets op een inline
   element), browser, navigatie, labfonds en pulse. Vier daarvan zijn ALLEEN
   ingelogd te zien; uitgelogd staat dat deel van het scherm er niet.

   Een steekproef die niet zegt dat hij een steekproef is, leest als dekking.
   Nu loopt hij over alles wat er is (scripts/lib/statisch.js telt de pagina's,
   dus een nieuw scherm valt er vanzelf in) op de smalste maat, plus de
   vlaggenschepen op de tweede maat. */
const { paginas } = require('../scripts/lib/statisch');
const ALLE = paginas();
const VLAGGENSCHEPEN = [
  '/apps/app.html',
  '/apps/boardroom.html',
  '/apps/salon.html',
  '/apps/agenda.html',
  '/apps/comm.html',
  '/apps/notities.html',
  '/apps/wallet.html',
  '/apps/rtmail.html',
  '/apps/sitemaker.html',
  '/apps/websitestudio.html',
];
/* Wat er per maat gemeten wordt. De smalste maat krijgt alles omdat daar de
   uitloop begint; de tweede maat krijgt de vlaggenschepen, want een scherm dat
   op 320 past en op 390 niet, bestaat vrijwel niet (nagekeken: van de vijf
   uitlopers hierboven stond er precies een alleen op 390, en dat was een
   etiket dat op 320 toevallig net anders brak). */
const RONDEN = [
  { maat: MATEN[0], paden: ALLE },
  { maat: MATEN[1], paden: VLAGGENSCHEPEN },
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
    let gemeten = 0;
    for (const { maat, paden } of RONDEN) {
      await page.setViewportSize({ width: maat.breedte, height: maat.hoogte });
      for (const pad of paden) {
        await page.goto(base + pad, { waitUntil: 'load' });
        await page.waitForTimeout(350);
        const r = await page.evaluate(new Function('return ' + METING));
        assert.equal(r.vw, maat.breedte, `${pad} is gemeten op ${maat.naam}, kreeg ${r.vw}`);
        gemeten++;
        for (const b of r.breed) buiten.push(`${pad} (${maat.naam}) te breed +${b.uit}px: ${b.waar}`);
        for (const l of r.lang) buiten.push(`${pad} (${maat.naam}) te lang +${l.uit}px: ${l.waar}`);
      }
    }
    /* Het AANTAL wordt ook beweerd. Zonder deze regel zou een lege padenlijst
       -- een verkeerd pad, een gewijzigde loop() -- een groene toets geven die
       nul schermen heeft bekeken, en dat is precies de vorm waar LAT regel 9
       voor waarschuwt. */
    assert.ok(gemeten >= 200, 'er zijn echt alle schermen langsgekomen, geteld: ' + gemeten);
    assert.deepEqual(buiten, [], 'geen enkel scherm valt buiten de maat:\n  ' + buiten.join('\n  '));
    /* WAT HIER NIET WORDT BEWEERD: dat er geen paginafouten vielen. Dat stond
       er wel, en het was fout op twee manieren. Test/paginas.e2e.js opent al
       elke pagina in public/ en rekent daar precies op af -- een tweede plek
       die dezelfde waarheid vasthoudt (LAT regel 4). En hij weet iets wat deze
       toets niet wist: een scherm dat om een ANDERE inlog vraagt gooit bewust
       'geen sessie', en dat staat daar als BEWUSTE_STOP. Een lid met een
       RTG-pas komt onderweg langs veertig van die schermen, dus deze toets
       zakte op iets wat helemaal geen defect is. Maat is maat; fouten zijn van
       de paginascan. */
  } finally {
    if (browser) await browser.close();
    await new Promise((r) => { child.on('exit', r); child.kill(); });
  }
});
