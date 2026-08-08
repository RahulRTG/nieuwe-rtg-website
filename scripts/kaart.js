#!/usr/bin/env node
/* ============================================================================
   DE KAART -- een architectuuroverzicht dat niet kan verouderen.

   HET PROBLEEM. Dit huis heeft 1253 servermodules, 2384 endpoints en 68
   schermtoetsen. Niemand houdt dat in zijn hoofd, en dat is geen kritiek op
   iemands hoofd: het is een feit over de omvang. De bus factor is een, en de
   meetkast compenseert dat verrassend ver -- maar een meetkast vertelt je of er
   iets stuk is, niet WAAR de dingen staan. Wie hier nieuw binnenkomt (of
   terugkomt na een half jaar) heeft een kaart nodig.

   WAAROM GEGENEREERD EN NIET GESCHREVEN. Een handgeschreven architectuurdocument
   is binnen twee maanden onwaar, en dan is het erger dan geen document: het
   stuurt iemand met vertrouwen de verkeerde kant op. Dit bestand komt uit de
   code. De domeinen komen uit opzet/routes.js, de endpoints uit
   scripts/lib/routes.js (dezelfde scanner die de dekking en de dwaler
   gebruiken), de grenzen uit scripts/grenzen.js. Geen tweede waarheid
   (LAT.md regel 4).

   EN HET KAN NIET VEROUDEREN, want `node scripts/kaart.js --controle` genereert
   opnieuw en vergelijkt met wat er op schijf staat. Regel 40 in scripts/check.js
   draait die controle. Verschuift de code, dan wordt de keuring rood tot iemand
   de kaart bijwerkt -- en bijwerken is een commando, geen schrijfwerk.

   GEEN DATUM IN DE UITVOER, met opzet. Een tijdstempel zou de controle elke dag
   laten zakken, en dan wordt de regel binnen een week uitgezet. Wanneer de kaart
   voor het laatst is bijgewerkt staat in de git-historie, en die liegt niet.

   Draai: node scripts/kaart.js              (schrijft ARCHITECTUUR.md)
          node scripts/kaart.js --controle   (zakt als de kaart achterloopt)
          node scripts/kaart.js --uit        (naar stdout, schrijft niets)
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');

const WORTEL = path.join(__dirname, '..');
const DOEL = path.join(WORTEL, 'ARCHITECTUUR.md');

const lees = (p) => { try { return fs.readFileSync(path.join(WORTEL, p), 'utf8'); } catch (e) { return ''; } };
function tel(map, filter) {
  let n = 0;
  (function loop(m) {
    let namen; try { namen = fs.readdirSync(m); } catch (e) { return; }
    for (const naam of namen) {
      const p = path.join(m, naam);
      let st; try { st = fs.statSync(p); } catch (e) { continue; }
      if (st.isDirectory()) { if (!/^(node_modules|\.git|data|dist)$/.test(naam)) loop(p); }
      else if (filter.test(naam)) n++;
    }
  })(path.join(WORTEL, map));
  return n;
}

/* De domeinen uit de bron en niet uit een lijst hier: opzet/routes.js is de
   plek waar het besluit valt welke domeinen dit proces kan bedienen. */
function domeinenUitBron() {
  const m = /const ALLE_DOMEINEN = \[([^\]]*)\]/.exec(lees('server/opzet/routes.js'));
  if (!m) throw new Error('ALLE_DOMEINEN niet gevonden in server/opzet/routes.js; de kaart zou dan gokken');
  return m[1].split(',').map(s => s.trim().replace(/^'|'$/g, '')).filter(Boolean);
}

/* De opstartlagen, in de volgorde waarin start.js ze aanroept. De volgorde IS
   gedrag (zie de kop van opzet/kernlaag1.js), dus hij hoort op de kaart. */
