#!/usr/bin/env node
/* ============================================================================
   HET BEWIJS ONDER DE OMZETTING: ELK ELEMENT, ELKE AANGERAAKTE EIGENSCHAP.

   TAKEN.md 4.51 zegt met zoveel woorden waarom `color` en `width` niet
   mechanisch om te zetten zijn: de gedeelde schillen zetten ze met
   `!important`, en een inline stijl wint van alles behalve dat -- een klasse
   niet. Bij `kantoren.html` is dat geen theorie: `ios.css` wordt geladen NA het
   eigen `<style>`-blok, dus een klasse daarin verliest van elke gelijk-specifieke
   regel daar.

   Dat is niet met redeneren te beslissen en wel met meten. Deze proef opent de
   pagina in een echte browser, loopt ELK element langs op DOM-volgorde en
   noteert de BEREKENDE waarde van elke eigenschap die ergens op die pagina in
   een style-attribuut voorkwam. Voor en na de omzetting. Een verschil is een
   omgedraaide uitslag, en dan gaat de omzetting terug.

   WAAROM DE VOLGORDE VAN DE ELEMENTEN DE SLEUTEL IS. Een omzetting verandert
   attributen, geen structuur: hetzelfde element staat voor en na op dezelfde
   plek in de boom. Een sleutel op DOM-volgorde is daarom stabiel en vraagt geen
   id's die er niet zijn. Verandert het AANTAL elementen, dan is er meer gebeurd
   dan een omzetting en zakt de proef -- terecht.

   WAT HIJ NIET ZIET, en dat hoort erbij te staan:
     - alles wat pas na een inlog of een aanroep op het scherm komt. Daarom zet
       scripts/inlinestijl-omzet.js alleen attributen om die in de MARKUP staan
       en nooit in een JavaScript-string.
     - :hover, :focus en media queries buiten de gemeten breedte. Hij meet de
       rusttoestand op een vaste breedte; dat is minder dan alles en veel meer
       dan niets.

   Draai:  node scripts/inlinestijl-proef.js /apps/kantoren.html --voor  uit.json
           (omzetten)
           node scripts/inlinestijl-proef.js /apps/kantoren.html --na    uit.json
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const { laadScherm, herkomst } = require('./lib/scherm');

const WORTEL = path.join(__dirname, '..');
const argv = process.argv.slice(2);
const losse = argv.filter(a => !a.startsWith('--'));
const pad = losse[0];
const uitBestand = losse[1];
const NA = argv.includes('--na');
const BASIS = process.env.RTG_BASIS || 'http://localhost:3000';
const BREEDTE = Number(process.env.RTG_BREEDTE || 1280);

/* Welke eigenschappen ertoe doen: precies die welke in dit bestand ooit in een
   style-attribuut stonden. Alles meten zou duizenden waarden per element geven
   en het verschil onvindbaar maken; minder meten zou de vraag ontwijken. */
function eigenschappenVan(bestand) {
  const bron = fs.readFileSync(path.join(WORTEL, bestand), 'utf8');
  const uit = new Set();
  for (const m of bron.matchAll(/\sstyle="([^"]*)"/g)) {
    for (const decl of m[1].split(';')) {
      const k = decl.split(':')[0].trim().toLowerCase();
      if (/^[a-z-]+$/.test(k)) uit.add(k);
    }
  }
  return [...uit].sort();
}

async function meet(url, eigenschappen) {
  const pw = laadScherm();
  if (!pw) throw new Error('geen browser gevonden; een proef die niet kon draaien is niet geslaagd');
  const browser = await pw.chromium.launch({ args: ['--no-sandbox'] });
  try {
    /* ZONDER JAVASCRIPT, en dat is geen bezuiniging maar de enige manier waarop
       deze proef de vraag STELT die hij moet stellen.

       Met JavaScript aan wist de inlogpoort van kantoren.html de hele body en
       blijven er 57 elementen over -- geen van de 248 omgezette attributen zit
       daar nog bij, dus een groene proef zou over niets gaan (LAT.md regel 3).
       Inloggen zou het ook oplossen, maar dan hangt het bewijs aan een sessie,
       een rol en een seed, terwijl de vraag zelf daar niets mee te maken heeft:
       wint een klasse in het eigen <style>-blok van de regels in ios.css, ja of
       nee. Dat is een CASCADE-vraag, en de cascade heeft geen JavaScript nodig.
       De <link>-bladen laden gewoon; wat een script later toevoegt staat voor en
       na even hard buiten beeld. */
    const ctx = await browser.newContext({ viewport: { width: BREEDTE, height: 900 }, javaScriptEnabled: false });
    const page = await ctx.newPage();
    await page.goto(url, { waitUntil: 'load' });
    /* Wachten op de stijlbladen: `domcontentloaded` garandeert de DOM, niet de
       cascade. Zonder dit meet de proef soms de stand voordat ios.css binnen is
       -- en dan is precies de regel die het risico vormt nog niet in beeld. */
    /* Zonder JavaScript kan een waitForFunction niet draaien; `load` wacht op
       elk subverzoek en dus ook op de stijlbladen. Hier is dat precies de
       bewering die nodig is -- de uitzondering op TAKEN.md 4.67, en met reden. */
    await page.waitForLoadState('load');
    return await page.evaluate((props) => {
      const uit = [];
      const alle = document.querySelectorAll('*');
      for (const el of alle) {
        const c = getComputedStyle(el);
        /* De klassen erbij, zodat een verschil te herleiden is tot de klasse
           die het veroorzaakte. Zonder dat is de uitslag "er is iets veranderd"
           en niet "DEZE omzetting mag niet". */
        const rij = { t: el.tagName, k: el.className || '' };
        for (const p of props) rij[p] = c.getPropertyValue(p);
        uit.push(rij);
      }
      return uit;
    }, eigenschappen);
  } finally { await browser.close(); }
}

