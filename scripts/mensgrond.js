#!/usr/bin/env node
/* ============================================================================
   MENSGROND -- waarom staat er bij deze handeling een mens?

   DE VRAAG. Elke muterende handeling wordt vandaag door een mens gedaan, of door de
   machine binnen wat de grammatica (kern/stuur/beleid.js + kern/stuur/mandaat.js)
   toelaat. Deze meter vraagt per handeling of dat KLOPT, in beide richtingen:

     een mens zonder grond                    -> automatiseringsschuld
     de machine over een grond heen           -> overtreding
     een mens met een aantoonbare grond       -> geldig (blijvend, of tot er bewijs is)
     de machine, zonder grond en met poorten  -> machinewerk
     te weinig bewijs                         -> onbekend

   De gesloten lijst gronden en de indeling wonen in scripts/lib/mensgrond.js. Deze
   meter verzint niets: hij legt die lijst naast vier lagen die er al zijn en elk een
   eigen eigenaar hebben -- de effecten (kern/isolatie/effecten.js), de bodem
   (kern/frictie/bodem.js), de mandaatgrammatica (kern/stuur/mandaat.js) en de
   herstelregisters (HERSTELPROEF.json, HERSTELBESLUIT.json).

   WAT HIJ NIET IS.
   - Geen Human Dependency Ratio. Er staat nergens een percentage mensenwerk, want
     wie dat omlaag duwt, duwt ook toestemming, een relatie en een oordeel weg -- en
     die zijn het product (AUTONOMIE.md par. 2.9). Er wordt geteld PER GROND.
   - Geen meting van mensen. Hij leest routes en registers, nooit wie wat deed.
   - Geen voorstel om iets te automatiseren. Automatiseringsschuld is een triagelijst;
     een kandidaat gaat daarna door schaduw, bewijs en een handtekening.

   DE GRENS. Effecten zijn soms `vermoed` (uit de categorie van een functie) en de
   herstelproef dekt negentig paren; wat er niet in staat heet `terugweg-onbewezen`,
   en dat is precies de goede uitspraak, niet een gebrek van deze meter. `machineBereik`
   is LATENT: er draait geen mandaat in productie, dus een overtreding hier is een
   overtreding in de GRAMMATICA en nog niet in een handeling die zelfstandig liep.

   DRAAIEN
     npm run mensgrond               overzicht
     npm run mensgrond:vastleggen    schrijft MENSGROND.json (alleen op een schone boom)
     npm run mensgrond:controle      zakt als overtreding of onbekend stijgt
     node scripts/mensgrond.js --uitkomst overtreding   de routes van een uitkomst
   ========================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { alleRoutes, rolVan } = require('./lib/routes.js');
const { BEWEZEN_LEZINGEN } = require('./machinedekking.js');
const { stempel, eisSchoneBoom } = require('./lib/stempel');
const mensgrond = require('./lib/mensgrond.js');
const effectmodel = require('../server/kern/isolatie/effecten.js');
const { bodemVoorPad } = require('../server/kern/frictie/bodem.js');
const { speelruimte } = require('../server/kern/stuur/mandaat.js');
const { beleidVoor } = require('../server/kern/stuur/beleid.js');
const { gevolgVan } = require('../server/kern/stuur/gevolg.js');
const functies = require('../server/functies');

const WORTEL = path.join(__dirname, '..');
const DOEL = path.join(WORTEL, 'MENSGROND.json');
const K = { rood: '\x1b[31m', groen: '\x1b[32m', geel: '\x1b[33m', grijs: '\x1b[2m', reset: '\x1b[0m' };

const leesJson = (naam) => {
  try { return JSON.parse(fs.readFileSync(path.join(WORTEL, naam), 'utf8')); } catch (e) { return null; }
};
const digest = (bestand) => {
  try { return crypto.createHash('sha256').update(fs.readFileSync(path.join(WORTEL, bestand))).digest('hex').slice(0, 16); }
  catch (e) { return null; }
};

/* DE HERSTELSTAND per pad. Een mens die REVERSIBLE of COMPENSATABLE verklaarde, of een
   proef die exact of compensatie mat, maakt hem `bewezen`; FINAL of geen-herstel maakt
   hem `onomkeerbaar`. Spreken die twee elkaar tegen, dan wint ONOMKEERBAAR -- de
   strengste kant, want een terugweg die de proef niet vond is geen terugweg. */
