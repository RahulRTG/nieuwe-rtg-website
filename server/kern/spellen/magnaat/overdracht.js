/* Magnaat: DE OVERDRACHT -- wat een organisatie WEET, en van wie.

   ================== DE WET ==================

   **De wereld weet wat waar is. Een ploeg weet alleen wat zij kan ZIEN of wat
   aan haar is OVERGEDRAGEN.**

   Dat ene onderscheid is deze hele module. Tot nu toe was informatie in Magnaat
   een magische gedeelde waarheid: zodra er iets in de staat stond, wist iedereen
   het. Daarmee bestaat er geen enkele menselijke frictie -- iedereen is
   alwetend, en dan is een organisatie alleen een rekenmachine met rollen.

   DRIE INFORMATIEBRONNEN, EN ZE MOGEN NOOIT EEN WORDEN:

     waarneembaar   wat je met eigen ogen ziet als je binnenkomt. De koeling
                    staat op noodkoeling, de capaciteit is lager, er staat een
                    volle bak. Dat is de STAND van de wereld (./storing.js) en
                    die is voor iedereen die er staat gelijk.
     overdracht     wat de vorige ploeg BEWUST heeft achtergelaten: wat hij deed
                    en waarom, waar de beperking zit, wat er nog moet gebeuren.
                    Dit bestand.
     audit          wat achteraf volledig te reconstrueren is, voor wie daar de
                    rol voor heeft: wie besloot, wat het kostte
                    (./storing-keten.js).

   HIER IS EEN FOUT GEMAAKT DIE DEZE MODULE REPAREERT. De eerste versie van de
   werkvloerstrook "sinds je vorige dienst" las rechtstreeks uit de AUDIT: de
   vakkracht kreeg de naam van zijn eigenaar te zien en het bedrag van de
   maandrekening. Dat is precies het alwetend worden hierboven, en het is
   bovendien een privacylek: een werknemer heeft niets te maken met wat zijn
   werkgever uitgaf. Wat de vloer nu leest is (a) wat waarneembaar is en (b) wat
   er aan hem is overgedragen. Verder niets.

   ================== WAT DOORGEVEN KOST ==================

   EEN MOMENT VAN JE DIENST. Geen apart budget, geen knop die gratis is: de
   overdracht schrijven kost je precies wat een voorval oppakken kost, want dat
   is wat het in het echt ook is. Dat maakt de keuze eerlijk EN verklaart meteen
   waarom er in de wereld zo slecht wordt overgedragen: dat ene moment is een
   bestelling die blijft staan, en die kost nu geld terwijl de overdracht pas
   morgen iets oplevert.

   ER STAAT GEEN SCORE TEGENOVER. Geen `overdrachtkwaliteit: 62%`, geen
   teamworkpunten. Wat een ontbrekende overdracht kost is ARBEIDSTIJD: de
   volgende ploeg moet uitzoeken wat er speelt, en dat loopt via `vast` -- de
   post die er al was en die ./storing.js voor een noodoplossing al gebruikt
   ("iemand is er elke dienst mee bezig"). Een ongedocumenteerde noodoplossing
   kost simpelweg MEER van diezelfde post.

   EN DE SITUATIE BESLIST, net als bij `uit bedrijf`. Een storing die morgen
   verholpen is, is het moment niet waard. Een die maanden sleept wel. De
   getallen hieronder zijn GEMETEN met scripts/magnaat-overdracht.js en niet
   gekozen; wie ze verzet, hoort dat script opnieuw te draaien. Wat die meter
   vond: in een volle zaak loont doorgeven pas vanaf een maand of drie, in een
   rustige meteen -- want daar kost een moment van je dienst bijna niets.

   ================== EN WIE BETAALT ER EIGENLIJK ==================

   DE KOSTEN EN DE BATEN LANDEN OP VERSCHILLENDE MENSEN, en dat is geen
   weeffout maar het scherpste dat deze laag oplevert. Wie doorgeeft betaalt met
   DERVING OP ZIJN EIGEN DIENST -- zichtbaar, vanavond, in euro's die op zijn
   scherm staan. Wat het oplevert is minder ARBEIDSTIJD op de maandrekening van
   de ZAAK, en die regel ziet een vakkracht nooit.

   Dat is precies waarom er in het echt zo slecht wordt overgedragen, en het komt
   hier gratis uit de rollen zelf. Er is geen enkele stat voor nodig, geen
   `teamwork: 84`, geen morele nudge. De prikkel van de mens loopt niet gelijk
   met het belang van het bedrijf -- en een eigenaar die dat wil veranderen,
   moet er iets aan DOEN in plaats van het aan te zetten.

   ================== WAT ER NIET IN STAAT ==================

   GEEN VRIJE TEKST. Magnaat heeft met opzet geen chat tussen ploegen, en een
   invulveld zou er een zijn -- plus iets waar de motor niets van kan begrijpen.
   Wat er wordt overgedragen zijn FEITEN die de dienst zelf al kent: wat je deed,
   wat de beperking is, wat er nog openstaat. De KEUZE is of je het doorgeeft;
   de inhoud is geen creatief werk.

   EN GEEN VERKEERDE MELDING -- nog niet. "Iemand geeft iets door dat niet klopt"
   is een derde soort fout (een communicatiefout naast een operationele en een
   overdrachtsfout) en vraagt dat een mens een BEWERING kan doen die onwaar kan
   zijn. Dat is een laag op zichzelf en staat hier bewust niet half in. */
