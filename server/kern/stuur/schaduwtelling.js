/* WAT DE HERKOMSTPOORT ZOU HEBBEN GESLOTEN -- opgeteld over alle gesprekken.

   CONTROLPLANE.md: je kunt niet afdwingen wat nooit in de schaduw heeft
   gelopen. Die schaduw draait al -- ./lusstap.js weegt elke AI-aanroep en zet
   `schaduw: true` op wat hij zou hebben gesloten -- maar hij telt PER GESPREK en
   verdwijnt daarna. Daarmee is de vraag "hoe vaak zou hij bijten" niet te
   beantwoorden, en dan is de vlag omzetten een gok in plaats van een besluit.
   Een schaduw die niemand leest, is geen schaduw.

   DIT IS EEN TELLER EN GEEN JOURNAAL, en dat is de dragende grens. De verleiding
   is om per geval vast te leggen wie wat probeerde -- dan kun je later "even
   kijken". Maar wat hier gemeten wordt is de PRIJS VAN EEN BELEIDSKNOP, en
   daarvoor is nul informatie over een mens nodig: het aantal per wereld en per
   pad volstaat. Zelfde keuze als kern/kosten/: de meter houdt tellers en geen
   journaal, want een gedragslogboek per lid is voor deze vraag niet nodig.
   `noteer()` weigert daarom alles wat op een identiteit lijkt.

   HIJ WORDT NIET BEWAARD, en het antwoord zegt dat er zelf bij. Deze telling
   staat in het geheugen van het proces en begint bij elke herstart opnieuw.
   Dat is met opzet -- er komt geen collectie bij voor een getal dat een besluit
   van een paar weken draagt -- maar het betekent wel dat "achttien" gelezen moet
   worden als "achttien sinds die datum", en nooit als "achttien ooit". Vandaar
   `sinds` in elk antwoord, en vandaar dat er geen enkele plek is waar het getal
   zonder die datum te krijgen is.

   WAT HIJ NIET ZEGT: of de poort GELIJK had. Hij telt hoe vaak de poort zou
   hebben gesloten, niet hoe vaak dat terecht was geweest. Een hoog getal kan
   betekenen dat de AI vaak wordt gevoed met onvertrouwde inhoud, of dat de
   herkomstregel te breed staat. Dat onderscheid is een oordeel en geen meting,
   en het staat als `nietGemeten` in de uitslag in plaats van dat het wordt
   weggelaten. */
'use strict';

/* Wat op een identiteit lijkt. Bewust breed en bewust fail-closed: bij twijfel
   telt de regel niet mee in plaats van dat er een codenaam in een teller landt.
   Dezelfde vorm als de actor-keuring in kern/envelop.js, en om dezelfde reden --
   deze getallen kunnen een scherm en straks een export bereiken. */
const LIJKT_OP_IEMAND = /@|\bcn-|\blid:|\buser-|\d{6,}/;

const TELLERS = new Map();      // "wereld|pad" -> { wereld, pad, gewogen, zouSluiten }
let SINDS = new Date().toISOString();

function sleutel(wereld, pad) { return String(wereld || 'onbekend') + '|' + String(pad || 'onbekend'); }

/* Eén gewogen aanroep. `zouSluiten` is of de poort hem in de bijtende stand had
   tegengehouden -- niet of hij dat werkelijk deed. */
function noteer(wereld, pad, zouSluiten) {
  const w = String(wereld || 'onbekend');
  const p = String(pad || 'onbekend');
  /* Een pad is een pad. Staat er iets in dat op een mens lijkt (een id in de
     URL, een adres), dan telt de regel mee onder een schuilnaam in plaats van
     dat de teller een identiteit gaat dragen. Weglaten zou het getal stil
     verlagen, en dat is erger. */
  const veilig = LIJKT_OP_IEMAND.test(p) ? '(pad met een kenmerk erin)' : p;
  const s = sleutel(w, veilig);
  const t = TELLERS.get(s) || { wereld: w, pad: veilig, gewogen: 0, zouSluiten: 0 };
  t.gewogen++;
  if (zouSluiten) t.zouSluiten++;
  TELLERS.set(s, t);
}

/* De stand, per wereld opgeteld en met de zwaarste paden erbij.

   Beide getallen staan er, en dat is geen dubbeling: 3 van de 4 is een andere
   uitslag dan 3 van de 4000, en met alleen `zouSluiten` zijn die twee niet uit
   elkaar te houden. Een percentage staat er NIET -- bij een handvol metingen is
   dat een getal met een valse precisie eromheen. */
function stand() {
  const perWereld = new Map();
  for (const t of TELLERS.values()) {
    const w = perWereld.get(t.wereld) || { wereld: t.wereld, gewogen: 0, zouSluiten: 0, paden: [] };
    w.gewogen += t.gewogen;
    w.zouSluiten += t.zouSluiten;
    if (t.zouSluiten) w.paden.push({ pad: t.pad, zouSluiten: t.zouSluiten, gewogen: t.gewogen });
    perWereld.set(t.wereld, w);
  }
  const werelden = [...perWereld.values()].sort((a, b) => b.zouSluiten - a.zouSluiten);
  for (const w of werelden) w.paden.sort((a, b) => b.zouSluiten - a.zouSluiten);
  return {
    sinds: SINDS,
    bewaard: false,
    werelden,
    totaal: werelden.reduce((n, w) => n + w.gewogen, 0),
    totaalZouSluiten: werelden.reduce((n, w) => n + w.zouSluiten, 0),
    grens: 'Deze telling staat in het geheugen van dit proces en begint bij elke herstart opnieuw. ' +
      'Lees haar als "sinds ' + SINDS + '" en nooit als een totaal over de levensduur.',
    nietGemeten: 'of de poort GELIJK had. Geteld wordt hoe vaak hij zou sluiten, niet hoe vaak dat ' +
      'terecht was -- een hoog getal kan betekenen dat de AI vaak onvertrouwde inhoud leest, of dat ' +
      'de herkomstregel te breed staat. Dat onderscheid is een oordeel en geen meting.'
  };
}

/* Alleen voor de toets: de telling loopt per proces en moet tussen twee toetsen
   door leeg kunnen. Zie de valkuil in test/herkomstlus.test.js -- een module die
   zijn toestand vasthoudt, laat de volgende toets de vorige meten. */
function vergeet() { TELLERS.clear(); SINDS = new Date().toISOString(); }

module.exports = { noteer, stand, vergeet };
