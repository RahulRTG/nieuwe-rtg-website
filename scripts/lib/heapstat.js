/* ============================================================================
   DE REKENKANT VAN DE HEAPPROEF -- van vloermetingen naar een UITSPRAAK.

   WAAROM DIT APART STAAT. De meetkant heeft een server, een database en een
   halfuur nodig; deze kant heeft alleen getallen nodig. Zo is de gevaarlijkste
   helft -- het OORDEEL -- te beproeven met verzonnen reeksen waarvan we het
   antwoord al weten: een reeks met een echt lek MOET LEK geven, ruis MOET
   NIET_VAST_TE_STELLEN geven, en een schone reeks MOET STABIEL geven. Een
   oordeelsfunctie die je nooit alle drie hebt zien zeggen, is geen oordeel
   (LAT.md regel 2).

   WAT ER MIS WAS MET DE OUDE MAAT, en dit zijn drie fouten en niet een:

     1. EEN HELLING UIT DRIE PUNTEN, ZONDER SPREIDING. FASE F van de beproeving
        trok een rechte lijn door drie vloeren en noemde de steilheid "MB/min".
        Drie 100M-rondes gaven +638, +897 en -55 MB/min. Die spreiding is
        vijftien keer de drempel van 40; het getal zei dus niets, maar het zag
        er als een getal uit.
     2. STILTE EN VERKEER NA ELKAAR. De stiltemeting liep eerst, de
        verkeersmeting daarna. Alles wat in de tijd oploopt -- een cache die
        vult, een verbindingspoel die groeit, fragmentatie -- landt dan volledig
        op de tweede. Hier lopen ze DOOR ELKAAR (A B B A), zodat een rechte
        drift beide kanten even hard raakt en in het verschil wegvalt.
     3. EEN MINIMUM ALS SCHATTER. rustVloer() nam het laagste van twaalf
        metingen. Een minimum daalt vanzelf als je vaker meet en heeft geen
        spreiding die je kunt aflezen. Hier staat de MEDIAAN, met de spreiding
        ernaast.

   WAT DIT NIET IS. Het interval hieronder is een bootstrap-percentielinterval
   over de gemeten bloktempo's. Het zegt hoe hard DEZE proef zijn eigen
   gemiddelde kent -- niet hoe de server zich morgen gedraagt, en niet dat de
   metingen onafhankelijk zijn (ze delen een server en een uur). Het is de
   ondergrens van de onzekerheid, niet de hele onzekerheid. */
'use strict';

