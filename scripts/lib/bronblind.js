/* DE KRUISPROEF OP DE COMMENTAAR-VERWIJDERAAR.

   ./bron.js haalt commentaar uit broncode voordat een keuring of meter hem
   leest. check.js leunt daar op elf plekken op, en keuring.js, norm.js,
   schakelbaar.js en ai-oproepen.js ook. Op 17 augustus 2026 bleek hij 224.031
   tekens BRONCODE op te eten: 47 bestanden waren deels onzichtbaar voor elke
   keuring die op hem leunde, en er was geen melding en geen afwijkende telling.
   De kop van ./bron.js vertelt dat hele verhaal.

   Die fout is gerepareerd en test/bron.test.js bewaakt de vijf vormen die hem
   opleverden. Maar dat is een lijst van BEKENDE gevallen, en de vangrail
   daaronder ("nooit meer weghalen dan de oude regex deed") is verankerd aan
   precies de kapotte versie van toen. Een zesde vorm die nog niemand heeft
   bedacht komt daar ongemerkt doorheen.

   DIT IS DE TWEEDE MENING, EN HIJ KENT DE TAAL. scripts/ast/lexer.js is een
   volledige, met de hand geschreven JavaScript-lexer die voor de AST-scanner is
   gebouwd. Een lexer weet per teken of hij in code, in een string, in een
   template of in commentaar zit -- dat is zijn werk. Hij is volstrekt
   onafhankelijk van ./bron.js: andere schrijver, ander doel, andere aanpak.

   De eigenschap die we kruisen is deze, en hij staat in de kop van ./bron.js
   als belofte: COMMENTAAR ERUIT, STRINGS ERIN. Dus: elke token die de lexer
   ziet is per definitie geen commentaar, en zijn ruwe tekst hoort dus nog
   ONGESCHONDEN in de gestripte uitvoer te staan, in dezelfde volgorde. Raakt er
   een token kwijt, dan heeft de verwijderaar iets weggehaald wat code was.

   WAAROM DE VOOR DE HAND LIGGENDE METERS NIET WERKEN -- gemeten, niet gedacht,
   over 4364 bestanden en 36,7 miljoen tekens:

     verwijderRATIO per bestand   Dit huis becommentarieert zwaar: 27 bestanden
                                  zitten legitiem boven de 80%, de hoogste op
                                  89%. De blinde stand van 17 augustus gaf
                                  dezelfde top-8 en verschoof de telling boven
                                  50% van 529 naar 526. Scheidt niets.
     tekens weg, totaal           8.371.477 nu tegen 8.597.303 blind: 2,7%
                                  verschil, en dat getal loopt met elke regel
                                  commentaar die iemand erbij schrijft. Ruis.
     grootste blok in een bestand 103.819 nu tegen 129.702 blind. Een echte
                                  drempel ligt niet tussen die twee.

   Deze kruisproef scheidt wel: de huidige logische bronnen staan op nul
   ongedekt, terwijl de kapotte versie van 17 augustus 45 bestanden en 239.502
   kwijtgeraakte tokens opleverde. Vier ordes van grootte, zonder gekozen
   ratio-drempel.

   DE LAATSTE DRIE WAREN GEEN DRIE PROGRAMMA'S. Drie delen van
   shared/werkos.js waren midden in één CSS-template geknipt. Als losse
   bestanden zijn ze terecht niet te lexen; als programma bestaan ze alleen
   samengevoegd. Ze als drie lexfouten tellen was dus een fout in de EENHEID
   van deze meter. Sinds 1 oktober 2026 leest meetBlind() alle bundels uit
   scripts/bundel.js als hun canonieke, byte-voor-byte samengevoegde bron. De
   bouwuitvoer wordt niet vertrouwd en losse fragmenten worden niet dubbel
   geteld. Daarom staat de meter nu inhoudelijk op nul.

   DE GRENS VAN DEZE PROEF, HARDOP. Sinds 19 augustus dekt hij ook .html: de
   inline scriptblokken via de lexer, en de MARKUP via de eis dat daar helemaal
   niets verdwijnt -- want buiten een <script> is een blokcommentaar geen
   commentaar maar tekst die een bezoeker leest. De inhoud van een <style> wordt
   overgeslagen; daar zijn het wel echte CSS-commentaren.

   Nagemeten met de kapotte verwijderaar van 17 augustus: negen pagina's raken
   dan 66.532 stukken kwijt, met kantoren.html als ergste (22.117) en app.html op
   647 markupregels -- precies het geval dat in de kop van ./bron.js staat als
   "784 regels markup en script".

   CSS EN MARKUP HEBBEN HUN EIGEN TAALREGEL. Losse .css-bestanden worden met
   stukkenCss() gelezen: blokcommentaar mag weg, `//` niet. HTML-markup blijft
   volledig staan, behalve echte CSS-commentaren binnen <style>. De bekende
   valstrikken staan als tegenproef in test/bronblind.test.js.

   EEN LEXFOUT TELT MEE ALS BLIND. Een logisch programma dat de lexer niet kan
   lezen is een programma waarover deze proef niets zegt, en LAT.md regel 10 is helder over
   het verschil tussen "in orde" en "ik heb niet gekeken". Vandaag zijn het er
   nul; wordt het er een, dan hoort iemand te kijken in
   plaats van dat het getal gelijk blijft. */
