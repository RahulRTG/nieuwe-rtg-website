/* DE VINGERAFDRUK VAN DE INVOER.

   Dit is de ene helft van server/lib/bronkas.js: WAT gaat er in een berekening,
   en hoe herken je dat er iets aan veranderd is. De andere helft -- waar de
   uitkomst blijft en hoe je weet dat hij gaaf is -- staat daar.

   De sleutel is een sha256 over de INHOUD van elk bestand dat meegaat, en niet
   over mtime of grootte. Gemeten: alle 3202 bestanden lezen kost 47 ms, lezen
   en hashen 112 ms, terwijl het parsen dat ermee wordt overgeslagen 1,3 seconde
   kost. De snelle weg die bouwsystemen nemen -- stat'en en de hash van een
   eerdere ronde vertrouwen -- zou die 112 ms tot 27 terugbrengen. Dat is
   bewust NIET gedaan: het kost de enige eigenschap waar je bij een cache iets
   aan hebt, namelijk dat hij niet kan liegen, en een van de afnemers is een
   veiligheidsregister. test/bronkas.test.js zet daarom bij het wijzigen van een
   byte de mtime met opzet terug.

   EEN MANIFEST, MEERDERE AFNEMERS: de boom wordt een keer per proces afgelopen
   en gehasht, en dat onthouden is PER PROCES met opzet. Binnen een draaiende
   server hoort de broncodestand van de START te gelden en niet die van
   halverwege. */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const OVERSLAAN = new Set(['node_modules', '.git', 'dist', 'data', 'coverage']);

/* Alle bestanden onder een map die aan het filter voldoen, gesorteerd. Sorteren
   is geen netheid maar een voorwaarde: readdir geeft geen gegarandeerde
   volgorde, en een sleutel die van de volgorde afhangt is bij elke start anders.
   Dan heb je een cache die nooit raak is en wel elke keer geld kost. */
function bestandenOnder(map, filter, uit) {
  uit = uit || [];
  let items;
  try { items = fs.readdirSync(map, { withFileTypes: true }); } catch (e) { return uit; }
  for (const item of items) {
    if (OVERSLAAN.has(item.name)) continue;
    const p = path.join(map, item.name);
    if (item.isDirectory()) bestandenOnder(p, filter, uit);
    else if (!filter || filter(p)) uit.push(p);
  }
  return uit;
}

/* Het manifest: pad -> sha256 van de inhoud, EEN keer per proces per map.
   Meerdere afnemers over dezelfde map delen dit dus. */
const manifesten = new Map();

/* HET GEHEUGEN IS PER PROCES, EN DAT IS NIET ALTIJD WAT JE WILT.

   Voor een draaiende server is het precies goed: de broncodestand van de START
   hoort te gelden en niet die van halverwege. Maar er is een afnemer met een
   ander patroon, en die brak er meteen op. De meterijking verandert de bron met
   OPZET -- ze legt een bekend-fout bestand neer -- en meet daarna opnieuw, in
   HETZELFDE proces. Met een onthouden manifest is de sleutel dan onveranderd,
   dus komt de oude uitslag uit de kas en beweegt de meter niet.

   Gemeten toen ik dat deed: een verse boom gaf 143 wortels, daarna een bestand
   met een nieuwe wortel erbij, en de tweede telling gaf in 3 milliseconden
   opnieuw 143. De ijking zou daarop zakken (dat is de bedoeling), maar een
   census die stil achterloopt is precies wat deze hele kas niet mag doen.

   Vandaar `vers`: wie weet dat de bron onder hem kan veranderen, vraagt om een
   nieuwe lezing. De kosten zijn ongeveer 110 ms voor 2200 bestanden -- lezen en
   hashen is goedkoop, dat was de hele aanleiding. */
function manifestVan(map, filter, merk, opties) {
  const sleutel = path.resolve(map) + '|' + (merk || '');
  if (opties && opties.vers) manifesten.delete(sleutel);
  if (manifesten.has(sleutel)) return manifesten.get(sleutel);
  const uit = new Map();
  for (const p of bestandenOnder(map, filter).sort()) {
    try { uit.set(p, crypto.createHash('sha256').update(fs.readFileSync(p)).digest()); }
    catch (e) { /* net verdwenen: telt als afwezig, en dat verandert de sleutel */ }
  }
  manifesten.set(sleutel, uit);
  return uit;
}

/* De sleutel over een verzameling manifesten, plus wat de afnemer zelf als
   versie meegeeft. Die VERSIE is niet optioneel: verandert de scanner van
   gedrag zonder dat de bronbestanden veranderen, dan zou de oude uitkomst nog
   passen bij de nieuwe sleutel. Vandaar dat elke afnemer de eigen broncode
   meehasht -- zie leesVersie(). */
function sleutelUit(delen) {
  const h = crypto.createHash('sha256');
  for (const deel of delen) {
    if (deel instanceof Map) {
      for (const [p, sha] of deel) { h.update(p); h.update(sha); }
    } else h.update(String(deel));
  }
  return h.digest('hex');
}

/* De eigen broncode van een afnemer meehashen. Zonder dit blijft een oude
   uitkomst geldig nadat de scanner zelf is veranderd -- de invoer is immers
   hetzelfde -- en dan meet je met een nieuwe scanner een oud antwoord. */
function leesVersie(bestanden) {
  const h = crypto.createHash('sha256');
  for (const b of [].concat(bestanden)) {
    try { h.update(fs.readFileSync(b)); } catch (e) { h.update('?'); }
  }
  return h.digest('hex').slice(0, 16);
}


module.exports = { manifestVan, sleutelUit, leesVersie, bestandenOnder };
