#!/usr/bin/env node
/* ============================================================================
   WAT MAAKT TWEE AANROEPEN HETZELFDE VERZOEK? -- per metIdem-aanroepplek.

   WAAROM DIT ER IS. `server/lib/idem-contract.js` verklaart sinds 14 september
   per capability welke velden de identiteit van een verzoek dragen. Er staat er
   EEN op (`bank.pas.uitgeven`), en de tweede kwam er niet bij omdat iemand hem
   mooi vond maar omdat de METING een gebrek vond: /api/supplier/betaalverzoek
   vergeleek alleen het bedrag, dus dezelfde sleutel met een andere ONTVANGER
   gaf 200 met `herhaald: true` -- de tweede ontvanger kreeg niets en de balie
   las "gelukt".

   De vraag is dus niet welke capability we hierna migreren, maar WAAR NOG ZO'N
   GAT ZIT. Dat is een meting en geen smaak, en dit is die meting.

   WAT HIJ MEET, en dat is smaller dan de vraag:

     sleutel     het EERSTE argument van metIdem -- waaronder een herhaling
                 wordt teruggevonden
     afdruk      het TWEEDE -- waaraan de laag ziet dat twee oproepen met
                 dezelfde sleutel toch een ANDER verzoek dragen
     namen       de identifiers die in elk van die twee voorkomen, lexicaal

   En daaruit EEN uitspraak per aanroepplek, met opzet grof:

     verklaard         de afdruk komt uit idem-contract.js (identiteitVan)
     geenAfdruk        er is geen tweede argument, of het is `null`. Een tweede
                       aanroep met dezelfde sleutel krijgt dan ALTIJD het eerste
                       antwoord terug, wat er ook veranderd is.
     voegtNietsToe     elke naam in de afdruk staat al in de sleutel. De afdruk
                       kan dan per constructie nooit verschillen bij een gelijke
                       sleutel -- hij is er wel, en hij kan niets tegenhouden.
     voegtToe          de afdruk draagt minstens een naam die de sleutel niet
                       heeft. Dat is de gezonde vorm.
     nietTeLezen       de aanroep is niet te ontleden. Staat er MET de reden in
                       en telt nergens in mee.

   WAT HIJ NIET IS. `voegtNietsToe` is GEEN defect en geen beschuldiging. Bij
   kern/pay/partner.js is het een uitgeschreven besluit: een uitbetaling heeft
   geen parameters buiten de partner, want het gaat altijd om het beschikbare
   saldo, en het bedrag verschilt legitiem per moment. Dit is dus een
   TRIAGELIJST -- precies zoals DOODSPOOR.json er een is -- en een uitspraak
   over de VORM, nooit over de bedoeling.

   DE INDELING IS ZELF EEN BEWERING, en die is hier misgegaan voordat ze klopte
   (BEWIJSMACHINE.md par. 6a). `metIdem` is namelijk niet EEN functie:

     kern      server/lib/idem.js  -- metIdem(sleutel, afdruk, werk, opties)
     podium    kern/podium/index.js:103 -- metIdem(k, sleutel, doe)

   Dat tweede is een eigen, per-kanaal opslagje met een heel andere volgorde:
   daar is het tweede argument de SLEUTEL en niet de afdruk. Wie dat door elkaar
   haalt, leest `metIdem(k, idem ? 'c:' + key + ':' + idem : null, ...)` als een
   afdruk die de sleutel bevat, en meldt een gat dat er niet is. Een aanroepplek
   waarvan de soort niet vaststaat, komt daarom in `nietTeLezen` terecht en niet
   in een van de vier uitspraken.

   Draai: npm run idemidentiteit
   ========================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');
const { stempel } = require('./lib/stempel');

const WORTEL = path.join(__dirname, '..');
const UIT = path.join(WORTEL, 'IDEMIDENTITEIT.json');

/* ---------------------------------------------------------------- de lezer */

/* Bestanden onder server/, zonder node_modules en zonder data. */
function bronnen(map, uit = []) {
  for (const naam of fs.readdirSync(map)) {
    if (naam === 'node_modules' || naam === 'data' || naam[0] === '.') continue;
    const p = path.join(map, naam);
    const st = fs.statSync(p);
    if (st.isDirectory()) bronnen(p, uit);
    else if (naam.endsWith('.js')) uit.push(p);
  }
  return uit;
}

