/* ============================================================================
   DE EENHEID VAN GELD -- een plek die zegt wat een bedrag IS.

   DIT BESTAND KOMT UIT EEN METING, en niet uit netheid. COMMERCE.md hield "de
   91 optellingen" overeind als de duurste post: 91 plekken die van regels een
   bedrag maken, elk een eigen kans om anders af te ronden. Bij het natellen
   bleek het risico ergens anders te zitten, en scherper:

     kern/util.js         centen(n) = Math.round(n * 100) / 100      -> EURO'S
     school/financien.js  centen(v) = Math.round(v * 100)            -> CENTEN
     kern/labfonds.js     centen(euro) = Math.round(euro * 100)      -> CENTEN
     kern/horeca.js       centen(v) = Math.round(v)                  -> ONGEWIJZIGD

   Vier functies, een naam, drie uitkomsten. En daarnaast dragen tientallen
   velden `.centen` een geheel getal in centen. `centen(x)` LEEST als "maak er
   centen van" en doet dat in kern/util.js juist niet -- die rondt euro's af en
   laat ze euro's. Er is vandaag niets kapot (nagelopen: de school en het
   labfonds krijgen euro's, de horeca krijgt centen), maar dat is geluk en geen
   ontwerp. Dezelfde familie fout kostte deze laag al een keer een factor
   honderd: `bedrag` in kern/mall/aanbod.js staat in EURO'S en werd als centen
   gelezen (zie kern/commerce/koopbaarlijst.js).

   DUS: EEN PLEK, EN NAMEN DIE NIET TE VERWARREN ZIJN. `naarCenten` gaat van
   euro naar cent, `naarEuro` terug, `rondEuro` rondt af zonder van eenheid te
   veranderen. Geen van de drie heet `centen`, en dat is de hele bedoeling.

   CENTEN ZIJN GEHELE GETALLEN. Alles binnen dit huis dat een bedrag VASTHOUDT,
   hoort het in centen te doen: een som in centen is exact, een som in euro's is
   drijvende komma en verliest zwijgend een cent zodra er genoeg regels bij
   elkaar komen. Euro's zijn er om te TONEN en om van buiten binnen te komen.

   WAT DIT NIET IS. Geen afrekening en geen btw -- die wonen in
   kern/commerce/afrekening.js en kern/fiscaal/tarief.js, elk op een plek, en
   daar komt hier niets naast. Dit bestand weet alleen wat een bedrag is.
   ========================================================================== */
'use strict';

/* HEET REKENGRENS EN NIET `REKENGRENS`. Dat woord staat al op drie plekken en
   betekent daar telkens een BELEIDSplafond: een miljoen euro op een geldpot
   (kern/geldbeleid), 50.000 per transactie (kern/directpay), 5.000 bij het
   podium. Dit is iets anders: geen plafond dat iemand heeft gekozen maar de
   grens waarboven een getal in dit huis altijd een invoerfout is. Een som die
   stilletjes doorloopt tot Infinity is erger dan een weigering. */
const REKENGRENS = 1000000000;

/* `Number(null)` is 0 en `Number('')` ook, en dat is precies hoe een leeg veld
   een boeking van nul euro wordt zonder dat iemand het merkt. Leeg is hier geen
   nul maar geen bedrag. */
const getal = (v) => {
  if (v == null || v === '' || typeof v === 'boolean') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/* Van euro (van buiten, uit een formulier, uit een domein dat in euro's rekent)
   naar centen. `null` bij iets dat geen getal is -- en niet 0: nul is een
   bedrag, onleesbaar is er geen. Dat onderscheid is precies waar een stille
   nul-boeking vandaan komt. */
function naarCenten(euro) {
  const n = getal(euro);
  if (n == null) return null;
  const c = Math.round(n * 100);
  return Math.abs(c) > REKENGRENS ? null : c;
}

/* Terug, om te TONEN. Nooit om mee te rekenen: wie in euro's verder rekent,
   haalt de drijvende komma terug die we net kwijt waren. */
function naarEuro(centen) {
  const n = getal(centen);
  return n == null ? null : n / 100;
}

/* Afronden ZONDER van eenheid te veranderen. Dit is wat kern/util.js `centen`
   noemt, en de naam daar is de fout die dit bestand rechtzet. */
function rondEuro(euro) {
  const n = getal(euro);
  return n == null ? null : Math.round(n * 100) / 100;
}

/* EEN REGELBEDRAG: stuk maal aantal, in centen. Dit is de som die volgens de
   meting op 92 plekken staat. Hij staat hier niet om die 92 te vervangen -- dat
   is het werk van jaren dat COMMERCE.md beschrijft -- maar zodat wat er NIEUW
   bijkomt een plek heeft waar de eenheid vastligt. */
function regelCenten(stukCenten, aantal) {
  const s = getal(stukCenten), n = getal(aantal);
  if (s == null || n == null) return null;
  if (!Number.isInteger(s)) return null;          // centen zijn gehele getallen
  const a = Math.floor(n);
  if (a < 0) return null;
  const c = s * a;
  return Math.abs(c) > REKENGRENS ? null : c;
}

/* Een som van centen. Weigert zodra er iets tussen zit dat geen geheel getal
   is: een lijst met een euro-bedrag ertussen levert een totaal op dat er
   plausibel uitziet en honderd keer te laag is. */
function somCenten(lijst) {
  if (!Array.isArray(lijst)) return null;
  let t = 0;
  for (const x of lijst) {
    const n = getal(x);
    if (n == null || !Number.isInteger(n)) return null;
    t += n;
  }
  return Math.abs(t) > REKENGRENS ? null : t;
}

module.exports = { naarCenten, naarEuro, rondEuro, regelCenten, somCenten, REKENGRENS };
