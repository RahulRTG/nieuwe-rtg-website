#!/usr/bin/env node
/* ============================================================================
   DE WACHTSCHULD -- hoeveel schermtoetsen wachten nog op de klok?

   WAT DIT MEET. `page.waitForTimeout(2500)` in een schermtoets is een gok, en
   een gok die twee kanten op fout gaat: op een rustige machine te lang (de
   suite duurt minuten langer dan nodig) en onder belasting te kort. Dat tweede
   is het ergste, want dan is de uitslag rood zonder dat er iets stuk is -- en
   een suite die af en toe rood geeft zonder dat iemand weet waarop, wordt binnen
   een maand genegeerd. Dat is precies het pad waar TAKEN.md 6.5 over gaat: twee
   keer een halve dag zoeken naar een fout die er niet was.

   WAT ER IN PLAATS VAN KOMT staat in test/helper.js: wachten op een TOESTAND
   (wachtTot, wachtOpTekst, wachtOpZichtbaar, wachtOpVerandering), op het
   ANTWOORD van de server (klikEnWacht), of tot het scherm STIL is
   (wachtOpRust -- geen lopend verzoek en geen hertekening meer). Dat laatste is
   geen verkapte klok: duurt het langer, dan wacht hij langer.

   DE RATEL. KLOKWACHT.json houdt de stand vast. Meer wachten dan opgeschreven:
   de poort gaat dicht (test/klokwacht.test.js). Minder: leg het vast met
   --vastleggen. Zo kan er geen nieuwe klok bij komen zonder dat iemand er iets
   van vindt.

   DE SCHERMKANT STAAT OP NUL, en dat is niet met zoek-vervang gehaald. Alle 162
   wachten zijn per stuk omgezet en elk bestand is daarna gedraaid. Onderweg
   legden ze echte races bloot die de vaste tijd toedekte: twee bladen tegelijk
   in de DOM, een paneel dat ingetypte velden wist bij het hertekenen, een veeg
   die een sprong bleek te zijn, en twee wachten die matchten op tekst die al op
   het scherm stond. De ratel blijft staan omdat een nul makkelijker te
   verliezen is dan te halen.

   EN DIE NUL WAS EEN TIJD LANG TE MOOI. Deze meter kende maar EEN spelling
   (`waitForTimeout`), en meldde daarom nul terwijl er honderdertig `await new
   Promise(r => setTimeout(...))` in de suite stonden -- de kale vorm, en de
   vorm met een eigen naampje ervoor. Toen hij die erbij kreeg bleken er nog
   zeven in de SCHERMtoetsen te staan (die zijn nu ook omgezet, per stuk, elk
   bestand daarna gedraaid) en de rest in de SERVERtoetsen. Die staan sindsdien
   apart geteld; waarom dat twee verschillende vragen zijn, staat bij meet().

   En zelfs de verbrede meter had nog een gat: `const w = (ms) => ...` telde wel
   en `const w = ms => ...` niet, veertig wachten in tien bestanden. Dat gat is
   niet gevonden door te kijken maar doordat de eigen toets van deze meter hem
   met beide vormen voerde. Een meter zonder zulke toets meet zijn eigen
   spelling (LAT.md regel 10).

   Draai:  node scripts/klokwacht.js
           node scripts/klokwacht.js --vastleggen
   ========================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');

const WORTEL = path.join(__dirname, '..');
const TESTMAP = path.join(WORTEL, 'test');
const DOEL = path.join(WORTEL, 'KLOKWACHT.json');
const VASTLEGGEN = process.argv.includes('--vastleggen');

/* Alleen de echte wachten tellen: `waitForTimeout(` in de bron. Een verwijzing
   in een commentaarblok telt niet mee -- anders zou het opschrijven waarom een
   wacht wegging de schuld laten stijgen. */
function zonderCommentaar(bron) {
  return String(bron)
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1');
}

/* DE TELLING ZELF, los van de map waarin hij loopt.

   Hij stond binnen meet(), en daar viel hij niet te toetsen: meet() leest de
   echte testmap, en die staat op NUL. Elke bewering erover blijft dus waar, ook
   als de teller kapot is -- nul in, nul uit. De mutatiemotor zag dat en meldde
   `klokwacht.test.js` als OVERLEEFD, en terecht: een ratel op nul kan niet zien
   of zijn eigen meter nog werkt (LAT.md regel 10).

   Met de telling apart kan een toets hem wel voeren: een echte wacht telt, een
   wacht in commentaar niet, en twee op een regel zijn er twee. */
