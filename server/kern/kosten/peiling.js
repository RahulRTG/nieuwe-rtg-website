/* DE OPSLAGPEILING -- de enige kostensoort die je niet kunt optellen.

   Tokens, verzoeken, berichten en transacties GEBEUREN: je telt ze op op het
   moment dat ze langskomen. Opslag niet. Er staat op enig moment zoveel, en dat
   is een STAND. Wie een stand als stroom telt, rekent een lid dat een maand lang
   niets doet bij elke peiling opnieuw zijn hele kluis aan -- en dan groeit de
   rekening van iemand die niets doet het hardst.

   DUS PEILEN, EN HET GEMIDDELDE HOUDEN. Een GB-maand is een oppervlakte en geen
   momentopname: wie op de dertigste alles weggooit, heeft die maand wel degelijk
   opslag gebruikt. ./meter.js houdt daarom een lopend gemiddelde over de
   peilingen van de maand, met het aantal erbij zodat het overzicht kan zeggen
   hoe hard dat gemiddelde is.

   HOOGUIT EEN KEER PER UUR. De onderhoudsronde draait elke vijf minuten en roept
   dit aan; de rem zit HIER en niet daar. Zo kan elke aanroeper hem gerust vaak
   aanroepen zonder de vraag "hoe vaak is te vaak" te hoeven kennen, en is de
   frequentie op een plek te veranderen.

   BYTES DELEN DOOR EEN MILJARD, dus decimale gigabytes. Dat is de eenheid waarin
   hosters factureren; wie hier door 2^30 deelt, rekent 7% naast de nota van de
   leverancier en komt daar bij de afstemming achter.

   WAT ER NIET IN ZIT: de media van zaken, de back-ups en de bijlagen van RTmail.
   Die staan elders. Het overzicht zegt daarom bij deze soort met zoveel woorden
   wat er WEL gemeten is -- een getal dat zich voordoet als "alle opslag" terwijl
   het de ledenkluis is, is erger dan geen getal. */
'use strict';

const UUR = 3600000;

module.exports = (ctx) => {
  const { d, save, nu, meter, bestandenOpslag } = ctx;

  /* Wanneer is er voor het laatst gepeild? Per SOORT, want er komen er meer bij
     (de media van zaken zijn een tweede bron voor dezelfde soort, en die mag
     zijn eigen ritme hebben). */
  function stand() {
    const k = d();
    if (!k.peilingen || typeof k.peilingen !== 'object') k.peilingen = {};
    return k.peilingen;
  }

  function peilOpslag(forceer) {
    if (!bestandenOpslag || typeof bestandenOpslag.bestandenOpslagPerLid !== 'function') {
      return { ok: false, waarom: 'De ledenkluis is niet aangesloten; er valt niets te peilen.' };
    }
    const st = stand();
    const nuMs = Date.parse(nu());
    const vorige = st.opslag ? Date.parse(st.opslag.op) : 0;
    if (!forceer && Number.isFinite(vorige) && nuMs - vorige < UUR) {
      return { ok: true, overgeslagen: true, vorige: st.opslag.op,
        waarom: 'Er is binnen het afgelopen uur al gepeild; vaker meten maakt het gemiddelde niet beter.' };
    }
    let bytes = {};
    try { bytes = bestandenOpslag.bestandenOpslagPerLid() || {}; }
    catch (e) { return { ok: false, waarom: 'De kluis was niet te lezen: ' + (e.message || 'onbekend') }; }
    let gepeild = 0, totaal = 0;
    for (const drager of Object.keys(bytes)) {
      const gb = (Number(bytes[drager]) || 0) / 1e9;
      if (!(gb > 0)) continue;
      if (meter.peil({ drager, soort: 'opslag', waarde: gb })) { gepeild++; totaal += gb; }
    }
    st.opslag = { op: nu(), dragers: gepeild, totaalGB: meter.afrond(totaal) };
    save();
    return { ok: true, dragers: gepeild, totaalGB: st.opslag.totaalGB, op: st.opslag.op };
  }

  const laatstePeiling = () => stand().opslag || null;

  return { peilOpslag, laatstePeiling, UUR };
};
