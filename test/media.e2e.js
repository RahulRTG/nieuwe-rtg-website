/* ============================================================================
   CAMERA EN MICROFOON ZOALS EEN BROWSER ZE ERVAART.

   WAAROM DEZE TOETS BESTAAT. De klacht was: "alle camera's en microfoons doen
   het nergens, op mijn telefoon doet niks het." De oorzaak is niet uit de code
   te lezen en niet op localhost te zien, en dat is precies waarom hij zo lang
   bleef staan: BUITEN EEN BEVEILIGDE CONTEXT BESTAAT navigator.mediaDevices
   NIET. Een telefoon die de server op http://192.168.x.x aanroept heeft dus geen
   camera-API, terwijl dezelfde code op http://localhost werkt -- localhost is
   volgens de browser wel beveiligd. Alle zeventien aanroepen liepen daar op een
   rauwe TypeError, en zeven daarvan gaven `null` terug of lieten hem lopen.
   Resultaat: er gebeurde niets, en niemand zei waarom.

   WAT HIER WORDT BEWEZEN.

     a) Op een LAN-adres (http, geen localhost) bestaat mediaDevices niet, en
        noemt de mediapoort dat hardop met de reden "onveilig" en het https-adres
        erbij. Dit is de klacht zelf, in een echte browser.
     b) Op een beveiligd adres gaat de camera gewoon open -- ook in een kader.
        Zonder (b) zou (a) ook slagen als de camera nergens werkte.
     c) Een weigering wordt gemeld met de OORZAAK, niet met "geen toegang", en
        een fout die dit huis niet kent wordt niet stil.
     d) Elke pagina met camera of microfoon heeft de mediapoort echt geladen.
        Regel 38 in scripts/check.js kijkt naar de bron; deze toets kijkt of het
        in de browser ook zo is.

   WAT HIER NIET WORDT BEWEERD, en dat hoort erbij. Bij het bouwen was de
   aanname dat een same-origin iframe allow="camera; microphone" nodig heeft.
   Die aanname is hier NAGEMETEN en bleek onjuist: featurePolicy.allowsFeature
   ('camera') is in zo'n kader `true` zonder allow, en de camera gaat open. Het
   allow-attribuut dat shared/media.js nu op elk kader zet is dus geen reparatie
   van deze klacht -- het is nodig voor een kader naar een ANDERE origin (wat de
   CSP van dit huis met frame-ancestors 'self' niet toelaat) en het maakt de
   bedoeling expliciet. Onderdeel (b) toetst dat het niets breekt, niet dat het
   iets repareert. Wat WebKit doet is hier niet te meten: deze omgeving heeft
   alleen Chromium.

   DE NEPCAMERA. Chromium levert met --use-fake-device-for-media-stream een
   testbeeld en met --use-fake-ui-for-media-stream een automatisch "ja" op de
   vraag om toegang. De vraag OF de browser het toestaat blijft echt; alleen de
   klik erop en het beeld zijn nep.

   Draait alleen waar een browser is; anders overgeslagen.
   Draai: npm run e2e
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const { laadScherm, startServer, stop, nepMediaArgs, installeerNepMicrofoon } = require('./helper');
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

/* Een adres dat GEEN localhost is. Zonder zo'n adres is (a) niet te meten: op
   loopback vindt de browser http nog beveiligd, en dan blijft juist de fout die
   we onderzoeken onzichtbaar. Ontbreekt er een niet-loopback adres op deze
   machine, dan wordt dat deel overgeslagen met opgaaf van reden -- niet stil. */
function lanAdres() {
  const netten = os.networkInterfaces();
  for (const naam of Object.keys(netten)) {
    for (const n of netten[naam] || []) {
      if (n.family !== 'IPv4' || n.internal) continue;
      return n.address;
    }
  }
  return null;
}

/* De pagina's met een camera of een microfoon. Met de hand, niet afgeleid: een
   afgeleide lijst schuift mee met de code en dan verandert wat deze toets dekt
   zonder dat iemand dat besluit. */
