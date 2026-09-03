#!/usr/bin/env node
'use strict';
/* ============================================================================
   IS ER EEN GEDEELDE KETENVORM? -- gemeten uit twee ketens, niet verklaard.

   WAAROM DIT SCRIPT BESTAAT. Na de tafelproef lag de verleiding voor de hand om
   een `scripts/lib/keten.js` te schrijven en beide ketens daarop te zetten. Dat
   is exact de vorm waarin `Asset` hier al een keer sneuvelde: een gedeeld type
   eroverheen verklaren in plaats van hem in de domeinen VINDEN
   (DEVELOPERCLOUD.md par. 2, OBJECTMODEL.json -- 71% van de velden hoort bij
   precies een domein, en tafel, kamer, podium en leaseauto delen niets buiten
   hun verpakking).

   Dus zijn de twee proeven met opzet los geschreven, in dezelfde VORM maar
   zonder gedeelde module, en telt dit script achteraf wat ze werkelijk delen.
   Pas als daar iets uitkomt dat in beide ketens hetzelfde BETEKENT, is een
   gedeelde module een vondst in plaats van een aanname.

   WAT HIJ MEET, en de drie zijn met opzet gescheiden:

     vorm        de velden van een schakel en van een storing: puur structuur.
                 Die is per definitie gelijk (beide proeven zijn zo geschreven),
                 dus dit is de ONDERGRENS en geen bewijs -- hij staat erbij zodat
                 zichtbaar is hoe weinig dat zegt.
     actoren     de namen aan weerszijden van een schakel. Delen de ketens hun
                 rolbegrippen, of heet iedereen anders?
     beloften    waar de storingen over gaan. Dit is de interessante: twee
                 ketens die dezelfde SOORT fout afvangen, delen iets echts.

   WAT HIJ NIET DOET: een oordeel vellen. Hij telt, en de uitkomst staat in
   KETENVORM.json met de losse waarnemingen erbij, zodat een mens kan zien
   waarop een eventueel besluit rust.

   Draaien:  npm run ketenvorm            (print)
             npm run ketenvorm:vast       (schrijft KETENVORM.json)
   ============================================================================ */
const fs = require('fs');
const path = require('path');

const WORTEL = path.join(__dirname, '..');
const DOEL = path.join(WORTEL, 'KETENVORM.json');

const KETENS = [
  { naam: 'tafel', register: 'TAFELPROEF.json', domein: 'horeca', proef: 'scripts/tafelproef.js' },
  { naam: 'rit', register: 'RITPROEF.json', domein: 'mobiliteit', proef: 'scripts/ritproef.js' }
];

/* De woorden waarop een belofte wordt ingedeeld. Een gesloten lijst, want een
   automatische woordwolk zou "de" en "een" als gedeelde vorm rapporteren. Elk
   thema is een SOORT fout die een keten kan afvangen; wat er niet in staat,
   komt terug als `nietIngedeeld` en is dus zichtbaar. */
const THEMAS = {
  herhaling: [/dezelfde sleutel/i, /twee keer/i, /tweede betaling/i, /geen tweede/i],
  volgorde: [/alleen vooruit/i, /nog niet betaald/i, /terugzetten/i, /eerder/i],
  weigeringMetReden: [/zegt waarom/i, /noemt de reden/i, /weigert.*reden/i, /zegt wat er wel kan/i],
  onbekendObject: [/bestaat niet/i, /verzonnen/i, /kent.*niet/i, /niet van deze/i],
  dubbelObject: [/tweede rekening/i, /al gecorrigeerd/i, /wijst naar de bestaande/i],
  geldKlaargezet: [/klaar zonder het uit te voeren/i, /spiegelt/i, /teruggave/i],
  bereikbareWeg: [/die weg bestaat/i, /verwijst/i],
  nietsKlaarZonderGrond: [/nog niet toegewezen/i, /geen chauffeur/i, /toont geen/i]
};

