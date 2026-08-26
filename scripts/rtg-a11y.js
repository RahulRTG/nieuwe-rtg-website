#!/usr/bin/env node
/* ============================================================================
   RTG A11Y -- de toegankelijkheidskeuring van dit huis, gericht op een bundel
   van een derde.

   WAAROM DIT EEN ADAPTER IS EN GEEN NIEUWE STACK. Dit huis heeft al een
   toegankelijkheidsmachinerie: scripts/a11ykeuring.js (structuur en contrast) en
   scripts/raakvlakkeuring.js (WCAG 2.5.8, 24x24 op telefoonformaat). Die draait
   over onze eigen schermen en heeft nooit een derdenbundel gezien -- niet omdat
   hij dat niet kan, maar omdat niemand hem erop had gericht.

   Er komt hier dus GEEN tweede stel regels. `BRON` uit beide keuringen wordt
   ongewijzigd geinjecteerd en `velt()` geeft het oordeel. Wat dit bestand
   toevoegt is de weg ernaartoe: een bundel renderen zoals een LID hem krijgt, en
   de uitkomst vertalen naar dezelfde bevindingsvorm als de poort.

   HET MEET DE CEL, NIET HET BESTAND. De bundel wordt gedraaid in dezelfde cel
   als in productie -- dezelfde CSP, dezelfde sandbox, dezelfde brugklant, in het
   iframe van een gastheer -- zodat de brug werkt en de app zijn echte inhoud
   opbouwt. Een keuring op het losse HTML-bestand zou een app meten die nog niets
   heeft gedaan, en dat is niet wat een mens voor zich krijgt.

   HET IS BEWIJS, GEEN POORT. Deze keuring blokkeert vandaag niets, en dat is een
   besluit met twee redenen. Ten eerste zou blokkeren apps weigeren die nu zijn
   toegelaten -- dat is een verandering van de afspraak met bestaande uitgevers.
   Ten tweede is dit de EERSTE keer dat dit huis toegankelijkheid op derdencode
   meet; we weten de uitgangsstand niet, en een poort waarvan niemand weet wat
   hij tegenhoudt, is geen poort maar een verrassing. Wat er wel gebeurt: de
   uitkomst is een uitslag die een uitgever krijgt te zien, met per bevinding hoe
   het wel kan.

   EN HIJ DRAAIT NIET IN keur(). Die is synchroon en heeft geen browser; deze
   keuring heeft er een nodig. Daarom is dit een eigen opdracht en geen stap in
   de machinepoort. Wat er nog niet is -- de uitslag als BEWIJS bij de app in de
   App Store -- staat in CREATE.md par. 6 met de reden erbij.

   Draai: rtg a11y [map]
   ========================================================================== */
'use strict';
const path = require('path');

const WORTEL = path.join(__dirname, '..');
const a11y = require('./a11ykeuring');
const raakvlak = require('./raakvlakkeuring');
const dev = require('./rtg-dev');
/* DE BROWSER KOMT UIT test/browser.js, en dat is met opzet geen eigen kopie.
   Die module bestaat juist omdat "welke browser" 94 keer apart werd beantwoord
   (zie zijn kop): hij probeert te STARTEN in plaats van te laden, loopt alle
   kandidaten af, en geeft null als er echt geen browser is. Een tweede loader
   hier zou precies de fout terugbrengen waarvoor hij is gemaakt. */
const { laadBrowser } = require(path.join(WORTEL, 'test/browser'));

const POORT = 4471;

/* De ruwe uitkomst van de keuring vertalen naar de bevindingsvorm van de poort:
   waar, wat, en hoe het wel kan. Dezelfde vorm, want een uitgever hoort niet
   twee soorten uitslagen te leren lezen (kern/platformfout.js, zelfde reden). */
