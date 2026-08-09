/* ================== DE TELEFOONMAAT (npm run telefoonmaat) ==================

   Eén vraag, over elk scherm dat dit huis heeft: past het op het toestel?
   Niets breder dan het scherm, en niets langer dan het scherm.

   WAAROM DIT ER IS. Op 320 punten -- de kleine PDA, de smalste maat die we
   bedienen -- liepen zeventien van de tweehonderddertien schermen uit hun
   jasje. De helft daarvan kon je horizontaal wegslepen (de app schoof onder je
   duim vandaan), de andere helft stond op een body met `overflow:hidden` en
   daar was het erger: daar SCHOOF niets, daar was de knop gewoon weg. Geen
   foutmelding, geen log, geen toets die zakte. Precies de stilste soort defect
   die er is.

   HOE HIJ MEET, EN WAAROM NIET ANDERS. Niet met `documentElement.scrollWidth`,
   hoe voor de hand liggend dat ook is. public/shared/maat.css zet de grendel
   `overflow-x:clip` op de wortel, en daaronder MELDT die scrollWidth niets
   meer -- de pagina schuift immers niet. Een meter die door zijn eigen grendel
   blind wordt, is de val uit LAT regel 10, en hij is hier ook echt dichtgeklapt:
   de eerste versie van deze scan meldde nul uitlopers op alle 213 schermen, en
   dat was gewoon niet waar.

   Daarom kijkt hij naar RECHTHOEKEN: waar staat elk zichtbaar element, en valt
   het buiten het scherm? Die meting werkt door de grendel heen. Nagetrokken met
   drie mutaties (zie de kop van test/telefoonmaat.e2e.js).

   WAT ER NIET MEETELT. Een element binnen een voorouder die zelf horizontaal
   schuift of afknipt (een tabbalk, een carrousel, een codeblok) mag breder zijn
   dan het scherm: dat schuift ZELF en trekt de pagina niet mee. body en html
   tellen daarbij NIET als zo'n voorouder -- dat is de grendel, en die als
   "netjes afgeknipt" lezen is precies hoe deze meter eerder blind werd.

   WAT HIJ NIET ZIET, en dat hoort er eerlijk bij te staan: dit is de EERSTE
   render, uitgelogd, zoals ook scripts/a11y.js meet. Wat er achter een inlog of
   achter een knop tevoorschijn komt, meet test/telefoonmaat.e2e.js op de
   vlaggenschepen, ingelogd en met de bladen open.

   Zonder browser slaat de scan zichzelf over met exitcode 0; met
   TELEFOONMAAT_STRICT=1 (CI en de slotsuite) is dat een gezakte poort.
   =========================================================================== */
'use strict';
const { server, paginas, laadBrowser } = require('./lib/statisch');

const STRIKT = process.env.TELEFOONMAAT_STRICT === '1';

/* De maten. 320x480 is de kleine PDA en de smalste maat die we bedienen;
   390x844 is de telefoon van nu. Beide staand: in liggende stand is de app
   een ander ontwerp en niet een smaller scherm. */
const MATEN = [
  { naam: 'PDA', breedte: 320, hoogte: 480 },
  { naam: 'telefoon', breedte: 390, hoogte: 844 },
];

/* De meting draait IN de pagina. Als tekst, want hij gaat ook naar de e2e. */
const METING = `(() => {
  const vw = document.documentElement.clientWidth, vh = innerHeight;
  const naam = (el) => {
    const k = el.className && el.className.baseVal !== undefined ? el.className.baseVal : (el.className || '');
    return el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') +
      (String(k).trim() ? '.' + String(k).trim().split(/\\s+/).slice(0, 3).join('.') : '');
  };
  const waar = (el) => {
    const d = [];
    for (let n = el; n && n !== document.body; n = n.parentElement) d.unshift(naam(n));
    return d.slice(-3).join(' > ');
  };
  /* Schuift of knipt een voorouder al horizontaal, dan is dit een eigen
     schuifvak en geen uitloop. body en html tellen niet mee: dat is de
     grendel uit maat.css. */
  const eigenVak = (el) => {
    for (let n = el.parentElement; n && n !== document.body && n !== document.documentElement; n = n.parentElement) {
      if (getComputedStyle(n).overflowX !== 'visible') return true;
    }
    return false;
  };
  const breed = [], lang = [];
  for (const el of document.querySelectorAll('body *')) {
    const st = getComputedStyle(el);
    if (st.display === 'none' || st.visibility === 'hidden') continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue;
    const uit = Math.round(Math.max(r.right - vw, -r.left));
    if (uit > 1 && !eigenVak(el)) breed.push({ waar: waar(el), uit, maat: Math.round(r.width) });
    /* De hoogte alleen voor vaste lagen: een PAGINA mag langer zijn dan het
       scherm (daar is scrollen voor), een laag die OVER het scherm hangt niet. */
    if (st.position === 'fixed') {
      const over = Math.round(r.height - vh);
      if (over > 1) lang.push({ waar: waar(el), uit: over, maat: Math.round(r.height) });
    }
  }
  return { vw, vh, breed, lang };
})()`;

/* Eén ronde: elk pad op elke maat. Geeft de bevindingen terug, print niets --
   zo kan de e2e dezelfde functie gebruiken zonder ruis in de uitvoer. */
