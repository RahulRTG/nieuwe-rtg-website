#!/usr/bin/env node
/* ============================================================================
   DE DELTAPOORT -- de norm geldt voor NIEUW werk meteen, niet gemiddeld.

   WAT DEZE POORT TOEVOEGT AAN DE RATEL, EN WAT NIET.

   Niet: de regels. Elke regel hieronder dient een meter die in NORM.json al
   ratelt, en die ratel draait bij elke push. Wie hier iets zoekt wat de norm
   niet meet, vindt het niet, en dat is met opzet -- een poort met een eigen
   mening bewaakt iets wat de ratel niet ziet, en dan lopen ze uiteen (regel 4).

   Wel: het SALDEREN. Elke meter in NORM.json is een som over de hele codebase,
   en een som verrekent. Vijf inline stijlattributen erbij in het ene bestand en
   zes eruit in het andere is een som die DAALT: de ratel juicht, en het nieuwe
   bestand houdt zijn vijf. Zo blijft nieuw werk precies zo slecht als oud werk
   mag zijn, terwijl elke meter de goede kant op wijst. Precies die verrekening
   is hier eerder al een keer duur geweest: keuringBeter telde drie
   onvergelijkbare dingen op, en een daling in de ene groep maskeerde de
   stijging in de andere (zie de uitleg bij die meter in scripts/norm.js).

   Deze poort weigert de verrekening. Hij kijkt per BESTAND, en hij kijkt naar
   het verschil met de vorige versie.

   Deze poort meet daarom niet het geheel maar het VERSCHIL, en hanteert twee
   verschillende latten:

     EEN NIEUW BESTAND staat op de norm. Niet "niet slechter dan het
     gemiddelde" maar op de waarde waar de meter naartoe moet: nul inline
     stijlattributen, onder de omvanggrens, geen zelfpoortende toets, elk
     endpoint met een toets. Wie een bestand vanaf nul schrijft, heeft geen
     erfenis om zich achter te verschuilen.

     EEN AANGERAAKT BESTAND mag niet zakken. Stond er al twaalf keer style="
     in, dan mogen het er na jouw wijziging twaalf zijn of minder, nooit
     dertien. De erfenis hoef je niet op te ruimen om iets te mogen wijzigen --
     dat zou elke wijziging aan server/server.js verbieden -- maar je mag hem
     ook niet vergroten.

   Daarmee kan het geheel alleen nog dalen. Dat is het verschil tussen "niet
   slechter worden" en "beter worden", en het is de enige van de vier
   mechanismen die stijging rekenkundig afdwingt in plaats van hoopt.

   ELKE REGEL HIER DIENT EEN METER UIT NORM.json EN VERZINT NIETS EIGENS. Zou
   deze poort een eigen mening hebben, dan bewaakt hij iets wat de ratel niet
   meet en lopen de twee uiteen (LAT.md regel 4). Het veld `meter` bij elke
   regel hieronder zegt welke; wat de regel telt komt uit dezelfde functie als
   waarmee de meter telt.

   WAT ER GEBEURT ALS DE BASIS ONBEKEND IS. Dan zakt hij (exitcode 2). Een
   poort die zonder vergelijkingspunt "in orde" meldt, is de vorm van onwaarheid
   waar LAT.md regel 3 over gaat: niet gemeten is geen groen. In CI betekent dat
   `fetch-depth: 0` bij de checkout, want zonder historie is er geen basis.

   WAT HIER BEWUST NIET STAAT: een controle dat een nieuwe meter geijkt is.
   Die verleiding was er -- het is de duurst verdiende nul in NORM.json -- maar
   scripts/check.js regel 35 eist al dat elke meter in de registratie van
   test/meterijk.test.js staat, en de ratel `metersOngeijkt` (nul, alleen
   omlaag) eist al dat het een proef is en geen reden. Twee handhavers hebben
   die waarheid vast; een derde kopie maakt hem niet steviger maar losser,
   want kopieen lopen uiteen en dan is niet meer te zeggen welke gelijk heeft.

   WAT DEZE POORT NIET VANGT, en dat hoort erbij te staan:

     - Een uitzondering ZONDER `wat` dekt elke bevinding van die regel op dat
       pad af, niet alleen de bevinding waar hij voor bedoeld was. Dat is met
       opzet grof (een regelnummer verschuift bij elke wijziging eronder), maar
       het betekent wel dat een uitzondering voor een inline stijlattribuut ook
       het tweede en derde afdekt. De vervaldatum is wat dat begrenst.
     - Hij kijkt naar het VERSCHIL met de basis. Een bestand dat al slecht was en
       niet wordt aangeraakt, blijft ongemoeid -- dat is de bedoeling, en het
       betekent dat de erfenis alleen daalt als er aan gewerkt wordt.
     - Hij keurt vier eigenschappen, geen kwaliteit. Een nieuw bestand kan aan
       alle vier voldoen en toch slecht zijn. Daar gaan de keuring, de toetsen
       en regel 2 over.

   Draai:  node scripts/deltapoort.js
           node scripts/deltapoort.js --basis origin/main
           node scripts/deltapoort.js --toon            (ook wat er goed ging)
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const cp = require('child_process');

/* DE WORTEL IS VERZETBAAR, EN DAT IS EEN HANDHAVER EN GEEN GEMAK.

   Deze poort keurt een wijziging in een git-repository. Om te bewijzen dat hij
   werkelijk bijt -- LAT.md regel 2, een toets die je niet hebt zien zakken is
   geen toets -- moet hij losgelaten kunnen worden op een repository met een
   bekend-foute wijziging erin. Op DEZE repository kan dat niet: daar zou de
   proef zijn eigen bron moeten bevuilen en dat is precies de val waar
   test/meterijk.test.js een halve bladzijde over schrijft (een kill in het
   verkeerde venster laat de rommel staan).

   Dus mag test/deltapoort.test.js hem naar een wegwerprepo wijzen. Wat er wordt
   meegegeven is de PLEK en niet de uitkomst: lezen, diffen, tellen en oordelen
   lopen nog volledig door de poort zelf. */
