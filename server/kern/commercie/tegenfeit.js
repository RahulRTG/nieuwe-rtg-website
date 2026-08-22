/* WAT ZOU ER GEBEURD ZIJN? -- een beleidswijziging tegen de geschiedenis.

   DE VRAAG DIE ./schaduw.js OPENLAAT. Die laag laat een regel meelopen en telt
   wat hij zou hebben tegengehouden. Na een week staat er een getal, en dan komt
   de vraag die er werkelijk toe doet: kan die regel aan? En breder: wat gebeurt
   er als we `maxCenten` van 250 naar 150 zetten -- hoeveel handelingen lopen dan
   anders, om hoeveel geld gaat het, hoeveel extra goedkeuringen levert dat op?

   Zonder antwoord is een beleidswijziging een gok met een percentage erop.

   TWEE DINGEN DIE DIT EERLIJK HOUDEN, en ze zijn allebei belangrijker dan de
   rekensom zelf:

   0. HET VERZINT GEEN RANGORDE. De eerste versie telde "strenger" als
      doorgaan -> niet doorgaan, en noemde TOESTAAN -> BEPERKT dus geen van
      beide -- terwijl er precies dan minder geld beweegt. De verleiding is om
      de acht uitkomsten op een lijn van los naar streng te zetten, maar die
      lijn bestaat niet: is BEPERKT (u krijgt minder) strenger of soepeler dan
      GOEDKEURING (u krijgt alles, met een handtekening)? Dat hangt af van wie
      het vraagt. Er staan daarom VIER assen die elk wel eenduidig zijn, en een
      overgang kan er meer dan een tegelijk raken.
   1. HET DRAAIT DE ECHTE BESLISFUNCTIE. Niet een nagebouwde versie ervan. Een
      tegenfeit dat op een model van je systeem rekent, meet je model en niet je
      systeem -- en modellen en systemen lopen uiteen op precies de gevallen
      waar het om gaat. Vandaar dat `vergelijk` twee echte motoren uit
      ./besluit.js bouwt en er dezelfde verzoeken doorheen stuurt.
   2. HET ZEGT HOEVEEL GESCHIEDENIS HET ZAG. Een antwoord op twaalf verzoeken is
      geen antwoord, en "3 van de 12" leest als een percentage terwijl het ruis
      is. Onder de drempel komt er GEEN getal maar de mededeling dat er te weinig
      is. Dat is de duurste verleiding hier: een precies ogend getal uit een lege
      week.

   EN ER WORDT NIETS GESCHREVEN. Een tegenfeit dat iets muteert is geen
   tegenfeit. Deze module heeft geen db en geen save, en dat is met opzet: dan
   kan het niet.

   WAT DIT NIET IS: een voorspelling. Het is een herhaling. Wat gisteren gebeurde
   onder de nieuwe regel -- meer niet. Dat morgen anders is, staat er niet in, en
   deze module doet ook niet alsof. */
'use strict';

const { maakBesluit, UITKOMST, DOOR } = require('./besluit');

/* GEEN VERZONNEN RANGORDE. De eerste versie hier telde "strenger" als DOOR ->
   niet-DOOR, en noemde TOESTAAN -> BEPERKT dus geen van beide -- terwijl dat
   precies een aanscherping is: er beweegt minder geld. De verleiding is dan om
   de acht uitkomsten op een lijn te zetten van los naar streng, maar die lijn
   bestaat niet: is BEPERKT (u krijgt minder) strenger of soepeler dan
   GOEDKEURING (u krijgt alles, met een handtekening)? Dat hangt af van wie het
   vraagt.

   Dus geen rangorde maar DRIE ASSEN die wel eenduidig zijn. Een overgang kan er
   meer dan een tegelijk raken, en dat is geen fout maar de werkelijkheid. */
const WEIGERT = u => u === UITKOMST.WEIGEREN;
const WACHT = new Set([UITKOMST.GOEDKEURING, UITKOMST.EXTRA_BEWIJS, UITKOMST.UITSTELLEN]);
const MINDER = u => u === UITKOMST.BEPERKT;
const VOORWAARDE = u => u === UITKOMST.OMKEERBAAR;