'use strict';
const fs = require('fs');
const path = require('path');
const { zonderCommentaar, stukken } = require('./bron');
const { lex } = require('../ast/lexer');

const OVERSLAAN = /^(node_modules|\.git|data|dist)$/;

/* Per bestand. `strip` is meegegeven en niet vast, zodat de ijking deze proef
   een BEKEND BLINDE verwijderaar kan voeren en kan zien dat hij uitslaat --
   anders is dit zelf een meter die niemand ooit heeft zien bewegen. */
function blindIn(bron, strip = zonderCommentaar) {
  let tokens;
  try { tokens = lex(bron); } catch (e) { return { lexfout: true, kwijt: 0, eerste: null }; }
  const gestript = strip(bron);
  let cursor = 0, kwijt = 0, eerste = null;
  for (const t of tokens) {
    if (t.type === 'eof') continue;
    const tekst = bron.slice(t.start, t.end);
    if (!tekst.trim()) continue;
    /* Vooruit zoeken vanaf de cursor, nooit terug: zo bewaakt deze lus ook de
       VOLGORDE. Een verwijderaar die code verplaatst in plaats van weghaalt
       zou anders ongemerkt slagen. */
    const p = gestript.indexOf(tekst, cursor);
    if (p < 0) { kwijt++; if (eerste === null) eerste = tekst.slice(0, 80); }
    else cursor = p + tekst.length;
  }
  return { lexfout: false, kwijt, eerste };
}

/* DE HTML-KANT, en die was het gevaarlijkst.

   public/apps/app.html was op 17 augustus met 59.166 tekens het op een na
   ergste geval: 784 regels markup en script vielen buiten het bereik van elke
   scanner, en twee <video>-elementen werden daardoor door geen enkele keuring
   gezien. De kruisproef hierboven dekte dat niet -- de lexer spreekt JavaScript
   en geen HTML.

   Wat wel kan: de INLINE SCRIPTS eruit halen en die lexen. Dat dekt de markup
   niet rechtstreeks, maar het vangt wel precies de schade die telt: een openend
   commentaarteken in een attribuut (accept="image/*") eet VOORUIT, en op een
   pagina die iets doet komt daar vroeg of laat een scriptblok achteraan. Loopt
   er bron weg, dan raakt dit blok tokens kwijt.

   Het knippen gebeurt op dezelfde manier als in scripts/check.js regel 12, dat
   elk inline script al ontleedt -- maar dan met de vraag "staat het er na het
   strippen nog", in plaats van "is het geldige JS". */
/* stukken() komt uit ./bron.js. Hij stond hier, en toen de verwijderaar zelf
   HTML leerde lezen zou dat de tweede kopie zijn geworden: de proef zou een
   pagina dan anders in stukken kunnen knippen dan de verwijderaar die hij
   meet, en dan bewijst hij iets over een andere indeling (LAT.md regel 4). */

/* EEN PAGINA, TWEE SOORTEN BRON, EEN CURSOR.

   In een SCRIPT is elke token van de lexer code, en die hoort na het strippen
   nog te staan. In de MARKUP is `/* *\/` helemaal geen commentaar -- dat is
   CSS- en JS-notatie, geen HTML -- dus daar hoort de verwijderaar NIETS weg te
   halen. Alleen de inhoud van een <style> wordt overgeslagen: daar zijn het
   wel echte CSS-commentaren, en die mogen weg.

   De cursor loopt door beide heen, in documentvolgorde. Dat toetst niet alleen
   of iets er nog staat maar ook of het op zijn plek staat: een verwijderaar die
   bron verplaatst in plaats van weghaalt, komt er zo ook niet doorheen.

   Gemeten met de kapotte verwijderaar van 17 augustus: acht pagina's raken
   60.014 script-tokens kwijt en zeven pagina's 926 markupregels, met app.html
   op 647 -- precies het geval dat in de kop van ./bron.js beschreven staat als
   "784 regels markup en script". */
