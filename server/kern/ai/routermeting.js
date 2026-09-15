/* DE SCHADUWMETING VAN DE INTELLIGENTIEROUTER -- hoe vaak had een goedkopere
   techniek het ECHT gedekt, per ingang, en duurzaam genoeg om een besluit te
   dragen. EXECUTIE.md blok 8.

   APART VAN ./router.js: dat classificeert een zin, dit meet over echt verkeer
   -- en router.js stond op 8,7 kB van de 10 (keuringsregel 13).

   EEN SPOOR IS GEEN DEKKING -- de reden dat deze laag bestaat. router.kies()
   herkent een techniek aan een REGEX OVER DE VRAAG, en dat is nagemeten iets
   heel anders dan wat er werkelijk uitkomt: over acht gewone vragen zei hij 6
   keer "goedkoper mogelijk" terwijl de regellaag er 0 beantwoordde, en de enige
   die zij wel beantwoordt ("wat moet ik inpakken") heette daar `ai`. Hij zit er
   dus in BEIDE richtingen naast. Dit getal bestaat om te besluiten of de
   goedkope laag vOOr het model mag komen; op het vermoeden zou dat betekenen
   dat een standaardzin goede modelantwoorden verdringt -- en dat merkt niemand,
   want er komt gewoon een antwoord. Daarom meet deze laag de UITKOMST.

   TWEE GETALLEN DIE NOOIT WORDEN OPGETELD: `spoor` (de regex wees een goedkopere
   techniek aan -- VERMOEDEN) en `bewezenGedekt` (de goedkope laag kon het echt
   -- GEMETEN). Het verschil staat in beide richtingen apart.

   WAT DEZE METER NIET DEKT: `algoritme`, `optimalisatie` en `voorspelling`.
   kern/fiscaal/btwtelling.js is niet uit een kale zin aan te roepen -- hij wil
   een factuurregister en argumenten. Dat staat in `nietGemeten` met de reden en
   niet als een nul; zelfde vorm als HERSTELPROEF.json, waar wat de proef niet
   kon doen een tekort van de proef is en nooit een oordeel.

   TELLERS EN GEEN JOURNAAL. Geen vraag, geen sessiesleutel: voor "hoe vaak had
   het goedkoper gekund" is nul informatie over een mens nodig. Zelfde keuze als
   kern/kosten/ en kern/stuur/schaduwtelling.js, en dezelfde les als AFSPRAAK.md,
   waar de eerste versie van zo'n teller een lijst leden zonder bewaartermijn
   maakte.

   PER INGANG, EN NOOIT ALLEEN EEN TOTAAL: een percentage over de hoop laat de
   drukste ingang bepalen wat er "in het algemeen" waar is. Zelfde reden waarom
   AFSPRAAK.md de lidpoort en de abonnementspoort niet vergelijkbaar noemt.

   DEZE LAAG BESLIST NIETS. Er is geen tak waarlangs zij een antwoord verandert.
   Zou die er zijn, dan is het geen schaduw meer. */
'use strict';

const router = require('./router');
const { cannedAnswer } = require('./demoantwoorden');
const klok = require('../../lib/klok');

/* De ingangen waar een mens Rahul een vraag stelt. Gesloten lijst: een onbekende
   naam telt mee onder `onbekend` in plaats van er stil bij te komen, want een
   ingang die niemand heeft verklaard hoort op te vallen. */
const INGANGEN = Object.freeze(['fluister', 'ai', 'chat']);

/* Een zin die met zekerheid GEEN antwoordbak raakt, zodat de standaardzin van
   de regellaag op te vragen is zonder hem over te typen. DIT IS DE ENE
   WAARHEID: de zes voorwaarden uit demoantwoorden.js hier herhalen zou twee
   lijsten maken die uit elkaar lopen. test/routermeting.test.js houdt vast dat
   deze zin niets raakt EN dat een gewone vraag er wel doorheen komt -- een
   instrument dat niet kan uitslaan is geen instrument. */
const RAAKT_NIETS = 'zzq-geen-enkele-antwoordbak-zzq';

