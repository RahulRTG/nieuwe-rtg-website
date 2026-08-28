/* WELKE KOSTEN BESTAAN ER, EN WAT IS ERVAN TE METEN.

   Dit is de enige lijst. Een kostensoort die hier niet staat, bestaat in de rest
   van deze laag niet: de meter weigert hem, het overzicht toont hem niet en de
   doorbelasting kan hem niet op een factuur zetten. Dat is met opzet, want de
   fout die deze laag moet voorkomen is een BEDRAG ZONDER HERKOMST.

   TWEE VELDEN DRAGEN DE HELE MODULE:

     meetweg     'gemeten'      er is een teller die per gebruiker optelt
                 'toegerekend'  er is geen teller die dit per gebruiker kan
                                weten, dus het wordt VERDEELD over gebruikers

   Uit `meetweg` volgt het GRAADPLAFOND: hoe hoog de bewijsgraad van deze soort
   ooit kan komen (BESTUUR.md par. 3: onbekend, vermoed, gemeten, bewezen). Dat
   is met opzet een AFLEIDING en geen veld per regel. Het stond hier eerst wel
   per regel, en een mutatie liet zien waarom dat fout was: het plafond van
   stroom op 'gemeten' zetten veranderde niets, want ./toerekening.js schreef
   zijn eigen 'vermoed' op. Twee plekken die hetzelfde bedoelen, en geen van
   beide die de ander tegenhield. Nu is er één plek, en hij bijt.

   ELEKTRICITEIT IS HET SCHERPSTE VOORBEELD, en de reden dat dit veld er is.
   RTG heeft geen stroommeter per lid en krijgt er ook nooit een: een lid deelt
   een server met duizend anderen, en de stroom van dat rek staat op een rekening
   van de hoster. Wat wij kunnen, is de REKENING verdelen naar gemeten verbruik.
   Dat is een schatting met een verdeelsleutel, en dus 'vermoed' -- nooit
   'gemeten', ook niet als het getal er precies uitziet. server/kern/toegankelijk.js
   zegt al met zoveel woorden "RTG meet geen energie"; deze module maakt daar geen
   leugen van maar een toerekening met de graad erbij.

   WAAROM AI IN TWEE SOORTEN VALT. Invoer- en uitvoertokens kosten bij elke
   aanbieder een ander bedrag (uitvoer is doorgaans een veelvoud). Eén soort
   "ai" zou dus een gemiddelde nodig hebben, en een gemiddelde over twee prijzen
   die uiteenlopen is een verzonnen getal. Twee soorten, twee tarieven.

   WAAROM TRANSACTIEKOSTEN OOK IN TWEE SOORTEN VALLEN. Een betaalpartner rekent
   een vast bedrag per transactie PLUS een deel van het bedrag. Dat is niet in
   één eenheid te vangen; wie het toch probeert, rekent een tikkie van 5 euro
   even duur als een boeking van 5.000. */
'use strict';

/* De eenheid staat in de naam van het veld en niet in een losse tabel: een
   tarief zonder eenheid is een getal zonder betekenis, en die twee horen dus
   niet op twee plekken te kunnen staan.

   `ruw` is waarin de meter telt, `stap` is hoeveel daarvan in één tariefeenheid
   gaan. De meter telt losse tokens (want dat is wat de aanbieder teruggeeft),
   het tarief staat per duizend (want zo staat het op elke prijslijst). Zonder
   dit veld zou een van beide moeten wijken, en dan rekent iemand ooit een
   factor duizend mis -- op een factuur. */