function blindInHtml(bron, strip = zonderCommentaar) {
  /* GEEN VROEGE UITSTAP VOOR EEN PAGINA ZONDER SCRIPT. Die stond hier eerst, en
     dat was precies verkeerd om: juist een pagina met alleen markup heeft geen
     tweede net. stukken() geeft dan een enkel markupdeel terug en dat hoort
     gewoon nagelopen te worden. */
  const delen = stukken(bron);
  /* MET DE SOORT ERBIJ, want deze proef hoort te meten wat de keuringen ECHT
     doen. Een meegegeven `strip` (de ijking) negeert de tweede parameter en
     blijft dus gewoon uitslaan. */
  const gestript = strip(bron, { soort: 'html' });
  let kwijt = 0, eerste = null, lexfout = false, cursor = 0;
  const mis = (tekst) => { kwijt++; if (eerste === null) eerste = tekst.slice(0, 80); };

  for (const deel of delen) {
    if (deel.soort === 'style') continue;                 // CSS-commentaar mag weg
    if (deel.soort === 'script') {
      let tokens;
      try { tokens = lex(deel.tekst); } catch (e) { lexfout = true; continue; }
      for (const t of tokens) {
        if (t.type === 'eof') continue;
        const tekst = deel.tekst.slice(t.start, t.end);
        if (!tekst.trim()) continue;
        const q = gestript.indexOf(tekst, cursor);
        if (q < 0) mis(tekst); else cursor = q + tekst.length;
      }
      continue;
    }
    for (const regel of deel.tekst.split('\n')) {
      const t = regel.trim();
      if (!t) continue;
      const q = gestript.indexOf(t, cursor);
      if (q < 0) mis(t); else cursor = q + t.length;
    }
  }
  return { lexfout, kwijt, eerste };
}

/* DE CSS-KANT, en die was de laatste blinde vlek van deze proef.

   In een stylesheet is een blokcommentaar een ECHT commentaar en mag het weg --
   daar verschilt CSS niet van JavaScript. Waar hij wel verschilt is de andere
   vorm: `//` is in CSS geen commentaar maar gewoon twee schuine strepen, en die
   staan in een stylesheet op een plek waar je ze niet verwacht:

     background:url(//static.example/x.png)
     grid-area:1//2 in een preprocessor-uitvoer

   ./bron.js kent alleen JavaScript en eet daar de rest van de REGEL op. Zijn
   uitzondering (een dubbele punt ervoor, voor `http://`) dekt `url(//` niet: het
   teken ervoor is een haakje.

   VANDAAG SLAAT DAT NERGENS UIT -- geen van de 72 stylesheets bevat zo`n vorm,
   gemeten en niet aangenomen. Dat is precies waarom hij hier gedekt hoort te
   worden en niet gerepareerd: de valstrik staat open, en zonder proef zou de
   eerste die hem intrapt er stil in vallen. Dezelfde afweging als bij de
   markuptekst hierboven.

   DE TWEEDE MENING KENT CSS. Er is geen CSS-lexer in dit huis en er komt er hier
   geen die dat woord verdient; wat deze proef nodig heeft is smaller. Hij loopt
   de stylesheet een keer door met drie standen -- code, tekenreeks, commentaar --
   en levert de CODE-stukken op. Elk niet-leeg stuk hoort na het strippen nog te
   staan, in dezelfde volgorde. Dat is dezelfde belofte als hierboven (commentaar
   eruit, de rest erin) en dezelfde cursor die ook de VOLGORDE bewaakt. */
function stukkenCss(bron) {
  const uit = [];
  const n = bron.length;
  let i = 0, begin = 0;
  while (i < n) {
    const c = bron[i];
    if (c === '/' && bron[i + 1] === '*') {
      if (i > begin) uit.push(bron.slice(begin, i));
      const eind = bron.indexOf('*/', i + 2);
      if (eind < 0) { begin = n; break; }          // niet gesloten: de rest is commentaar
      i = eind + 2; begin = i;
      continue;
    }
    /* Een tekenreeks wordt OVERGESLAGEN en niet apart opgeleverd: wat erin staat
       kan er als `/*` uitzien en is dat niet. Hij blijft deel van het codestuk
       eromheen, precies zoals ./bron.js hem laat staan. */
    if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < n && bron[j] !== c && bron[j] !== '\n') { if (bron[j] === '\\') j++; j++; }
      i = (j < n && bron[j] === c) ? j + 1 : i + 1;
      continue;
    }
    i++;
  }
  if (begin < n) uit.push(bron.slice(begin));
  return uit;
}

