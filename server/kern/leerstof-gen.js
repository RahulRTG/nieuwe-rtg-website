/* RTG School, de opgave-generatoren: uit de gen-parameters van een leerdoel
   komt telkens een verse opgave { v (vraag), a (antwoord), opties? }.
   Antwoorden blijven op de server; de client krijgt alleen de vraag.
   Alles puur en zonder toeval-bibliotheken: crypto.randomInt is de dobbelsteen. */
/* De eerste reeks staat in ./leerstof-gen-basis.js, net als de vier andere
   reeksen in hun eigen bestand. Dit bestand voegt ze samen en deelt de opgave
   uit; het maakt er zelf geen een. */
const { GEN, MEERKEUZE_BASIS } = require('./leerstof-gen-basis');


/* De tweede reeks (delen met rest, afronden, tijdsduur, kalender, schaal,
   negatieve getallen, kwadraten, schatten, korting, tabellen, meten en breuken
   vergelijken) woont in ./leerstof-gen-meer.js en komt hier in dezelfde lijst
   terecht. Een generator hoort maar op EEN plek te bestaan, en de beller mag
   niet hoeven weten in welk bestand hij staat. */
const { GEN2, MEERKEUZE2 } = require('./leerstof-gen-meer');
const { GENT, MEERKEUZE_TAAL } = require('./leerstof-gen-taal');
const { GENW, MEERKEUZE_WERELD } = require('./leerstof-gen-wereld');
const { GENVO, MEERKEUZE_VO } = require('./leerstof-gen-vo');
for (const reeks of [GEN2, GENT, GENW, GENVO]) {
  for (const naam of Object.keys(reeks)) {
    if (GEN[naam]) throw new Error('leerstof-gen: de soort "' + naam + '" bestaat twee keer');
    GEN[naam] = reeks[naam];
  }
}

/* Een opgave voor dit leerdoel; onbekende soorten vallen luid om (test bewaakt dekking). */
/* EEN MEERKEUZEVRAAG ZONDER KEUZES KOMT HIER NIET LANGS.

   De fout die dit tegenhoudt is echt gemaakt: `kalender` en `tabel` stonden in
   MEERKEUZE terwijl een van hun drie takken geen opties teruggaf. Twee van de
   drie keer ging het goed, en de derde keer legde de quiz een meerkeuzevraag
   voor zonder iets om te kiezen. Dat is stil fout gaan op de vervelendste
   manier: het valt pas op bij een kind dat er voor staat.

   Een generator met meer takken is precies waar dit gebeurt -- wie een tak
   bijschrijft, denkt aan de vraag en vergeet de opties. Daarom staat de
   controle hier, bij de doorgeefluik, en niet in de hoop dat iedereen eraan
   denkt: een soort die in MEERKEUZE staat MOET opties geven waar het antwoord
   in zit, en anders gooit hij. Liever een luide fout in een toets dan een
   stille bij een leerling. */
function opgave(gen) {
  const maak = GEN[gen.soort];
  if (!maak) throw new Error('onbekende opgave-soort: ' + gen.soort);
  const o = maak(gen);
  if (MEERKEUZE.includes(gen.soort) && !(o && o.opties && o.opties.length > 1 && o.opties.includes(o.a)))
    throw new Error('opgave-soort ' + gen.soort + ' staat in MEERKEUZE maar gaf geen bruikbare opties terug: '
      + JSON.stringify(o && o.v));
  return o;
}

/* WELKE SOORTEN MEERKEUZE ZIJN. De meeste generatoren vragen om een antwoord
   dat je zelf intikt ('7 + 5 =' heeft geen opties); een deel geeft er wel een
   rijtje bij. In de oefensessie maakt dat niets uit -- daar mag je gewoon
   typen -- maar wie deze bibliotheek in een MEERKEUZESPEL gebruikt (het
   Quizduel met schoolvragen, kern/spellen/quiz.js) kan alleen deze soorten
   voorleggen. Een som met een enkele optie is geen vraag maar een knop.

   De lijst staat HIER, bij de generatoren zelf, en niet bij de beller: wie een
   generator schrijft weet of hij opties teruggeeft, en een tweede lijst
   elders loopt daar stil op achter. `test/leerstof.test.js` legt hem naast wat
   de generatoren werkelijk doen, dus een soort die van vorm verandert zonder
   deze lijst bij te werken zakt. */
const MEERKEUZE = MEERKEUZE_BASIS
  .concat(MEERKEUZE2, MEERKEUZE_TAAL, MEERKEUZE_WERELD, MEERKEUZE_VO).sort();

module.exports = { opgave, SOORTEN: Object.keys(GEN), MEERKEUZE };
