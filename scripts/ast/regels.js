/* De regels van de zelfgebouwde AST-scanner. Elke regel krijgt elke knoop met
   zijn pad (voorouders) en geeft nul of meer bevindingen terug. Bewust hoog-
   signaal en schoon op de huidige code: een bevinding betekent echt iets.

   Ernst 'fout' laat de scan falen (exit 1); 'waarschuwing' wordt getoond maar
   laat de scan slagen -- zelfde filosofie als de techniek-checks en check.js. */
'use strict';

// Pakketten die we bewust NIET (meer) gebruiken: zelf gebouwd (zie docs/de-lijn.md).
// Een require hiervan betekent dat een zelfbouw-beslissing is teruggedraaid.
const VERBODEN = new Set(['web-push', 'express-rate-limit', 'http_ece',
  '@simplewebauthn/server', '@anthropic-ai/sdk', 'terser', 'acorn', 'nodemailer', 'express', '@sentry/node', 'redis', 'axe-core', 'pg']);
// Namen die op een geheim wijzen: daar mag Math.random NOOIT aan ten grondslag liggen (regel 1).
const GEHEIM = /token|secret|sleutel|geheim|wachtwoord|pincode|salt|nonce|otp|sessie|vapid/i;
const TERMINATORS = new Set(['ReturnStatement', 'ThrowStatement', 'BreakStatement', 'ContinueStatement']);

function strWaarde(node) {
  if (!node || node.type !== 'Literal' || node.kind !== 'string') return null;
  const r = node.raw; return r.slice(1, -1); // buitenste quotes eraf (genoeg voor pakketnamen)
}
const isNaam = (n, w) => n && n.type === 'Identifier' && n.name === w;
// require('x') -> 'x', anders null
function requireDoel(node) {
  if (node.type !== 'CallExpression' || !isNaam(node.callee, 'require') || node.arguments.length !== 1) return null;
  return strWaarde(node.arguments[0]);
}
// dichtstbijzijnde "doel" met een naam boven een knoop (voor de geheim-check)
function doelNaamBoven(pad) {
  for (let i = pad.length - 1; i >= 0; i--) {
    const p = pad[i];
    if (p.type === 'VariableDeclarator' && p.id && p.id.type === 'Identifier') return p.id.name;
    if (p.type === 'AssignmentExpression') { const l = p.left; if (l && l.type === 'Identifier') return l.name; if (l && l.type === 'MemberExpression' && l.property && l.property.type === 'Identifier') return l.property.name; }
    if (p.type === 'Property' && p.key) return p.key.name || strWaarde(p.key);
    if (p.type === 'FunctionDeclaration' || p.type === 'FunctionExpression') break; // niet over een functiegrens heen kijken
  }
  return null;
}

/* ---- hulpjes voor regel 'index-zonder-grens' (zie de regel zelf) ---- */
// req.body.x / req.query.x / body.x  ->  true
function uitVerzoek(node) {
  let n = node;
  while (n && n.type === 'MemberExpression') {
    const o = n.object;
    if (o && o.type === 'Identifier' && /^(req|request)$/.test(o.name)) return true;
    if (o && o.type === 'MemberExpression' && o.object && o.object.type === 'Identifier'
        && /^(req|request)$/.test(o.object.name)) return true;
    n = o;
  }
  return false;
}
/* Number(req.body.x) / parseInt(req.body.x) / +req.body.x -> true.

   Let op de eis GETALSDWANG. Een kale req.body.x als index is bijna altijd
   een MAPLOOKUP -- db.data.notifications[req.session.key] -- en daar is niets
   mis mee: een sleutel die niet bestaat geeft undefined, geen verkeerd
   element. Zonder dat onderscheid meldde deze regel 156 plekken, waarvan de
   overgrote meerderheid gewone objecttoegang was, en dan is hij waardeloos.

   Het gevaar zit uitsluitend bij een index die tot een GETAL is gedwongen:
   dan wordt null een 0 en NaN een 0, en wijst hij het eerste element aan. */
