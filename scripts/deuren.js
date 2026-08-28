#!/usr/bin/env node
/* ============================================================================
   DE DEUREN NAAR db.data -- hoeveel bestanden gaan er langs de datalaag heen?

   WAAROM DIT ER IS. De contractlaag is niet "types toevoegen"; het is de enige
   weg naar een andere opslag. Een Data Fabric vraagt EEN doorgang waar lezen en
   schrijven doorheen gaan, en die is er niet: 706 bestanden buiten server/db/
   raken `db.data` rechtstreeks aan, over 452 collectienamen. Je kunt daar niets
   onder schuiven. Je kunt de deuren alleen een voor een vervangen door een
   gecontracteerde doorgang.

   Zo'n afbouw is precies het soort werk dat verdampt. Hij duurt lang, hij is
   nooit af, en niemand merkt wanneer er stilletjes een deur bijkomt. Daarom is
   dit een meter aan de ratel van scripts/norm.js en geen rapport: hij mag alleen
   omlaag. Een nieuwe rechtstreekse schrijver laat CI zakken -- niet omdat die
   code fout is, maar omdat de afbouw dan geen afbouw meer is.

   TWEE METERS EN NIET EEN. Lezen en schrijven zijn hier verschillende dingen.
   Een schrijver bepaalt of de invarianten van een domein kloppen; een lezer
   bepaalt of je de opslag kunt vervangen. Ze samen optellen zou betekenen dat
   een opgeruimde lezer een nieuwe schrijver kan maskeren -- precies de
   verrekening waarvoor keuringOmvang en keuringTeGroot al eens zijn gesplitst.

   WAT ER NIET IN ZIT, EN WAAROM.
   - server/db/ zelf. Dat IS de datalaag; daar db.data aanraken is zijn werk en
     geen bypass. Dat is de enige uitzondering, en hij staat hieronder met naam
     in plaats van als patroon -- een lijst die groeit is een lijst die liegt.
   - public/ en test/. De browser praat niet met db.data, en een toets die de
     staat opzet is geen productiepad.

   HIJ LEEST CODE EN GEEN PROZA. Dit stond eerst als een patroon over de rauwe
   tekst, en dat telde een bestand mee dat `db.data` alleen in zijn KOP noemt --
   twee contracten die net waren opgeknipt dragen de uitleg in hun
   register-helft en raken de opslag niet aan. Dezelfde fout die keuringsregel
   47 een keer maakte (TAKEN.md 6.17) en die regel 53 met de lexer oploste. De
   meter en de poort horen hetzelfde te meten, dus doet hij het nu ook.

   WAT DEZE METER NIET WEET. Hij leest de ontleding, geen gedrag. Een bestand dat
   `db.data` via een doorgegeven verwijzing aanraakt (`const d = db.data;` in de
   ene module, gebruikt in de andere) telt hier niet mee. Dat is een bewuste
   onderschatting van dezelfde soort als keuringsregel 50: een vals alarm in een
   harde poort kost meer dan een gemist geval. De weg erheen is dat de doorgang
   er straks IS, en dan is niet-tellen ook niet meer nodig.

   Draai:  node scripts/deuren.js
           node scripts/deuren.js --json
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const { lex } = require('./ast/lexer');

const WORTEL = path.join(__dirname, '..');

/* De enige map die db.data mag aanraken zonder dat het een bypass heet. */
const DATALAAG = 'server/db/';

/* Wat telt als SCHRIJVEN. Een toewijzing, een mutatiemethode op een array, een
   delete of een Object.assign met db.data als doel. Alles wat db.data noemt en
   hier niet onder valt, geldt als lezen. */
