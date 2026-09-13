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

   TWEE ASSEN, EN ZE WORDEN NOOIT OPGETELD

     STRUCTUUR  koppen en vette openingszinnen. Wie in een doctrinedocument
                "Een kind is geen profiel" als kop zet, DOET een bewering -- het
                zetten van de kop is de handeling, en een signaalwoord is daar
                niet voor nodig. Deze as draagt de recall.
     WOORD      verbodsvormen in lopende tekst ("mag nooit", "er komt geen").
                Preciezer, en veel blinder.

   Een gemiddelde van die twee betekent niets; ze meten iets anders. Dezelfde
   reden waarom scripts/tredeproef.js zuiver en beproefd apart houdt.

   DE IJKING IS HET BELANGRIJKSTE GETAL HIER

   Er ligt een grondwaarheid die niemand hoeft te maken: WETTEN.json. Elke wet
   daar wijst een plek aan waar een MENS heeft vastgesteld dat een harde
   uitspraak staat. Vindt de extractor daar niets, dan is hij blind voor een
   bekende wet -- en dan zegt zijn getal over de onbekende evenmin iets.

   Dat is geen theorie. De eerste versie van dit bestand meldde 1088 kandidaten
   zonder enige uitspraak over zijn eigen trefzekerheid, en haalde 21 van de 50.
   Van de 29 die hij miste stond het anker van er 15 op een KOP, van 4 op een
   vette openingszin en van 2 in een blokcitaat -- drie plekken die hij per
   ontwerp niet las. Met de structuuras erbij staat hij op 48 van de 50.

   DE GRAAD BLIJFT `vermoed`, EN DAT IS GEEN BESCHEIDENHEID

   96% recall op de BEKENDE wetten zegt niets over precisie: van de duizenden
   kandidaten is niet gemeten welk deel werkelijk een harde uitspraak is. De
   uitslag is een werkvoorraad voor een mens en geen oordeel.

   WAT ER NIET IN ZIT, en dat is gemeten in plaats van vermoed: de woordas
   verbreden met "is geen" en "is niet" brengt de recall van de woordas van 21
   naar 32, maar kost 1580 extra kandidaten -- ongeveer 179 per extra gevonden
   wet. Die ruil is niet gemaakt; de structuuras levert dezelfde recall zonder
   die prijs.

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

/* ---------------------------------------------------------- de structuuras */

/* IS DIT EEN VERKLARING, OF EEN ETIKET?

   DE MEETUITSLAG DIE DEZE FUNCTIE AFDWONG. De eerste versie van deze compiler
   zocht alleen naar SIGNAALWOORDEN in lopende tekst, en haalde daarmee 21 van de
   50 wetten die dit huis al kent. Van de 29 die hij miste stond het anker van er
   15 op een KOP en van 4 op een vetgedrukte openingszin.

   De reden is dat een kop in een doctrinedocument geen signaalwoord NODIG heeft:
   wie "Een kind is geen profiel" of "Bodoni is ceremonieel" als kop zet, DOET
   een bewering -- het zetten van de kop is de handeling. De woordtoets is daar
   dus de verkeerde toets. Met koppen en vette openingszinnen erbij gaat de
   recall van 21 naar 48 van de 50.

   WAT DEZE FUNCTIE ER WEL UIT HOUDT: etiketten. "De grenzen", "Inleiding",
   "Wat er niet komt" zijn wegwijzers en geen uitspraken. De grens ligt op vier
   woorden plus een korte lijst van kopwoorden die een afdeling aankondigen in
   plaats van iets te beweren.

   WAAROM GEEN STRENGERE FILTER. Gemeten: op vijf woorden zakt de recall naar 37,
   op zes naar 31. Elke verscherping koopt rust in de lijst met blindheid voor
   wetten die dit huis AL heeft vastgesteld -- en dat is de verkeerde ruil voor
   een instrument dat juist moet laten zien wat er over het hoofd wordt gezien. */
const ETIKET = /^(de |het |een )?(grens|grenzen|inleiding|samenvatting|bijlage|de stand|de meting|de kern|de opzet|het probleem|de volgorde|de bronnen)\b/i;