function getalUitVerzoek(node) {
  if (!node) return false;
  if (node.type === 'CallExpression' && node.callee && node.callee.type === 'Identifier'
      && /^(Number|parseInt|parseFloat)$/.test(node.callee.name))
    return node.arguments.some(a => a && a.type === 'MemberExpression' && uitVerzoek(a));
  if (node.type === 'UnaryExpression' && node.operator === '+')
    return node.argument && node.argument.type === 'MemberExpression' && uitVerzoek(node.argument);
  return false;
}
// voor splice() telt ook een kale waarde uit het verzoek: die wordt sowieso een getal
function ruweBuitenwaarde(node) {
  if (!node) return false;
  if (node.type === 'MemberExpression') return uitVerzoek(node);
  return getalUitVerzoek(node);
}
// dichtstbijzijnde functie boven een knoop
function functieBoven(pad) {
  for (let i = pad.length - 1; i >= 0; i--) {
    const t = pad[i].type;
    if (t === 'FunctionDeclaration' || t === 'FunctionExpression' || t === 'ArrowFunctionExpression') return pad[i];
  }
  return null;
}
/* Alle knopen onder een knoop (kleine eigen wandeling, zonder walk.js te hoeven
   kennen).

   WAAROM DIT MET EEN STAPEL GAAT EN NIET MET RECURSIE. Hier stond een
   recursieve generator met `yield*`. Dat leest prettig en het is een valkuil:
   bij `yield*` gaat elke knoop door de HELE delegatieketen terug naar boven,
   dus een knoop op diepte D kost D stappen. Bij een diep geneste expressie --
   een lange keten van string-concatenaties, en daar staan er hier veel -- loopt
   dat op tot N x D.

   Zichtbaar effect: de scan van server/ kwam in negen minuten niet rond terwijl
   scripts/ (57 bestanden) in ruim een seconde klaar was. Het was niet de
   grootte: server.js van 212 kilobyte deed 38 milliseconde, en een bestand van
   vier kilobyte met een diepe expressie bijna twee seconden. In vonk/index.js
   kostte EEN knoop 2285 van de 2156 milliseconde van het hele bestand.

   Een stapel doet hetzelfde werk in N stappen. De volgorde blijft pre-order
   (knoop voor zijn kinderen, kinderen op volgorde), zodat geen enkele regel
   hierdoor een ander oordeel geeft. */
function* onder(node) {
  if (!node || typeof node !== 'object') return;
  const stapel = [node];
  while (stapel.length) {
    const n = stapel.pop();
    yield n;
    const kinderen = [];
    for (const k of Object.keys(n)) {
      if (k === 'type' || k === 'lijn') continue;
      const v = n[k];
      if (Array.isArray(v)) { for (const x of v) if (x && typeof x === 'object' && x.type) kinderen.push(x); }
      else if (v && typeof v === 'object' && v.type) kinderen.push(v);
    }
    // omgekeerd op de stapel, zodat ze er in de oorspronkelijke volgorde afkomen
    for (let i = kinderen.length - 1; i >= 0; i--) stapel.push(kinderen[i]);
  }
}
/* Komt deze naam in deze functie uit een ruwe buitenwaarde? */
/* EEN DOORLOOP PER FUNCTIE, NIET EEN PER NAAM.

   naamUitBuiten() en heeftGrens() liepen allebei de HELE functie-body af, en ze
   werden aangeroepen voor ELKE array-index in die functie. Bij N knopen en M
   verschillende indexnamen is dat N x M werk, en dat liep volledig uit de hand:
   de scan van server/ kwam in negen minuten niet rond terwijl scripts/ (57
   bestanden) in ruim een seconde klaar was. Een bestand van vier kilobyte kostte
   anderhalve seconde; server.js van 212 kilobyte deed er 164 milliseconde over.
   Niet de grootte was het probleem maar het aantal indexeringen per functie.

   Cachen per (functie, naam) hielp maar half -- bij veel verschillende namen
   loop je nog steeds even vaak. Daarom nu EEN doorloop per functie die meteen
   twee verzamelingen oplevert: welke namen uit het verzoek komen, en welke
   namen ergens een grens hebben. Daarna is elke vraag een lookup.

   De WeakMap hangt aan de functieknoop zelf, dus hij verdwijnt met de boom en er
   blijft niets staan tussen bestanden. Geen enkel oordeel verandert hierdoor --
   alleen hoe vaak we hetzelfde uitrekenen. */
