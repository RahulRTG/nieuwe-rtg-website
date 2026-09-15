/* DE TELLERS VAN DE ROUTERSCHADUW -- waar de aantallen wonen, en verder niets.

   AFGESPLITST VAN ./routermeting.js, en niet omdat dat bestand te groot werd
   maar omdat de manier waarop het te groot werd de fout zelf was. De keuring
   kent twee banden (scripts/keuring.js par. 8): boven de 10 kB is een
   overtreding, en 9400-10240 is een waarschuwing. Die tweede band bestaat omdat
   *"een grens die alleen de bijna-overtreders noemt, een aanmoediging is om er
   net onder te blijven"* -- en dit bestand is drie keer achter elkaar getrimd om
   op 9993 te landen. Dat is schrijven naar de limiet, precies wat die band
   meldt.

   DE NAAD IS ECHT EN NIET COSMETISCH. Er staan drie vragen naast elkaar, en ze
   veranderen om verschillende redenen:

     ./routeropslag.js   WAAR blijven de getallen? (kent db en save, kent geen
                         enkele teller)
     dit bestand         WELKE getallen zijn er, en hoe overleven ze een
                         herstart? (kent tellers, kent geen vraag)
     ./routermeting.js   WAT is er waargenomen? (kent de vraag en de goedkope
                         laag, kent geen opslag)

   TELLERS EN GEEN JOURNAAL. Er komt hier geen vraag en geen sessiesleutel
   binnen: `tel()` neemt een ingang en een stel vlaggen, en verder niets. Dat is
   geen afspraak maar de vorm -- er is geen parameter om een mens in te stoppen.
   Zelfde keuze als kern/kosten/ en kern/stuur/schaduwtelling.js. */
'use strict';

const klok = require('../../lib/klok');

/* De ingangen waar een mens Rahul een vraag stelt. Gesloten lijst: een onbekende
   naam telt mee onder `onbekend` in plaats van er stil bij te komen, want een
   ingang die niemand heeft verklaard hoort op te vallen. */
const INGANGEN = Object.freeze(['fluister', 'ai', 'chat']);

/* De twee verschilvakken dragen het besluit: `spoorZonderDekking` (de router zei
   "kan goedkoper" en dat kon niet -- omdraaien laat daar een standaardzin een
   modelantwoord verdringen) en `dekkingZonderSpoor` (hij zei "model nodig" en
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

function neemOver(doel, bron) {
  for (const k of Object.keys(doel)) if (Number.isFinite(bron[k])) doel[k] = bron[k];
}

/* De aanroeper geeft een plek met lees() en schrijf(). Zonder die plek tellen we
   in dit proces EN zeggen we dat erbij: een teller die bij elke herstart op nul
   springt draagt geen besluit, en mag zich dus niet duurzaam noemen. */
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

function schrijfDoor() {
  if (!bewaarplek) return;
  try { bewaarplek.schrijf(Object.assign({ sinds }, JSON.parse(JSON.stringify(tellers)))); }
  catch (e) { /* meten mag nooit stukmaken; de tellers blijven in dit proces staan */ }
}

/* EEN WEGING BIJSCHRIJVEN. Neemt vlaggen en geen vraag: er is hier structureel
   geen plek waar een mens in past. */
function tel(ingang, v) {
  const naam = INGANGEN.includes(ingang) ? ingang : 'onbekend';
  for (const t of [tellers.per[naam], tellers.totaal]) {
    t.gewogen++;
    if (v.spoor) t.spoor++;
    if (v.gedekt === true) t.bewezenGedekt++;
    if (v.gedekt === null) t.proefMislukt++;
    if (v.spoor && v.gedekt === false) t.spoorZonderDekking++;
    if (!v.spoor && v.gedekt === true) t.dekkingZonderSpoor++;
    if (v.modelAntwoordde === true) t.modelNodig++;
    /* Geen goedkope dekking EN geen model: hier viel het gesprek terug op een
       algemene zin. Eigen teller en geen aftreksom, want `bewezenGedekt` is de
       tegenfeitelijke vraag ("had het gekund") en niet "wie antwoordde" -- die
       twee kunnen allebei waar zijn. */
    if (v.gedekt !== true && v.modelAntwoordde !== true) t.nietsGafAntwoord++;
  }
  schrijfDoor();
}

/* DE RUWE STAND. Alleen tellers, `sinds` en of ze duurzaam zijn -- geen
   percentages en geen verantwoordingsproza. Die horen bij wie RAPPORTEERT
   (scripts/router.js), niet bij wie MEET: BESTUUR.md houdt die twee lagen
   uitdrukkelijk uit elkaar. Een noemer van nul blijft hier dus gewoon nul, en
   het is de rapporteur die daar NIET_GEMETEN van maakt in plaats van 0%. */
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

module.exports = { tel, stand, onthoud, nulstel, INGANGEN };
