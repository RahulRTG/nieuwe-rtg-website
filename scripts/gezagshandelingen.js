#!/usr/bin/env node
/* ============================================================================
   DE GEDEELDE NAMESPACE VAN HANDELINGEN -- de tussenstap van TAKEN.md 4.54.

   WAT 4.54 VRAAGT, en waarom dit de helft ervan is. De regel vraagt om EEN
   poort waar mens, AI, API, cronjob en interne dienst doorheen gaan, met de vijf
   schalen als treden. Dat is een verbouwing. De regel noemt er zelf een
   tussenstap bij die al telt: *een gedeelde namespace voor handelingen, zodat
   twee schalen elkaar uberhaupt kunnen tegenspreken.*

   Want dat kunnen ze vandaag niet, en dat is een ander gebrek dan "ze zijn het
   oneens". `scripts/gezagsnoemer.js` heeft de TREDEN al op een noemer gebracht
   (geen / tonen / klaarzetten / uitvoeren). Wat daarna overblijft is het
   ONDERWERP: elke schaal noemt zijn handelingen in zijn eigen woorden, en twee
   uitspraken over verschillende dingen kunnen niet botsen. Een tegenspraak
   VINDEN vraagt dus eerst dat de dingen dezelfde naam dragen.

   WAT DEZE METER DOET
     1 hij haalt per schaal op WAAROVER hij een uitspraak doet -- een routepad,
       een benoemde handeling, een regelsoort, een levensdomein;
     2 hij brengt ze onder in een gedeelde namespace: `soort:naam`, waarbij de
       SOORT zegt wat voor ding het is (`route`, `handeling`, `regelsoort`,
       `domein`). Twee schalen kunnen elkaar alleen tegenspreken binnen dezelfde
       soort -- een routepad en een levensdomein zijn geen twee meningen over
       hetzelfde;
     3 hij telt hoeveel sleutels door MEER DAN EEN schaal worden genoemd. Dat
       getal is de comparabiliteit, en het is de enige die telt: zolang het nul
       is, is "de vijf schalen spreken elkaar niet tegen" een uitspraak over de
       meting en niet over het huis.

   WAT DEZE METER NIET DOET, en dat hoort erbij te staan:

   - hij vertaalt niet tussen soorten. `identiteit wijzigen` (bodem) en
     `/api/account/...` (allowlist) gaan waarschijnlijk over hetzelfde, maar
     "waarschijnlijk" is precies wat een register niet mag zeggen. Zo'n brug is
     een BESLUIT en hoort met een citaat vastgelegd, zoals TEGENSPRAKEN in
     scripts/gezag.js. Er staat er hieronder geen.
   - hij oordeelt niet of een schaal het bij het juiste eind heeft. Hij zegt
     alleen of twee schalen over hetzelfde ding praten.
   - hij woont in scripts/ en niet in server/, om dezelfde reden als
     scripts/gezagsnoemer.js: een noemer die door de code wordt aangeroepen IS
     een zesde schaal in plaats van de laag eroverheen. test/gezagshandelingen.test.js
     zakt zodra iets uit server/ hem importeert.

   Draai:  node scripts/gezagshandelingen.js
           node scripts/gezagshandelingen.js --lijst
           node scripts/gezagshandelingen.js --vastleggen
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');

const WORTEL = path.join(__dirname, '..');
const UITSLAG = path.join(WORTEL, 'GEZAGSHANDELINGEN.json');
const argv = process.argv.slice(2);
const VASTLEGGEN = argv.includes('--vastleggen');
const LIJST = argv.includes('--lijst');

/* DE VIER SOORTEN DINGEN waar in dit huis een gezagsuitspraak over gaat. De
   soort staat in de sleutel omdat hij het VERGELIJKEN begrenst: twee schalen
   die allebei `betalen` zeggen, zeggen niet hetzelfde als de een een route
   bedoelt en de ander een levensdomein. */
const SOORTEN = {
  route: 'een HTTP-pad; het fijnste wat dit huis heeft en het enige dat een machine kan nalopen',
  handeling: 'een benoemde handeling in gewone taal, los van welke route hem uitvoert',
  regelsoort: 'een soort beleidsregel die een lid zelf zet',
  domein: 'een levensgebied; geen handeling maar een verzameling ervan'
};

/* PER SCHAAL: waar zijn onderwerpen vandaan komen. Elke bron is een AFLEIDING
   uit de code, nooit een lijst die hier is overgetypt -- dat is de fout die
   BEWIJSMACHINE.md op de prijskaart heeft staan. */
