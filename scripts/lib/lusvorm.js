/* DE LUSVORM -- de zuivere analyse achter scripts/lussen.js.

   Waarom dit een eigen bestand is: lussen.js SCHRIJFT bij het laden (zelfde
   wacht als symbolen.js, en om dezelfde reden -- een enkele laadcontrole zou
   het register overschrijven met wat die aanroep toevallig meet). Daarmee is
   er niets aan te toetsen. De indeling zelf raakt geen schijf en hoort dus
   hier: test/lussen.test.js voedt hem fragmenten met een bekende uitkomst.

   Alles hier is een FUNCTIE VAN DE BOOM en van niets anders. Geen bestand,
   geen register, geen tijd. Een indeling die per aanroep kan verschillen, is
   geen indeling. */
'use strict';
const crypto = require('crypto');
const { loop: wandel } = require('../ast/walk');

const LUSKNOPEN = new Set(['ForStatement', 'ForInStatement', 'ForOfStatement', 'WhileStatement', 'DoWhileStatement']);
const ITERATORS = ['forEach', 'map', 'filter', 'reduce', 'reduceRight', 'some', 'every', 'flatMap', 'find', 'findIndex', 'findLast', 'sort'];
const FUNCTIEKNOPEN = new Set(['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression']);

/* De structuurhash: de boom zonder plaats. Regel-, start- en eindvelden eruit,
   sleutels gesorteerd zodat de volgorde van het parseren er niet in lekt. */
function structuurhash(knoop) {
  const schoon = (n) => {
    if (Array.isArray(n)) return n.map(schoon);
    if (!n || typeof n !== 'object') return n;
    const uit = {};
    for (const k of Object.keys(n).sort()) {
      if (k === 'lijn' || k === 'start' || k === 'end') continue;
      uit[k] = schoon(n[k]);
    }
    return uit;
  };
  return crypto.createHash('sha256').update(JSON.stringify(schoon(knoop))).digest('hex').slice(0, 12);
}

/* Het omsluitende symbool uit het PAD, niet uit een regelnummervergelijking.
   Een functie zonder naam levert de dichtstbijzijnde benoemde voorouder op;
   lukt dat niet, dan is het symbool `null` en staat dat er zo in -- een
   verzonnen naam zou de sleutel onbetrouwbaar maken. */
function symbooolVan(pad) {
  for (let i = pad.length - 1; i >= 0; i--) {
    const n = pad[i];
    if (n.type === 'FunctionDeclaration' && n.id && n.id.name) return n.id.name;
    if (n.type === 'MethodDefinition' && n.key && n.key.name) return n.key.name;
    if (n.type === 'VariableDeclarator' && n.id && n.id.name && n.init && FUNCTIEKNOPEN.has(n.init.type)) return n.id.name;
    if (n.type === 'Property' && n.key && (n.key.name || n.key.raw) && n.value && FUNCTIEKNOPEN.has(n.value.type)) return n.key.name || n.key.raw;
    if (n.type === 'AssignmentExpression' && n.left && n.left.type === 'MemberExpression' && n.left.property && n.left.property.name
        && n.right && FUNCTIEKNOPEN.has(n.right.type)) return n.left.property.name;
  }
  return null;
}

/* EIGEN LIJF. Een `break` in een geneste functie breekt deze lus niet, en een
   `await` in een callback binnen de lus is niet het await VAN de lus. Deze
   wandeling stopt daarom bij elke functiegrens en bij elke binnenlus die zijn
   eigen `break` vangt. Zonder die grens telt de meter andermans uitweg mee --
   en dat is precies hoe een probe "alle 54 hebben een uitweg" kan zeggen
   terwijl niemand dat heeft nagekeken. */
function inEigenLijf(lus, bezoek) {
  const isLus = n => LUSKNOPEN.has(n.type);
  (function ga(n, viaBinnenlus) {
    if (Array.isArray(n)) { for (const x of n) ga(x, viaBinnenlus); return; }
    if (!n || typeof n !== 'object' || typeof n.type !== 'string') return;
    if (FUNCTIEKNOPEN.has(n.type)) return;            // andere functie: niet ons lijf
    bezoek(n, viaBinnenlus);
    const dieper = viaBinnenlus || isLus(n) || n.type === 'SwitchStatement';
    for (const k in n) {
      if (k === 'lijn' || k === 'start' || k === 'end') continue;
      const v = n[k];
      if (v && typeof v === 'object') ga(v, dieper);
    }
  })(lus.body, false);
}