'use strict';

/* WAT EEN ONGEDOCUMENTEERDE INGREEP EXTRA KOST, als factor op `vast`.

   GEMETEN, NIET GEKOZEN (scripts/magnaat-overdracht.js). De eis was dat geen van
   de twee knoppen altijd wint: doorgeven kost een moment van je dienst en dus
   nu geld, niet doorgeven kost elke volgende maand arbeidstijd. Bij een storing
   die een maand duurt hoort niet-doorgeven goedkoper te zijn, bij een die een
   half jaar sleept hoort doorgeven ruim te lonen. */
const ONWETEND_VAST = 1.06;

/* Welke standen om een overdracht VRAGEN. Een zaak waar niets aan de hand is
   heeft niets over te dragen, en een storing die gewoon open ligt is voor
   iedereen zichtbaar precies wat hij is -- daar valt niets uit te leggen.

   HET GAAT OM WAT JIJ VERANDERD HEBT ZONDER DAT DE VOLGENDE WEET WAAROM. Een
   noodkoeling die draait en een compartiment dat uit bedrijf is, zien er van
   buiten uit als "het loopt" -- en dat is precies de gevaarlijke soort. */
const VRAAGT_OVERDRACHT = ['workaround', 'uit'];

const lijst = (v) => (v.overdrachten = v.overdrachten || []);

/* Of deze storing op dit moment zonder uitleg staat. Twee helften, en ze moeten
   allebei waar zijn: de stand is er een die om uitleg vraagt, en er is sinds die
   stand gezet werd niets overgedragen. */
function onwetend(v, s) {
  if (!s || !VRAAGT_OVERDRACHT.includes(s.staat)) return false;
  return !lijst(v).some(o => o.soort === s.soort && o.maand >= s.sindsStand);
}

/* WAT DE MAAND ERVAN MERKT: een factor op `vast`, opgeteld over alles wat er
   zonder uitleg staat. Precies de vorm van ./storing.js `effect`, en om dezelfde
   reden -- er komt geen post bij, er komt geen valuta bij, en
   scripts/magnaat-pomp.js hoort er niets van te merken behalve dat er meer geld
   de wereld uit gaat. */
function effect(v, openstaand) {
  let vast = 1;
  for (const s of openstaand) if (onwetend(v, s)) vast *= ONWETEND_VAST;
  return { vast };
}

/* IETS OVERDRAGEN. Geen tekst maar een FEIT: bij deze storing, in deze maand,
   door deze mens, met deze stand -- en wat hij deed. Meer is er niet nodig, want
   de volgende ploeg leest hetzelfde als wat er werkelijk gebeurd is. */
function noteer(v, { maand, soort, wie, rol, staat, deed }) {
  if (!v || !soort) return null;
  const o = { maand, soort, wie: wie || null, rol: rol || null, staat, deed: deed || null };
  lijst(v).unshift(o);
  /* Een overdracht die niet meer bij de huidige stand hoort, is een oude
     waarheid. Hij verdwijnt vanzelf zodra ./storing.js de storing opruimt --
     zie `ruim` hieronder -- en de lijst blijft daarom kort zonder afkapping die
     midden in een lopend incident kan toeslaan. */
  return o;
}

/* WAT DE VOLGENDE PLOEG KRIJGT: alleen overdrachten die bij de HUIDIGE stand
   horen, en alleen van na jouw vorige dienst. Een overdracht over een
   noodkoeling die inmiddels gerepareerd is, is geen informatie maar ruis. */
function voor(v, openstaand, sinds, behalve) {
  const nu = new Set(openstaand.filter(s => VRAAGT_OVERDRACHT.includes(s.staat)).map(s => s.soort));
  return lijst(v)
    .filter(o => nu.has(o.soort) && o.maand >= sinds && o.wie !== behalve)
    .slice().reverse();
}

/* Overdrachten opruimen waarvan de storing niet meer bestaat. Draait mee met
   ./storing.js `ruim`, op dezelfde plek en om dezelfde reden: een lijst die
   alles bewaart is telemetrie noch geschiedenis. */
function ruim(v, openstaand) {
  const nu = new Set(openstaand.map(s => s.soort));
  v.overdrachten = lijst(v).filter(o => nu.has(o.soort));
}

module.exports = { ONWETEND_VAST, VRAAGT_OVERDRACHT, lijst, onwetend, effect,
  noteer, voor, ruim };
