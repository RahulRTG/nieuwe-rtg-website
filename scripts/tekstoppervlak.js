#!/usr/bin/env node
'use strict';
/* RTG: HET TEKSTOPPERVLAK -- waar ontstaat gebruikerszichtbare tekst?

   Het doel is niet "de code 114-talig maken" maar iets dat je kunt AFDWINGEN:
   geen gebruikerszichtbare tekst meer hardcoded in een taal. Om dat te kunnen
   handhaven moet eerst vaststaan WAAR die tekst uberhaupt ontstaat. Een
   extractor die een oppervlak mist, geeft een dekkingsgetal dat liegt -- en dat
   getal zou daarna de linter voeden.

   Deze meter telt per oppervlak, met de parser van het huis (scripts/ast/) en
   niet met een regex over code. Hij schrijft TEKSTOPPERVLAK.json.

   VIJF DINGEN DIE EEN NAIEVE METER HIER FOUT DOET, en alle vijf zijn ze hier
   echt fout gegaan bij het karteren:

   1. INLINE <script> VERGETEN. 234 van de 293 schermen dragen hun code in een
      inline blok, samen ongeveer de helft van alle JavaScript in dit huis. Wie
      alleen elk los .js-bestand in public/ leest mist die helft, EN de statische HTML-meting
      mist hem ook, want die strippt <script> juist weg. De tekst valt dan door
      beide zeven heen.

   2. BUNDELS DUBBEL TELLEN. public/apps/app-main.js is bouwuitvoer en byte voor
      byte de som van public/apps/app-main/*.js. Wie beide leest telt elke
      clientstring twee keer en stuurt de ontwikkelaar bovendien naar een
      bestand dat hij niet mag bewerken. Hier telt alleen de BRON.

   3. AFGELEIDE REGISTERS MEETELLEN. public/shared/handelingindex.json en
      sprongindex.json zijn gegenereerd UIT de schermen. Ze meetellen is
      dubbeltelling; ze aan de bron vertalen is een fout.

   4. DE DOELKANT VAN HET WOORDENBOEK MEETELLEN. server/translate/woordenboek
      draagt honderden ENGELSE en SPAANSE termen. Wie alles in server/ als
      "Nederlandse brontekst" opneemt, probeert Engels uit het Nederlands te
      vertalen.

   5. DE TEKST ZONDER STRING. 270 aanroepen geven een vaste nl-locale mee aan
      toLocaleString of Intl. Daar valt niets te extraheren en toch leest een
      Japanse gebruiker een Nederlandse datum. Dat is een EIGEN defectklasse en
      wordt apart geteld, nooit in het dekkingsgetal weggemiddeld.

   EN EEN ZESDE, GEVONDEN DOOR DE METER AAN TE VALLEN: TEKST DIE AL EEN SLEUTEL
      DRAAGT IS GEEN DEFECT. Telt de meter T(sleutel, tekst) en de tekst onder
      data-i18n als hardcoded, dan bestaat er geen enkele manier om zichtbare
      tekst toe te voegen die de poort haalt -- en dan leert de poort mensen
      ontwijken in plaats van sleutelen. Zie GESLEUTELDE_VORMEN.

   Wat deze meter NIET doet staat in `nietGedekt` in de uitvoer. Dat veld hoort
   te krimpen; leeg is het nooit. */

const fs = require('fs');
const path = require('path');
const { parse } = require('./ast/parser');
const { loop } = require('./ast/walk');

const WORTEL = process.cwd();
const UIT = path.join(WORTEL, 'TEKSTOPPERVLAK.json');

/* ---------- 1. welke bestanden doen mee ------------------------------- */

function lees(p) { try { return fs.readFileSync(p, 'utf8'); } catch (e) { return ''; } }

function loopMap(map, filter, uit) {
  uit = uit || [];
  let items;
  try { items = fs.readdirSync(map, { withFileTypes: true }); } catch (e) { return uit; }
  for (const e of items) {
    const p = path.join(map, e.name);
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === '.git' || e.name === 'dist') continue;
      loopMap(p, filter, uit);
    } else if (filter(p)) uit.push(p);
  }
  return uit;
}

/* BUNDEL EN DELEN: PRECIES EEN VAN DE TWEE, EN HET IS DE BUNDEL.

   public/apps/app-main.js is bouwuitvoer en byte voor byte de som van
   public/apps/app-main/*.js. Beide lezen telt elke string dubbel.

   Eerst koos ik de DELEN, omdat je een ontwikkelaar niet naar bouwuitvoer wilt
   sturen. Dat gaf 304 parsefouten: een bundeldeel is vaak geen geldig programma
   op zichzelf -- het opent een functie die een volgend deel sluit. Ze parsen
   pas SAMEN, en samen zijn ze de bundel. Dus telt de bundel, en worden de delen
   overgeslagen. De herkomst in de uitvoer wijst daarmee naar een gegenereerd
   bestand; dat is een tekortkoming van de MELDING, geen reden om de helft van
   de client niet te meten. */
