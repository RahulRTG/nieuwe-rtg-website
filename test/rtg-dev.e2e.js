/* RTG DEV IN EEN ECHTE BROWSER -- want dit is de bewering die alleen daar valt
   na te rekenen.

   Alles wat `rtg dev` belooft, hangt aan drie dingen die je met curl niet ziet:

     1. de app draait in een IFRAME met sandbox="allow-scripts" en dus op een
        NAAMLOZE herkomst -- geen cookies, geen opslag van de gastheer;
     2. de brugklant is geinjecteerd voordat de eigen code van de app draait, dus
        `RTG.roep()` bestaat zonder dat de app iets laadt;
     3. een weigering komt als OBJECT aan, niet als zin: `e.code`, `e.hoe`.

   Die derde is de reden dat dit bestand er is. Hij is met een nagebouwd venster
   al getoetst (test/brugklant.test.js, toets 8), maar postMessage door een
   sandbox-iframe is precies het stuk dat een nabouw niet bewijst.

   Geen browser? Dan slaat deze toets over -- dezelfde afspraak als de andere
   e2e-bestanden in dit huis (test/browser.js).

   Draai los: node --test test/rtg-dev.e2e.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { laadPlaywright, browserOpties, geenBrowser } = require('./helper');
const rtg = require('../scripts/rtg');
const dev = require('../scripts/rtg-dev');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-dev-e2e-'));
const POORT = 4457;
const stil = (fn) => { const o = console.log; console.log = () => {}; try { return fn(); } finally { console.log = o; } };

let server = null;
function start() {
  const map = path.join(TMP, 'app');
  stil(() => rtg.opdrachtNew([map]));
  /* De app vraagt in het sjabloon alleen profiel.basis. Voor deze toets moet er
     ook iets zijn dat WEL wordt gevraagd maar straks kan worden ingetrokken --
     dat is de weg die we willen zien. */
  const mPad = path.join(map, 'manifest.json');
  const m = JSON.parse(fs.readFileSync(mPad, 'utf8'));
  m.machtigingen = [{ id: 'profiel.basis', doel: 'aanspreken' }];
  fs.writeFileSync(mPad, JSON.stringify(m, null, 2));
  server = stil(() => dev([map, '--poort', String(POORT)], { leesBundel: rtg.leesBundel, kleur: false }));
  return new Promise((klaar) => setTimeout(klaar, 400));
}

test('rtg dev in een echte browser', async (t) => {
  const pw = laadPlaywright();
  if (geenBrowser(pw)) { t.skip(geenBrowser(pw)); return; }
  await start();
  const browser = await pw.chromium.launch(browserOpties(pw));
  try {
    const pagina = await browser.newPage();
    const consolefouten = [];
    pagina.on('console', (m) => { if (m.type() === 'error') consolefouten.push(m.text()); });
    await pagina.goto('http://localhost:' + POORT + '/', { waitUntil: 'load' });

    // 1 -- het kader draagt precies een sandbox-vlag en geen apparaatrechten
    const kader = pagina.locator('#cel');
    assert.equal(await kader.getAttribute('sandbox'), 'allow-scripts',
      'elke vlag erbij geeft de cel iets terug wat hij niet hoort te hebben');
    assert.equal(await kader.getAttribute('allow'), '', 'geen camera, geen microfoon');

    // 2 -- RTG.roep() bestaat in de cel zonder dat de app iets laadt
    const cel = pagina.frameLocator('#cel');
    await cel.locator('#knop').click();
    await pagina.waitForFunction(() => {
      const f = document.querySelector('#cel');
      return f && f.contentWindow;
    });
    await cel.locator('#uit').filter({ hasText: 'Havik' }).waitFor();
    const gelukt = await cel.locator('#uit').textContent();
    assert.match(gelukt, /Havik/, 'de codenaam van het synthetische lid hoort terug te komen');
    assert.match(gelukt, /lifestyle/);
    assert.doesNotMatch(gelukt, /undefined/);

    // 3 -- de machtiging intrekken, en dan komt de weigering MET velden aan
    await pagina.locator('input[data-id="profiel.basis"]').uncheck();
    await cel.locator('#knop').click();
    await cel.locator('#uit').filter({ hasText: 'RTG_MACHTIGING_NIET_VERLEEND' }).waitFor();
    const geweigerd = await cel.locator('#uit').textContent();
    assert.match(geweigerd, /RTG_MACHTIGING_NIET_VERLEEND/,
      'de code hoort in de cel aan te komen en niet alleen de zin');
    assert.match(geweigerd, /Alleen het lid kan dit aanzetten/,
      'en `hoe` ook -- dat is het veld waar een uitgever werkelijk iets aan heeft');

    // 4 -- de gastheer laat zien wat er over de brug ging
    const log = await pagina.locator('#log').textContent();
    assert.match(log, /profiel\.wieBenIk/);
    assert.match(log, /RTG_MACHTIGING_NIET_VERLEEND/);

    /* 5 -- en er is onderweg niets stukgegaan in de console.

       "Failed to load resource ... 403" hoort er WEL bij en is geen defect: een
       browser meldt elke niet-2xx als consolefout, en die 403 is precies de
       weigering die deze toets zelf uitlokt. Wat overblijft zijn echte
       scriptfouten -- en die horen er niet te zijn. */
    const echt = consolefouten.filter(t2 => !/favicon/i.test(t2) && !/Failed to load resource/i.test(t2));
    assert.deepEqual(echt, [], 'de cel hoort zonder scriptfouten te draaien');
    assert.ok(consolefouten.some(t2 => /403/.test(t2)),
      'en de opzettelijke weigering hoort wel degelijk een 403 te zijn geweest');
  } finally {
    await browser.close();
  }
});

test.after(() => {
  if (server) server.close();
  fs.rmSync(TMP, { recursive: true, force: true });
});