/* Onder dit aantal is er geen uitspraak. Honderd is niet heilig; het punt is dat
   de grens BESTAAT en dat eronder een zin komt in plaats van een percentage. */
const MINIMUM = 100;

function euro(centen) {
  return '€ ' + (Math.round(centen) / 100).toLocaleString('nl-NL',
    { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

/* DE ALGEMENE VORM. `huidig` en `voorstel` zijn allebei de opties waarmee
   ./besluit.js een motor bouwt -- zoekBevoegdheid, beleid, dagverbruik. Zo kan
   een tegenfeit net zo goed over een BELEIDSgrens gaan als over een andere
   bevoegdheid, zonder dat deze module weet wat er precies verandert. */
function vergelijk({ verzoeken, huidig, voorstel, nu }) {
  const lijst = Array.isArray(verzoeken) ? verzoeken : [];
  const a = maakBesluit({ ...(huidig || {}), nu });
  const b = maakBesluit({ ...(voorstel || {}), nu });

  const overgangen = new Map();      // "VAN->NAAR" -> { aantal, centen, voorbeelden }
  let anders = 0, andersCenten = 0;
  const as = { geweigerd: 0, toegelaten: 0, wachtNu: 0, wachtNietMeer: 0,
    krijgtNuMinder: 0, krijgtNuMeer: 0, voorwaardeErbij: 0, voorwaardeEraf: 0, onbeantwoord: 0 };

  for (const v of lijst) {
    const va = a.beslis(v);
    const vb = b.beslis(v);
    if (va.uitkomst === vb.uitkomst) continue;

    anders += 1;
    const centen = Math.round(Number(v.waardeCenten) || 0);
    andersCenten += centen;
    if (!WEIGERT(va.uitkomst) && WEIGERT(vb.uitkomst)) as.geweigerd += 1;
    if (WEIGERT(va.uitkomst) && !WEIGERT(vb.uitkomst)) as.toegelaten += 1;
    if (!WACHT.has(va.uitkomst) && WACHT.has(vb.uitkomst)) as.wachtNu += 1;
    if (WACHT.has(va.uitkomst) && !WACHT.has(vb.uitkomst)) as.wachtNietMeer += 1;
    if (!MINDER(va.uitkomst) && MINDER(vb.uitkomst)) as.krijgtNuMinder += 1;
    if (MINDER(va.uitkomst) && !MINDER(vb.uitkomst)) as.krijgtNuMeer += 1;
    if (!VOORWAARDE(va.uitkomst) && VOORWAARDE(vb.uitkomst)) as.voorwaardeErbij += 1;
    if (VOORWAARDE(va.uitkomst) && !VOORWAARDE(vb.uitkomst)) as.voorwaardeEraf += 1;
    if (vb.uitkomst === UITKOMST.ONBEKEND || va.uitkomst === UITKOMST.ONBEKEND) as.onbeantwoord += 1;

    const sleutel = va.uitkomst + '->' + vb.uitkomst;
    const r = overgangen.get(sleutel) || { van: va.uitkomst, naar: vb.uitkomst, aantal: 0, centen: 0, voorbeelden: [] };
    r.aantal += 1;
    r.centen += centen;
    if (r.voorbeelden.length < 5)
      r.voorbeelden.push({ actor: v.actor || null, handeling: v.handeling, doel: v.doel == null ? null : String(v.doel),
        waardeCenten: centen, reden: vb.reden });
    overgangen.set(sleutel, r);
  }

  const genoeg = lijst.length >= MINIMUM;
  return {
    gezien: lijst.length,
    genoeg,
    /* De zin die een mens leest. Onder de drempel staat er GEEN percentage: dat
       is precies het getal dat te veel vertrouwen krijgt. */
    zin: !genoeg
      ? 'Te weinig geschiedenis om iets te zeggen: ' + lijst.length + ' van de minimaal ' + MINIMUM + ' verzoeken.'
      : anders + ' van de ' + lijst.length + ' handelingen lopen anders (' +
        Math.round((anders / lijst.length) * 100) + '%), ' + euro(andersCenten) + ' betroffen. ' +
        gevolgzin(as),
    anders: genoeg ? anders : null,
    andersCenten: genoeg ? andersCenten : null,
    gevolgen: genoeg ? as : null,
    overgangen: [...overgangen.values()].sort((x, y) => y.aantal - x.aantal)
  };
}

/* DE VRAAG DIE VANDAAG OP TAFEL LIGT: kan die schaduwregel aan?

   Dit is een SMALLER tegenfeit dan `vergelijk` en het zegt dat ook. Een
   schaduwwaarneming draagt geen bedrag -- de poort weet wie en waarop, niet
   hoeveel -- dus hier komt geen euro uit. Dat is beter dan nul euro melden en
   het als "geen impact" laten lezen. */
function vanSchaduw(stand) {
  const s = stand || {};
  const n = Math.round(Number(s.waarnemingen) || 0);
  const raak = Math.round(Number(s.zouTegenhouden) || 0);
  const genoeg = n >= MINIMUM;
  const rijp = s.rijp || {};
  return {
    id: s.id || null,
    gezien: n,
    genoeg,
    zouTegenhouden: genoeg ? raak : null,
    deel: genoeg && n ? raak / n : null,
    zin: !genoeg
      ? 'Te weinig meegelopen om iets te zeggen: ' + n + ' van de minimaal ' + MINIMUM + ' waarnemingen.'
      : (raak === 0
        ? 'Aanzetten raakt niemand: in ' + n + ' waarnemingen zou deze regel nooit iets hebben tegengehouden. ' +
          'Dat is geen bewijs dat hij veilig is, maar dat hij niets doet.'
        : 'Aanzetten raakt ' + raak + ' van de ' + n + ' verzoeken (' + Math.round((raak / n) * 100) + '%).'),
    /* Geen bedragen, en met zoveel woorden. */
    let: 'Een schaduwwaarneming draagt geen bedrag; wat dit kost is hiermee niet gezegd.',
    magAan: !!rijp.ok,
    magAanReden: rijp.reden || null,
    voorbeelden: Array.isArray(s.voorbeelden) ? s.voorbeelden.slice(0, 5) : []
  };
}

/* De gevolgen in woorden, en alleen wat er werkelijk is. Een zin die met nullen
   volloopt ("0 tegengehouden, 0 vrijgegeven, 0 ...") leest als een rapport en
   zegt niets. */
function gevolgzin(as) {
  const delen = [];
  if (as.geweigerd) delen.push(as.geweigerd + ' worden geweigerd');
  if (as.toegelaten) delen.push(as.toegelaten + ' worden juist niet meer geweigerd');
  if (as.wachtNu) delen.push(as.wachtNu + ' wachten op een handtekening, bevestiging of op morgen');
  if (as.wachtNietMeer) delen.push(as.wachtNietMeer + ' hoeven dat juist niet meer');
  if (as.krijgtNuMinder) delen.push(as.krijgtNuMinder + ' krijgen minder dan gevraagd');
  if (as.krijgtNuMeer) delen.push(as.krijgtNuMeer + ' krijgen het volle bedrag weer');
  if (as.voorwaardeErbij) delen.push(as.voorwaardeErbij + ' mogen alleen nog omkeerbaar');
  if (as.voorwaardeEraf) delen.push(as.voorwaardeEraf + ' hoeven niet meer omkeerbaar');
  if (as.onbeantwoord) delen.push(as.onbeantwoord + ' zijn onder een van beide standen ONBEKEND');
  return delen.length ? delen.join(', ') + '.' : 'De uitkomsten verschuiven zonder een van deze gevolgen.';
}

module.exports = { vergelijk, vanSchaduw, gevolgzin, MINIMUM, UITKOMST };