function mediaan(xs) {
  const s = xs.filter(Number.isFinite).slice().sort((a, b) => a - b);
  if (!s.length) return null;
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/* De mediane absolute afwijking, en niet de standaarddeviatie. Een enkele
   uitschieter -- een GC die net anders viel -- trekt een standaarddeviatie mee
   omhoog en verstopt zich daarmee in de spreidingsmaat zelf. */
function mad(xs) {
  const m = mediaan(xs);
  if (m === null) return null;
  return mediaan(xs.map(x => Math.abs(x - m)));
}

/* Van blokken naar tempo's. Elk blok draagt zijn EIGEN begin- en eindvloer, en
   die worden met geen enkel ander blok gedeeld. Dat is met opzet duurder dan
   een ketting van blokgrenzen: bij een ketting deelt elk tempo een meting met
   zijn buurman, zijn de fouten dus gekoppeld, en rekent een bootstrap eroverheen
   een te smal interval uit. Een te smal interval is precies de fout die dit
   instrument moest oplossen.

   Een blok waarvan een vloer ontbrak levert GEEN tempo. Nul invullen zou een
   mislukte meting laten meetellen als "er gebeurde niets". */
function tempos(blokken, blokMinuten) {
  const per = {};
  for (const b of blokken) {
    if (!Number.isFinite(b.begin) || !Number.isFinite(b.eind)) continue;
    (per[b.soort] = per[b.soort] || []).push((b.eind - b.begin) / blokMinuten);
  }
  return per;
}

/* Een deterministische generator: dezelfde invoer geeft hetzelfde interval.
   Met Math.random zou een tweede aanroep op dezelfde cijfers een ander oordeel
   kunnen geven, en dan is het oordeel zelf niet na te rekenen. */
function munt(zaad) {
  let s = (zaad >>> 0) || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}

/* DE t-WAARDE VOOR EEN 90%-INTERVAL (eenzijdig 0,95), uit de tabel. Bewust een
   TABEL en geen formule: hij is met de hand na te kijken, en de fout die hij
   voorkomt zit juist in de staart bij weinig metingen -- daar waar een
   benadering het slechtst is.

   ALLEEN 90%. Een instelbare breedte met een tabel voor een enkele breedte zou
   een leugen zijn: hij zou een ander getal beloven en dit getal geven. */
const T90 = [[1, 6.314], [2, 2.920], [3, 2.353], [4, 2.132], [5, 2.015], [6, 1.943], [7, 1.895],
  [8, 1.860], [9, 1.833], [10, 1.812], [12, 1.782], [15, 1.753], [20, 1.725], [25, 1.708],
  [30, 1.697], [40, 1.684], [60, 1.671], [120, 1.658]];
function tWaarde(df) {
  if (!(df > 0)) return T90[0][1];
  if (df >= 120) return 1.645;
  let vorig = T90[0];
  for (const rij of T90) {
    if (df <= rij[0]) {
      if (rij[0] === vorig[0]) return rij[1];
      const f = (df - vorig[0]) / (rij[0] - vorig[0]);
      return vorig[1] + f * (rij[1] - vorig[1]);
    }
    vorig = rij;
  }
  return 1.645;
}

const gemiddelde = xs => xs.reduce((x, y) => x + y, 0) / xs.length;
function variantie(xs) {
  if (xs.length < 2) return null;
  const m = gemiddelde(xs);
  return xs.reduce((a, x) => a + (x - m) ** 2, 0) / (xs.length - 1);
}

/* Welch: het verschil van twee gemiddelden met ONGELIJKE spreiding en ongelijke
   aantallen. Dit is de kant die het bij weinig metingen goed doet -- de
   t-vermenigvuldiger groeit als de metingen op raken, dus het interval wordt
   breder in plaats van zelfverzekerder. */
function welchInterval(a, b) {
  const va = variantie(a), vb = variantie(b);
  if (va === null || vb === null) return null;
  const sa = va / a.length, sb = vb / b.length;
  const se = Math.sqrt(sa + sb);
  if (!(se > 0)) return { punt: gemiddelde(a) - gemiddelde(b), laag: gemiddelde(a) - gemiddelde(b), hoog: gemiddelde(a) - gemiddelde(b) };
  const df = (sa + sb) ** 2 / ((sa ** 2) / (a.length - 1) + (sb ** 2) / (b.length - 1));
  const punt = gemiddelde(a) - gemiddelde(b), marge = tWaarde(df) * se;
  return { punt, laag: punt - marge, hoog: punt + marge, df };
}

/* Het verschil van de gemiddelden, met een percentielinterval eromheen. Beide
   condities worden onafhankelijk opnieuw getrokken (met teruglegging), en het
   VERSCHIL van die twee gemiddelden is de grootheid waar het interval over
   gaat -- want dat is de grootheid waar het oordeel over gaat. */
function bootstrapInterval(a, b, { trekkingen = 4000, zaad = 20260909 } = {}) {
  if (!a.length || !b.length) return null;
  const r = munt(zaad);
  const trek = xs => { const o = []; for (let i = 0; i < xs.length; i++) o.push(xs[(r() * xs.length) | 0]); return o; };
  const uit = [];
  for (let i = 0; i < trekkingen; i++) uit.push(gemiddelde(trek(a)) - gemiddelde(trek(b)));
  uit.sort((x, y) => x - y);
  const p = q => uit[Math.min(uit.length - 1, Math.max(0, Math.round(q * (uit.length - 1))))];
  return { punt: gemiddelde(a) - gemiddelde(b), laag: p(0.05), hoog: p(0.95) };
}

/* DE BREEDSTE VAN DE TWEE WINT, en dat is geen voorzichtigheid maar een
   gemeten noodzaak. Op de drie 100M-rondes (verkeer 638/897/-55 tegen stilte
   131/0/-115) gaf de bootstrap [127, 849] en dus "LEK" -- terwijl drie metingen
   met een spreiding van 259 dat onmogelijk kunnen dragen. De oorzaak is bekend:
   bij n=3 zijn er maar 27 verschillende trekkingen, dus de staart die het
   interval moet vinden bestaat niet. Welch gaf op diezelfde cijfers ongeveer
   [-313, 1289] en dus "niet vast te stellen", wat het eerlijke antwoord is.

   Geen van beide methodes is overal de beste: de bootstrap heeft geen
   verdelingsaanname en doet het beter bij scheve reeksen, Welch doet het beter
   bij weinig metingen. Door de BREEDSTE te nemen belooft de uitslag nooit meer
   precisie dan een van beide methodes kan dragen. */
function verschilInterval(a, b, opties) {
  if (!a.length || !b.length) return null;
  const bs = bootstrapInterval(a, b, opties), w = welchInterval(a, b);
  if (!w) return bs;
  if (!bs) return w;
  return { punt: bs.punt, laag: Math.min(bs.laag, w.laag), hoog: Math.max(bs.hoog, w.hoog),
    bootstrap: [Number(bs.laag.toFixed(1)), Number(bs.hoog.toFixed(1))],
    welch: [Number(w.laag.toFixed(1)), Number(w.hoog.toFixed(1))] };
}

/* Het interval om EEN reeks, in dezelfde 90%-vorm. Nodig omdat de stilte ook
   op zichzelf beoordeeld moet worden en niet alleen als aftrekpost -- zie de
   uitleg bij `oordeel` hieronder. */
function eenInterval(xs) {
  if (!xs.length) return null;
  const m = gemiddelde(xs), v = variantie(xs);
  if (v === null) return { punt: m, laag: m, hoog: m };
  const se = Math.sqrt(v / xs.length);
  const marge = tWaarde(xs.length - 1) * se;
  return { punt: m, laag: m - marge, hoog: m + marge };
}

/* Van een interval naar een stand, met de drempel als grens. Op een plek, want
   het verkeerslek en het grondlek gebruiken hem allebei en mogen niet uit
   elkaar lopen. */
function standVan(iv, drempel) {
  return iv.hoog <= drempel ? 'STABIEL' : iv.laag > drempel ? 'LEK' : 'NIET_VAST_TE_STELLEN';
}
const STRENGSTE = ['STABIEL', 'NIET_VAST_TE_STELLEN', 'LEK'];
const strengste = (a, b) => STRENGSTE[Math.max(STRENGSTE.indexOf(a), STRENGSTE.indexOf(b))];

/* HET OORDEEL, EN WAAROM HET UIT TWEE VRAGEN BESTAAT.

   De eerste versie hiervan trok de stilte van het verkeer af en noemde dat
   verschil het lek. Dat klinkt zuiver -- het haalt de achtergrond eruit -- maar
   de IJKING van 9 september 2026 liet zien dat het de gevaarlijkste soort lek
   onzichtbaar maakt. Er zat toen een bekend lek van 120 MB/min in de server, op
   een timer. De proef mat +141 MB/min met verkeer en +133 zonder, verschil 8,
   en concludeerde STABIEL. Het lek werd wel GEMETEN en niet BEOORDEELD.

   Dat is geen randgeval: precies de zwaarste lekken van dit huis zitten in de
   achtergrond -- de periodieke snapshot van db.data, de write-behind-flush,
   LISTEN/NOTIFY. Op de 100M-ronde liep de stilte op +131 MB/min, en dat verdween
   in het verschil.

   Er staan daarom TWEE vragen naast elkaar, en de strengste uitslag telt:

     VERKEERSLEK   groeit hij HARDER doordat hij verzoeken afhandelt?
                   (verkeer min stilte, met een interval)
     GRONDLEK      groeit hij AL als hij niets doet?
                   (de stilte op zichzelf, met een interval)

   Ze meten iets anders en zijn allebei nodig. Een server die alleen onder
   verkeer lekt heeft een lek in een requestpad; een server die in rust lekt
   heeft een lek in zijn achtergrond. Alleen het verschil meten laat de tweede
   soort door; alleen de absolute waarde meten schrijft de achtergrond toe aan
   het verkeer.

   Drie standen per vraag, en de derde is geen uitvlucht maar de enige eerlijke
   uitslag wanneer de proef zijn eigen ruis niet onder de drempel krijgt:

     STABIEL                 ook de BOVENgrens ligt onder de drempel.
     LEK                     ook de ONDERgrens ligt boven de drempel.
     NIET_VAST_TE_STELLEN    het interval ligt over de drempel heen.

   `oplossing` is de halve intervalbreedte: het kleinste lek dat DEZE ronde had
   kunnen aantonen. Staat die boven de drempel, dan zijn er meer herhalingen of
   langere blokken nodig -- en niet een ander getal. */
function oordeel({ verkeer, stilte, drempel, opties }) {
  if (!verkeer || !verkeer.length || !stilte || !stilte.length)
    return { stand: 'NIET_VAST_TE_STELLEN', drempel, reden: 'te weinig geldige vloermetingen',
      verkeerslek: null, grondlek: null,
      metingen: { verkeer: (verkeer || []).length, stilte: (stilte || []).length } };

  const dv = verschilInterval(verkeer, stilte, opties);
  const verkeerslek = { stand: standVan(dv, drempel), tempo: Number(dv.punt.toFixed(1)),
    laag: Number(dv.laag.toFixed(1)), hoog: Number(dv.hoog.toFixed(1)),
    oplossing: Number(((dv.hoog - dv.laag) / 2).toFixed(1)),
    perMethode: { bootstrap: dv.bootstrap || null, welch: dv.welch || null } };

  const gi = eenInterval(stilte);
  const grondlek = { stand: standVan(gi, drempel), tempo: Number(gi.punt.toFixed(1)),
    laag: Number(gi.laag.toFixed(1)), hoog: Number(gi.hoog.toFixed(1)),
    oplossing: Number(((gi.hoog - gi.laag) / 2).toFixed(1)) };

  const stand = strengste(verkeerslek.stand, grondlek.stand);
  const noem = (naam, d) => naam + ' ' + d.stand.toLowerCase().replace(/_/g, ' ') +
    ' (' + d.tempo + ' MB/min, [' + d.laag + ', ' + d.hoog + '])';
  return {
    stand, drempel, verkeerslek, grondlek,
    /* De oude naam blijft bestaan en betekent nog steeds hetzelfde: het
       verschil. Wie hem leest moet wel weten dat het OORDEEL er niet meer
       alleen op rust. */
    netto: verkeerslek.tempo, laag: verkeerslek.laag, hoog: verkeerslek.hoog,
    oplossing: Math.max(verkeerslek.oplossing, grondlek.oplossing),
    verkeerMediaan: Number(mediaan(verkeer).toFixed(1)), verkeerSpreiding: Number(mad(verkeer).toFixed(1)),
    stilteMediaan: Number(mediaan(stilte).toFixed(1)), stilteSpreiding: Number(mad(stilte).toFixed(1)),
    metingen: { verkeer: verkeer.length, stilte: stilte.length },
    reden: noem('verkeerslek', verkeerslek) + '; ' + noem('grondlek', grondlek) +
      ' -- de strengste telt'
  };
}

module.exports = { mediaan, mad, tempos, verschilInterval, welchInterval, bootstrapInterval,
  eenInterval, standVan, strengste, tWaarde, oordeel, munt };
