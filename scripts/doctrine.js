#!/usr/bin/env node
/* ============================================================================
   DE DOCTRINECOMPILER -- welke harde uitspraak staat er, en kent de machine hem?

   WAAROM DIT ER IS

   WETTEN.json is de sterkste laag van dit huis: elke wet draagt een BRON (de
   letterlijke zin), een HANDHAVER en een SABOTAGE, en `npm run sabotage`
   probeert hem echt te overtreden. Van de 50 wetten zijn er 46 zo bewezen.

   Wat die opstelling niet kan, staat in zijn eigen kop: *"Het register bevat
   alleen wat iemand heeft OPGESCHREVEN. Een regel die dit huis wel naleeft maar
   nergens noemt, is hier onzichtbaar -- en dat is de grootste blinde vlek van
   allemaal, want hij is per definitie niet te tellen."*

   Die vlek is wel te tellen, alleen niet vanuit het register. Je moet hem van de
   andere kant benaderen: niet "welke wetten hebben een handhaver", maar "welke
   harde uitspraken staan er in de doctrine, en hoeveel daarvan kent het register
   uberhaupt". Dat is wat dit script doet. De aanleiding was een meting: 50
   wetten uit 14 documenten, terwijl 49 van de 109 documenten een grenssectie
   dragen.

   DIT SCRIPT BESLIST NIETS, EN DAT IS DE HELE ONTWERPKEUZE

   Een kandidaat is geen wet. Wat een wet is, is een BESLUIT van een mens, en dat
   besluit woont in WETTEN.json -- precies zoals scripts/wetten.js in zijn kop
   zegt: "een wet is een BESLUIT en geen berekening". Deze compiler wijst alleen
   aan waar een mens naar moet kijken. Hij promoveert niets, hij classificeert
   niets als normatief, en hij telt zijn eigen uitslag nooit als dekking.

   Daarom is de uitslag ook geen percentage dat naar 100 moet. Meerdere zinnen
   uit meerdere documenten beschrijven vaak EEN onderliggende wet; 359 kandidaten
   zijn dus geen 359 wetten, en wie dat getal als doel neemt bouwt bureaucratie.
   De compiler groepeert daarom wat op elkaar lijkt en meldt de groepen apart.

   DRIE DINGEN DIE HIJ MET OPZET ANDERS DOET DAN DE VERLEIDING

     1. HIJ SCHEIDT STERKE VAN ZWAKKE SIGNALEN. "nooit", "geen enkele" en
        "uitsluitend" lezen als wet. "moet" en "altijd" staan in elk document
        honderden keren en lezen als proza. Ze op een hoop gooien levert een
        lijst op waar niemand doorheen komt, en een lijst waar niemand doorheen
        komt is hetzelfde als geen lijst.

     2. HIJ GOOIT NIETS STIL WEG. Codeblokken, tabellen en citaten gaan eruit,
        maar ze worden geteld en de reden staat in de uitslag. Een scanner die
        stil overslaat, meldt een laag getal en dat leest als goed nieuws.

     3. HIJ IJKT ZICHZELF. Een scan die niets KAN vinden staat groen om dezelfde
        reden als een scan die niets vindt, en die twee zijn van buiten niet te
        onderscheiden (dezelfde vorm als test/cijferopmens.test.js en
        test/getallen.test.js). `--ijk` plant een zin en eist dat hij hem vindt.

   DE GRAAD IS `vermoed`, EN DAT IS GEEN BESCHEIDENHEID

   Dit is een LEXICALE meting: hij leest woorden, geen betekenis. Hij mist elke
   harde uitspraak die zonder signaalwoord is geschreven ("de kluis blijft
   gescheiden"), en hij vindt zinnen die nergens over gaan. Het getal is dus een
   ONDERGRENS voor wat er staat en een BOVENGRENS voor wat het waard is. Zelfde
   regel als `anoniem` in KANTOORMACHT.json: de harde as hangt aan de router, de
   zachte as telt niet als bewijs.

   Draai:  node scripts/doctrine.js              (schrijft DOCTRINE.json)
           node scripts/doctrine.js --toon        (laat zien, schrijft niets)
           node scripts/doctrine.js --doc=FOUNDATION.md
           node scripts/doctrine.js --ijk         (alleen de zelfijking)
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const WORTEL = path.join(__dirname, '..');
const DOEL = path.join(WORTEL, 'DOCTRINE.json');
const K = { rood: '\x1b[31m', groen: '\x1b[32m', geel: '\x1b[33m', grijs: '\x1b[90m', vet: '\x1b[1m', uit: '\x1b[0m' };

const TOON = process.argv.includes('--toon');
const IJK_ALLEEN = process.argv.includes('--ijk');
const DOC_FILTER = (process.argv.find(a => a.startsWith('--doc=')) || '').slice(6);

/* ------------------------------------------------------------- de signalen */

