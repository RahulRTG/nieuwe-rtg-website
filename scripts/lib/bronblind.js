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

   Deze kruisproef scheidt wel: 7 bestanden nu tegen 45 bestanden en 239.502
   kwijtgeraakte tokens onder de kapotte versie. Vier ordes van grootte, en de
   grens hangt niet aan een drempel die iemand heeft gekozen.

   WAT ER NU NOG BLIND IS, EN WAAROM DE NORM OP 7 STAAT EN NIET OP 0. Alle zeven
   zijn dezelfde vorm: commentaar BINNEN een template-literal die over meerdere
   regels loopt (CSS in een backtick-string, met /* ... *\/ erin -- die
   backslash staat er niet in de echte bron, want zonder hem sluit dit
   voorbeeld deze uitleg af; dezelfde streep en dezelfde reden als in de kop
   van ./bron.js). ./bron.js
   begrenst een string bewust per regel -- zie zijn eigen kop -- en ziet zo'n
   template dus niet als string. Wat hij daar weghaalt is in alle zeven gevallen
   echt commentaar, alleen van een andere taal, dus er gaat vandaag geen code
   verloren. Het MECHANISME is wel hetzelfde als dat van 17 augustus: een
   template met een openend /* zonder sluiter erin zou wel degelijk door de
   echte code heen eten. Zeven is daarom een stand, geen doel.

   DE GRENS VAN DEZE PROEF, HARDOP: hij dekt .js en niets anders. De lexer
   spreekt JavaScript, geen HTML en geen CSS -- en juist public/apps/app.html
   was met 59.166 tekens het op een na ergste geval van 17 augustus, met twee
   <video>-elementen die daardoor buiten het bereik van elke scanner vielen. Die
   kant hangt nog volledig op test/bron.test.js. Dat staat als open regel in
   TAKEN.md en hoort niet stilletjes voor gedekt door te gaan.

   EEN LEXFOUT TELT MEE ALS BLIND. Een bestand dat de lexer niet kan lezen is
   een bestand waarover deze proef niets zegt, en LAT.md regel 10 is helder over
   het verschil tussen "in orde" en "ik heb niet gekeken". Vandaag zijn het er
   nul over 4061 bestanden; wordt het er een, dan hoort iemand te kijken in
   plaats van dat het getal gelijk blijft. */
'use strict';
const fs = require('fs');
const path = require('path');
const { zonderCommentaar } = require('./bron');
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

function jsBestanden(wortel, mappen) {
  const uit = [];
  const ga = (dir) => {
    let namen; try { namen = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return; }
    for (const e of namen) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { if (!OVERSLAAN.test(e.name)) ga(p); }
      else if (e.name.endsWith('.js')) uit.push(p);
    }
  };
  for (const m of mappen) { const d = path.join(wortel, m); if (fs.existsSync(d)) ga(d); }
  return uit.sort();
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

function meetBlind({ wortel, mappen = ['public', 'server', 'scripts', 'test'], strip } = {}) {
  const uit = { bestanden: 0, lexfout: 0, blind: 0, tokensKwijt: 0, lijst: [] };
  for (const vol of jsBestanden(wortel, mappen)) {
    let bron, st;
    try { st = fs.statSync(vol); bron = fs.readFileSync(vol, 'utf8'); } catch (e) { continue; }
    if (!bron.length) continue;
    uit.bestanden++;
    const sleutel = strip ? null : vol + '|' + st.mtimeMs + '|' + st.size;
    const r = (sleutel && TAFEL.has(sleutel)) ? TAFEL.get(sleutel) : blindIn(bron, strip);
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

module.exports = { blindIn, meetBlind, jsBestanden };