function bundelDelen() {
  const bundels = new Set(); const delenMappen = [];
  for (const f of loopMap(path.join(WORTEL, 'public'), p => p.endsWith('.js'))) {
    const zonder = f.slice(0, -3);
    try {
      if (fs.statSync(zonder).isDirectory()) { bundels.add(f); delenMappen.push(zonder); }
    } catch (e) { /* geen gelijknamige map: een los bestand */ }
  }
  return { bundels, isDeel: p => delenMappen.some(m => p.startsWith(m + path.sep)) };
}

/* ---------- 2. is dit tekst die een MENS leest? ------------------------ */

/* ELKE LETTER, NIET ALLEEN DE LATIJNSE. Dit stond op [A-Za-zÀ-ÖØ-öø-ÿ], en in
   een laag die bestaat om het huis meertalig te maken was dat de duurste blinde
   vlek die er is: Cyrillisch, Grieks, Hebreeuws, Arabisch, Chinees en Japans
   waren voor deze meter geen tekst. Een scherm dat al vertaald was kon
   hardgecodeerd Russisch terugkrijgen zonder dat een ratel bewoog. Vandaag
   verschuift dit de basislijn met NUL (het huis is nu volledig Latijns), dus de
   reparatie is gratis -- en zij wordt pas duur op de dag dat de laag werkt
   waarvoor hij gebouwd is. */
const LETTERS = /\p{L}/u;

/* codevormen die er als tekst uitzien */
const CODEVORM = [
  /^[a-z0-9]+(?:[A-Z][a-z0-9]*)+$/,          // camelCase
  /^[a-z0-9]+(?:[-_][a-z0-9]+)+$/,           // kebab-case en snake_case
  /^[A-Z0-9]+(?:_[A-Z0-9]+)+$/,              // CONSTANT_CASE
  /^[\w.-]+\.(?:js|css|html|json|png|svg|webp|woff2?|md|txt|pdf)$/i,
  /^(?:https?:|mailto:|tel:|data:|blob:|#|\/)/i,
  /^[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}$/,
  /^[A-Z]{2,5}(?:-[A-Z0-9]+)?$/,             // taalcodes en korte codes
  /* HIER STOND /^\d/ -- "begint met een cijfer". Dat verwierp 153 echte
     meldingen, en precies de soort die meervoudsregels nodig heeft:
     "3 nieuwe berichten", "30% naar goede doelen", "2 van 4 stappen verkend".
     Verworpen wordt nu alleen wat GEEN woord bevat: een kaal getal met
     eenheid of scheidingsteken. Staat er na het cijfer een woord, dan is het
     een zin. */
  /^[\d\s.,:%/€$+-]+$/,
  /^[a-z]+$/                                 // een enkel kaal kleinletterwoord: bijna altijd een sleutel
];

/* Een lap lopende tekst mag lang zijn; een base64-blok of een stuk CSS niet.
   De grens stond op 300 tekens en verborg daarmee 69 teksten van samen 4.615
   woorden -- de juridische documenten, waar geldt: hoe langer de lap, hoe
   onzichtbaarder. Lengte is het verkeerde criterium; VORM is het goede. */
const MEGAGRENS = 3000;
function opmaakBlok(s) {
  if (/\{[^}]*:[^}]*;/.test(s)) return true;        // css-achtig
  if (!/\s/.test(s) && s.length > 80) return true;  // een lange reeks zonder spatie: base64, minified
  const letters = (s.match(/\p{L}/gu) || []).length;
  return letters / s.length < 0.4;                  // te weinig letter voor lopende tekst
}

function menselijk(s) {
  s = String(s == null ? '' : s).trim();
  if (s.length < 2 || s.length > MEGAGRENS) return false;
  if (!LETTERS.test(s)) return false;
  if (s.length > 300 && opmaakBlok(s)) return false;
  for (const r of CODEVORM) if (r.test(s)) return false;
  /* een spatie, of een hoofdletter aan het begin: "Sluiten" telt, "flexStart" niet */
  if (!/\s/.test(s) && !/^\p{Lu}/u.test(s)) return false;
  return true;
}

/* ---------- 3. de oppervlakken ---------------------------------------- */

/* sleutelnamen die in dit huis een LABEL dragen */
const LABELSLEUTELS = new Set(['naam', 'label', 'titel', 'title', 'tekst', 'text', 'uitleg', 'omschrijving',
  'beschrijving', 'melding', 'bericht', 'body', 'fout', 'error', 'reden', 'waarom', 'vraag', 'antwoord',
  'wat', 'doe', 'tip', 'missie', 'les', 'kop', 'subtitel', 'placeholder', 'hint', 'onderwerp', 'subject']);

/* aanroepen die tekst naar een MENS sturen */
const MELDERS = new Set(['alert', 'confirm', 'prompt', 'meld', 'toast', 'melding', 'notify', 'notifySupplier',
  'logActivity', 'sendPushToUser', 'sendMail', 'sendSms']);

