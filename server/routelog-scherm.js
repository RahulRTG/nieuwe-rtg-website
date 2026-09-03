/* WELK SCHERM IS BEZOCHT -- en was het een bezoek of een voorophaling.

   Los van ./routelog.js omdat het een andere vraag beantwoordt. Dat bestand
   noteert welk ROUTEPATROON is geraakt; dit noteert welke PAGINA een mens (of
   een toets) heeft geopend, en dat is niet dezelfde meting: een pagina komt
   langs de statische laag en niet bij de routematcher, en de vraag "was dit
   werkelijk een bezoek" bestaat aan de routekant helemaal niet.

   Ze schuiven ook om hun eigen reden: de routekant als de router verandert, deze
   kant als een browser zich anders gedraagt. Samen gingen ze over de 10 kB van
   keuringsregel 13, en dat is hier geen toeval maar het teken dat er twee
   onderwerpen in zaten.

   Het journaal is hetzelfde bestand en dezelfde ontdubbeling; alleen de vraag
   verschilt. Vandaar dat `noteer` wordt meegegeven en niet nagebouwd. */
'use strict';

/* Een scherm is geen route: een pagina komt langs de statische laag en niet
   bij de routematcher, dus stond er in dit journaal nooit iets over. Daardoor
   was "deze app is af" een bewering die niemand kon natrekken -- de vraag "heeft
   een toets dit scherm ooit geopend" had geen bron. Nu wel, met dezelfde
   ontdubbeling en hetzelfde bestand. De regel krijgt SCHERM als methode zodat
   scripts/dekking.js (die op "METHODE patroon" leest) er geen endpoint in ziet. */
function maakScherm(noteer) {
  return function noteerScherm(url, req) {
  /* De naam van de toets erachter. Die komt uit RTG_TOETS, gezet door
     test/helper.js bij het starten van deze server. Hij hoort erbij omdat
     "geopend" op zichzelf niets zegt: test/leven.e2e.js tikt ALLE schermen
     even aan, dus zonder deze naam staat de schermmeter na een veegronde op
     nul en zegt hij voorgoed "in orde". Met de naam erbij is te zien welke
     app alleen door een veegtoets is aangeraakt en door geen enkele toets die
     zijn eigen weg aflegt. */
    noteer('SCHERM', url + ' ' + (process.env.RTG_TOETS || 'onbekend') + ' ' + soortVan(req));
  };
}

/* WAS DIT EEN BEZOEK, OF HAALDE ER IETS VOOROP?

   Een service worker haalt bij zijn install zijn hele schil op (cache.addAll).
   Dat zijn echte GET-verzoeken op echte .html-paden, en ze kwamen hier binnen
   alsof de toets die pagina's had geopend. Gemeten: een browser die eenmaal
   /apps/foundation/rust.html bezoekt levert 45 SCHERM-regels op, alle 45 op
   naam van dezelfde toets, terwijl die over 44 ervan niets beweert. Een meter
   die je met een voorophaling kunt opblazen telt niet wat hij belooft.

   De browser zegt zelf wat voor verzoek het is: een navigatie draagt
   Sec-Fetch-Mode: navigate, een fetch uit een service worker draagt cors of
   no-cors. Alleen die eerste telt hier als een bezoek, en de omkering is met
   opzet streng: niet "alles behalve een voorophaling", maar "alleen wat zegt
   dat het een navigatie is".

   Dat raakt ook de fetch() uit een toets, die in Node altijd cors meestuurt en
   dat niet laat overschrijven. Terecht: de twee die er in deze suite staan
   (test/deur.e2e.js) halen een pagina op om te zien of hij 200 geeft. Dat is
   een goede bewering over de LINK die ernaartoe wijst, maar het is niet de weg
   van die app afleggen, en precies zulke gratis punten moet deze meter niet
   uitdelen.

   Het onderscheid staat hier en niet in de twee haken, zodat er een plek is
   waar het antwoord op "was dit een bezoek" vandaan komt. */
function soortVan(req) {
  const modus = req && req.headers ? req.headers['sec-fetch-mode'] : null;
  return modus === 'navigate' ? 'navigatie' : 'nevenverzoek';
}


module.exports = { maakScherm, soortVan };