const SCHALEN = [
  {
    bestand: 'server/kern/stuur/beleid-lijsten.js',
    wat: 'de AI-allowlist: welke routes de machine mag raken, per rol',
    haal() {
      const m = require(path.join(WORTEL, 'server/kern/stuur/beleid-lijsten.js'));
      const uit = new Set();
      for (const lijst of [m.LEZEN, m.KLEIN, m.VOORSTEL]) {
        for (const rol of Object.keys(lijst)) {
          for (const re of lijst[rol]) uit.add({ patroon: re });
        }
      }
      return uit;
    }
  },
  {
    bestand: 'server/kern/frictie/bodem.js',
    wat: 'de ondergrens per handeling: wat niet per geval heronderhandeld mag worden',
    haal() {
      const m = require(path.join(WORTEL, 'server/kern/frictie/bodem.js'));
      const uit = new Set();
      for (const r of m.BODEM) {
        if (r.pad) uit.add({ patroon: r.pad });
        if (r.actie) uit.add('handeling:' + r.actie);
      }
      return uit;
    }
  },
  {
    bestand: 'server/kern/geldbeleid/regels.js',
    wat: 'de geldregels van een lid: waar een regel over kan gaan',
    haal() {
      /* SOORTEN wordt niet geexporteerd, en dat is geen reden om hem hier over
         te typen: dan staat dezelfde waarheid op twee plekken (LAT.md regel 4).
         Uit de bron lezen is lelijker en blijft kloppen. */
      const bron = fs.readFileSync(path.join(WORTEL, 'server/kern/geldbeleid/regels.js'), 'utf8');
      const m = /const SOORTEN = \[([^\]]+)\]/.exec(bron);
      if (!m) throw new Error('geldbeleid/regels.js heeft geen SOORTEN meer; deze meter meet dan niets');
      return new Set(m[1].split(',').map(s => 'regelsoort:' + s.trim().replace(/^'|'$/g, '')));
    }
  },
  {
    bestand: 'server/kern/stadsweefsel/ainiveau.js',
    wat: 'wat de machine in het stadsweefsel zelf mag, per handeling',
    haal() {
      const m = require(path.join(WORTEL, 'server/kern/stadsweefsel/ainiveau.js'));
      return new Set(Object.keys(m.HANDELINGEN).map(k => 'handeling:' + k));
    }
  },
  {
    bestand: 'server/kern/bureau/delegatie.js',
    wat: 'wat het concierge-bureau namens een lid uit handen krijgt, per levensdomein',
    haal() {
      const bron = fs.readFileSync(path.join(WORTEL, 'server/kern/bureau/delegatie.js'), 'utf8');
      const uit = new Set();
      for (const m of bron.matchAll(/\{\s*id:\s*'([a-z-]+)',\s*naam:/g)) uit.add('domein:' + m[1]);
      if (!uit.size) throw new Error('bureau/delegatie.js heeft geen DOMEINEN meer; deze meter meet dan niets');
      return uit;
    }
  }
];

/* DE ECHTE ROUTES, uit EXECUTION_MAP.json. Twee route-patronen op hun TEKST
   vergelijken zegt niets: `/^\/api\/aanmelding(\/|$)/` en
   `/^\/api\/aanmelding\/(status|open)$/` zijn verschillende tekenreeksen en
   dezelfde routes. De eerste versie van deze meter deed dat wel en vond nul
   overlap -- een nul die alleen over de schrijfwijze ging.

   Dus: elke schaal die in routes spreekt, wordt tegen de ECHTE routes gehouden.
   De sleutel is dan het pad zelf, en twee schalen die hetzelfde pad raken praten
   aantoonbaar over hetzelfde ding. */
function echteRoutes() {
  try {
    const m = JSON.parse(fs.readFileSync(path.join(WORTEL, 'EXECUTION_MAP.json'), 'utf8'));
    const uit = new Set();
    for (const k of Object.keys(m.capabilities || {})) {
      const p = m.capabilities[k] && m.capabilities[k].pad;
      if (p) uit.add(p);
    }
    return uit;
  } catch (e) { return new Set(); }
}

/* DE BRUGGEN die met de hand zijn vastgesteld: twee namen in verschillende
   schalen die AANTOONBAAR over hetzelfde gaan. Vandaag staat hier niets, en dat
   is de eerlijke stand -- niet een gat dat vergeten is. Een brug hoort een
   citaat te dragen uit beide bronnen, zoals TEGENSPRAKEN in scripts/gezag.js,
   zodat hij niet stil kan verrotten. */
