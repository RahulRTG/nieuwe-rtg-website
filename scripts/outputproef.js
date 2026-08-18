#!/usr/bin/env node
/* ============================================================================
   DE OUTPUT-PROEF -- KIJKT IEMAND NAAR DE INHOUD VAN HET ANTWOORD?

   DE AS DIE NOOIT EEN INSTRUMENT HAD. In de bewijsmatrix stond OUTPUT voor ALLE
   4185 routes op ongemeten, met als reden: "de liegpoort per ROUTE i.p.v. per
   toetsbestand". Dat leest als "er moet nog iets gebouwd worden", en dat klopte
   maar half: het bewijs LAG er al, alleen op het verkeerde niveau.

   WAT ER AL WAS. server/opzet/liegpoort.js vervangt met RTG_LIEG=/api/ het
   antwoord van elk endpoint door iets geldigs maar leegs. scripts/mutatie.js
   draait daarmee elk servertoetsbestand twee keer -- eerlijk en liegend -- en
   noteert of hij zakt. Blijft een toets groen terwijl alles liegt, dan kijkt hij
   nergens naar de inhoud. Dat is precies de OUTPUT-vraag, maar het antwoord
   staat per TOETSBESTAND en de matrix vraagt het per ROUTE.

   WAT ONTBRAK. De koppeling route -> toets. Het routejournaal noteerde alleen
   DAT een route was geraakt, niet door wie. Sinds server/routelog.js ook een
   TOETS-regel schrijft, is die koppeling er.

   HET OORDEEL, EN ZIJN GRENS. Dit is de eerlijkste vorm die uit deze data valt
   te halen, en hij is smaller dan je zou willen:

     bewezen     minstens een INHOUDGEVOELIG toetsbestand raakt deze route, en
                 dat bestand raakt GEEN ANDERE /api/-route. Dan is de gevoeligheid
                 aan deze route toe te schrijven en aan niets anders.
     onbeslist   inhoudgevoelige toetsen raken hem wel, maar ze raken er meer.
                 Zo'n toets kan op de inhoud van een ANDERE route zijn gezakt.
                 Dat is geen bewijs over deze route, en het als bewijs tellen zou
                 dezelfde fout zijn die de AUTH-as al 294 cellen kostte.
     blind       alleen toetsen die groen bleven terwijl alles loog. Die kijken
                 aantoonbaar nergens naar de inhoud. Dat is GEEN bewijs dat de
                 route stuk is -- het is bewijs over de TOETSEN.
     ongemeten   geen enkele toets raakt deze route, of de mutatiemotor kent het
                 toetsbestand niet.

   Draai:  node scripts/outputproef.js
           node scripts/outputproef.js --lees <journaal>
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const { stempel } = require('./lib/stempel');

const WORTEL = path.join(__dirname, '..');
const argv = process.argv.slice(2);
const JOURNAAL = (argv.find(a => a.startsWith('--lees=')) || '').slice(7) ||
  (argv.includes('--lees') ? argv[argv.indexOf('--lees') + 1] : '') ||
  path.join(WORTEL, '.routejournaal');
const UITSLAG = path.join(WORTEL, 'OUTPUTPROEF.json');

/* Route -> de toetsbestanden die hem raakten, uit de TOETS-regels van het
   journaal. Vorm: `TOETS METHODE /pad toetsnaam`. */
function koppeling(pad) {
  let tekst = '';
  try { tekst = fs.readFileSync(pad, 'utf8'); } catch (e) { return null; }
  const perRoute = new Map();
  const perToets = new Map();
  for (const regel of tekst.split('\n')) {
    const r = regel.trim();
    if (!r.startsWith('TOETS ')) continue;
    const v = r.slice(6).split(' ').filter(Boolean);
    if (v.length < 3) continue;
    const methode = v[0], route = v[1], toets = v.slice(2).join(' ');
    const sleutel = methode + ' ' + route;
    if (!perRoute.has(sleutel)) perRoute.set(sleutel, new Set());
    perRoute.get(sleutel).add(toets);
    if (!perToets.has(toets)) perToets.set(toets, new Set());
    perToets.get(toets).add(sleutel);
  }
  return { perRoute, perToets };
}

/* Welke toetsbestanden zijn INHOUDGEVOELIG volgens de mutatiemotor: een
   servertoets die zakte terwijl alleen zijn eigen domein loog en de deuren open
   bleven. `scherp: 'gezakt'` is precies dat oordeel; 'overleefd' is het
   tegendeel en telt hier als blind. */
function gevoeligheid() {
  let t;
  try { t = JSON.parse(fs.readFileSync(path.join(WORTEL, 'MUTATIES.json'), 'utf8')).toetsen; }
  catch (e) { return null; }
  const gevoelig = new Set(), blind = new Set();
  for (const [naam, v] of Object.entries(t || {})) {
    if (v.soort !== 'server') continue;
    if (v.scherp === 'gezakt') gevoelig.add(naam);
    else if (v.scherp === 'overleefd' || v.staat === 'overleefd') blind.add(naam);
  }
  return { gevoelig, blind };
}

