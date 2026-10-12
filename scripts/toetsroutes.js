#!/usr/bin/env node
/* ============================================================================
   DE TOETS-ROUTEKAART OVER RONDES (ARCHITECTOPDRACHT.md, fase 3)

   WAT ER AL WAS. test/toetsnaam.js geeft elk toetsproces zijn naam mee,
   server/routelog.js schrijft per toets welk routepatroon hij raakte, en
   scripts/attributie.js en scripts/veranderbereik.js maken daar in CI een
   meting van. Maar die meting verdwijnt na vijf dagen als artefact, en
   ATTRIBUTIE.json bewaart per toets alleen een AANTAL -- welke route bij welke
   toets hoort, staat alleen in het journaal van die ene ronde.

   WAT DIT TOEVOEGT. Een register in de repository (TOETSROUTES.json) dat per
   toets bijhoudt welke routes hij raakte, en in hoeveel van de laatste rondes
   waarin hij DRAAIDE. Een relatie die in een ronde werd gezien is een
   waarneming; pas over meerdere rondes zegt hij iets. En een toets die een
   route een keer niet raakte, bewijst niet dat hij hem nooit raakt.

   WAAROM IN DE REPOSITORY EN NIET ALS ARTEFACT. De Architect leest registers en
   nooit het netwerk (CODE.md, CODE-AI-001 en besluit 3), en een artefact is na
   vijf dagen weg. Dezelfde vorm als TOETSDUUR.json: CI stelt hem samen en zet
   hem klaar, een mens commit hem. Een register dat zichzelf in CI bijwerkt,
   verandert wat de Architect zegt zonder dat iemand het in de historie ziet.

   DRIE STANDEN PER TOETS, uit de laatste ronde, en ze lopen nooit door elkaar:
     waargenomen          draaide en raakte minstens een route
     draaideZonderRoute   draaide en raakte geen route: een EIGENSCHAP (een
                          toets die in het proces blijft), geen nul
     ongemeten            draaide niet in deze ronde, of het is niet vast te
                          stellen wie er draaide: een MEETGAT
   Elke toets die niet `waargenomen` is draagt volleRing: true, net als in
   scripts/attributie.js. Dit register versmalt niets (KEURING.md); dat is
   fase 8, en een besluit.

   Draai:  node scripts/toetsroutes.js --lees <journaal> [--lees ...]
             [--ronde <.toetsduur> ...] [--vorige TOETSROUTES.json]
             [--commit <sha>] [--schrijf]
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { leesRonde, leesJournalen, alleToetsen } = require('./veranderbereik');
const { stempel } = require('./lib/stempel');

const WORTEL = path.join(__dirname, '..');
const REGISTER = path.join(WORTEL, 'TOETSROUTES.json');
const VENSTER = 5;

function gitKort(args) {
  try { return execFileSync('git', args, { cwd: WORTEL, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); }
  catch (e) { return null; }
}

/* Een ronde toevoegen aan het register. Per toets en per relatie een reeks
   tekens over het venster: '1' gezien, '0' niet gezien, '-' draaide niet of
   onbekend. Zo blijft er per ronde informatie over, en schuift het venster
   zonder iets te hoeven aftrekken. */