const WORTEL = process.env.RTG_DELTA_WORTEL
  ? path.resolve(process.env.RTG_DELTA_WORTEL)
  : path.join(__dirname, '..');
const K = { rood: '\x1b[31m', groen: '\x1b[32m', geel: '\x1b[33m', grijs: '\x1b[2m', blauw: '\x1b[36m', reset: '\x1b[0m', vet: '\x1b[1m' };

const { telInlineStijl, schoon } = require('./norm.js');
const { GRENS } = require('./lib/omvang');
const { routesInBron } = require('./lib/routes');
const { maakZoeker } = require('./lib/routedekking');
const { zonderCommentaar } = require('./lib/bron');
const V = require('./verstrengeling');
const { PATRONEN: INGANGPATRONEN } = require('./wekkers');
const VERKLAARDE_INGANGEN = new Set(require('./lib/wekker-verklaringen').map(v => v.bestand));

const arg = (naam, std) => { const i = process.argv.indexOf(naam); return i > 0 ? process.argv[i + 1] : std; };
const TOON = process.argv.includes('--toon');

/* ---------------------------------------------------------------- de basis */

const { bepaalBasis: zoekBasis, versieBij, maakGit } = require('./lib/basis');
const git = maakGit(WORTEL);

/* De basisbepaling woont in scripts/lib/basis.js: scripts/normverval.js stelt
   dezelfde vraag, en twee antwoorden op "waartegen vergelijken we" is precies
   de dubbele waarheid uit regel 4. */
function bepaalBasis() { return zoekBasis(WORTEL, arg('--basis', process.env.RTG_BASIS)); }

/* ------------------------------------------------- de bestanden en hun twee versies */

