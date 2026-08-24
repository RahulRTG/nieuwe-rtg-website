/* DE COMPILATIEKAS -- dezelfde modules, maar niet elke keer opnieuw ontleden.

   Een serverstart kost hier ongeveer twee seconden, en GEMETEN met een
   CPU-profiel gaat daar 1374 ms van naar het laden van modules: ontleden en
   compileren van ruim vijftienhonderd JS-bestanden. Zaaien kostte 566 ms,
   scrypt 115, de capability-kas 450. Het grootste stuk is dus werk dat bij elke
   start woordelijk hetzelfde is.

   Node kan die compilatie bewaren (module.enableCompileCache, sinds v22.1). De
   kas is gesleuteld op de INHOUD van elk bestand plus de V8-versie, dus een
   gewijzigde regel of een andere node compileert gewoon opnieuw -- er is geen
   manier waarop dit oude code kan laten draaien.

   WAT HET OPLEVERT, gemeten op een gegoten datamap, drie starts per stand:

     zonder kas    2134 / 1991 / 2038 ms   (gemiddeld 2054)
     kas warm      1880 / 1815 / 1900 ms   (gemiddeld 1865)

   189 ms per start, oftewel 9%. Dat is geen spectaculair getal en het staat er
   met opzet zo eerlijk bij: een eerdere meting op een KLEIN stuk code gaf 87 ms
   tegen 83 ms en daar is toen "geen winst" uit geconcludeerd. Dat was juist voor
   dat stuk en fout voor de hele boot. Een winst van 9% op 833 serverstarts is
   ruim twee en een halve minuut rekenwerk per ronde.

   WAAROM DIT NOOIT IETS KAN BREKEN. Mislukt het aanzetten -- een oude node, een
   volle schijf, een kas die van iemand anders is -- dan gebeurt er niets en
   compileert node zoals altijd. Er is geen tweede pad: dezelfde modules, dezelfde
   volgorde, alleen de ontleedstap komt uit een bestand. Daarom staat dit ook
   gewoon AAN in productie: een herstart is daar geen testdetail. */
'use strict';
const os = require('os');
const path = require('path');

/* In os.tmpdir(), net als de bronkas: niet in de repository (het is geen bron)
   en niet in RTG_DATA_DIR (het is geen data van een installatie). Zo raakt hij
   ook nooit in een reservekopie of een container-image verzeild. */
function kasMap() {
  return process.env.RTG_COMPILEKAS || path.join(os.tmpdir(), 'rtg-compilekas');
}

let uitkomst = null;
function aan() {
  if (uitkomst) return uitkomst;
  if (process.env.RTG_COMPILEKAS_UIT === '1') return (uitkomst = { status: 'uit', reden: 'RTG_COMPILEKAS_UIT=1' });
  let mod;
  try { mod = require('module'); } catch (e) { return (uitkomst = { status: 'geen', reden: e.message }); }
  if (typeof mod.enableCompileCache !== 'function')
    return (uitkomst = { status: 'geen', reden: 'deze node kent enableCompileCache niet (' + process.versions.node + ')' });
  /* Node geeft een getal terug, geen woord. Zonder deze vertaling staat er
     `status: 1` in een logregel en moet de lezer de node-broncode erbij pakken
     om te weten of dat goed of slecht nieuws is. */
  const WOORD = { 0: 'mislukt', 1: 'aan', 2: 'stond al aan', 3: 'uitgezet' };
  try {
    const r = mod.enableCompileCache(kasMap()) || {};
    const woord = WOORD[r.status] || ('onbekend(' + r.status + ')');
    return (uitkomst = { status: woord, map: kasMap(), reden: r.message || undefined });
  } catch (e) {
    return (uitkomst = { status: 'geen', reden: e.message });
  }
}

module.exports = { aan, kasMap };

/* Als voorlader gebruikt (node --require .../compilekas.js) meteen aanzetten. */
if (require.main !== module) aan();