/* STERK: woorden die in dit huis een grens aankondigen. Ze komen uit de
   documenten zelf -- "mag nooit sneuvelen", "er komt geen", "bestaat niet" --
   en niet uit een algemene lijst modale werkwoorden.

   ZWAK: woorden die een verplichting KUNNEN dragen maar meestal proza zijn.
   Ze worden geteld en niet uitgeschreven, want een kandidatenlijst van
   duizenden regels wordt door niemand gelezen en dan is de meting decoratie. */
const STERK = [
  [/\b(mag|mogen|wordt|worden|kan|kunnen) nooit\b/i, 'mag nooit'],
  [/\b(er |hier )?komt (er |hier )?geen\b/i, 'er komt geen'],
  [/\bbestaat (hier )?niet\b/i, 'bestaat niet'],
  [/\bbestaan (hier )?niet\b/i, 'bestaan niet'],
  [/\bgeen enkele?\b/i, 'geen enkel'],
  [/\bin geen enkel\b/i, 'in geen enkel'],
  [/\bverboden\b/i, 'verboden'],
  [/\bis een grens\b/i, 'is een grens'],
  [/\bvervalt de functie\b/i, 'vervalt de functie'],
  [/\bmag (hier )?(alleen|uitsluitend)\b/i, 'mag alleen'],
];

/* `nooit` is het huiswoord voor een grens EN het komt in beschrijvend proza
   honderden keren voor ("dat ging nooit goed"). Hetzelfde geldt voor
   `uitsluitend` en `nergens`. Ze tellen daarom alleen als sterk signaal binnen
   een GRENSSECTIE; daarbuiten zijn ze zwak.

   DIT IS DE REPARATIE VAN EEN METER DIE EERST 1786 KANDIDATEN GAF. Dat getal
   was niet de waarheid over de doctrine maar over de woordenlijst: een lijst
   waar niemand doorheen komt is hetzelfde als geen lijst, en hij zou bovendien
   elke ronde groeien met gewoon schrijfwerk. */
const STERK_IN_GRENSSECTIE = [
  [/\bnooit\b/i, 'nooit'], [/\buitsluitend\b/i, 'uitsluitend'], [/\bnergens\b/i, 'nergens'],
  [/\bgeen\b/i, 'geen'], [/\balleen\b/i, 'alleen'],
];
const ZWAK = [
  [/\bmoet\b/i, 'moet'], [/\bmoeten\b/i, 'moeten'], [/\baltijd\b/i, 'altijd'],
  [/\bverplicht\b/i, 'verplicht'], [/\bhoort\b/i, 'hoort'], [/\bbehoort\b/i, 'behoort'],
  [/\bkan niet\b/i, 'kan niet'], [/\balleen wanneer\b/i, 'alleen wanneer'],
  [/\bpas wanneer\b/i, 'pas wanneer'], [/\balleen als\b/i, 'alleen als'],
  [/\bnooit\b/i, 'nooit'], [/\buitsluitend\b/i, 'uitsluitend'], [/\bnergens\b/i, 'nergens'],
];

