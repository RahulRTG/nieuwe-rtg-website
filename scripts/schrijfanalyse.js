#!/usr/bin/env node
/* ============================================================================
   DE SCHRIJFANALYSE -- de tweede bewijslijn, en met opzet alleen als VETO.

   WAAROM HIJ NIET CERTIFICEERT MAAR VETOOT.

   De eerste opzet was: bewijs statisch dat een handler niets schrijft, en
   gebruik dat als tweede bewijslijn onder NOT_APPLICABLE. Dat werkt niet, en de
   meting laat precies zien waarom. Over 4441 routes in de bron, MET de
   modulegrens-resolver erbij:

       979  schrijft aantoonbaar
        49  leest aantoonbaar
      3413  ONBEKEND

   Die 3413 is geen tekortkoming van de analyse maar de vorm van dit huis, en dat
   is zelf de bevinding: de routelaag krijgt zijn modules NIET via `require` maar
   via een contextobject dat in server/opzet/ wordt samengesteld
   (`module.exports = (kern) => { const { bank, save } = kern; ... }`). Een
   resolver die requires volgt kan `bank.bankOverboek()` dus niet vinden. Hij is
   gebouwd en gemeten: 'ja' ging van 938 naar 979, 'onbekend' van 3441 naar 3413.
   Achtentwintig routes op vierenveertighonderd.

   Dat is de prijs van injectie via een gedeelde context -- soepele code,
   blinde statische analyse. Wie deze bak echt wil legen doet dat met een
   RUNTIME-meting (tellen wat een verzoek werkelijk aanraakt), niet met meer
   statisch turen.

   DUS DRAAIEN WE HET OM. De schrijfvormenlijst in ./lib/schrijfanalyse.js is met
   opzet TE RUIM: elke vorm die ook maar zou kunnen schrijven telt mee. Een lijst
   die te veel meldt, is waardeloos om iets mee te bewijzen en uitstekend om iets
   mee te WEERLEGGEN. Zegt hij 'ja', dan staat er een schrijfvorm in de code, en
   dan is 'deze route verandert niets' onhoudbaar -- hoe stil de opslagmeter ook
   bleef.

   Dat is de bevinding die geen van beide methodes alleen kan geven: de idemproef
   zag niets veranderen, de code zegt dat er wel iets kan veranderen. Dan verandert
   er iets dat de meter NIET ziet -- een bestand, een bericht, een teller buiten de
   gemeten collecties -- en dat is exact het gat waar NOT_APPLICABLE om `nagekeken`
   vraagt.

   Draaien:  node scripts/schrijfanalyse.js [--vastleggen]
   ========================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');
const { analyseer, analyseerDiep, maakIndex } = require('./lib/schrijfanalyse');
const { stempel } = require('./lib/stempel');

const WORTEL = path.join(__dirname, '..');
const SERVER = path.join(WORTEL, 'server');
const UITSLAG = path.join(WORTEL, 'SCHRIJFANALYSE.json');
const vastleggen = process.argv.includes('--vastleggen');

/* De projectindex: hij maakt EEN hop over de modulegrens mogelijk. Zie de kop
   van ./lib/schrijfanalyse.js voor de vier regels die voorkomen dat daar een
   'nee' uit komt die niet klopt.

   WAT HIJ IN DIT HUIS OPLEVERT, EERLIJK: bijna niets. Gemeten op 29 augustus
   2026 ging 'ja' van 938 naar 979 en 'onbekend' van 3441 naar 3413. De reden is
   structureel en zelf een bevinding: de routelaag krijgt zijn modules niet via
   `require` maar via EEN CONTEXTOBJECT dat in server/opzet/ wordt samengesteld
   (`module.exports = (kern) => { const { bank, save } = kern; ... }`). Een
   resolver die requires volgt, kan `bank.bankOverboek()` dus niet vinden -- niet
   omdat hij tekortschiet, maar omdat de afhankelijkheid daar niet staat.

   Dat is de prijs van injectie via een gedeelde context: het maakt de code
   soepel en statische analyse blind. Wie deze bak echt wil legen, doet dat met
   een RUNTIME-meting (tellen wat een verzoek werkelijk aanraakt) en niet met
   meer statisch turen. */
const idx = maakIndex(WORTEL);

