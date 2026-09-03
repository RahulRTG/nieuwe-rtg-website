#!/usr/bin/env node
/* WELK SCHERM ROEPT WELKE ROUTE AAN -- de gedragskant van public/.

   CODEWERELD.json splitste het bronbereik in STRUCTUUR (welke functies wonen
   hier) en GEDRAG (schrijft het, is het bewezen), en dat tweede getal stond voor
   `public/` op 6,6%. Over de schermen weten de registers dus vrijwel niets: een
   vraag als "wat raakt deze wijziging aan de voorkant" was hier niet te
   beantwoorden zonder bestanden te openen.

   Dit register vult die kant, en het doet dat met precies EEN bewering per
   vondst: dit bestand noemt dit API-pad. Niet "roept aan" -- dat zou een
   aanroepgraaf vragen die er niet is.

   WAAROM DE LEXER EN NIET DE PARSER. De 303 bundeldelen in public/apps/<naam>/
   zijn fragmenten die middenin een programma beginnen; die parsen niet (zie
   SYMBOLEN.json). Ze zijn wel te TOKENISEREN, en dat is genoeg: een lexer geeft
   stringliteralen zonder commentaar, en commentaar meetellen zou een
   uitgeschakelde aanroep als een levende tellen. De gegenereerde bundels zelf
   (public/apps/<naam>.js) blijven eruit -- die zijn bouwuitvoer, en de delen
   ernaast zijn de bron. Ze dubbel tellen zou elk pad twee schermen geven.

   TWEE SOORTEN VONDST, en ze worden nooit opgeteld:

     exact        een stringliteraal: '/api/pay/boeken'
     voorvoegsel  een pad dat nog VERDERGAAT. Drie vormen, en de eerste versie
                  van dit script kende er maar een:
                    `/api/rtf/spel/${naam}`   sjabloon met een gat
                    '/api/agenda/' + id       stringoptelling -- het volgende
                                              token is een `+`
                    '/api/office/doc?token='  een pad met een vraagteken; wat
                                              erachter komt is geen route
                  Zonder die tweede en derde stond er 118 "dood pad" in de
                  uitslag waarvan het merendeel gewoon een voorvoegsel was. Een
                  onterechte bevinding kost iemand een middag, en daarna gelooft
                  hij de lijst niet meer.

   DE BEVINDING DIE HIJ OPLEVERT: een exact pad dat GEEN bestaande route is en
   ook geen BASIS van bestaande routes. Die derde stand is er niet voor de
   netheid. Een lexer ziet een pad staan; hij ziet niet of het een doel is of
   een gegeven. In `String(weg).replace('/api/rtf/social', '')` staat het pad
   als gegeven, en dat als dood pad melden is een beschuldiging op grond van een
   bewering die dit register niet doet -- het zegt "noemt", niet "roept aan".
   Daarom drie standen tegenover de routerwaarheid (ROUTEBRON.json):

     bestaat   het is letterlijk een route
     basis     er bestaat minstens een route die ermee begint -- dan is dit een
               stam waar iets achter komt, en geen doel
     onbekend  geen van beide. ALLEEN dit is een bevinding.

   Zonder de stand `basis` stonden er drie "dode paden" in de uitslag waarvan er
   twee gewoon een stam waren.

   Draaien: npm run schermroutes -> SCHERMROUTES.json */
'use strict';
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { lex } = require('./ast/lexer');

const WORTEL = path.join(__dirname, '..');