/* ---------------------------------------------------------------------------
   DE VORM: hoe wordt deze lus begrensd?

   Gesloten verzameling, en `ONBEPAALD` draagt altijd een reden. De grens tussen
   `bewezen` en `aannemelijk` zit in wat er STRUCTUREEL vaststaat tegenover wat
   er waarschijnlijk is: een teller die bij een literaal begint, monotoon
   ophoogt en wiens bovengrens in het lijf niet groeit, is begrensd -- daar komt
   geen aanname aan te pas. Een `for...of` over een naam is dat NIET: die naam
   kan een oneindige generator zijn. Dat verschil is de helft van de waarde van
   dit register, en het is precies wat een telling van sleutelwoorden mist. */

const OPHOOG = new Set(['++', '--']);

function naamVanBasis(uitdrukking) {          // a.b.c -> 'a'
  let n = uitdrukking;
  while (n && n.type === 'MemberExpression') n = n.object;
  return n && n.type === 'Identifier' ? n.name : null;
}

/* Groeit de bovengrens in het lijf? `for (let i=0;i<rij.length;i++) rij.push(x)`
   loopt eeuwig, en ziet er tot op het laatste teken uit als een nette teller. */
function grensGroeitInLijf(lus, basisnaam) {
  if (!basisnaam) return false;
  let groeit = false;
  inEigenLijf(lus, (n) => {
    if (n.type !== 'CallExpression' || !n.callee || n.callee.type !== 'MemberExpression') return;
    const m = n.callee.property && n.callee.property.name;
    if (m !== 'push' && m !== 'unshift' && m !== 'splice' && m !== 'concat') return;
    if (naamVanBasis(n.callee.object) === basisnaam) groeit = true;
  });
  return groeit;
}

/* Wordt de teller in het lijf zelf verzet? Dan zegt de update-clausule niets. */
function tellerVerzetInLijf(lus, naam) {
  let verzet = false;
  inEigenLijf(lus, (n) => {
    if (n.type === 'AssignmentExpression' && n.left && n.left.type === 'Identifier' && n.left.name === naam) verzet = true;
    if (n.type === 'UpdateExpression' && n.argument && n.argument.name === naam) verzet = true;
  });
  return verzet;
}

const ALTIJD_WAAR = (n) => n && n.type === 'Literal' && (n.raw === 'true' || n.raw === '1');

/* Een uitdrukking die aantoonbaar een EINDIGE rij oplevert. Bewust kort: elke
   naam die hier bij komt, moet waar zijn voor ELKE aanroep -- niet meestal. */
function eindigeRij(n) {
  if (!n) return false;
  if (n.type === 'ArrayExpression') return true;
  if (n.type === 'CallExpression' && n.callee) {
    if (n.callee.type === 'MemberExpression' && n.callee.property) {
      const m = n.callee.property.name;
      if (['keys', 'values', 'entries', 'getOwnPropertyNames'].includes(m)
          && n.callee.object && n.callee.object.name === 'Object') return true;
      if (['slice', 'split', 'match', 'filter', 'map', 'concat', 'flat', 'flatMap'].includes(m)) return true;
    }
  }
  return false;
}

