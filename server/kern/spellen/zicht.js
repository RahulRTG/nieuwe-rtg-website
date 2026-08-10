/* Spellen (deelmodule): HET ZICHT -- wie ziet wat van een lopend potje.

   Hiervoor waren er twee weergaven en een vlag: `view(p, st, mij)` voor een
   speler, DEZELFDE functie met `mij = null` voor een kijker, en `kijken: true`
   in de descriptor om te zeggen dat dat tweede veilig was.

   Die vlag was een BEWERING, en niemand heeft hem nagemeten. Hij klopte drie
   keer niet:

   1. 30 SECONDEN verbergt de kaart voor de RADER door naar zijn spelersindex
      te kijken. Een kijker heeft geen index, dus `indexOf(null)` geeft -1 en
      dat is nooit gelijk aan de rader: de kijker zag de kaart JUIST WEL. Dat
      was bekend en daarom stond `kijken` daar uit -- met als gevolg dat het
      spel dat het meest om een gedeeld scherm vraagt als enige niet op een
      gedeeld scherm kon.
   2. REACTIEDUEL las `st.tijden[mij].length`, en
   3. SCHATDUEL las `st.antwoorden[mij].length`.
      Voor `mij = null` is dat `undefined.length`, dus meekijken bij die twee
      GOOIDE en de route maakte er een 500 van. Allebei stonden ze op
      `kijken: true`. Geen enkele toets riep `spelKijk` op die twee aan, dus de
      catalogustoets ("vijftien spellen mogen bekeken worden") bevestigde
      vrolijk een vlag die in de praktijk crashte.

   Vandaar DRIE LAGEN in plaats van een vlag, elk met een eigen vraag:

     speler(p, st, mij)   wat een deelnemer mag zien, inclusief zijn hand
     kijker(p, st)        wat een vriend die meekijkt mag zien
     publiek(p, st)       wat op een GEDEELD SCHERM mag staan

   Ontbreekt `kijker`, dan is het spel niet te bekijken. Ontbreekt `publiek`,
   dan is het niet te projecteren. Allebei standaard uit, om dezelfde reden als
   waarom `kijken` dat was: de gevaarlijke stand hoort de stand te zijn die je
   expliciet moet aanzetten.

   ZONDER_SPELER BESTAAT OMDAT VIJFTIEN SPELLEN HET WEL KUNNEN. Voor de meeste
   spellen is de kijkweergave echt de spelerweergave zonder speler: alles wat
   aan een persoon hangt (je hand, je rek, je vraag) valt vanzelf weg. Daar
   vijftien bijna-identieke `kijker`-functies naast zetten zou ze laten
   uiteenlopen -- precies wat partij.js hiervoor terecht vermeed.

   Het verschil met de oude vlag is dat dit geen vrijbrief meer is maar een
   CLAIM MET EEN TOETS. `lekken()` hieronder rekent hem na, en
   test/spelkijken.test.js draait hem over ELK spel dat ZONDER_SPELER gebruikt.
   Was die controle er geweest, dan waren de drie fouten hierboven bij het
   opschrijven gevonden in plaats van bij het uitwerken van een ander onderwerp.

   WAT `lekken()` WEL EN NIET ZIET, want dat scheelt. Hij vindt de
   STRUCTURELE lekkage: een veld dat de spelerweergave voor minstens EEN speler
   verbergt en aan een kijker wel toont. Dat is precies de vorm van alle drie de
   fouten. Hij ziet NIET dat een veld voor iedereen aanwezig is maar voor een
   kijker andere INHOUD heeft -- dat kan geen enkele generieke controle zien
   zonder de spelregels te kennen, en een spel dat dat doet hoort een eigen
   `kijker` te schrijven. */

/* De claim: "mijn spelerweergave is zonder speler veilig als kijkweergave".
   Een Symbol en geen `true`, zodat hij niet per ongeluk uit een JSON-waarde of
   een vergelijking kan ontstaan -- dit hoort een bewuste verwijzing te zijn. */
const ZONDER_SPELER = Symbol('zicht.kijker: de spelerweergave zonder speler');

const aanwezig = (v) => v !== null && v !== undefined;

/* Welke velden lekt deze spelerweergave naar een kijker? Leeg is goed.

   Aangeroepen op een LOPEND potje, want een weergave die niets toont bewijst
   niets: de toets speelt eerst een zet zodat er iets te verbergen valt. */
function lekken(speler, potje, staat) {
  let kijker;
  try { kijker = speler(potje, staat, null); }
  catch (e) { return ['<gooit: ' + e.message + '>']; }
  if (!kijker || typeof kijker !== 'object') return [];
  const uit = [];
  for (const veld of Object.keys(kijker)) {
    if (!aanwezig(kijker[veld])) continue;
    // verbergt dezelfde weergave dit veld voor minstens EEN echte speler?
    const verborgenVoorIemand = potje.spelers.some((sp) => {
      try { return !aanwezig(speler(potje, staat, sp)[veld]); }
      catch (e) { return false; }
    });
    if (verborgenVoorIemand) uit.push(veld);
  }
  return uit;
}

/* De drie lagen van een spel, klaar voor gebruik. `kijker` is hier al opgelost:
   de aanroeper vraagt niet meer of het een sentinel of een functie was.

   `zonderSpeler` blijft wel zichtbaar, en niet voor de partijlaag -- die heeft
   er niets aan. Het staat er voor de TOETS: alleen een spel dat de claim doet
   hoort erop nagerekend te worden, en een spel met een eigen kijkweergave zou
   op `speler(p, st, null)` juist kunnen crashen (zo werd het bij Reactieduel en
   Schatduel gevonden). Zonder dit veld zou de toets moeten raden welke van de
   twee hij voor zich heeft. */
function bouw(sleutel, zicht) {
  const speler = zicht.speler;
  const zonderSpeler = zicht.kijker === ZONDER_SPELER;
  const kijker = zonderSpeler
    ? (p, st) => speler(p, st, null)
    : (typeof zicht.kijker === 'function' ? zicht.kijker : null);
  return { speler, kijker, publiek: typeof zicht.publiek === 'function' ? zicht.publiek : null, zonderSpeler };
}

module.exports = { ZONDER_SPELER, lekken, bouw };
