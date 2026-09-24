#!/usr/bin/env node
/* ============================================================================
   DE LIEGRONDE -- bewijs 4 (waarheidsgetrouw) over elk onderdeel uit MAPPEN.

   WAAROM. BETROUWBAARHEID.md par. 7 punt 3: "De liegpoort bestaat (RTG_LIEG) en
   draait over zes schermen. Hem over alle onderdelen halen kost rekentijd, geen
   ontwerp." test/liegend-scherm.e2e.js doet het voor zes vaste ledenschermen en
   schrijft een telling (SCHERMLEUGEN.json), geen uitslag per scherm. Deze ronde
   doet hetzelfde experiment per rij van APPWERKT.json, met de persona van die
   rij, en legt de uitslag per ingang vast zodat scripts/lib/bewijsbron.js hem
   kan samenstellen.

   HET EXPERIMENT IS HETZELFDE, en er komt niets bij. De server draait met
   RTG_LIEG=/api/: elk endpoint buiten de deuren geeft `{ok:true}` en verder
   niets. De drie detectoren staan in scripts/lib/schermleugen.js: een JS-fout,
   rommel in beeld (NaN, undefined, [object Object]), en een zekerheidswoord dat
   wel in de gerenderde tekst staat en niet in de statische bron.

   WAT EEN UITSLAG BETEKENT, per rij:
     BEWEZEN        het scherm kreeg minstens een gelogen antwoord, en toonde
                    geen verzonnen zekerheid, geen rommel, en viel niet om.
     DEFECT         het scherm verzon een zekerheid (een zekerheidswoord in de
                    gerenderde tekst dat niet in de statische bron staat).
     NIET_GETEST    er viel niets te liegen (het scherm vroeg buiten de deuren
                    niets aan de backend), het landde op een ander scherm of
                    achter een deur, het heeft geen eigen adres, of het viel om
                    of toonde rommel (zie oordeel() voor waarom dat geen DEFECT is).

   WAT DIT NIET BEWIJST, en dat staat in elke uitslag: alleen een LEEG antwoord
   wordt beproefd. Een backend die iets VERKEERDS antwoordt in plaats van niets,
   wordt hier niet betrapt (de grens van scripts/lib/schermleugen.js).

   Draai: node scripts/liegronde.js               (meet, schrijft niets)
          node scripts/liegronde.js --vastleggen  (schrijft LIEGRONDE.json)
   ========================================================================== */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');

const WORTEL = path.join(__dirname, '..');
const DOEL = path.join(WORTEL, 'LIEGRONDE.json');
const { rijen, maakContext, POORTEN } = require('./appwerkt');
const { haalSessies, opslagVoor } = require('./lib/proefsessies');
const { vindKlachten, zichtbareTekst } = require('./lib/schermleugen');
const { magLiegen } = require('../server/opzet/liegpoort');
const { stempel } = require('./lib/stempel');

const LIEG = '/api/';
/* De deuren liegen niet: anders meet je de inlog en niet het scherm. Dat zijn de
   routes waarmee scripts/lib/proefsessies.js de vier sessies munt, plus de schil
   die elk scherm nodig heeft om op te bouwen (dezelfde lijst als
   test/liegend-scherm.e2e.js). */
const SPAAR = ['/api/auth/', '/api/login', '/api/office/login', '/api/supplier/login',
  '/api/supplier/roster', '/api/foundation/gezin/maak', '/api/account/', '/api/onboarding/status',
  '/api/config', '/api/i18n', '/api/talen', '/api/vertaal/', '/api/gids/app', '/api/push/key'].join(',');
const PAR = Number((process.argv.find((a) => a.startsWith('--par=')) || '').slice(6) || 4);
const GRENS = 'alleen een LEEG antwoord is beproefd; een backend die iets verkeerds antwoordt, wordt hier niet betrapt';

/* DRIE DETECTOREN, TWEE BETEKENISSEN. Alleen een verzonnen zekerheid is een
   uitspraak over bewijs 4: het scherm toont een sterkere toestand dan de
   backend gaf. Een JS-fout of `undefined` in beeld op het kale antwoord
   `{ok:true}` zegt iets over robuustheid bij een antwoord dat de echte backend
   nooit zo geeft, en niet over liegen. De eerste ronde (24 september 2026) vond
   0 verzonnen zekerheden en 38 schermen met een JS-fout of rommel; die als DEFECT
   onder bewijs 4 zetten zou er een nieuwe betekenis van maken. Het huis telt ze
   in SCHERMLEUGEN.json als schuld, en hier staan ze per rij in `klachten`. Bij
   zo'n scherm is bewijs 4 NIET_GETEST: wie omvalt, laat niet zien of hij een
   toestand zou verzinnen. */
const isZekerheid = (k) => /^zekerheid zonder gegevens/.test(k);

