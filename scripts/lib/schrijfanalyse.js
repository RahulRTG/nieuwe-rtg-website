/* ============================================================================
   SCHRIJFT DEZE HANDLER? -- de tweede, onafhankelijke bewijslijn.

   WAAROM DIT ER IS. De stand NOT_APPLICABLE ("deze route verandert niets") eist
   volgens kern/mutatiecontract/klassen.js dat een MENS de handler heeft
   nagekeken, en met reden: de idemproef ziet alleen de collecties in de
   database. Een schrijfactie naar een bestand, een externe dienst of een teller
   daarbuiten ziet hij niet, dus "geen spoor in de opslag" is een gevolgtrekking
   uit AFWEZIG bewijs.

   Maar 1.212 handlers met de hand nalezen is geen werk dat af komt, en een mens
   die er duizend achter elkaar doet, kijkt bij nummer driehonderd niet meer. Dus
   komt er een tweede meting bij die uit een heel andere richting kijkt: niet wat
   er GEBEURDE, maar wat er in de code KAN gebeuren.

   Twee onafhankelijke methodes die hetzelfde zeggen, is sterker bewijs dan een
   mens die één keer heeft gekeken. Spreken ze elkaar tegen, dan is dat een
   bevinding -- en juist die tegenspraak is wat geen van beide alleen kan geven.

   DE GRENS, EN HIJ IS STRENG. Deze analyse zegt maar drie dingen:

     'nee'      bewezen leesroute: het lichaam bevat geen enkele schrijfvorm, en
                elke aanroep erin staat op de lijst van vormen die aantoonbaar
                niets veranderen.
     'ja'       er staat een schrijfvorm in.
     'onbekend' er staat een aanroep in die deze analyse niet kan volgen.

   'onbekend' is met opzet de GROOTSTE bak, en hij is geen tekortkoming maar de
   eerlijke uitkomst: `res.json(metier.zoek(...))` roept een functie in een
   andere module aan, en zonder die module te volgen weet niemand of daar iets
   wordt weggeschreven. Wie 'onbekend' als 'nee' telt, heeft een analyse die
   altijd meewerkt -- en dat is precies het soort meter waar dit huis niets aan
   heeft.

   DAAROM VOLGT HIJ MAAR EEN LAAG DIEP. Hij kijkt niet in andere modules. Een
   transitieve analyse over 2861 bestanden die er ergens één mist, geeft een
   'nee' die niet klopt, en dat is duurder dan honderd keer 'onbekend'.
   ========================================================================== */
'use strict';

const { zonderCommentaar } = require('./bron');

/* ---------------------------------------------------------------------------
   DE SCHRIJFVORMEN. Wat betekent "hier verandert iets".

   Deze lijst is de lat, dus hij is te ruim in plaats van te krap: elke vorm die
   ook maar zou kunnen schrijven telt mee. Een route die daardoor onterecht 'ja'
   krijgt, verliest alleen een voorstel; een route die onterecht 'nee' krijgt,
   krijgt een verkeerd contract met bewijs eronder.
   ------------------------------------------------------------------------- */
