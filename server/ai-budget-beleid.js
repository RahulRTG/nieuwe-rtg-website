/* ============================================================================
   HET BELEID ACHTER HET AI-BUDGET: WAT MAG WIE, EN WAT SLUIT NOOIT.

   ./ai-budget.js is het MECHANISME -- op welke sleutel wordt geteld, in welk
   venster, waar wordt het bewaard. Dit bestand is het BELEID: de bedragen, de
   vensters, de koers en de lijst met oppervlakken die nooit dichtgaan.

   Die twee staan apart omdat ze door verschillende mensen om verschillende
   redenen worden aangeraakt. Een bedrag verandert omdat de eigenaar dat wil;
   het tellen verandert alleen als er iets stuk is. Wie hier een getal wijzigt,
   hoeft de telling niet te begrijpen -- en dat is precies de bedoeling.

   WAAROM ZE ZIJN ZOALS ZE ZIJN staat in README.md ("Het AI-budget per
   persoon"). Wat je moet weten voordat je een getal aanraakt staat hieronder,
   bij het getal zelf.
   ========================================================================== */
'use strict';

/* Hoeveel dollar is een euro. PEILDATUM 2026-08-19, en dit is een AANNAME die
   iemand hoort na te kijken: dit huis heeft geen koersbron en gaat er ook geen
   verzinnen. Te zetten met RTG_AI_KOERS. */
const KOERS_PEILDATUM = '2026-08-19';
const USD_PER_EUR = 1.08;

function koers() {
  const v = Number(process.env.RTG_AI_KOERS);
  return Number.isFinite(v) && v > 0 ? v : USD_PER_EUR;
}
const usdNaarEuro = (usd) => (Number(usd) || 0) / koers();

/* De budgetten, in EUROCENT zodat er nergens met halve centen wordt gerekend.
   `venster` is 'dag' of 'maand'. Te overschrijven met RTG_AI_BUDGETTEN (JSON),
   zodat een wijziging geen codewijziging hoeft te zijn. */
const BUDGETTEN = {
  gratis:    { venster: 'dag',   cent: 50 },
  rtg:       { venster: 'maand', cent: 1500 },
  lifestyle: { venster: 'maand', cent: 500000 },
  business:  { venster: 'maand', cent: 500000 }
};

function budgetten() {
  if (!process.env.RTG_AI_BUDGETTEN) return BUDGETTEN;
  try {
    const uit = {};
    const eigen = JSON.parse(process.env.RTG_AI_BUDGETTEN);
    for (const pas of Object.keys(BUDGETTEN)) {
      const b = eigen[pas];
      uit[pas] = (b && ['dag', 'maand'].includes(b.venster) && Number.isFinite(Number(b.cent)) && Number(b.cent) >= 0)
        ? { venster: b.venster, cent: Number(b.cent) } : BUDGETTEN[pas];
    }
    return uit;
  } catch (e) { return BUDGETTEN; }
}

/* De pas van een sessie. Dezelfde vertaling als kern/ledenregister.js maakt:
   tier 'guest' heet naar buiten 'gratis'. Geen sessie = gratis, want uitloggen
   hoort geen manier te zijn om ergens onderuit te komen. */
const PASSEN = ['gratis', 'rtg', 'lifestyle', 'business'];
function pasVan(sessie) {
  const tier = sessie && sessie.tier;
  if (!tier || tier === 'guest') return 'gratis';
  return PASSEN.includes(tier) ? tier : 'rtg';
}

/* ---------------------------------------------------------------------------
   WAT NOOIT SLUIT, EN WAAROM PER STUK.

   Deze lijst is de tegenhanger van KINDGERICHT in test/modelkeuze.test.js: daar
   staat waar het model niet lichter mag worden, hier waar het budget niet mag
   afsluiten. Dezelfde reden -- wat een kind te horen krijgt is geen kostenpost
   (LEVEN.md: nooit sturen maar openen; CLAUDE.md: leren is geen wedstrijd).

   Het is een PADLIJST en geen vlag die elke aanroeper zelf zet, want een vlag
   die je moet onthouden ben je een keer vergeten -- en dan valt een kind stil.
   Zelfde redenering als de 18+-grens in CLAUDE.md: de regel staat op een plek
   en nieuwe gevallen hangen eraan.

   Deze aanroepen worden WEL geteld. Je wilt zien wat de Foundation kost; hij
   wordt er alleen niet op afgesloten. Het huisplafond (./ai-meter.js) blijft er
   als noodrem overheen staan -- dat is de grens die er is voor een lek, niet
   voor een lid.
--------------------------------------------------------------------------- */
const VRIJGESTELD = {
  '/api/foundation': 'de RTFoundation-app zelf: schoolbord, schrift en de buddy van een kind',
  '/api/rtf': 'RTF-school, leerlingportaal, leren-huis en de gezinsmomenten rond een baby',
  '/api/bijles': 'Rahul Bijles: een geduldige bijlesdocent hoort niet halverwege een som te stoppen',
  '/api/onderwijs': 'lesstof en overhoringen; een afgebroken uitleg leert een kind iets verkeerds',
  '/api/member/leren': 'de leerlaag voor leden, met schrijfcoach en projecten voor gezinnen'
};
const VRIJ_PADEN = Object.keys(VRIJGESTELD);

function vrijgesteldPad(pad) {
  const p = String(pad || '');
  return VRIJ_PADEN.some(v => p === v || p.startsWith(v + '/'));
}

module.exports = { koers, usdNaarEuro, budgetten, pasVan, vrijgesteldPad,
  BUDGETTEN, VRIJGESTELD, KOERS_PEILDATUM };