/* DRIE VORMEN VAN DEZELFDE WACHT, en de ratel zag er lang maar EEN.

   `page.waitForTimeout(2500)` is de bekende. Maar `await new Promise(r =>
   setTimeout(r, 900))` doet precies hetzelfde, en die stond niet in de telling:
   de ratel meldde NUL terwijl er negen van die vorm in de suite stonden. Een
   meter die maar een spelling kent, meet de spelling en niet het probleem. En de
   derde vorm is een eigen hulpje -- `const wacht = ms => new Promise(...)` met
   `await wacht(1500)` eronder -- want een naam geven maakt het geen toestand.

   WAT NIET MEETELT, en dat verschil is het scherpst: een setTimeout die IN DE
   PAGINA wordt gezet als nabootsing. test/memo en test/scanner laten een trage
   verbinding na met `return new Promise(r => setTimeout(() => r(echt(p, o)),
   1200))` in een stub. Daar wacht de toets niet op de klok; hij bootst er een
   trage server mee na, en dat is een fixture. Het onderscheid dat hier telt is
   of de TOETS de belofte await.

   Wat deze telling daardoor NIET ziet: een sleep die binnen een page.evaluate
   staat waarvan de toets de uitkomst afwacht. Die zijn met de hand nagelopen en
   omgezet; er is geen patroon dat ze van een stub onderscheidt. */