/* Zinnen die een signaalwoord dragen maar over de MEETLAT gaan in plaats van
   over het product. Ze staan hier met hun reden, want stil overslaan is precies
   wat punt 2 van de kop verbiedt. */
const GEEN_UITSPRAAK = [
  [/^\s*(draai|draaien|lees|zie|let op)\b/i, 'een leesinstructie, geen uitspraak over het product'],
  [/^\s*>/, 'een citaat uit een ander document; de bron telt daar en niet hier'],
];

/* ------------------------------------------------------------ het uitlezen */

const STOP = new Set(('de het een en of van in op te dat die dit deze der den aan met voor is zijn wordt worden was waren als bij uit om ook niet geen nog maar dan er wat wie waar hoe dus want zo al meer dan ze hij zij wij jij je u we ik hun haar hem naar over onder boven tussen per tot dat').split(' '));

function kernwoorden(zin) {
  return new Set(String(zin).toLowerCase().replace(/[^a-z0-9à-ÿ\s]/g, ' ')
    .split(/\s+/).filter(w => w.length > 3 && !STOP.has(w)));
}

function overlap(a, b) {
  if (!a.size || !b.size) return 0;
  let gedeeld = 0;
  for (const w of a) if (b.has(w)) gedeeld++;
  return gedeeld / (a.size + b.size - gedeeld);
}

/* Een document in zinnen, met per zin de kop waaronder hij staat. Codeblokken,
   tabellen en citaten gaan eruit; elk met een teller.

   DE ALINEA WORDT EERST SAMENGEVOEGD, EN DAT IS GEEN NETHEID. Deze documenten
   zijn met de hand afgebroken op ongeveer 76 tekens, dus een zin loopt bijna
   altijd over twee of drie regels. Wie regel voor regel leest, knipt elke wet
   doormidden: de eerste versie hiervan meldde *"de verzameling mogelijkheden
   mag VERGROOT worden en nooit"* als kandidaat. Dat is geen kandidaat maar een
   half citaat, en een lijst met halve citaten leest een mens een keer. */