function lagenUitBron() {
  const uit = [];
  for (const bestand of ['server/server.js', 'server/opzet/start.js']) {
    const bron = lees(bestand);
    for (const m of bron.matchAll(/require\('\.(?:\/opzet)?\/([a-z0-9-]+)'\)/g)) {
      if (!uit.includes(m[1])) uit.push(m[1]);
    }
  }
  return uit;
}

function bouw() {
  const { alleRoutes } = require('./lib/routes');
  const grenzen = require('./grenzen').meet();
  const routes = alleRoutes();
  const domeinen = domeinenUitBron();

  /* Endpoints per domein op het BESTANDSPAD en niet op het padvoorvoegsel. Dat
     was de eerste poging en die loog: `social` kwam op nul endpoints uit omdat
     zijn routes onder /api/salon/ en /api/member/ hangen, en `zakelijk` kreeg er
     dertien terwijl grenzen.js daar nul bereik meet. Een domein is wat
     opzet/routes.js optuigt -- server/routes/<domein> -- en niet wat het pad
     suggereert. Zo staat het ook in scripts/grenzen.js, en dat moet dezelfde
     indeling zijn, anders vertellen de twee tabellen op deze kaart een ander
     verhaal. */
  const perDomein = new Map(domeinen.map(d => [d, { endpoints: 0, ongewaakt: 0, bestanden: new Set() }]));
  let buitenDomein = 0;
  const domeinVanBestand = (b) => {
    const m = /^server\/routes\/([a-z0-9-]+)(\/|\.js$)/.exec(b);
    return m && perDomein.has(m[1]) ? m[1] : null;
  };
  for (const r of routes) {
    const d = domeinVanBestand(r.bestand);
    if (!d) { if (r.pad.startsWith('/api/')) buitenDomein++; continue; }
    const v = perDomein.get(d);
    v.endpoints++;
    v.bestanden.add(r.bestand);
    if (!r.bewakers.length) v.ongewaakt++;
  }

  // bereik per domein uit dezelfde meting als de ratel
  const bereik = new Map((grenzen.domeinen || []).map(x => [x.domein, x.bereik]));

  const r = [];
  const p = (s) => r.push(s === undefined ? '' : s);

  p('# De architectuur van RTG');
  p('');
  p('**Dit bestand is GEGENEREERD** door `node scripts/kaart.js`. Wijzig het niet met de');
  p('hand: regel 40 van `npm run keuring` genereert opnieuw en vergelijkt, dus een');
  p('handmatige wijziging wordt bij de eerste keuring rood. Verschuift de code, dan');
  p('draai je het commando en commit je de nieuwe kaart mee.');
  p('');
  p('Er staat met opzet **geen datum** in dit bestand: een tijdstempel zou de controle');
  p('elke dag laten zakken, en dan wordt de regel binnen een week uitgezet. Wanneer de');
  p('kaart voor het laatst is bijgewerkt, staat in de git-historie.');
  p('');
  p('Waarom dit bestaat: 1253 servermodules en ' + routes.length + ' endpoints houdt niemand in zijn hoofd.');
  p('Een meetkast vertelt je of er iets stuk is, niet waar de dingen staan.');
  p('');
  p('---');
  p('');
  p('## 1. De maat van het huis');
  p('');
  p('| Wat | Aantal |');
  p('|---|---|');
  p('| API-endpoints | ' + routes.length + ' |');
  p('| servermodules (`server/**/*.js`) | ' + tel('server', /\.js$/) + ' |');
  p('| routebestanden (`server/routes/**`) | ' + tel('server/routes', /\.js$/) + ' |');
  p('| kernmodules (`server/kern/**`) | ' + tel('server/kern', /\.js$/) + ' |');
  p('| schermen (`public/**/*.html`) | ' + tel('public', /\.html$/) + ' |');
  p('| gedeelde browsermodules (`public/shared/*.js`) | ' + tel('public/shared', /\.js$/) + ' |');
  p('| toetsbestanden (`test/*.test.js`) | ' + tel('test', /\.test\.js$/) + ' |');
  p('| schermtoetsen (`test/*.e2e.js`) | ' + tel('test', /\.e2e\.js$/) + ' |');
  p('');
  p('## 2. De weg van een verzoek');
  p('');
  p('De voordeurketen staat in `server/opzet/verzoekketen.js` en de volgorde daarin is');
  p('gedrag, geen smaak. Van buiten naar binnen:');
  p('');
  p('1. **`schildwacht`** -- het schild en De Wacht (quarantaine, load shedding).');
  p('2. **`koppen`** -- de security-headers en de terugval-CSP.');
  p('3. **`poortwachters`** -- snelheidsremmen, functieschakelaars, scan-net, statische bestanden.');
  p('4. **`liegpoort`** -- inert zonder `RTG_LIEG`; laat een groep endpoints met opzet liegen zodat je ziet of een toets dat merkt.');
  p('5. **`lijfpoort`** -- webhooks vóór `express.json`, dieptebewaking, het zaakdoos-journaal.');
  p('6. **de routers** -- per domein opgehangen door `server/opzet/routes.js`.');
  p('7. **`afsluiters`** -- de 404 en de centrale foutafhandeling.');
  p('');
  p('## 3. De opstartlagen');
  p('');
  p('`server/server.js` bouwt één object `kern` en geeft dat aan alles. De samenstelling');
  p('is geknipt **op positie en niet op thema**, want de bouwvolgorde is gedrag; de volle');
  p('uitleg staat alleen in `server/opzet/kernlaag1.js` en de andere lagen wijzen daarheen.');
  p('');
  p('Aangeroepen lagen, in volgorde:');
  p('');
  p('```');
  for (const l of lagenUitBron()) p(l);
  p('```');
  p('');
  p('## 4. De domeinen');
  p('');
  p('Acht domeinen, uit `server/opzet/routes.js`. Met `RTG_DOMAINS=member,social` draait');
  p('een proces alleen die domeinen; een gateway (`server/poort.js`) stuurt de');
  p('padvoorvoegsels dan naar het juiste proces. **Die belofte is nog niet waargemaakt:**');
  p('zie §5 -- er zijn nog ' + grenzen.kernGedeeld + ' kern-namen die meer dan één domein aanraakt.');
  p('');
  p('| Domein | Endpoints | Routebestanden | Zonder bewaker | Bereik in kern |');
  p('|---|---|---|---|---|');
  for (const d of domeinen) {
    const v = perDomein.get(d);
    p('| `' + d + '` | ' + v.endpoints + ' | ' + v.bestanden.size + ' | ' + v.ongewaakt +
      ' | ' + (bereik.get(d) || 0) + ' |');
  }
  p('');
  p('"Zonder bewaker" betekent: geen `auth`/`supplierAuth`/`officeAuth`-achtige middleware');
  p('op de regel zelf. Dat is niet hetzelfde als onbeveiligd -- regel 28 van de keuring eist');
  p('per route een poort **of** een plek op de publieke lijst met reden. Deze kolom is een');
  p('wegwijzer, geen verdict.');
  p('');
  p('Daarnaast ' + buitenDomein + ' `/api/`-endpoints buiten deze acht: de infra (health, stream, push,');
  p('cluster, translate), de foundation-mount, SSO, SCIM, onboarding en de losse takken');
  p('(school, bank, pay, bestanden, agenda). Die draaien altijd mee.');
  p('');
  p('## 5. De gedeelde kern, en wat er niet in hoort');
  p('');
  p('| Meting | Nu |');
  p('|---|---|');
  p('| kern-namen die routes aanraken | ' + grenzen.kernBreedte + ' |');
  p('| daarvan door **meer dan één** domein (de echte koppeling) | ' + grenzen.kernGedeeld + ' |');
  p('| daarvan door precies één domein | ' + grenzen.alleenEenDomein + ' |');
  p('| breedste enkele routebestand | ' + grenzen.kernBreedsteBestand + ' namen |');
  p('| gepakt uit kern en nergens gebruikt | ' + grenzen.kernOngebruikt + ' |');
  p('');
  p('Dat derde getal is de opening: ' + Math.round(100 * grenzen.alleenEenDomein / grenzen.kernBreedte) +
    '% van wat er in de gedeelde zak zit, wordt door');
  p('precies één domein gebruikt. Dat hoort geen gedeelde kern te zijn maar bezit van dat');
  p('domein. Alle vijf getallen staan in `NORM.json` aan een ratel en mogen alleen zakken.');
  p('');
  p('**De echte interface** -- namen die vijf of meer domeinen aanraken. Dit is wat een');
  p('domein van buiten nodig heeft, en dus wat er zou moeten overblijven:');
  p('');
  p('```');
  {
    const namen = (grenzen.echteKern || []).map(x => x.naam + '(' + x.domeinen + ')');
    let regel = '';
    for (const n of namen) {
      if ((regel + ' ' + n).length > 88) { p(regel); regel = n; }
      else regel = regel ? regel + ' ' + n : n;
    }
    if (regel) p(regel);
  }
  p('```');
  p('');
  p('**De breedste routebestanden** -- hier zou je beginnen:');
  p('');
  p('| Namen uit kern | Bestand |');
  p('|---|---|');
  for (const b of (grenzen.breedsteBestanden || []).slice(0, 10)) {
    p('| ' + b.bereik + ' | `' + b.bestand + '` |');
  }
  p('');
  p('## 6. Waar de waarheid staat');
  p('');
  p('| Vraag | Waar |');
  p('|---|---|');
  p('| Hoe start ik dit, hoe zet ik het live, hoe herstel ik het? | `RUNBOOK.md` |');
  p('| Hoe hoort er code geschreven te worden? | `LAT.md` (negen regels, elk uit een echte fout) |');
  p('| Welke merkregels gelden? | `CLAUDE.md` |');
  p('| Waar bouwen we naartoe, en wat staat daarbij in de weg? | `PLATFORM.md` |');
  p('| Wat moet er nog, en welke schuld staat er open? | `TAKEN.md` |');
  p('| Welke toets bewijst wat? | `BEWIJS.md` |');
  p('| Wat is er gemeten, en welke kant mag het op? | `NORM.json` + `npm run norm` |');
  p('| Welke endpointgroepen kunnen liegen zonder dat een toets omvalt? | `LEUGENS.json` + `npm run leugens` |');
  p('| Wat draait er in productie en wat moet er nog geregeld? | `PRODUCTION.md` |');
  p('| Wat doet de code technisch? | `README.md` |');
  p('');
  p('## 7. Hoe je dit bestand bijwerkt');
  p('');
  p('```');
  p('node scripts/kaart.js              # opnieuw genereren');
  p('node scripts/kaart.js --controle   # zakt als de kaart achterloopt (regel 40)');
  p('```');
  return r.join('\n') + '\n';
}

if (require.main === module) {
  const tekst = bouw();
  if (process.argv.includes('--uit')) { process.stdout.write(tekst); process.exit(0); }
  if (process.argv.includes('--controle')) {
    const opSchijf = fs.existsSync(DOEL) ? fs.readFileSync(DOEL, 'utf8') : null;
    if (opSchijf === tekst) { console.log('ARCHITECTUUR.md is bij.'); process.exit(0); }
    console.error(opSchijf === null
      ? 'ARCHITECTUUR.md bestaat niet. Draai: node scripts/kaart.js'
      : 'ARCHITECTUUR.md loopt achter op de code. Draai: node scripts/kaart.js');
    process.exit(1);
  }
  fs.writeFileSync(DOEL, tekst);
  console.log('ARCHITECTUUR.md geschreven (' + tekst.split('\n').length + ' regels).');
}

module.exports = { bouw, DOEL };