/* attributen die een schermlezer voorleest of die een mens ziet */
const ATTRIBUTEN = ['placeholder', 'title', 'aria-label', 'aria-description', 'alt', 'data-titel'];

const LOCALEFUNCTIES = new Set(['toLocaleString', 'toLocaleDateString', 'toLocaleTimeString',
  'toLocaleLowerCase', 'toLocaleUpperCase']);
const INTLVORMEN = new Set(['NumberFormat', 'DateTimeFormat', 'Collator', 'PluralRules',
  'RelativeTimeFormat', 'ListFormat', 'Segmenter', 'DisplayNames']);
const VASTNL = /^nl(?![a-z])/i;

/* ---------- 4. de JS-scanner ------------------------------------------ */

function naamVan(node) {
  if (!node) return '';
  if (node.type === 'Identifier') return node.name || '';
  if (node.type === 'MemberExpression') return naamVan(node.property);
  return '';
}
/* De parser van dit huis geeft een Literal GEEN `value`, maar `kind` plus de
   `raw` met de aanhalingstekens er nog omheen. Wie op `typeof n.value ===
   "string"` test, vindt exact nul strings en denkt dat er geen tekst is. */
function isTekstLiteraal(n) {
  return !!n && ((n.type === 'Literal' && n.kind === 'string') ||
    (n.type === 'TemplateLiteral' && n.quasis && n.quasis.length === 1));
}
const ONTSNAPT = { n: '\n', t: '\t', r: '\r', b: '\b', f: '\f', v: '\v', 0: '\0' };
function ontsnap(raw) {
  const s = String(raw).slice(1, -1);
  return s.replace(/\\(u\{[0-9a-fA-F]+\}|u[0-9a-fA-F]{4}|x[0-9a-fA-F]{2}|[\s\S])/g, (m, g) => {
    if (g[0] === 'u' || g[0] === 'x') {
      const hex = (g[0] === 'u' && g[1] === '{') ? g.slice(2, -1) : g.slice(1);
      const c = parseInt(hex, 16);
      return Number.isFinite(c) ? String.fromCodePoint(c) : m;
    }
    return Object.prototype.hasOwnProperty.call(ONTSNAPT, g) ? ONTSNAPT[g] : g;
  });
}
function tekstVan(n) {
  if (!n) return null;
  if (n.type === 'Literal' && n.kind === 'string') return ontsnap(n.raw);
  if (n.type === 'TemplateLiteral' && n.quasis && n.quasis.length === 1) {
    const q = n.quasis[0];
    if (q.cooked != null) return q.cooked;
    return (q.value && (q.value.cooked != null ? q.value.cooked : q.value.raw)) || '';
  }
  return null;
}

