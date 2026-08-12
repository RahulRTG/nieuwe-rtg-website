/* WAT JE MEENEEMT NAAR JE VOLGENDE CAMPAGNE -- de leeskant van de loopbaan.

   ./loopbaan.js SCHRIJFT aan het eind van een partij; dit bestand LEEST aan het
   begin van de volgende. Tot nu toe ontbrak die richting helemaal: er werd
   keurig bewaard dat je drie jaar bedrijfsleider was en niemand vroeg er ooit
   naar. Daardoor voelde een tweede campagne als New Game+ en niet als het
   volgende hoofdstuk van hetzelfde leven.

   ================== DE ENE REGEL ==================

   **GESCHIEDENIS MAAKT DEUREN ZICHTBAAR. GESCHIEDENIS SCHENKT GEEN WAARDE.**

   Dat is de hele grens, en hij is scherper dan hij klinkt. Wat hieruit mag
   volgen is CONTEXT, TOEGANG, HERKENNING en RELATIES. Wat er nooit uit mag
   volgen is geld, capaciteit, een prijs, een korting, krediet, een goedkoper
   pand of een groter bereik. Concreet:

     MAG    een oud-collega ziet jouw vacature met de reden erbij, en beslist
            zelf of hij solliciteert;
     MAG    een leverancier herkent je naam en is bereid een offerte te sturen;
     MAG    een voormalig leidinggevende wil je plan bekijken;
     MAG    een bank ziet dat je operationele ervaring hebt;
     NIET   diezelfde bank geeft je daarom goedkoper krediet;
     NIET   het pand wordt goedkoper omdat jij er vroeger werkte;
     NIET   "+10% personeel wegens ervaring".

   Waarom zo streng: elke uitzondering maakt een oude speler structureel sterker
   dan een nieuwe, en dan is een eerste campagne een verplichte inhaalronde. Dat
   is exact de grens waar ./stadsgeheugen.js op staat of valt, hier toegepast op
   een mens in plaats van op een stad.

   DAAROM GEEFT DIT BESTAND ALLEEN FEITEN TERUG EN NOOIT EEN GETAL DAT ERGENS IN
   VERMENIGVULDIGD KAN WORDEN. Geen `bonus`, geen `factor`, geen `niveau`, geen
   score. Maanden en namen, meer niet -- en `test/spelherkomst.test.js` telt na
   dat er niets anders in zit.

   ================== WAT ER IN ZIT ==================

     ervaring     hoeveel maanden je in welke SECTOR werkte
     rollen       welke rollen je vervulde, en hoe lang
     werkgevers   bij wie je werkte, op codenaam
     bekenden     iedereen met wie je een gedeeld verleden hebt, en waarom.
                  Uit de banen (je werkgever) EN uit de momenten (`samen` is
                  daar verplicht, dus elk moment levert een tweede mens)
     ondernemer   heb je ooit voor jezelf begonnen

   ================== DE POORT ==================

   Dezelfde als bij het register zelf: vanaf 16 (`werkMag`), want een
   werkverleden is geen score. Onder die grens is er geen profiel -- niet omdat
   het geheim is, maar omdat er niets bewaard IS. */
'use strict';

module.exports = ({ alle, mag, GEEN_PROGRESSIE }) => {
  /* Alles bij elkaar geharkt, in EEN doorloop. Dit is een lezing en geen
     tweede register: er wordt niets bewaard wat hier uitkomt, want dan is er
     een tweede waarheid die kan gaan afwijken van de banen zelf. */
  function profiel(handle, codenaam) {
    if (!mag(handle)) return { er: false, reden: GEEN_PROGRESSIE };
    const l = alle()[codenaam];
    if (!l || (!l.banen.length && !l.momenten.length))
      return { er: false, reden: 'nog geen werkverleden' };

    const ervaring = {}, rollen = {}, werkgevers = {}, bekenden = {};
    const noem = (wie, hoe) => {
      if (!wie) return;
      const b = (bekenden[wie] = bekenden[wie] || { codenaam: wie, hoe: [] });
      if (!b.hoe.includes(hoe)) b.hoe.push(hoe);
    };
    for (const b of l.banen) {
      if (b.sector) ervaring[b.sector] = (ervaring[b.sector] || 0) + (b.maanden || 0);
      if (b.rol) rollen[b.rol] = (rollen[b.rol] || 0) + (b.maanden || 0);
      werkgevers[b.werkgever] = (werkgevers[b.werkgever] || 0) + (b.maanden || 0);
      noem(b.werkgever, 'werkgever');
    }
    /* UIT DE MOMENTEN KOMT DE REST VAN JE NETWERK. `samen` is daar verplicht --
       een moment zonder tweede mens bestaat niet -- dus elk moment levert
       precies een mens op, met de reden waarom je hem kent. */
    for (const m of l.momenten) noem(m.samen, m.soort);

    return { er: true, codenaam,
      ervaring, rollen, werkgevers,
      bekenden: Object.values(bekenden),
      /* HOELANG JE AL WERKT, in maanden. Geen niveau en geen ster: een getal dat
         zegt hoe lang je bezig bent, en waar niemand iets mee vermenigvuldigt. */
      maanden: l.banen.reduce((n, b) => n + (b.maanden || 0), 0),
      banen: l.banen.length,
      /* HEB JE OOIT VOOR JEZELF BEGONNEN. De belangrijkste vraag van fase 3, en
         hij komt uit een moment dat er al was (`eerste_zaak`) plus de nieuwe
         overgang hieronder. */
      ondernemer: l.momenten.some(m => m.soort === 'eerste_zaak' || m.soort === 'eerste_onderneming') };
  }

  /* WAT TWEE MENSEN DELEN. De kern van herkenning, en met opzet SYMMETRISCH:
     als jij weet dat je voor hem werkte, weet hij dat jij voor hem werkte. Een
     eenzijdige herinnering is een informatievoorsprong, en dat is precies het
     soort voordeel dat deze laag niet mag maken. */
  function tussen(handle, codenaam, ander) {
    const p = profiel(handle, codenaam);
    if (!p.er) return { er: false, reden: p.reden };
    const b = p.bekenden.find(x => x.codenaam === ander);
    if (!b) return { er: false, reden: 'jullie hebben geen gedeeld verleden' };
    return { er: true, codenaam: ander, hoe: b.hoe,
      /* Hoe lang je voor hem werkte, als dat zo was. Nul betekent: jullie kennen
         elkaar ergens anders van. */
      maanden: p.werkgevers[ander] || 0 };
  }

  /* HOEVEEL VERSTAND JE VAN EEN VAK HEBT, in maanden. Wordt gelezen door de
     schermen om te kunnen zeggen "je hebt hier zes jaar gewerkt"; er wordt
     NIETS mee gerekend. Zou er ooit een formule aan hangen, dan is dit getal
     een verkapte bonus geworden. */
  const ervaringIn = (handle, codenaam, sector) => {
    const p = profiel(handle, codenaam);
    return p.er ? (p.ervaring[sector] || 0) : 0;
  };

  return { profiel, tussen, ervaringIn };
};
