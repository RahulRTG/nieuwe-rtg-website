/* WAT IS ER AFLEIDBAAR UIT EEN CODENAAM?

   WAAROM DIT BESTAAT. `MAGNAATLAB.md` par. 4.6 noemt punt 22 het meest
   onderscheidende van de vijftig: kunnen twee capabilities die allebei mogen wat
   ze doen, samen iets opleveren dat geen van beide mag? Dat is hier geen
   theoretisch risico. `CLAUDE.md` schrijft het geval zelf uit: een BIG-nummer
   naast een codenaam voert die codenaam terug naar een ECHTE naam, want een
   BIG-registratie staat in een openbaar register. Dat geval is met de hand
   gevonden en met de hand opgelost -- en er was geen meter die het volgende vindt.

   DE HELE PRIVACYOPZET VAN DIT HUIS hangt aan één zin: operationele data draait
   op codenamen, echte namen wonen in de gescheiden identiteitskluis. Die zin is
   waar zolang een codenaam nergens naast iets komt te staan dat naar buiten
   koppelbaar is. Eén veld is genoeg: wie een IBAN, een kenteken of een
   BIG-nummer heeft, heeft een sleutel naar een register buiten dit huis.

   HOE DIT MEET. Niet met een lijst van capabilities -- die bestaat niet, en
   `OS.md` heeft net gemeten dat het woord hier twintig dingen betekent. Wél met
   wat er werkelijk in de code staat: elk objectliteraal in `server/` is een stel
   velden dat SAMEN REIST. Twee velden in hetzelfde object zijn aan elkaar
   gekoppeld; over alle objecten heen levert dat een graaf. De vraag van punt 22
   is dan een pad:

     lengte 1   de codenaam staat RECHTSTREEKS naast een harde identificator
     lengte 2   twee objecten delen een sleutel; wie ze allebei ziet, koppelt
     lengte 3+  het kan nog steeds, maar het vraagt drie stappen

   Lengte 2 is precies de vraag die punt 22 stelt: geen van beide plekken laat
   iets ontoelaatbaars zien, samen wel.

   WAT DEZE METER NIET ZEGT, en dit hoort er even groot bij:

   - Hij meet STRUCTUUR, geen bevoegdheid. Dat een codenaam ergens naast een IBAN
     staat, betekent niet dat iemand anders dan de eigenaar het ziet. De grootste
     valse treffer is een lid dat naar zijn EIGEN gegevens kijkt, en die kan geen
     enkel statisch script van een echte koppeling onderscheiden.
   - Een pad is een KANDIDAAT en geen bevinding. De meting wijst ze aan; wat het
     betekent, beslist een mens die het bestand opent. Dat is dezelfde afspraak
     als bij de vier ontwerpdomeinen in `BEWIJSMACHINE.md` par. 3, en hij is daar
     niet voor niets gemaakt: het handwerk verwierp toen de helft.
   - Hij kent alleen de identificatoren op de lijst hieronder. Een register dat
     hier niet staat, wordt niet gevonden. De lijst is een keuze en een keuze is
     nooit volledig.

   Draaien:  node scripts/afleidbaar.js          (leesbaar)
             node scripts/afleidbaar.js --json */
'use strict';
const fs = require('fs');
const path = require('path');
const { zonderCommentaar } = require('./lib/bron');

const WORTEL = path.join(__dirname, '..');

/* HET PSEUDONIEM. Dit is wat dit huis in plaats van een naam gebruikt. */
const PSEUDONIEM = ['codenaam', 'codename'];

/* DE HARDE IDENTIFICATOREN, elk met de reden waarom hij hard is: er staat een
   register of een dienst BUITEN dit huis waarmee je van dit gegeven naar een
   mens komt. Een gesloten lijst, want een vrij begrip "gevoelig" levert een
   meter op die alles vindt en dus niets zegt. */