const _perFunctie = new WeakMap();
function analyse(fn) {
  let a = _perFunctie.get(fn);
  if (a) return a;
  a = { uitVerzoek: new Set(), metGrens: new Set(), elementCheck: new Set() };
  for (const n of onder(fn.body)) {
    // welke namen krijgen een tot getal gedwongen waarde uit het verzoek
    if (n.type === 'VariableDeclarator' && n.id && n.id.name && getalUitVerzoek(n.init)) a.uitVerzoek.add(n.id.name);
    if (n.type === 'AssignmentExpression' && n.left && n.left.name && getalUitVerzoek(n.right)) a.uitVerzoek.add(n.left.name);

    // en welke namen ergens een grens krijgen
    if (n.type === 'CallExpression' && n.callee && n.callee.type === 'MemberExpression'
        && n.callee.property && /^(isInteger|isSafeInteger|isFinite)$/.test(n.callee.property.name)) {
      for (const arg of (n.arguments || [])) if (arg && arg.type === 'Identifier') a.metGrens.add(arg.name);
    }
    if (n.type === 'BinaryExpression' && ['<', '>', '<=', '>='].includes(n.operator)) {
      for (const zij of [n.left, n.right]) if (zij && zij.type === 'Identifier') a.metGrens.add(zij.name);
    }
    /* De derde vorm van een grens: kijken of het ELEMENT bestaat.
         if (!p.poll.opties[i]) return 400;
       Dat is een volwaardige controle -- lijst[NaN] en lijst[-1] zijn undefined,
       dus die aanroep valt er netjes op stuk. Zonder deze herkenning wijst de
       regel correcte routes aan, en een regel die goed werk afkeurt wordt
       uitgezet. Bij de eerste herschrijving stond hier per ongeluk ELKE
       computed member; dat is te breed om iets te betekenen en tegelijk werd de
       verzameling niet gebruikt, waardoor de scan twee correcte routes
       afkeurde. */
    if (n.type === 'UnaryExpression' && n.operator === '!' && n.argument
        && n.argument.type === 'MemberExpression' && n.argument.computed
        && n.argument.property && n.argument.property.type === 'Identifier') {
      a.elementCheck.add(n.argument.property.name);
    }
  }
  _perFunctie.set(fn, a);
  return a;
}

function naamUitBuiten(fn, naam) { return analyse(fn).uitVerzoek.has(naam); }

function naamUitBuiten_(fn, naam) {
  for (const n of onder(fn.body)) {
    if (n.type === 'VariableDeclarator' && n.id && n.id.name === naam && getalUitVerzoek(n.init)) return true;
    if (n.type === 'AssignmentExpression' && n.left && n.left.name === naam && getalUitVerzoek(n.right)) return true;
  }
  return false;
}
/* Staat er ergens in deze functie een grens op die naam? */
function heeftGrens(fn, naam) {
  const a = analyse(fn);
  return a.metGrens.has(naam) || a.elementCheck.has(naam);
}

/* DE UITPUTTENDE VARIANT IS VERHUISD NAAR DE TOETS.

   `heeftGrens_` stond hier, en zijn eigen commentaar zei waarom: "hij wordt niet
   meer aangeroepen -- analyse() hierboven doet hetzelfde in een doorloop -- maar
   hij blijft staan ... en de toets vergelijkt de twee". Dat is geen productiecode
   maar het ORAKEL van test/ast-grens.test.js, en een orakel hoort bij zijn toets.

   Hij stond hier ook niet gratis. Deze module wordt onder dekking gemeten, dus
   telden zijn 46 regels mee in de noemer van de dekkingsvloer -- en omdat alleen
   ast-grens.test.js hem aanriep, was die ene toets de enige die ze kon dekken.
   Zolang hij hier stond, moest die toets dus onder dekking draaien, en dat kost
   1272 seconden tegen 430 zonder. Dat was het kritieke pad van de hele keten.

   Wat NIET verandert is de bewering zelf: de snelle en de uitputtende variant
   worden nog steeds op de echte boom tegen elkaar gehouden. Alleen woont de
   uitputtende nu naast de toets die hem als enige gebruikt. */


