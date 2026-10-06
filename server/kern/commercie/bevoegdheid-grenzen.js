/* DE GRENZEN VAN EEN BEVOEGDHEID -- welke er zijn, wanneer een waarde er een
   IS, en hoe twee grenzensets samen nooit ruimer worden dan de engste.

   Afgesplitst uit ./bevoegdheid.js (die exporteert alles hieruit ongewijzigd
   door), omdat de keuring erbij kwam: een grens die geen getal is, mag nooit
   als "geen grens" worden gelezen. Zie test/versmallingswetten.test.js. */
'use strict';

/* De grenzen die een bevoegdheid kan dragen. Elke grens heeft een `krimp`:
   hoe je twee waarden combineert zodat delegatie altijd versmalt. Voor een
   bedrag is dat het minimum; voor een vinkje "alleen eigen vestiging" is
   aanzetten juist een versmalling, dus daar is het een OF. */
const GRENZEN = {
  maxCenten: { soort: 'getal', krimp: (a, b) => Math.min(a, b),
    uitleg: 'het hoogste bedrag per handeling' },
  maxPerDagCenten: { soort: 'getal', krimp: (a, b) => Math.min(a, b),
    uitleg: 'het hoogste bedrag per dag, over alle handelingen samen' },
  maxAantalPerDag: { soort: 'getal', krimp: (a, b) => Math.min(a, b),
    uitleg: 'het hoogste aantal handelingen per dag' },
  alleenEigenVestiging: { soort: 'vlag', krimp: (a, b) => a || b,
    uitleg: 'alleen op de eigen vestiging; aanzetten versmalt' },
  apparaatVertrouwd: { soort: 'vlag', krimp: (a, b) => a || b,
    uitleg: 'alleen vanaf een vertrouwd apparaat; aanzetten versmalt' },
  omkeerbaarVerplicht: { soort: 'vlag', krimp: (a, b) => a || b,
    uitleg: 'alleen als de handeling terug te draaien is' }
};

/* Is deze waarde een geldige grens? Een getal-grens is een eindig, niet-negatief
   geheel getal (centen of een aantal); een vlag is waar of onwaar.

   Dit staat hier omdat een grens die geen getal IS, anders als "geen grens"
   werd gelezen: `Math.min(1000, 'veel')` is NaN, `past()` zag NaN niet als
   eindig en liet daarna elk bedrag door. Een delegatie die versmallen moest,
   maakte zo van een bevoegdheid tot tien euro er een zonder bovengrens. Een
   onleesbare grens is ONBEKEND, en onbekend is nooit ruimer dan bekend. */
function grensGeldig(naam, waarde) {
  const g = GRENZEN[naam];
  if (!g) return true;                      // onbekende namen worden overgeslagen, niet gekeurd
  if (g.soort === 'getal') return Number.isSafeInteger(waarde) && waarde >= 0;
  return typeof waarde === 'boolean';
}

/* De ongeldige grenzen in een set, als zinnen. Leeg = alles in orde. */
function keurGrenzen(grenzen) {
  const fout = [];
  for (const [naam, waarde] of Object.entries(grenzen || {})) {
    if (!grensGeldig(naam, waarde)) {
      fout.push(naam + ' moet ' + (GRENZEN[naam].soort === 'getal'
        ? 'een geheel, niet-negatief getal zijn' : 'waar of onwaar zijn') + ' (gekregen: ' +
        JSON.stringify(waarde) + ')');
    }
  }
  return fout;
}

/* Twee grenzensets combineren tot de engste van de twee. Een grens die de ene
   kant NIET stelt, telt niet als "onbeperkt" maar wordt overgenomen van de
   ander -- anders zou een delegatie die een grens vergeet, hem opheffen. Dat is
   precies de fout die deze functie moet uitsluiten.

   En een ONGELDIGE waarde aan de versmallende kant wordt nooit overgenomen: de
   basis blijft staan. Aanroepers die een fout willen melden in plaats van hem
   te negeren, keuren eerst met `keurGrenzen` (delegeer en munt doen dat). Deze
   functie zelf mag nooit iets ruimer maken, ook niet bij rommel. */
function versmal(basis, extra) {
  const uit = { ...(basis || {}) };
  for (const [naam, waarde] of Object.entries(extra || {})) {
    const g = GRENZEN[naam];
    if (!g) continue;                       // een onbekende grens verruimt niets
    if (!grensGeldig(naam, waarde)) continue; // een onleesbare grens verruimt ook niets
    uit[naam] = (naam in uit) ? g.krimp(uit[naam], waarde) : waarde;
  }
  return uit;
}

module.exports = { GRENZEN, grensGeldig, keurGrenzen, versmal };