/* De argumenten van een aanroep, gesplitst op diepte 0 en buiten tekenreeksen.
   Een kale `split(',')` breekt op `metIdem(a ? 'x' + b : null, f(c, d), ...)` --
   en dan lees je het tweede argument als `f(c` en meld je onzin. */
function argumenten(bron, vanaf) {
  let i = bron.indexOf('(', vanaf);
  if (i < 0) return null;
  i++;
  const args = [];
  let diepte = 0, huidig = '', aanhaling = null, ontsnapt = false;
  for (; i < bron.length; i++) {
    const c = bron[i];
    if (aanhaling) {
      huidig += c;
      if (ontsnapt) { ontsnapt = false; continue; }
      if (c === '\\') { ontsnapt = true; continue; }
      if (c === aanhaling) aanhaling = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') { aanhaling = c; huidig += c; continue; }
    if (c === '(' || c === '[' || c === '{') { diepte++; huidig += c; continue; }
    if (c === ')' && diepte === 0) { args.push(huidig); return args; }
    if (c === ')' || c === ']' || c === '}') { diepte--; huidig += c; continue; }
    if (c === ',' && diepte === 0) { args.push(huidig); huidig = ''; continue; }
    huidig += c;
  }
  return null;
}

/* EEN KOPIE WAARIN COMMENTAAR EN TEKENREEKSEN ZIJN UITGEWIT, met behoud van
   lengte en regeleinden zodat elke positie blijft kloppen.

   Dit stond er niet, en de eerste ronde telde daardoor veertig aanroepplekken
   terwijl het er achtendertig waren: `lib/mutatiecontracten-gelduit.js` en
   `lib/idem-contract-verklaringen.js` CITEREN allebei een metIdem-aanroep in
   hun toelichting, de een om uit te leggen dat de sleutel daar niet verplicht
   is en de ander om te laten zien hoe het handwerk eruitzag. Een citaat is geen
   aanroep, en een meter die tekst voor code aanziet, meldt een gat in een
   alinea (BEWIJSMACHINE.md par. 6a: een bewijs draagt ook zijn indeling). */
function uitgewit(bron) {
  let uit = '';
  let i = 0;
  const wit = (c) => (c === '\n' ? '\n' : ' ');
  while (i < bron.length) {
    const c = bron[i], twee = bron.slice(i, i + 2);
    if (twee === '//') {
      while (i < bron.length && bron[i] !== '\n') { uit += wit(bron[i]); i++; }
      continue;
    }
    if (twee === '/*') {
      const eind = bron.indexOf('*/', i + 2);
      const tot = eind < 0 ? bron.length : eind + 2;
      for (; i < tot; i++) uit += wit(bron[i]);
      continue;
    }
    if (c === '"' || c === "'" || c === '`') {
      uit += ' '; i++;
      while (i < bron.length) {
        if (bron[i] === '\\') { uit += '  '; i += 2; continue; }
        if (bron[i] === c) { uit += ' '; i++; break; }
        uit += wit(bron[i]); i++;
      }
      continue;
    }
    uit += c; i++;
  }
  return uit;
}

/* De identifiers in een stuk code, zonder de tekenreeksen ertussen: die dragen
   het VOORVOEGSEL ('pasuit|') en niet de waarde die per verzoek verschilt. */
const SLEUTELWOORDEN = new Set(['null', 'undefined', 'true', 'false', 'async', 'await',
  'return', 'new', 'typeof', 'String', 'Number', 'JSON', 'Math', 'Object', 'Date']);
function namenIn(stuk) {
  const zonderTekst = String(stuk || '').replace(/'[^']*'|"[^"]*"|`[^`]*`/g, ' ');
  const uit = new Set();
  for (const m of zonderTekst.matchAll(/[A-Za-z_$][A-Za-z0-9_$]*/g)) {
    if (!SLEUTELWOORDEN.has(m[0])) uit.add(m[0]);
  }
  return [...uit].sort();
}

/* ------------------------------------------------------------ de indeling */

/* Welke metIdem is dit? Een bestand dat er zelf een definieert, of dat zijn ctx
   krijgt van een index.js die er zelf een definieert, gebruikt die eigen. Dat
   is geen gok maar de bindingsregel van JavaScript, toegepast op de enige vorm
   die dit huis gebruikt: een module-fabriek die een ctx doorgeeft. */
function soortVan(bestand, alleBronnen) {
  const eigen = /function\s+metIdem\s*\(/;
  if (eigen.test(fs.readFileSync(bestand, 'utf8'))) return { soort: 'eigen', waar: rel(bestand) };
  const index = path.join(path.dirname(bestand), 'index.js');
  if (index !== bestand && alleBronnen.has(index) && eigen.test(fs.readFileSync(index, 'utf8'))) {
    return { soort: 'eigen', waar: rel(index) };
  }
  return { soort: 'kern', waar: 'server/lib/idem.js' };
}

const rel = (p) => path.relative(WORTEL, p).split(path.sep).join('/');

/* ------------------------------------------------- de tweede familie: handwerk */

/* NIET ELKE IDEMPOTENTIE LOOPT LANGS metIdem, en dat is het duurste dat deze
   meter heeft gevonden.

   Het gebrek dat #270 repareerde zat NIET op een metIdem-aanroepplek: het
   betaalverzoek zoekt met `verzoekIdemZoek(sleutel)` zelf een eerdere aanroep
   op en vergelijkt daarna met de hand welke velden gelijk moeten zijn. Een
   meter die alleen metIdem leest, had die dus nooit gevonden -- en zou
   ondertussen hebben gemeld dat alles in orde is.

   Deze helft leest daarom de tweede vorm: een opzoeking op een idem-sleutel,
   gevolgd door de VERGELIJKINGEN die bepalen of het gevonden geval echt
   hetzelfde verzoek is. Die vergelijkingen ZIJN daar de afdruk.

   De lezing is grof en dat staat hier omdat het de uitslag kleurt: hij kijkt
   vanaf de opzoeking VOORUIT tot het einde van het blok, en telt vergelijkingen
   op de gevonden variabele. Een vergelijking die verderop staat of via een
   hulpfunctie loopt, ziet hij niet -- dus `geenVergelijking` is een ONDERGRENS
   voor de aandacht en geen bewijs van afwezigheid. */
/* DE NAAM WORDT APART GETOETST EN NIET IN HET PATROON GEVLOCHTEN. Hier stond
   `[A-Za-z_$][\w$]*(?:[Ii]dem|IDEM)[\w$]*`, en dat eist stilzwijgend MINSTENS
   EEN TEKEN VOOR "idem" -- dus `verzoekIdemZoek` matchte wel en `idemZoek` niet.
   De meter meldde daardoor twee handwerkplekken terwijl het er vier zijn, en
   miste precies de twee die niets vergelijken. Een patroon dat zijn eigen
   voorwaarde verstopt, is een foutmodel dat niemand leest (BEWIJSMACHINE.md
   par. 6a); de ijking onderaan houdt deze vorm vast. */
const LOOKUP = /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:await\s+)?([A-Za-z_$][\w$]*)\s*\(/g;

function handwerk(alle) {
  const uit = [];
  for (const bestand of alle) {
    if (rel(bestand) === 'server/lib/idem.js') continue;
    const bron = fs.readFileSync(bestand, 'utf8');
    const kaal = uitgewit(bron);
    const regels = bron.split('\n');
    for (const m of kaal.matchAll(LOOKUP)) {
      const naam = m[1], functie = m[2];
      if (!/idem/i.test(functie)) continue;
      if (!/zoek|vind|find|haal|lees/i.test(functie)) continue;
      const regel = kaal.slice(0, m.index).split('\n').length;
      /* Vooruitkijken tot het einde van het omvattende blok, met een dak van
         veertig regels zodat een lange functie de meter niet laat afdwalen. */
      const venster = regels.slice(regel - 1, regel + 40).join('\n');
      const kaalVenster = uitgewit(venster);
      const velden = new Set();
      for (const v of kaalVenster.matchAll(new RegExp('\\b' + naam + '\\.([A-Za-z_$][\\w$]*)\\s*(?:!==|===|!=|==)', 'g'))) {
        velden.add(v[1]);
      }
      uit.push({
        bestand: rel(bestand), regel, opzoeker: functie, gevondenAls: naam,
        vergeleken: [...velden].sort(),
        uitspraak: velden.size ? 'vergelijkt' : 'geenVergelijking',
        regelTekst: (regels[regel - 1] || '').trim().slice(0, 160)
      });
    }
  }
  uit.sort((a, b) => a.bestand.localeCompare(b.bestand) || a.regel - b.regel);
  return uit;
}

/* ------------------------------------------------------------------ meten */

function meet() {
  const alle = bronnen(path.join(WORTEL, 'server'));
  const alleSet = new Set(alle);
  const plekken = [];

  for (const bestand of alle) {
    if (rel(bestand) === 'server/lib/idem.js') continue;
    const bron = fs.readFileSync(bestand, 'utf8');
    const regels = bron.split('\n');
    /* ZOEKEN in de uitgewitte kopie, LEZEN uit het origineel: een aanroep in
       commentaar bestaat niet, maar de argumenten van een echte aanroep dragen
       juist tekenreeksen die ik nodig heb. */
    const kaal = uitgewit(bron);
    for (const m of kaal.matchAll(/\bmetIdem\s*\(/g)) {
      /* De definitie zelf is geen aanroep. */
      const voor = kaal.slice(Math.max(0, m.index - 20), m.index);
      if (/function\s+$/.test(voor)) continue;
      const regel = bron.slice(0, m.index).split('\n').length;
      const args = argumenten(bron, m.index);
      const { soort, waar } = soortVan(bestand, alleSet);
      const plek = { bestand: rel(bestand), regel, soort, binding: waar };

      if (!args || args.length < 2) {
        plek.uitspraak = 'nietTeLezen';
        plek.reden = !args ? 'de haakjes lopen niet rond binnen dit bestand'
          : 'minder dan twee argumenten gevonden (' + (args ? args.length : 0) + ')';
        plekken.push(plek); continue;
      }
      if (soort === 'eigen') {
        /* Een eigen metIdem heeft een andere argumentvolgorde. Deze meter kent
           er precies een (podium) en gaat er niet van uit dat de volgende er
           ook zo uitziet -- daarom een uitspraak die niets over de afdruk zegt. */
        plek.uitspraak = 'nietTeLezen';
        plek.reden = 'eigen metIdem in ' + waar + ' met een andere argumentvolgorde; '
          + 'deze meter leest alleen die van server/lib/idem.js';
        plekken.push(plek); continue;
      }

      const sleutel = args[0].trim();
      const afdruk = args[1].trim();
      plek.sleutelNamen = namenIn(sleutel);
      plek.afdrukNamen = namenIn(afdruk);
      plek.regelTekst = (regels[regel - 1] || '').trim().slice(0, 160);

      if (/identiteitVan\s*\(/.test(afdruk)) plek.uitspraak = 'verklaard';
      else if (afdruk === 'null' || afdruk === 'undefined' || afdruk === '') plek.uitspraak = 'geenAfdruk';
      else {
        const inSleutel = new Set(plek.sleutelNamen);
        const extra = plek.afdrukNamen.filter(n => !inSleutel.has(n));
        plek.afdrukExtra = extra;
        plek.uitspraak = extra.length ? 'voegtToe' : 'voegtNietsToe';
      }
      plekken.push(plek);
    }
  }

  plekken.sort((a, b) => a.bestand.localeCompare(b.bestand) || a.regel - b.regel);
  const handwerkLijst = handwerk(alle);
  const tel = (u) => plekken.filter(p => p.uitspraak === u).length;
  return {
    soort: 'triage',
    /* GEEN VELD `bereik` HIER, en dat is geen slordigheid maar LAT.md regel 14.
       Die naam draagt in de bewijsregisters al drie relaties, waarvan er twee
       elkaars tegendeel zijn (wat een wachter RAAKT tegenover waarover een
       oordeel GELDT) -- zie scripts/lib/bewijsvelden.js. Een vierde betekenis
       eraan hangen maakt die verwarring groter, ook als je hem netjes
       verklaart. Wat er gelezen is staat daarom in `uitleg`, en wat dat NIET
       aantoont in `grens`; precies de vorm van STILSPOOR.json. */
    uitleg: 'Waaraan ziet dit huis dat twee aanroepen hetzelfde verzoek dragen -- per plek waar '
      + 'idempotentie wordt gedaan, in twee families: langs metIdem en met de hand ernaast. '
      + 'Gelezen is elke metIdem-aanroep onder server/, plus elke opzoeking op een idem-sleutel '
      + 'die daar met de hand omheen gaat; lexicaal, dus zonder iets uit te voeren.',
    /* WAT DEZE METING NIET AANTOONT. Dit staat er even groot bij als de getallen,
       want het is de faalvorm van dit register: geruststelling. */
    grens: 'Deze meting toont NIET aan dat een smalle afdruk fout is -- bij kern/pay/partner.js '
      + 'staat uitgeschreven dat een uitbetaling geen parameters buiten de partner heeft. Het is '
      + 'een triagelijst, geen oordeel. Zij toont ook NIET aan dat een `voegtToe` in orde is: dat '
      + 'zegt alleen dat de afdruk IETS draagt dat de sleutel niet heeft, niet dat hij alles '
      + 'draagt waarop de handler onderscheidt -- precies het gat van #270, dat hier `voegtToe` '
      + 'zou heten. En `geenVergelijking` in de tweede familie is een ONDERGRENS: er wordt vanaf '
      + 'de opzoeking veertig regels vooruit gekeken, dus een vergelijking die verderop staat of '
      + 'via een hulpfunctie loopt, ziet deze meter niet.',
    graad: 'vermoed',
    waaromVermoed: 'de argumenten worden uit de BRON gelezen en niet uitgevoerd; een naam die via '
      + 'een hulpfunctie in de afdruk belandt, telt hier als een naam en niet als de velden erachter.',
    aanroepplekken: plekken.length,
    verklaard: tel('verklaard'),
    geenAfdruk: tel('geenAfdruk'),
    voegtNietsToe: tel('voegtNietsToe'),
    voegtToe: tel('voegtToe'),
    nietTeLezen: tel('nietTeLezen'),
    /* WAAROM `voegtToe` GEEN SCHONE UITSLAG IS. De afdruk draagt daar iets dat
       de sleutel niet heeft -- meer zegt het niet. Of hij ALLES draagt waarop de
       handler onderscheidt, weet deze meter niet: dat was precies het gebrek in
       #270, waar de afdruk het bedrag wel en de ontvanger niet droeg. Wie dit
       getal als "in orde" leest, leest iets anders dan er staat. */
    voegtToeIsGeenGoedkeuring: true,
    handwerkPlekken: handwerkLijst.length,
    handwerkVergelijkt: handwerkLijst.filter(h => h.uitspraak === 'vergelijkt').length,
    handwerkGeenVergelijking: handwerkLijst.filter(h => h.uitspraak === 'geenVergelijking').length,
    plekken,
    handwerk: handwerkLijst
  };
}

/* ------------------------------------------------------------- de ijking */

/* EEN METER DIE NIET KAN UITSLAAN IS GEEN METER. Deze ijking voedt de lezer
   met stukjes waarvan het antwoord vaststaat, en zakt als hij ze verkeerd
   leest -- inclusief de twee vormen die hem eerder lieten struikelen: een
   ternair in het eerste argument, en een aanroep met een komma erin. */
function ijk() {
  const gevallen = [
    ["f(a ? 'x:' + b + ':' + c : null, 'x|' + b, w)", ["a ? 'x:' + b + ':' + c : null", "'x|' + b", 'w']],
    ["f(k, hulp(a, b), w)", ['k', 'hulp(a, b)', 'w']],
    ["f('a,b', c)", ["'a,b'", 'c']],
    ["f(x, 'het is \\'zo\\'', y)", ['x', "'het is \\'zo\\''", 'y']]
  ];
  const fouten = [];
  for (const [bron, wacht] of gevallen) {
    const uit = (argumenten(bron, 0) || []).map(s => s.trim());
    if (JSON.stringify(uit) !== JSON.stringify(wacht)) {
      fouten.push({ bron, gekregen: uit, verwacht: wacht });
    }
  }
  /* Het geval dat de eerste ronde verkeerd telde: een aanroep die alleen in
     tekst voorkomt. Zonder deze ijking zou de meter opnieuw een alinea meetellen. */
  const citaat = "const a = 1;\n/* hier staat metIdem('x', 'y', z) in commentaar */\nconst b = \"metIdem('p', 'q', r)\";\nmetIdem('echt', 'wel', f);\n";
  const gevonden = [...uitgewit(citaat).matchAll(/\bmetIdem\s*\(/g)].length;
  if (gevonden !== 1) fouten.push({ bron: 'een geciteerde metIdem telt mee', gekregen: gevonden, verwacht: 1 });
  if (uitgewit(citaat).split('\n').length !== citaat.split('\n').length) {
    fouten.push({ bron: 'uitgewit() verandert het aantal regels', gekregen: 'regelnummers schuiven', verwacht: 'gelijk' });
  }

  /* De vorm die de meter EERST miste: een opzoeker die MET "idem" begint. */
  const beide = "const a = idemZoek(k);\nconst b = verzoekIdemZoek(k);\nconst c = gewoonZoek(k);\n";
  const namenGevonden = [...uitgewit(beide).matchAll(LOOKUP)].map(x => x[2]).filter(n => /idem/i.test(n));
  if (namenGevonden.join(',') !== 'idemZoek,verzoekIdemZoek') {
    fouten.push({ bron: 'een opzoeker die met "idem" begint wordt gemist', gekregen: namenGevonden, verwacht: ['idemZoek', 'verzoekIdemZoek'] });
  }

  if (namenIn("'pasuit|' + iban + '|' + soort").join(',') !== 'iban,soort') {
    fouten.push({ bron: 'namenIn laat een tekenreeks meetellen', gekregen: namenIn("'pasuit|' + iban"), verwacht: ['iban'] });
  }
  return fouten;
}

/* -------------------------------------------------------------- de uitvoer */

if (require.main === module) {
  const fouten = ijk();
  if (fouten.length) {
    console.error('\n  DE IJKING IS NIET GEHAALD -- de lezer leest zijn eigen invoer verkeerd.\n');
    for (const f of fouten) console.error('   ' + f.bron + '\n     gekregen: ' + JSON.stringify(f.gekregen) + '\n     verwacht: ' + JSON.stringify(f.verwacht));
    console.error('\n  Er is niets weggeschreven: een meter die zijn eigen ijking niet haalt,\n  levert geen uitslag maar een vermoeden.\n');
    process.exit(1);
  }

  /* Het stempel VOORAAN, en uit de gedeelde helper: hij draagt de commit, of de
     boom vuil was, en met welk instrument er is gemeten. Een register zonder
     stempel is een bewering zonder datum, en dan kan niemand zien of het over
     vandaag gaat (BESTUUR.md: vervallen bewijs is geen bewijs). */
  const uit = Object.assign({ stempel: stempel() }, meet());
  fs.writeFileSync(UIT, JSON.stringify(uit, null, 2) + '\n');

  console.log('\n  WAT MAAKT TWEE AANROEPEN HETZELFDE VERZOEK?  (graad: ' + uit.graad + ')\n');
  console.log('   ' + uit.aanroepplekken + ' aanroepplekken van metIdem onder server/\n');
  const rij = (n, w, wat) => console.log('     ' + String(n).padStart(3) + '  ' + w.padEnd(18) + wat);
  rij(uit.verklaard, 'verklaard', 'de afdruk komt uit idem-contract.js');
  rij(uit.voegtToe, 'voegtToe', 'de afdruk draagt iets dat de sleutel niet heeft');
  rij(uit.voegtNietsToe, 'voegtNietsToe', 'elke naam staat al in de sleutel -- kan niets tegenhouden');
  rij(uit.geenAfdruk, 'geenAfdruk', 'een tweede aanroep krijgt altijd het eerste antwoord');
  rij(uit.nietTeLezen, 'nietTeLezen', 'niet ontleed, met de reden erbij');

  const triage = uit.plekken.filter(p => p.uitspraak === 'voegtNietsToe' || p.uitspraak === 'geenAfdruk');
  if (triage.length) {
    console.log('\n   De triagelijst -- vorm, geen oordeel:\n');
    for (const p of triage) console.log('     ' + p.uitspraak.padEnd(14) + p.bestand + ':' + p.regel);
  }
  console.log('\n   ' + uit.handwerkPlekken + ' plekken die idempotentie MET DE HAND doen, buiten metIdem om\n');
  rij(uit.handwerkVergelijkt, 'vergelijkt', 'er wordt op velden gecontroleerd voor het oude antwoord terugkomt');
  rij(uit.handwerkGeenVergelijking, 'geenVergelijking', 'zelfde sleutel = zelfde antwoord, wat er ook veranderd is');
  if (uit.handwerk.length) {
    console.log('');
    for (const h of uit.handwerk) {
      console.log('     ' + h.uitspraak.padEnd(18) + (h.bestand + ':' + h.regel).padEnd(42)
        + (h.vergeleken.length ? h.vergeleken.join(', ') : '(niets)'));
    }
  }
  console.log('\n  Uitslag in IDEMIDENTITEIT.json.');
  console.log('  \x1b[2mDit is een triagelijst en geen foutenlijst: een smalle afdruk kan een');
  console.log('  uitgeschreven besluit zijn. Lees de plek voor je hem een gat noemt.\x1b[0m\n');
}

module.exports = { argumenten, namenIn, uitgewit, handwerk, meet, ijk };