function gewijzigdeBestanden(basis) {
  const rauw = git(['diff', '--name-status', '-M', basis, '--']);
  const uit = [];
  for (const regel of rauw.split('\n')) {
    if (!regel.trim()) continue;
    const delen = regel.split('\t');
    const status = delen[0][0];
    if (status === 'D') continue;                       // weg is weg; daar valt niets aan te keuren
    /* Bij een hernoeming staat de oude naam in kolom twee en de nieuwe in drie.
       De oude naam is nodig om de VORIGE versie op te halen -- zonder dat telt
       een hernoemd bestand als nieuw, en dan zou elke hernoeming van een oud
       bestand plots de volle nieuwbouwlat krijgen. */
    const oud = status === 'R' ? delen[1] : delen[1];
    const nieuw = status === 'R' ? delen[2] : delen[1];
    uit.push({ status, oudPad: status === 'A' ? null : oud, pad: nieuw });
  }
  /* NOG NIET TOEGEVOEGDE BESTANDEN TELLEN MEE, en dat is geen netheid maar een
     gat dat bij de eerste draai van deze poort meteen viel: `git diff` toont
     alleen wat git al kent, dus drie zojuist geschreven bestanden -- inclusief
     dit -- gingen er stilzwijgend langs. Juist die vallen onder de zwaarste
     lat (een nieuw bestand staat op de norm), en juist die zag hij niet.

     In CI maakt het niets uit, want daar is alles gecommit. Op de eigen machine
     maakt het alles uit: daar draai je de poort VOORDAT je commit, en dan is
     precies het nieuwe werk onzichtbaar. Een poort die groen meldt over de
     bestanden die hij niet heeft bekeken is LAT.md regel 3 in zijn stilste
     vorm. */
  const gezien = new Set(uit.map(b => b.pad));
  for (const pad of git(['ls-files', '--others', '--exclude-standard']).split('\n')) {
    if (!pad.trim() || gezien.has(pad)) continue;
    uit.push({ status: 'A', oudPad: null, pad });
  }
  return uit;
}

const versieBijBasis = (basis, pad) => versieBij(WORTEL, basis, pad);
function versieNu(pad) {
  try { return fs.readFileSync(path.join(WORTEL, pad), 'utf8'); } catch (e) { return null; }
}

/* ------------------------------------------------------------- uitzonderingen */

/* EEN UITZONDERING BESTAAT, EN HEEFT EEN VERVALDATUM.

   Een poort zonder uitweg wordt uitgezet, en dan is er geen poort meer. Maar
   een uitweg zonder einddatum is geen uitzondering maar een tweede norm die
   niemand meer leest. Ze staan daarom in NORM.json naast de handmatige
   verlagingen, in hetzelfde formaat en onder dezelfde vervalregel, en
   scripts/normverval.js zakt zodra er een over de datum is. */
function uitzonderingen() {
  try {
    const n = JSON.parse(fs.readFileSync(path.join(WORTEL, 'NORM.json'), 'utf8'));
    return Array.isArray(n.uitzonderingen) ? n.uitzonderingen : [];
  } catch (e) { return []; }
}
function isUitgezonderd(lijst, regel, pad, wat) {
  return lijst.some(u => u && u.regel === regel && u.pad === pad &&
    (u.wat === undefined || u.wat === wat) &&
    (!u.vervalt || u.vervalt >= new Date().toISOString().slice(0, 10)));
}

/* ------------------------------------------------------------------ de regels */

/* De bundeluitvoer telt niet mee, precies zoals in de meter zelf: die
   bestanden zijn samengesteld uit bronnen die hier al langskomen. */
const bundelPaden = new Set(Object.keys(require('./bundel').bundels).map(k => 'public/' + k.replace(/\\/g, '/')));

const isPubliek = (p) => /^public\/.+\.(html|js)$/.test(p) && !p.includes('/dist/') && !bundelPaden.has(p);
const isServer = (p) => /^server\/.+\.js$/.test(p);
const isDienstToets = (p) => /^test\/.+\.test\.js$/.test(p);

function telStijl(tekst) { return telInlineStijl(() => tekst, ['x']); }

function telSkips(tekst) {
  /* Dezelfde uitdrukking als de meter, op dezelfde geschoonde bron. Zou hier
     de rauwe tekst in gaan, dan telt een toets die de skip-vorm in zijn KOP
     uitlegt mee -- de fout die in norm.js drie keer is gemaakt en drie keer is
     gerepareerd. Die reparaties zitten in schoon(). */
  const bron = schoon(tekst);
  let n = 0;
  for (const m of bron.matchAll(/\{\s*skip\s*:\s*([^}]+)\}/g)) if (!/^false\s*$/.test(m[1])) n++;
  n += (bron.match(/\b(?:test|it)\.skip\s*\(/g) || []).length;
  return n;
}