/* Een stylesheet. Per CODE-stuk regel voor regel: staat elke niet-lege regel na
   het strippen nog op zijn plek? Regels en niet tokens, want er is hier geen
   lexer die tokens levert -- en een regel is fijn genoeg om `url(//...)` te zien
   verdwijnen, wat het geval is waar deze proef voor bestaat. */
function blindInCss(bron, strip = zonderCommentaar) {
  const gestript = strip(bron, { soort: 'css' });
  let kwijt = 0, eerste = null, cursor = 0;
  for (const stuk of stukkenCss(bron)) {
    for (const regel of stuk.split('\n')) {
      const t = regel.trim();
      if (!t) continue;
      const q = gestript.indexOf(t, cursor);
      if (q < 0) { kwijt++; if (eerste === null) eerste = t.slice(0, 80); }
      else cursor = q + t.length;
    }
  }
  return { lexfout: false, kwijt, eerste };
}

function bronBestanden(wortel, mappen) {
  const uit = [];
  const ga = (dir) => {
    let namen; try { namen = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return; }
    for (const e of namen) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { if (!OVERSLAAN.test(e.name)) ga(p); }
      else if (/\.(js|html|css)$/.test(e.name)) uit.push(p);
    }
  };
  for (const m of mappen) { const d = path.join(wortel, m); if (fs.existsSync(d)) ga(d); }
  return uit.sort();
}

/* EEN BUNDEL IS EEN PROGRAMMA, OOK ALS DE BRON OP SCHIJF IN DELEN LIGT.

   De eerste versie van deze kruisproef liep elk .js-bestand afzonderlijk na.
   Dat is voor gewone modules juist, maar niet voor de bundeldelen uit
   scripts/bundel.js: zo'n deel mag midden in een functie of sjabloon beginnen
   en eindigen. Drie delen van shared/werkos.js werden daardoor als lexfout
   geboekt, terwijl hun byte-voor-byte samenvoeging een geldig programma is.

   Alleen de gegenereerde uitvoer lezen zou die valse fout ook verbergen, maar
   introduceert een ernstiger gat: een achterlopende uitvoer kan groen zijn
   terwijl de canonieke delen al veranderd zijn. Daarom bouwen we hier de
   LOGISCHE bron rechtstreeks uit de delen op. De uitgecheckte uitvoer en alle
   delen verdwijnen uit de gewone lijst en worden vervangen door precies een
   eenheid met de samengevoegde inhoud. scripts/bundel.js bewaakt elders dat de
   uitvoer ermee overeenkomt; deze meter hoeft die tweede, andere bewering niet
   nogmaals te doen.

   `bundels` is injecteerbaar voor de proef. Zonder die invoer gebruiken we
   uitsluitend in de echte werkboom het centrale bundelregister; een tijdelijke
   map krijgt nooit per ongeluk de bundels van deze checkout opgelegd. */
function bronEenheden(wortel, mappen, bundels) {
  const gewone = new Map(bronBestanden(wortel, mappen).map(vol => [path.resolve(vol), { vol }]));
  const echteWortel = path.resolve(path.join(__dirname, '..', '..'));
  let register = bundels;
  if (register === undefined && path.resolve(wortel) === echteWortel) {
    try { register = require('../bundel').bundels; } catch (e) { register = null; }
  }
  if (!register || !mappen.includes('public')) return [...gewone.values()].sort((a, b) => a.vol.localeCompare(b.vol));

  for (const [uitvoer, deelMap] of Object.entries(register)) {
    const doel = path.resolve(wortel, 'public', uitvoer);
    const dir = path.resolve(wortel, 'public', deelMap);
    let delen;
    try {
      delen = fs.readdirSync(dir).filter(n => n.endsWith('.js')).sort().map(n => path.join(dir, n));
    } catch (e) { continue; }
    if (!delen.length) continue;

    gewone.delete(doel);
    for (const deel of delen) gewone.delete(path.resolve(deel));
    const brokken = [], afdruk = [];
    let leesfout = false;
    for (const deel of delen) {
      try {
        const st = fs.statSync(deel);
        brokken.push(fs.readFileSync(deel));
        afdruk.push(st.mtimeMs + ':' + st.size);
      } catch (e) { leesfout = true; break; }
    }
    /* Een onleesbare bron mag niet door de virtuele eenheid worden verstopt.
       Laat in dat zeldzame geval de delen in de gewone lijst staan; de normale
       leesweg beslist dan per bestand wat er werkelijk gezien kon worden. */
    if (leesfout) {
      for (const deel of delen) gewone.set(path.resolve(deel), { vol: path.resolve(deel) });
      continue;
    }
    gewone.set(doel, { vol: doel, bron: Buffer.concat(brokken).toString('utf8'), afdruk: afdruk.join('|') });
  }
  return [...gewone.values()].sort((a, b) => a.vol.localeCompare(b.vol));
}