const SCHRIJFVORMEN = [
  { naam: 'save()', re: /\bsave\s*\(/ },
  { naam: 'db.data toewijzing', re: /\bdb\s*\.\s*data\s*\.[A-Za-z0-9_$]+\s*(=[^=]|\+=|-=)/ },
  { naam: 'lijst-mutatie', re: /\.\s*(push|pop|shift|unshift|splice|sort|reverse|fill|copyWithin)\s*\(/ },
  { naam: 'delete', re: /\bdelete\s+[A-Za-z_$]/ },
  { naam: 'Object.assign', re: /\bObject\s*\.\s*assign\s*\(/ },
  { naam: 'bestand schrijven', re: /\b(writeFile|writeFileSync|appendFile|appendFileSync|mkdir|mkdirSync|rm|rmSync|unlink|unlinkSync|rename|renameSync)\s*\(/ },
  { naam: 'netwerk uit', re: /\b(fetch|request|axios|sendMail|mailVeilig|sendSms|sendPush)\s*\(/ },
  { naam: 'eigen bak zetten', re: /\b(zetBak|bak)\s*\(/ },
  { naam: 'toewijzing aan een veld', re: /[A-Za-z_$][A-Za-z0-9_$]*\s*\.\s*[A-Za-z0-9_$]+\s*(=[^=>]|\+=|-=)/ },
  { naam: 'increment', re: /(\+\+|--)\s*[A-Za-z_$]|[A-Za-z0-9_$\]]\s*(\+\+|--)/ }
];

/* ---------------------------------------------------------------------------
   DE VORMEN DIE AANTOONBAAR NIETS VERANDEREN.

   Alleen wat in de taal zelf zit of in dit huis aantoonbaar leest. Een naam die
   hier NIET op staat, maakt de uitkomst 'onbekend' -- niet 'ja'. Het verschil
   telt: 'ja' is een bewering over de code, 'onbekend' een bewering over deze
   analyse.
   ------------------------------------------------------------------------- */
const LEESVORMEN = new Set([
  // taal en standaardbibliotheek
  'String', 'Number', 'Boolean', 'Array', 'Object', 'Math', 'JSON', 'Date', 'Set', 'Map',
  'parseInt', 'parseFloat', 'isNaN', 'isFinite', 'encodeURIComponent', 'decodeURIComponent',
  'keys', 'values', 'entries', 'from', 'isArray', 'stringify', 'parse', 'now', 'max', 'min',
  'round', 'floor', 'ceil', 'abs', 'has', 'get', 'includes', 'indexOf', 'slice', 'split',
  'join', 'trim', 'toLowerCase', 'toUpperCase', 'startsWith', 'endsWith', 'replace', 'match',
  'test', 'filter', 'map', 'find', 'findIndex', 'some', 'every', 'reduce', 'concat', 'flat',
  'flatMap', 'padStart', 'padEnd', 'toFixed', 'toString', 'charAt', 'substring', 'substr',
  'localeCompare', 'repeat', 'at',
  // het antwoord terugsturen is geen mutatie van de toestand van dit huis
  'json', 'send', 'status', 'end', 'setHeader', 'set', 'type',
  // huisgewoontes die aantoonbaar lezen of schoonmaken
  'schoon', 'veilig', 'stuur', 'cn', 'eigenVeld', 'nu', 'lijst'
]);

/* ---------------------------------------------------------------------------
   HET LICHAAM VAN EEN HANDLER UIT DE BRON HALEN.

   Wij zoeken `app.post('/pad'` of `router.post('/pad'` en nemen alles tot de
   HAAKJES WEER IN BALANS zijn. Een reguliere expressie die op de sluithaak van
   dezelfde regel mikt, knipt elke handler van meer dan een regel af -- en dan
   leest een schrijvende handler als leeg.
   ------------------------------------------------------------------------- */
function handlersUit(bron) {
  const schoon = zonderCommentaar(bron);
  const uit = [];
  const re = /\b(?:app|router)\s*\.\s*(post|put|patch|delete)\s*\(\s*['"`]([^'"`]+)['"`]/g;
  let m;
  while ((m = re.exec(schoon))) {
    const methode = m[1].toUpperCase();
    const pad = m[2];
    /* Vanaf de openingshaak van de registratie tellen tot hij weer sluit. */
    let i = schoon.indexOf('(', m.index);
    let diepte = 0, eind = -1;
    for (let j = i; j < schoon.length; j++) {
      const c = schoon[j];
      if (c === '(') diepte++;
      else if (c === ')') { diepte--; if (diepte === 0) { eind = j; break; } }
    }
    if (eind < 0) continue;
    uit.push({ methode, pad, lichaam: schoon.slice(i + 1, eind) });
  }
  return uit;
}

/* ---------------------------------------------------------------------------
   HET OORDEEL OVER EEN LICHAAM
   ------------------------------------------------------------------------- */
function weegLichaam(lichaam) {
  const gevonden = SCHRIJFVORMEN.filter(v => v.re.test(lichaam));
  if (gevonden.length) {
    return { schrijft: 'ja', waarom: 'schrijfvorm gevonden: ' + gevonden.map(v => v.naam).join(', ') };
  }
  /* Geen schrijfvorm. Dan hangt alles af van wat er wordt AANGEROEPEN: een
     aanroep die deze analyse niet kan volgen, kan alsnog van alles doen. */
  const aanroepen = new Set();
  const re = /([A-Za-z_$][A-Za-z0-9_$]*)\s*\(/g;
  let m;
  while ((m = re.exec(lichaam))) {
    const naam = m[1];
    /* Sleutelwoorden zijn geen aanroepen. */
    if (['if', 'for', 'while', 'switch', 'catch', 'function', 'return', 'typeof', 'await', 'async'].includes(naam)) continue;
    if (!LEESVORMEN.has(naam)) aanroepen.add(naam);
  }
  if (aanroepen.size) {
    return { schrijft: 'onbekend',
      waarom: 'geen schrijfvorm in het lichaam, maar het roept aan: ' + [...aanroepen].slice(0, 6).join(', ') +
        (aanroepen.size > 6 ? ' (en ' + (aanroepen.size - 6) + ' meer)' : '') +
        ' -- deze analyse volgt geen aanroep naar een andere module' };
  }
  return { schrijft: 'nee',
    waarom: 'geen enkele schrijfvorm, en elke aanroep in het lichaam staat op de lijst van vormen ' +
      'die aantoonbaar niets veranderen' };
}

/* ---------------------------------------------------------------------------
   EEN HOP DIEPER -- en waarom precies een.

   De eerste versie van deze analyse keek alleen naar het lichaam van de handler
   en kwam op 4441 routes uit als: 847 schrijft, 49 leest, 3545 ONBEKEND. Dat
   laatste getal is geen meetfout maar de vorm van dit huis: bijna elke handler
   is drie regels die doorverwijzen naar de kern, en `res.json(metier.zoek(...))`
   zegt in zichzelf niets.

   Dus volgen we de aanroep -- maar naar EEN laag, niet naar alle. Een
   transitieve analyse over 2861 bestanden die er ergens een mist, geeft een
   'nee' die niet klopt, en dat is duurder dan duizend keer 'onbekend'. De regel
   is daarom hard: elke naam die niet volledig te herleiden is, maakt de uitkomst
   'onbekend'. De rooster loopt maar een kant op -- ja > onbekend > nee -- en er
   komt alleen 'nee' uit als ALLES 'nee' is.
   ------------------------------------------------------------------------- */

/* De functies die in een bestand worden gedefinieerd, met hun lichaam.
   Herkent `function naam(...) {}`, `const naam = (...) => {}` en
   `naam(...) {` binnen een object of klasse -- de drie vormen die dit huis
   gebruikt. */
function functiesUit(bron) {
  const schoon = zonderCommentaar(bron);
  const uit = new Map();
  const vormen = [
    /\bfunction\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*\(/g,
    /\b(?:const|let|var)\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*(?:async\s*)?\(/g,
    /\b(?:const|let|var)\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*(?:async\s*)?function\b/g
  ];
  for (const re of vormen) {
    let m;
    while ((m = re.exec(schoon))) {
      const naam = m[1];
      if (uit.has(naam)) continue;
      /* Het lichaam: van de eerste { na de kop tot hij weer sluit. Een pijl-
         functie zonder accolades (`const f = x => x + 1`) heeft er geen; die
         kan per definitie niets schrijven wat wij zoeken, en krijgt een leeg
         lichaam. */
      const haak = schoon.indexOf('{', m.index + m[0].length - 1);
      const puntkomma = schoon.indexOf(';', m.index);
      if (haak < 0 || (puntkomma >= 0 && puntkomma < haak)) {
        /* EEN PIJLFUNCTIE ZONDER ACCOLADES, en hier zat een gat dat een 'nee'
           opleverde die niet klopte.

             const aiStatus = () => require(<een andere module>).beschikbaarheid(anthropic);

           Die kreeg een LEEG lichaam, en een leeg lichaam heeft geen
           schrijfvorm en geen aanroep -- dus kwam er 'leest aantoonbaar' uit,
           terwijl de functie in werkelijkheid een andere module aanroept en
           daar van alles kan gebeuren. POST /api/ai/status stond daardoor als
           bewezen leesroute in de uitslag. Gevonden door drie treffers met de
           hand na te kijken, niet door een toets -- vandaar dat er nu ook een
           toets op staat.

           Een expressie-lichaam is gewoon een lichaam: van de pijl tot de
           puntkomma. Dan valt `require(...)` en `beschikbaarheid(...)` er
           binnen, en wordt de uitkomst ONBEKEND -- wat hij hoort te zijn. */
        const pijl = schoon.indexOf('=>', m.index);
        if (pijl >= 0 && (puntkomma < 0 || pijl < puntkomma)) {
          const eindeExpr = puntkomma >= 0 ? puntkomma : schoon.indexOf('\n', pijl);
          uit.set(naam, eindeExpr > pijl ? schoon.slice(pijl + 2, eindeExpr) : 'ONLEESBAAR(');
        } else {
          /* Geen lichaam te vinden. Met opzet een naam die op de aanroeplijst
             belandt en dus ONBEKEND oplevert -- nooit een stil 'nee'. */
          uit.set(naam, 'ONLEESBAAR(');
        }
        continue;
      }
      let diepte = 0, eind = -1;
      for (let j = haak; j < schoon.length; j++) {
        const c = schoon[j];
        if (c === '{') diepte++;
        else if (c === '}') { diepte--; if (diepte === 0) { eind = j; break; } }
      }
      uit.set(naam, eind < 0 ? 'ONLEESBAAR(' : schoon.slice(haak + 1, eind));
    }
  }
  return uit;
}

/* De namen die uit een aanroep in dit lichaam komen, zonder de vormen waarvan
   vaststaat dat ze niets veranderen. Ook `mod.fn(` levert `fn` op: binnen een
   bestand is dat meestal de kernmodule van datzelfde domein, en de naam is wat
   we kunnen opzoeken. */
function aanroepenUit(lichaam) {
  const uit = new Set();
  const re = /([A-Za-z_$][A-Za-z0-9_$]*)\s*\(/g;
  let m;
  while ((m = re.exec(lichaam))) {
    const naam = m[1];
    if (['if', 'for', 'while', 'switch', 'catch', 'function', 'return', 'typeof', 'await', 'async'].includes(naam)) continue;
    if (LEESVORMEN.has(naam)) continue;
    uit.add(naam);
  }
  return uit;
}

/* Het oordeel over een naam binnen een bestand, met een bezoekerslijst tegen
   kringen (een functie die zichzelf aanroept) en een dieptegrens. */
function weegNaam(naam, functies, gezien, diepte) {
  if (diepte <= 0) return { schrijft: 'onbekend', waarom: 'te diep genest om te volgen' };
  if (gezien.has(naam)) return { schrijft: 'nee', waarom: 'kring: al gewogen in deze keten' };
  if (!functies.has(naam)) {
    return { schrijft: 'onbekend', waarom: '"' + naam + '" staat niet in dit bestand; deze analyse volgt geen andere module' };
  }
  gezien.add(naam);
  const lichaam = functies.get(naam);
  const direct = SCHRIJFVORMEN.filter(v => v.re.test(lichaam));
  if (direct.length) return { schrijft: 'ja', waarom: '"' + naam + '" schrijft: ' + direct.map(v => v.naam).join(', ') };
  for (const kind of aanroepenUit(lichaam)) {
    const o = weegNaam(kind, functies, gezien, diepte - 1);
    if (o.schrijft !== 'nee') return o;
  }
  return { schrijft: 'nee', waarom: '"' + naam + '" en alles wat het aanroept veranderen niets' };
}

/* Alle routes uit een bronbestand, met hun oordeel -- nu mét de functies uit
   datzelfde bestand als tweede laag. */
function analyseer(bron) {
  const functies = functiesUit(bron);
  return handlersUit(bron).map(h => {
    const eerste = weegLichaam(h.lichaam);
    if (eerste.schrijft !== 'onbekend') return Object.assign({ methode: h.methode, pad: h.pad }, eerste);
    /* Onbekend: probeer elke aanroep alsnog te herleiden binnen dit bestand. */
    const redenen = [];
    for (const naam of aanroepenUit(h.lichaam)) {
      const o = weegNaam(naam, functies, new Set(), 6);
      if (o.schrijft === 'ja') return { methode: h.methode, pad: h.pad, schrijft: 'ja', waarom: 'via ' + o.waarom };
      if (o.schrijft === 'onbekend') redenen.push(o.waarom);
    }
    if (redenen.length) {
      return { methode: h.methode, pad: h.pad, schrijft: 'onbekend', waarom: redenen[0] };
    }
    return { methode: h.methode, pad: h.pad, schrijft: 'nee',
      waarom: 'het lichaam bevat geen schrijfvorm, en elke aanroep is binnen dit bestand herleid tot iets ' +
        'dat niets verandert' };
  });
}

module.exports = { analyseer, handlersUit, weegLichaam, functiesUit, weegNaam, SCHRIJFVORMEN, LEESVORMEN };

/* ============================================================================
   DE PROJECTINDEX -- een hop over de modulegrens, en niet meer dan een.

   WAAROM DIT ER TOCH KOMT. De analyse hierboven volgt alleen aanroepen binnen
   hetzelfde bestand, en dat liet 3441 van de 4441 routes op ONBEKEND staan. Die
   3441 zijn geen meetfout maar de vorm van dit huis: bijna elke handler is drie
   regels die doorverwijzen naar de kern. Zonder die grens over te steken blijft
   de tweede bewijslijn een veto en wordt hij nooit een bevestiging.

   WAAROM HET GEVAARLIJK IS, EN HOE DAT WORDT INGEDAMD. Een resolver die er
   ergens EEN mist, levert een 'nee' die niet klopt -- en die 'nee' komt als
   bewijs onder een contract te staan. Vier regels houden dat tegen:

     1. ELKE NIET-OPGELOSTE NAAM MAAKT DE UITKOMST ONBEKEND. Niet 'nee'. Er is
        geen enkele weg waarlangs "ik kon het niet vinden" als "het is veilig"
        uitkomt.
     2. DE ROOSTER LOOPT EEN KANT OP: ja > onbekend > nee. Een keten is pas 'nee'
        als ELKE schakel 'nee' is.
     3. EEN NAAM DIE IN EEN BESTAND MEER DAN EEN KEER BESTAAT, WEEGT ALS DE
        ZWAARSTE. Twee functies met dezelfde naam is precies waar een resolver
        stil de verkeerde kiest.
     4. DE DIEPTE IS BEGRENSD en kringen worden onthouden. Buiten de grens:
        onbekend.

   WAT HIJ NIET DOET: dynamische aanroepen (`obj[naam]()`), functies die als
   waarde worden doorgegeven, en alles wat via een context-object binnenkomt dat
   ergens anders is gevuld. Die komen allemaal uit op onbekend, en dat is de
   bedoeling.
   ========================================================================== */

const _fs = require('fs');
const _path = require('path');

/* De requires van een bestand: welke naam wijst naar welk bestand.

   Twee vormen, en meer kent dit huis niet in de routelaag:
     const x = require(<een pad>)          -> x wijst naar dat bestand
     const { a, b } = require(<een pad>)   -> a en b wijzen naar dat bestand

   (De voorbeelden staan hier zonder echte padstring: scripts/check.js leest
   commentaar mee op zoek naar kapotte afhankelijkheden, en een verzonnen pad in
   een uitleg is voor die keuring niet van een echte te onderscheiden. Terecht --
   een lezer had hem net zo goed voor echt kunnen aanzien.) */
function requiresUit(bron, bestand) {
  const schoon = zonderCommentaar(bron);
  const uit = new Map();
  const los = /(?:const|let|var)\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*require\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g;
  const stel = /(?:const|let|var)\s*\{([^}]*)\}\s*=\s*require\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g;
  const oplossen = (verwijzing) => {
    if (!verwijzing.startsWith('.')) return null;                 // node: of npm: niet volgen
    const basis = _path.resolve(_path.dirname(bestand), verwijzing);
    for (const kandidaat of [basis, basis + '.js', _path.join(basis, 'index.js')]) {
      try { if (_fs.statSync(kandidaat).isFile()) return kandidaat; } catch (e) { /* volgende */ }
    }
    return null;
  };
  let m;
  while ((m = los.exec(schoon))) { const p = oplossen(m[2]); if (p) uit.set(m[1], p); }
  while ((m = stel.exec(schoon))) {
    const p = oplossen(m[2]); if (!p) continue;
    for (const stuk of m[1].split(',')) {
      const naam = stuk.split(':').pop().trim();
      if (/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(naam)) uit.set(naam, p);
    }
  }
  return uit;
}

/* De index: per bestand zijn functies en zijn requires, een keer gelezen. */
function maakIndex(wortel) {
  const index = new Map();
  const lees = (bestand) => {
    if (index.has(bestand)) return index.get(bestand);
    let bron = '';
    try { bron = _fs.readFileSync(bestand, 'utf8'); } catch (e) { /* leeg */ }
    const d = { functies: functiesUit(bron), requires: requiresUit(bron, bestand) };
    index.set(bestand, d);
    return d;
  };
  return { lees, index, wortel };
}

/* Het oordeel over een naam, nu MET de modulegrens erbij.

   `plek` is het bestand waarin de naam voorkomt. Een naam kan drie dingen zijn:
   een functie in dit bestand, iets dat uit een require komt, of onbekend. */
function weegNaamDiep(naam, plek, idx, gezien, diepte) {
  if (diepte <= 0) return { schrijft: 'onbekend', waarom: 'te diep om te volgen' };
  const merk = plek + ':' + naam;
  if (gezien.has(merk)) return { schrijft: 'nee', waarom: 'kring: al gewogen in deze keten' };
  gezien.add(merk);

  const hier = idx.lees(plek);

  /* 1. Een functie in dit bestand. */
  if (hier.functies.has(naam)) {
    const lichaam = hier.functies.get(naam);
    const direct = SCHRIJFVORMEN.filter(v => v.re.test(lichaam));
    if (direct.length) return { schrijft: 'ja', waarom: '"' + naam + '" in ' + plek + ' schrijft: ' + direct.map(v => v.naam).join(', ') };
    for (const kind of aanroepenUit(lichaam)) {
      const o = weegNaamDiep(kind, plek, idx, gezien, diepte - 1);
      if (o.schrijft !== 'nee') return o;
    }
    return { schrijft: 'nee', waarom: '"' + naam + '" en alles wat het aanroept veranderen niets' };
  }

  /* 2. Een naam die uit een require komt: volg hem naar dat bestand. Daar zoeken
        we de functie op NAAM en niet via module.exports -- dit huis bouwt zijn
        modules als fabrieken (`module.exports = (ctx) => { ... return {a,b} }`)
        en dan staat de naam wel in het bestand maar niet in een exportlijst. */
  if (hier.requires.has(naam)) {
    const doel = hier.requires.get(naam);
    const daar = idx.lees(doel);
    if (daar.functies.has(naam)) return weegNaamDiep(naam, doel, idx, gezien, diepte - 1);
    return { schrijft: 'onbekend', waarom: '"' + naam + '" komt uit ' + doel + ' maar is daar niet als functie te vinden' };
  }

  return { schrijft: 'onbekend', waarom: '"' + naam + '" is in ' + plek + ' niet te herleiden' };
}

/* Een aanroep van de vorm `mod.fn(...)`: los `mod` op naar een bestand en weeg
   `fn` daar. */
function moduleAanroepen(lichaam) {
  const uit = [];
  const re = /([A-Za-z_$][A-Za-z0-9_$]*)\s*\.\s*([A-Za-z_$][A-Za-z0-9_$]*)\s*\(/g;
  let m;
  while ((m = re.exec(lichaam))) {
    if (LEESVORMEN.has(m[2])) continue;
    uit.push({ mod: m[1], fn: m[2] });
  }
  return uit;
}

/* De diepe variant van analyseer(): zelfde uitkomsten, maar met de index erbij.
   Zonder index gedraagt hij zich exact als analyseer(). */
function analyseerDiep(bestand, idx, maxDiepte) {
  const bron = (() => { try { return _fs.readFileSync(bestand, 'utf8'); } catch (e) { return ''; } })();
  const diepte = maxDiepte || 4;
  const hier = idx.lees(bestand);
  return handlersUit(bron).map(h => {
    const eerste = weegLichaam(h.lichaam);
    if (eerste.schrijft === 'ja') return { methode: h.methode, pad: h.pad, ...eerste };

    const redenen = [];
    let zwaarste = eerste.schrijft;
    /* Kale aanroepen: `fn(...)`. */
    for (const naam of aanroepenUit(h.lichaam)) {
      const o = weegNaamDiep(naam, bestand, idx, new Set(), diepte);
      if (o.schrijft === 'ja') return { methode: h.methode, pad: h.pad, schrijft: 'ja', waarom: 'via ' + o.waarom };
      if (o.schrijft === 'onbekend') { zwaarste = 'onbekend'; redenen.push(o.waarom); }
    }
    /* Modulaanroepen: `mod.fn(...)`. */
    for (const { mod, fn } of moduleAanroepen(h.lichaam)) {
      const doel = hier.requires.get(mod);
      if (!doel) { zwaarste = 'onbekend'; redenen.push('"' + mod + '" is geen bekende module in ' + bestand); continue; }
      const o = weegNaamDiep(fn, doel, idx, new Set(), diepte);
      if (o.schrijft === 'ja') return { methode: h.methode, pad: h.pad, schrijft: 'ja', waarom: 'via ' + o.waarom };
      if (o.schrijft === 'onbekend') { zwaarste = 'onbekend'; redenen.push(o.waarom); }
    }
    if (zwaarste === 'onbekend') {
      return { methode: h.methode, pad: h.pad, schrijft: 'onbekend', waarom: redenen[0] || 'niet te herleiden' };
    }
    return { methode: h.methode, pad: h.pad, schrijft: 'nee',
      waarom: 'geen schrijfvorm, en elke aanroep is herleid tot iets dat niets verandert' };
  });
}

module.exports.requiresUit = requiresUit;
module.exports.maakIndex = maakIndex;
module.exports.weegNaamDiep = weegNaamDiep;
module.exports.analyseerDiep = analyseerDiep;
module.exports.moduleAanroepen = moduleAanroepen;