/* Elke regel krijgt (bestand, voor, na) en geeft nul of meer bevindingen.
   `voor` is null bij een nieuw bestand -- dat is precies het onderscheid
   tussen de twee latten, en het staat daarom in elke regel expliciet. */
/* DE ONVERKLAARDE RANDEN VAN DIT BESTAND.

   Een rand is hier een require van het ene deel van RTG naar het andere, en
   VERSTRENGELING.json deelt ze in. Wat geen enkele afleiding en geen enkele
   verklaring past, heet ONBEKEND -- 111 op 2 september 2026.

   Die 111 hoeven niet weg om ergens aan te mogen werken; er mag alleen niets
   bijkomen. Dat is precies waarom deze regel in de deltapoort hoort en niet in
   de keuring: de som over het huis verrekent (een rand weg in het ene domein
   betaalt een nieuwe in het andere), en de verrekening is hier het gevaar. Een
   nieuwe onverklaarde rand tussen twee domeinen is het begin van de
   verstrengeling die een trede onmogelijk maakt, en die kost NIETS om te
   voorkomen op het moment dat hij ontstaat -- en heel veel daarna.

   De uitweg is niet de rand weghalen maar hem VERKLAREN, in
   scripts/lib/verstrengeling-verklaringen.js, met een reden die klopt. Daarom
   staat die uitweg in de hulp van elke bevinding. */
function randenVanBron(pad, bron) {
  const uit = new Set();
  const van = V.knoopVan(pad);
  if (!van || typeof bron !== 'string') return uit;
  for (const m of bron.matchAll(/require\(\s*['"](\.[^'"]+)['"]\s*\)/g)) {
    const doel = path.normalize(path.join(path.dirname(pad), m[1])).replace(/\\/g, '/');
    const naar = V.knoopVan(doel);
    if (!naar) continue;
    const a = van.laag + ':' + van.domein, b = naar.laag + ':' + naar.domein;
    if (a !== b) uit.add(a + ' -> ' + b);
  }
  return uit;
}

/* De indeling van het HELE huis, want of een rand onverklaard is hangt af van
   de rest: een doel dat door drie knopen wordt gebruikt is een gemeten
   primitief, en dat kun je aan een enkel bestand niet zien. Een keer berekend,
   en in de toets te vervangen door een eigen verzameling. */
let onbekendCache = null;
function onbekendeRanden() {
  if (!onbekendCache) {
    try {
      onbekendCache = new Set(V.meet(path.join(WORTEL, 'server')).alle
        .filter(r => r.soort === 'ONBEKEND').map(r => r.van + ' -> ' + r.naar));
    } catch (e) { onbekendCache = new Set(); }
  }
  return onbekendCache;
}