function telIn(bron) {
  const s = zonderCommentaar(bron);
  let n = (s.match(/waitForTimeout\s*\(/g) || []).length;
  /* EEN SLEEP ACHTER EEN VOORWAARDE IS GEEN KLOKWACHT. `if (!items.length) await
     new Promise(...)` binnen een begrensde lus is een POLL: hij wacht wel
     degelijk op een toestand, alleen met de hand geschreven in plaats van met
     `polling`. Die eruit houden is geen versoepeling maar het verschil dat deze
     meter juist bewaakt -- anders zou hij mensen aanzetten een werkende poll te
     slopen. */
  const regels = s.split('\n');
  /* WANNEER IS EEN SLEEP EEN POLL? Als hij in een LUS staat.

     Dat is de hele regel, en hij verving twee halve. Eerst stond hier "achter
     een voorwaarde" en "de eerste regel in een lus" -- twee vormen van hetzelfde
     idee, allebei per ongeluk smal. Ze misten `for (...) await even(50);` op een
     regel, en ze misten de tik ONDERAAN een pollus (`for (;;) { kijk(); if
     (klaar) return; await sleep(25); }`), wat precies de vorm is die je krijgt
     als je het netjes doet. De meter telde die dan als schuld, en dat is de
     omgekeerde fout: hij zet mensen aan een werkende poll te slopen.

     Een sleep in een lus is een RETRY-CADANS: hij eindigt als de toestand er
     is, niet als de klok afloopt. Een sleep daarbuiten is een gok. Vandaar een
     eenvoudige haakjesteller die bijhoudt of een omhullend blok door for/while/
     do is geopend; strings gaan er eerst uit, anders telt een accolade in een
     tekst mee. */
  const zonderTekst = regels.map(r => r
    .replace(/\\./g, '')
    .replace(/'[^']*'/g, "''").replace(/"[^"]*"/g, '""').replace(/`[^`]*`/g, '``'));
  const inLus = [];
  {
    const stapel = [];
    for (let i = 0; i < zonderTekst.length; i++) {
      const r = zonderTekst[i];
      inLus[i] = stapel.some(Boolean);
      for (let k = 0; k < r.length; k++) {
        if (r[k] === '{') stapel.push(/\b(for|while|do)\b[^{]*$/.test(r.slice(0, k)));
        else if (r[k] === '}') stapel.pop();
      }
      // een lus die OP DEZE REGEL opengaat, telt ook voor deze regel zelf
      if (!inLus[i]) inLus[i] = stapel.some(Boolean) || /^\s*(for|while)\s*\(/.test(r);
    }
  }
  function isWacht(i) { return !inLus[i]; }
  for (let i = 0; i < regels.length; i++) {
    if (!/await\s+new Promise\([^)]*setTimeout/.test(regels[i])) continue;
    if (isWacht(i)) n++;
  }
  /* De pijl mag zijn parameter met of zonder haakjes hebben: `(ms) =>` en
     `ms =>` zijn dezelfde wacht. Dat scheelde niet weinig -- de eerste versie
     kende alleen de vorm met haakjes, en telde `const w = ms => new
     Promise(...)` dus als nul. De eigen toets van deze meter viel er meteen
     over, en dat is precies waarvoor hij daar staat. */
  for (const m of s.matchAll(/(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>\s*new Promise\([^;]*setTimeout/g)) {
    const aanroep = new RegExp('await\\s+' + m[1] + '\\s*\\(', 'g');
    for (let i = 0; i < regels.length; i++) {
      const raak = (regels[i].match(aanroep) || []).length;
      if (raak && isWacht(i)) n += raak;
    }
  }
  return n;
}

/* TWEE SOORTEN WACHT, en het verschil is geen boekhouding.

   In een SCHERMTOETS (*.e2e.js) is een vaste wacht bijna altijd een gok: er is
   een DOM, en daarin staat een teken waar de bewering echt op rust. Die kant
   hoort op nul te staan, en staat daar ook.

   In een SERVERTOETS (*.test.js) is dat niet vanzelf waar. Daar wacht een deel
   op een ECHTE klok in het product: een sessie die na zoveel seconden verloopt,
   een veegtimer die eens per zoveel draait, het schrijfvenster van de opslag.
   Zo'n wacht is niet te vervangen door "wachten op een toestand", want de
   toestand IS de tijd. Een ander deel is wel gewoon lui. Die twee door elkaar
   tellen zou de nul aan de schermkant verbergen achter een getal dat over iets
   anders gaat, en dat is precies wat er gebeurde toen deze meter nog maar een
   spelling kende: hij meldde NUL terwijl er 92 stonden.

   Dus: twee tellingen, twee ratels. De schermkant mag niet van nul af; de
   serverkant mag alleen krimpen, en elke wacht die daar weggaat wordt met een
   reden weggehaald en niet met zoek-vervang. */
/* DE SCHIFTING APART, om dezelfde reden als telIn: binnen meet() valt hij niet
   te toetsen. De schermkant staat op NUL, dus een mutatie die alles in de
   serverbak gooit verandert daar niets aan -- nul erbij is nul. Precies die
   mutatie overleefde toen dit nog in meet() zat. Met de schifting los kan een
   toets hem voeren met een bak waar wel iets in zit. */
function schift(perBestand) {
  const scherm = {}, server = {};
  let totaal = 0, schermTot = 0, serverTot = 0;
  for (const [naam, n] of Object.entries(perBestand)) {
    totaal += n;
    if (/\.e2e\.js$/.test(naam)) { scherm[naam] = n; schermTot += n; }
    else { server[naam] = n; serverTot += n; }
  }
  return {
    totaal, bestanden: Object.keys(perBestand).length, perBestand,
    scherm: { totaal: schermTot, bestanden: Object.keys(scherm).length, perBestand: scherm },
    server: { totaal: serverTot, bestanden: Object.keys(server).length, perBestand: server }
  };
}

function meet() {
  const perBestand = {};
  for (const naam of fs.readdirSync(TESTMAP).sort()) {
    if (!/\.(e2e|test)\.js$/.test(naam)) continue;
    const n = telIn(fs.readFileSync(path.join(TESTMAP, naam), 'utf8'));
    if (n) perBestand[naam] = n;
  }
  return schift(perBestand);
}

/* WELKE WACHTEN ZIJN GEEN SCHULD MAAR EEN ECHTE KLOK.

   De serverkant is geen boodschappenlijst van luie toetsen. Een deel wacht daar
   op iets dat in het PRODUCT met tijd werkt, en dan IS de tijd de toestand. Die
   staan hier met een reden, zodat het verschil tussen "nog niet nagelopen" en
   "nagelopen en terecht" niet in iemands hoofd zit. Wie een naam hier neerzet,
   zegt: ik heb dit bestand gelezen en dit is de reden.

   Een naam hier haalt de wacht NIET uit de telling -- de ratel blijft hem
   vasthouden. Hij zegt alleen dat er niet meer naar gekeken hoeft te worden. */
const VERANTWOORD = {
  'eventloop.test.js': 'de toets BLOKKEERT de event-loop een aantal ms en wacht tot de meter dat ziet; ' +
    'de tijd is hier de meting zelf en niet een gok erover',
  'journaalschrijf.test.js': 'het journaal spoelt per venster van een seconde; de bewering gaat over dat venster. Sinds 30 augustus 2026 zijn het er drie: de derde bewaakt een AFWEZIGHEID -- na de eerste spoeling mag er binnen het venster GEEN tweede komen. Zonder die wacht keek de toets op het moment van de eerste spoeling, en dat er er dan een geweest is, is per definitie waar: met de rem uit de code bleef hij groen',
  'sloophamer.pg.test.js': 'chaosproef: redis en postgres gaan met opzet neer en weer aan, met verkeer ertussen. ' +
    'De duur van de storing is wat er getoetst wordt',
  'bugjacht.test.js': 'de sleeps zitten in NEPDIENSTEN die trage I/O nabootsen (Postgres, de motor, Stripe); ' +
    'de toets wacht daar niet op de klok, hij bouwt er een fixture mee',
  'dubbeltik.test.js': 'de sleeps zitten in de HANDLER van een nepserver die traag werk nabootst; ' +
    'dat is een fixture, en de duur ervan is wat de dubbeltik moet overleven',
  'duurzaamheid-kill.test.js': 'de kill valt met opzet MIDDEN in een burst betalingen; ' +
    'er is geen toestand voor "we zijn nu halverwege de schrijfstroom", de duur is het onderwerp',
  'alarmweg.test.js': 'bewaakt een AFWEZIGHEID: van vijfentwintig meldingen mag er maar EEN de deur uit, ' +
    'en de wacht is de ruimte waarin een tweede zich zou verraden',
  'pg-snapshot.test.js': 'bewaakt een AFWEZIGHEID: binnen het venster komt er geen tweede snapshot bij, ' +
    'en de wacht is ruim voorbij de flush-cyclus van 150 ms waarin een losgeslagen luisteraar zich zou melden',
  'pg-wachten.test.js': 'bewaakt een AFWEZIGHEID (de server sluit zichzelf NIET af) over een venster dat aan ' +
    'het product hangt: PG_HERKANS_MS staat op 300, dus 1500 ms is een stuk of vijf herkansingen',
  'foutmelder.test.js': 'bewaakt een AFWEZIGHEID: drie keer dezelfde fout wordt EEN bericht, en de wacht is de ' +
    'ruimte waarin een tweede zich zou verraden',
  'schoolkoppel.test.js': 'bewaakt een AFWEZIGHEID: een webhook die niet op deze gebeurtenis is geabonneerd ' +
    'krijgt niets, en de wacht is de ruimte waarin een bezorging zich zou melden',
  'lidfactuur.test.js': 'bewaakt een AFWEZIGHEID: uitgeven aan de balie levert GEEN tweede factuur op, en de ' +
    'facturatiemotor boekt in een losse belofte -- meteen tellen zou alleen zeggen "op dit moment nog een"',
  'speldag.test.js': 'de wacht IS het onderwerp: een oplosser is er in milliseconden doorheen, dus zonder pauze ' +
    'zijn de klok van de server en de nul die de client meestuurt niet uit elkaar te houden',
  'spelsudoku.test.js': 'zelfde als speldag: de verstreken tijd op de server is precies wat de toets tegenover ' +
    'de meegestuurde nul zet; zonder pauze meten allebei de volle basis'
};

function leesVastgelegd() {
  try { return JSON.parse(fs.readFileSync(DOEL, 'utf8')); } catch (e) { return null; }
}

const nu = meet();
const oud = leesVastgelegd();

/* Een stand die er NIET is, is geen nul. Toen deze meter van een telling naar
   twee ging, stond er in het register alleen nog het oude `totaal`; de
   vergelijking liep dan op `undefined` en dat leest als "NaN MEER" of, erger,
   glipt door de ratel heen omdat `x > undefined` altijd onwaar is. Een
   ontbrekend veld is dus een MIGRATIE en wordt als zodanig gemeld. */
function stand(oudTot, nuTot) {
  if (!Number.isFinite(oudTot)) return '(nog niet vastgelegd in deze vorm -- leg vast met --vastleggen)';
  const v = nuTot - oudTot;
  return oudTot + (v === 0 ? ' (gelijk)' : v < 0 ? ' (' + (-v) + ' minder -- leg vast met --vastleggen)'
    : ' (' + v + ' MEER; de poort gaat dicht)');
}

console.log('\n=== DE WACHTSCHULD ===\n');
console.log('  SCHERMTOETSEN (*.e2e.js) -- hier hoort nul te staan');
console.log('    wachten op de klok : ' + nu.scherm.totaal + ' in ' + nu.scherm.bestanden + ' bestanden');
if (oud && oud.gemeten) console.log('    vastgelegd         : ' + stand(oud.gemeten.scherm, nu.scherm.totaal));
for (const [naam, n] of Object.entries(nu.scherm.perBestand).sort((a, b) => b[1] - a[1])) {
  console.log('    ' + String(n).padStart(4) + '  ' + naam);
}
console.log('\n  SERVERTOETSEN (*.test.js) -- deels een ECHTE klok, zie de kop van dit bestand');
console.log('    wachten op de klok : ' + nu.server.totaal + ' in ' + nu.server.bestanden + ' bestanden');
if (oud && oud.gemeten) console.log('    vastgelegd         : ' + stand(oud.gemeten.server, nu.server.totaal));
for (const [naam, n] of Object.entries(nu.server.perBestand).sort((a, b) => b[1] - a[1]).slice(0, 10)) {
  console.log('    ' + String(n).padStart(4) + '  ' + naam);
}
if (nu.server.bestanden > 10) console.log('    ... en nog ' + (nu.server.bestanden - 10) + ' bestanden');

const verantwoordNu = Object.keys(VERANTWOORD).filter(n => nu.server.perBestand[n]);
const verantwoordTot = verantwoordNu.reduce((n, k) => n + nu.server.perBestand[k], 0);
if (verantwoordNu.length) {
  console.log('\n    waarvan NAGELOPEN en terecht: ' + verantwoordTot + ' in ' + verantwoordNu.length + ' bestanden');
  for (const naam of verantwoordNu) console.log('      ' + naam + ' -- ' + VERANTWOORD[naam]);
  console.log('    nog na te lopen: ' + (nu.server.totaal - verantwoordTot));
}

if (VASTLEGGEN) {
  const g = (oud && oud.gemeten) || {};
  const gestegen = (Number.isFinite(g.scherm) && nu.scherm.totaal > g.scherm) ||
    (Number.isFinite(g.server) && nu.server.totaal > g.server);
  if (gestegen) {
    console.error('\nNIET vastgelegd: de schuld is gestegen (scherm ' + g.scherm + ' -> ' +
      nu.scherm.totaal + ', server ' + g.server + ' -> ' + nu.server.totaal +
      '). Een ratel legt geen verslechtering vast; haal de nieuwe wacht eruit of verantwoord hem met de hand.');
    process.exit(1);
  }
  fs.writeFileSync(DOEL, JSON.stringify({
    uitleg: 'Toetsen die op een vaste tijd wachten in plaats van op een toestand. MAG ALLEEN KRIMPEN -- ' +
      'zie test/klokwacht.test.js. Twee tellingen: SCHERM (*.e2e.js) hoort op nul te staan en staat daar; ' +
      'SERVER (*.test.js) wacht deels op een ECHTE klok in het product (een sessie die verloopt, een veegtimer, ' +
      'het schrijfvenster van de opslag) en mag alleen krimpen. Wat ervoor in de plaats komt staat in ' +
      'test/helper.js (wachtTot, wachtOpTekst, wachtOpZichtbaar, wachtOpVerandering, wachtOpRust, ' +
      'wachtOpNetstilte, klikEnWacht).',
    hoe: 'node scripts/klokwacht.js',
    gemeten: {
      scherm: nu.scherm.totaal, schermBestanden: nu.scherm.bestanden,
      server: nu.server.totaal, serverBestanden: nu.server.bestanden,
      totaal: nu.totaal, bestanden: nu.bestanden
    },
    schuld: nu.perBestand,
    verantwoord: VERANTWOORD
  }, null, 1) + '\n');
  console.log('\n  vastgelegd in KLOKWACHT.json');
}

module.exports = { meet, telIn, schift, VERANTWOORD };
