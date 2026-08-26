/* HOEVEEL STAAT ER PER LID IN DE KLUIS, in bytes.

   Voor de kostprijslaag (KOSTEN.md), die opslag als een STAND peilt en niet als
   een stroom optelt: er staan op enig moment zoveel gigabytes, en die tel je
   niet op maar meet je.

   HIJ HOORT BIJ ./bestanden.js EN STAAT ERNAAST, en dat is een compromis dat
   benoemd hoort te worden. Die module bezit de VORM van de kluis (borden per
   lid, items met versies, elk met eigen bytes) en had deze functie dus horen te
   dragen -- maar dat bestand zat op 10164 byte en ging er met een functie erbij
   overheen. Dus staat hij hier, leest hij dezelfde vorm, en is dat een tweede
   plek die stil kan breken als die vorm verandert.

   Daarom hangt er een toets aan die een ECHT bestand uploadt via de gewone weg
   en daarna hier de bytes terugleest. Verandert de vorm van de kluis, dan zakt
   die toets -- en dat is precies het gat dat een tweede lezer anders open laat:
   een opslagteller die nul teruggeeft, ziet er uit als een lid dat niets heeft
   opgeslagen.

   DE SLEUTEL IS 'lid:<sessiesleutel>' -- precies de vorm van een kostendrager
   (kern/kosten/haak.js). Dat is geen toeval maar dezelfde pseudonieme handgreep:
   geen naam, geen e-mailadres, alleen de sleutel waarmee de facturen ook al
   werken.

   WAT HIER NIET IN ZIT, en dat hoort erbij: de media van zaken
   (server/media.js), de back-ups en de bijlagen van RTmail. Die staan elders en
   worden hier niet meegeteld. De kostenlaag zegt daarom bij deze soort met
   zoveel woorden wat er WEL gemeten is; een getal dat zich voordoet als "alle
   opslag" terwijl het de ledenkluis is, is erger dan geen getal. */
'use strict';

module.exports = ({ db }) => {
  function opslagPerLid() {
    const uit = {};
    const borden = (db.data && db.data.bestanden) || {};
    for (const k of Object.keys(borden)) {
      const b = borden[k] || {};
      let n = 0;
      for (const it of (b.items || [])) {
        n += it.bytes || 0;
        for (const v of (it.versies || [])) n += v.bytes || 0;
      }
      if (n > 0) uit[k] = n;
    }
    return uit;
  }
  return { bestandenOpslagPerLid: opslagPerLid };
};