/* De hele serverboom af. `data/` blijft eruit: dat is runtime en geen bron. */
const gevonden = new Map();
(function loop(map) {
  for (const naam of fs.readdirSync(map)) {
    const p = path.join(map, naam);
    const st = fs.statSync(p);
    if (st.isDirectory()) { if (naam === 'data' || naam === 'node_modules') continue; loop(p); continue; }
    if (!naam.endsWith('.js')) continue;
    let rijen = [];
    try { rijen = analyseerDiep(p, idx, 4); } catch (e) {
      try { rijen = analyseer(fs.readFileSync(p, 'utf8')); } catch (x) { continue; }
    }
    for (const r of rijen) {
      const sleutel = r.methode + ' ' + r.pad;
      /* EEN ROUTE KAN IN MEER DAN EEN BESTAND STAAN (een submodule die op een
         voorvoegsel hangt). De ZWAARSTE uitkomst wint, want dit is een veto:
         zegt een van de plekken 'ja', dan kan er iets veranderen. */
      const bestaand = gevonden.get(sleutel);
      const rang = { ja: 2, onbekend: 1, nee: 0 };
      if (!bestaand || rang[r.schrijft] > rang[bestaand.schrijft]) {
        gevonden.set(sleutel, { schrijft: r.schrijft, waarom: r.waarom, bestand: path.relative(WORTEL, p) });
      }
    }
  }
})(SERVER);

const telling = { ja: 0, nee: 0, onbekend: 0 };
for (const v of gevonden.values()) telling[v.schrijft]++;

/* ---------------------------------------------------------------------------
   DE KRUISING MET DE METING -- waar het veto werkelijk iets doet.
   ------------------------------------------------------------------------- */
let proef = { perRoute: [] };
try { proef = JSON.parse(fs.readFileSync(path.join(WORTEL, 'IDEMPROEF.json'), 'utf8')); } catch (e) {}

const stilMaarSchrijvend = [];
for (const r of proef.perRoute || []) {
  const z = r.zonderSleutel;
  if (!z || !z.opslag) continue;
  const st = z.statussen || [];
  const kaalOk = st.length === 2 && st.every(x => x >= 200 && x < 300);
  const leeg = (d) => !d || !Object.keys(d).length;
  if (!(kaalOk && leeg(z.opslag.d) && leeg(z.opslag.e))) continue;   // alleen de NOT_APPLICABLE-kandidaten
  const a = gevonden.get((r.methode || 'POST') + ' ' + r.pad);
  if (a && a.schrijft === 'ja') {
    stilMaarSchrijvend.push({ route: (r.methode || 'POST') + ' ' + r.pad, bestand: a.bestand, waarom: a.waarom });
  }
}

const rij = (n, wat) => String(n).padStart(6) + '  ' + wat;
console.log('\n=== DE SCHRIJFANALYSE (statisch, als veto) ===\n');
console.log(rij(gevonden.size, 'routes gevonden in de bron'));
console.log(rij(telling.ja, "schrijft aantoonbaar ('ja')"));
console.log(rij(telling.nee, "leest aantoonbaar ('nee')"));
console.log(rij(telling.onbekend, "ONBEKEND -- de aanroep gaat naar een andere module"));
console.log('');
console.log(rij(stilMaarSchrijvend.length,
  'VETO: de opslagmeter zag niets, maar de code KAN schrijven'));
console.log('        -> die routes zijn geen NOT_APPLICABLE-kandidaat meer;');
console.log('           er verandert iets dat de meter niet ziet.');
for (const v of stilMaarSchrijvend.slice(0, 15)) {
  console.log('        ' + v.route);
  console.log('              ' + v.bestand + ' -- ' + v.waarom.slice(0, 110));
}
if (stilMaarSchrijvend.length > 15) console.log('        ... en nog ' + (stilMaarSchrijvend.length - 15));

if (vastleggen) {
  fs.writeFileSync(UITSLAG, JSON.stringify({
    stempel: stempel(),
    uitleg: 'Per route of de code KAN schrijven. Alleen bruikbaar als VETO: de schrijfvormenlijst is ' +
      'met opzet te ruim, dus een "ja" weerlegt wel dat een route niets verandert, maar een "nee" ' +
      'bewijst niet dat hij dat niet doet.',
    grens: 'Deze analyse volgt geen aanroep naar een andere module. Daarom is ONBEKEND de grootste bak, ' +
      'en die telt nergens als "veilig". Een resolver over alle bestanden die er een mist, geeft een ' +
      '"nee" die niet klopt -- en die zou dan als bewijs onder een contract belanden.',
    gemeten: { routes: gevonden.size, ...telling, veto: stilMaarSchrijvend.length },
    veto: stilMaarSchrijvend,
    perRoute: [...gevonden.entries()].map(([route, v]) => ({ route, ...v }))
  }, null, 1) + '\n');
  console.log('\n  SCHRIJFANALYSE.json geschreven.');
} else {
  console.log('\n  (niets weggeschreven -- draai met --vastleggen)');
}