function herstelkaart() {
  const kaart = new Map();
  const zet = (pad, stand) => {
    const was = kaart.get(pad);
    if (was === 'onomkeerbaar') return;
    kaart.set(pad, stand);
  };
  const proef = leesJson('HERSTELPROEF.json');
  for (const r of ((proef && proef.per) || [])) {
    if (r.uitslag === 'exact' || r.uitslag === 'compensatie') zet(r.heen, 'bewezen');
    else if (r.uitslag === 'geen-herstel') zet(r.heen, 'onomkeerbaar');
  }
  const besluit = leesJson('HERSTELBESLUIT.json');
  for (const [sleutel, b] of Object.entries((besluit && besluit.routes) || {})) {
    const pad = String(sleutel).replace(/^[A-Z]+\s+/, '');
    if (b.stand === 'FINAL') zet(pad, 'onomkeerbaar');
    else if (b.stand === 'REVERSIBLE' || b.stand === 'COMPENSATABLE') zet(pad, 'bewezen');
  }
  return kaart;
}

function meet() {
  const routes = alleRoutes();
  const herstel = herstelkaart();
  const idem = leesJson('IDEMPROEF.json');
  const herhaling = new Map(((idem && idem.perRoute) || []).map(r => [r.methode + ' ' + r.pad, r.idempotentie]));
  const vertrouwen = leesJson('VERTROUWEN.json');
  const vervalstaat = (vertrouwen && vertrouwen.perRoute) || {};

  const perGrond = {};
  for (const n of mensgrond.NAMEN) perGrond[n] = { routes: 0, geldigMens: 0, overtreding: 0 };
  const perUitkomst = {};
  for (const n of Object.keys(mensgrond.UITKOMSTEN)) perUitkomst[n] = 0;
  const duur = { blijvend: 0, totBewijs: 0, onbekend: 0 };
  const poortenGehaald = {};
  for (const n of Object.keys(mensgrond.POORTEN)) poortenGehaald[n] = 0;
  const effectGraad = {};
  const openEffecten = {};
  const perRoute = [];
  const perKant = {};
  const gezien = new Set();
  let muterend = 0, machineBereik = 0, kandidaatKlaar = 0;

  for (const r of routes) {
    const sleutel = (r.methode + ' ' + r.pad).trim();
    if (!/POST|PUT|PATCH|DELETE/i.test(r.methode) || BEWEZEN_LEZINGEN.has(sleutel)) continue;
    if (gezien.has(sleutel)) continue;
    gezien.add(sleutel);
    muterend++;

    const rol = rolVan(r.bewakers, r) || null;
    const prof = effectmodel.effectenVan(r.pad, r.methode, functies.functieVoorPad(r.pad));
    const gv = gevolgVan(r.pad);
    /* EEN METING GAAT VOOR EEN CATEGORIE -- dezelfde rangorde als kern/isolatie/effecten.js.
       Zag de proef niets veranderen, dan is een vermoeden uit de categorie van de functie
       ("woont bij de backoffice, dus schrijft andermans gegevens") overstemd, en valt er
       ook niets terug te draaien. Een VERKLAARD effect blijft staan: dat heeft een grond
       per pad, en de proef ziet bestanden en uitgaande aanroepen niet. */
    const nietsGemeten = gv.graad === 'geen-effect-gemeten';
    const effecten = nietsGemeten && prof.graad === 'vermoed' ? [] : prof.effecten;
    effectGraad[prof.graad] = (effectGraad[prof.graad] || 0) + 1;
    for (const e of (prof.effecten || [])) {
      if (!mensgrond.UIT_EFFECT[e] && /^OPEN/.test(mensgrond.GEEN_GROND[e] || '')) openEffecten[e] = (openEffecten[e] || 0) + 1;
    }
    const bodem = bodemVoorPad(r.pad);
    const herstelstand = herstel.get(r.pad) || (nietsGemeten && effecten && !effecten.length ? 'nvt' : 'onbewezen');
    const kant = mensgrond.kantVan(rol);
    const g = mensgrond.grondenVan({ pad: r.pad, rol, kant, effecten, effectgraad: prof.graad, bodemId: bodem && bodem.id, herstel: herstelstand });

    const poorten = {
      gevolg: gv.graad === 'gemeten' || nietsGemeten,
      terugweg: herstelstand === 'bewezen' || herstelstand === 'nvt',
      herhaling: herhaling.get(sleutel) === 'beschermd',
      bewijs: (vervalstaat[sleutel] || {}).staat === 'bewezen'
    };
    for (const [n, ok] of Object.entries(poorten)) if (ok) poortenGehaald[n]++;

    /* HET BEREIK UIT DE GRAMMATICA ZELF: een mandaat dat precies dit pad noemt. Wat
       speelruimte() dan teruggeeft, is wat een mandaat hier zelfstandig zou mogen. */
    const bereik = rol ? speelruimte([r.pad], rol, { capabilities: [r.pad] }).paden.length > 0 : false;
    if (bereik) machineBereik++;
    const niveau = rol ? beleidVoor(r.pad, rol).niveau : 'verboden';

    const d = mensgrond.deelIn({ gronden: g, machineBereik: bereik, poorten, niveau,
      schrijftGemeten: gv.graad === 'gemeten' });
    perUitkomst[d.uitkomst]++;
    if (d.uitkomst === 'geldig') duur[d.duur]++;
    for (const x of g.gronden) {
      perGrond[x.grond].routes++;
      if (d.uitkomst === 'geldig') perGrond[x.grond].geldigMens++;
      if (d.uitkomst === 'overtreding') perGrond[x.grond].overtreding++;
    }
    /* Klaar om KANDIDAAT te worden: schuld, en alle vier de poorten. Dat is nog geen
       automatisering -- daarna komen schaduw, vergelijking en een handtekening. */
    const klaar = d.uitkomst === 'automatiseringsschuld' && Object.values(poorten).every(Boolean);
    if (klaar) kandidaatKlaar++;

    perKant[kant] = perKant[kant] || {};
    perKant[kant][d.uitkomst] = (perKant[kant][d.uitkomst] || 0) + 1;
    /* Een rij draagt alleen wat iets zegt: `duur`, `machineBereik` en `kandidaatKlaar`
       staan er alleen als ze gezet zijn, want over vierduizend rijen is een `false` per
       veld een register dat niemand meer opent. */
    const rij = { methode: r.methode, pad: r.pad, rol, kant, uitkomst: d.uitkomst, waarom: d.waarom, niveau,
      gronden: g.gronden.map(x => x.grond), effectgraad: prof.graad, poorten: Object.keys(poorten).filter(n => poorten[n]) };
    if (d.duur) rij.duur = d.duur;
    if (bereik) rij.machineBereik = true;
    if (klaar) rij.kandidaatKlaar = true;
    perRoute.push(rij);
  }
  perRoute.sort((a, b) => (a.pad + a.methode).localeCompare(b.pad + b.methode));

  return {
    soort: 'projectie',
    uitleg: 'Per muterende handeling: staat er een mens, en heeft die een grond uit de gesloten lijst ' +
      '(scripts/lib/mensgrond.js)? Menselijk werk zonder grond is automatiseringsschuld, de machine over een ' +
      'grond heen is een overtreding. Geteld per grond en per uitkomst, nooit als percentage mensenwerk.',
    grens: 'De gronden komen uit effecten (soms vermoed, uit de categorie van een functie), de bodem, ' +
      'NOOIT_AUTONOOM en de herstelregisters. Fysieke aanwezigheid en wettelijke bevoegdheid hebben geen bron ' +
      'per route en staan in `ongemeten`, nooit als nul. `machineBereik` is latent: er draait geen mandaat in ' +
      'productie, dus een overtreding is er een in de grammatica. De poort `bewijs` leest VERTROUWEN.json, en ' +
      'dat register draagt zijn eigen stempel -- loopt het achter, dan is deze poort strenger en nooit losser.',
    stempel: stempel(),
    bronnen: {
      'scripts/lib/mensgrond.js': digest('scripts/lib/mensgrond.js'),
      'HERSTELPROEF.json': digest('HERSTELPROEF.json'),
      'HERSTELBESLUIT.json': digest('HERSTELBESLUIT.json'),
      'IDEMPROEF.json': digest('IDEMPROEF.json'),
      'VERTROUWEN.json': digest('VERTROUWEN.json'),
      'MUTATIECONTRACT.json': digest('MUTATIECONTRACT.json'),
      vertrouwenStempel: vertrouwen && vertrouwen.stempel ? vertrouwen.stempel.op : null
    },
    gronden: Object.fromEntries(Object.entries(mensgrond.GRONDEN).map(([n, x]) =>
      [n, { soort: x.soort, betekenis: x.betekenis, bron: x.bron }])),
    uitkomsten: mensgrond.UITKOMSTEN,
    poorten: mensgrond.POORTEN,
    gemeten: {
      routes: routes.length, muterend, machineBereik, kandidaatKlaar,
      perUitkomst, perKant, geldigDuur: duur, perGrond, poortenGehaald, effectGraad,
      openEffecten
    },
    ongemeten: Object.fromEntries(Object.entries(mensgrond.GRONDEN)
      .filter(([, x]) => x.nietGemeten).map(([n, x]) => [n, x.nietGemeten])),
    perRoute
  };
}

