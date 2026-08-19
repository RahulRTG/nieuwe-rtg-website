/* EEN COMMIT VOOR WAT BIJ ELKAAR HOORT.

   WAAROM DIT EEN EIGEN BESTAND IS

   ./index.js stond op 23911 byte, ruim twee keer de 10 kB-grens uit
   keuringsregel 13. De snede is niet nieuw bedacht: scripts/check.js schreef bij
   de uitzondering voor db/index.js al "de save-bundel (bijeen) hoort naast de
   save() die hij bewaakt", en TAKEN.md 4.23 noemt hem met bestandsnaam en al.

   NAAST save() EN NIET ERIN, en dat blijft precies zo. save() zet binnen een
   bundel alleen een vlag; de echte schrijfactie gebeurt hier, aan het eind,
   buiten die context. De doos waarin die vlag staat is het enige dat de twee
   delen. Hij woont hier -- bij de functie die hem opent en sluit -- en save()
   vraagt hem op met bundelDoos(). Andersom (de doos bij save, de bundel hier)
   zou de eigenaar scheiden van de enige plek die hem verzet.

   WAT ER BINNENKOMT. save en saveDuurzaam, allebei uit index.js. Ze worden hier
   niet nagemaakt: dat zou twee schrijfwegen geven waarvan er een het verraad
   (server/lib/verraad.js) niet kent, en juist daar ging het eerder mis.
   ========================================================================== */
'use strict';
const postgres = require('./postgres');

module.exports = ({ save, saveDuurzaam }) => {
  /* EEN COMMIT VOOR WAT BIJ ELKAAR HOORT (bijeen). Gevonden met kill -9 onder
     schrijflast: in de sqlite-stand flusht save() synchroon, en een overdracht
     flusht TWEE keer -- eerst het geld (pasToe), dan pas de idem-sleutel
     (metIdem). Een crash daartussen plus de retry waar idem-sleutels voor
     bestaan, boekte echt dubbel (137 centen). bijeen(fn) stelt de saves uit de
     EIGEN async-context uit (AsyncLocalStorage) en flusht aan het eind een
     keer. Context-gebonden is de veiligheid zelf: wacht fn op echte I/O, dan
     flushen andere verzoeken gewoon meteen (hun 200 blijft waar), en zelf
     hebben we voor de laatste await nog niets gemuteerd -- er bestaat dus geen
     halve toestand die een omstander kan vastleggen. */
  const { AsyncLocalStorage } = require('async_hooks');
  const bijeenContext = new AsyncLocalStorage();
  /* `opties.duurzaam` maakt van de gebundelde commit een DUURZAME: hij gaat via
     saveDuurzaam() en keert pas terug als de opslag heeft bevestigd.

     WAAROM DIT HIER HOORT EN NIET IN DE ROUTE. De bundel is precies wat duurzaam
     moet zijn: boeking en idem-sleutel samen. Zou de route na afloop nog een
     losse saveDuurzaam() doen, dan bestaat er alsnog een moment waarop de een
     vaststaat en de ander niet -- de toestand waar de dubbele boeking van 137
     centen uit voortkwam. Eén bundel, één duurzame commit.

     Alleen de geldcommit zet hem aan; check.js regel 47 bewaakt dat
     saveDuurzaam() niet elders opduikt, en hier is de aanroep bewust de enige
     plek waar een aanroeper er indirect bij kan. */
  /* STAAT ER AL EEN BUNDEL OPEN IN DEZE CONTEXT?

     Nodig sinds er meer dan een app duurzaam vastlegt. Een notitie met een datum
     maakt een agenda-afspraak, en allebei die lagen willen hun werk duurzaam
     wegzetten. Zou de binnenste dat zelf doen, dan committeert de agenda-afspraak
     VOOR de notitie -- twee commits, en een moment waartussen de een vaststaat en
     de ander niet. Precies de toestand waar bijeen() voor is gemaakt.

     Dus vraagt de binnenste laag eerst of er al een bundel loopt; zo ja, dan doet
     hij zijn mutatie gewoon mee in die bundel. Zie server/lib/duurzaam.js. */
  function inBundel() {
    const doos = bijeenContext.getStore();
    return !!(doos && doos.open);
  }

  async function bijeen(fn, opties) {
    const duurzaam = !!(opties && opties.duurzaam);
    const doos = { open: true, nodig: false, duurzaam };
    try { return await bijeenContext.run(doos, fn); }
    finally {
      /* Dicht voordat er geflusht wordt: een timer die binnen fn is gezet erft
         deze context, en zijn latere save() moet ECHT flushen in plaats van een
         vlag zetten waar niemand meer naar kijkt. */
      doos.open = false;
      if (doos.nodig) {
        if (duurzaam) {
          const uit = saveDuurzaam();
          /* DE BUNDEL FAALT ALS HIJ NIET BEVESTIGD KON WORDEN, en alleen daar waar
             bevestigen mogelijk is. Zonder dit gooien meldt saveDuurzaam netjes
             dat het misging en gaat de route toch met 200 verder -- precies de
             valse bevestiging waar deze hele ronde over ging. En met een
             onvoorwaardelijk gooien zou een opslag die niet kan tellen elke
             transactie laten mislukken; dat brak eerder vier geldtoetsen. */
          if (uit.bevestigbaar && !uit.duurzaam) {
            throw new Error('[duurzaam] de commit is niet vastgelegd: ' + uit.reden);
          }
        } else save();
        /* Postgres is write-behind: zonder dit wachten zegt de route "gelukt"
           terwijl het geld nog in een 60ms-timer hangt -- de crashproef mat daar
           echt verlies in. Elders (sqlite synchroon; json/geheugen bewust
           write-behind en in productie geblokkeerd) is dit een no-op. */
        await postgres.flushVoorrangDirect();
      }
    }
  }

  /* save() leest deze doos om te weten of hij mag flushen of alleen een vlag
     mag zetten. Een functie en geen waarde: de doos verandert per aanroep. */
  const bundelDoos = () => bijeenContext.getStore();
  return { bijeen, inBundel, bundelDoos };
};
