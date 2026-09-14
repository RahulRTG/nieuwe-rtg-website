/* DE VOORSPELLING MET BEIDE ASSEN -- de meting van ../gevolg.js en de verklaring
   van ../gevolgcontract.js, naast elkaar en nooit opgeteld.

   WAAROM DIT BESTAND BESTAAT EN WAAROM HET NIET IN plan.js ZIT. De eerste versie
   van deze stap zette de gevolgkennis PER STAP in ../plan.js. Dat was fout, en de
   code schreef het zelf al uit: *"hij hangt NAAST het plan en niet erin: PLAN
   bezit niets, en dat blijft zo"* (../gevolg.js, slotalinea). Bovendien deed
   ../lusstap.js het al: hij roept `voorspel(gewogen)` aan en laat het resultaat
   NAAST het plan meereizen. Een tweede weg ernaast zou LAT.md regel 4 zijn op de
   plek waar dit huis er het meest gevoelig voor is -- twee lezers van dezelfde
   waarheid.

   WAT DIT DUS IS: een schil om `voorspel()`, die er de tweede as bij legt. Niets
   van de meting wordt hier overgeschreven of gecorrigeerd; wat erbij komt is wat
   een MENS heeft verklaard, en dat staat in een eigen veld.

   EN WAAROM NIET IN ../gevolg.js ZELF: dan zou de meting de verklaring moeten
   laden, en ../gevolgcontract.js laadt de meting (zijn poort toetst een `gemeten`
   claim tegen ../gevolg.js). Dat is een kring. De samenstelling hoort dus bij de
   aanroeper, en dat is hier.

   DE REGEL DIE HIER VOOR DE DEUR STAAT WEIGERT VANDAAG NIETS: *een plan gaat
   alleen over handelingen waarvan het gevolg voldoende bekend is.* Dat is precies
   het soort regel dat CONTROLPLANE.md eerst in de SCHADUW laat lopen -- je kunt
   niet afdwingen wat nooit zonder te blokkeren heeft gedraaid. Met 87 van de 173
   AI-bereikbare paden ongemeten (GEVOLGDEKKING.json) zou afdwingen vandaag het
   halve stuur stilzetten, en dan wordt de regel losgedraaid in plaats van gehaald.
   Deze laag TELT dus wat hij zou weigeren, en weigert niets. */
'use strict';

const { voorspel } = require('../gevolg');
const gevolgcontract = require('../gevolgcontract');
const { CONTRACTEN } = require('./register');

/* HET REGISTER IS EEN PARAMETER MET EEN STANDAARD, en dat is geen netheid. De
   bewering die hieronder telt -- een contract dat de keuring niet haalt, telt NIET
   als verklaring -- was anders niet te toetsen: het echte register is bevroren en
   bevat (terecht) geen afgekeurd contract. Zonder deze injecteerbare lezer zou die
   regel groen staan zonder ooit gedraaid te zijn. Zelfde snit als
   `norm.meet({ leesMutaties })`. */
function verklaringVan(pad, contracten) {
  const c = (contracten || CONTRACTEN)[String(pad || '')] || null;
  if (!c) return { stand: 'ONBEKEND', reden: 'geen enkel gevolgcontract voor dit pad' };
  const fout = gevolgcontract.keur(c);
  /* Een contract dat de keuring niet haalt, telt NIET als verklaring -- anders
     draagt een plan zekerheid die op een afgekeurde regel rust. En het verdwijnt
     niet stil: de reden zegt dat er wel een contract IS en dat het zakte. */
  if (fout.length) return { stand: 'ONBEKEND',
    reden: 'er staat een contract maar het haalt de keuring niet (' + fout.length + ' bezwaar/bezwaren)' };
  const s = gevolgcontract.stand(c, pad);
  return { stand: s.stand, open: s.open, nietVerklaard: s.nietVerklaard, reden: null };
}

/* Voldoende bekend gevolg = de proef zag iets, OF zag aantoonbaar niets, OF er
   staat een volledige verklaring. Blind is geen van die drie.

   `geen-effect-gemeten` telt hier dus als BEKEND, en dat is een besluit: de proef
   heeft de route echt gedraaid en er bewoog geen enkele collectie. Dat is iets
   anders dan "de proef kwam er niet bij", en die twee door elkaar halen is exact
   de fout die ../gevolg.js in zijn eigen GRENZEN benoemt. */
const blindVoorGevolg = (s) => s.graad === 'onbekend' && (!s.verklaring || s.verklaring.stand !== 'VOLLEDIG');

function voorspelMet(plan, contracten) {
  const uit = voorspel(plan);
  /* De stappen van voorspel() worden AANGEVULD en niet vervangen: dezelfde
     objecten, met een veld erbij. Wie ze hier opnieuw zou opbouwen, heeft de
     tweede lezer gemaakt die de kop hierboven verbiedt. */
  for (const s of uit.stappen) s.verklaring = verklaringVan(s.capability, contracten);
  const blind = uit.stappen.filter(blindVoorGevolg);
  const volledig = uit.stappen.filter(s => s.verklaring.stand === 'VOLLEDIG').length;

  uit.verklaring = {
    volledig,
    /* DE SCHADUWREGEL, met naam en toenaam erbij. Een aantal alleen laat een SWAP
       door: twee paden waarvan de een blind wordt en de ander bekend, geeft
       hetzelfde getal -- zelfde reden als de genoemde lijst in
       MUTATIECONTRACT.md par. 5t. */
    regel: 'een plan gaat alleen over handelingen waarvan het gevolg voldoende bekend is',
    afgedwongen: false,
    zouAfwijzen: blind.length,
    paden: blind.map(s => s.capability),
    waarom: blind.length
      ? 'deze stappen hebben geen gemeten gevolg en geen volledige verklaring; de regel loopt mee ' +
        'in de schaduw en houdt niets tegen (CONTROLPLANE.md: eerst zonder te blokkeren)'
      : 'van elke stap in dit plan is het gevolg gemeten of volledig verklaard'
  };
  return uit;
}

module.exports = { voorspelMet, verklaringVan, blindVoorGevolg };