async function meet(page, basis, paden, maten = MATEN, wacht = 450) {
  const bevindingen = [];
  for (const maat of maten) {
    await page.setViewportSize({ width: maat.breedte, height: maat.hoogte });
    for (const pad of paden) {
      await page.goto(basis + pad, { waitUntil: 'load' });
      await page.waitForTimeout(wacht);
      const r = await page.evaluate(new Function('return ' + METING));
      /* De maat moet ECHT staan. Zonder deze bewering meet een scan die de
         viewport niet gezet krijgt gewoon op bureaubladmaat door, meldt nul
         uitlopers en klinkt als goed nieuws (LAT regel 3). */
      if (r.vw !== maat.breedte) {
        throw new Error(`de viewport staat niet op ${maat.naam}: gevraagd ${maat.breedte}, gemeten ${r.vw}`);
      }
      for (const b of r.breed) bevindingen.push({ pad, maat: maat.naam, as: 'breed', ...b });
      for (const l of r.lang) bevindingen.push({ pad, maat: maat.naam, as: 'lang', ...l });
    }
  }
  return bevindingen;
}

async function hoofd() {
  /* DE WACHTER over de hele ronde, en niet alleen over het starten. Met een
     browser die wel start maar daarna niet antwoordt bleef deze scan drie
     minuten per pagina hangen; in CI is dat een stap die een uur stilstaat en
     daarna afbreekt zonder te zeggen waarop. Een meter die stilvalt is geen
     meter (LAT regel 3), dus na dertig minuten stopt hij hardop. De hele ronde
     duurt normaal ruim negen minuten, dus dat is ruim en toch een muur.
     .unref() zodat de wachter zelf het einde nooit ophoudt. */
  const KLOK = Number(process.env.TELEFOONMAAT_MAXMS || 30 * 60 * 1000);
  const wachter = setTimeout(() => {
    console.error('[telefoonmaat] MISLUKT: de scan stond na ' + Math.round(KLOK / 1000) +
      ' seconden nog stil. Dat is geen uitslag; kijk of de browser antwoordt.');
    process.exit(1);
  }, KLOK);
  wachter.unref();

  const pw = laadBrowser();
  if (!pw) {
    console.log('[telefoonmaat] geen browser beschikbaar; scan overgeslagen.' +
      (STRIKT ? '' : ' (TELEFOONMAAT_STRICT=1 maakt dit een gezakte poort.)'));
    process.exit(STRIKT ? 1 : 0);
  }
  const paden = paginas();
  const srv = server();
  await new Promise((r) => srv.listen(0, r));
  const basis = 'http://127.0.0.1:' + srv.address().port;

  /* De muur om het starten. Een browser die NIET start geeft een fout en die
     vangen we hieronder op -- maar een browser die blijft HANGEN geeft niets,
     en dan staat een CI-stap een uur stil om daarna af te breken zonder dat
     iemand weet waarop. Dat gedrag is hier echt gezien (het pakket stond er,
     de binary niet). Stilvallen is geen uitkomst (LAT regel 3), dus krijgt het
     starten een klok mee. */
  const muur = (belofte, ms, wat) => Promise.race([belofte,
    new Promise((_, af) => setTimeout(() => af(new Error(wat + ' gaf binnen ' + ms + 'ms geen antwoord')), ms).unref()),
  ]);

  let browser;
  try { browser = await muur(pw.chromium.launch({ args: ['--no-sandbox'] }), 90000, 'het starten van Chromium'); }
  catch (e) {
    console.log('[telefoonmaat] Chromium startte niet: ' + e.message);
    srv.close();
    process.exit(STRIKT ? 1 : 0);
  }

  let bevindingen = [];
  try {
    const page = await (await browser.newContext()).newPage();
    bevindingen = await meet(page, basis, paden);
  } finally {
    await browser.close();
    srv.close();
  }

  const perPagina = new Map();
  for (const b of bevindingen) {
    const sleutel = b.pad + ' (' + b.maat + ')';
    if (!perPagina.has(sleutel)) perPagina.set(sleutel, []);
    perPagina.get(sleutel).push(b);
  }
  for (const [sleutel, lijst] of perPagina) {
    console.log('\n[telefoonmaat] ' + sleutel + ': ' + lijst.length + ' buiten de maat');
    for (const b of lijst.slice(0, 8)) {
      console.log('   ' + (b.as === 'breed' ? 'te breed' : 'te lang') +
        ' +' + b.uit + 'px (' + b.maat + 'px)  ' + b.waar);
    }
    if (lijst.length > 8) console.log('   ... en nog ' + (lijst.length - 8));
  }

  clearTimeout(wachter);
  console.log('\n[telefoonmaat] ' + paden.length + ' schermen x ' + MATEN.length + ' maten gemeten.');
  if (bevindingen.length) {
    console.error('[telefoonmaat] MISLUKT: ' + perPagina.size + ' scherm(en) vallen buiten de maat van het toestel.');
    process.exit(1);
  }
  console.log('[telefoonmaat] Geen enkel scherm is breder of langer dan het toestel.');
}

module.exports = { MATEN, METING, meet };

if (require.main === module) {
  hoofd().catch((e) => { console.error('[telefoonmaat] fout:', e); process.exit(1); });
}