const HARD = {
  bsn: 'het burgerservicenummer is de sleutel van de overheid zelf',
  big: 'een BIG-registratie staat in een openbaar register op naam',
  bigNummer: 'idem',
  kvk: 'het handelsregister is openbaar en staat op naam',
  iban: 'een rekeningnummer voert via de bank naar een tenaamstelling',
  email: 'een e-mailadres is meestal de naam zelf, en anders een account',
  telefoon: 'een telefoonnummer is bij de aanbieder op naam geregistreerd',
  phone: 'idem',
  kenteken: 'het kentekenregister koppelt aan een houder',
  paspoort: 'een documentnummer staat op het document, met de naam ernaast',
  rijbewijs: 'idem',
  geboortedatum: 'samen met een postcode is een geboortedatum bijna uniek',
  postcode: 'een postcode met huisnummer wijst een huishouden aan',
  adres: 'een adres wijst een huishouden aan'
};

/* Wat GEEN koppeling is. Deze namen staan in bijna elk object en zouden de graaf
   tot een klont maken waarin alles met alles verbonden is -- en dan is elke
   afstand 2 en zegt de meter niets. Ze zijn eruit gehaald omdat ze structureel
   overal voorkomen, niet omdat ze onbelangrijk zijn. */
const RUIS = new Set(['ok', 'error', 'status', 'at', 'id', 'naam', 'name', 'label',
  'type', 'soort', 'wat', 'uitleg', 'titel', 'tekst', 'waarde', 'aantal', 'centen',
  'bedrag', 'total', 'items', 'lijst', 'data', 'body', 'url', 'link', 'icon']);

const MIN_VELDEN = 2;

/* JAVASCRIPT-WOORDEN DIE GEEN VELDNAAM ZIJN. Zonder deze lijst leest een naïeve
   lezer `x ? null : y` als een veld `null`, en dat gebeurde ook: de eerste versie
   van deze meter vond een pad `codenaam → null → postcode`. */
const GEEN_VELD = new Set(['null', 'true', 'false', 'undefined', 'let', 'const', 'var',
  'case', 'default', 'else', 'return', 'this', 'typeof', 'new', 'function', 'async',
  'await', 'if', 'for', 'while', 'switch', 'try', 'catch', 'do', 'break', 'continue',
  'delete', 'in', 'of', 'instanceof', 'void', 'yield', 'class', 'extends', 'super']);

/* EEN ACCOLADE IS NIET ALTIJD EEN OBJECT. In JavaScript opent `{` net zo goed een
   functielichaam, een if-blok of een klasse -- en die staan vol met dubbele punten
   die geen veld zijn (een ternair, een label, een `case`). De eerste versie hier
   las ze allemaal als object en vond daardoor velden die `let` en `null` heten,
   met een pad naar een BIG-nummer erachteraan. Een meter die een niet-bestaand
   privacylek meldt, is net zo schadelijk als een die een echt lek mist.

   DE REPARATIE ZIT IN `mag`, EN NERGENS ANDERS. Een sleutel wordt alleen gelezen
   op DIEPTE 1 en alleen direct na de `{` of na een `,` op die diepte. Daarmee
   valt de ternair vanzelf weg (`x ? null : 0` staat achter een `:` en niet achter
   een komma), en een blok levert nooit twee velden op, want statements worden
   gescheiden door een puntkomma en niet door een komma.

   HIER STOND OOK EEN HERKENNER VOOR "IS DIT EEN OBJECT" -- wat staat er vóór de
   accolade: een `=`, een `(`, een `,`. Die is er weer uit, om twee redenen die
   allebei uit een mutatie komen. Ten eerste: hem uitzetten liet geen enkele toets
   zakken, dus hij deed aantoonbaar niets bovenop `mag`. Ten tweede, en dat is de
   echte: hij liet ECHTE objecten vallen. `x || { a: 1, b: 2 }` staat achter een
   `||` en dat stond niet op de lijst -- vijfhonderd objecten verdwenen zo uit de
   graaf, en een graaf met gaten meldt te wéinig, wat hier de gevaarlijke kant is.

   Wat blijft is de sleutelwoordenlijst hierboven. Ook die kon geen mutatie laten
   zakken, en dat staat hier eerlijk bij: hij vangt de labelvorm (`lus: for(;;)`)
   die met `mag` alleen theoretisch nog binnen zou kunnen komen. Hij is goedkoop
   en kan niets wegnemen, dus hij blijft -- maar hij is geen bewezen noodzaak. */