function voegToe(vorige, ronde) {
  const oud = vorige && Array.isArray(vorige.rondes) ? vorige : { rondes: [], per: {} };
  const rondes = oud.rondes.concat([ronde.meta]);
  const weg = Math.max(0, rondes.length - VENSTER);
  const breedte = rondes.length - weg;
  const schuif = (reeks, nieuw) => ((reeks || '-'.repeat(oud.rondes.length)) + nieuw).slice(weg);
  const per = {};
  const namen = new Set(Object.keys(oud.per || {}).concat(ronde.toetsen));
  for (const t of [...namen].sort()) {
    const was = (oud.per || {})[t] || { draaide: '', kanten: {} };
    const draaide = ronde.gedraaid ? (ronde.gedraaid.has(t) || ronde.perToets.has(t) ? '1' : '0') : (ronde.perToets.has(t) ? '1' : '-');
    const gezien = ronde.perToets.get(t) || new Set();
    const kanten = {};
    for (const k of new Set(Object.keys(was.kanten || {}).concat([...gezien]))) {
      const teken = gezien.has(k) ? '1' : (draaide === '1' ? '0' : '-');
      const r = schuif((was.kanten || {})[k], teken);
      if (r.includes('1')) kanten[k] = r;          // een relatie die in het venster niet meer gezien is, valt af
    }
    const d = schuif(was.draaide, draaide);
    const laatst = d[d.length - 1];
    /* "Draaide zonder route" is alleen een EIGENSCHAP als er in deze ronde geen
       kant zonder eigenaar was: anders kan juist deze toets de eigenaar zijn van
       die regels, en dan is het een meetgat dat zich als eigenschap voordoet. */
    const zonderRouteBewezen = ronde.meta.kantenZonderEigenaar === 0;
    const stand = laatst === '1'
      ? (gezien.size ? 'waargenomen' : (zonderRouteBewezen ? 'draaideZonderRoute' : 'ongemeten'))
      : 'ongemeten';
    per[t] = { stand, volleRing: stand !== 'waargenomen', draaide: d, kanten: Object.fromEntries(Object.entries(kanten).sort()) };
  }
  return { rondes: rondes.slice(weg), breedte, per };
}

function rondeVan(opties) {
  const { perToets, zonderEigenaar, regels } = leesJournalen(opties.journalen);
  const gedraaid = opties.duur && opties.duur.length ? leesRonde(opties.duur) : null;
  const toetsen = alleToetsen();
  return {
    perToets,
    gedraaid,
    toetsen,
    meta: {
      commit: opties.commit || gitKort(['rev-parse', '--short', 'HEAD']),
      op: new Date().toISOString(),
      journaalregels: regels,
      kantenZonderEigenaar: zonderEigenaar,
      toetsenGedraaid: gedraaid ? gedraaid.size : null,
      waarvanGedraaidOnbekend: gedraaid ? null : 'geen duurregister gelezen: wie er niet draaide, is niet te onderscheiden van wie geen route raakte',
    },
  };
}

function maak(opties) {
  const ronde = rondeVan(opties);
  const vorige = opties.vorige && fs.existsSync(opties.vorige) ? JSON.parse(fs.readFileSync(opties.vorige, 'utf8')) : null;
  const { rondes, per } = voegToe(vorige, ronde);
  const telling = { toetsbestanden: Object.keys(per).length, waargenomen: 0, draaideZonderRoute: 0, ongemeten: 0, relaties: 0, relatiesInElkeRonde: 0 };
  for (const t of Object.values(per)) {
    telling[t.stand]++;
    for (const r of Object.values(t.kanten)) {
      telling.relaties++;
      const gedraaid = t.draaide.split('').filter((c, i) => c === '1').length;
      if (gedraaid > 1 && r.split('').filter((c) => c === '1').length === gedraaid) telling.relatiesInElkeRonde++;
    }
  }
  const onbekendeNamen = [...ronde.perToets.keys()].filter((t) => !ronde.toetsen.includes(t)).sort();
  return {
    stempel: stempel(null, { uitvoer: ['TOETSROUTES.json'] }),
    uitleg: 'Per toets welke routes hij raakte, over de laatste ' + VENSTER + ' rondes. Per relatie en per toets een reeks tekens, oudste ronde eerst: 1 gezien of gedraaid, 0 niet gezien of niet gedraaid, - draaide niet of onbekend. Een relatie die een ronde ontbrak, bewijst niet dat de toets de route nooit raakt.',
    grens: 'Dit register versmalt niets. Elke toets die niet waargenomen is draagt volleRing: true, en ook een waargenomen toets mag pas worden overgeslagen als een mutatieproef dat recht heeft verdiend (KEURING.md, ARCHITECTOPDRACHT.md fase 8). Het kent routes en geen bronbestanden: dat is scripts/veranderbereik.js.',
    hoe: 'CI stelt hem samen uit de journalen van een volle ronde en het vorige register; een mens commit hem (zoals TOETSDUUR.json).',
    venster: VENSTER,
    rondes,
    gemeten: Object.assign(telling, { onbekendeNamen }),
    per,
  };
}

