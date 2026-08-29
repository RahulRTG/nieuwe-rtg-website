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