function toon(u) {
  const g = u.gemeten;
  console.log('\nMENSGROND -- waarom staat er bij deze handeling een mens?\n');
  console.log('  muterende handelingen       ' + g.muterend + '   (binnen de grammatica zelfstandig: ' + g.machineBereik + ', latent)');
  console.log('\n  per uitkomst (geen totaalcijfer, geen percentage):');
  for (const [n, aantal] of Object.entries(g.perUitkomst)) {
    const kleur = n === 'overtreding' && aantal ? K.rood : n === 'onbekend' && aantal ? K.geel : '';
    console.log('    ' + kleur + n.padEnd(24) + String(aantal).padStart(6) + K.reset);
  }
  for (const [kant, v] of Object.entries(g.perKant))
    console.log('    ' + K.grijs + ('kant ' + kant).padEnd(16) + Object.entries(v).map(([n, a]) => n + ' ' + a).join(', ') + K.reset);
  console.log('    ' + K.grijs + 'waarvan geldig: blijvend ' + g.geldigDuur.blijvend + ', tot bewijs ' + g.geldigDuur.totBewijs +
    ', duur onbekend ' + g.geldigDuur.onbekend + K.reset);
  console.log('\n  per grond                   routes   geldig mens   overtreding');
  for (const [n, v] of Object.entries(g.perGrond)) {
    console.log('    ' + n.padEnd(24) + String(v.routes).padStart(6) + String(v.geldigMens).padStart(14) +
      (v.overtreding ? K.rood : '') + String(v.overtreding).padStart(14) + K.reset);
  }
  console.log('\n  harde poorten gehaald (van ' + g.muterend + '):');
  for (const [n, aantal] of Object.entries(g.poortenGehaald)) console.log('    ' + n.padEnd(12) + String(aantal).padStart(6));
  console.log('\n  klaar om kandidaat te worden (schuld + alle vier de poorten): ' + g.kandidaatKlaar);
  if (Object.keys(g.openEffecten).length)
    console.log('  effecten zonder besluit over een grond: ' + Object.entries(g.openEffecten).map(([e, n]) => e + ' (' + n + ')').join(', '));
  console.log('\n  ongemeten (met reden, nooit als 0): ' + Object.keys(u.ongemeten).join(', ') + '\n');
}