const SCHRIJF = [
  /db\.data(?:\.[A-Za-z_$][\w$]*|\[[^\]]+\])+\s*(?:=[^=]|\+=|-=)/,
  /db\.data(?:\.[A-Za-z_$][\w$]*|\[[^\]]+\])+\s*\.\s*(?:push|pop|shift|unshift|splice|sort|reverse|fill)\s*\(/,
  /delete\s+db\.data/,
  /Object\.assign\s*\(\s*db\.data/
];

function jsBestanden(dir, wortel, uit) {
  let namen;
  try { namen = fs.readdirSync(dir); } catch (e) { return uit; }
  for (const n of namen.sort()) {
    const p = path.join(dir, n);
    let st;
    try { st = fs.statSync(p); } catch (e) { continue; }
    if (st.isDirectory()) jsBestanden(p, wortel, uit);
    else if (n.endsWith('.js')) uit.push(path.relative(wortel, p).replace(/\\/g, '/'));
  }
  return uit;
}

/* De meting. `wortel` is instelbaar zodat de ijking in test/meterijk.test.js
   hem op een eigen boom kan richten in plaats van op de echte code. */
function meet(opties) {
  const wortel = (opties && opties.wortel) || WORTEL;
  const raken = [];
  const schrijven = [];
  const collecties = new Set();
  let aanrakingen = 0;

  for (const rel of jsBestanden(path.join(wortel, 'server'), wortel, [])) {
    if (rel.startsWith(DATALAAG)) continue;
    let bron;
    try { bron = fs.readFileSync(path.join(wortel, rel), 'utf8'); } catch (e) { continue; }
    if (!bron.includes('db.data')) continue;

    /* De tokenreeks  db . data  -- een naam, een punt, een naam. Een string of
       een commentaar met diezelfde tekst is geen aanraking. */
    let toks;
    try { toks = lex(bron); } catch (e) { continue; }
    let echt = 0;
    for (let i = 0; i + 2 < toks.length; i++) {
      if (toks[i].type === 'naam' && toks[i].value === 'db' &&
          toks[i + 1].value === '.' &&
          toks[i + 2].type === 'naam' && toks[i + 2].value === 'data') echt++;
    }
    if (!echt) continue;

    raken.push(rel);
    aanrakingen += echt;
    /* Voor de collectienamen en de schrijfvormen volstaat de tekst: die worden
       alleen geteld in bestanden die de poort hierboven al zijn gepasseerd. */
    for (const m of bron.matchAll(/db\.data\.([A-Za-z_$][\w$]*)/g)) collecties.add(m[1]);
    if (SCHRIJF.some(r => r.test(bron))) schrijven.push(rel);
  }

  /* Per bovenliggende map, zodat zichtbaar is WELK domein het meest achter een
     contract te winnen heeft. Dat is de enige vraag die dit getal moet
     beantwoorden zolang de afbouw loopt. */
  const perMap = {};
  for (const rel of schrijven) {
    const map = rel.split('/').slice(0, 3).join('/');
    perMap[map] = (perMap[map] || 0) + 1;
  }

  return {
    deuren: raken.length,
    schrijvendeDeuren: schrijven.length,
    aanrakingen,
    collecties: collecties.size,
    perMap,
    lijst: raken,
    schrijvers: schrijven
  };
}

module.exports = { meet, DATALAAG, SCHRIJF };

if (require.main === module) {
  const uit = meet();
  if (process.argv.includes('--json')) {
    console.log(JSON.stringify({
      deuren: uit.deuren, schrijvendeDeuren: uit.schrijvendeDeuren,
      aanrakingen: uit.aanrakingen, collecties: uit.collecties, perMap: uit.perMap
    }, null, 2));
  } else {
    console.log('Deuren naar db.data buiten ' + DATALAAG);
    console.log('  bestanden die db.data aanraken : ' + uit.deuren);
    console.log('  daarvan SCHRIJVEND             : ' + uit.schrijvendeDeuren);
    console.log('  aanrakingen totaal             : ' + uit.aanrakingen);
    console.log('  verschillende collecties       : ' + uit.collecties);
    console.log('\nWaar de schrijvers wonen (top 12) -- hier is een contract het meest waard:');
    Object.entries(uit.perMap).sort((a, b) => b[1] - a[1]).slice(0, 12)
      .forEach(([m, n]) => console.log('  ' + String(n).padStart(4) + '  ' + m));
  }
}