/* De gegenereerde bundels overslaan: bouwuitvoer, met de delen ernaast als bron. */
let BUNDELS = new Set(), BUNDELVAN = new Map(), bundelInhoud = null;
try {
  const b = require('./bundel');
  BUNDELS = new Set(Object.keys(b.bundels).map(k => 'public/' + k));
  for (const [uit, map] of Object.entries(b.bundels)) BUNDELVAN.set('public/' + map, 'public/' + uit);
  bundelInhoud = naam => String(b.bundel(naam.replace(/^public\//, '')));   // bundel() geeft een Buffer
} catch (e) { /* geen bundelregister */ }
/* Bij welke bundel hoort dit deel? public/shared/werkos/werkos-01.js -> public/shared/werkos.js */
function bundelVoor(rel) {
  for (const [map, uit] of BUNDELVAN) if (rel.startsWith(map + '/')) return uit;
  return null;
}

function bestanden(map, exts) {
  const uit = [];
  (function lees(d) {
    for (const e of fs.readdirSync(path.join(WORTEL, d), { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name === 'dist' || e.name.startsWith('.')) continue;
      const rel = d + '/' + e.name;
      if (e.isDirectory()) lees(rel);
      else if (exts.some(x => e.name.endsWith(x))) uit.push(rel);
    }
  })(map);
  return uit;
}

const IS_API = s => typeof s === 'string' && s.startsWith('/api/');
const ontdoe = s => String(s).replace(/^['"`]|['"`]$/g, '');

/* De scriptblokken uit een HTML-bestand; een scherm draagt zijn aanroepen vaak
   inline. Wat buiten een <script> staat wordt niet gelezen -- een pad in een
   attribuut is geen aanroep.

   DE SLUITTAG MAG MEER DRAGEN DAN WITRUIMTE, en dat is de tweede ronde van
   dezelfde bevinding. Eerst stond hier `<\/script>`, wat `</script >` misliep.
   Daarna `<\/script\s*>`, en CodeQL meldde opnieuw: dat matcht
   `</script\t\n bar>` niet. Ook die vorm staat de HTML-standaard toe -- een
   eindtag hoort op de naam te eindigen bij witruimte, `/` of `>`, en alles
   daarna tot de `>` wordt genegeerd. De browser sluit het blok daar dus wel en
   deze regex niet.

   Het gevolg is elke keer hetzelfde: een scriptblok dat zo eindigt liep door
   tot het VOLGENDE `</script>`, en alles ertussen werd als scriptinhoud
   gelezen. Voor deze meter betekent dat verzonnen aanroepen uit gewone HTML; in
   een filter zou het een gat zijn.

   De vorm die het wel doet: na de naam een vooruitblik op witruimte, `/` of
   `>`, en dan alles tot de sluithaak.

   Dit is een MEETscript en geen sanitizer -- het leest schermen en beslist
   niets -- maar een regex die de standaard niet volgt, meet verkeerd, en dat is
   hier reden genoeg. */
function scriptsUit(html) {
  const uit = [];
  for (const m of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script(?=[\s/>])[^>]*>/gi)) uit.push(m[1]);
  return uit;
}

function paden(bron) {
  const exact = new Set(), voorvoegsels = new Set();
  let tokens;
  try { tokens = lex(bron); } catch (e) { return null; }          // niet te lezen: reden, geen stilte
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.type === 'string') {
      const v = ontdoe(t.value);
      if (!IS_API(v)) continue;
      const volgende = tokens[i + 1];
      const gaatVerder = (volgende && volgende.type === 'lees' && volgende.value === '+') || v.endsWith('/') || v.includes('?');
      if (gaatVerder) voorvoegsels.add(v); else exact.add(v);
    }
    else if (t.type === 'template' && t.value && Array.isArray(t.value.quasis)) {
      const eerste = t.value.quasis[0];
      if (IS_API(eerste)) {
        /* Een sjabloon ZONDER gaten is gewoon een exact pad. Met gaten is de
           kop een voorvoegsel en nooit een route. */
        if (!t.value.exprs || t.value.exprs.length === 0) exact.add(eerste);
        else voorvoegsels.add(eerste);
      }
    }
  }
  return { exact: [...exact].sort(), voorvoegsels: [...voorvoegsels].sort() };
}

const perScherm = [], nietGelezen = [], teLezenViaBundel = new Set();
for (const rel of bestanden('public', ['.js', '.html'])) {
  if (BUNDELS.has(rel)) continue;
  const ruw = fs.readFileSync(path.join(WORTEL, rel), 'utf8');
  const brokken = rel.endsWith('.html') ? scriptsUit(ruw) : [ruw];
  const exact = new Set(), voor = new Set();
  let mislukt = 0;
  for (const brok of brokken) {
    const p = paden(brok);
    if (!p) { mislukt++; continue; }
    for (const x of p.exact) exact.add(x);
    for (const x of p.voorvoegsels) voor.add(x);
  }
  if (mislukt && !exact.size && !voor.size) {
    /* Een bundeldeel kan middenin een sjabloon zijn geknipt; dan stopt de lexer
       terecht. De inhoud verdwijnt daarmee niet uit de meting: hij wordt uit de
       SAMENGESTELDE bundel gehaald en daar ook aan toegeschreven, met de reden
       erbij. Stil overslaan zou hier drie bestanden onzichtbaar maken. */
    const bundel = bundelVoor(rel);
    nietGelezen.push({ bestand: rel,
      reden: bundel ? 'bundeldeel, geknipt middenin een sjabloon; gelezen via ' + bundel : 'de lexer kwam er niet doorheen',
      viaBundel: bundel || null });
    if (bundel) teLezenViaBundel.add(bundel);
    continue;
  }
  if (!exact.size && !voor.size) continue;
  perScherm.push({ bestand: rel, exact: [...exact].sort(), voorvoegsels: [...voor].sort(), deelsOnleesbaar: mislukt > 0 || undefined });
}

/* De bundels waarvan een deel onleesbaar was, alsnog in hun geheel lezen. */
for (const bundel of teLezenViaBundel) {
  if (!bundelInhoud) break;
  let p = null;
  try { p = paden(bundelInhoud(bundel)); } catch (e) { p = null; }
  const aantal = p ? p.exact.length + p.voorvoegsels.length : null;
  /* De uitslag van die inhaalronde hoort bij de rij die zegt dat er iets niet
     gelezen is -- anders leest "gelezen via de bundel" als een belofte dat er
     iets is teruggehaald, terwijl het antwoord ook nul kan zijn (en dat is het
     hier: de werkos-bundel noemt geen enkel API-pad). */
  for (const rij of nietGelezen) if (rij.viaBundel === bundel) rij.viaBundelGevonden = aantal;
  if (!p || !aantal) continue;
  perScherm.push({ bestand: bundel, exact: p.exact, voorvoegsels: p.voorvoegsels, gelezenAlsBundel: true });
}

/* De routerwaarheid ernaast: welke exacte paden bestaan echt? */
let bekend = null, routebronStempel = null;
try {
  const rb = JSON.parse(fs.readFileSync(path.join(WORTEL, 'ROUTEBRON.json'), 'utf8'));
  /* `alleRoutes` en NIET `perRoute`: die tweede is gefilterd op "er is een
     bestand gevonden", en dat is geen uitspraak over bestaan. Deze regel stond
     er eerst fout, en verklaarde /api/instant-reality/event dood terwijl de
     router hem aanbiedt -- zijn routebestand staat alleen op een enkele regel,
     dus de bronindex vond hem niet. */
  const rauw = rb.alleRoutes || (rb.perRoute || []).map(r => r.route);
  bekend = new Set(rauw.map(r => r.split(' ').slice(1).join(' ')));
  routebronStempel = rb.stempel || null;
} catch (e) { /* geen routerwaarheid: dan wordt er niets dood verklaard */ }

const naarScherm = new Map();
const dood = [], basis = new Set();
const isBasis = p => bekend && [...bekend].some(r => r.startsWith(p + '/'));
const basisCache = new Map();
const basisVan = p => { if (!basisCache.has(p)) basisCache.set(p, isBasis(p)); return basisCache.get(p); };
for (const s of perScherm) for (const p of s.exact) {
  if (!naarScherm.has(p)) naarScherm.set(p, []);
  naarScherm.get(p).push(s.bestand);
  if (!bekend || bekend.has(p)) continue;
  if (basisVan(p)) { basis.add(p); continue; }
  dood.push({ pad: p, scherm: s.bestand });
}

let commit = 'onbekend';
try { commit = execSync('git rev-parse --short HEAD', { cwd: WORTEL }).toString().trim(); } catch (e) { /* geen git */ }

const uit = {
  /* Wat voor SOORT bewering doet dit register? `index` = structuur en
     relaties (waar woont wat, wat hangt met wat samen). `meting` = een
     uitspraak over gedrag (schrijft het, klopt het, is het bewezen). Het
     verschil is niet cosmetisch: een index noemt bijna alles en maakt elke
     dekkingsvraag triviaal waar, dus scripts/codewereld.js telt hem apart. */
  soort: 'index',
  uitleg: 'Welk bestand in public/ noemt welk API-pad. Gelezen met de lexer (dus zonder commentaar) zodat ook de bundeldelen meetellen, die niet parsen. De bewering per vondst is "dit bestand noemt dit pad" -- niet "roept het aan".',
  stempel: { op: new Date().toISOString().slice(0, 10), commit },
  grens: 'Een voorvoegsel uit een sjabloon met een gat is GEEN route en wordt nooit tegen de routelijst gelegd. Exacte paden wel: een exact pad dat niet bestaat, is een dood pad.',
  gemetenTegen: bekend ? { register: 'ROUTEBRON.json', stempel: routebronStempel, bekendePaden: bekend.size }
    : { register: null, reden: 'ROUTEBRON.json ontbreekt; er is dus niets dood verklaard' },
  gemeten: {
    schermenMetPad: perScherm.length,
    nietGelezen: nietGelezen.length,
    exactePaden: naarScherm.size,
    verwijzingen: perScherm.reduce((n, s) => n + s.exact.length, 0),
    voorvoegsels: new Set(perScherm.flatMap(s => s.voorvoegsels)).size,
    basisPaden: bekend ? basis.size : 'niet vast te stellen',
    doodPad: bekend ? new Set(dood.map(d => d.pad)).size : 'niet vast te stellen',
    doodPadVerwijzingen: bekend ? dood.length : 'niet vast te stellen'
  },
  basisPadLijst: [...basis].sort(),
  doodPad: dood.slice(0, 60),
  nietGelezen,
  perPad: [...naarScherm].sort((a, b) => b[1].length - a[1].length).map(([pad, schermen]) => ({ pad, schermen: schermen.sort(), aantal: schermen.length })),
  perScherm
};

fs.writeFileSync(path.join(WORTEL, 'SCHERMROUTES.json'), JSON.stringify(uit, null, 1) + '\n');
const g = uit.gemeten;
console.log('SCHERMROUTES.json geschreven');
console.log('  schermen met een API-pad', g.schermenMetPad, '| niet gelezen:', g.nietGelezen);
console.log('  exacte paden            ', g.exactePaden, 'over', g.verwijzingen, 'verwijzingen |', g.voorvoegsels, 'voorvoegsels (gaat verder)');
console.log('  basis (stam van echte routes)', g.basisPaden, '-- geen doel, dus geen bevinding');
console.log('  dood pad                ', g.doodPad, 'paden,', g.doodPadVerwijzingen, 'verwijzingen');
for (const d of dood.slice(0, 12)) console.log('   ', d.pad, '<-', d.scherm);