const HOE = {
  'afbeelding-alt': 'Geef de afbeelding een alt-tekst. Is hij puur decoratief, zet dan alt="" -- dan slaat een schermlezer hem over in plaats van de bestandsnaam voor te lezen.',
  'knop-naam': 'Zet tekst in de knop, of geef hem een aria-label. Een knop met alleen een icoon heeft voor een schermlezer geen naam.',
  'link-naam': 'Zet tekst in de link, of geef hem een aria-label.',
  'veld-label': 'Koppel een <label for="..."> aan het veld, of geef het een aria-label. Een placeholder is geen label: die verdwijnt zodra iemand typt.',
  'html-taal': 'Zet lang="nl" of lang="en" op <html>. Zonder dat leest een schermlezer je tekst in de verkeerde taal voor.',
  'titel': 'Geef het document een <title>. Dat is wat een schermlezer als eerste noemt.',
  'contrast': 'Vergroot het verschil tussen tekst- en achtergrondkleur. WCAG AA vraagt 4,5:1 voor lopende tekst en 3,0:1 voor grote tekst (24px, of 18,66px vet).',
  'springlink': 'Zet een link naar de inhoud als eerste tabstop, zodat wie met het toetsenbord werkt niet elke keer door je hele kop heen moet.'
};

/* De sleutels heten `overtredingen` en `contrast`, en het zijn ALLEBEI lijsten
   (`Object.values(...)` aan de kant van de keuring). Dat is geen detail: de
   eerste versie hiervan las `ruw.structureel` -- die bestaat niet -- en liep met
   Object.keys() over de contrastLIJST heen. Gevolg: de contrastfout kwam er per
   ongeluk goed uit en de zes structurele controles meldden stilletjes niets. Een
   keuring die zwijgt ziet er precies zo uit als een keuring die niets vindt, en
   dat is de gevaarlijkste soort stilte (LAT-regel 5). */
function naarBevindingen(ruw, bestand) {
  const uit = [];
  const zet = (lijst, ernst) => {
    for (const b of Array.isArray(lijst) ? lijst : []) {
      const waar = (b.waar || []).slice(0, 3);
      uit.push({
        ernst,
        bestand,
        regel: null,
        wat: b.help + (b.aantal > 1 ? ' (' + b.aantal + 'x)' : '') + (waar.length ? ' -- ' + waar.join(', ') : ''),
        hoe: HOE[b.id] || 'Zie TOEGANKELIJK.md voor wat deze regel tegenhoudt.'
      });
    }
  };
  zet(ruw && ruw.overtredingen, 'fout');
  zet(ruw && ruw.contrast, 'fout');
  return uit;
}

function raakvlakBevindingen(res, bestand) {
  if (!res || !res.klein || !res.klein.length) return [];
  return [{
    ernst: 'let-op',
    bestand,
    regel: null,
    wat: res.klein.length + ' raakvlak(ken) kleiner dan ' + raakvlak.GRENS + 'x' + raakvlak.GRENS
      + ' op telefoonformaat -- ' + res.klein.slice(0, 4).join('; '),
    hoe: 'WCAG 2.5.8 vraagt ' + raakvlak.GRENS + 'x' + raakvlak.GRENS + ' CSS-pixels voor alles wat je aanraakt. '
      + 'Vergroot de knop zelf, of geef hem meer padding -- een grotere klikzone telt mee.'
  }];
}

/* De keuring in een pagina draaien. Via evaluate en niet via addScriptTag: dat
   loopt buiten de CSP om, en de cel staat juist op default-src 'none'. Dezelfde
   truc als scripts/a11y.js hem gebruikt. */
const KEUR = '(function(){' + a11y.BRON + '\nreturn window.__a11yKeur()})()';
const RAAK = '(function(){' + raakvlak.BRON + '\nreturn window.__a11yRaakvlak(' + raakvlak.GRENS + ')})()';