const REGELS = [
  {
    naam: 'inline-stijl',
    meter: 'inlineStijlAttributen',
    wat: 'style="..."-attributen in public/ (die houden style-src-attr open in de CSP)',
    geldt: isPubliek,
    keur(pad, voor, na) {
      const nu = telStijl(na);
      if (voor === null) return nu ? [{ bericht: 'nieuw bestand met ' + nu + ' inline stijlattribu(u)t(en); de norm voor nieuw werk is nul',
        hulp: 'zet ze in een class of in de stijlkop van de pagina' }] : [];
      const toen = telStijl(voor);
      if (nu > toen) return [{ bericht: 'inline stijlattributen gaan van ' + toen + ' naar ' + nu,
        hulp: 'de erfenis hoeft niet weg om dit bestand te mogen wijzigen, maar hij mag niet groeien' }];
      return [];
    }
  },
  {
    naam: 'omvang',
    meter: 'keuringTeGroot',
    wat: 'servermodules over de grens van ' + GRENS + ' bytes',
    geldt: isServer,
    keur(pad, voor, na) {
      const nu = Buffer.byteLength(na, 'utf8');
      if (nu <= GRENS) return [];
      if (voor === null) return [{ bericht: 'nieuw bestand van ' + nu + ' bytes, over de grens van ' + GRENS,
        hulp: 'splits het; een module die je in een keer moet lezen om hem te wijzigen is er een te veel' }];
      const toen = Buffer.byteLength(voor, 'utf8');
      if (toen <= GRENS) return [{ bericht: 'dit bestand gaat van ' + toen + ' naar ' + nu + ' bytes en komt daarmee OVER de grens van ' + GRENS,
        hulp: 'het aantal modules over de grens mag niet groeien -- haal er iets uit of zet het nieuwe in een eigen module' }];
      if (nu > toen) return [{ bericht: 'dit bestand staat al over de grens (' + toen + ' bytes) en groeit naar ' + nu,
        hulp: 'over de grens mag je repareren, niet uitbreiden' }];
      return [];
    }
  },
  {
    naam: 'zelfpoortende-toets',
    meter: 'zelfpoortendeToetsen',
    wat: 'toetsen die zichzelf overslaan als een dienst ontbreekt',
    geldt: isDienstToets,
    keur(pad, voor, na) {
      const nu = telSkips(na);
      if (voor === null) return nu ? [{ bericht: 'nieuw toetsbestand met ' + nu + ' toets(en) die zichzelf kunnen overslaan',
        hulp: 'een toets die zichzelf overslaat draait op de standaardmachine niet; zet de dienst in de draaier of schrijf hem zonder' }] : [];
      const toen = telSkips(voor);
      if (nu > toen) return [{ bericht: 'zelfpoortende toetsen gaan van ' + toen + ' naar ' + nu }];
      return [];
    }
  },
  {
    naam: 'nieuwe-ingang-buiten-http',
    meter: 'wekkersOnverklaard',
    wat: 'klokken, busabonnees, eigen servers en werkers: werk dat begint zonder dat iemand een pad opvraagt',
    geldt: isServer,
    keur(pad, voor, na) {
      /* DE INGANGENKAART BEWAAKT HET GEHEEL, DEZE REGEL HET NIEUWE WERK.

         Een setInterval, een busabonnee, een eigen server op een eigen poort of
         een tweede proces: alle vier kunnen ze werk beginnen buiten de
         functieschakelaars om. Bestaande gevallen staan geteld en verklaard
         (scripts/lib/wekker-verklaringen.js); wat er BIJ komt, hoort meteen
         gezegd te worden -- want achteraf uitzoeken waar een timer vandaan komt
         is precies het werk dat deze hele ronde heeft gekost.

         Een bestand dat al verklaard is, mag zijn ingangen houden: die vraag is
         beantwoord. */
      if (VERKLAARDE_INGANGEN.has(pad)) return [];
      const tel = (bron) => INGANGPATRONEN.map(p => ({ soort: p.soort,
        n: (String(bron || '').match(new RegExp(p.rx.source, 'g')) || []).length }));
      const nu = tel(na), toen = tel(voor === null ? '' : voor);
      const uit = [];
      for (let i = 0; i < nu.length; i++) {
        if (nu[i].n <= toen[i].n) continue;
        uit.push({ bericht: (voor === null ? 'nieuw bestand met ' : 'erbij: ') + (nu[i].n - toen[i].n) +
            ' ingang(en) van de soort ' + nu[i].soort + ' (' + INGANGPATRONEN[i].wat + ')',
          hulp: 'hang hem aan een functie zodat de boardroom hem kan uitzetten, of zet hem met een reden in ' +
            'scripts/lib/wekker-verklaringen.js -- npm run wekkers laat zien hoe hij nu telt' });
      }
      return uit;
    }
  },
  {
    naam: 'nieuwe-onverklaarde-rand',
    meter: 'verstrengelingOnverklaard',
    wat: 'requires tussen twee delen van RTG die niemand heeft verklaard',
    geldt: isServer,
    keur(pad, voor, na, ctx) {
      const onbekend = (ctx && ctx.onbekendeRanden) || onbekendeRanden();
      const nu = randenVanBron(pad, na);
      const toen = randenVanBron(pad, voor === null ? '' : voor);
      const uit = [];
      for (const r of nu) {
        if (!onbekend.has(r) || toen.has(r)) continue;
        uit.push({ bericht: (voor === null ? 'nieuw bestand met een onverklaarde rand: ' : 'nieuwe onverklaarde rand: ') + r,
          hulp: 'verklaar hem in scripts/lib/verstrengeling-verklaringen.js met een reden die klopt, ' +
            'of gebruik iets wat er al is -- npm run verstrengeling laat zien hoe hij nu heet' });
      }
      return uit;
    }
  },
  {
    naam: 'nieuw-endpoint-zonder-toets',
    meter: 'endpointsZonderTest',
    wat: 'endpoints die in geen enkele test voorkomen',
    geldt: isServer,
    keur(pad, voor, na, ctx) {
      const vroeger = new Set(routesInBron(voor === null ? '' : voor, pad).map(r => r.methode + ' ' + r.pad));
      const nieuw = routesInBron(na, pad).filter(r => !vroeger.has(r.methode + ' ' + r.pad));
      const uit = [];
      for (const r of nieuw) {
        /* Een pad zonder onderscheidende staart ('/', '/status') levert een
           tekstzoektocht die overal raak is; die overslaan we liever dan dat we
           met een vals groen komen. */
        if (r.pad.replace(/[^a-z]/gi, '').length < 4) continue;
        if (ctx.gedekt(r.pad)) continue;
        uit.push({ bericht: 'nieuw endpoint ' + r.methode + ' ' + r.pad + ' (regel ' + r.regel + ') komt in geen enkel testbestand voor',
          hulp: 'schrijf de toets in dezelfde wijziging; een endpoint dat later een toets krijgt, krijgt hem niet' });
      }
      return uit;
    }
  }
];

