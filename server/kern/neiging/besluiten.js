/* ============================================================================
   DE BESLUITEN ONDER EEN NEIGING -- de gesloten lijsten, en wat er met opzet
   NIET in staat.

   Apart van ./bewaren.js om dezelfde reden als ./gegevenssoorten.js apart staat
   van ./gegevenskaart.js in kern/identiteit/: een lijst met BESLUITEN erin
   verandert zelden en wordt gelezen als beleid, de operaties eromheen
   veranderen vaak en worden gelezen als code. Samen gingen ze bovendien over de
   tienkilobytegrens van keuringsregel 13, en die lijst hoort te krimpen door
   een snede en niet door een uitzondering.

   DE DOELEN ZIJN EEN GESLOTEN LIJST VAN TWEE, en wat er niet in staat is
   belangrijker dan wat er wel in staat:

     tonen    hiermee bepaalt RTG wat hij jou laat zien.
     helpen   hiermee helpt een mens of Rahul je met iets wat je zelf vraagt.

   WAT ER MET OPZET NIET IS:
     - `delen`. Een neiging gaat nooit naar een derde partij. Wie een voorkeur
       aan een zaak wil meegeven, gebruikt de doorwerkingsweg van
       kern/gastzorg-profiel.js -- die eist al een zaak, een reden en een
       intrekbaar spoor, en hem hier namaken zou een tweede doorwerking zijn
       zonder dat spoor.

       (De naam van die functie staat er met opzet NIET voluit bij:
       scripts/doorwerking.js is een LEESMETING op de bron die geen commentaar
       afscheidt, en las deze regel als een aanroep die het zorgprofiel zonder
       zaak weggeeft. Een toelichting die naar de juiste weg wijst, hoort niet
       als overtreding geteld te worden -- zie METERKLASSE.json voor hoe vaak
       die vorm voorkomt: 60 van de 73 meters leiden betekenis af uit de VORM
       van de code zonder commentaar te scheiden.)
     - `adverteren`. Er is geen advertentiedoel en er komt er geen, want dan is
       dit bestand een profielverkoper met een nette naam. Dat is geen
       instelling die uit staat: het woord komt in de gesloten lijst niet voor,
       dus een aanroeper die erom vraagt krijgt een weigering.
     - `verbeteren` of `onderzoek`. Klinkt onschuldig en betekent in de praktijk
       alles; een doel dat je niet kunt uitleggen aan degene over wie het gaat,
       is geen doel.
   ========================================================================== */
'use strict';

/* De gesloten lijst doelen. De kop legt uit wat er met opzet niet in staat. */
const DOELEN = Object.freeze(['tonen', 'helpen']);

/* Wie het mag zien, oplopend -- dezelfde kring als kern/levensgraaf/graaf.js,
   en met dezelfde standaard: `lid`, alleen jijzelf.

   `rechterhand` HEEFT VANDAAG GEEN AANROEPER, en dat staat er liever dan dat het
   als bestaand gedrag leest: geen enkele weg in deze laag zet `deel` op iets
   anders dan `lid`, en geen lezer geeft een andere `kijker` mee. De trede staat
   er omdat een poort met een waarde geen poort is -- de FILTER in ./bewaren.js is
   echt en werkt, hij heeft alleen nog niets te onderscheiden. Zet iemand hier een
   tweede kring in gebruik, dan is dat een besluit over wie meekijkt en hoort er
   een toets bij. */
const KRING = Object.freeze({ lid: 0, rechterhand: 1 });

/* Twee jaar, en dan weg. Een neiging die twee jaar niet is aangeraakt zegt
   niets meer over iemand; hem toch bewaren is verzamelen zonder gebruik. */
const BEWAARDAGEN = 730;

/* Wat elke grond betekent, in de woorden van een lid. Staat HIER en niet bij de
   lezer (./geheugen.js), omdat het bij het besluit hoort en niet bij de
   presentatie: twee schermen die dezelfde grond anders uitleggen, is precies de
   dubbeling die LAT-regel 4 verbiedt -- en dat is hier een keer echt gebeurd, met
   een lokale kopie die de geimporteerde overschaduwde. */
const GRONDUITLEG = Object.freeze({
  gezegd: 'Dit heb je zelf gezegd of aangetikt.',
  gekozen: 'Dit heb je meermaals gekozen; RTG heeft het geteld.',
  afgeleid: 'Dit heeft RTG ergens uit afgeleid. Het is het zwakste wat hier staat.'
});

const DOELUITLEG = Object.freeze({
  tonen: 'Hiermee bepaalt RTG wat hij je laat zien.',
  helpen: 'Hiermee helpt RTG je met iets wat je zelf vraagt.'
});

module.exports = { DOELEN, KRING, BEWAARDAGEN, GRONDUITLEG, DOELUITLEG };