function objectenIn(tekst) {
  const uit = [];
  const s = String(tekst);
  for (let i = 0; i < s.length; i++) {
    if (s[i] !== '{') continue;
    const velden = [];
    let diepte = 0;
    let mag = false;                      // staan we op een plek waar een sleutel mag?
    let j = i;
    for (; j < s.length; j++) {
      const c = s[j];
      if (c === '{' || c === '(' || c === '[') { diepte++; if (diepte === 1) mag = true; continue; }
      if (c === '}' || c === ')' || c === ']') { diepte--; if (diepte === 0) break; mag = false; continue; }
      if (diepte !== 1) continue;
      if (c === ',') { mag = true; continue; }
      if (/\s/.test(c)) continue;
      if (!mag) continue;
      const m = /^([A-Za-z_$][\w$]*)\s*:/.exec(s.slice(j));
      if (m && !GEEN_VELD.has(m[1])) { velden.push(m[1]); j += m[1].length; }
      mag = false;
    }
    if (velden.length >= MIN_VELDEN) uit.push(velden);
    /* Niet doorspringen naar j: geneste objecten zijn zelf ook koppelingen. */
  }
  return uit;
}

function bestanden(map, uit) {
  uit = uit || [];
  for (const naam of fs.readdirSync(map)) {
    const p = path.join(map, naam);
    if (fs.statSync(p).isDirectory()) { if (naam !== 'data' && naam !== 'node_modules') bestanden(p, uit); }
    else if (naam.endsWith('.js')) uit.push(p);
  }
  return uit;
}

function lees(wortel) {
  const root = wortel || WORTEL;
  const objecten = [];
  for (const p of bestanden(path.join(root, 'server'))) {
    const rel = path.relative(root, p).replace(/\\/g, '/');
    for (const velden of objectenIn(zonderCommentaar(fs.readFileSync(p, 'utf8')))) {
      const schoon = [...new Set(velden.filter(v => !RUIS.has(v)))];
      if (schoon.length >= MIN_VELDEN) objecten.push({ bestand: rel, velden: schoon });
    }
  }
  return objecten;
}

/* DE ANALYSE. Krijgt objecten en rekent; geen bestanden, geen paden -- zo kan
   een toets hem verzonnen objecten voeren en zien of hij aanslaat. */