/* Twee regels gaan niet over een bestand maar over de wijziging als geheel. */
function regelsOverHetGeheel(basis, bestanden) {
  const uit = [];

  /* GEEN NIEUW PAKKET. De meter `dependencies` staat op nul en dat is een
     principe: niets van buiten draait mee voor een bezoeker. `devPakketten`
     staat op een. Beide mogen alleen omlaag, dus de ratel zou dit ook zien --
     maar pas na een volledige meetronde, en met een melding die niet zegt WELK
     pakket. */
  const pkg = bestanden.find(b => b.pad === 'package.json');
  if (pkg) {
    const voor = versieBijBasis(basis, 'package.json');
    const na = versieNu('package.json');
    if (voor && na) {
      const a = JSON.parse(voor), b = JSON.parse(na);
      for (const soort of ['dependencies', 'devDependencies']) {
        const toen = Object.keys(a[soort] || {});
        for (const naam of Object.keys(b[soort] || {})) {
          if (toen.includes(naam)) continue;
          uit.push({ regel: 'nieuw-pakket', meter: soort === 'dependencies' ? 'dependencies' : 'devPakketten',
            pad: 'package.json',
            bericht: 'nieuw pakket in ' + soort + ': ' + naam,
            hulp: soort === 'dependencies'
              ? 'de runtime draait op nul externe pakketten en dat is een principe, geen toeval'
              : 'gereedschap van buiten mag, maar het is een besluit: leg het vast als uitzondering in NORM.json met een reden' });
        }
      }
    }
  }

  return uit;
}

/* ------------------------------------------------------------------ de ronde */

