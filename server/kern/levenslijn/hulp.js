/* Levenslijn, deelbestand "hulp": het gereedschap dat de andere delen delen.

   Apart bestand om dezelfde reden als levensgraaf/hulp.js en
   geldgraaf/hulp.js: fasen.js, aanwijzingen.js en index.js hebben alle drie
   dezelfde datumrekenarij nodig, en drie eigen versies van "welk jaar is dit"
   lopen stil uiteen (LAT.md regel 4). Bij een levenslijn zou dat extra stil
   gebeuren: een fase die een jaar verschuift ziet er niet kapot uit, hij ziet
   er alleen anders uit dan de vorige keer.

   De datumkeuring komt uit levensgraaf/hulp.js en staat hier NIET nog een
   keer; de les dat '2027-13-45' door een regex heen komt is daar al geleerd. */
'use strict';

const { isDatum } = require('../levensgraaf/hulp');

const vandaag = () => new Date().toISOString().slice(0, 10);
const huidigJaar = () => Number(vandaag().slice(0, 4));

/* Van een tijdstip (ms of ISO) naar een ISO-dag. Null bij rommel, want een
   halve datum is gevaarlijker dan geen datum: hij komt wel op de lijn te
   staan, alleen op de verkeerde plek. */
function dagVan(t) {
  if (t == null || t === '') return null;
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) return null;
  const dag = d.toISOString().slice(0, 10);
  return isDatum(dag) ? dag : null;
}

/* Het jaartal achter een tijdstip. Alleen een JAAR, en dat is geen
   slordigheid maar de bedoeling: een levenslijn hoort te tonen dat iemand in
   2014 aan een studie begon, niet op welke dag. Wat de lijn niet nodig heeft,
   hoort hij niet te dragen -- dezelfde regel als in levensgraaf/bronnen-basis
   over het paspoortnummer. */
function jaarVan(t) {
  const dag = dagVan(t);
  return dag ? Number(dag.slice(0, 4)) : null;
}

/* Een jaartal dat een MENSENLEVEN kan dragen, of null.

   Twee vallen zitten hierin, en beide zijn hier ingelopen voordat deze functie
   bestond. De eerste: `Number(null)` is 0, en 0 is finite -- een bron die
   netjes null teruggeeft leverde daarmee "geboortejaar 0", en dat kwam als
   een gewone aanwijzing de lijn op. De tweede: 1970 uit een epoch-nul die
   ergens door een new Date() glipt. Allebei lezen ze als een feit, en een
   verzonnen jaartal op een levenslijn is precies de bewering die LEVEN.md
   par. 2.7 verbiedt.

   Staat hier een keer, en wordt zowel door `aanwijzing()` hieronder als door
   de bronnen zelf gebruikt: twee eigen ondergrenzen zouden stil uiteenlopen
   (LAT.md regel 4). */
function geldigJaar(v) {
  const j = Number(v);
  if (!Number.isInteger(j)) return null;
  return j >= 1900 && j <= huidigJaar() + 60 ? j : null;
}

/* DE ENIGE PLEK WAAR EEN AANWIJZING ONTSTAAT. Overal dezelfde vorm, en dus
   een plek waar die vorm wordt afgedwongen -- zoals `feit()` dat doet in
   geldgraaf/hulp.js.

   `wat` is geen sierveld. LEVEN.md par. 2.10 eist dat elke bewering met de
   gebruikte gegevens erbij komt, en dit is die regel: hij eindigt letterlijk
   in `gegevens[]` van de fase. Een aanwijzing zonder `wat` is een bewering
   zonder bron, en die hoort hier niet doorheen te komen.

   Er zijn maar TWEE staten die een bron mag afgeven: 'geweest' en 'nu'. Niet
   'komt' -- dat leidt index.js zelf af uit een jaartal dat nog moet komen --
   en zeker niet 'nvt': het ontbreken van een aanwijzing IS 'nvt', en een bron
   die dat zelf mag zeggen zou over andermans leven oordelen. */
function aanwijzing(o) {
  const staat = o.staat === 'nu' ? 'nu' : 'geweest';
  return {
    fase: String(o.fase || ''),
    staat,
    vanaf: geldigJaar(o.vanaf),
    sinds: dagVan(o.sinds),
    bron: String(o.bron || ''),
    wat: String(o.wat == null ? '' : o.wat).slice(0, 160)
  };
}

/* Een bron die stukgaat mag de andere niet meenemen en mag ook niet stil
   verdwijnen -- het patroon van kern/geldwereld.js `bron()`.

   Hier weegt de stilte anders dan bij geld. Een geldbeeld zonder een bron
   LIJKT gezond; een levenslijn zonder een bron lijkt LEEG, en een lege lijn
   leest als "er speelt niets in dit leven". Dat is de ergste onwaarheid die
   dit scherm kan vertellen, dus staat de naam van de stille bron in stil[] en
   hoort het scherm hem te tonen. */
function bron(naam, fn, uit, stil) {
  try { for (const s of fn() || []) uit.push(s); }
  catch (e) { if (!stil.includes(naam)) stil.push(naam); }
}

module.exports = { vandaag, huidigJaar, dagVan, jaarVan, geldigJaar, aanwijzing, bron };