function scanJs(bron, herkomst, vangst) {
  let boom;
  try { boom = parse(bron); } catch (e) { vangst.parsefouten.push(herkomst); return; }

  loop(boom, (node) => {
    /* a. een eigenschap met een labelsleutel: { fout: 'Vul een kenteken in.' } */
    if (node.type === 'Property' && node.key && !node.computed) {
      const sleutel = node.key.name || node.key.value;
      if (LABELSLEUTELS.has(String(sleutel)) && isTekstLiteraal(node.value)) {
        vangst.voeg(tekstVan(node.value), 'eigenschap:' + sleutel, herkomst, node.lijn);
      }
    }

    /* b. toewijzing aan textContent / innerHTML */
    if (node.type === 'AssignmentExpression' && node.left && node.left.type === 'MemberExpression') {
      const doel = naamVan(node.left);
      if ((doel === 'textContent' || doel === 'innerHTML' || doel === 'innerText' ||
           doel === 'value' || doel === 'placeholder' || doel === 'title') && isTekstLiteraal(node.right)) {
        vangst.voeg(tekstVan(node.right), 'toewijzing:' + doel, herkomst, node.lijn);
      }
    }

    /* OOK NewExpression. Hier stond alleen CallExpression, en daardoor was de
       hele Intl-tak hieronder DODE CODE: `new Intl.NumberFormat('nl-NL')` is
       een NewExpression. Er stonden er 25 in de boom die de basislijn van 246
       niet bevatte, en het register verried het zelf -- vasteLocale.perVorm had
       nul Intl-ingangen. Extra zuur: `new Intl.DateTimeFormat(taalVanGebruiker)`
       is precies het alternatief dat regel 68 aanbeveelt, dus dit gat ging open
       zodra iemand de regel gehoorzaamde. */
    if (node.type !== 'CallExpression' && node.type !== 'NewExpression') return;
    const naam = naamVan(node.callee);
    const args = node.arguments || [];

    /* c. een melder: alert('...'), meld('...'), sendSms(nr, '...') */
    if (MELDERS.has(naam)) {
      for (const a of args) if (isTekstLiteraal(a)) {
        const t = tekstVan(a);
        if (menselijk(t)) vangst.voeg(t, 'melder:' + naam, herkomst, node.lijn);
      }
    }

    /* d. setAttribute('aria-label', '...') */
    if (naam === 'setAttribute' && args.length >= 2 && isTekstLiteraal(args[0]) && isTekstLiteraal(args[1])) {
      const attr = tekstVan(args[0]);
      if (ATTRIBUTEN.includes(attr)) vangst.voeg(tekstVan(args[1]), 'setAttribute:' + attr, herkomst, node.lijn);
    }

    /* e. T(): VIER onverenigbare handtekeningen onder een naam.
       T(sleutel, nl) is de bedoelde; public/shared/gebaar.js heeft T(sleutel,
       nl, en) en public/shared/palet.js heeft de argumenten OMGEKEERD:
       T(nl, en). Een regel "arg0 is de sleutel, arg1 de brontekst" pakt daar
       het Engels als bron en archiveert het Nederlands als sleutel. We nemen
       daarom ELK tekstargument dat menselijk is, en melden de dubbelzinnigheid
       apart in plaats van te kiezen. */
    if (naam === 'T') {
      const menselijkeArgs = args.filter(a => isTekstLiteraal(a) && menselijk(tekstVan(a)));
      for (const a of menselijkeArgs) vangst.voeg(tekstVan(a), 'T()', herkomst, node.lijn);
      if (menselijkeArgs.length > 1) vangst.tDubbelzinnig++;
    }

    /* f. de tekst ZONDER string: een vaste locale. Hier valt niets te
       extraheren en toch leest een Japanse gebruiker een Nederlandse datum. */
    /* BCP-47 IS NIET HOOFDLETTERGEVOELIG. Hier stond /^nl(-[A-Z]{2})?$/, en
       daarmee was ratel 1 met een tikje op de shift-toets te omzeilen:
       toLocaleDateString('nl-nl') geeft gewoon Nederlands en telde niet mee.
       Nu op de eerste subtag, hoofdletterongevoelig -- dat vangt ook
       'nl-NL-u-ca-gregory'. */
    if (LOCALEFUNCTIES.has(naam) && args.length && isTekstLiteraal(args[0])) {
      if (VASTNL.test(tekstVan(args[0]))) {
        vangst.vasteLocale.push({ herkomst, lijn: node.lijn, vorm: naam, locale: tekstVan(args[0]) });
      }
    }
    if (INTLVORMEN.has(naam) && args.length && isTekstLiteraal(args[0])) {
      if (VASTNL.test(tekstVan(args[0]))) {
        vangst.vasteLocale.push({ herkomst, lijn: node.lijn, vorm: 'Intl.' + naam, locale: tekstVan(args[0]) });
      }
    }
  });
}

/* ---------- 5. de HTML-scanner ---------------------------------------- */