const BRUGGEN = [];

/* WAT ELKE SCHAAL OVER EEN GEDEELD ONDERWERP ZEGT, in de noemer van
   scripts/gezagsnoemer.js. Dit is waar de namespace voor bestaat: pas als twee
   schalen over hetzelfde ding praten EN hun treden op een noemer staan, is
   "spreken ze elkaar tegen" een vraag die je kunt stellen.

   De bodem is geen uitspraak maar een ONDERGRENS: hij zegt hoe ver de machine
   ten hoogste mag gaan. Een tegenspraak is dus niet "ze zeggen iets anders" maar
   "de allowlist gaat verder dan de bodem toestaat". Dat verschil is de hele
   reden dat deze functie apart staat en de vergelijking niet op gelijkheid gaat. */
function uitspraken(pad) {
  const uit = {};
  try {
    const noemer = require('./gezagsnoemer.js');
    const projectie = (bestand, trede) => {
      const p = (noemer.PROJECTIES || []).find(x => x.bestand === bestand);
      return p && p.treden[trede] ? p.treden[trede].noemer : null;
    };
    const lijsten = require(path.join(WORTEL, 'server/kern/stuur/beleid-lijsten.js'));
    const raakt = (l) => Object.keys(l).some(rol => l[rol].some(re => re.test(pad)));
    const niveau = raakt(lijsten.LEZEN) ? 'lezen' : raakt(lijsten.KLEIN) ? 'klein'
      : raakt(lijsten.VOORSTEL) ? 'voorstel' : 'verboden';
    /* De projectie staat op beleid.js en niet op beleid-lijsten.js: dat eerste
       bestand draagt het BESLUIT, dit de paden. */
    uit['server/kern/stuur/beleid-lijsten.js'] = projectie('server/kern/stuur/beleid.js', niveau) || niveau;

    const bodem = require(path.join(WORTEL, 'server/kern/frictie/bodem.js'));
    const regel = bodem.bodemVoorPad(pad);
    if (regel) {
      uit['server/kern/frictie/bodem.js'] =
        'ten hoogste ' + (projectie('server/kern/frictie/motor.js', regel.minimum) || regel.minimum);
    }
  } catch (e) { uit.fout = e.message; }
  return uit;
}

/* Gaat de allowlist VERDER dan de bodem toestaat? De noemer is geordend, dus
   dat is een vergelijking op index en geen tabel met gevallen. */
function gaatTeVer(zegt) {
  const orde = ['geen', 'tonen', 'klaarzetten', 'uitvoeren'];
  const lijst = zegt['server/kern/stuur/beleid-lijsten.js'];
  const plafondTekst = zegt['server/kern/frictie/bodem.js'];
  if (!lijst || !plafondTekst) return false;
  const plafond = String(plafondTekst).replace('ten hoogste ', '');
  const a = orde.indexOf(lijst), b = orde.indexOf(plafond);
  return a >= 0 && b >= 0 && a > b;
}