const MEDIAPAGINAS = ['/apps/camera.html', '/apps/oog.html', '/apps/clips.html',
  '/apps/podium.html', '/apps/theater.html', '/apps/scanner.html', '/apps/rtgcode.html',
  '/apps/memo.html', '/apps/meet.html', '/apps/vertaler.html', '/apps/app.html',
  '/apps/index.html', '/apps/personeel.html', '/apps/kantoren.html',
  '/apps/foundation/vrienden.html'];

test('camera en microfoon: op een LAN-adres zegt de app WAAROM het niet gaat, en op een veilig adres gaat het',
  { skip: pw ? false : 'geen browser beschikbaar in deze omgeving' }, async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-media-e2e-'));
  const lan = lanAdres();
  // op alle interfaces luisteren, anders is het LAN-adres niet te bereiken
  const srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, RTG_BIND: '0.0.0.0' } });
  let browser;
  try {
    browser = await pw.chromium.launch({ args: nepMediaArgs() });
    const ctx = await browser.newContext({ permissions: ['camera', 'microphone'] });
    await installeerNepMicrofoon(ctx);

    /* ---- (a) DE KLACHT ZELF: een http-adres dat geen localhost is ---- */
    if (!lan) {
      // geen niet-loopback adres: dan is dit deel niet te meten, en dat zeggen we
      console.log('# LET OP: geen LAN-adres op deze machine, dus het onveilige-adres-deel is niet gemeten');
    } else {
      const lanBasis = srv.base.replace(/\/\/[^/]+/, '//' + lan + ':' + srv.port);
      const p1 = await ctx.newPage();
      await p1.goto(lanBasis + '/apps/camera.html', { waitUntil: 'domcontentloaded', timeout: 30000 });
      const onveilig = await p1.evaluate(async () => {
        const heeft = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
        const reden = window.RTGMedia && window.RTGMedia.reden('camera');
        let code = null;
        try { await window.RTGMedia.camera(); } catch (e) { code = e.rtg && e.rtg.code; }
        const el = document.querySelector('.rtg-media-melding');
        return { veilig: window.isSecureContext, heeft: heeft, reden: reden, code: code,
          inBeeld: !!el, tekst: el ? el.textContent : '', vast: el ? getComputedStyle(el).position : null };
      });
      assert.equal(onveilig.veilig, false, 'een LAN-adres op http is geen beveiligde context');
      assert.equal(onveilig.heeft, false,
        'en dan bestaat navigator.mediaDevices niet -- dit is de oorzaak van "er gebeurt niks"');
      assert.equal(onveilig.reden, 'onveilig', 'de mediapoort weet dat ZONDER het te vragen');
      assert.equal(onveilig.code, 'onveilig', 'en breekt met die reden in plaats van een rauwe TypeError');
      assert.ok(onveilig.inBeeld, 'er staat een melding in beeld (dit was de stilte)');
      assert.match(onveilig.tekst, /https/, 'die het https-adres noemt in plaats van "geef toegang"');
      assert.equal(onveilig.vast, 'fixed', 'en shared/media.css is geladen');
      await p1.close();
    }

    /* ---- (b) op een beveiligd adres werkt het, ook in een kader ---- */
    const page = await ctx.newPage();
    await page.goto(srv.base + '/apps/index.html', { waitUntil: 'domcontentloaded', timeout: 30000 });
    const bloot = await page.evaluate(async () => {
      try {
        const s = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        const n = s.getTracks().length; s.getTracks().forEach(t => t.stop());
        return { ok: true, sporen: n };
      } catch (e) { return { ok: false, naam: e.name, bericht: e.message }; }
    });
    assert.ok(bloot.ok, 'de nepcamera werkt op de pagina zelf (anders meet de rest niets): ' + JSON.stringify(bloot));
    assert.equal(bloot.sporen, 2, 'beeld en geluid, twee sporen');

    /* Het kader wordt in de pagina gemaakt en van BUITEN aangesproken: de CSP
       staat geen eval toe (terecht -- zie test/csp.e2e.js), dus praten we via het
       frame-adres met de inhoud in plaats van via contentWindow.eval. */
    const adres = srv.base + '/apps/camera.html?kader=1';
    const recht = await page.evaluate(async (url) => {
      const f = document.createElement('iframe');
      f.name = 'proefkader';
      window.RTGMedia.kader(f);          // het recht komt uit de module, niet uit deze toets
      f.src = url;
      document.body.appendChild(f);
      await new Promise(r => f.addEventListener('load', r, { once: true }));
      return f.getAttribute('allow');
    }, adres);
    assert.match(recht, /\bcamera\b/, 'het kader draagt camera in zijn allow');
    assert.match(recht, /\bmicrophone\b/, 'en microphone');
    const frame = page.frames().find(f => f.url() === adres);
    assert.ok(frame, 'het kader is er');
    const inKader = await frame.evaluate(async () => {
      const fp = document.featurePolicy || document.permissionsPolicy;
      const mag = fp && fp.allowsFeature ? fp.allowsFeature('camera') : null;
      try {
        const s = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        const n = s.getTracks().length; s.getTracks().forEach(t => t.stop());
        return { ok: true, sporen: n, mag: mag, poort: !!window.RTGMedia };
      } catch (e) { return { ok: false, naam: e.name, mag: mag, poort: !!window.RTGMedia }; }
    });
    assert.ok(inKader.ok, 'in een kader gaat de camera open: ' + JSON.stringify(inKader));
    assert.equal(inKader.sporen, 2, 'beeld en geluid in het kader');
    assert.equal(inKader.mag, true, 'en de browser zegt zelf dat camera daar mag');
    assert.ok(inKader.poort, 'de mediapoort staat ook in het kader');

    /* ---- (c) een weigering en een onbekende fout worden benoemd ---- */
    const melding = await page.evaluate(async () => {
      /* De weigering nabootsen zoals de browser hem geeft: de mediapoort hoort
         van de DOMException-NAAM af te hangen en niet van iets wat alleen in
         deze opstelling waar is. */
      const echt = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
      navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException('nee', 'NotAllowedError'));
      let code = null;
      try { await window.RTGMedia.camera(); } catch (e) { code = e.rtg && e.rtg.code; }
      navigator.mediaDevices.getUserMedia = echt;
      const el = document.querySelector('.rtg-media-melding');
      return { code: code, inBeeld: !!el, tekst: el ? el.textContent : '' };
    });
    assert.equal(melding.code, 'geweigerd', 'een NotAllowedError buiten een kader heet "geweigerd"');
    assert.ok(melding.inBeeld, 'en er staat een melding in beeld');
    assert.match(melding.tekst, /slotje/, 'die vertelt WAAR de gebruiker het aanzet');

    const onbekend = await page.evaluate(async () => {
      const echt = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
      navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException('x', 'IetsNieuwsError'));
      let r = null;
      try { await window.RTGMedia.microfoon(); } catch (e) { r = e.rtg; }
      navigator.mediaDevices.getUserMedia = echt;
      return r;
    });
    assert.equal(onbekend.code, 'onbekend', 'een fout die dit huis niet kent heet "onbekend"');
    assert.match(onbekend.uitleg, /IetsNieuwsError/, 'en de naam van de browserfout staat erbij');
    await page.close();

    /* ---- (d) elke mediapagina heeft de poort echt ---- */
    const zonderPoort = [];
    for (const pad of MEDIAPAGINAS) {
      const p3 = await ctx.newPage();
      await p3.goto(srv.base + pad, { waitUntil: 'domcontentloaded', timeout: 30000 });
      const staat = await p3.evaluate(() => ({
        poort: !!(window.RTGMedia && window.RTGMedia.camera && window.RTGMedia.kader),
        recht: window.RTGMedia && window.RTGMedia.KADERRECHT,
        reden: window.RTGMedia ? window.RTGMedia.reden('camera') : 'geen poort'
      }));
      if (!staat.poort) zonderPoort.push(pad + ' heeft geen RTGMedia');
      else if (!/camera/.test(staat.recht || '')) zonderPoort.push(pad + ' kent het kaderrecht niet');
      else if (staat.reden !== null) zonderPoort.push(pad + ' zegt dat camera hier niet kan: ' + staat.reden);
      await p3.close();
    }
    assert.deepEqual(zonderPoort, [],
      'elke mediapagina draagt de mediapoort:\n  ' + zonderPoort.join('\n  '));
  } finally {
    if (browser) await browser.close().catch(() => {});
    stop(srv && srv.child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