function vormVan(lus) {
  // ALTIJD-WAAR: while(true), do..while(true), for(;;)
  const altijdWaar = (lus.type === 'WhileStatement' || lus.type === 'DoWhileStatement')
    ? ALTIJD_WAAR(lus.test)
    : (lus.type === 'ForStatement' && !lus.test);
  if (altijdWaar) return { begrenzing: 'ALTIJD_WAAR', reden: null };

  if (lus.type === 'ForOfStatement' || lus.type === 'ForInStatement') {
    if (eindigeRij(lus.right)) return { begrenzing: 'EINDIGE_RIJ', reden: null };
    return { begrenzing: 'COLLECTIE', reden: 'itereert over een uitdrukking waarvan de eindigheid hier niet vaststaat' };
  }

  if (lus.type === 'ForStatement') {
    const decl = lus.init && lus.init.type === 'VariableDeclaration' && lus.init.declarations && lus.init.declarations[0];
    const naam = decl && decl.id && decl.id.name;
    const startLiteraal = decl && decl.init && decl.init.type === 'Literal';
    const upd = lus.update;
    const monotoon = upd && ((upd.type === 'UpdateExpression' && OPHOOG.has(upd.operator) && upd.argument && upd.argument.name === naam)
      || (upd.type === 'AssignmentExpression' && (upd.operator === '+=' || upd.operator === '-=')
          && upd.left && upd.left.name === naam && upd.right && upd.right.type === 'Literal'));
    const test = lus.test;
    const vergelijkt = test && test.type === 'BinaryExpression' && ['<', '<=', '>', '>='].includes(test.operator)
      && test.left && test.left.name === naam;
    if (naam && startLiteraal && monotoon && vergelijkt) {
      const basis = naamVanBasis(test.right);
      if (grensGroeitInLijf(lus, basis))
        return { begrenzing: 'TELLER_GROEIENDE_GRENS', reden: 'de bovengrens (' + basis + ') groeit in het lijf van de lus zelf' };
      if (tellerVerzetInLijf(lus, naam))
        return { begrenzing: 'TELLER_VERZET', reden: 'de teller ' + naam + ' wordt in het lijf ook zelf toegewezen' };
      return { begrenzing: 'TELLER_MONOTOON', reden: null };
    }
    return { begrenzing: 'ONBEPAALD', reden: 'geen herkenbare teller: ' + (naam ? 'start/ophoging/test passen niet op elkaar' : 'de init-clausule verklaart geen lusvariabele') };
  }

  /* WHILE MET EEN VEILIGHEIDSTELLER -- de goedkoopste vorm van abstracte
     interpretatie die hier iets oplevert, en de meest voorkomende in dit huis:

         while (t.volgendeAt <= grens && veiligheid++ < 500)   (bank/incasso.js)
         while (pogingen < 5) { pogingen++ }

     Je hoeft niet te weten hoeveel iteraties het worden. Je hoeft te weten dat
     er een teller is die bij elke ronde EEN kant op beweegt en die tegen een
     LITERAAL wordt afgezet. Dan is het aantal rondes hoogstens die literaal, en
     dat is een bewijs en geen vermoeden.

     De twee manieren waarop dit stil fout gaat, en waarom ze hier afvallen:
     de teller wordt in het lijf teruggezet (`pogingen = 0`), of de grens is
     geen literaal maar een uitdrukking die zelf kan groeien. Allebei laten ze
     de lus doorlopen terwijl hij er begrensd uitziet. */
  const tel = tellerBegrensdVan(lus);
  if (tel) return { begrenzing: 'TELLER_IN_VOORWAARDE', reden: null, teller: tel };
  return { begrenzing: 'ONBEPAALD', reden: 'de voorwaarde is een uitdrukking waarvan de afloop hier niet af te leiden is' };
}

/* Zoekt in de voorwaarde een teller die tegen een literaal wordt afgezet, en
   controleert of hij de goede kant op beweegt en in het lijf niet wordt
   teruggezet. Levert de naam op, of null. */
function tellerBegrensdVan(lus) {
  const kandidaten = [];
  wandel(lus.test, (n) => {
    if (n.type !== 'BinaryExpression' || !['<', '<=', '>', '>='].includes(n.operator)) return;
    const omhoog = n.operator === '<' || n.operator === '<=';
    const naamKant = omhoog ? n.left : n.left;
    const grensKant = n.right;
    if (!grensKant || grensKant.type !== 'Literal' || grensKant.kind !== 'getal') return;
    // de naam mag in een ++ zitten: `veiligheid++ < 500`
    const naam = naamKant && (naamKant.name || (naamKant.type === 'UpdateExpression' && naamKant.argument && naamKant.argument.name));
    if (!naam) return;
    kandidaten.push({ naam, omhoog });
  });
  for (const k of kandidaten) {
    let beweegt = false, teruggezet = false;
    const kijk = (n) => {
      if (n.type === 'UpdateExpression' && n.argument && n.argument.name === k.naam)
        { if ((k.omhoog && n.operator === '++') || (!k.omhoog && n.operator === '--')) beweegt = true; }
      if (n.type === 'AssignmentExpression' && n.left && n.left.name === k.naam) {
        if (n.operator === '=') teruggezet = true;
        else if (n.right && n.right.type === 'Literal'
          && ((k.omhoog && n.operator === '+=') || (!k.omhoog && n.operator === '-='))) beweegt = true;
        else teruggezet = true;
      }
    };
    wandel(lus.test, kijk);
    inEigenLijf(lus, kijk);
    if (beweegt && !teruggezet) return k.naam;
  }
  return null;
}