function main() {
  const basis = bepaalBasis();
  console.log('\n' + K.vet + 'DE DELTAPOORT' + K.reset + K.grijs + ' -- nieuw werk staat op de norm, aangeraakt werk zakt er niet onder' + K.reset + '\n');
  if (basis.fout) {
    console.error('  ' + K.rood + 'GEEN BASIS: ' + basis.fout + K.reset);
    console.error('\n  Een poort zonder vergelijkingspunt hoort niet groen te melden maar te zakken');
    console.error('  (LAT.md regel 3: een meter zakt als zijn invoer ontbreekt).\n');
    return 2;
  }
  console.log('  ' + K.grijs + 'basis: ' + basis.ref.slice(0, 12) + ' (' + basis.hoe + ')' + K.reset);

  const bestanden = gewijzigdeBestanden(basis.ref);
  if (!bestanden.length) {
    console.log('  ' + K.grijs + 'geen gewijzigde bestanden ten opzichte van de basis.' + K.reset + '\n');
    return 0;
  }
  console.log('  ' + K.grijs + bestanden.length + ' gewijzigd(e) bestand(en)' + K.reset + '\n');

  /* De testtekst een keer, ontdaan van commentaar -- anders telt een pad in een
     uitleg als dekking, en dan is de poort met een zoek-en-vervang te openen. */
  const testMap = path.join(WORTEL, 'test');
  /* Geen testmap is geen "niets om te vergelijken" maar een repository zonder
     toetsen; dan is elk nieuw endpoint per definitie ongedekt en hoort de poort
     dat te zeggen in plaats van te struikelen. */
  const testTekst = (fs.existsSync(testMap) ? fs.readdirSync(testMap) : []).filter(n => n.endsWith('.js'))
    .map(n => zonderCommentaar(fs.readFileSync(path.join(testMap, n), 'utf8'))).join('\n');
  const ctx = { gedekt: maakZoeker(testTekst) };

  const vrij = uitzonderingen();
  const bevindingen = [];
  const gekeurd = new Map();

  for (const b of bestanden) {
    const na = versieNu(b.pad);
    if (na === null) continue;                          // verdwenen tussen diff en lezen
    for (const regel of REGELS) {
      if (!regel.geldt(b.pad)) continue;
      const voor = b.status === 'A' ? null : versieBijBasis(basis.ref, b.oudPad || b.pad);
      gekeurd.set(regel.naam, (gekeurd.get(regel.naam) || 0) + 1);
      for (const v of regel.keur(b.pad, voor, na, ctx)) {
        if (isUitgezonderd(vrij, regel.naam, b.pad, v.wat)) continue;
        bevindingen.push({ regel: regel.naam, meter: regel.meter, pad: b.pad, nieuw: voor === null, ...v });
      }
    }
  }
  for (const v of regelsOverHetGeheel(basis.ref, bestanden)) {
    if (isUitgezonderd(vrij, v.regel, v.pad, v.wat)) continue;
    bevindingen.push(v);
  }

  if (TOON) {
    for (const regel of REGELS)
      console.log('  ' + K.grijs + regel.naam.padEnd(30) + String(gekeurd.get(regel.naam) || 0).padStart(4) +
        ' bestand(en) gekeurd -- ' + regel.wat + K.reset);
    console.log('');
  }

  if (!bevindingen.length) {
    console.log('  ' + K.groen + 'De deltapoort is gehaald.' + K.reset + K.grijs +
      ' Niets in deze wijziging staat onder de norm.' + K.reset + '\n');
    return 0;
  }

  console.log('  ' + K.rood + K.vet + 'DE DELTAPOORT IS NIET GEHAALD.' + K.reset + '\n');
  const perRegel = new Map();
  for (const b of bevindingen) { if (!perRegel.has(b.regel)) perRegel.set(b.regel, []); perRegel.get(b.regel).push(b); }
  for (const [naam, lijst] of perRegel) {
    console.log('  ' + K.vet + naam + K.reset + K.grijs + '  (meter: ' + lijst[0].meter + ')' + K.reset);
    for (const b of lijst) {
      console.log('    ' + K.rood + '✗' + K.reset + ' ' + b.pad + (b.nieuw ? K.blauw + '  [nieuw bestand: de volle norm]' + K.reset : ''));
      console.log('      ' + b.bericht);
      if (b.hulp) console.log('      ' + K.grijs + b.hulp + K.reset);
    }
    console.log('');
  }
  console.log('  ' + K.grijs + 'Dit gaat niet over het gemiddelde van de codebase maar over deze wijziging.');
  console.log('  Kan het echt niet, dan hoort er een uitzondering in NORM.json te staan onder');
  console.log('  "uitzonderingen", met regel, pad, reden en een vervaldatum -- geen stilte.' + K.reset + '\n');
  return 1;
}

if (require.main === module) process.exit(main());
module.exports = { REGELS, regelsOverHetGeheel, bepaalBasis, gewijzigdeBestanden, telSkips, telStijl, isUitgezonderd };