function meet() {
  const routes = echteRoutes();
  const perSchaal = new Map();
  const stuk = [];
  if (!routes.size) stuk.push('EXECUTION_MAP.json levert geen routes; de route-schalen zijn dan niet te vergelijken');
  for (const s of SCHALEN) {
    if (!fs.existsSync(path.join(WORTEL, s.bestand))) { stuk.push(s.bestand + ': bestaat niet meer'); continue; }
    try {
      const ruw = s.haal();
      if (!ruw.size) { stuk.push(s.bestand + ': levert geen enkel onderwerp op'); continue; }
      /* Een patroon wordt zijn TREFFERS. Raakt hij geen enkele echte route, dan
         staat hij er als `route-zonder-treffer:` -- dat is zelf een bevinding
         (een regel die nergens over gaat) en geen stille nul. */
      const set = new Set();
      for (const item of ruw) {
        if (typeof item === 'string') { set.add(item); continue; }
        let raak = 0;
        for (const r of routes) if (item.patroon.test(r)) { set.add('route:' + r); raak++; }
        if (!raak) set.add('route-zonder-treffer:' + String(item.patroon.source));
      }
      perSchaal.set(s.bestand, set);
    } catch (e) { stuk.push(s.bestand + ': ' + e.message); }
  }

  /* Per sleutel: welke schalen erover praten. */
  const perSleutel = new Map();
  for (const [bestand, set] of perSchaal) {
    for (const k of set) {
      if (!perSleutel.has(k)) perSleutel.set(k, []);
      perSleutel.get(k).push(bestand);
    }
  }
  for (const b of BRUGGEN) {
    const samen = [...new Set([...(perSleutel.get(b.van) || []), ...(perSleutel.get(b.naar) || [])])];
    perSleutel.set('brug:' + b.van + '~' + b.naar, samen);
  }

  const gedeeld = [...perSleutel].filter(([, s]) => s.length > 1);
  const perSoort = {};
  for (const k of perSleutel.keys()) {
    const soort = k.split(':')[0];
    perSoort[soort] = (perSoort[soort] || 0) + 1;
  }

  /* Een schaal die met NIEMAND een soort deelt, staat per definitie alleen: zijn
     uitspraken kunnen door geen enkele andere schaal worden tegengesproken. Dat
     is scherper dan "hij deelt geen sleutel" en het is het getal dat 4.54 raakt. */
  const soortenVan = (set) => new Set([...set].map(k => k.split(':')[0]));
  const alleen = [];
  for (const [bestand, set] of perSchaal) {
    const mijn = soortenVan(set);
    const anderen = [...perSchaal].filter(([b]) => b !== bestand)
      .flatMap(([, s]) => [...soortenVan(s)]);
    if (![...mijn].some(s => anderen.includes(s))) alleen.push(bestand);
  }

  return {
    stuk,
    schalen: perSchaal.size,
    onderwerpen: perSleutel.size,
    perSoort,
    gedeeld: gedeeld.map(([k, s]) => {
      const rij = { sleutel: k, schalen: s };
      if (k.startsWith('route:')) {
        rij.zegt = uitspraken(k.slice(6));
        rij.tegenspraak = gaatTeVer(rij.zegt);
      }
      return rij;
    }),
    alleen,
    bruggen: BRUGGEN.length,
    perSchaal: [...perSchaal].map(([b, s]) => ({ bestand: b, onderwerpen: s.size,
      soorten: [...soortenVan(s)].sort() }))
  };
}

function stand(nu) {
  return {
    uitleg: 'De gedeelde namespace van handelingen -- de tussenstap van TAKEN.md 4.54. ' +
      'Vijf schalen beantwoorden de vraag "mag de machine dit zelf", en scripts/gezagsnoemer.js ' +
      'heeft hun TREDEN al op een noemer. Wat overblijft is het ONDERWERP: zolang twee schalen ' +
      'niet over hetzelfde ding praten, kunnen ze elkaar niet tegenspreken -- en dan is ' +
      '"geen tegenspraak gevonden" een uitspraak over de meting en niet over het huis.',
    hoe: 'node scripts/gezagshandelingen.js --lijst',
    gemeten: {
      schalen: nu.schalen,
      onderwerpen: nu.onderwerpen,
      /* MAG ALLEEN OMHOOG: meer vergelijkbaarheid is het doel. */
      gedeeldeOnderwerpen: nu.gedeeld.length,
      /* MAG ALLEEN OMLAAG, en staat vandaag op 0 -- niet omdat niemand keek maar
         omdat kern/stuur/beleid.js de bodem zelf raadpleegt. Deze meter is het
         bewijs dat die koppeling houdt: breekt hij, dan staat hier een getal. */
      tegenspraken: nu.gedeeld.filter(g => g.tegenspraak).length,
      /* MAG ALLEEN OMLAAG: een schaal die geen enkele soort deelt staat alleen. */
      schalenZonderGedeeldeSoort: nu.alleen.length
    },
    soorten: SOORTEN,
    perSchaal: nu.perSchaal,
    schalenZonderGedeeldeSoort: nu.alleen,
    gedeeldeOnderwerpen: nu.gedeeld
  };
}

function leesVastgelegd() {
  try { return JSON.parse(fs.readFileSync(UITSLAG, 'utf8')); } catch (e) { return null; }
}