/* Wat vanuit een KALE VRAAG te beproeven is. Alleen `regels`: cannedAnswer is
   een zuivere functie van (vraag, pas, reis). De rest wil een register, een lid
   of argumenten; dat staat in `nietGemeten` met de reden en niet als een nul. */
const BEPROEFBAAR = Object.freeze({
  regels: (vraag, pas, reis) => cannedAnswer(vraag, pas, reis) !== cannedAnswer(RAAKT_NIETS, pas, reis)
});
/* De twee verschilvakken dragen het besluit: `spoorZonderDekking` (router zei
   "kan goedkoper" en dat kon niet -- omdraaien laat daar een standaardzin een
   modelantwoord verdringen) en `dekkingZonderSpoor` (router zei "model nodig" en
   dat was het niet -- de duurste, want wat je niet ziet zet je nooit aan). */
function leegVak() {
  return { gewogen: 0, spoor: 0, bewezenGedekt: 0,
    spoorZonderDekking: 0, dekkingZonderSpoor: 0, proefMislukt: 0,
    modelNodig: 0, nietsGafAntwoord: 0 };
}
function leegDoos() {
  const d = { totaal: leegVak(), per: {} };
  for (const i of INGANGEN) d.per[i] = leegVak();
  d.per.onbekend = leegVak();
  return d;
}

let tellers = leegDoos();
let bewaarplek = null;
let sinds = klok.nu();

/* De aanroeper geeft een plek met lees() en schrijf(). Zonder die plek telt de
   meter in dit proces EN zegt dat erbij: een teller die bij elke herstart op
   nul springt draagt geen besluit, en mag zich dus niet duurzaam noemen. */
function onthoud(plek) {
  if (!plek || typeof plek.lees !== 'function' || typeof plek.schrijf !== 'function') return false;
  bewaarplek = plek;
  /* Ook LEZEN achter een vangnet: een meting die de aanroeper kan laten klappen
     is erger dan geen meting, en dit is een schaduwlaag. */
  let eerder = null;
  try { eerder = plek.lees(); } catch (e) { eerder = null; }
  if (eerder && typeof eerder === 'object' && eerder.totaal) {
    const schoon = leegDoos();
    for (const vak of Object.keys(schoon.per))
      if (eerder.per && eerder.per[vak]) neemOver(schoon.per[vak], eerder.per[vak]);
    neemOver(schoon.totaal, eerder.totaal);
    tellers = schoon;
    /* klok.nu() geeft milliseconden, geen ISO-tekst. De eerste versie toetste
       hier op `string` en liet `sinds` dus stil op NU staan na een herstart --
       waarmee "sinds" precies zou liegen over de periode die het getal beslaat.
       Beide vormen worden aanvaard, want een oudere regel kan ISO dragen. */
    if (Number.isFinite(eerder.sinds)) sinds = eerder.sinds;
    else if (typeof eerder.sinds === 'string' && eerder.sinds) sinds = Date.parse(eerder.sinds) || sinds;
  }
  return true;
}

function neemOver(doel, bron) {
  for (const k of Object.keys(doel)) if (Number.isFinite(bron[k])) doel[k] = bron[k];
}

function vakVoor(ingang) {
  const naam = INGANGEN.includes(ingang) ? ingang : 'onbekend';
  return tellers.per[naam];
}

/* EEN WEGING. Geeft terug wat er gemeten is; verandert niets.

   `pas` en `reis` gaan mee omdat cannedAnswer ervan afhangt -- zonder de pas
   meet je de u-vorm van een lid dat getutoyeerd wordt, en zonder de reis meet
   je dekking op een reis die dit lid niet heeft. Ze worden NIET bewaard. */
