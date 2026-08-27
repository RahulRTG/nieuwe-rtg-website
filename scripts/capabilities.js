#!/usr/bin/env node
/* ============================================================================
   DE CAPABILITY-METING -- noemt het woord "capability" in dit huis EEN ding?

   DE VRAAG KOMT UIT OS.md par. 2. Daar staat de eerste wet van de voorgestelde
   doelarchitectuur, en het is de wet waar alle andere aan hangen:

     "Everything is a Capability. Person.Verify, Payment.Authorize,
      Document.Sign, AI.Reason, Policy.Evaluate -- iedere capability krijgt
      exact hetzelfde contract. Als ik er een begrijp, begrijp ik ze allemaal."

   Dat is een prachtige wet EN een aanname: hij gaat ervan uit dat "capability"
   hier al een ding is dat je kunt standaardiseren. Dit huis heeft die aanname
   al eens duur betaald. PLATFORM.md legt vast wat er gebeurde bij Cercle en
   Entourage: twee apps die identiek KLONKEN, met totaal verschillende data en
   werkstromen. De les die daar staat is letterlijk:

     "Een gedeeld routevoorvoegsel is geen gedeelde kern."

   Deze meter stelt dezelfde vraag aan een WOORD in plaats van aan een route:
   een gedeelde naam is geen gedeelde betekenis. En hij stelt hem zoals
   scripts/objectmodel.js hem stelde -- door te tellen, zodat het getal de
   conclusie draagt in plaats van andersom.

   HOE ER GEMETEN WORDT

   1. Per bestand onder server/ worden de WOORDENLIJSTEN gezocht: een const met
      een hoofdletternaam die een gesloten verzameling ids draagt. Commentaar
      gaat er eerst uit (dezelfde wringer als scripts/objectmodel.js), anders
      telt een id dat in een uitleg wordt genoemd mee als lid.

   2. DAARVAN BLIJVEN DE VERMOGENSLIJSTEN OVER. Niet elke hoofdletterconstante
      is een capability-woordenlijst; `KLEUREN` en `TARIEVEN` zijn het niet. De
      zeef is de naam, via VERMOGENSWOORD hieronder.

      DIT IS DE ZWAKSTE SCHAKEL VAN DE METER EN DAT HOORT HIER TE STAAN. Die
      regex is door een mens gekozen. Hij mist een woordenlijst die anders heet,
      en hij vangt er een die toevallig zo heet. Wat hem eerlijk houdt is dat
      hij de conclusie de VERKEERDE kant op kan duwen maar niet de goede: elke
      lijst die hij ten onrechte meepakt, kan de overlap alleen VERHOGEN. De
      uitkomst hieronder is nul overlap, en die staat dus ondanks de zeef en
      niet dankzij hem.

   3. Daarna pas de vraag, in twee delen:

      a. DE OVERLAP. In hoeveel woordenlijsten staat elk id? En hoeveel lijken
         twee lijsten op elkaar (Jaccard over hun leden)? Als "capability" een
         ding is, hoort daar samenhang uit te komen. Als er nul uit komt, zijn
         het homoniemen: hetzelfde woord voor verschillende dingen, en dan is
         "een grammatica voor alles" geen hernoeming maar een nieuwe laag.

      b. HET CONTRACT. Punt 7 van de opzet eist dat elke capability dezelfde
         eigenschappen draagt (rechten, risico, doel, versie, eigenaar). Dus
         wordt per woordenlijst gemeten welke daarvan er WERKELIJK staan. Dat
         maakt van "iedere capability krijgt hetzelfde contract" een afstand in
         plaats van een wens: je ziet welke lijst er het dichtst bij zit en dus
         het model kan zijn.

   WAT DIT NIET BEWIJST, en dat hoort er hard bij te staan:

   - Nul overlap bewijst NIET dat de opzet fout is. Het bewijst dat de acht
     lijsten vandaag acht dingen zijn. Of daar een gedeelde grammatica overheen
     KAN, is een ontwerpvraag die een mens beantwoordt; wat deze meter levert is
     de prijs ervan.
   - Een gedeeld id bewijst omgekeerd ook niets. `location` in het genre-register
     en `location` in een machtiging zijn twee verschillende dingen met dezelfde
     acht letters. Daarom staat bij elk gedeeld id WAAR hij vandaan komt, zodat
     een mens de twee bestanden kan openen.

   Draai: node scripts/capabilities.js            (leesbaar)
          node scripts/capabilities.js --json     (voor de ratel)
          npm run capabilities:vast               (schrijft CAPABILITEIT.json)
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');

const WORTEL = path.join(__dirname, '..');
const BRONNEN = ['server'];

/* Wat NIET meetelt. De eerste twee om dezelfde reden als in objectmodel.js
   (voorbeelddata is opgeschreven en niet gebouwd), de derde omdat test/
   meterijk.test.js echte bestanden neerzet en weer opruimt -- een meter die per
   ronde een ander getal geeft, meet de suite en niet de code. De vierde is de
   node_modules-val: server/ heeft er geen, maar wie deze meter ooit op een
   andere map richt, wel. */