/* ---------------------------------------------------------------------------
   DE TERMINATIEGRAAD. Gesloten verzameling. De twee graden die dit huis
   vandaag NIET kan zetten staan onderaan in `nogNietTeZetten` met de reden. */
const GRADEN = ['bewezenBegrensd', 'aannemelijkBegrensd', 'uitwegAanwezig', 'geenUitwegGevonden', 'nietVastTeStellen'];

function terminatieVan(lus, vorm) {
  if (vorm.begrenzing === 'TELLER_MONOTOON')
    return { graad: 'bewezenBegrensd', grond: 'teller begint op een literaal, hoogt monotoon op, en de bovengrens groeit niet in het lijf' };
  if (vorm.begrenzing === 'TELLER_IN_VOORWAARDE')
    return { graad: 'bewezenBegrensd', grond: 'de voorwaarde zet teller ' + vorm.teller + ' af tegen een literaal, hij beweegt elke ronde die kant op en wordt in het lijf niet teruggezet' };
  if (vorm.begrenzing === 'EINDIGE_RIJ')
    return { graad: 'bewezenBegrensd', grond: 'itereert over een uitdrukking die per definitie een eindige rij oplevert' };
  if (vorm.begrenzing === 'COLLECTIE')
    return { graad: 'aannemelijkBegrensd', grond: 'itereert een collectie; eindig tenzij de bron een oneindige generator is' };
  if (vorm.begrenzing === 'ALTIJD_WAAR') {
    let uitweg = null;
    inEigenLijf(lus, (n, viaBinnenlus) => {
      if (uitweg) return;
      /* Een `break` in een BINNENlus of switch breekt die, niet deze. Een
         `return` en een `throw` verlaten de hele functie en tellen dus wel. */
      if (n.type === 'BreakStatement' && !n.label && viaBinnenlus) return;
      if (n.type === 'BreakStatement' || n.type === 'ReturnStatement' || n.type === 'ThrowStatement') uitweg = n.type;
    });
    if (!uitweg) return { graad: 'geenUitwegGevonden', grond: 'altijd-ware lus zonder break, return of throw in zijn eigen lijf' };
    return { graad: 'uitwegAanwezig', grond: 'altijd-ware lus met een ' + uitweg + ' in zijn eigen lijf; of dat pad BEREIKBAAR is, vraagt een control-flowgraaf en staat hier niet vast' };
  }
  return { graad: 'nietVastTeStellen', grond: vorm.reden || 'de vorm is niet herleid' };
}

/* ---------------------------------------------------------------------------
   WAT DOET DE LUS -- neveneffect, en waarom er geen `geen neveneffect` bestaat.

   De herkenning is LEXICAAL: een aanroepnaam die op schrijven lijkt. Dat maakt
   de uitslag een ONDERGRENS, en dus graad `vermoed`. Vandaar dat de derde
   uitkomst `geenGevonden` heet en niet `geen`: dit register weet niet dat een
   lus niets doet, het weet dat het niets gevonden heeft. Dat verschil is exact
   het verschil dat `kern/stuur/gevolg.js` maakt tussen `geen-effect-gemeten` en
   `onbekend`, en die twee mogen nooit door elkaar lopen. */
const EFFECTWOORDEN = [
  [/^(save|opslaan|bewaar|schrijf|write|insert|upsert|persist)/i, 'opslag'],
  [/^(delete|verwijder|wis|drop|remove)/i, 'verwijdering'],
  [/^(fetch|request|post|put|patch|get)$/i, 'netwerk'],
  [/^(query|select|find|zoek)$/i, 'lezing'],
  [/^(pay|betaal|boek|afschrijf|overmaak|incasso|uitbetaal)/i, 'geld'],
  [/^(send|stuur|verstuur|mail|sms|notify|meld)/i, 'bericht']
];