const SOORTEN = [
  { id: 'ai-invoer', naam: 'AI, invoer', eenheid: '1.000 tokens', ruw: 'tokens', stap: 1000, meetweg: 'gemeten',
    grond: 'De uitwijkketen in server/ai.js geeft per aanroep usage.input_tokens terug; die telt op per gebruiker.' },
  { id: 'ai-uitvoer', naam: 'AI, uitvoer', eenheid: '1.000 tokens', ruw: 'tokens', stap: 1000, meetweg: 'gemeten',
    grond: 'Zelfde aanroep, usage.output_tokens. Apart omdat uitvoer een ander tarief heeft dan invoer.' },
  { id: 'verzoek', naam: 'Serververzoeken', eenheid: '1.000 verzoeken', ruw: 'verzoeken', stap: 1000, meetweg: 'gemeten',
    grond: 'Elk afgehandeld API-verzoek van een ingelogde gebruiker telt er één. Rekenkracht schaalt hiermee mee.' },
  { id: 'opslag', naam: 'Opslag', eenheid: 'GB-maand', ruw: 'GB-maand', stap: 1, meetweg: 'gemeten',
    grond: 'De ledenkluis van deze gebruiker (kern/bestanden.js), gepeild en gemiddeld over de maand. De media van zaken, de back-ups en de bijlagen van RTmail zitten er NIET in; die staan elders en worden hier niet meegeteld.' },
  { id: 'bericht', naam: 'Bericht (mail of sms)', eenheid: '1 bericht', ruw: 'berichten', stap: 1, meetweg: 'gemeten',
    grond: 'Elk bericht dat het huis aanneemt om te versturen, mail of sms, welk kanaal het ook draagt.' },
  { id: 'transactie', naam: 'Transactie, vast deel', eenheid: '1 transactie', ruw: 'transacties', stap: 1, meetweg: 'gemeten',
    grond: 'Het vaste bedrag dat de betaalpartner rekent, geteld op het oplaadmoment: daar komt het geld van buiten binnen (WAARDE.md par. 1).' },
  { id: 'transactiewaarde', naam: 'Transactie, deel van het bedrag', eenheid: '1 euro omzet', ruw: 'euro', stap: 1, meetweg: 'gemeten',
    grond: 'Het deel van het opgeladen bedrag dat de betaalpartner inhoudt, in euro\'s, op datzelfde oplaadmoment.' },
  { id: 'stroom', naam: 'Elektriciteit', eenheid: 'toegerekend', meetweg: 'toegerekend',
    grond: 'RTG meet geen stroom per gebruiker en zal dat nooit kunnen. De rekening van de hoster wordt verdeeld; zie ./toerekening.js.' },
  { id: 'hosting', naam: 'Serverhuur en netwerk', eenheid: 'toegerekend', meetweg: 'toegerekend',
    grond: 'Vaste huur van machines, opslag en verkeer. Staat los van het aantal verzoeken en is dus niet per gebruiker te meten.' }
];

/* HET PLAFOND VOLGT UIT DE MEETWEG, en wordt niet per regel ingetikt. Een
   verdeling van een nota is per definitie afgeleid uit gegevens die er toevallig
   liggen, en dat heet in BESTUUR.md 'vermoed'. Een teller komt tot 'gemeten' en
   niet hoger: 'bewezen' vraagt om een proef die het werkelijk heeft gedaan, en
   een teller die zichzelf natelt bewijst niets. */
const PLAFOND = { gemeten: 'gemeten', toegerekend: 'vermoed' };
for (const s of SOORTEN) s.graadPlafond = PLAFOND[s.meetweg];

/* STROOM OF STAND, en dat is geen woordspel maar het verschil tussen optellen
   en meten.

   Zes van de zeven meetbare soorten zijn een STROOM: tokens, verzoeken,
   berichten en transacties gebeuren, en je telt ze op. Opslag is een STAND: er
   staan op enig moment zoveel gigabytes, en die tel je niet op maar peil je.
   Wie een stand als stroom telt, rekent een lid dat een maand lang niets doet
   elke peiling opnieuw zijn hele kluis aan -- en dan groeit de rekening van
   iemand die niets doet het hardst.

   Alleen `opslag` is een stand; de rest is stroom. Het staat hier afgeleid en
   niet per regel, om dezelfde reden als het plafond hierboven. */
for (const s of SOORTEN) s.aard = s.id === 'opslag' ? 'stand' : 'stroom';
const standSoorten = () => SOORTEN.filter(s => s.aard === 'stand');

const OP_ID = new Map(SOORTEN.map(s => [s.id, s]));
const soort = id => OP_ID.get(String(id || '')) || null;
const gemeten = () => SOORTEN.filter(s => s.meetweg === 'gemeten');
const toegerekend = () => SOORTEN.filter(s => s.meetweg === 'toegerekend');

/* De graden uit BESTUUR.md par. 3, in volgorde. Staat hier en niet naast
   kern/command/gezondheid.js omdat die lijst daar privé is; loopt hij ooit
   uiteen, dan zakt test/kosten.test.js daarop. */
const GRAAD = ['onbekend', 'vermoed', 'gemeten', 'bewezen'];
/* Nooit hoger dan het plafond van de soort. Een toerekening die zich 'gemeten'
   noemt is precies de leugen waar deze module tegen bestaat. */
function plafond(soortId, graad) {
  const s = soort(soortId);
  const g = GRAAD.indexOf(graad) < 0 ? 'onbekend' : graad;
  if (!s) return 'onbekend';
  return GRAAD.indexOf(g) > GRAAD.indexOf(s.graadPlafond) ? s.graadPlafond : g;
}

module.exports = { SOORTEN, soort, gemeten, toegerekend, standSoorten, GRAAD, plafond };
