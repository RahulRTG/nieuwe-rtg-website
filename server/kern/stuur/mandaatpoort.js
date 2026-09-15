/* DE MANDAATPOORT -- geen zelfstandige mutatie zonder aantoonbaar gezag.

   DE REGEL, en hij is breder dan Rahul: een muterend effect dat vanuit een
   intentie ontstaat, passeert de autoriteitslaag of het gebeurt niet. Daarom
   hangt deze poort aan stuurRoep (../stuur.js) en niet in de AI-lus: dat is het
   choke point met vier aanroepers -- de lus van Rahul, de bevestiging van een
   voorstel, de leveranciersroute en de directe route. Een poort in de lus zou
   een eigenschap van Rahul zijn; hier is het een eigenschap van de
   uitvoeringsgrens, en een stem-, agent- of automatiseringsingang die later
   langs stuurRoep komt, erft hem zonder dat iemand eraan denkt.

   WAT HIJ NIET DOET, en dat is de helft van zijn waarde:

     lezen      geen mutatie, geen poort. Elke leesactie door een
                autoriteitscontrole duwen raakt elk scherm voor de kleinste
                risicoreductie -- dezelfde afweging als de afdwingladder in
                KANTOORMACHT.md.
     verboden   al geweigerd door het beleid; hier valt niets meer te beslissen.
     voorstel   al 428, tenzij een MENS het heeft bevestigd. En dan is die
                bevestiging het gezag: een mandaat is voor wat de machine
                ZELFSTANDIG doet, nooit voor wat een mens zojuist goedkeurde.
                Zou deze poort daar ook bijten, dan blokkeert hij de ja-knop
                van het lid zelf, en dan is de grens onzin.

   ER BLIJFT DUS EEN NIVEAU OVER: `klein`. Dat is precies het gat dat
   KETENBEREIK.json blootlegde -- een kleine, omkeerbare handeling voert
   vandaag uit met niets tussen de allowlist en het effect.

   HET MANDAAT KOMT NOOIT UIT DE MODELINVOER. Hij wordt door de aanroeper
   MEEGEGEVEN uit servergegevens; `t.input` van een gereedschapsaanroep raakt
   hem nergens. Kon het model zijn eigen mandaat aanleveren, dan was de poort
   een formaliteit die zichzelf goedkeurt.

   EN HIJ STAAT IN DE SCHADUW. CONTROLPLANE.md: je kunt niet afdwingen wat nooit
   heeft meegelopen. Standaard TELT hij en houdt hij niets tegen; pas met
   RTG_MANDAAT_AFDWINGEN=1 weigert hij echt. Wat hij zou hebben gesloten, is
   daarmee een getal in plaats van een gevoel -- zelfde vorm als de
   herkomstpoort in ./lusstap-herkomst.js. */
'use strict';

const { beleidVoor, NIVEAUS } = require('./beleid');
const { magZelfstandig } = require('./mandaat');

const AFDWINGEN = () => process.env.RTG_MANDAAT_AFDWINGEN === '1';

/* Tellers en geen journaal: de vraag is hoeveel zelfstandige mutaties er langs
   deze grens komen en hoeveel er zouden sluiten, niet wie wat deed. Er is
   structureel geen veld waar een mens in past. */
const schaduw = { gewogen: 0, zouSluiten: 0, doorgelaten: 0, paden: [] };

function noteer(pad, sluit) {
  schaduw.gewogen++;
  if (sluit) schaduw.zouSluiten++; else schaduw.doorgelaten++;
  if (sluit && schaduw.paden.length < 40 && !schaduw.paden.includes(pad)) schaduw.paden.push(pad);
}

/* DRIE UITKOMSTEN EN NIET TWEE. `nvt` is met opzet geen `mag: true`: "deze poort
   gaat hier niet over" en "deze poort liet het toe" zijn verschillende
   uitspraken, en wie ze samenvoegt kan achteraf niet zien of de grens werkelijk
   ergens heeft gewogen. Dezelfde reden als ONBEKEND naast WEIGEREN in
   CONTROLPLANE.md. */
function beoordeel(pad, wereld, opties) {
  const o = opties || {};
  const niveau = beleidVoor(pad, wereld).niveau;

  if (niveau !== NIVEAUS.klein)
    return { soort: 'nvt', mag: true, niveau,
      reden: niveau === NIVEAUS.lezen ? 'een leesactie muteert niets; hier gaat deze poort niet over'
        : niveau === NIVEAUS.verboden ? 'het beleid weigerde dit al; deze poort voegt niets toe'
        : 'dit niveau vraagt een menselijke bevestiging, en die bevestiging IS het gezag' };

  if (o.menselijkBevestigd)
    return { soort: 'nvt', mag: true, niveau,
      reden: 'een mens heeft dit zojuist bevestigd; een mandaat is voor wat de machine zelfstandig doet' };

  const uitkomst = magZelfstandig(pad, wereld, o.mandaat, o.mandaatContext || {});
  noteer(pad, !uitkomst.mag);
  if (uitkomst.mag)
    return { soort: 'toegestaan', mag: true, niveau, reden: uitkomst.reden };

  /* AFDWINGEN OF MEELOPEN, en de uitslag zegt zelf welke van de twee. Een
     schaduwronde die eruitziet als een weigering zou het register vergiftigen. */
  return { soort: 'geweigerd', mag: !AFDWINGEN(), afgedwongen: AFDWINGEN(), niveau,
    reden: uitkomst.reden,
    uitleg: AFDWINGEN()
      ? 'Deze handeling verandert iets en is niet door een mens bevestigd, en er is geen mandaat dat haar dekt.'
      : 'MEELOPEND: dit zou zijn geweigerd, maar RTG_MANDAAT_AFDWINGEN staat uit, dus de handeling gaat door.' };
}

function stand() { return Object.assign({}, schaduw, { paden: schaduw.paden.slice(), afdwingen: AFDWINGEN() }); }
function nulstel() { schaduw.gewogen = 0; schaduw.zouSluiten = 0; schaduw.doorgelaten = 0; schaduw.paden.length = 0; }

module.exports = { beoordeel, stand, nulstel, AFDWINGEN };
