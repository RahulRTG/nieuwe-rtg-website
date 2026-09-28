/* De toestelrekenlaag in een ECHTE browser tegen een ECHTE server
   (TOESTEL.md par. 3 en 9). Dit is het bewijs dat de machine staat, met de
   eigen WASM-proefuitvoerder: de hele keten zonder een model van buiten.

     manifest ophalen -> geen download zonder tik -> mobiel of onbekend: nog eens
     vragen -> downloaden naar OPFS -> tweede keer uit OPFS -> poorten kiezen
     het toestel -> grendel (sleutel, handtekening, hash, licentie, contract)
     -> afgesloten cel -> uitkomst met herkomst `toestel`.

   En de tegenproeven, want een keten die alleen slaagt bewijst niets:
     - gewijzigde bytes, een ingetrokken sleutel en de LEGE productielijst
       sleutels laden niets, en weigeren op de juiste stap;
     - in de cel zelf zijn netwerk, ouder en OPFS dicht (Playwright rekent IN
       het sandboxframe, dus dit is gemeten en niet afgeleid uit de kop).
     - het rekentijdplafond: een ondertekende module die NOOIT stopt wordt
       afgebroken, de pagina blijft ondertussen reageren en de cel is weg. De
       eerste meting hiervan bevroor de hele pagina (TOESTEL.md par. 10.2);
     - een worker IN de cel erft haar CSP: ook daar is fetch dicht.
   Wat hier NIET bewezen is: WebGPU (headless Chromium heeft hier geen
   adapter) en echte spraak of vectoren (dat meten scripts/spraakproef.js en
   scripts/vectorproef.js). */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop, laadPlaywright, browserOpties, geenBrowser } = require('./helper');
const { nieuweSleutel, teken, sha256 } = require('../scripts/lib/toestelteken');

/* (func (export "maal") (param f64 f64) (result f64) local.get 0 local.get 1 f64.mul) */
const MAAL = Buffer.from([0, 97, 115, 109, 1, 0, 0, 0, 1, 7, 1, 96, 2, 124, 124, 1, 124, 3, 2, 1, 0, 7, 8, 1, 4,
  109, 97, 97, 108, 0, 0, 10, 9, 1, 7, 0, 32, 0, 32, 1, 162, 11]);
/* (func (export "maal") (param f64 f64) (result f64) loop br 0 end f64.const 0)
   -- een lus die nooit eindigt: de uitvoerder die bewust te lang rekent. */
const LUS = Buffer.from([0, 97, 115, 109, 1, 0, 0, 0, 1, 7, 1, 96, 2, 124, 124, 1, 124, 3, 2, 1, 0, 7, 8, 1, 4,
  109, 97, 97, 108, 0, 0, 10, 10, 1, 8, 0, 3, 64, 12, 0, 11, 0, 11]);
const MODULES = ['licenties', 'manifest', 'poorten', 'meting', 'opslag', 'rekenaar'];

const pw = laadPlaywright();
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-toestel-e2e-'));
const DIR = path.join(TMP, 'toestel');
const sleutel = nieuweSleutel('proef-2026');
const vertrouwd = [{ id: sleutel.id, publiek: sleutel.publiek, vanaf: '2026-09-25', stand: 'actief' }];