function lees(naam) {
  try { return JSON.parse(fs.readFileSync(path.join(WORTEL, naam), 'utf8')); }
  catch (e) { return null; }
}

function themaVan(tekst) {
  const uit = [];
  for (const [thema, patronen] of Object.entries(THEMAS))
    if (patronen.some(p => p.test(tekst))) uit.push(thema);
  return uit;
}

function meet() {
  const gelezen = KETENS.map(k => Object.assign({}, k, { data: lees(k.register) }));
  const mist = gelezen.filter(k => !k.data);
  if (mist.length) return { fout: 'register ontbreekt: ' + mist.map(k => k.register).join(', ') +
    ' -- draai eerst: npm run tafelproef:vast && npm run ritproef:vast' };

  /* 1. DE VORM. Welke velden draagt een schakel, en welke een storing? */
  const veldenVan = (rijen) => {
    const s = new Set();
    for (const r of rijen || []) for (const k of Object.keys(r)) s.add(k);
    return [...s].sort();
  };
  const vorm = {};
  for (const k of gelezen)
    vorm[k.naam] = { schakel: veldenVan(k.data.schakels), storing: veldenVan(k.data.storingen) };
  const snij = (a, b) => a.filter(x => b.includes(x));
  const vereniging = (a, b) => [...new Set([...a, ...b])].sort();
  const vormGedeeld = {
    schakel: snij(vorm[gelezen[0].naam].schakel, vorm[gelezen[1].naam].schakel),
    storing: snij(vorm[gelezen[0].naam].storing, vorm[gelezen[1].naam].storing)
  };
  const vormApart = {
    schakel: vereniging(vorm[gelezen[0].naam].schakel, vorm[gelezen[1].naam].schakel)
      .filter(x => !vormGedeeld.schakel.includes(x)),
    storing: vereniging(vorm[gelezen[0].naam].storing, vorm[gelezen[1].naam].storing)
      .filter(x => !vormGedeeld.storing.includes(x))
  };

  /* 2. DE ACTOREN. */
  const actoren = {};
  for (const k of gelezen) {
    const s = new Set();
    for (const x of k.data.schakels || []) { s.add(x.van); s.add(x.naar); }
    actoren[k.naam] = [...s].sort();
  }
  const actorGedeeld = snij(actoren[gelezen[0].naam], actoren[gelezen[1].naam]);
  const actorEigen = {};
  for (const k of gelezen)
    actorEigen[k.naam] = actoren[k.naam].filter(a => !actorGedeeld.includes(a));

  /* 3. DE BELOFTEN. */
  const perKeten = {};
  const nietIngedeeld = [];
  for (const k of gelezen) {
    const t = new Set();
    for (const s of k.data.storingen || []) {
      const gev = themaVan(s.naam + ' ' + s.belofte);
      if (!gev.length) nietIngedeeld.push({ keten: k.naam, storing: s.naam, belofte: s.belofte });
      for (const x of gev) t.add(x);
    }
    perKeten[k.naam] = [...t].sort();
  }
  const themaGedeeld = snij(perKeten[gelezen[0].naam], perKeten[gelezen[1].naam]);
  const themaEigen = {};
  for (const k of gelezen)
    themaEigen[k.naam] = perKeten[k.naam].filter(t => !themaGedeeld.includes(t));

  return {
    stempel: new Date().toISOString().slice(0, 10),
    uitleg: 'Wat twee onafhankelijk geschreven ketenproeven werkelijk delen, geteld uit hun registers. De vorm is per definitie gelijk (beide proeven zijn zo geschreven) en zegt dus niets; de actoren en de beloften zeggen wel iets. Zie de kop van scripts/ketenvorm.js.',
    grens: 'Twee ketens is een kleine steekproef, en ze zijn door dezelfde hand geschreven -- gedeelde beloften kunnen dus ook gedeelde gewoonte zijn. Een derde keten van een andere hand zou dat scheiden. De thema-indeling gebruikt een gesloten woordenlijst; wat er niet in past staat in nietIngedeeld en verdwijnt niet.',
    ketens: gelezen.map(k => ({ naam: k.naam, domein: k.domein, proef: k.proef,
      schakels: (k.data.schakels || []).length, storingen: (k.data.storingen || []).length,
      sluit: k.data.sluit === true,
      bevindingen: (k.data.bevindingen || []).length })),
    vorm: { gedeeld: vormGedeeld, apart: vormApart, let: 'gelijke vorm is de ondergrens en geen vondst: beide proeven zijn zo geschreven' },
    actoren: { perKeten: actoren, gedeeld: actorGedeeld, eigen: actorEigen },
    beloften: { perKeten, gedeeld: themaGedeeld, eigen: themaEigen, nietIngedeeld },
    telling: {
      actorenGedeeld: actorGedeeld.length,
      actorenTotaal: vereniging(actoren[gelezen[0].naam], actoren[gelezen[1].naam]).length,
      themasGedeeld: themaGedeeld.length,
      themasTotaal: vereniging(perKeten[gelezen[0].naam], perKeten[gelezen[1].naam]).length,
      nietIngedeeld: nietIngedeeld.length
    }
  };
}