function analyse(objecten) {
  const buren = new Map();
  const waar = new Map();          // "a|b" -> bestanden waar die koppeling staat
  const koppel = (a, b, bestand) => {
    if (!buren.has(a)) buren.set(a, new Set());
    buren.get(a).add(b);
    const sleutel = a < b ? a + '|' + b : b + '|' + a;
    if (!waar.has(sleutel)) waar.set(sleutel, new Set());
    waar.get(sleutel).add(bestand);
  };
  for (const o of objecten)
    for (const a of o.velden) for (const b of o.velden) if (a !== b) koppel(a, b, o.bestand);

  /* Kortste pad van een pseudoniem naar elk veld: gewone breedte-eerst. De
     afstand IS de bevinding -- 1 is een lek, 2 is punt 22, 3+ is werk. */
  const afstand = new Map();
  const via = new Map();
  const rij = [];
  for (const p of PSEUDONIEM) if (buren.has(p)) { afstand.set(p, 0); rij.push(p); }
  while (rij.length) {
    const nu = rij.shift();
    for (const b of (buren.get(nu) || [])) {
      if (afstand.has(b)) continue;
      afstand.set(b, afstand.get(nu) + 1);
      via.set(b, nu);
      rij.push(b);
    }
  }
  const padNaar = (veld) => {
    const uit = [veld];
    let nu = veld;
    while (via.has(nu)) { nu = via.get(nu); uit.unshift(nu); }
    return uit;
  };

  /* KNOOPPUNTEN. Een veld als `code` of `rol` staat in honderden objecten en
     verbindt daardoor alles met alles. Een pad DOOR zo'n veld is geen koppeling
     maar een artefact van de graaf: dat `codenaam` en `iban` allebei ooit naast
     een `code` stonden, zegt niets over of het dezelfde code was.

     Dat wordt hier niet weggepoetst en ook niet weggetuned tot het er goed
     uitziet. Elk pad draagt de hoogste graad van zijn TUSSENstappen, en paden
     door een knooppunt staan apart -- als kandidaat van de zwakste soort. */
  const graad = (v) => (buren.get(v) || new Set()).size;
  const KNOOPPUNT = 100;

  const gevonden = [];
  const buitenBereik = [];
  for (const [veld, waarom] of Object.entries(HARD)) {
    if (!afstand.has(veld)) { buitenBereik.push({ veld, waarom }); continue; }
    const pad = padNaar(veld);
    const bestanden_ = [];
    for (let i = 0; i + 1 < pad.length; i++) {
      const s = pad[i] < pad[i + 1] ? pad[i] + '|' + pad[i + 1] : pad[i + 1] + '|' + pad[i];
      bestanden_.push([...(waar.get(s) || [])].slice(0, 3));
    }
    const tussen = pad.slice(1, -1);
    const hoogsteGraad = tussen.length ? Math.max(...tussen.map(graad)) : 0;
    gevonden.push({ veld, waarom, stappen: afstand.get(veld), pad, bestanden: bestanden_,
      tussen, hoogsteGraad, viaKnooppunt: hoogsteGraad >= KNOOPPUNT });
  }
  gevonden.sort((a, b) => a.stappen - b.stappen || a.veld.localeCompare(b.veld));

  return {
    objecten: objecten.length,
    velden: buren.size,
    koppelingen: waar.size,
    knooppuntVanaf: KNOOPPUNT,
    pseudoniemGevonden: PSEUDONIEM.filter(p => buren.has(p)),
    rechtstreeks: gevonden.filter(g => g.stappen === 1),
    tweeStappen: gevonden.filter(g => g.stappen === 2 && !g.viaKnooppunt),
    viaKnooppunt: gevonden.filter(g => g.stappen > 1 && g.viaKnooppunt),
    verder: gevonden.filter(g => g.stappen > 2 && !g.viaKnooppunt),
    buitenBereik,
    gevonden
  };
}

const meet = (wortel) => analyse(lees(wortel));

if (require.main === module) {
  const uit = meet();
  if (process.argv.includes('--json')) console.log(JSON.stringify(uit, null, 2));
  else {
    console.log('AFLEIDBAARHEID VANUIT EEN CODENAAM\n');
    console.log('  ' + uit.objecten + ' objecten, ' + uit.velden + ' velden, ' + uit.koppelingen + ' koppelingen');
    console.log('  pseudoniem gevonden als: ' + (uit.pseudoniemGevonden.join(', ') || 'GEEN -- dan meet dit niets'));
    const toon = (kop, lijst) => {
      if (!lijst.length) return;
      console.log('\n' + kop);
      for (const g of lijst) {
        console.log('  ' + g.veld + '  (' + g.stappen + ' stap' + (g.stappen === 1 ? '' : 'pen') +
          (g.viaKnooppunt ? ', via een knooppunt met graad ' + g.hoogsteGraad : '') + ')  -- ' + g.waarom);
        console.log('      pad: ' + g.pad.join(' → '));
        g.bestanden.forEach((b, i) => console.log('        ' + g.pad[i] + '+' + g.pad[i + 1] + ': ' + b.join(', ')));
      }
    };
    toon('RECHTSTREEKS -- de codenaam staat in hetzelfde object:', uit.rechtstreeks);
    toon('IN TWEE STAPPEN -- dit is de vraag van punt 22:', uit.tweeStappen);
    toon('VERDER WEG:', uit.verder);
    toon('VIA EEN KNOOPPUNT -- vrijwel zeker geen echte koppeling, maar niet weggelaten:',
      uit.viaKnooppunt);
    if (uit.buitenBereik.length)
      console.log('\nNiet bereikbaar vanuit een codenaam: ' + uit.buitenBereik.map(b => b.veld).join(', '));
    console.log('\nEen pad is een KANDIDAAT en geen bevinding: deze meter kent geen bevoegdheden,');
    console.log('en een lid dat naar zijn eigen gegevens kijkt ziet er hier hetzelfde uit.');
  }
}

module.exports = { PSEUDONIEM, HARD, RUIS, MIN_VELDEN, objectenIn, lees, analyse, meet };