/* VERSHEID VAN DIT REGISTER. Het is een waarneming van een ronde op een commit,
   geen meting van de boom -- daarom niet het invoerspoor van fase 2 maar een
   eigen, strengere regel: actueel alleen als sinds de laatste ronde niets is
   veranderd aan wat de relaties bepaalt (de toetsen, de server, de schermen,
   de pakketlijst). Een samenvatting van een vorige ronde komt anders als
   mogelijk-verouderd door, en nooit als actueel. */
const BEPALEND = ['test', 'server', 'public', 'package-lock.json'];
function versheid(register, opties) {
  const o = opties || {};
  const wortel = o.wortel || WORTEL;
  if (!register || !Array.isArray(register.rondes) || !register.rondes.length) {
    return { stand: 'onbekend', reden: 'geen ronde in het register' };
  }
  const c = register.rondes[register.rondes.length - 1].commit;
  if (!c) return { stand: 'onbekend', reden: 'de laatste ronde draagt geen commit' };
  let uit;
  try {
    uit = execFileSync('git', ['diff', '--name-only', c, o.tegen || 'HEAD', '--'].concat(BEPALEND),
      { cwd: wortel, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch (e) { return { stand: 'onbekend', reden: 'de commit van de laatste ronde (' + c + ') is hier niet te vergelijken' }; }
  const gewijzigd = uit.split('\n').filter(Boolean);
  if (gewijzigd.length) {
    return { stand: 'mogelijk-verouderd', reden: gewijzigd.length + ' bestand(en) onder ' + BEPALEND.join(', ') + ' gewijzigd sinds ronde ' + c, geraakt: gewijzigd.slice(0, 20) };
  }
  return { stand: 'actueel', reden: 'geen toets, servercode, scherm of pakket gewijzigd sinds ronde ' + c };
}

function main() {
  const o = { journalen: [], duur: [], vorige: null, commit: null };
  for (let i = 2; i < process.argv.length; i++) {
    const a = process.argv[i];
    if (a === '--lees') o.journalen.push(path.resolve(process.argv[++i]));
    else if (a === '--ronde') o.duur.push(path.resolve(process.argv[++i]));
    else if (a === '--vorige') o.vorige = path.resolve(process.argv[++i]);
    else if (a === '--commit') o.commit = String(process.argv[++i]).slice(0, 9);
  }
  if (!o.journalen.some((p) => fs.existsSync(p))) {
    console.error('\n  Geen enkel journaal gevonden; zonder bron is er geen ronde. Draai de suite met RTG_ROUTELOG gezet.\n');
    return 2;
  }
  const uit = maak(o);
  const g = uit.gemeten;
  console.log('\nTOETSROUTES  (ronde ' + uit.rondes[uit.rondes.length - 1].commit + ', ' + uit.rondes.length + ' van ' + VENSTER + ' rondes in het venster)');
  console.log('  waargenomen         ' + g.waargenomen);
  console.log('  draaide zonder route' + String(g.draaideZonderRoute).padStart(5) + '   (eigenschap, geen nul)');
  console.log('  ongemeten           ' + g.ongemeten + '   (meetgat; volle ring)');
  console.log('  relaties            ' + g.relaties + ', waarvan in elke ronde waarin de toets draaide: ' + g.relatiesInElkeRonde);
  if (process.argv.includes('--schrijf')) {
    fs.writeFileSync(REGISTER, JSON.stringify(uit, null, 1) + '\n');
    console.log('  geschreven: TOETSROUTES.json (een mens commit hem)\n');
  }
  return 0;
}

if (require.main === module) process.exit(main());
module.exports = { voegToe, maak, versheid, VENSTER, BEPALEND };