function druk(u) {
  console.log('ketenvorm: ' + u.ketens.map(k => k.naam + ' (' + k.domein + ', ' + k.schakels + ' schakels, ' +
    k.storingen + ' storingen' + (k.bevindingen ? ', ' + k.bevindingen + ' bevinding(en)' : '') + ')').join('  |  '));
  console.log('\n  ACTOREN');
  for (const [k, v] of Object.entries(u.actoren.perKeten)) console.log('    ' + k.padEnd(8) + v.join(', '));
  console.log('    gedeeld: ' + (u.actoren.gedeeld.join(', ') || '(geen)'));
  for (const [k, v] of Object.entries(u.actoren.eigen)) if (v.length) console.log('    alleen ' + k + ': ' + v.join(', '));
  console.log('\n  BELOFTEN (waar de storingen over gaan)');
  for (const [k, v] of Object.entries(u.beloften.perKeten)) console.log('    ' + k.padEnd(8) + v.join(', '));
  console.log('    gedeeld: ' + (u.beloften.gedeeld.join(', ') || '(geen)'));
  for (const [k, v] of Object.entries(u.beloften.eigen)) if (v.length) console.log('    alleen ' + k + ': ' + v.join(', '));
  if (u.beloften.nietIngedeeld.length) {
    console.log('    niet ingedeeld (' + u.beloften.nietIngedeeld.length + '):');
    for (const x of u.beloften.nietIngedeeld) console.log('      ' + x.keten + ': ' + x.storing);
  }
  console.log('\n  VORM (de ondergrens: beide proeven zijn zo geschreven)');
  console.log('    gedeelde schakelvelden: ' + u.vorm.gedeeld.schakel.join(', '));
  if (u.vorm.apart.schakel.length) console.log('    alleen in een van beide: ' + u.vorm.apart.schakel.join(', '));
  console.log('\n  ' + u.telling.actorenGedeeld + '/' + u.telling.actorenTotaal + ' actoren gedeeld, ' +
    u.telling.themasGedeeld + '/' + u.telling.themasTotaal + ' beloftethema\'s gedeeld.');
}

module.exports = { meet, THEMAS, KETENS, DOEL };

if (require.main === module) {
  const u = meet();
  if (u.fout) { console.error(u.fout); process.exit(1); }
  if (process.argv.includes('--json')) { console.log(JSON.stringify(u)); process.exit(0); }
  druk(u);
  if (process.argv.includes('--vastleggen')) {
    fs.writeFileSync(DOEL, JSON.stringify(u, null, 2) + '\n');
    console.log('\ngeschreven: KETENVORM.json');
  }
}