function effectenVan(lus) {
  const gevonden = new Set();
  inEigenLijf(lus, (n) => {
    if (n.type !== 'CallExpression' || !n.callee) return;
    const naam = n.callee.type === 'MemberExpression'
      ? (n.callee.property && n.callee.property.name)
      : n.callee.name;
    if (!naam) return;
    for (const [re, label] of EFFECTWOORDEN) if (re.test(naam)) gevonden.add(label);
  });
  return [...gevonden].sort();
}

/* HET DOMEIN komt uit het PAD en is dus ook lexicaal -- graad `vermoed`. Het is
   met opzet geen vermenigvuldiger maar een ETIKET: het bepaalt de volgorde
   waarin een mens deze lijst afwerkt, niet een cijfer dat een andere factor
   kan wegdrukken. `×10 voor geld` zou van vijf onzekere factoren een precies
   ogend getal maken, en dat is erger dan geen getal. */
const DOMEINEN = [
  [/^server\/(kern\/pay|kern\/waarde|kern\/geldbeleid|betaal|kern\/commercie|kern\/kosten)/, 'geld'],
  [/^server\/(accounts|webauthn|kern\/identiteit|kluis)/, 'identiteit'],
  [/^server\/(kern\/bevoegdheid|kern\/stuur|middleware|kern\/kantoor)/, 'toegang'],
  [/^server\/(kern\/rtfos|kern\/foundation)/, 'foundation'],
  [/^server\/(kern\/horeca|kern\/mobiliteit|kern\/vervoer|kern\/reis)/, 'uitvoering'],
  [/^public\//, 'scherm']
];
const domeinVan = rel => (DOMEINEN.find(([re]) => re.test(rel)) || [null, 'overig'])[1];

/* ---------------------------------------------------------------------------
   DE RISICOKLASSE -- uit expliciete regels, mét de opbouw die hem zette.
   Geen product, geen gewichten, geen samengesteld cijfer. Wie wil weten waarom
   een lus kritiek heet, leest de opbouw; wie een regel wil veranderen, ziet
   welke lussen erdoor bewegen. */
const KRITIEKE_DOMEINEN = new Set(['geld', 'identiteit', 'toegang']);

function risicoVan(lus, rel, vorm, terminatie, effecten, nesting, metAwait) {
  const opbouw = [];
  if (terminatie.graad === 'geenUitwegGevonden') opbouw.push('terminatie: geen uitweg gevonden');
  if (terminatie.graad === 'nietVastTeStellen') opbouw.push('terminatie: niet vast te stellen');
  if (terminatie.graad === 'uitwegAanwezig') opbouw.push('terminatie: uitweg niet op bereikbaarheid getoetst');
  const domein = domeinVan(rel);
  if (KRITIEKE_DOMEINEN.has(domein)) opbouw.push('domein: ' + domein);
  if (metAwait) opbouw.push('I/O in het lijf (await)');
  if (effecten.includes('geld')) opbouw.push('neveneffect: geld');
  if (effecten.includes('opslag') || effecten.includes('verwijdering')) opbouw.push('neveneffect: schrijft');
  if (nesting >= 2) opbouw.push('nesting: ' + nesting + ' diep');

  let klasse = 'laag';
  if (opbouw.length) klasse = 'midden';
  /* HOOG: onzekere afloop EN een gevolg buiten het geheugen. Een lus waarvan de
     afloop onzeker is maar die niets doet, is een prestatievraag; doet hij wel
     iets, dan is het een gegevensvraag. */
  const afloopOnzeker = terminatie.graad === 'geenUitwegGevonden' || terminatie.graad === 'nietVastTeStellen' || terminatie.graad === 'uitwegAanwezig';
  if (afloopOnzeker && (metAwait || effecten.length)) klasse = 'hoog';
  /* KRITIEK: hetzelfde, maar in een domein waar een herhaling of een hangende
     lus een mens raakt in plaats van een scherm. */
  if (klasse === 'hoog' && (KRITIEKE_DOMEINEN.has(domein) || effecten.includes('geld'))) klasse = 'kritiek';
  if (terminatie.graad === 'geenUitwegGevonden' && (metAwait || effecten.length)) klasse = 'kritiek';
  return { klasse, opbouw, domein };
}

/* ---------------------------------------------------------------------------
   DE VERBORGEN LUSSEN. Een functie die zichzelf aanroept is de makkelijke helft;
   `A -> B -> C -> A` is net zo goed een lus en staat in geen enkele telling van
   sleutelwoorden. Tarjan over de bestaande graven levert ze allebei:

     AANROEPGRAAF.json  symbool -> symbool  (wederzijdse recursie)
     SYMBOLEN.json      bestand -> bestand  (module-kringen)

   Beide graven bestaan al en zijn elders beproefd. Dit register LEEST ze; het
   bouwt er geen eigen tweede versie naast -- dat zou de 22e capabilitylijst
   zijn, en die fout staat al met naam en toenaam in OS.md.

   ITERATIEF en niet recursief: Tarjan op 23.716 kanten met een recursieve
   implementatie loopt op een diepe keten van de stapel af, en dan meldt de
   meter een crash waar een kring hoort te staan. */
function sterkeComponenten(knopen, burenVan) {
  let teller = 0;
  const index = new Map(), laag = new Map(), opStapel = new Set(), stapel = [];
  const uit = [];
  for (const start of knopen) {
    if (index.has(start)) continue;
    const werk = [{ k: start, buren: null, i: 0 }];
    while (werk.length) {
      const kader = werk[werk.length - 1];
      if (kader.buren === null) {
        index.set(kader.k, teller); laag.set(kader.k, teller); teller++;
        stapel.push(kader.k); opStapel.add(kader.k);
        kader.buren = burenVan(kader.k) || [];
      }
      if (kader.i < kader.buren.length) {
        const b = kader.buren[kader.i++];
        if (!index.has(b)) werk.push({ k: b, buren: null, i: 0 });
        else if (opStapel.has(b)) laag.set(kader.k, Math.min(laag.get(kader.k), index.get(b)));
        continue;
      }
      if (laag.get(kader.k) === index.get(kader.k)) {
        const groep = [];
        for (;;) { const w = stapel.pop(); opStapel.delete(w); groep.push(w); if (w === kader.k) break; }
        /* Een groep van EEN is alleen een lus als hij naar zichzelf wijst.
           Zonder die tweede voorwaarde is elk knooppunt een component, en dan
           telt de meter 19.000 kringen die er niet zijn. */
        if (groep.length > 1 || (burenVan(kader.k) || []).includes(kader.k)) uit.push(groep.sort());
      }
      werk.pop();
      if (werk.length) {
        const ouder = werk[werk.length - 1];
        ouder.buren = ouder.buren || [];
        laag.set(ouder.k, Math.min(laag.get(ouder.k), laag.get(kader.k)));
      }
    }
  }
  return uit;
}

/* DE OVERLAPREM. Het klassieke wekkerprobleem: `setInterval(async () => {
   await werk() }, 1000)` waar `werk()` drie seconden duurt -- dan lopen er drie
   uitvoeringen door elkaar. Of dat GEBEURT is statisch niet te zien; of er iets
   is dat het TEGENHOUDT wel. Gezocht wordt een vroege uitstap aan het begin van
   de callback (`if (bezig) return;`), het bekendste patroon. Uitkomst in drie
   standen, want `geenGevonden` is geen `geen`. Een functiedeclaratie hijst, dus
   deze helper mag hier onder staan. */
function overlapRemVan(callback, asyncCallback) {
  if (!callback || !FUNCTIEKNOPEN.has(callback.type)) return 'nietTeZien';
  if (!asyncCallback) return 'nietVanToepassing';   // synchrone callback kan zichzelf niet overlappen
  const lijf = callback.body && callback.body.body;
  if (!Array.isArray(lijf)) return 'geenGevonden';
  const eersteDrie = lijf.slice(0, 3);
  const heeftVroegeUitstap = eersteDrie.some(s => s.type === 'IfStatement' && s.consequent
    && (s.consequent.type === 'ReturnStatement'
      || (s.consequent.type === 'BlockStatement' && (s.consequent.body || []).some(x => x.type === 'ReturnStatement'))));
  return heeftVroegeUitstap ? 'vermoedelijkAanwezig' : 'geenGevonden';
}


module.exports = {
  LUSKNOPEN, ITERATORS, FUNCTIEKNOPEN, GRADEN, DOMEINEN, KRITIEKE_DOMEINEN,
  structuurhash, symbooolVan, inEigenLijf, vormVan, tellerBegrensdVan,
  terminatieVan, effectenVan, domeinVan, risicoVan, overlapRemVan, sterkeComponenten, eindigeRij
};