function main() {
  const argv = process.argv.slice(2);
  const u = meet();
  if (argv.includes('--json')) { console.log(JSON.stringify(u, null, 1)); return; }

  const ui = argv.indexOf('--uitkomst');
  if (ui > -1 && argv[ui + 1]) {
    const rijen = u.perRoute.filter(r => r.uitkomst === argv[ui + 1]);
    console.log('\n' + argv[ui + 1] + ': ' + rijen.length + ' handelingen');
    for (const r of rijen.slice(0, 60)) console.log('  ' + r.methode + ' ' + r.pad + '  ' + K.grijs + r.waarom + K.reset);
    if (rijen.length > 60) console.log('  ... en ' + (rijen.length - 60) + ' meer');
    return;
  }

  toon(u);

  if (argv.includes('--vastleggen')) {
    const b = eisSchoneBoom('MENSGROND.json');
    if (!b.ok) {
      console.error('  NIET VASTGELEGD -- ' + b.reden);
      for (const f of (b.bestanden || [])) console.error('    ' + f);
      process.exitCode = 3;
      return;
    }
    /* Een rij per regel: leesbaar in een diff, en een derde van de omvang. */
    const { perRoute, ...kop } = u;
    const tekst = JSON.stringify(kop, null, 1).replace(/\n}$/, ',\n "perRoute": [\n' +
      perRoute.map(r => '  ' + JSON.stringify(r)).join(',\n') + '\n ]\n}');
    fs.writeFileSync(DOEL, tekst + '\n');
    console.log('  vastgelegd in MENSGROND.json\n');
    return;
  }

  /* DE POORT. `overtreding` en `onbekend` mogen alleen dalen. `automatiseringsschuld`
     heeft met opzet GEEN ratel: hij STIJGT wanneer er bewijs bijkomt (een terugweg die
     bewezen raakt, haalt `terugweg-onbewezen` weg en laat zien dat er geen mens nodig
     was). Een schuld die zichtbaar wordt is vooruitgang, geen achteruitgang. */
  if (argv.includes('--controle')) {
    let oud;
    try { oud = JSON.parse(fs.readFileSync(DOEL, 'utf8')); }
    catch (e) { console.error('GEZAKT: MENSGROND.json ontbreekt. Draai eerst --vastleggen.'); process.exitCode = 1; return; }
    let gezakt = false;
    for (const veld of ['overtreding', 'onbekend']) {
      const was = oud.gemeten.perUitkomst[veld], nu = u.gemeten.perUitkomst[veld];
      if (typeof was !== 'number') continue;
      if (nu > was) {
        console.error(K.rood + 'GEZAKT: ' + veld + ' ' + was + ' -> ' + nu + '. Deze teller mag alleen dalen.' + K.reset);
        gezakt = true;
      } else console.log('  in orde: ' + veld + ' ' + nu + ' (was ' + was + ')');
    }
    if (gezakt) process.exitCode = 1;
  }
}

if (require.main === module) main();
module.exports = { meet, herstelkaart };