function verklaring(tekst) {
  const t = String(tekst || '').replace(/^[\d.]+\s*/, '').replace(/\*\*/g, '').trim();
  const woorden = t.split(/\s+/).filter(Boolean);
  if (woorden.length < 4) return false;
  if (ETIKET.test(t) && woorden.length < 6) return false;
  return true;
}

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
      stukken.push({ zin: t, regel: alineaRegel, kop, kopNr, kopRegel, as: 'woord',
        inGrenssectie: grensNiveau > 0 });
    }
  };

  ruw.forEach((regel, i) => {
    if (/^\s*```/.test(regel)) { sluitAlinea(); inCode = !inCode; over.codeblok++; return; }
    if (inCode) { over.codeblok++; return; }
    if (/^\s*\|/.test(regel)) { sluitAlinea(); over.tabel++; return; }
    /* EEN `>` IS IN DIT HUIS NADRUK EN GEEN CITAAT, en die aanname was fout.
       WERELD.md zet zijn hardste zin als blokcitaat -- *"Er is een beginscherm,
       en dat is de werktafel van RTG Command"* -- en die is een WET in
       WETTEN.json. Hem overslaan als "een citaat uit een ander document" maakte
       de extractor blind voor zijn eigen bron. De regel wordt dus gelezen, met
       het teken eraf. */
    if (/^\s*>/.test(regel)) {
      over.citaat++;
      regel = regel.replace(/^\s*>\s?/, '');
      if (!regel.trim()) { sluitAlinea(); return; }
    }
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
      if (verklaring(kop)) {
        /* Het paragraafnummer staat al in `paragraaf`; in de kandidaattekst is
           het ruis voor wie de lijst leest. */
        stukken.push({ zin: kop.replace(/^[\d.]+\s*/, '').trim(), regel: i + 1, kop, kopNr, kopRegel,
          as: 'structuur', vorm: 'kop', inGrenssectie: grensNiveau > 0 });
      }
      return;
    }
    if (!regel.trim()) { sluitAlinea(); return; }
    /* Een nieuw opsommingsteken begint een nieuwe uitspraak, ook zonder lege
       regel ertussen -- anders lopen zeven grenzen in een lijst aan elkaar. */
    if (/^\s*(\d+\.|[-*])\s+/.test(regel)) sluitAlinea();
    if (!alinea.length) {
      alineaRegel = i + 1;
      /* DE VETTE OPENINGSZIN IS DE TWEEDE STRUCTUURVORM. ISOLATIE.md schrijft
         zijn vier SEC-LOCK-wetten zo: **SEC-LOCK-004 -- onbekend is niet
         normaal.** Dat is dezelfde handeling als een kop zetten, alleen
         midden in een paragraaf. Zonder deze vorm bleef de extractor blind
         voor alle vier. */
      const vet = regel.replace(/^\s*(\d+\.|[-*])\s+/, '').match(/^\*\*(.+?)\*\*/);
      if (vet && verklaring(vet[1])) {
        stukken.push({ zin: vet[1].trim(), regel: i + 1, kop, kopNr, kopRegel, as: 'structuur',
          vorm: 'vet', inGrenssectie: grensNiveau > 0 });
      }
    }
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

/* --------------------------------------------- de recall tegen de grondwaarheid */

/* HOEVEEL VAN DE WETTEN DIE DIT HUIS AL KENT, VINDT DEZE EXTRACTOR TERUG?

   Dit is de belangrijkste meter van het bestand, en hij bestaat omdat er een
   GRONDWAARHEID ligt die niemand hoeft te maken: WETTEN.json. Elke wet daarin
   wijst een plek aan waar aantoonbaar een harde uitspraak staat -- vastgesteld
   door een mens, met een handhaver en een sabotage eronder. Vindt de extractor
   op die plek niets, dan is hij blind voor een BEKENDE wet, en dan zegt zijn
   getal over de onbekende ook niets.

   Zonder deze meter rapporteerde de eerste versie 1088 kandidaten zonder enige
   uitspraak over zijn eigen trefzekerheid -- en hij haalde 21 van de 50. Een
   instrument dat 42% van het bewijsbare mist en dat niet zegt, is gevaarlijker
   dan geen instrument.

   DRIE UITSLAGEN, EN ZE WORDEN NOOIT OPGETELD:
     gevonden          de extractor vond een kandidaat in de sectie van het anker
     gemist            er staat daar tekst, en hij zag hem niet -- ECHTE blindheid
     ankerZonderTekst  het anker wijst een codeblok of tabel aan; daar staat geen
                       zin, dus dit is geen tekort van de extractor maar een
                       eigenschap van de bron. Wie die twee optelt, jaagt op een
                       getal dat niet van hem is (CODE.md: de fout zat in de METER). */
function ijkTegenWetten(wettenPerDoc, docs) {
  const uit = { bekend: 0, gevonden: 0, gemist: [], ankerZonderTekst: [] };
  for (const [doc, ws] of Object.entries(wettenPerDoc)) {
    if (docs && !docs.includes(doc)) continue;
    let regels, stukken;
    try {
      regels = fs.readFileSync(path.join(WORTEL, doc), 'utf8').split('\n');
      stukken = leesDocument(doc).stukken;
    } catch (e) { continue; }
    const raak = new Set();
    for (const s of stukken) {
      if (s.as === 'structuur') { raak.add(s.kopRegel); continue; }
      const sig = signaalVan(s.zin, s.inGrenssectie);
      if (sig && sig.sterkte === 'sterk') raak.add(s.kopRegel);
    }
    for (const [kop, ids] of ankersPerKop(doc, ws)) {
      for (const id of ids) {
        uit.bekend++;
        if (raak.has(kop)) { uit.gevonden++; continue; }
        const w = ws.find(x => x.id === id);
        const ix = regels.findIndex(r => r.includes(w.bron.anker));
        let hekjes = 0;
        for (let i = 0; i < ix; i++) if (/^\s*```/.test(regels[i])) hekjes++;
        if (hekjes % 2 === 1 || /^\s*\|/.test(regels[ix] || '')) {
          uit.ankerZonderTekst.push({ id, doc, waarom: 'het anker wijst een codeblok of tabel aan; daar staat geen zin om te vinden' });
        } else {
          uit.gemist.push({ id, doc, anker: w.bron.anker });
        }
      }
    }
  }
  return uit;
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
      let sig;
      if (s.as === 'structuur') {
        /* De structuuras vraagt GEEN signaalwoord: de kop of de vette
           openingszin is zelf de handeling. Zie verklaring(). */
        sig = { sterkte: 'sterk', signaal: s.vorm, grond: 'structuur' };
      } else {
        sig = signaalVan(s.zin, s.inGrenssectie);
        if (!sig) continue;
      }
      const uitgesloten = GEEN_UITSPRAAK.find(([re]) => re.test(s.zin));
      if (uitgesloten) { over.geenUitspraak++; continue; }
      if (sig.sterkte === 'zwak') { zwak++; continue; }
      const wet = ankers.get(s.kopRegel) || null;
      kandidaten.push({
        doc, paragraaf: s.kopNr, kop: s.kop, regel: s.regel, zin: s.zin,
        as: s.as, signaal: sig.signaal, grond: sig.grond, inGrenssectie: s.inGrenssectie,
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

  const ijking = ijkTegenWetten(wettenPerDoc, DOC_FILTER ? [DOC_FILTER] : null);
  const gedekt = kandidaten.filter(k => k.stand === 'gedekt').length;
  const structuur = kandidaten.filter(k => k.as === 'structuur').length;
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
    grens: 'LEXICAAL EN STRUCTUREEL, in twee assen die nooit worden opgeteld. De ijking hieronder zegt wat deze ' +
      'extractor terugvindt van de wetten die dit huis AL kent (de recall); over de PRECISIE is niets gemeten -- van de ' +
      'kandidaten is niet vastgesteld welk deel werkelijk een harde uitspraak is. Het aantal is dus een werkvoorraad ' +
      'voor een mens en geen oordeel, en zeker geen percentage dat naar 100 moet: meerdere zinnen uit meerdere ' +
      'documenten beschrijven vaak een onderliggende wet, en daarvoor staan de groepen.',
    telling: {
      documenten: docs.length,
      zinnen,
      kandidatenSterk: kandidaten.length,
      /* TWEE ASSEN, NOOIT OPGETELD TOT EEN OORDEEL. De structuuras (koppen en
         vette openingszinnen) draagt de recall: 39 van de 48 gevonden wetten
         staan alleen daar. De woordas draagt de verbodsvormen in lopende tekst.
         Ze meten iets anders en een gemiddelde ervan betekent niets -- dezelfde
         reden waarom scripts/tredeproef.js zuiver en beproefd apart houdt. */
      kandidatenStructuur: structuur,
      kandidatenWoord: kandidaten.length - structuur,
      kandidatenZwak: zwak,
      gedekt,
      onbepaald: kandidaten.length - gedekt,
      inGrenssectie: kandidaten.filter(k => k.inGrenssectie).length,
      wettenInRegister: wetten.length,
      documentenMetKandidaat: Object.keys(perDoc).length,
      groepen: groepen.length,
      groepenOverMeerdereDocumenten: meerdereDocs.length,
    },
    ijking: {
      uitleg: 'De recall van deze extractor, gemeten tegen WETTEN.json als grondwaarheid: elke wet daar ' +
        'wijst een plek aan waar een mens heeft vastgesteld dat er een harde uitspraak staat. Vindt de ' +
        'extractor daar niets, dan is hij blind voor een BEKENDE wet -- en dan zegt zijn getal over de ' +
        'onbekende uitspraken evenmin iets.',
      wettenBekend: ijking.bekend,
      gevonden: ijking.gevonden,
      gemist: ijking.gemist,
      ankerZonderTekst: ijking.ankerZonderTekst,
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
  console.log(K.vet + '  DE DOCTRINE, GELEZEN OP STRUCTUUR EN WOORD' + K.uit + K.grijs + '  (graad: vermoed -- recall gemeten, precisie niet)' + K.uit);
  console.log('');
  console.log('    ' + String(t.documenten).padStart(6) + '  documenten gelezen');
  console.log('    ' + String(t.kandidatenStructuur).padStart(6) + '  op de STRUCTUURas' + K.grijs +
    ' (koppen en vette openingszinnen -- de kop is zelf de bewering)' + K.uit);
  console.log('    ' + String(t.kandidatenWoord).padStart(6) + '  op de WOORDas' + K.grijs +
    ' (verbodsvormen in lopende tekst)' + K.uit);
  console.log(K.grijs + '           de twee worden niet opgeteld tot een oordeel; ze meten iets anders' + K.uit);
  console.log('    ' + String(t.kandidatenZwak).padStart(6) + K.grijs + '  zwakke signalen (moet, altijd, hoort) -- geteld, niet uitgeschreven' + K.uit);
  console.log('    ' + K.groen + String(t.gedekt).padStart(6) + K.uit + '  kandidaten die een wet in WETTEN.json aanwijst');
  console.log('    ' + K.geel + String(t.onbepaald).padStart(6) + K.uit + '  onbepaald' + K.grijs +
    ' -- geen wet in dezelfde paragraaf; dat is niet hetzelfde als ongehandhaafd' + K.uit);
  console.log('    ' + String(t.inGrenssectie).padStart(6) + '  daarvan in een expliciete grenssectie');
  console.log('    ' + String(t.groepenOverMeerdereDocumenten).padStart(6) + '  groepen die over meer dan een document lopen' +
    K.grijs + ' (kandidaat om samen te nemen)' + K.uit);
  console.log('');
  const ij = uit.ijking;
  const pct = ij.wettenBekend ? Math.round((ij.gevonden / ij.wettenBekend) * 100) : 0;
  console.log(K.vet + '  DE IJKING -- vindt hij de wetten terug die dit huis AL kent?' + K.uit);
  console.log('    ' + (pct >= 90 ? K.groen : K.geel) + String(ij.gevonden).padStart(6) + ' van ' +
    ij.wettenBekend + K.uit + '  (' + pct + '%)');
  if (ij.gemist.length) {
    console.log('    ' + K.geel + String(ij.gemist.length).padStart(6) + K.uit + '  ECHT gemist: ' +
      ij.gemist.map(g => g.id).join(', '));
  }
  if (ij.ankerZonderTekst.length) {
    console.log('    ' + K.grijs + String(ij.ankerZonderTekst.length).padStart(6) +
      '  anker wijst een codeblok of tabel aan -- geen zin om te vinden, geen tekort van de extractor' + K.uit);
  }
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