/* De uitslag per bestand blijft binnen dit proces bewaard, op PAD + WIJZIGTIJD +
   OMVANG. Dat is geen snelheidstruc om de meter heen: verandert er een teken in
   een bestand, dan verandert zijn mtime of zijn omvang en wordt hij opnieuw
   gelezen. Alleen een bestand dat aantoonbaar hetzelfde is, wordt overgeslagen.

   Waarom het er is: de kruisproef lext 4062 bestanden en kost zo'n vijf seconden,
   en test/meterijk.test.js roept norm.meet() tientallen keren aan -- een keer per
   ijking, elk met een tijdelijk bestand erbij. Zonder deze tafel zou een meter
   die over blindheid gaat de ijking van alle ANDERE meters onbetaalbaar maken,
   en dat is precies hoe een keuring stilletjes uit een suite verdwijnt.

   Alleen `strip` weglaten mag hier cachen: een meegegeven verwijderaar is per
   definitie een andere meting (dat is de ijking), en die slaat de tafel over.

   DE BEKENDE GRENS, want een cache die je niet wantrouwt is een cache die liegt:
   een bestand dat binnen dezelfde milliseconde wordt overschreven MET dezelfde
   omvang, ziet deze tafel niet. Dat is dezelfde afspraak die make en elke
   bouwcache maken. De tafel leeft bovendien alleen binnen een proces: elke
   nieuwe `npm run norm` begint leeg en meet alles opnieuw. */
const TAFEL = new Map();

function meetBlind({ wortel, mappen = ['public', 'server', 'scripts', 'test'], strip, bundels } = {}) {
  const uit = { bestanden: 0, lexfout: 0, blind: 0, tokensKwijt: 0, lijst: [] };
  for (const eenheid of bronEenheden(wortel, mappen, bundels)) {
    const vol = eenheid.vol;
    let bron, st;
    try {
      if (eenheid.bron !== undefined) { bron = eenheid.bron; st = { mtimeMs: eenheid.afdruk, size: bron.length }; }
      else { st = fs.statSync(vol); bron = fs.readFileSync(vol, 'utf8'); }
    } catch (e) { continue; }
    if (!bron.length) continue;
    uit.bestanden++;
    const sleutel = strip ? null : vol + '|' + st.mtimeMs + '|' + st.size;
    /* Een .js-bestand is in zijn geheel code; van een .html telt alleen wat er
       in de inline scriptblokken staat, plus de eis dat er in de markup NIETS
       verdwijnt; een .css levert zijn codestukken zelf. Drie proeven, een meter
       -- want de vraag is dezelfde: raakt de verwijderaar hier bron kwijt? */
    const proef = vol.endsWith('.html') ? blindInHtml : (vol.endsWith('.css') ? blindInCss : blindIn);
    const r = (sleutel && TAFEL.has(sleutel)) ? TAFEL.get(sleutel) : proef(bron, strip);
    if (sleutel) TAFEL.set(sleutel, r);
    const rel = path.relative(wortel, vol).replace(/\\/g, '/');
    if (r.lexfout) { uit.lexfout++; uit.lijst.push({ bestand: rel, reden: 'lexfout' }); continue; }
    if (r.kwijt) {
      uit.blind++; uit.tokensKwijt += r.kwijt;
      uit.lijst.push({ bestand: rel, tokens: r.kwijt, eerste: r.eerste });
    }
  }
  /* De meter is de SOM: een bestand dat de proef kwijtraakt en een bestand dat
     de proef niet kan lezen zijn allebei een bestand zonder dekking. */
  uit.ongedekt = uit.blind + uit.lexfout;
  return uit;
}

module.exports = { blindIn, blindInHtml, blindInCss, stukken, stukkenCss, meetBlind, bronBestanden, bronEenheden };