test('de toestelrekenlaag rekent in een afgesloten cel, en alleen met ondertekende bytes',
  { skip: geenBrowser(pw) }, async () => {
    fs.mkdirSync(path.join(DIR, 'artefacten'), { recursive: true });
    fs.writeFileSync(path.join(DIR, 'artefacten', sha256(MAAL)), MAAL);
    const regel = teken({ id: 'maal-proef', versie: '1', soort: 'uitvoerder', sha256: sha256(MAAL), grootte: MAAL.length,
      licentie: 'MIT', bron: 'RTG, test/toestel.e2e.js', naamsvermelding: 'RTG', contracten: ['proef.vermenigvuldig'] },
      { id: sleutel.id, stand: 'actief' }, sleutel.privateKey);
    const lusRegel = teken({ id: 'lus-proef', versie: '1', soort: 'uitvoerder', sha256: sha256(LUS), grootte: LUS.length,
      licentie: 'MIT', bron: 'RTG, test/toestel.e2e.js', naamsvermelding: 'RTG', contracten: ['proef.lus'] },
      { id: sleutel.id, stand: 'actief' }, sleutel.privateKey);
    fs.writeFileSync(path.join(DIR, 'manifest.json'), JSON.stringify({ versie: 1, artefacten: [regel] }));
    const srv = await startServer({ env: { RTG_DATA_DIR: TMP, RTG_TOESTEL_DIR: DIR, SMTP_URL: '' } });
    const browser = await pw.chromium.launch(browserOpties(pw));
    try {
      const page = await browser.newPage();
      await page.goto(srv.base + '/site/404.html');
      for (const m of MODULES) await page.addScriptTag({ url: '/shared/toestel/' + m + '.js' });

      /* Een bevroren pagina geeft nooit antwoord: dan zakt de toets op deze klok
         in plaats van eeuwig te wachten. */
      let klok;
      const bevroren = new Promise((r) => { klok = setTimeout(() => r({ bevroren: true }), 60000); });
      const u = await Promise.race([bevroren, page.evaluate(async ({ vertrouwd, lusRegel, lusBytes }) => {
        const M = await (await fetch('/toestel/manifest.json')).json();
        const regel = M.artefacten[0], O = window.RTGToestelOpslag, uit = {};
        uit.zonderTik = await O.haal(regel, {});
        uit.eenTik = await O.haal(regel, { doorLid: true });
        const eerste = await O.haal(regel, { doorLid: true, mobielBevestigd: true });
        uit.eerste = { ok: eerste.ok, gedownload: eerste.gedownload };
        const tweede = await O.haal(regel, {});
        uit.tweede = { ok: tweede.ok, gedownload: tweede.gedownload };
        const feiten = await window.RTGToestelMeting.feiten();
        uit.feiten = { wasm: feiten.wasm, energie: feiten.energie, energieReden: feiten.energieReden };
        const contract = { taak: 'proef.vermenigvuldig', plaatsen: ['toestel', 'rtg-omgeving'], technieken: ['algoritme'],
          kwaliteit: { maat: 'exact', min: 1, graad: 'gemeten' }, last: { startMaxMs: 1000, rekenMaxMs: 10000 } };
        const kandidaten = [
          { id: 'toestel-wasm', plaats: 'toestel', techniek: 'algoritme', uitvoerder: 'wasm-proef', beschikbaar: feiten.wasm,
            kwaliteit: { exact: { waarde: 1, graad: 'gemeten' } }, last: { startMs: 5 }, kosten: 0 },
          { id: 'extern-gratis', plaats: 'extern', techniek: 'algoritme', beschikbaar: true,
            kwaliteit: { exact: { waarde: 1, graad: 'gemeten' } }, kosten: -1 }];
        const keus = window.RTGToestelPoorten.kies(contract, kandidaten, { beleid: { 'proef.vermenigvuldig': true } });
        uit.keus = { gekozen: keus.gekozen && keus.gekozen.id, uitgesloten: keus.uitgesloten };
        const R = window.RTGToestelRekenaar;
        /* Welke cel opent de rekenaar ZELF? Zonder deze regel zag de toets niet
           of de rekenaar het sandbox-attribuut vergat. */
        uit.sandbox = [];
        const echt = document.body.appendChild.bind(document.body);
        document.body.appendChild = (n) => { if (n.tagName === 'IFRAME') uit.sandbox.push(n.getAttribute('sandbox')); return echt(n); };
        const art = (bytes, r) => ({ module: { regel: r || regel, bytes } });
        uit.goed = await R.voer({ contract, kandidaat: keus.gekozen, artefacten: art(tweede.bytes), invoer: { a: 6, b: 7 }, sleutels: vertrouwd });
        const kapot = tweede.bytes.slice(0); new Uint8Array(kapot)[20] ^= 1;
        uit.kapot = await R.voer({ contract, kandidaat: keus.gekozen, artefacten: art(kapot), invoer: { a: 6, b: 7 }, sleutels: vertrouwd });
        uit.ingetrokken = await R.voer({ contract, kandidaat: keus.gekozen, artefacten: art(tweede.bytes), invoer: {},
          sleutels: [Object.assign({}, vertrouwd[0], { stand: 'ingetrokken' })] });
        uit.productielijst = await R.voer({ contract, kandidaat: keus.gekozen, artefacten: art(tweede.bytes), invoer: {} });
        uit.onbekend = await R.voer({ contract, kandidaat: Object.assign({}, keus.gekozen, { uitvoerder: 'verzonnen' }),
          artefacten: art(tweede.bytes), invoer: {}, sleutels: vertrouwd });
        uit.celResten = document.querySelectorAll('iframe').length;
        /* Het plafond: de lus rekent door, de pagina moet ondertussen blijven
           tikken, en na 1,5 s is het afgelopen. */
        const tikken = []; const hart = setInterval(() => tikken.push(performance.now()), 100);
        const t0 = performance.now();
        uit.lus = await R.voer({ contract: { taak: 'proef.lus', last: { rekenMaxMs: 1500 } },
          kandidaat: { plaats: 'toestel', uitvoerder: 'wasm-proef' },
          artefacten: { module: { regel: lusRegel, bytes: Uint8Array.from(lusBytes).buffer } }, invoer: { a: 1, b: 2 }, sleutels: vertrouwd });
        uit.lusMs = performance.now() - t0;
        clearInterval(hart);
        uit.tikken = tikken.length;
        uit.lusResten = document.querySelectorAll('iframe').length;
        return uit;
      }, { vertrouwd, lusRegel, lusBytes: [...LUS] })]);
      clearTimeout(klok);
      assert.ok(!u.bevroren, 'de pagina van het lid bevroor: het rekenen blokkeerde de thread en het plafond ging nooit af');

      assert.equal(u.zonderTik.ok, false); assert.equal(u.zonderTik.vraag, 'toestemming');
      assert.equal(u.eenTik.ok, false, 'headless Chromium laat de verbinding niet zien: dan nog eens vragen');
      assert.equal(u.eenTik.vraag, 'mobiel');
      assert.deepEqual(u.eerste, { ok: true, gedownload: true });
      assert.deepEqual(u.tweede, { ok: true, gedownload: false }, 'de tweede keer uit OPFS, zonder tik');
      assert.equal(u.feiten.wasm, true); assert.equal(u.feiten.energie, null); assert.match(u.feiten.energieReden, /geen betrouwbare meter/);
      assert.equal(u.keus.gekozen, 'toestel-wasm', 'een externe kandidaat die geld TOE zou geven, wint niet');
      assert.equal(u.keus.uitgesloten[0].poort, 'privacy');
      assert.equal(u.goed.ok, true, JSON.stringify(u.goed));
      assert.equal(u.goed.uitkomst.waarde, 42);
      assert.equal(u.goed.herkomst.plaats, 'toestel');
      assert.equal(u.goed.herkomst.artefacten[0].sha256, sha256(MAAL));
      assert.equal(u.kapot.stap, 'hash');
      assert.equal(u.ingetrokken.stap, 'sleutel');
      assert.equal(u.productielijst.stap, 'sleutel', 'de lege productielijst laadt niets');
      assert.equal(u.onbekend.stap, 'uitvoerder');
      assert.equal(u.celResten, 0, 'elke cel is na afloop weg');
      assert.equal(u.lus.ok, false);
      assert.equal(u.lus.stap, 'last', JSON.stringify(u.lus));
      assert.ok(u.lusMs >= 1400 && u.lusMs < 5000, 'afgebroken op het plafond, niet ervoor en niet veel erna: ' + u.lusMs);
      assert.ok(u.tikken >= 8, 'de pagina van het lid bleef reageren terwijl de cel rekende: ' + u.tikken + ' tikken');
      assert.equal(u.lusResten, 0, 'de afgebroken cel is weg');
      assert.ok(u.sandbox.length >= 2, 'de rekenaar opende zelf cellen');
      assert.ok(u.sandbox.every(x => x === 'allow-scripts'), 'elke cel is sandbox allow-scripts, zonder same-origin: ' + u.sandbox);

      /* De cel zelf: open er een en reken IN het sandboxframe. */
      const geladen = page.waitForEvent('framenavigated', { predicate: f => /\/toestel\/cel$/.test(f.url()) });
      await page.evaluate(() => { const f = document.createElement('iframe'); f.sandbox = 'allow-scripts';
        f.src = '/toestel/cel'; document.body.appendChild(f); });
      const cel = await geladen;
      await cel.waitForLoadState();
      const binnen = await cel.evaluate(async () => {
        const o = {};
        try { await fetch('/toestel/manifest.json'); o.fetch = 'open'; } catch (e) { o.fetch = 'dicht'; }
        try { o.ouder = String(parent.document.title); } catch (e) { o.ouder = 'dicht'; }
        try { await navigator.storage.getDirectory(); o.opfs = 'open'; } catch (e) { o.opfs = 'dicht'; }
        o.origin = String(self.origin);
        /* Een worker uit een blob erft de CSP van de cel: ook daar geen netwerk. */
        o.worker = await new Promise((klaar) => {
          const w = new Worker(URL.createObjectURL(new Blob([
            "fetch('/toestel/manifest.json').then(() => postMessage('open'), () => postMessage('dicht'))"])));
          w.onmessage = (e) => klaar(e.data); w.onerror = () => klaar('fout');
        });
        return o;
      });
      assert.deepEqual(binnen, { fetch: 'dicht', ouder: 'dicht', opfs: 'dicht', origin: 'null', worker: 'dicht' });
    } finally {
      await browser.close();
      await stop(srv);
      fs.rmSync(TMP, { recursive: true, force: true });
    }
  });
