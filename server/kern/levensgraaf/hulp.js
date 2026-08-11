/* Het Privekantoor, deelbestand "graaf-hulp": het gereedschap dat beide
   bronbestanden delen.

   Apart, en niet in een van de twee, omdat graaf-bronnen.js en
   graaf-bronnen2.js elkaar dan zouden moeten kennen. Twee bestanden die
   hetzelfde `straks()` nodig hebben en het ieder apart definieren is precies de
   vorm waarvan regel 4 van de lat zegt dat hij uiteenloopt -- en juist bij deze
   helpers zou dat stil gebeuren: een bron die "voorbij" net anders uitlegt,
   levert termijnen die de Control Tower net anders telt, zonder dat iets klaagt.

   Ook de gevoeligheidstrap woont hier, zodat een bron hem niet uit graaf.js hoeft
   te importeren. */
'use strict';

// de trap; drie is het dak (gezondheid, nalatenschap)
const OPEN = 0, PERSOONLIJK = 1, VERTROUWELIJK = 2, BESLOTEN = 3;

const vandaag = () => new Date().toISOString().slice(0, 10);
/* EEN VORMCONTROLE IS GEEN CONTROLE (regel 8 van de lat). Dit stond hier als
   alleen de regex, en daar komt '2027-13-45' vrolijk doorheen: vier cijfers,
   streepje, twee, streepje, twee. Maand dertien en dag vijfenveertig bestaan
   niet, en wat er dan gebeurt is erger dan een weigering -- `new Date()` maakt
   er Invalid Date van, dagenTussen() rekent op NaN, en in de tower staat
   "over NaN dagen".

   Dus: eerst de vorm, dan de vraag of de datum ECHT bestaat, door hem terug te
   rollen. Een 31 februari komt er als 3 maart uit en klopt dan niet meer met de
   invoer, en dat is precies het verschil tussen vorm en waarheid. */
const isDatum = d => {
  const t = String(d == null ? '' : d);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return false;
  const dt = new Date(t + 'T12:00:00Z');
  return !Number.isNaN(dt.getTime()) && dt.toISOString().slice(0, 10) === t;
};
/* Van een tijdstip (ms of ISO) naar een ISO-dag. Null bij rommel, want een
   gegeven met een halve datum is gevaarlijker dan een zonder: hij telt dan mee
   in het verkeerde venster.

   Hij stond in geldgraaf/hulp.js en woont nu hier, waar isDatum al woont, omdat
   de sociale graaf hem ook nodig heeft. Drie grafen die ieder hun eigen "welke
   dag was dit" schrijven is precies de vorm die stil uiteenloopt (regel 4); dat
   geldgraaf hem hiervandaan haalt in plaats van andersom, is omdat geld geen
   algemene laag is en sociaal er dan van zou afhangen. */
const dagVan = (t) => {
  const d = new Date(t);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
};

/* Een gebeurtenis telt alleen mee als hij nog moet komen; een diner van vorig
   jaar is geschiedenis en hoort niet als "achterstallig" in de tower. Een
   TERMIJN (een verzekering, een paspoort) gaat hier NIET doorheen: die hoort
   juist wel achterstallig te worden. */
const straks = d => (isDatum(d) && d >= vandaag() ? d : '');
const lijst = v => (Array.isArray(v) ? v : []);
const obj = v => (v && typeof v === 'object' ? v : {});

/* Een 'MM-DD' (verjaardag) naar de eerstvolgende echte datum. Zonder dit zou een
   verjaardag nooit in een termijnvenster vallen, want '02-20' is geen datum die
   je met vandaag kunt vergelijken. */
function volgendeJaardag(md) {
  if (!/^\d{2}-\d{2}$/.test(String(md || ''))) return '';
  const t = vandaag();
  const dit = t.slice(0, 4) + '-' + md;
  return dit >= t ? dit : (Number(t.slice(0, 4)) + 1) + '-' + md;
}

module.exports = { OPEN, PERSOONLIJK, VERTROUWELIJK, BESLOTEN,
  vandaag, isDatum, dagVan, straks, lijst, obj, volgendeJaardag };