function leesDocument(bestand) {
  const ruw = fs.readFileSync(path.join(WORTEL, bestand), 'utf8').split('\n');
  const over = { codeblok: 0, tabel: 0, citaat: 0 };
  const stukken = [];
  let inCode = false, kop = null, kopNr = null, kopRegel = 0;
  let alinea = [], alineaRegel = 0;
  /* Staat deze zin onder een kop die over grenzen gaat? Dat is de context die
     van `nooit` een wet maakt in plaats van een bijwoord. De sectie loopt tot de
     eerstvolgende kop van hetzelfde of een hoger niveau -- precies zoals de
     grensmeting die aan dit script voorafging. */
  let grensNiveau = 0;

  /* De opgespaarde alinea in zinnen hakken en wegschrijven. Wordt aangeroepen
     bij een lege regel, een kop, een nieuw opsommingsteken en aan het eind --
     alles wat een alinea afsluit. */
  const sluitAlinea = () => {
    if (!alinea.length) return;
    const tekst = alinea.join(' ').replace(/\s+/g, ' ').trim();
    alinea = [];
    /* Zinnen splitsen op een punt die door een spatie en een hoofdletter wordt
       gevolgd, zodat "par. 5.2" en "bijv." niet uiteenvallen. */
    for (const zin of tekst.split(/(?<=[.!?])\s+(?=[A-Z])/)) {
      /* De nadruktekens van markdown horen niet in een kandidaat: deze
         documenten citeren met `*"..."*`, en dan eindigt de zin op `."*` in
         plaats van op een leesteken. Dat las als een afgebroken zin terwijl
         hij compleet was -- de toets vond het, en de reparatie hoort hier en
         niet in de toets. */
      const t = zin.trim().replace(/^[*_]+/, '').replace(/[*_]+$/, '').trim();
      if (t.length < 25) continue;
      stukken.push({ zin: t, regel: alineaRegel, kop, kopNr, kopRegel, inGrenssectie: grensNiveau > 0 });
    }
  };

  ruw.forEach((regel, i) => {
    if (/^\s*```/.test(regel)) { sluitAlinea(); inCode = !inCode; over.codeblok++; return; }
    if (inCode) { over.codeblok++; return; }
    if (/^\s*\|/.test(regel)) { sluitAlinea(); over.tabel++; return; }
    if (/^\s*>/.test(regel)) { sluitAlinea(); over.citaat++; return; }
    const k = regel.match(/^(#{1,6})\s+(.*)$/);
    if (k) {
      sluitAlinea();
      const niveau = k[1].length;
      kop = k[2].trim().replace(/\*\*/g, '');
      kopRegel = i + 1;
      const nr = kop.match(/^(\d+(?:\.\d+)*)\.?\s/);
      kopNr = nr ? nr[1] : null;
      if (grensNiveau && niveau <= grensNiveau) grensNiveau = 0;
      if (/\bgrens\b|\bgrenzen\b/i.test(kop) &&
          !/implementatiegrens|frame-grens|migratiegrens|productgrens|runtimegrens/i.test(kop)) {
        grensNiveau = niveau;
      }
      return;
    }
    if (!regel.trim()) { sluitAlinea(); return; }
    /* Een nieuw opsommingsteken begint een nieuwe uitspraak, ook zonder lege
       regel ertussen -- anders lopen zeven grenzen in een lijst aan elkaar. */
    if (/^\s*(\d+\.|[-*])\s+/.test(regel)) sluitAlinea();
    if (!alinea.length) alineaRegel = i + 1;
    alinea.push(regel.replace(/^\s*(\d+\.|[-*])\s+/, '').replace(/\*\*/g, '').trim());
  });
  sluitAlinea();
  return { stukken, over };
}

function signaalVan(zin, inGrenssectie) {
  for (const [re, naam] of STERK) if (re.test(zin)) return { sterkte: 'sterk', signaal: naam, grond: 'verbod' };
  if (inGrenssectie) {
    for (const [re, naam] of STERK_IN_GRENSSECTIE) if (re.test(zin)) {
      return { sterkte: 'sterk', signaal: naam, grond: 'grenssectie' };
    }
  }
  for (const [re, naam] of ZWAK) if (re.test(zin)) return { sterkte: 'zwak', signaal: naam, grond: 'proza' };
  return null;
}

/* ------------------------------------------------- dekt het wettenregister? */

/* WAAR EEN WET IN DIT DOCUMENT VERANKERD IS.

   Een bron in WETTEN.json wijst een PLEK aan en geen zin: de ankers zijn korte
   fragmenten als `--burgundy:#7F1634` of `Typografie: twee rollen`. Alle vijftig
   staan letterlijk in hun document, maar geen van hen is de zin die de wet
   verwoordt -- de wettekst is een herformulering door de auteur.

   DE EERSTE VERSIE VAN DEZE FUNCTIE VERGELEEK ZIN MET WETTEKST, en vond 3 van de
   50. Dat las als "het register kent de doctrine niet" terwijl het betekende
   "de vergelijking deugt niet". Zo'n getal is gevaarlijker dan geen getal.

   De vervanging vergelijkt geen woorden maar PLAATS: onder welke kop staat het
   anker? Elke kandidaat onder diezelfde kop valt binnen het bereik van die wet.
   Dat is grover en het is wel na te trekken. */
function ankersPerKop(bestand, wetten) {
  const regels = fs.readFileSync(path.join(WORTEL, bestand), 'utf8').split('\n');
  const kopRegels = [];
  regels.forEach((r, i) => { if (/^#{1,6}\s+/.test(r)) kopRegels.push(i + 1); });
  const kaart = new Map();
  for (const w of wetten) {
    const anker = (w.bron && w.bron.anker) || '';
    if (!anker) continue;
    const ix = regels.findIndex(r => r.includes(anker));
    if (ix < 0) continue;                       // wetten.js --controle meldt dit apart
    let kop = 0;
    for (const kr of kopRegels) { if (kr <= ix + 1) kop = kr; else break; }
    if (!kaart.has(kop)) kaart.set(kop, []);
    kaart.get(kop).push(w.id);
  }
  return kaart;
}

/* ------------------------------------------------------------- de zelfijking */

function zelfijking() {
  const tijdelijk = path.join(WORTEL, 'DOCTRINE-IJKING.md');
  const zin = 'Een geplante regel die hier met opzet staat mag nooit door de compiler worden gemist.';
  fs.writeFileSync(tijdelijk, '# IJking\n\n' + zin + '\n');
  try {
    const { stukken } = leesDocument('DOCTRINE-IJKING.md');
    const raak = stukken.filter(s => signaalVan(s.zin) && signaalVan(s.zin).sterkte === 'sterk');
    if (raak.length !== 1) {
      return { ok: false, waarom: 'de compiler vond ' + raak.length + ' sterke kandidaten in een document met er precies een; ' +
        'zijn groen op de echte documenten zegt daarmee niets' };
    }
    /* En de andere kant: een zin zonder signaal mag GEEN kandidaat worden,
       anders is elke zin een kandidaat en is de lijst waardeloos. */
    fs.writeFileSync(tijdelijk, '# IJking\n\nDit is een gewone beschrijvende zin over de werking van het huis.\n');
    const leeg = leesDocument('DOCTRINE-IJKING.md').stukken.filter(s => signaalVan(s.zin));
    if (leeg.length !== 0) return { ok: false, waarom: 'een zin zonder signaalwoord werd toch een kandidaat' };
    return { ok: true };
  } finally { fs.rmSync(tijdelijk, { force: true }); }
}

/* --------------------------------------------------------------- het stempel */

function stempel() {
  const git = (...a) => { try { return execFileSync('git', a, { cwd: WORTEL, encoding: 'utf8' }).trim(); } catch (e) { return null; } };
  const vuil = git('status', '--porcelain');
  return {
    op: new Date().toISOString(),
    commit: git('rev-parse', '--short', 'HEAD'),
    boomVuil: vuil === null ? null : vuil.length > 0,
    instrument: 'scripts/doctrine.js',
    node: process.version,
  };
}

/* ------------------------------------------------------------------ draaien */

function draai() {
  const ijk = zelfijking();
  if (!ijk.ok) {
    console.error(K.rood + 'ZELFIJKING GEZAKT: ' + ijk.waarom + K.uit);
    process.exit(1);
  }
  if (IJK_ALLEEN) { console.log(K.groen + 'zelfijking in orde' + K.uit); return; }

  let wetten = [];
  try { wetten = require(path.join(WORTEL, 'WETTEN.json')).wetten; }
  catch (e) {
    console.error(K.rood + 'WETTEN.json is niet te lezen (' + e.message + '); zonder dat register is ' +
      '"gedekt" niet vast te stellen en zou elke kandidaat ongedekt heten' + K.uit);
    process.exit(1);
  }
  const wettenPerDoc = {};
  for (const w of wetten) { const b = w.bron && w.bron.bestand; if (b) (wettenPerDoc[b] ||= []).push(w); }

  const docs = fs.readdirSync(WORTEL).filter(f => f.endsWith('.md'))
    .filter(f => !DOC_FILTER || f === DOC_FILTER).sort();

  const kandidaten = [];
  const over = { codeblok: 0, tabel: 0, citaat: 0, geenUitspraak: 0 };
  let zwak = 0, zinnen = 0;

  for (const doc of docs) {
    const { stukken, over: o } = leesDocument(doc);
    over.codeblok += o.codeblok; over.tabel += o.tabel; over.citaat += o.citaat;
    const ankers = ankersPerKop(doc, wettenPerDoc[doc] || []);
    for (const s of stukken) {
      zinnen++;
      const sig = signaalVan(s.zin, s.inGrenssectie);
      if (!sig) continue;
      const uitgesloten = GEEN_UITSPRAAK.find(([re]) => re.test(s.zin));
      if (uitgesloten) { over.geenUitspraak++; continue; }
      if (sig.sterkte === 'zwak') { zwak++; continue; }
      const wet = ankers.get(s.kopRegel) || null;
      kandidaten.push({
        doc, paragraaf: s.kopNr, kop: s.kop, regel: s.regel, zin: s.zin,
        signaal: sig.signaal, grond: sig.grond, inGrenssectie: s.inGrenssectie,
        /* GEDEKT of ONBEPAALD, en nooit "ongedekt". Dat een lexicale scan geen
           wet naast deze zin vindt, bewijst niet dat hij niet gehandhaafd wordt
           -- test/cijferopmens.test.js handhaaft een grens uit vier documenten
           zonder in WETTEN.json te staan. CONTROLPLANE.md: ONBEKEND is met opzet
           geen synoniem van WEIGEREN. */
        stand: wet ? 'gedekt' : 'onbepaald',
        wet: wet ? wet.join(', ') : null,
      });
    }
  }

  /* Groeperen: kandidaten die genoeg kernwoorden delen beschrijven waarschijnlijk
     EEN onderliggende wet. Dit is een VOORSTEL en geen samenvoeging -- de groep
     draagt zijn leden en niemand wordt weggegooid. */
  const groepen = [];
  const gebruikt = new Set();
  const kw = kandidaten.map(k => kernwoorden(k.zin));
  for (let i = 0; i < kandidaten.length; i++) {
    if (gebruikt.has(i)) continue;
    const leden = [i];
    gebruikt.add(i);
    for (let j = i + 1; j < kandidaten.length; j++) {
      if (gebruikt.has(j)) continue;
      if (overlap(kw[i], kw[j]) >= 0.55) { leden.push(j); gebruikt.add(j); }
    }
    if (leden.length > 1) {
      groepen.push({
        leden: leden.map(x => ({ doc: kandidaten[x].doc, paragraaf: kandidaten[x].paragraaf, zin: kandidaten[x].zin })),
        documenten: [...new Set(leden.map(x => kandidaten[x].doc))],
        gedekt: leden.some(x => kandidaten[x].stand === 'gedekt'),
      });
    }
  }

  const gedekt = kandidaten.filter(k => k.stand === 'gedekt').length;
  const meerdereDocs = groepen.filter(g => g.documenten.length > 1);
  const perDoc = {};
  for (const k of kandidaten) {
    (perDoc[k.doc] ||= { kandidaten: 0, gedekt: 0, inGrenssectie: 0 });
    perDoc[k.doc].kandidaten++;
    if (k.stand === 'gedekt') perDoc[k.doc].gedekt++;
    if (k.inGrenssectie) perDoc[k.doc].inGrenssectie++;
  }

  const uit = {
    stempel: stempel(),
    uitleg: 'Harde uitspraken in de doctrine-documenten, en of het wettenregister ze kent. Een kandidaat is GEEN wet: ' +
      'wat een wet is, is een besluit van een mens en dat woont in WETTEN.json. Dit register wijst alleen aan waar een ' +
      'mens naar moet kijken.',
    graad: 'vermoed',
    grens: 'LEXICAAL. Deze meting leest woorden en geen betekenis. Zij mist elke harde uitspraak zonder signaalwoord ' +
      '("de kluis blijft gescheiden") en vindt zinnen die nergens over gaan. Het aantal kandidaten is dus een ONDERGRENS ' +
      'voor wat er staat en zegt niets over wat het waard is. Het is ook geen percentage dat naar 100 moet: meerdere ' +
      'zinnen beschrijven vaak een onderliggende wet, en daarvoor staan de groepen eronder.',
    telling: {
      documenten: docs.length,
      zinnen,
      kandidatenSterk: kandidaten.length,
      kandidatenZwak: zwak,
      gedekt,
      onbepaald: kandidaten.length - gedekt,
      inGrenssectie: kandidaten.filter(k => k.inGrenssectie).length,
      wettenInRegister: wetten.length,
      documentenMetKandidaat: Object.keys(perDoc).length,
      groepen: groepen.length,
      groepenOverMeerdereDocumenten: meerdereDocs.length,
    },
    overgeslagen: {
      codeblokregels: over.codeblok, tabelregels: over.tabel, citaatregels: over.citaat,
      geenUitspraak: over.geenUitspraak,
      waarom: 'code, tabellen en citaten dragen geen eigen uitspraak; ze worden geteld en niet stil weggelaten',
    },
    perDocument: perDoc,
    groepen: meerdereDocs,
    kandidaten,
  };

  if (TOON) toonKort(uit); else {
    fs.writeFileSync(DOEL, JSON.stringify(uit, null, 2) + '\n');
    toonKort(uit);
    console.log(K.grijs + 'DOCTRINE.json geschreven.' + K.uit);
  }
}

function toonKort(uit) {
  const t = uit.telling;
  console.log('');
  console.log(K.vet + '  DE DOCTRINE, LEXICAAL GELEZEN' + K.uit + K.grijs + '  (graad: vermoed -- een ondergrens)' + K.uit);
  console.log('');
  console.log('    ' + String(t.documenten).padStart(6) + '  documenten gelezen');
  console.log('    ' + String(t.kandidatenSterk).padStart(6) + '  sterke kandidaten (nooit, geen enkele, uitsluitend, ...)');
  console.log('    ' + String(t.kandidatenZwak).padStart(6) + K.grijs + '  zwakke signalen (moet, altijd, hoort) -- geteld, niet uitgeschreven' + K.uit);
  console.log('    ' + K.groen + String(t.gedekt).padStart(6) + K.uit + '  kandidaten die een wet in WETTEN.json aanwijst');
  console.log('    ' + K.geel + String(t.onbepaald).padStart(6) + K.uit + '  onbepaald' + K.grijs +
    ' -- geen wet in dezelfde paragraaf; dat is niet hetzelfde als ongehandhaafd' + K.uit);
  console.log('    ' + String(t.inGrenssectie).padStart(6) + '  daarvan in een expliciete grenssectie');
  console.log('    ' + String(t.groepenOverMeerdereDocumenten).padStart(6) + '  groepen die over meer dan een document lopen' +
    K.grijs + ' (kandidaat om samen te nemen)' + K.uit);
  console.log('');
  const rijen = Object.entries(uit.perDocument).map(([d, v]) => [d, v.kandidaten, v.gedekt])
    .sort((a, b) => (b[1] - b[2]) - (a[1] - a[2])).slice(0, 12);
  console.log(K.vet + '  WAAR HET REGISTER HET MINST VAN WEET' + K.uit);
  for (const [d, k, g] of rijen) {
    console.log('    ' + d.padEnd(26) + String(k).padStart(4) + ' kandidaten' + K.grijs + '  ' + g + ' gedekt' + K.uit);
  }
  console.log('');
}

/* Alleen draaien als hij WORDT aangeroepen. Draait hij ook bij `require`, dan
   schrijft de toets die hem onderzoekt het register opnieuw -- en meet daarna
   zijn eigen uitvoer in plaats van die van de laatste ronde. */
if (require.main === module) draai();

module.exports = { leesDocument, signaalVan, zelfijking, ankersPerKop, STERK, STERK_IN_GRENSSECTIE, DOEL };
