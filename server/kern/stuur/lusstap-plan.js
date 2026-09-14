/* DE PLANSTAP -- wegen wat er staat te gebeuren, zonder iets te doen.

   APART BESTAND OM DEZELFDE REDEN ALS ./lusstap-herkomst.js: een keten WEGEN en
   er de gevolgen naast leggen is iets anders dan een gereedschap UITVOEREN, en
   ./lusstap.js ging door de omvangband toen de tweede as erbij kwam. Dat is geen
   byteshuffelen -- deze tak raakt drie lagen aan (plan, gevolg, gevolgcontract)
   en de rest van lusstap.js raakt er geen van.

   WAT ER NIET GEBEURT: uitvoeren. Wat hieruit komt is een oordeel dat het model
   aan de gebruiker kan voorlezen voordat er een voorstel ontstaat. */
'use strict';

const { compileer } = require('./plan');
const { voorspelMet } = require('./gevolgcontract/voorspelling');

module.exports = function planStap(t, { wereld, acties, spoor }) {
  /* HET PLAN EN DE VOORSPELLING REIZEN SAMEN TERUG MAAR ZIJN TWEE DINGEN:
     ./plan.js weegt de bevoegdheid, ./gevolg.js zegt uit een eerdere meting wat
     de stappen aanraakten. Het plan bezit de voorspelling niet (EXECUTIE.md
     blok 3: PLAN bezit niets).

     Sinds 13 september staat er een TWEEDE AS naast die meting: de
     verklaring van een mens uit ./gevolgcontract.js, samengesteld door
     ./gevolgcontract/voorspelling.js. Ze worden nooit opgeteld -- de meting
     zegt welke collecties bewogen, de verklaring ook wat er BUITEN de opslag
     gebeurt en wat er bij een mislukking achterblijft. De samenstelling hoort
     hier en niet in een van de twee: gevolgcontract laadt gevolg, dus
     omgekeerd zou een kring zijn. */
  const gewogen = compileer(t.input || {}, wereld);
  /* DE COMPILER DIE NEE ZEGT, HEEFT GEDRAAID. Hier stond `uitvoerbaar ?
     PASS : NOT_RUN`, en dat is in strijd met de betekenis die ./spoor.js
     zelf aan NOT_RUN geeft: "hij was aan de beurt en deed terecht niets".
     Een plan dat wordt AFGEWEZEN is geen niets-doen maar het werk zelf --
     de compiler heeft gewogen en een reden geproduceerd. De stand gaat over
     de FASE, de uitkomst staat in het detail.

     Dat verschil is precies wat een gouden plak moet kunnen tonen: "parijs
     vrijdag" hoort te eindigen op een compiler die PASS is en een
     capability die er niet IS -- niet op een fase die eruitziet alsof hij
     is overgeslagen. */
  spoor && spoor.mark('PLAN_COMPILED', 'PASS',
    { uitvoerbaar: !!gewogen.uitvoerbaar, bezwaren: (gewogen.bezwaren || []).length,
      /* De eerste reden staat erbij: een telling van bezwaren zegt niet
         WAAROM er niets kan, en dat is nu juist het antwoord. */
      eersteBezwaar: (gewogen.bezwaren || [])[0] ? (gewogen.bezwaren[0].reden || '').slice(0, 120) : undefined });
  const gevolg = voorspelMet(gewogen);
  /* WAT HIER STAAT, IS WAT ./gevolg.js WERKELIJK TERUGGEEFT. Hier stond
     `{ graad: gevolg.graad }`, en voorspel() heeft geen `graad` -- die woont
     per STAP, niet over het plan. Het merk droeg dus sinds de bouw een leeg
     veld: het detail viel weg in de JSON en de fase leek keurig gemeten.
     Gevonden door MENSELIJKE_UITVOERING.json, dat het detail per zin naast
     de stand legde en overal niets vond. Een veld dat nooit een waarde heeft
     gehad, is erger dan een ontbrekend veld -- het leest als bewijs.

     `onbekend` staat er apart bij en wordt nergens bij `gemeten` opgeteld:
     "van deze stap is niet gemeten wat hij aanraakt" is iets anders dan
     "deze stap raakt niets aan" (./gevolg.js zegt dat zelf ook). */
  const gt = (gevolg && gevolg.telling) || {};
  spoor && spoor.mark('CONSEQUENCE_EVALUATED', 'PASS',
    { stappen: (gevolg && gevolg.stappen || []).length,
      collecties: (gevolg && gevolg.geraakteCollecties || []).length,
      gemeten: gt.gemeten, geenEffect: gt['geen-effect-gemeten'], onbekend: gt.onbekend,
      /* De tweede as gaat MEE in het merk, want anders is in het spoor niet
         terug te zien of een onbekende meting wel verklaard was. `zouAfwijzen`
         is de schaduwregel die vandaag niets weigert. */
      verklaardVolledig: (gevolg && gevolg.verklaring || {}).volledig,
      zouAfwijzen: (gevolg && gevolg.verklaring || {}).zouAfwijzen });
  const uit = Object.assign({}, gewogen, { gevolg });
  acties.push({ pad: 'plan', status: uit.uitvoerbaar ? 200 : 409, gevraagd: true });
  return uit;
};