function oordeel(m) {
  const zeker = m.klachten.filter(isZekerheid);
  if (zeker.length) return { status: 'GEBLOKKEERD_DOOR_DEFECT', reden: 'met een lege backend: ' + zeker[0] };
  if (m.klachten.length) return { status: 'NIET_GETEST', reden: 'het scherm viel om of toonde rommel bij een leeg antwoord (' + m.klachten[0] + '); of het een toestand zou verzinnen, is zo niet vast te stellen' };
  if (m.landing && m.landing !== m.pad) return { status: 'NIET_GETEST', reden: 'landde op ' + m.landing + ' in plaats van ' + m.pad + '; het scherm zelf is niet beproefd' };
  if (m.deur) return { status: 'NIET_GETEST', reden: 'achter een deur (' + m.deur + '); het scherm zelf is niet beproefd' };
  if (!m.gelogen.length) return { status: 'NIET_GETEST', reden: 'het scherm vroeg buiten de deuren niets aan de backend; er viel niets te liegen' };
  return { status: 'BEWEZEN', reden: m.gelogen.length + ' antwoord(en) gelogen, en geen verzonnen zekerheid, geen rommel en geen JS-fout; ' + GRENS };
}

async function meetRij(rij, base, contexten) {
  const uit = { functie: rij.functie, app: rij.app, ingang: rij.ingang, persona: rij.persona };
  if (!rij.pad) return Object.assign(uit, { status: 'NIET_GETEST', reden: 'geen eigen adres: een stand of kiezer binnen de ledenapp' });
  const ctx = contexten[rij.persona];
  if (!ctx) return Object.assign(uit, { status: 'NIET_GETEST', reden: 'geen sessie voor de persona ' + rij.persona });
  const statisch = await fetch(base + rij.pad).then((r) => (r.ok ? r.text() : '')).catch(() => '');
  const m = { pad: rij.pad, klachten: [], gelogen: [], landing: null, deur: null };
  if (!statisch) m.klachten.push('scherm niet op te halen');
  const page = await ctx.newPage();
  const fouten = [];
  const gelogen = new Set();
  page.on('pageerror', (e) => fouten.push(String((e && e.message) || e)));
  page.on('request', (req) => {
    const p = new URL(req.url()).pathname;
    if (p.startsWith('/api/') && magLiegen(p, LIEG, SPAAR)) gelogen.add(req.method() + ' ' + p);
  });
  try {
    if (statisch) {
      await page.goto(base + rij.pad, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await page.waitForTimeout(2500);
      m.landing = new URL(page.url()).pathname;
      m.deur = await page.evaluate((sel) => sel.find((s) => document.querySelector(s)) || null, POORTEN);
      const tekst = await zichtbareTekst(page);
      m.klachten.push(...vindKlachten({ tekst, statisch, fouten }));
    }
  } catch (e) {
    m.klachten.push('scherm viel om: ' + String((e && e.message) || e).split('\n')[0].slice(0, 120));
  } finally {
    try { await page.close(); } catch (e) {}
  }
  m.gelogen = [...gelogen].sort();
  return Object.assign(uit, oordeel(m), { gelogen: m.gelogen.length, klachten: m.klachten });
}

async function meet() {
  const { laadBrowser } = require(path.join(WORTEL, 'test', 'browser'));
  const pw = laadBrowser({ eigenDriver: false });
  if (!pw) { console.error('Geen browser beschikbaar; deze ronde meet in een echte browser.'); process.exit(2); }
  const { startServer } = require(path.join(WORTEL, 'test', 'helper.js'));
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-liegronde-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, RTG_LIEG: LIEG, RTG_LIEG_NIET: SPAAR } });
  const browser = await pw.chromium.launch({ args: ['--no-sandbox'] });
  try {
    const { sessies, overgeslagen } = await haalSessies(base);
    const lijst = rijen();
    const uit = [];
    let n = 0;
    await Promise.all(Array.from({ length: PAR }, async () => {
      const contexten = {};
      for (const rol of Object.keys(sessies)) contexten[rol] = await maakContext(browser, opslagVoor({ [rol]: sessies[rol] }));
      while (true) {
        const i = n++; if (i >= lijst.length) break;
        uit.push(await meetRij(lijst[i], base, contexten));
      }
      for (const c of Object.values(contexten)) await c.close();
    }));
    uit.sort((a, b) => a.functie.localeCompare(b.functie));
    const telling = {};
    for (const r of uit) telling[r.status] = (telling[r.status] || 0) + 1;
    return {
      stempel: stempel(),
      uitleg: 'Bewijs 4 (waarheidsgetrouw) per onderdeel uit MAPPEN: het scherm met de persona van de rij, terwijl de backend buiten de deuren leeg antwoordt (RTG_LIEG). Zie de kop van scripts/liegronde.js.',
      grens: GRENS + '. Een scherm dat niets aan de backend vraagt, is NIET_GETEST en niet BEWEZEN.',
      sessiesOvergeslagen: overgeslagen,
      telling,
      regels: uit
    };
  } finally {
    await browser.close();
    try { child.kill(); } catch (e) {}
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
}

module.exports = { oordeel, isZekerheid, SPAAR, DOEL };

if (require.main === module) {
  meet().then((u) => {
    console.log('liegronde: ' + u.regels.length + ' onderdelen -- ' + JSON.stringify(u.telling));
    for (const r of u.regels) if (r.status === 'GEBLOKKEERD_DOOR_DEFECT') console.log('  DEFECT  ' + r.app + ' (' + r.ingang + '): ' + r.reden);
    if (process.argv.includes('--vastleggen')) {
      fs.writeFileSync(DOEL, JSON.stringify(u, null, 2) + '\n');
      console.log('geschreven: LIEGRONDE.json');
    }
  }).catch((e) => { console.error('de liegronde kon niet draaien: ' + ((e && e.message) || e)); process.exit(1); });
}
