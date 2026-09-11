/* ELK BESTANDSADRES DAT EEN DOCUMENT NOEMT, TEGEN DE BRONBOOM GEHOUDEN.

   WAAROM DIT BESTAAT. Dit huis heeft de regel al -- "een cap die een document
   noemt, wordt tegen de code gehouden" (CLAUDE.md, na de cap `rooms` die
   nergens bestond en waardoor een verblijfszaak jarenlang te veel btw rekende).
   Voor BESTANDSADRESSEN bestond die meter niet, en dat kostte precies hetzelfde:
   vijf documenten -- BESTUUR.md, CLAUDE.md, LAT.md, FABRIC.md en EXECUTIE.md --
   wezen naar `kern/command/risico.js` als de motor die per geval `hand`,
   `assist` of `auto` uitrekent. Dat bestand heeft NOOIT bestaan onder die naam
   op die plek: de motor woont op `kern/frictie/motor.js`, en zijn eigen kop
   zegt met zoveel woorden dat hij uit `kern/command/` is verhuisd omdat die map
   te klein was. Vijf documenten liepen die verhuizing achterna zonder het te
   merken, want een verkeerd adres in proza ziet er identiek uit aan een goed.

   DRIE UITSLAGEN, EN "BESTAAT NIET" IS TE GROF. Een module die is opgeknipt van
   `server/accounts.js` naar `server/accounts/` is er nog gewoon -- alleen zijn
   adres klopt niet. Dat is iets anders dan een pad dat nergens heen wijst, en
   het vraagt een andere reparatie (het adres bijwerken tegenover de bewering
   herzien). Wie ze op een hoop gooit, krijgt een lijst waar niemand naar kijkt.

     KLOPT       het bestand staat er.
     OPGEKNIPT   het bestand is een map geworden; de module bestaat, het adres niet.
     KAPOT       er staat op dat pad niets, ook geen map.

   WAT DEZE METER MET OPZET NIET BEOORDEELT. Een kale bestandsnaam zonder map
   ervoor -- `check.js`, `index.js`, `beleid.js` -- is in lopende tekst een
   VERKORTE VERWIJZING en geen adres. De eerste opzet van deze meter telde ze
   mee en kwam op 3138 "kapotte" verwijzingen; daar zat geen enkel raadsel in,
   alleen een meter die te weinig wist. Dat is de les uit CODE.md: een restbak
   vol bekende vormen laat je denken dat je huis ondoorgrondelijk is terwijl je
   meter te grof kijkt. Ze worden daarom GETELD en apart gemeld als
   `onbeoordeeld` -- niet weggelaten, want een meter die zijn blinde vlek
   verzwijgt, laat zijn dekking groter lijken dan hij is.

   GRAAD: gemeten. Het bestaan van een bestand is geen inschatting. Wat deze
   meter NIET zegt is of het adres naar het JUISTE bestand wijst -- een pad dat
   bestaat maar de verkeerde module aanwijst, komt hier als `klopt` langs.

   Draaien:  node scripts/adressen.js            (leesbaar)
             node scripts/adressen.js --json     (voor een toets)
             node scripts/adressen.js --vast     (schrijft ADRESSEN.json) */
'use strict';

const fs = require('fs');
const path = require('path');
const { stempel } = require('./lib/stempel');

/* Een pad telt pas als ADRES wanneer er een map voor staat die in dit huis
   bestaat. Alles daarbuiten is een verkorte verwijzing. */
const WORTELS = Object.freeze(['server/', 'scripts/', 'public/', 'test/', 'kern/', 'routes/',
  'shared/', 'lib/', 'apps/', 'opzet/', 'middleware/', 'webauthn/']);

/* De plekken waar een pad vandaan kan komen. Documenten korten af -- `kern/x.js`
   voor `server/kern/x.js`, `shared/y.js` voor `public/shared/y.js` -- en dat is
   leesbaar en toegestaan; deze meter kent die afkortingen in plaats van ze af
   te keuren. */