const GEEN = [/\/initdata\//, /-data\.js$/, /\/zz-[^/]*\.js$/, /node_modules/];

/* HET GENRE-REGISTER IS DE UITZONDERING, en die staat hier met zijn reden.
   server/seed/ valt normaal af (voorbeelddata), maar genres-lijst*.js IS geen
   voorbeelddata: PLATFORM.md par. 3 legt vast dat dit register de ENIGE plek is
   waar de 73 genres met hun caps wonen, en test/genreregister.test.js zakt zodra
   iemand er een buitenom definieert. Het is de oudste capability-woordenlijst
   van dit huis; hem weglaten zou de meting laten winnen op een technicality. */
const GENREREGISTER = /^server\/seed\/genres-lijst/;

/* De zeef uit stap 2. Een woordenlijst telt mee als haar NAAM zegt dat ze over
   mogen-en-kunnen gaat. Zie de waarschuwing in de kop: dit is mensenwerk. */
const VERMOGENSWOORD = /CAP|MACHTIGING|VERMOGEN|BEVOEGD|RECHT|MODULE|PERMISS|ENTITLEMENT|FUNCTIE/;

/* DRIE, EN NIET VIER. Dit stond eerst op vier ("minder is geen woordenlijst
   maar een handvol") en dat kostte meteen de belangrijkste lijst van allemaal:
   kern/appstore/machtigingen.js draagt er precies DRIE, met opzet -- APPSTORE.md
   legt vast dat er drie machtigingen zijn en dat alle drie worden uitgevoerd. En
   laat dat nu net de lijst zijn met het volste contract, en dus het model waar
   par. 4 van OS.md op uitkomt. Een drempel die de best gebouwde lijst wegfiltert
   en daarna concludeert dat niemand een contract draagt, is een meter die zijn
   eigen antwoord kiest. Wat een woordenlijst een woordenlijst maakt is niet haar
   lengte maar dat ze gesloten is; de naamzeef doet dat werk al. */
const MIN_LEDEN = 3;
const GELIJKENIS = 0.3;     // twee lijsten lijken op elkaar vanaf deze overlap

/* De contracteigenschappen uit punt 7 van de opzet, vertaald naar de woorden
   die dit huis gebruikt. Per woordenlijst wordt geteld welke hiervan als veld
   bij de leden staan. Wat hier niet in staat, wordt niet gezien -- dus staat de
   Engelse naam erbij, want de opzet is in het Engels gesteld. */
const CONTRACT = {
  label: /\b(label|naam|titel)\s*:/,                      // human name
  uitleg: /\b(wat|uitleg|omschrijving|waarom)\s*:/,        // description
  risico: /\b(risico|gevoelig|zwaarte)\s*:/,               // data classification
  doel: /\b(doel|doelen|purpose)\s*:/,                     // purpose binding
  grens: /\b(nooit|verboden|niet|grens)\s*:/,              // what it never gives
  bron: /\b(bron|bronnen|herkomst)\s*:/,                   // owner / provenance
  rang: /\b(rang|niveau|soort|klasse)\s*:/,                // tier
  bestemming: /\b(link|app|pad|route)\s*:/                 // where it lands
};

/* Commentaar eruit voordat er iets geteld wordt. LET OP het verschil met
   objectmodel.js: die wringt ook de TEKENREEKSEN eruit, want daar zijn de
   veldnamen de meting. Hier zijn de tekenreeksen JUIST de meting -- de leden
   van een woordenlijst zijn 'rooms', 'profiel.basis', 'SEPA_UIT'. Dus alleen
   commentaar. Dat is precies de val waar deze meter zelf in trapte bij zijn
   eerste versie: met de wringer van objectmodel.js vond hij nul leden overal,
   en nul overlap tussen nul leden is een prachtig getal dat niets betekent. */
const wring = (t) => t
  .replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))
  .replace(/(^|[^:'"\\/])\/\/[^\n]*/g, (m, p) => p);

function bestanden(map, uit) {
  const vol = path.join(WORTEL, map);
  if (!fs.existsSync(vol)) return uit;
  for (const naam of fs.readdirSync(vol)) {
    const p = path.join(vol, naam);
    const rel = path.join(map, naam).replace(/\\/g, '/');
    if (fs.statSync(p).isDirectory()) bestanden(path.join(map, naam), uit);
    else if (naam.endsWith('.js') && !GEEN.some(g => g.test(rel))) uit.push(rel);
  }
  return uit;
}

/* Het blok achter een `= {` of `= [` uitknippen, op accoladediepte. Er zit een
   dak op (9000 tekens): een bestand met een scheve accolade zou anders de rest
   van het bestand opslokken en die vervuiling reist door de hele meting. */
function blokVanaf(s, start) {
  let d = 0;
  for (let i = start; i < s.length && i < start + 9000; i++) {
    const c = s[i];
    if (c === '{' || c === '[') d++;
    else if (c === '}' || c === ']') { d--; if (!d) return s.slice(start, i + 1); }
  }
  return null;
}

/* De leden van een woordenlijst. Twee vormen, want dit huis gebruikt ze allebei:
   een sleutel (`hotel: {...}`) en een tekenreeks (`['rooms', 'rides']`). Een lid
   moet op een id lijken -- kleine letters, punten, streepjes, of de SCHREEUW-vorm
   die kern/bevoegdheid gebruikt. Een zin met spaties is geen id maar uitleg.

   ALLEEN OP DIEPTE 1, EN DAT IS DE HELE KUNST -- het is dezelfde correctie die
   objectmodel.js met zijn envelop maakte. De eerste versie las het hele blok
   plat, en dus telden de VELDEN van de leden mee als leden: `naam` stond in
   acht van de eenentwintig lijsten, `laag` in drie. Dat leest als overlap en
   het is er geen -- het is acht keer hetzelfde woordje voor "hoe heet dit
   ding". Een meter die zijn eigen verpakking voor inhoud aanziet, vindt overal
   verwantschap en bewijst daarmee niets.

   De leden van een woordenlijst staan op diepte 1; wat daaronder staat is hun
   beschrijving. Dit huis schrijft die leden in VIER vormen, en de meter kent ze
   alle vier omdat hij anders meet welke schrijfwijze een module toevallig koos
   in plaats van wat er staat:

     sleutel     { hotel: {...}, villa: {...} }        -> de sleutel
     id-veld     [ { id: 'reizen', naam: ... }, ... ]  -> het id-veld
     fabriek     [ M('profiel.basis', 'Wie je bent') ] -> de eerste tekenreeks
     kale reeks  caps: ['rooms', 'rides']              -> de tekenreeks zelf

   De eerste versie kende alleen de eerste vorm en verloor daarmee juist de
   lijsten die er het meest toe doen: MACHTIGINGEN (fabriek) en de twee CAPS-
   catalogi (id-veld). Een meting die de best gebouwde lijsten laat vallen omdat
   ze anders geschreven zijn, meet opmaak. */
function ledenVan(blok) {
  /* De blokgrenzen eraf, daarna opknippen op komma's op diepte 0 van wat er
     binnen staat. Tekenreeksen worden overgeslagen, want een komma in een
     uitleg is geen scheiding. */
  const binnen = blok.slice(1, -1);
  const stukken = [];
  let diepte = 0, begin = 0;
  for (let i = 0; i < binnen.length; i++) {
    const c = binnen[i];
    if (c === "'" || c === '"' || c === '`') {
      let j = i + 1;
      while (j < binnen.length && binnen[j] !== c) { if (binnen[j] === '\\') j++; j++; }
      i = j;
      continue;
    }
    if (c === '{' || c === '[' || c === '(') diepte++;
    else if (c === '}' || c === ']' || c === ')') diepte--;
    else if (c === ',' && diepte === 0) { stukken.push(binnen.slice(begin, i)); begin = i + 1; }
  }
  stukken.push(binnen.slice(begin));

  const isId = (t) => /^([a-z][a-z0-9.\-_]{2,40}|[A-Z][A-Z0-9_]{2,40})$/.test(t);
  const uit = new Set();
  for (const stuk of stukken) {
    const s = stuk.trim();
    if (!s) continue;
    let m;
    /* sleutel -- ook de aangehaalde vorm ('voortgang-onthouden': '...') */
    if ((m = s.match(/^['"]?([a-zA-Z][\w.\-]{2,40})['"]?\s*:/)) && isId(m[1])) { uit.add(m[1]); continue; }
    /* id-veld, ergens in dit element */
    if ((m = s.match(/\bid\s*:\s*['"]([^'"]{2,40})['"]/)) && isId(m[1])) { uit.add(m[1]); continue; }
    /* fabrieksaanroep */
    if ((m = s.match(/^[A-Za-z_$][\w$]*\(\s*['"]([^'"]{2,40})['"]/)) && isId(m[1])) { uit.add(m[1]); continue; }
    /* kale tekenreeks */
    if ((m = s.match(/^['"]([^'"]{2,40})['"]$/)) && isId(m[1])) { uit.add(m[1]); continue; }
  }
  return [...uit];
}

/* Het inlezen en het REKENEN staan los, en dat is niet netheid maar
   toetsbaarheid: analyse() krijgt woordenlijsten en geeft een uitkomst, dus is
   hij te voeren met verzonnen lijsten waarvan je WEET wat eruit hoort te komen.
   Een meter die alleen op de echte boom draait, is een meter die je nooit hebt
   zien uitslaan (LAT-regel 10). */
function lees() {
  const paden = BRONNEN.reduce((a, m) => bestanden(m, a), []);
  const lijsten = [];
  let bekeken = 0;
  for (const p of paden) {
    const ruw = fs.readFileSync(path.join(WORTEL, p), 'utf8');
    const s = wring(ruw);
    bekeken++;

    /* Vorm 1: de benoemde constante. */
    for (const m of s.matchAll(/const\s+([A-Z][A-Z0-9_]{2,})\s*=\s*[{[]/g)) {
      const blok = blokVanaf(s, m.index + m[0].length - 1);
      if (!blok) continue;
      const leden = ledenVan(blok);
      if (leden.length < MIN_LEDEN) continue;
  lijsten.push({ bestand: p, naam: m[1], leden, blok, bron: s });
    }

    /* Vorm 2: het genre-register, dat zijn caps INLINE per genre draagt en dus
       geen enkele constante heeft om aan te haken. Alle caps van het bestand
       vormen samen een woordenlijst -- want dat is wat het register is. */
    if (GENREREGISTER.test(p)) {
      const caps = new Set();
      for (const m of s.matchAll(/caps\s*:\s*\[([^\]]*)\]/g))
        for (const c of m[1].matchAll(/['"]([a-z][a-z0-9.\-_]{2,40})['"]/g)) caps.add(c[1]);
      if (caps.size >= MIN_LEDEN)
        lijsten.push({ bestand: p, naam: 'caps (genre-register)', leden: [...caps], blok: s });
    }
  }
  return { lijsten, bestanden: paden.length, bekeken };
}

/* Welke contracteigenschappen draagt deze woordenlijst? Gemeten over het blok,
   want daar staan de velden van de leden in.

   BEHALVE BIJ EEN FABRIEK, en dat was een blinde vlek die de uitkomst omkeerde.
   kern/appstore/machtigingen.js schrijft zijn leden als `M('profiel.basis',
   'Wie je bent', ...)` en de VELDEN staan in de fabriek een paar regels hoger:
   `const M = (id, label, geeft, nooit, risico, doelen) => ({...})`. Over het
   blok alleen gemeten draagt die lijst dus NUL contracteigenschappen -- terwijl
   het de enige lijst in dit huis is die er zes draagt, inclusief het doel en de
   grens. De meter zou precies de lijst hebben doodverklaard die het antwoord op
   punt 7 IS.

   Dus: is het blok met een fabriek gebouwd, dan telt de fabrieksdefinitie mee.
   Niet het hele bestand -- dan lekt elk woord uit een andere lijst erin. */
function contractVan(blok, bron) {
  let tekst = blok;
  const fabriek = blok.match(/[[{]\s*(?:\/\*[\s\S]*?\*\/\s*)?([A-Z][\w$]*)\(/);
  if (fabriek && bron) {
    const d = bron.match(new RegExp('const\\s+' + fabriek[1] + '\\s*=\\s*\\([^)]*\\)\\s*=>\\s*\\(?\\{[^}]*\\}'));
    if (d) {
      /* EN DAN DE VERKORTE SCHRIJFWIJZE, want daar liep hij alsnog op vast. De
         fabriek is `(id, label, geeft, nooit, risico, doelen) => ({ id, label,
         geeft, ... })` -- met ES6-verkorting, dus `label` staat er ZONDER
         dubbele punt. De zeef hieronder zoekt `label\s*:` en zag dus niets, en
         de lijst met het volste contract kwam op 1 van 8 uit.

         Elke naam uit de fabriek wordt daarom als `naam:` aangeboden. Grof, en
         de goede kant om grof te zijn: deze tekst wordt alleen op de acht
         woorden van CONTRACT bekeken, dus een `const` of een `=>` erbij kost
         niets, terwijl een gemist veld een lijst ten onrechte kaal verklaart. */
      tekst += '\n' + [...d[0].matchAll(/[\w$]+/g)].map(x => x[0] + ':').join(' ');
    }
  }
  const uit = [];
  for (const [naam, re] of Object.entries(CONTRACT)) if (re.test(tekst)) uit.push(naam);
  return uit;
}

function jaccard(a, b) {
  const A = new Set(a), B = new Set(b);
  let snee = 0;
  for (const x of A) if (B.has(x)) snee++;
  const unie = A.size + B.size - snee;
  return unie ? snee / unie : 0;
}

function analyse(lijstenIn, opties) {
  const O = Object.assign({ gelijkenis: GELIJKENIS, vermogenswoord: VERMOGENSWOORD }, opties || {});

  /* Stap 2: alleen de vermogenslijsten. */
  const lijsten = lijstenIn.filter(l => O.vermogenswoord.test(l.naam.toUpperCase()));

  /* Stap 3a: de overlap. Een id kan in meer dan een lijst staan; dat is precies
     wat we willen weten. */
  const waar = new Map();
  for (const l of lijsten) {
    for (const id of l.leden) {
      if (!waar.has(id)) waar.set(id, new Set());
      waar.get(id).add(l.bestand + ' :: ' + l.naam);
    }
  }
  const gedeeld = [...waar.entries()]
    .filter(([, s]) => s.size > 1)
    .map(([id, s]) => ({ id, lijsten: s.size, waar: [...s].sort() }))
    .sort((a, b) => b.lijsten - a.lijsten || a.id.localeCompare(b.id));

  /* TWEE LIJSTEN UIT HETZELFDE BESTAND ZIJN GEEN TWEE LIJSTEN. Zelfde reden als
     `domeinVan` in objectmodel.js: kern/lidboard/catalogus.js draagt CAPS en
     PAD_FUNCTIE, en die twee lijken op elkaar (0,53) omdat de tweede een KAART
     van de eerste is -- cap naar pad. Wie dat als bewijs van gedeelde betekenis
     telt, meet zijn eigen bestandsindeling. */
  const paren = [];
  for (let i = 0; i < lijsten.length; i++) {
    for (let j = i + 1; j < lijsten.length; j++) {
      if (lijsten[i].bestand === lijsten[j].bestand) continue;
      const g = jaccard(lijsten[i].leden, lijsten[j].leden);
      if (g >= O.gelijkenis) paren.push({
        gelijkenis: Math.round(g * 100) / 100,
        a: lijsten[i].bestand + ' :: ' + lijsten[i].naam,
        b: lijsten[j].bestand + ' :: ' + lijsten[j].naam
      });
    }
  }
  paren.sort((x, y) => y.gelijkenis - x.gelijkenis);

  /* De hoogste gelijkenis tussen WELK paar dan ook -- ook onder de drempel.
     Zonder dit getal zou "geen paren" kunnen betekenen dat de drempel te hoog
     staat, en dat is precies het soort stilte dat LAT-regel 3 verbiedt. */
  let maxGelijkenis = 0;
  for (let i = 0; i < lijsten.length; i++)
    for (let j = i + 1; j < lijsten.length; j++) {
      if (lijsten[i].bestand === lijsten[j].bestand) continue;
      maxGelijkenis = Math.max(maxGelijkenis, jaccard(lijsten[i].leden, lijsten[j].leden));
    }

  /* Stap 3b: het contract. */
  const contract = lijsten.map(l => ({
    lijst: l.bestand + ' :: ' + l.naam,
    leden: l.leden.length,
    draagt: contractVan(l.blok, l.bron)
  })).sort((a, b) => b.draagt.length - a.draagt.length || b.leden - a.leden);

  const alleLeden = new Set();
  for (const l of lijsten) for (const id of l.leden) alleLeden.add(id);

  return {
    woordenlijsten: lijsten.length,
    leden: alleLeden.size,
    ledenInEen: alleLeden.size - gedeeld.length,
    ledenInMeer: gedeeld.length,
    ledenInEenPct: alleLeden.size ? Math.round(((alleLeden.size - gedeeld.length) / alleLeden.size) * 100) : 0,
    maxGelijkenis: Math.round(maxGelijkenis * 100) / 100,
    gelijkendeParen: paren.length,
    paren: paren.slice(0, 12),
    gedeeldeLeden: gedeeld.slice(0, 25),
    contract: contract.slice(0, 20),
    volledigsteContract: contract.length ? contract[0] : null
  };
}

function meet(opties) {
  const { lijsten, bestanden: n, bekeken } = lees();
  const uit = analyse(lijsten, opties);
  uit.bestanden = n;
  uit.bekeken = bekeken;
  uit.kandidaten = lijsten.length;
  return uit;
}

/* ---------------------------------------------------------------- rapport -- */

function rapport(r) {
  const L = [];
  L.push('DE CAPABILITY-METING -- noemt "capability" hier een ding?');
  L.push('');
  L.push(`  ${r.bekeken} bestanden, ${r.kandidaten} woordenlijsten gevonden, ` +
    `${r.woordenlijsten} daarvan gaan over mogen-en-kunnen`);
  L.push(`  ${r.leden} verschillende leden in die ${r.woordenlijsten} lijsten`);
  L.push(`  ${r.ledenInEen} van ${r.leden} leden (${r.ledenInEenPct}%) staan in PRECIES EEN lijst`);
  L.push(`  ${r.gelijkendeParen} lijstparen lijken op elkaar (hoogste gelijkenis: ${r.maxGelijkenis})`);
  L.push('');

  if (r.gedeeldeLeden.length) {
    L.push('  DE LEDEN DIE IN MEER DAN EEN LIJST STAAN:');
    for (const g of r.gedeeldeLeden.slice(0, 10)) {
      L.push(`    ${g.id}  (${g.lijsten})`);
      for (const w of g.waar) L.push(`        ${w}`);
    }
    L.push('    Let op: een gedeelde NAAM is geen gedeelde BETEKENIS. Open de twee.');
    L.push('');
  } else {
    L.push('  GEEN ENKEL LID STAAT IN TWEE LIJSTEN.');
    L.push('');
  }

  if (r.paren.length) {
    L.push('  GELIJKENDE PAREN:');
    for (const p of r.paren) L.push(`    ${p.gelijkenis}  ${p.a}\n           ${p.b}`);
    L.push('');
  }

  L.push('  HET CONTRACT PER LIJST (punt 7: dezelfde eigenschappen voor elke capability):');
  for (const c of r.contract.slice(0, 12))
    L.push(`    ${String(c.draagt.length).padStart(2)}/8  ${c.lijst}  (${c.leden} leden)` +
      `\n           ${c.draagt.join(' ') || '(niets)'}`);
  L.push('');
  if (r.volledigsteContract)
    L.push(`  Het verst: ${r.volledigsteContract.lijst} met ${r.volledigsteContract.draagt.length} van 8.`);
  return L.join('\n');
}

/* ------------------------------------------------------------------ start -- */

if (require.main === module) {
  const args = process.argv.slice(2);
  const r = meet();
  if (args.includes('--json')) {
    process.stdout.write(JSON.stringify(r, null, 2) + '\n');
  } else if (args.includes('--vastleggen')) {
    const doel = path.join(WORTEL, 'CAPABILITEIT.json');
    fs.writeFileSync(doel, JSON.stringify(r, null, 2) + '\n');
    process.stdout.write(rapport(r) + '\n\nVastgelegd in CAPABILITEIT.json\n');
  } else {
    process.stdout.write(rapport(r) + '\n');
  }
}

module.exports = { lees, analyse, meet, rapport, jaccard, ledenVan, contractVan,
  CONTRACT, VERMOGENSWOORD, MIN_LEDEN, GELIJKENIS };