module.exports = async function opdrachtA11y(argv, hulp) {
  const map = path.resolve(argv.find(a => !a.startsWith('--')) || '.');
  const kleur = hulp && hulp.kleur;
  const rood = (s) => kleur ? '\x1b[31m' + s + '\x1b[0m' : s;
  const geel = (s) => kleur ? '\x1b[33m' + s + '\x1b[0m' : s;
  const groen = (s) => kleur ? '\x1b[32m' + s + '\x1b[0m' : s;
  const grijs = (s) => kleur ? '\x1b[90m' + s + '\x1b[0m' : s;
  const vet = (s) => kleur ? '\x1b[1m' + s + '\x1b[0m' : s;

  const g = hulp.leesBundel(map);
  if (g.error) { console.error(rood(g.error)); return 2; }

  const pw = laadBrowser();
  if (!pw) {
    /* GEEN BROWSER IS GEEN GOEDKEURING. Zelfde regel als de virusscanner in de
       machinepoort: een controle die niet heeft gedraaid, is geen stilzwijgend
       "ja" (kern/appstore/keuring.js). */
    console.log('\n  ' + geel('niet vast te stellen') + ' -- er is op deze machine geen browser om je app in te renderen.');
    console.log('  ' + grijs('Deze keuring meet je app zoals een lid hem krijgt; zonder browser valt er niets te meten.') + '\n');
    return 3;
  }

  const server = dev([map, '--poort', String(POORT)], Object.assign({}, hulp, { stil: true }));
  const browser = await pw.chromium.launch({ args: ['--no-sandbox'] });
  const bevindingen = [];
  let gemeten = 0;

  try {
    const paginas = g.bestanden.filter(b => b.pad.endsWith('.html')).map(b => b.pad);
    /* Elke HTML in de bundel, niet alleen de startpagina: een app met een tweede
       scherm heeft daar dezelfde knoppen en velden, en die zijn nooit gemeten. */
    for (const pad of paginas) {
      const pagina = await browser.newPage();
      try {
        await pagina.setViewportSize({ width: 390, height: 844 });   // telefoonformaat, voor het raakvlak
        await pagina.goto('http://localhost:' + POORT + '/?start=' + encodeURIComponent(pad), { waitUntil: 'load' });
        await pagina.waitForTimeout(700);
        const kader = pagina.frames().find(f => f.url().includes('/cel/'));
        if (!kader) { console.error(rood('  de cel ging niet open voor ' + pad)); continue; }
        const ruw = await kader.evaluate(KEUR);
        bevindingen.push(...naarBevindingen(ruw, pad));
        const raak = await kader.evaluate(RAAK);
        bevindingen.push(...raakvlakBevindingen(raak, pad));
        gemeten++;
      } catch (e) {
        console.error(rood('  ' + pad + ': de meting kon niet draaien -- ' + String(e.message).split('\n')[0]));
      } finally { await pagina.close(); }
    }
  } finally {
    await browser.close();
    server.close();
  }

  const fouten = bevindingen.filter(b => b.ernst === 'fout');
  const letop = bevindingen.filter(b => b.ernst !== 'fout');

  console.log('\n  ' + vet('Toegankelijkheid') + grijs('  ' + gemeten + ' pagina(s) gemeten, in de cel, op telefoonformaat'));
  console.log('');
  for (const groep of [fouten, letop]) {
    for (const b of groep) {
      console.log('  ' + (b.ernst === 'fout' ? rood('fout') : geel('let op')) + '  ' + vet(b.bestand));
      console.log('        ' + b.wat);
      console.log('        ' + grijs(b.hoe));
    }
  }
  if (bevindingen.length) console.log('');

  /* Het oordeel komt uit velt() van de bestaande keuring en wordt hier niet
     nagerekend -- anders zijn er twee plekken die bepalen wanneer iets faalt. */
  const oordeel = a11y.velt(fouten.length, 0);
  console.log('  structuur en contrast  ' + (oordeel.faalt ? rood(fouten.length + ' overtreding(en)') : groen('in orde')));
  console.log('  raakvlakken            ' + (letop.length ? geel(letop.length + ' onder de grens') : groen('in orde')));
  console.log('  ' + grijs('deze keuring blokkeert niets -- zie de kop van scripts/rtg-a11y.js'));
  console.log('');
  return fouten.length ? 1 : 0;
};

module.exports.naarBevindingen = naarBevindingen;
module.exports.raakvlakBevindingen = raakvlakBevindingen;
module.exports.HOE = HOE;