function scanHtml(bron, herkomst, vangst) {
  /* de inline scripts APART, want die zijn voor de tekstmeting onzichtbaar
     (hij strippt <script>) en voor de .js-meting ook (ze staan niet in .js) */
  /* EEN SLUITTAG SLUIT OOK MET ROMMEL ERIN: de HTML-parser behandelt
     </script >, </script\n> en zelfs </script bar> allemaal als eindtag. Wie
     alleen op de kale vorm zoekt, sluit het blok daar niet en slokt de rest van
     het document op als script. Dus `<\/script\b[^>]*>` -- en de openingstag
     quote-bewust, want een attribuut mag een > dragen. CodeQL vond dit als
     "bad HTML filtering regexp"; als beveiligingsvondst is het hier loos (een
     meter over onze eigen bestanden, geen sanitizer), als meetfout is het echt. */
  const scripts = [];
  const zonderScript = bron.replace(/<script\b((?:[^>"']|"[^"]*"|'[^']*')*)>([\s\S]*?)<\/script\b[^>]*>/gi, (m, attrs, body) => {
    if (!/\bsrc\s*=/i.test(attrs) && body.trim()) scripts.push(body);
    return ' ';
  });
  for (let i = 0; i < scripts.length; i++) scanJs(scripts[i], herkomst + ' <script#' + (i + 1) + '>', vangst);

  /* <template> EN <svg> WORDEN NIET MEER WEGGESTREKEN. Ze stonden in dezelfde
     striplijst als <style> en <code>, en dat is een categoriefout: een
     <template> is juist de standaardplek waar een scherm zijn herbruikbare
     UI-brokken bewaart, en <svg><text> is gewoon zichtbare tekst. De aanval
     zette een hele kaart met kop, alinea en knop in een <template>, cloneerde
     hem in het DOM, en geen enkel getal bewoog. */
  const schoon = zonderScript.replace(/<(style|noscript|code|pre)\b[\s\S]*?<\/\1\b[^>]*>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ');

  /* ZICHTBARE TEKSTKNOPEN, MET HET VOORAFGAANDE TAG ERBIJ.
     Zonder dat tag is niet te zien of de tekst al een sleutel draagt. Splitsen
     MET vangst houdt de tags in de reeks, zodat een tekstbrok weet waar hij
     onder hangt. Een element met data-i18n draagt zijn vertaling al; die tekst
     is de Nederlandse bron bij een sleutel en geen los hardcoded label. */
  const stukken = schoon.split(/(<[^>]+>)/);
  let sleutelDiep = 0;
  for (const stuk of stukken) {
    if (stuk.startsWith('<')) {
      if (/^<\//.test(stuk)) { if (sleutelDiep > 0) sleutelDiep--; }
      else if (!/\/>$/.test(stuk)) {
        if (/\bdata-i18n(-html)?\s*=/.test(stuk)) sleutelDiep++;
        else if (sleutelDiep > 0) sleutelDiep++;
      }
      continue;
    }
    const s = stuk.replace(/&[a-z#0-9]+;/gi, ' ').trim();
    if (menselijk(s)) vangst.voeg(s, sleutelDiep > 0 ? 'html-gesleuteld' : 'html-tekst', herkomst, 0);
  }

  /* ATTRIBUTEN IN ALLE DRIE DE SCHRIJFWIJZEN. Dit las alleen dubbele
     aanhalingstekens, dus placeholder='Vul uw achternaam in' was onzichtbaar --
     inclusief de aria-label die een schermlezer voorleest. En het maakte het
     normaliseren van quotes tot een wijziging die de poort liet zakken zonder
     dat er een letter tekst bijkwam. */
  for (const attr of ATTRIBUTEN) {
    const re = new RegExp(attr + '\\s*=\\s*(?:"([^"]{2,3000})"|\'([^\']{2,3000})\'|([^\\s>]{2,120}))', 'gi');
    let m;
    while ((m = re.exec(schoon))) {
      const waarde = m[1] != null ? m[1] : (m[2] != null ? m[2] : m[3]);
      if (menselijk(waarde)) vangst.voeg(waarde.trim(), 'html-attribuut:' + attr, herkomst, 0);
    }
  }
  /* de titel van het scherm en de omschrijving */
  const t = schoon.match(/<title>([^<]{2,300})<\/title>/i);
  if (t && menselijk(t[1])) vangst.voeg(t[1].trim(), 'html-titel', herkomst, 0);
  const d = schoon.match(/name\s*=\s*"description"\s+content\s*=\s*"([^"]{2,300})"/i);
  if (d && menselijk(d[1])) vangst.voeg(d[1].trim(), 'html-meta', herkomst, 0);
}

/* ---------- 6. de vangst ---------------------------------------------- */

/* De herkomst van een inline script is "scherm.html <script#2>". Voor de
   grendel telt het BESTAND, niet het blok: anders verschuift de basislijn
   zodra iemand twee blokken samenvoegt zonder een letter tekst te wijzigen. */
function bestandVan(herkomst) { return String(herkomst).replace(/ <script#\d+>$/, ''); }

/* ER MOET EEN GROEN PAD ZIJN, ANDERS LEERT DE POORT ONTWIJKEN.

   Dit was de zwaarste bevinding van de aanval op regel 68, en hij was juist:
   `T('bord.deel','Bord delen')` telde als hardcoded tekst, en
   `<span data-i18n="k">Bord delen</span>` ook. Wie precies deed wat de
   foutmelding voorschrijft -- "gebruik de sleutelweg" -- liet de keuring
   opnieuw zakken. Voor de gesleutelde bestanden bestond dus GEEN enkele manier
   om zichtbare tekst toe te voegen die de poort haalt, behalve een ontwijking.
   Een poort waar je alleen omheen kunt, leert mensen eromheen gaan.

   Tekst die AL op de sleutelweg staat telt daarom niet mee in de harde ratel.
   Zij blijft wel in het corpus staan -- de catalogus moet haar straks vertalen
   -- maar zij is geen defect. */
const GESLEUTELDE_VORMEN = new Set(['T()', 'html-gesleuteld']);

function nieuweVangst() {
  const teksten = new Map();         // tekst -> { aantal, vormen:Set, plekken:[] }
  const perBestand = new Map();      // bestand -> voorkomens ZONDER sleutel (de harde teller)
  const perBestandSleutel = new Map(); // bestand -> voorkomens MET sleutel
  return {
    teksten,
    perBestand,
    perBestandSleutel,
    parsefouten: [],
    vasteLocale: [],
    tDubbelzinnig: 0,
    voeg(tekst, vorm, herkomst, lijn) {
      if (!menselijk(tekst)) return;
      const s = String(tekst).trim();
      let r = teksten.get(s);
      if (!r) { r = { aantal: 0, vormen: new Set(), plekken: [] }; teksten.set(s, r); }
      r.aantal++;
      r.vormen.add(vorm);
      if (r.plekken.length < 3) r.plekken.push(herkomst + (lijn ? ':' + lijn : ''));
      const b = bestandVan(herkomst);
      const doel = GESLEUTELDE_VORMEN.has(vorm) ? perBestandSleutel : perBestand;
      doel.set(b, (doel.get(b) || 0) + 1);
    }
  };
}

/* ---------- 7. hoofdprogramma ----------------------------------------- */

/* MEET SCHRIJFT NIET. Dat is geen netheid maar de kern van de ratel: als de
   meting haar eigen basislijn zou bijwerken, is elke stijging meteen de nieuwe
   norm en houdt de grendel nooit iets tegen. Regel 68 van de keuring roept
   `meet()` aan en vergelijkt met het INGECHECKTE register; alleen
   `npm run tekstoppervlak` schrijft, en dat is een bewuste handeling. */
function meet() {
  const { bundels, isDeel } = bundelDelen();
  const overslaan = [
    path.join(WORTEL, 'server', 'translate', 'woordenboek'), // doelkant: EN en ES
    path.join(WORTEL, 'server', 'talen.js'),                 // endoniemen: nooit vertalen
    path.join(WORTEL, 'public', 'shared', 'i18n'),           // de vertaallaag zelf
  ];
  const negeer = p => overslaan.some(o => p === o || p.startsWith(o + path.sep));

  const oppervlakken = {
    html: nieuweVangst(),
    client: nieuweVangst(),
    server: nieuweVangst()
  };

  /* HTML (inclusief de inline scripts) */
  const htmls = loopMap(path.join(WORTEL, 'public'), p => p.endsWith('.html'));
  for (const f of htmls) scanHtml(lees(f), path.relative(WORTEL, f), oppervlakken.html);

  /* client-JS: de bundel OF het losse bestand, nooit allebei */
  const clientJs = loopMap(path.join(WORTEL, 'public'), p => p.endsWith('.js'))
    .filter(p => !isDeel(p) && !negeer(p));
  for (const f of clientJs) scanJs(lees(f), path.relative(WORTEL, f), oppervlakken.client);

  /* server-JS */
  const serverJs = loopMap(path.join(WORTEL, 'server'), p => p.endsWith('.js')).filter(p => !negeer(p));
  for (const f of serverJs) scanJs(lees(f), path.relative(WORTEL, f), oppervlakken.server);

  /* samenvoegen tot een huisbreed beeld, met de overlap ZICHTBAAR */
  const alle = new Map();
  for (const [naam, v] of Object.entries(oppervlakken)) {
    for (const [tekst, r] of v.teksten) {
      let a = alle.get(tekst);
      if (!a) { a = { aantal: 0, oppervlakken: new Set(), vormen: new Set(), plekken: [] }; alle.set(tekst, a); }
      a.aantal += r.aantal;
      a.oppervlakken.add(naam);
      for (const vo of r.vormen) a.vormen.add(vo);
      for (const p of r.plekken) if (a.plekken.length < 3) a.plekken.push(p);
    }
  }

  /* Prototypeloos: een vorm heet hier letterlijk `toLocaleString`, en met een
     gewoon object erft die sleutel Object.prototype.toLocaleString -- dan telt
     de meter een FUNCTIE op bij 1 en staat er onzin in het register. */
  const vormTel = Object.create(null);
  for (const a of alle.values()) for (const vo of a.vormen) vormTel[vo] = (vormTel[vo] || 0) + 1;

  const locales = [].concat(...Object.values(oppervlakken).map(v => v.vasteLocale));
  const locVorm = Object.create(null);
  for (const l of locales) locVorm[l.vorm] = (locVorm[l.vorm] || 0) + 1;

  const perOppervlak = {};
  for (const [naam, v] of Object.entries(oppervlakken)) {
    perOppervlak[naam] = {
      unieke: v.teksten.size,
      voorkomens: [...v.teksten.values()].reduce((n, r) => n + r.aantal, 0),
      parsefouten: v.parsefouten.length
    };
  }

  const gedeeld = [...alle.values()].filter(a => a.oppervlakken.size > 1).length;
  const woorden = [...alle.keys()].reduce((n, s) => n + s.split(/\s+/).length, 0);

  /* ---------- de grendel: waar mag hij VANDAAG al bijten? -------------
     Een poort die blokkeert zonder alternatief wordt uitgezet, en dan is hij
     geen poort meer. CONTROLPLANE.md par. 5.3: je kunt niet afdwingen wat nooit
     in de schaduw heeft gelopen. Dus twee standen naast elkaar:

     HARD, want er is vandaag een alternatief:
     - de vaste nl-locale. `new Intl.DateTimeFormat(taalVanGebruiker)` kan nu,
       zonder catalogus en zonder runtime. Niets houdt dit tegen behalve de
       gewoonte.
     - nieuwe hardcoded tekst in een bestand dat de sleutelweg AL gebruikt
       (T() of data-i18n). Daar staat het alternatief in datzelfde bestand, dus
       terugvallen op een kale string is een regressie. Zo wordt migratie
       eenrichtingsverkeer: wat om is, kan niet terugglijden.

     SCHADUW, want het alternatief bestaat nog niet:
     - het huisbrede totaal. Er is geen berichtencatalogus en geen t(sleutel)-
       runtime, dus elk nieuw scherm MOET vandaag hardcoden. Dat blokkeren zou
       alle bouw stilleggen. Het getal wordt gemeld met zijn verschil, en het
       hoort te gaan bijten zodra de runtime er is. */
  const gesleuteld = {};
  for (const f of htmls.concat(clientJs)) {
    const rel = path.relative(WORTEL, f);
    const bron = lees(f);
    if (!/\bT\(|data-i18n[=\s]/.test(bron)) continue;
    /* perBestand telt sinds de groene-padreparatie alleen nog tekst ZONDER
       sleutel. Een bestand dat volledig om is, staat hier dus op 0 -- en dat is
       precies de bedoeling: dan mag er niets bij dat niet gesleuteld is. */
    const n = (oppervlakken.html.perBestand.get(rel) || 0) + (oppervlakken.client.perBestand.get(rel) || 0);
    gesleuteld[rel] = n;
  }

  /* RATEL 1 PER BESTAND EN NIET HUISBREED. Huisbreed betekent dat ruimte die je
     in het ene bestand wint, in het andere mag worden uitgegeven aan een echt
     defect: het totaal blijft 246 en er is toch een Nederlandse datum bijgekomen.
     Per bestand kan dat niet. */
  const localePerBestand = {};
  for (const v of Object.values(oppervlakken)) {
    for (const l of v.vasteLocale) {
      const b = bestandVan(l.herkomst);
      localePerBestand[b] = (localePerBestand[b] || 0) + 1;
    }
  }
  const parsefouten = [].concat(...Object.values(oppervlakken).map(v => v.parsefouten));

  const uit = {
    gemetenOp: new Date().toISOString().slice(0, 10),
    bestanden: { html: htmls.length, clientJs: clientJs.length, serverJs: serverJs.length,
      bundelsGeteldDelenOvergeslagen: bundels.size },
    totaal: { uniekeTeksten: alle.size, woorden, opMeerDanEenOppervlak: gedeeld },
    perOppervlak,
    perVorm: Object.fromEntries(Object.entries(vormTel).sort((a, b) => b[1] - a[1])),
    vasteLocale: { aanroepen: locales.length, perVorm: locVorm,
      uitleg: 'Gebruikerszichtbare taal ZONDER string om te vertalen: een vaste nl-locale in ' +
        'toLocale*/Intl. Een scherm kan 100% gesleuteld zijn en hier alsnog Nederlands tonen. ' +
        'Aparte defectklasse: telt NIET mee in uniekeTeksten.' },
    tDubbelzinnig: oppervlakken.client.tDubbelzinnig,
    grendel: {
      uitleg: 'Basislijn voor keuringsregel 68. `hard` mag alleen omlaag en laat de keuring ' +
        'zakken zodra hij stijgt; `schaduw` wordt alleen gemeld. Wie een getal met opzet ' +
        'verhoogt, schrijft de reden erbij -- een ratel die je losdraait is geen ratel.',
      hardVasteLocale: locales.length,
      hardVasteLocalePerBestand: localePerBestand,
      hardGesleuteldeBestanden: gesleuteld,
      parsefouten: parsefouten.length,
      schaduwHuisbreed: alle.size,
      waaromSchaduw: 'Er is nog geen berichtencatalogus en geen t(sleutel)-runtime, dus een ' +
        'nieuw scherm MOET vandaag hardcoden. Dit getal blokkeren zou alle bouw stilleggen. ' +
        'Het gaat bijten zodra de runtime er is.'
    },
    /* WAT DEZE METER NIET ZIET, MET DE GEMETEN OMVANG ERBIJ.

       Deze lijst is na een gerichte aanval op de meter en op keuringsregel 68
       herschreven. Alles wat hier staat is BEWEZEN ontsnapt, niet vermoed --
       een gat dat er staat is iets anders dan een gat dat stil ontbreekt, en
       alleen het eerste kun je inplannen. */
    nietGedekt: [
      'DE VORMZEEF, en dit is het grootste gat. De scanner ziet alleen een KALE ' +
        'stringliteraal op een bekende plek. Ontsnapt bewezen: een template-literal met een ' +
        'expressie erin (`Welkom terug ${naam}`), string-optelling, een array met .join(), tekst ' +
        'via een variabele, en de sinks createTextNode, insertAdjacentHTML en replaceChildren. ' +
        'Dat is het meest gebruikte idioom voor UI-tekst in dit huis, dus het huisbrede getal is ' +
        'een ONDERGRENS van onbekende ruimte. De reparatie (elke literal in de deelboom van een ' +
        'sink tellen) is middelgroot en verschuift de basislijn fors; hij hoort vooraf te gaan aan ' +
        'het moment dat het huisbrede getal hard wordt gemaakt.',
      'VIER BEDIENDE OPPERVLAKKEN worden niet gelezen, met hun gemeten omvang: de root ' +
        'index.html (92 teksten, 69 nergens anders -- en die pagina WORDT bediend), de 31 ' +
        'webmanifesten (91 teksten, 57 nergens anders -- waaronder de naam van de app op het ' +
        'beginscherm van een lid), de content-eigenschap in CSS (20 teksten, 18 nergens anders), ' +
        'en .json/.txt-bestanden die naar de client gaan. De bestandslijst hangt aan een MAP; zij ' +
        'hoort aan de bediende bron te hangen.',
      'HTML DIE DE SERVER MET + AAN ELKAAR PLAKT (ongeveer 84, graad vermoed): kantoorsjablonen ' +
        'en de blokrenderer bouwen HTML met optelling, en dat hangt onder geen labelsleutel en ' +
        'geen sink.',
      'DE LOCALE UIT EEN CONSTANTE: `const NL = \'nl-NL\'; d.toLocaleString(NL)` is onzichtbaar. ' +
        'Dat volgen vraagt dataflow-analyse en maakt van deze meter een halve interpreter; de ' +
        'ontwijking vraagt bovendien opzet. Bewust niet gebouwd.',
      'KORTE HOOFDLETTERCODES worden verworpen (66 uniek). Van de 141 verworpen voorkomens zijn ' +
        'er 89 merk- en vakafkorting (RTG, PDA, HACCP, BRIN) en 52 een gewoon woord (OK, JA, ' +
        'LEEG, KASSA). Versoepelen haalt vooral sleutelnamen binnen; de winst is 52 woorden.',
      'RATEL 2 TELT VOORKOMENS EN GEEN TEKSTEN, dus een zin sleutelen koopt ruimte voor een ' +
        'nieuwe zin in hetzelfde bestand. Dat vraagt opzet, en het kost precies een vertaling.',
      'BUNDELDELEN bewegen geen getal tot `npm run build` draait; daarna slaat het toe bij wie ' +
        'dat toevallig draait, met een verwijzing naar bouwuitvoer.',
      'TEKSTKNOPEN WORDEN GESPLITST OP ELKE TAG, dus "Onze <b>reis</b> gaat door" wordt twee ' +
        'brokken. Voor tellen is dat ruis; voor een latere catalogus zijn het geen vertaaleenheden.',
      'Tekst die pas bij het draaien ontstaat, en BEVROREN tekst: labels die ooit uit een register ' +
        'naar de database zijn gekopieerd. Wijzigen aan de bron bereikt een bestaande installatie ' +
        'dan niet.',
      'De KWALITEIT van welke vertaling dan ook. Deze meter telt plekken; hij beoordeelt geen taal.',
      'De grens tussen INHOUD en INTERFACE. Lesmateriaal en een productnaam zijn inhoud; een ' +
        'statusnaam en een knop zijn interface. Deze meter telt beide en kiest niet. In het ' +
        'getelde zit daardoor ruis: poortdocumentatie uit server/kern/handlerpoorten/, ' +
        'HTML-fragmenten inclusief class=, en zaai- en lesmateriaal.',
      'Afgeleide registers (handelingindex.json, sprongindex.json) tellen niet mee: ze zijn ' +
        'gegenereerd uit de schermen en zouden dubbeltelling zijn.'
    ]
  };

  return uit;
}

function main() {
  const uit = meet();
  const perOppervlak = uit.perOppervlak;
  fs.writeFileSync(UIT, JSON.stringify(uit, null, 2) + '\n');

  const n = x => String(x).padStart(7);
  console.log('\nHET TEKSTOPPERVLAK VAN RTG\n');
  console.log('  bestanden      html ' + n(uit.bestanden.html) + '   client-js ' + n(uit.bestanden.clientJs) +
    '   server-js ' + n(uit.bestanden.serverJs));
  console.log('  bundels ' + uit.bestanden.bundelsGeteldDelenOvergeslagen +
    ' geteld, hun delen overgeslagen (nooit allebei)\n');
  for (const [naam, v] of Object.entries(perOppervlak)) {
    console.log('  ' + naam.padEnd(10) + n(v.unieke) + ' uniek' + n(v.voorkomens) + ' voorkomens' +
      (v.parsefouten ? '   parsefouten: ' + v.parsefouten : ''));
  }
  console.log('  ' + '-'.repeat(52));
  console.log('  ' + 'HUISBREED'.padEnd(10) + n(uit.totaal.uniekeTeksten) + ' uniek, ' + uit.totaal.woorden +
    ' woorden, ' + uit.totaal.opMeerDanEenOppervlak + ' op meer dan een oppervlak');
  console.log('\n  APARTE DEFECTKLASSE -- taal zonder string:');
  console.log('    ' + uit.vasteLocale.aanroepen + ' aanroepen met een vaste nl-locale (' +
    Object.entries(uit.vasteLocale.perVorm).map(([k, v]) => k + ' ' + v).join(', ') + ')');
  if (uit.tDubbelzinnig) console.log('    ' + uit.tDubbelzinnig + ' T()-aanroepen met meer dan een menselijk argument (onverenigbare handtekeningen)');
  console.log('\n  geschreven: TEKSTOPPERVLAK.json');
  console.log('  wat deze meter NIET dekt staat in `nietGedekt` -- dat veld hoort te krimpen, leeg wordt het nooit.\n');
}

if (require.main === module) main();
module.exports = { meet, menselijk, scanJs, scanHtml, nieuweVangst };