function main() {
  const nu = meet();
  const oud = leesVastgelegd();

  console.log('\n=== DE GEDEELDE NAMESPACE VAN HANDELINGEN ===\n');

  if (nu.stuk.length) {
    console.log('  DE METER IS STUK -- een schaal levert geen onderwerpen meer:\n');
    for (const s of nu.stuk) console.log('    - ' + s);
    console.log('\n  Zolang dit staat meet niets hieronder iets.');
    return 2;
  }

  console.log('  schalen                  : ' + nu.schalen);
  console.log('  onderwerpen              : ' + nu.onderwerpen +
    '  (' + Object.entries(nu.perSoort).map(([s, n]) => n + ' ' + s).join(', ') + ')');
  console.log('  door MEER DAN EEN schaal : ' + nu.gedeeld.length);
  console.log('  schalen die alleen staan : ' + nu.alleen.length + ' van ' + nu.schalen +
    '  (geen enkele soort gedeeld met een andere schaal)');
  console.log('  bruggen (met de hand)    : ' + nu.bruggen);
  const botsend = nu.gedeeld.filter(g => g.tegenspraak);
  console.log('  TEGENSPRAKEN             : ' + botsend.length +
    '  (de allowlist gaat verder dan de bodem toestaat)');
  for (const g of botsend) console.log('      ' + g.sleutel);

  console.log('');
  for (const s of nu.perSchaal) {
    console.log('    ' + s.bestand.replace('server/kern/', '').padEnd(32) +
      String(s.onderwerpen).padStart(4) + '  ' + s.soorten.join('+') +
      (nu.alleen.includes(s.bestand) ? '   [staat alleen]' : ''));
  }

  if (LIJST) {
    console.log('\n  gedeelde onderwerpen:');
    if (!nu.gedeeld.length) console.log('    (geen)');
    for (const g of nu.gedeeld) {
      console.log('    ' + g.sleutel + (g.tegenspraak ? '   [TEGENSPRAAK]' : ''));
      for (const [b, z] of Object.entries(g.zegt || {})) {
        console.log('        ' + b.replace('server/kern/', '').padEnd(28) + z);
      }
      if (!g.zegt) console.log('        <- ' + g.schalen.join(', '));
    }
  }

  if (!nu.gedeeld.length) {
    console.log('\n  GEEN ENKEL onderwerp wordt door twee schalen genoemd. Er is dus geen');
    console.log('  tegenspraak te VINDEN -- niet omdat ze het eens zijn, maar omdat ze');
    console.log('  nergens over hetzelfde praten. Dat is de bevinding van TAKEN.md 4.54.');
  }

  if (VASTLEGGEN) {
    if (oud && (nu.gedeeld.length < oud.gemeten.gedeeldeOnderwerpen ||
                nu.alleen.length > oud.gemeten.schalenZonderGedeeldeSoort ||
                nu.gedeeld.filter(g => g.tegenspraak).length > (oud.gemeten.tegenspraken || 0))) {
      console.log('\n  GEWEIGERD: de ratel legt geen verslechtering vast.');
      return 1;
    }
    fs.writeFileSync(UITSLAG, JSON.stringify(stand(nu), null, 2) + '\n');
    console.log('\n  vastgelegd in GEZAGSHANDELINGEN.json');
    return 0;
  }

  if (!oud) { console.log('\n  Nog geen GEZAGSHANDELINGEN.json. Leg de stand vast met --vastleggen.'); return 0; }

  const slechter = [];
  if (nu.gedeeld.length < oud.gemeten.gedeeldeOnderwerpen) {
    slechter.push('gedeelde onderwerpen ' + oud.gemeten.gedeeldeOnderwerpen + ' -> ' + nu.gedeeld.length);
  }
  if (nu.alleen.length > oud.gemeten.schalenZonderGedeeldeSoort) {
    slechter.push('schalen die alleen staan ' + oud.gemeten.schalenZonderGedeeldeSoort + ' -> ' + nu.alleen.length);
  }
  const nuBots = nu.gedeeld.filter(g => g.tegenspraak).length;
  if (nuBots > (oud.gemeten.tegenspraken || 0)) {
    slechter.push('tegenspraken ' + (oud.gemeten.tegenspraken || 0) + ' -> ' + nuBots +
      ' (de allowlist gaat verder dan de bodem toestaat)');
  }
  if (slechter.length) {
    console.log('\n  ZAKT: ' + slechter.join('; ') + '.');
    console.log('  De schalen zijn MINDER vergelijkbaar geworden. Een nieuwe handeling hoort');
    console.log('  een naam te dragen die een andere schaal al kent, of er hoort een BRUG bij');
    console.log('  met een citaat uit beide bronnen.');
    return 1;
  }
  console.log('\n  De stand is gelijk aan of beter dan GEZAGSHANDELINGEN.json.');
  return 0;
}

module.exports = { meet, stand, main, SCHALEN, SOORTEN, BRUGGEN };

if (require.main === module) process.exit(main());