function meet(vraag, opties) {
  const o = opties || {};
  const keuze = router.kies(vraag);
  const vak = vakVoor(o.ingang);

  /* HEEFT DE GOEDKOPE LAAG HET GEDEKT? Twee wegen naar hetzelfde antwoord.

     De aanroeper mag het AANLEVEREN als hij het beter weet, en dat is geen gemak
     maar noodzaak: elke ingang heeft zijn eigen goedkope laag. /api/ai en
     /api/chat/send draaien op cannedAnswer, /api/fluister op kern/fluister --
     daar zou de proef hieronder een laag meten die in die route niet voorkomt.

     Levert hij niets, dan draait de proef -- ALTIJD, ook als de router `ai` zei,
     anders meet je je eigen aanname. "Wat moet ik inpakken" heet bij kies() `ai`
     terwijl de regellaag hem beantwoordt; gate je hierop, dan blijft juist die
     fout onzichtbaar. `gedekt` betekent langs beide wegen hetzelfde: de goedkope
     weg van DEZE ingang gaf het antwoord, dus er was geen model nodig. */
  let gedekt = typeof o.gedekt === 'boolean' ? o.gedekt : null;
  const proef = gedekt === null ? BEPROEFBAAR.regels : null;
  if (proef) {
    /* De proef mag het antwoord nooit in de weg lopen. Valt hij om, dan telt
       deze weging als niet-beproefd in plaats van als niet-gedekt: een tekort
       van de meter is geen oordeel over de motor. */
    try { gedekt = !!proef(vraag, o.pas, o.reis || null); }
    catch (e) { gedekt = null; }
  }

  for (const t of [vak, tellers.totaal]) {
    t.gewogen++;
    if (keuze.goedkoperMogelijk) t.spoor++;
    if (gedekt === true) t.bewezenGedekt++;
    if (gedekt === null) t.proefMislukt++;
    if (keuze.goedkoperMogelijk && gedekt === false) t.spoorZonderDekking++;
    if (!keuze.goedkoperMogelijk && gedekt === true) t.dekkingZonderSpoor++;
    if (o.modelAntwoordde === true) t.modelNodig++;
    /* Geen goedkope dekking EN geen model: hier viel het gesprek terug op een
       algemene zin. Eigen teller en geen aftreksom, want `bewezenGedekt` is de
       tegenfeitelijke vraag ("had het gekund") en niet "wie antwoordde" -- die
       twee kunnen allebei waar zijn. */
    if (gedekt !== true && o.modelAntwoordde !== true) t.nietsGafAntwoord++;
  }
  schrijfDoor();

  return { techniek: keuze.techniek, gevraagd: keuze.gevraagd, reden: keuze.reden,
    spoor: !!keuze.goedkoperMogelijk, bewezenGedekt: gedekt };
}

function schrijfDoor() {
  if (!bewaarplek) return;
  try { bewaarplek.schrijf(Object.assign({ sinds }, JSON.parse(JSON.stringify(tellers)))); }
  catch (e) { /* meten mag nooit stukmaken; de tellers blijven in dit proces staan */ }
}

/* DE RUWE STAND. Alleen tellers, `sinds` en of ze duurzaam zijn -- geen
   percentages en geen verantwoordingsproza. Die horen bij wie RAPPORTEERT
   (scripts/router.js), niet bij wie MEET: BESTUUR.md houdt die twee lagen
   uitdrukkelijk uit elkaar, zodat niet twee schermen op een dag iets anders
   over hetzelfde zeggen. Een noemer van nul blijft hier dus gewoon nul, en het
   is de rapporteur die daar NIET_GEMETEN van maakt in plaats van 0%. */
function stand() {
  return {
    sinds,
    duurzaam: !!bewaarplek,
    totaal: Object.assign({}, tellers.totaal),
    per: Object.fromEntries(Object.keys(tellers.per).map(k => [k, Object.assign({}, tellers.per[k])])),
    grens: (bewaarplek ? 'Tellers die een herstart overleven. ' :
      'Tellers van DIT PROCES; een herstart zet ze op nul, dus dit getal draagt nog geen besluit. ') +
      'De router BESLIST NIETS: elk antwoord komt tot stand zoals het zonder deze meter ook zou zijn.'
  };
}

function nulstel(nu) {
  tellers = leegDoos();
  sinds = nu || klok.nu();
  schrijfDoor();
}

module.exports = { meet, stand, onthoud, nulstel, INGANGEN, RAAKT_NIETS };