/* HET OORDEEL ALS PURE FUNCTIE, en dat is geen netheid maar noodzaak.

   Toen dit nog binnen meet() zat -- dat een journaalbestand en MUTATIES.json van
   schijf leest -- was het alleen te toetsen door de regel in de toets NA TE
   BOUWEN. Zo'n toets kan per definitie niet zakken als het instrument verandert:
   hij toetst zijn eigen kopie (LAT.md regel 9). De mutatieproef ving dat: de
   toerekening weghalen liet de suite groen.

   Nu neemt hij zijn vier ingangen als argument en is hij zonder schijf, zonder
   server en zonder journaal te beproeven. */
function oordeel(perRoute, perToets, gevoelig, blind) {
  const perRouteUit = {};
  const telling = { bewezen: 0, onbeslist: 0, blind: 0, ongemeten: 0 };
  for (const [route, toetsen] of perRoute) {
    const gevoelige = [...toetsen].filter(t => gevoelig.has(t));
    if (!gevoelige.length) {
      const blinde = [...toetsen].filter(t => blind.has(t));
      const staat = blinde.length ? 'blind' : 'ongemeten';
      perRouteUit[route] = { staat, toetsen: [...toetsen].slice(0, 6),
        reden: blinde.length
          ? 'alleen toetsen die groen bleven terwijl alles loog; die kijken niet naar de inhoud'
          : 'geen enkele toets die deze route raakt is door de mutatiemotor gemeten' };
      telling[staat]++;
      continue;
    }
    /* DE TOEREKENING. Een inhoudgevoelige toets die ook tien andere routes
       raakt, kan op de inhoud van een van die tien zijn gezakt. Alleen als hij
       er precies EEN raakt, valt de gevoeligheid aan deze route toe te
       schrijven. */
    const alleen = gevoelige.filter(t => (perToets.get(t) || new Set()).size === 1);
    if (alleen.length) {
      perRouteUit[route] = { staat: 'bewezen', bron: 'outputproef', toetsen: alleen.slice(0, 6),
        reden: 'deze toets(en) zakken als het antwoord leeg wordt, en raken geen andere route' };
      telling.bewezen++;
    } else {
      const kleinste = Math.min(...gevoelige.map(t => (perToets.get(t) || new Set()).size));
      perRouteUit[route] = { staat: 'onbeslist', toetsen: gevoelige.slice(0, 6),
        reden: 'inhoudgevoelige toetsen raken deze route, maar elk daarvan raakt er meer ' +
          '(de smalste: ' + kleinste + '); de gevoeligheid is niet aan deze route toe te schrijven' };
      telling.onbeslist++;
    }
  }
  return { telling, perRoute: perRouteUit };
}

function meet() {
  const k = koppeling(JOURNAAL);
  if (!k) return { fout: 'geen journaal op ' + JOURNAAL + '; draai de suite met RTG_ROUTELOG' };
  const g = gevoeligheid();
  if (!g) return { fout: 'geen MUTATIES.json; draai npm run mutatie' };
  if (!k.perRoute.size) {
    return { fout: 'het journaal bevat geen TOETS-regels. Die schrijft server/routelog.js ' +
      'sinds de OUTPUT-as bestaat; een journaal van voor die tijd kan deze vraag niet beantwoorden.' };
  }

  const o = oordeel(k.perRoute, k.perToets, g.gevoelig, g.blind);
  const perRoute = o.perRoute;
  const telling = o.telling;

  return { stempel: stempel({ journaal: path.relative(WORTEL, JOURNAAL) }),
    uitleg: 'Per route: kijkt een toets naar de INHOUD van het antwoord. Gemeten door de ' +
      'liegpoort (RTG_LIEG) per toetsbestand te koppelen aan de routes die dat bestand raakt. ' +
      'Alleen een toets die GEEN andere route raakt levert bewijs over DEZE route.',
    grens: 'zegt niets over routes die geen enkele toets raakt, en niets over de vraag of de ' +
      'inhoud KLOPT -- alleen of iemand ernaar kijkt.',
    gemeten: telling, routes: Object.keys(perRoute).length, perRoute };
}

module.exports = { meet, oordeel, koppeling, gevoeligheid };

if (require.main !== module) return;

const uit = meet();
if (uit.fout) { console.error('\n  ' + uit.fout + '\n'); process.exitCode = 2; return; }
if (argv.includes('--json')) { console.log(JSON.stringify(uit, null, 1)); process.exitCode = 0; return; }

fs.writeFileSync(UITSLAG, JSON.stringify(uit, null, 1) + '\n');
console.log('\n=== DE OUTPUT-PROEF ===\n');
console.log('  journaal              : ' + path.relative(WORTEL, JOURNAAL));
console.log('  routes met een toets  : ' + uit.routes);
console.log('');
console.log('  BEWEZEN (een toets zakt op de lege inhoud, en raakt niets anders) : ' + uit.gemeten.bewezen);
console.log('  onbeslist (gevoelige toetsen, maar niet toe te rekenen)          : ' + uit.gemeten.onbeslist);
console.log('  blind (alleen toetsen die niets van de inhoud merken)            : ' + uit.gemeten.blind);
console.log('  ongemeten (geen toets die de mutatiemotor kent)                  : ' + uit.gemeten.ongemeten);
console.log('\n  weggeschreven in OUTPUTPROEF.json\n');
process.exitCode = 0;
