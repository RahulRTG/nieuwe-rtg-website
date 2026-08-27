/* DE REKENKERN ONDER DE VIER ONTWERPBANKEN -- op EEN plek.

   Vier domeinen laten een lid iets ontwerpen: het architectenbureau, het
   atelier, het hardwarelab en de ontwerpstudio. Elk heeft een `bank.js` met
   zijn eigen catalogus, en elk had daarin dezelfde drie hulpfuncties staan:

     hash   een stabiel getal uit een tekst (FNV-1a), zodat dezelfde opdracht
            altijd hetzelfde concept oplevert -- geen Math.random, want een
            ontwerp dat bij elke verversing verandert is geen ontwerp.
     kies   n verschillende leden uit een lijst, gestuurd door dat getal.
     palet  hetzelfde, maar dan met de kleurnaam en de hex erbij.

   BYTE VOOR BYTE DEZELFDE UITVOERING, VIER KEER. Dat is niet gevonden door
   ernaar te zoeken maar door twee onafhankelijke metingen die naar dezelfde
   vier domeinen wezen: OBJECTMODEL.json via gedeelde vormen en SEMANTIEK.json
   via gedeelde namen. Het handwerk daarna (BEWIJSMACHINE.md par. 3) scheidde
   wat werkelijk hetzelfde is van wat alleen zo heet -- en dat onderscheid is
   hier de hele reden dat dit bestand klein is:

     hash, kies, palet     een uitvoering in vier kopieen  ->  hierheen
     maakConcept           vier verschillende sjablonen    ->  blijft staan
     PALET                 vier paletten, 2 van de 16 tinten gedeeld -> blijft
     STATUS                drie varianten met een reden    ->  blijft staan

   Samenvoegen wat toevallig hetzelfde heet, is precies de fout die PLATFORM.md
   met Cercle en Entourage al een keer heeft voorkomen. Daarom staat hier alleen
   het derde soort: dezelfde vraag, hetzelfde antwoord, vier keer overgetypt.

   HET PALET BLIJFT VAN HET DOMEIN. paletUit() krijgt het palet mee in plaats
   van het te kennen; een architect en een couturier hebben allebei een gedempt
   palet en delen er twee tinten van de zestien. Een gedeelde kleurenlijst zou
   precies weghalen wat de vier onderscheidt. */
'use strict';

/* FNV-1a over de tekenreeks, als niet-negatief 32-bits getal. */
function hash(s) {
  let h = 2166136261;
  s = String(s);
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/* n verschillende leden uit arr, deterministisch vanaf seed. De stap is de
   gulden-snede-constante van Knuth; s en de stap zijn positief, dus idx is dat
   ook. Loopt de lijst leeg voordat n gehaald is, dan stopt hij op arr.length. */
function kies(arr, seed, n) {
  const out = [];
  const used = new Set();
  const s = (seed >>> 0);
  for (let i = 0; out.length < Math.min(n, arr.length); i++) {
    const idx = (s + i * 2654435761) % arr.length;
    if (!used.has(idx)) { used.add(idx); out.push(arr[idx]); }
  }
  return out;
}

/* n kleuren uit HET PALET VAN DIT DOMEIN, met hun naam en hex. */
function paletUit(palet, seed, n) {
  const namen = Object.keys(palet || {});
  return kies(namen, seed, n).map(nm => ({ naam: nm, hex: palet[nm] }));
}

module.exports = { hash, kies, paletUit };
