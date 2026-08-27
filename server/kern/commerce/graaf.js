/* ============================================================================
   DE COMMERCE-GRAAF -- een leeslaag, en niets anders.

   HIJ SCHRIJFT NIET. Geen save(), geen status, geen voorraadmutatie. De domeinen
   blijven eigenaar van hun eigen waarheid: kern/retail houdt het assortiment,
   kern/fiscaal de btw, kern/pay de waarde, kern/onderneming de voorraad. Deze
   laag legt ze naast elkaar en zegt per ding wat je ermee kunt. Zou hij ook
   schrijven, dan is hij binnen een half jaar de plek waar alles langs moet, en
   dan hebben de domeinen geen eigenaar meer maar een doorgeefluik.

   HIJ BOUWT DE PROJECTIE NIET ZELF. kern/mall/aanbod.js doet dat al -- tien
   bronnen op een gedeelde vorm, met een kapotte bron als `stuk` in plaats van
   als een korter lijstje. Deze laag roept die aan en doet er de werkwoorden bij
   (./koopbaar.js). Een tweede projectie ernaast zou binnen een maand een ander
   idee hebben van wat een aanbieder is (LAT-regel 4).

   ER IS GEEN CACHE OVER AANROEPEN HEEN, en dat is een keuze. Een winkel toont
   voorraad en openingstijden; een gecachete voorraad is een voorraad die liegt
   op precies het moment dat het uitmaakt. De Mall cachet binnen EEN aanroep
   (waardering, bezorging, vestigingen) en dat is genoeg: die cache leeft zo lang
   als de vraag.

   WAT ER MET EEN KAPOTTE BRON GEBEURT is het belangrijkste stuk van dit bestand.
   Hij komt door als `stuk`, met de naam van de bron erbij, en de graaf geeft
   `volledig: false`. Een etalage die stilletjes een leverancier weglaat, is
   erger dan een etalage die zegt dat ze de reizen niet kon ophalen -- dat is
   LAT-regel 5, en kern/mall/bestellingen.js schrijft in zijn kop precies
   waarom.
   ========================================================================== */
'use strict';

const { vanAanbod, waaromNietTeKoop } = require('./koopbaar');

module.exports = ({ aanbodAlles }) => {

  /* Alles wat er nu te koop staat, als koopbaren. `bron` en `verkoper` filteren
     vooraf, zodat een etalage van een winkel niet eerst het hele huis opbouwt om
     er daarna 99% uit te gooien. */
  function alles(filter) {
    const f = filter || {};
    let rijen = [], stuk = [], geweigerdRij = [];
    try {
      const uit = aanbodAlles();
      rijen = (uit && uit.aanbod) || [];
      stuk = (uit && uit.stuk) || [];
      geweigerdRij = (uit && uit.geweigerd) || [];
    } catch (e) {
      /* De aanbodlaag zelf omgevallen. Dat is geen lege winkel maar een stuk
         winkel, en het verschil hoort zichtbaar te zijn. */
      return { ok: true, volledig: false, koopbaren: [], stuk: [{ bron: 'aanbod', fout: String((e && e.message) || e).slice(0, 200) }], geweigerd: [] };
    }

    const koopbaren = [];
    const geweigerd = geweigerdRij.slice();
    for (const rij of rijen) {
      if (f.verkoper && !(rij.aanbieder && rij.aanbieder.code === f.verkoper)) continue;
      if (f.bron && rij.bron !== f.bron) continue;
      if (f.type && rij.type !== f.type) continue;
      const k = vanAanbod(rij);
      if (!k) { geweigerd.push({ bron: rij.bron || '?', reden: 'geen werkwoordregel voor type ' + rij.type }); continue; }
      if (f.alleenKoopbaar && !k.werkwoorden.includes('bevestig')) continue;
      koopbaren.push(k);
    }
    return { ok: true, volledig: stuk.length === 0, koopbaren, stuk, geweigerd: geweigerd.slice(0, 50) };
  }

  /* Een koopbaar bij zijn id. De afrekening vraagt dit per regel, dus de lijst
     wordt EEN keer opgebouwd en daarna bevraagd -- vandaar `opzoeker()` en niet
     een `bij(id)` die elke keer het hele huis doorloopt. Een mand van tien
     regels zou anders tien keer de hele projectie bouwen.

     De opzoeker is een MOMENTOPNAME en zegt dat ook: `op` draagt het tijdstip.
     Wie hem bewaart en morgen weer gebruikt, rekent met de voorraad van
     gisteren. */
  function opzoeker(filter, nu) {
    const uit = alles(filter);
    const index = new Map(uit.koopbaren.map(k => [k.id, k]));
    return {
      op: (typeof nu === 'function' ? nu() : require('../../lib/klok').nu()),
      volledig: uit.volledig,
      stuk: uit.stuk,
      aantal: index.size,
      bij: (id) => index.get(String(id || '')) || null
    };
  }

  /* De etalage van EEN verkoper: wat er bij deze zaak te koop staat, met per
     ding waarom het er niet bij staat als het er niet bij staat. Dat tweede is
     voor de ondernemer en niet voor de koper -- daarom een aparte lijst en geen
     stilte. */
  function etalage(verkoperCode) {
    const uit = alles({ verkoper: verkoperCode });
    const teKoop = uit.koopbaren.filter(k => k.werkwoorden.includes('bevestig'));
    const nietTeKoop = uit.koopbaren.filter(k => !k.werkwoorden.includes('bevestig'))
      .map(k => ({
        id: k.id, titel: k.titel, type: k.type,
        waarom: waaromNietTeKoop(k)
      }));
    return { ok: true, volledig: uit.volledig, stuk: uit.stuk, teKoop, nietTeKoop };
  }

  return { alles, opzoeker, etalage };
};