(async () => {
  if (!pad || !uitBestand) {
    console.error('gebruik: node scripts/inlinestijl-proef.js /apps/kantoren.html uit.json [--na]');
    process.exit(2);
  }
  const bestand = 'public' + pad;
  /* DE NAMETING GEBRUIKT DE EIGENSCHAPPEN VAN VOOR, en dat is geen detail: de
     omzetting HAALT declaraties uit de attributen weg, dus de lijst die uit het
     bestand komt is daarna smaller. Meten met die smallere lijst gaf hier 1654
     "verschillen" die geen van alle een verschil waren -- `font` en `resize`
     stonden simpelweg niet meer in de vraag, en kwamen als `undefined` terug.
     Een proef die zijn eigen vraag verandert tussen voor en na, meet zichzelf. */
  const eig = NA ? JSON.parse(fs.readFileSync(uitBestand, 'utf8')).eigenschappen : eigenschappenVan(bestand);
  console.log('browser: ' + herkomst());
  console.log('eigenschappen: ' + eig.length + ' (' + eig.slice(0, 8).join(', ') + (eig.length > 8 ? ', ...' : '') + ')');
  const nu = await meet(BASIS + pad, eig);
  console.log('elementen: ' + nu.length);

  if (!NA) {
    fs.writeFileSync(uitBestand, JSON.stringify({ pad, breedte: BREEDTE, eigenschappen: eig, rijen: nu }));
    console.log('vastgelegd in ' + uitBestand + ' -- zet nu om, en draai daarna met --na');
    return;
  }

  const voor = JSON.parse(fs.readFileSync(uitBestand, 'utf8'));
  if (voor.rijen.length !== nu.length) {
    console.error('ZAKT: ' + voor.rijen.length + ' elementen voor, ' + nu.length + ' na. ' +
      'Een omzetting verandert attributen en geen structuur; dit is meer dan een omzetting.');
    process.exit(1);
  }
  const verschillen = [];
  for (let i = 0; i < nu.length; i++) {
    for (const p of voor.eigenschappen) {
      if (voor.rijen[i][p] !== nu[i][p]) {
        const klassen = String(nu[i].k || '').split(/\s+/).filter(k => /^i-[0-9a-z-]+$/.test(k));
        verschillen.push({ i, tag: nu[i].t.toLowerCase(), prop: p, klassen,
          tekst: '#' + i + ' <' + nu[i].t.toLowerCase() + '> ' + p +
            ': "' + voor.rijen[i][p] + '" -> "' + nu[i][p] + '"' +
            (klassen.length ? '   [' + klassen.join(' ') + ']' : '') });
      }
    }
  }
  if (verschillen.length) {
    console.error('\nZAKT: ' + verschillen.length + ' berekende waarde(n) veranderd:\n');
    for (const v of verschillen.slice(0, 25)) console.error('  ' + v.tekst);
    if (verschillen.length > 25) console.error('  ... en nog ' + (verschillen.length - 25));
    const schuldig = [...new Set(verschillen.flatMap(v => v.klassen))].sort();
    console.error('\nDe klassen die het veroorzaken (' + schuldig.length + '):');
    console.error('  ' + schuldig.join(','));
    /* De schuldigen apart wegschrijven, zodat de omzetting ze kan overslaan en
       de rest WEL kan doorgaan. Alles terugdraaien om een paar gevallen zou de
       meting weggooien die net is betaald. */
    fs.writeFileSync(uitBestand.replace(/\.json$/, '') + '-schuldig.txt', schuldig.join('\n') + '\n');
    console.error('\nWeggeschreven; draai de omzetting opnieuw met --overslaan.');
    process.exit(1);
  }
  console.log('\nGELIJK: ' + nu.length + ' elementen x ' + voor.eigenschappen.length +
    ' eigenschappen, nul verschil. De omzetting verandert geen pixel.');
})().catch(e => { console.error(e.message); process.exit(2); });