const REGELS = [
  {
    id: 'verboden-pakket', ernst: 'fout',
    keur(node) {
      const doel = requireDoel(node);
      if (doel && VERBODEN.has(doel)) return ['require van "' + doel + '" is verboden: dat bouwen we zelf (zie docs/de-lijn.md).'];
      return null;
    }
  },
  {
    id: 'geen-eval', ernst: 'fout',
    keur(node) {
      if (node.type === 'CallExpression' && (isNaam(node.callee, 'eval') || isNaam(node.callee, 'Function'))) return ['eval()/Function() bouwt code uit een string: injectie-risico, niet gebruiken.'];
      if (node.type === 'NewExpression' && isNaam(node.callee, 'Function')) return ['new Function() bouwt code uit een string: injectie-risico, niet gebruiken.'];
      return null;
    }
  },
  {
    id: 'math-random-geheim', ernst: 'fout',
    keur(node, pad) {
      if (node.type === 'MemberExpression' && !node.computed && isNaam(node.object, 'Math') && isNaam(node.property, 'random')) {
        const naam = doelNaamBoven(pad);
        if (naam && GEHEIM.test(naam)) return ['Math.random voor "' + naam + '": nooit een toevalsbron voor geheimen (regel 1). Gebruik crypto.randomBytes/randomInt.'];
      }
      return null;
    }
  },
  {
    id: 'onbereikbare-code', ernst: 'fout',
    keur(node) {
      const lijst = node.type === 'BlockStatement' || node.type === 'Program' ? node.body : node.type === 'SwitchCase' ? node.consequent : null;
      if (!lijst) return null;
      const uit = [];
      for (let i = 0; i < lijst.length - 1; i++) {
        if (TERMINATORS.has(lijst[i].type)) {
          const volgend = lijst[i + 1];
          // functie- en var-declaraties worden gehoist: die tellen niet als dood
          if (volgend.type !== 'FunctionDeclaration' && !(volgend.type === 'VariableDeclaration' && volgend.kind === 'var'))
            uit.push('onbereikbare code na ' + lijst[i].type + ' (regel ' + lijst[i].lijn + ').');
          break;
        }
      }
      return uit.length ? uit : null;
    }
  },
  {
    id: 'dubbele-objectsleutel', ernst: 'waarschuwing',
    keur(node) {
      if (node.type !== 'ObjectExpression') return null;
      const gezien = new Map(); const uit = [];
      for (const p of node.properties) {
        if (p.type !== 'Property' || p.computed) continue;
        const naam = (p.key && (p.key.name || strWaarde(p.key)));
        if (naam == null) continue;
        const soort = p.kind === 'get' || p.kind === 'set' ? p.kind : 'init';
        const eerder = gezien.get(naam);
        if (eerder != null && !(eerder !== 'init' && soort !== 'init' && eerder !== soort)) uit.push('dubbele objectsleutel "' + naam + '".');
        gezien.set(naam, soort);
      }
      return uit.length ? uit : null;
    }
  },
  {
    id: 'index-zonder-grens', ernst: 'fout',
    keur(node, pad) {
      let index = null, waar = null;
      if (node.type === 'CallExpression' && node.callee && node.callee.type === 'MemberExpression'
          && node.callee.property && node.callee.property.name === 'splice') { index = node.arguments[0]; waar = 'splice()'; }
      else if (node.type === 'MemberExpression' && node.computed) { index = node.property; waar = 'een array-index'; }
      if (!index) return null;
  
      const riskant = waar === 'splice()' ? ruweBuitenwaarde(index) : getalUitVerzoek(index);
      if (riskant)
        return [waar + ' krijgt een index rechtstreeks uit het verzoek. Number(null) is 0 en NaN wordt 0, '
          + 'dus een ontbrekende of onleesbare waarde wijst stilzwijgend het eerste element aan (en -1 het laatste). '
          + 'Controleer eerst op een geheel getal binnen bereik.'];
  
      if (index.type === 'Identifier') {
        const fn = functieBoven(pad);
        if (fn && naamUitBuiten(fn, index.name) && !heeftGrens(fn, index.name))
          return [waar + ' gebruikt "' + index.name + '", die uit het verzoek komt, zonder ergens een grens. '
            + 'Controleer op een geheel getal binnen bereik voordat je hem als index gebruikt.'];
      }
      return null;
    }
  }
];

/* `analyse` en `onder` gaan mee naar buiten zodat test/ast-grens.test.js de
   snelle variant op de ECHTE boom tegen zijn uitputtende tegenhanger kan houden.
   Die tegenhanger woont in de toets zelf (zie hierboven). Een optimalisatie is
   pas te vertrouwen als vastligt dat hij hetzelfde zegt. */
module.exports = { REGELS, VERBODEN, GEHEIM, heeftGrens, naamUitBuiten, analyse, onder };