function kandidaten(p) {
  return [p, 'server/' + p, 'public/' + p,
    'server/kern/' + p.replace(/^kern\//, ''),
    'public/' + p.replace(/^(shared|apps)\//, '$1/'),
    'server/' + p.replace(/^(routes|opzet|middleware|webauthn|lib)\//, '$1/')];
}

function beoordeel(p) {
  for (const k of kandidaten(p)) {
    let st = null;
    try { st = fs.statSync(k); } catch (e) { continue; }
    if (st.isFile()) return { uitslag: 'klopt', op: k };
  }
  /* Geen bestand -- maar staat er een MAP waar het bestand stond? Dan is de
     module opgeknipt en is alleen het adres verouderd. */
  for (const k of kandidaten(p)) {
    const zonder = k.replace(/\.js$/, '');
    let st = null;
    try { st = fs.statSync(zonder); } catch (e) { continue; }
    if (st.isDirectory()) return { uitslag: 'opgeknipt', op: zonder + '/' };
  }
  return { uitslag: 'kapot', op: null };
}

/* DE RATEL, EN WAAROM HIJ GEEN NUL IS. Niet elk kapot adres is een fout: een
   richtingsdocument dat `scripts/wereldmodel.js` noemt, STELT dat bestand voor --
   dat is de hele functie van zo'n document, en op nul afdwingen zou betekenen dat
   dit huis niets meer mag voorstellen wat het nog niet gebouwd heeft. Dit is dus
   een TRIAGELIJST en geen beschuldiging, dezelfde vorm als DOODSPOOR.json.

   Wat de ratel wel doet is voorkomen dat het getal ONGEMERKT groeit. Hij mag
   alleen omlaag. Wie hem verhoogt, schrijft erbij waarom -- en wie dat zonder
   uitleg doet, sloopt de ratel in plaats van hem te verzetten. */
const KAPOT_MAX = 23;

const PAD_IN_CODE = /`([A-Za-z0-9_\-\/\.]+\.js)`/g;

function meet(wortel) {
  const map = wortel || process.cwd();
  const docs = fs.readdirSync(map).filter(f => f.endsWith('.md')).sort();
  const uit = { klopt: 0, onbeoordeeld: 0, opgeknipt: [], kapot: [] };
  const gezien = new Set();

  for (const doc of docs) {
    const tekst = fs.readFileSync(path.join(map, doc), 'utf8');
    let m;
    while ((m = PAD_IN_CODE.exec(tekst))) {
      const p = m[1];
      if (p.includes('*')) continue;
      if (!WORTELS.some(w => p.startsWith(w))) { uit.onbeoordeeld++; continue; }

      const oordeel = beoordeel(p);
      if (oordeel.uitslag === 'klopt') { uit.klopt++; continue; }

      /* Eenzelfde fout in eenzelfde document telt een keer: anders weegt een
         document dat zijn eigen adres vaak herhaalt zwaarder dan een document
         dat het een keer fout heeft. */
      const sleutel = doc + '|' + p;
      if (gezien.has(sleutel)) continue;
      gezien.add(sleutel);

      const regel = tekst.slice(0, m.index).split('\n').length;
      uit[oordeel.uitslag].push({ doc, regel, pad: p, nu: oordeel.op });
    }
  }
  uit.beoordeeld = uit.klopt + uit.opgeknipt.length + uit.kapot.length;
  return uit;
}

function register(wortel) {
  const u = meet(wortel);
  return {
    stempel: stempel({ instrument: 'scripts/adressen.js' }),
    hoe: 'npm run adressen:vast',
    uitleg: 'Elk gewortelde bestandsadres dat een .md in de wortel noemt, tegen de bronboom ' +
      'gehouden. KLOPT: het bestand staat er. OPGEKNIPT: het is een map geworden, dus de ' +
      'module bestaat en het adres niet. KAPOT: er staat niets, ook geen map.',
    grens: 'Deze meter zegt NIET of een adres naar het juiste bestand wijst -- een pad dat ' +
      'bestaat maar de verkeerde module aanwijst, komt langs als klopt. En hij beoordeelt geen ' +
      'kale bestandsnamen zonder map ervoor: dat is een verkorte verwijzing en geen adres.',
    graad: 'gemeten',
    beoordeeld: u.beoordeeld,
    klopt: u.klopt,
    onbeoordeeld: u.onbeoordeeld,
    opgeknipt: u.opgeknipt,
    kapot: u.kapot
  };
}

if (require.main === module) {
  const u = meet();
  if (process.argv.includes('--vast')) {
    fs.writeFileSync('ADRESSEN.json', JSON.stringify(register(), null, 2) + '\n');
    console.log('ADRESSEN.json geschreven: ' + u.kapot.length + ' kapot, ' +
      u.opgeknipt.length + ' opgeknipt, ' + u.klopt + ' kloppen.');
  } else if (process.argv.includes('--json')) {
    console.log(JSON.stringify(register(), null, 2));
  } else {
    console.log('ADRESSEN IN DE DOCUMENTEN\n');
    console.log('  beoordeeld    ' + u.beoordeeld + ' gewortelde paden');
    console.log('  klopt         ' + u.klopt);
    console.log('  opgeknipt     ' + u.opgeknipt.length + '  (module bestaat, adres verouderd)');
    console.log('  kapot         ' + u.kapot.length + '  (wijst nergens heen)');
    console.log('  onbeoordeeld  ' + u.onbeoordeeld + '  kale bestandsnamen -- een verkorte ' +
      'verwijzing, geen adres');

    if (u.opgeknipt.length) {
      console.log('\nOPGEKNIPT -- het bestand is een map geworden:');
      for (const r of u.opgeknipt) console.log('  ' + (r.doc + ':' + r.regel).padEnd(28) +
        r.pad + '  ->  ' + r.nu);
    }
    if (u.kapot.length) {
      console.log('\nKAPOT -- er staat niets op dit pad:');
      for (const r of u.kapot) console.log('  ' + (r.doc + ':' + r.regel).padEnd(28) + r.pad);
    }
    if (!u.kapot.length && !u.opgeknipt.length)
      console.log('\nElk gewortelde adres in de documenten wijst naar een bestand dat bestaat.');

    if (u.kapot.length > KAPOT_MAX)
      console.log('\nDE RATEL ZAKT: ' + u.kapot.length + ' kapotte adressen, en de ratel staat ' +
        'op ' + KAPOT_MAX + '. Repareer het adres, of verzet de ratel MET de reden.');
  }
  process.exitCode = (meet().kapot.length > KAPOT_MAX) ? 1 : 0;
}

module.exports = { WORTELS, kandidaten, beoordeel, meet, register };
