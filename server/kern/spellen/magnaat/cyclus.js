/* Magnaat: DE ECONOMISCHE CYCLUS -- de wind die over de hele stad waait.

   `st.cyclus` stond al maanden in de renteformule van ./bank.js en werd door
   niets gevoed. Hij bleef nul, dus de bank rekende altijd met een neutrale
   conjunctuur. Dat is precies de soort losse draad die stil scheefgroeit: de
   formule zag er compleet uit en meette niets.

   VIER FASEN, en de volgorde ligt vast omdat een conjunctuur geen dobbelsteen
   is maar een golf:

     bloei      de vraag is hoog, geld is duur (de bank ziet oververhitting)
     omslag     de vraag zakt, geld wordt duurder (de bank ziet risico)
     recessie   de vraag is laag, geld is duur en schaars
     herstel    de vraag trekt aan, geld is goedkoop

   WAT HIJ RAAKT, en dat is met opzet weinig:

     DE VRAAG, over de hele stad tegelijk. Niet per sector -- dat zou een
     sectorbalans worden en die staat al vast (./sectoren.js). Wat een cyclus
     doet is IEDEREEN tegelijk raken, en juist dat maakt hem een cyclus in plaats
     van ruis.
     DE PRIJS VAN GELD, via de post die er al op wachtte.

   Wat hij NIET raakt: kosten, capaciteit, risico's. Elke post die hij er nog bij
   zou pakken maakt hem een tweede economie in plaats van een golf eroverheen.

   HIJ IS DETERMINISTISCH EN NIET WILLEKEURIG, en dat is een sterkere eis dan
   bij de risico's. Een risico dat uit een hash komt is onvoorspelbaar en dat
   hoort; een conjunctuur die uit een hash komt is GERUIS. Wat een cyclus
   speelbaar maakt is dat je hem kunt zien aankomen: in een recessie hoor je te
   weten dat er herstel volgt, want daarop bouw je je strategie. Daarom loopt hij
   op de KLOK -- maand modulo de lengte -- met een lengte en een startfase die
   per partij uit de hash komen. Twee campagnes hebben dus een andere conjunctuur,
   dezelfde campagne altijd dezelfde.

   DE SPELER ZIET WAAR HIJ STAAT EN WAT ER KOMT. Een cyclus die je pas merkt als
   je omzet zakt, is geen mechaniek maar pech. */
const { trek } = require('./risico');

/* De vier fasen op een rij, met wat ze doen. `vraag` is een vermenigvuldiger op
   de hele stad; `geld` is de opslag die de bank erbij rekent (in procentpunten
   per maand, via `cyclus` in ./bank.js -- daar staat de schaal).

   DE BAND IS SMAL MET OPZET. Van bloei naar recessie scheelt vijftien procent
   vraag, en dat is al fors: een zaak die op de rand van rendabel draait, valt
   daarmee om. Groter maken zou betekenen dat de cyclus bepaalt wie er wint in
   plaats van hoe je speelt. */
const FASEN = [
  { sleutel: 'bloei', naam: 'Bloei', vraag: 1.08, geld: 0.5,
    uitleg: 'De stad draait op volle toeren. Er is vraag, maar geld is duur.' },
  { sleutel: 'omslag', naam: 'Omslag', vraag: 1.0, geld: 1.0,
    uitleg: 'De groei loopt eruit. Banken worden voorzichtig.' },
  { sleutel: 'recessie', naam: 'Recessie', vraag: 0.93, geld: 1.2,
    uitleg: 'De vraag is laag en krediet is duur en schaars.' },
  { sleutel: 'herstel', naam: 'Herstel', vraag: 1.0, geld: -0.6,
    uitleg: 'Het trekt aan en geld is goedkoop. Dit is het moment om te bouwen.' }
];
const FASELIJST = FASEN.map(f => f.sleutel);

/* Hoe lang een hele ronde duurt, in spelmaanden. Uit een band en niet vast: een
   conjunctuur met een bekende lengte is een kalender, en dan zet iedereen zijn
   uitbreiding op dezelfde maand. */
const LENGTE = [24, 44];

function ronde(partijId) {
  const t = trek((partijId || '') + '|cyclus|lengte');
  return Math.round(LENGTE[0] + t * (LENGTE[1] - LENGTE[0]));
}
/* Waar de partij begint. Niet altijd in bloei: een campagne die in een recessie
   opent is een andere campagne, en dat hoort te kunnen. */
const start = (partijId) => Math.floor(trek((partijId || '') + '|cyclus|start') * FASEN.length);

/* IN WELKE FASE STAAT DEZE MAAND. De vier fasen delen de ronde in gelijke
   stukken; welk stuk je in zit volgt uit de klok en verder uit niets. */
function faseVan(partijId, maand) {
  const lengte = ronde(partijId);
  const per = lengte / FASEN.length;
  const positie = ((maand % lengte) + lengte) % lengte;
  const i = (Math.floor(positie / per) + start(partijId)) % FASEN.length;
  return { i, fase: FASEN[i], lengte, per,
    /* HOEVEEL MAANDEN DEZE FASE NOG DUURT. Dit getal is de reden dat de cyclus
       speelbaar is: wie weet dat het herstel over drie maanden begint, bouwt nu.
       Zonder dat is een conjunctuur geen mechaniek maar pech. */
    nog: Math.max(1, Math.ceil(per - (positie % per))) };
}

/* De vraagfactor van deze maand, en de kredietstand die de bank leest. Dit zijn
   de twee enige uitgangen van deze module. */
const vraagFactor = (partijId, maand) => faseVan(partijId, maand).fase.vraag;
const geldstand = (partijId, maand) => faseVan(partijId, maand).fase.geld;

/* WAT EEN SPELER ZIET: waar de stad staat, hoe lang nog, en wat er hierna komt.
   Publiek, want een conjunctuur is voor iedereen zichtbaar -- er is geen versie
   van dit spel waarin de ene ondernemer wel weet dat het slecht gaat en de
   andere niet. */
function beeld(partijId, maand) {
  const nu = faseVan(partijId, maand);
  const volgende = FASEN[(nu.i + 1) % FASEN.length];
  return {
    fase: nu.fase.sleutel, naam: nu.fase.naam, uitleg: nu.fase.uitleg,
    vraag: nu.fase.vraag, geld: nu.fase.geld,
    nog: nu.nog, rondeLengte: nu.lengte,
    hierna: { fase: volgende.sleutel, naam: volgende.naam, vraag: volgende.vraag },
    fasen: FASEN.map(f => ({ sleutel: f.sleutel, naam: f.naam, vraag: f.vraag, geld: f.geld }))
  };
}

module.exports = { FASEN, FASELIJST, LENGTE, ronde, start, faseVan, vraagFactor, geldstand, beeld };
