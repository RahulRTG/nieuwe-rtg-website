/* Magnaat Economische Motor -- het gezaghebbende journaal.

   Dit is het bewijs, en de rest is een projectie ervan. Drie regels, en ze
   staan hier in code en niet alleen in MAGNAAT.md:

     1. ALLEEN AANVULLEN. Er is geen functie die een gebeurtenis verwijdert,
        vervangt of het journaal inkort. Een correctie is een nieuwe gebeurtenis
        (M-018). Het oude journaal hield 2500 posten vast en gooide de oudste
        weg; hier is geen grens.
     2. HET VOLGNUMMER IS DE RUGGENGRAAT. Per wereld 1, 2, 3 ... zonder gat en
        zonder dubbel. Wie een gebeurtenis aanbiedt die niet precies de volgende
        is, wordt geweigerd -- een gat of een sprong is precies wat een herhaling
        of een onderzoeker later niet meer kan verklaren.
     3. EEN SLEUTEL KOMT EEN KEER VOOR. De idempotentiesleutel woont hier, bij het
        bewijs, en niet meer in de projectie: daar groeide hij met elk journaal
        mee terwijl hij over het journaal ging.

   WAT DIT NIET IS: opslag per rij. In deze opslag is een collectie EEN waarde
   (server/db/collectie-sqlite.js), dus wordt het journaal van een wereld bij
   het wegschrijven nog in zijn geheel geserialiseerd. Dat is een eigenschap van
   de opslaglaag en geen gedrag van de motor: de motor leest het journaal bij
   een gewone beslissing niet (zie `gelezen`), en archiveren of per rij opslaan
   kan later als opslagstrategie zonder de logische historie aan te raken.

   Twee uitvoeringen met hetzelfde gedrag: in het geheugen (voor toetsen en
   rekensommen) en als eigen collectie `magnaatJournaal` in db.data. */
'use strict';

function maakOpslag(kaartVan) {
  let gelezen = 0;
  const boekVan = (wereld) => {
    const kaart = kaartVan();
    if (!kaart[wereld]) kaart[wereld] = { wereld, gebeurtenissen: [], sleutels: {}, ontbrekend: null };
    return kaart[wereld];
  };
  const kijkBoek = (wereld) => kaartVan()[wereld] || null;
  const eerste = (b) => (b && b.ontbrekend ? b.ontbrekend.tot : 0) + 1;

  function laatste(wereld) {
    const b = kijkBoek(wereld);
    if (!b) return 0;
    return b.gebeurtenissen.length ? b.gebeurtenissen[b.gebeurtenissen.length - 1].volgnummer : eerste(b) - 1;
  }

  function zoek(wereld, sleutel) {
    const b = kijkBoek(wereld);
    return b && Object.prototype.hasOwnProperty.call(b.sleutels, sleutel) ? b.sleutels[sleutel] : null;
  }

  function voegToe(wereld, lijst) {
    const b = boekVan(wereld);
    let volgende = laatste(wereld) + 1;
    for (const g of lijst) {
      if (g.wereld !== wereld) throw new Error('Journaal weigert: gebeurtenis ' + g.id + ' hoort bij wereld ' + g.wereld + ', niet bij ' + wereld + '.');
      if (g.volgnummer !== volgende) {
        throw new Error('Journaal weigert: volgnummer ' + g.volgnummer + ' waar ' + volgende + ' verwacht werd (' + wereld + ').');
      }
      if (Object.prototype.hasOwnProperty.call(b.sleutels, g.sleutel)) {
        throw new Error('Journaal weigert: sleutel ' + g.sleutel + ' is al geboekt als volgnummer ' + b.sleutels[g.sleutel] + '.');
      }
      volgende += 1;
    }
    for (const g of lijst) {
      /* Bevroren op het moment dat hij bewijs wordt: code die een geboekte
         gebeurtenis achteraf "even" bijwerkt, gooit dan in plaats van stil te
         herschrijven. Een correctie is een nieuwe gebeurtenis. */
      for (const r of g.regels || []) Object.freeze(r);
      Object.freeze(g.regels); Object.freeze(g.labels); Object.freeze(g);
      b.gebeurtenissen.push(g);
      b.sleutels[g.sleutel] = g.volgnummer;
    }
  }

  /* Lezen is voor controle, herstel, herhaling en onderzoek. De teller maakt
     zichtbaar wanneer een gewone beslissing dat toch doet. */
  function lees(wereld, van = 1, tot = Infinity) {
    const b = kijkBoek(wereld);
    if (!b) return [];
    const start = Math.max(0, van - eerste(b));
    const stop = Math.min(b.gebeurtenissen.length, tot === Infinity ? Infinity : tot - eerste(b) + 1);
    const uit = start < stop ? b.gebeurtenissen.slice(start, stop) : [];
    gelezen += uit.length;
    return uit;
  }

  function ontbrekend(wereld) {
    const b = kijkBoek(wereld);
    return b && b.ontbrekend ? Object.assign({}, b.ontbrekend) : null;
  }

  /* Eenmalig: een wereld van voor ronde A1 brengt zijn journaal mee. Wat de
     oude ringbuffer al had weggegooid, wordt niet verzonnen maar benoemd. */
  function neemOver(wereld, { gebeurtenissen, sleutels, ontbrekend: gat }) {
    const b = boekVan(wereld);
    if (b.gebeurtenissen.length || Object.keys(b.sleutels).length) {
      throw new Error('Journaal weigert de overname: wereld ' + wereld + ' heeft al een journaal.');
    }
    b.ontbrekend = gat || null;
    let volgende = eerste(b);
    for (const g of gebeurtenissen) {
      if (g.volgnummer !== volgende) throw new Error('Overname weigert een gat bij volgnummer ' + volgende + '.');
      b.gebeurtenissen.push(g);
      volgende += 1;
    }
    Object.assign(b.sleutels, sleutels);
  }

  return { laatste, zoek, voegToe, lees, ontbrekend, neemOver, gelezen: () => gelezen };
}

function geheugenJournaal() {
  const kaart = {};
  return maakOpslag(() => kaart);
}

function collectieJournaal({ db }) {
  const eigen = require('../eigencollectie')({
    db, domein: 'kern/magnaat-economische-motor', bezit: { magnaatJournaal: 'kaart' }
  });
  return maakOpslag(() => eigen.bak('magnaatJournaal'));
}

module.exports = { geheugenJournaal, collectieJournaal };
