/* DE POMPSCENARIO'S van rtg-keten.js, en de tik die ze gebruiken.

   WAAROM DIT EEN EIGEN BESTAND IS. ./rtg-keten.js liep over de 10 kB-grens van
   keuringsregel 13. De snede ligt op een familie: hier staat WAT er geprobeerd
   wordt (de perverse volgordes en het aantal grootboekregels dat elk hoort op
   te leveren), daar staat WAARMEE (de keten opbouwen, opladen, meten, keuren).
   Dat is dezelfde snede als bij kern/horeca/dienstmeting-tijden.js. */
'use strict';

/* De speler-codenamen van de proef. Codenamen, geen namen -- ook in een proef,
   want kern/pay hangt zijn wallet aan de codenaam en dit huis kent geen tweede
   soort. */
const SPELERS = ['Gouden Panter 01', 'Zilveren Reiger 02', 'Koperen Vos 03'];
const START = 500000;          // vijfduizend euro per speler, ruim genoeg om te pompen

/* Wat een speler heeft. Alleen de ledenrekeningen: de extern-rekeningen zijn de
   tegenboeking van het opladen en horen per definitie negatief te staan. */
const aanTafel = (pay) => SPELERS.reduce((n, c) => n + pay.saldoVan(pay.rekLid(c)), 0);

/* Hoeveel grootboekregels de spelers samen dragen. Dit is de tweede meting, en
   hij bestaat omdat de eerste een scenario dat NIETS doet niet van een werkend
   scenario kan onderscheiden -- zie de kop van tik() hierboven. */
const regels = (pay) => SPELERS.reduce((n, c) => n + pay.boekingenVan(pay.rekLid(c)).length, 0);

/* EEN TIK, EN HIJ MOET AANKOMEN.

   HIER GING DEZE METER ZELF DE MIST IN, en het is precies de fout waar hij naar
   op zoek is. De eerste versie riep `pay.stuur({ van, aan, ... })` aan en keek
   niet naar het antwoord. Het veld heet `aanCodenaam`, dus elke aanroep kwam
   terug met "Kies aan wie je het stuurt" -- en de meter meldde opgewekt dat geen
   enkel scenario waarde uit het niets maakte, over overdrachten die NOOIT HEBBEN
   PLAATSGEVONDEN. Nul boekingen, nul verschil, groen.

   Gevonden door een mutatie: het weghalen van de retourtik in `heenEnWeer` liet
   alles groen. Dat kon maar twee dingen betekenen -- of de scenario's doen niets,
   of de invariant kan niet zakken. Het was het eerste.

   Vandaar deze functie: elke tik kijkt naar zijn antwoord en gooit bij een
   onverwachte weigering. LAT-regel 5 in het klein -- niets faalt hier stil. */
async function tik(pay, van, aan, centen, idem, magWeigeren) {
  const r = await pay.stuur({ van, aanCodenaam: aan, centen, idem, oms: 'pompproef' });
  if (r && r.ok) return r;
  if (magWeigeren) return r;
  throw new Error('een tik van ' + van + ' naar ' + aan + ' werd geweigerd: ' +
    ((r && r.error) || 'zonder reden') + ' (status ' + ((r && r.status) || '?') + ')');
}

/* DE SCENARIO'S. Elk krijgt een verse keten en mag erin doen wat het wil.
   `rust` doet niets; het verschil tussen die twee IS de meting.

   `boekingen` is het aantal grootboekregels dat het scenario hoort op te
   leveren, en het staat er als GETAL en niet als "meer dan nul". Zonder dat
   getal is een scenario dat stilletjes niets doet niet te onderscheiden van een
   scenario dat werkt: een overdracht tussen spelers laat de som per definitie
   gelijk, dus de invariant alleen kan het verschil niet zien. */
const SCENARIOS = {
  rust: { naam: 'opladen en verder niets doen (de nulmeting)', boekingen: 0, async doe() {} },

  heenEnWeer: {
    naam: 'twintig keer heen en weer sturen tussen twee spelers',
    boekingen: 80,
    async doe(pay) {
      for (let i = 0; i < 20; i++) {
        await tik(pay, SPELERS[0], SPELERS[1], 100000, 'hw-a-' + i);
        await tik(pay, SPELERS[1], SPELERS[0], 100000, 'hw-b-' + i);
      }
    }
  },

  carrousel: {
    naam: 'een kring rondsturen: A naar B naar C naar A',
    boekingen: 90,
    async doe(pay) {
      for (let i = 0; i < 15; i++) {
        await tik(pay, SPELERS[0], SPELERS[1], 250000, 'car-1-' + i);
        await tik(pay, SPELERS[1], SPELERS[2], 250000, 'car-2-' + i);
        await tik(pay, SPELERS[2], SPELERS[0], 250000, 'car-3-' + i);
      }
    }
  },

  /* DIT SCENARIO HOORT TE WORDEN GEWEIGERD, en dat is de bevinding. RTG Pay
     weigert een tik naar jezelf (`aan === van`) op de poort af. Zou hij hem
     toelaten, dan was het nog steeds geen pomp -- maar het zou wel elke
     dagbesteding en elke grens laten meetellen op geld dat nergens heen gaat. */
  zelfBetalen: {
    naam: 'naar je eigen wallet sturen (hoort geweigerd te worden)',
    boekingen: 0,
    async doe(pay) {
      for (let i = 0; i < 10; i++) {
        const r = await tik(pay, SPELERS[0], SPELERS[0], 50000, 'zelf-' + i, true);
        if (r && r.ok) throw new Error('RTG Pay liet een tik naar de eigen wallet toe');
      }
    }
  },

  splitsenEnSamenvoegen: {
    naam: 'een bedrag in vijftig stukjes knippen en weer samenvoegen',
    boekingen: 102,
    async doe(pay) {
      for (let i = 0; i < 50; i++) await tik(pay, SPELERS[0], SPELERS[1], 1000, 'split-' + i);
      await tik(pay, SPELERS[1], SPELERS[0], 50000, 'samen');
    }
  },

  /* De klassieke: dezelfde tik twee keer aanbieden. Als de tweede doorkomt,
     betaalt de speler een keer en levert het twee keer op. De tweede hoort
     hetzelfde antwoord te geven zonder een tweede boeking te maken -- vandaar
     dat er veertig regels uitkomen en geen zestig. */
  dubbelTikken: {
    naam: 'dezelfde tik twee keer aanbieden met dezelfde sleutel',
    boekingen: 40,
    async doe(pay) {
      for (let i = 0; i < 10; i++) {
        await tik(pay, SPELERS[0], SPELERS[1], 30000, 'dubbel-' + i);
        await tik(pay, SPELERS[0], SPELERS[1], 30000, 'dubbel-' + i);
      }
      for (let i = 0; i < 10; i++) await tik(pay, SPELERS[1], SPELERS[0], 30000, 'terug-' + i);
    }
  }
};

module.exports = { SPELERS, START, tik, SCENARIOS };
