/* MAGNAAT STELT ZIJN VRAAG AAN RTG.

   `scripts/magnaat-pomp.js` stelt al jaren één vraag aan het SPEL: kan een
   speler waarde maken uit niets? Dit stelt dezelfde vraag aan RTG Pay. Dat is
   fase 2 uit `MAGNAATLAB.md` par. 5.1, en het is de eerste keer dat de
   simulatielaag van dit huis een echte kerncapability aanraakt.

   DE KETEN DIE HIER DRAAIT, en elke schakel is de echte:

     server/betaal/synthetisch.js   de simulatiebank -- geld uit niets, want dat
                                    is wat een testhal nodig heeft
       -> server/betaal.js          de naad, ongewijzigd
       -> kern/pay laadOp           de wallet, ongewijzigd
       -> kern/pay/poort.js         de waardepoort, ongewijzigd
       -> het grootboek             dubbel geboekt, som exact nul

   `kern/pay/poort.js` is er niet voor veranderd en kent geen enkele spelstand.
   Dat is de hele inzet van par. 3 daar, en `test/simulatiebank.test.js` bewaakt
   het.

   WAAROM DIT IN DE MAGNAAT-WERELD STAAT EN NIET IN scripts/. Omdat het
   Magnaats vraag is, niet die van een script -- en omdat `scripts/magnaatlab.js`
   het bereik van de simulatielaag meet aan wat de modules in die wereld
   AANROEPEN. Zolang dit in scripts/ zou staan, blijft die meting op 0% en
   bewijst Magnaat nog steeds niets over RTG. Nu raakt de wereld `kern/pay` aan.

   WAT DAT GETAL DAN WEL EN NIET ZEGT, want anders liegt het:

     WEL   de simulatielaag roept een echte RTG-capability aan, en die aanroep
           doet het werk waarvoor hij bedoeld is -- een geldpompvraag met een
           harde invariant erachter.
     NIET  dat het SPEL over RTG Pay loopt. Dit is een PROEFSTUK. Geen enkele
           speelbeurt komt hierlangs; `test/magnaat-rtgketen.test.js` toets 7
           legt vast dat de spelmodules `kern/pay` niet laden.

   DE VRAAG ZELF verschilt van wat `test/geld-conservatie-last.test.js` al
   toetst. Die zet vijf leden tegelijk aan het tikken en kijkt of de som
   overeind blijft -- gelijktijdigheid. Dit doet het tegenovergestelde: één
   speler tegelijk, maar met opzet PERVERSE volgordes. Heen en weer, in een
   kring, naar zichzelf, opgeknipt en weer samengevoegd, en twee keer dezelfde
   tik. Dat is wat een speler in een spel zou proberen, en het is precies wat
   een gelijktijdigheidstoets niet zoekt.

   DE INVARIANT IS HARD EN DUBBEL:

     1. De sluitcontrole blijft kloppen: de som van ALLE saldi is exact nul en
        geen ledenrekening staat rood. Dat is de belofte van het dubbel boeken.
     2. Het totaal aan tafel is na een pure overdracht EXACT gelijk. Niet
        "binnen een marge" -- anders dan in het spel is er hier geen economie
        die legitiem meebeweegt. Elke cent verschil is een bevinding.

   Gebruik: node scripts/magnaat-pomp.js --rtg */
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

module.exports = function rtgKeten({ betaal, crypto }) {
  if (!betaal) throw new Error('rtg-keten heeft de betaalnaad nodig; injecteer server/betaal.');

  /* EEN VERSE KETEN. Een lege database, een echte kern/pay eroverheen, en de
     betaalnaad als geldbron. Alles wat pay nodig heeft en hier niet toe doet,
     is een stub -- maar de poort, het grootboek en de idempotentie zijn echt. */
  function opstelling() {
    const db = { data: {} };
    const { pay } = require('../../pay')({
      db,
      save() {},
      bijeen: async (werk) => werk(),
      crypto: crypto || require('crypto'),
      betaal,
      /* DE SPELERS MOETEN BESTAAN, anders weigert kern/pay elke tik met "Die
         codenaam kennen we niet" en meet deze proef opnieuw niets. In productie
         kijkt deze functie in de identiteitskluis; hier is de kluis de lijst van
         drie proefspelers en verder niemand. Dat is met opzet nauw: een proef
         die IEDERE codenaam laat bestaan, toetst die deur niet mee. */
      keyVanCodenaam: (c) => (SPELERS.includes(c) ? 'proef:' + c : null),
      sseToCustomer() {},
      schoon: (x) => String(x || ''),
      betaaldienstKosten: () => 0,
      betaalOpdrachten: {
        registreerTeruggang() {},
        maak: () => ({ id: 'proef' }),
        dienIn: async () => ({ status: 'proef' })
      }
    });
    return { db, pay };
  }

  /* OPLADEN VIA DE SIMULATIEBANK, EN DIE WEIGERT SOMS -- dat is de bedoeling.

     Dit liep bij de eerste ronde meteen stuk, en terecht: de simulatiebank kiest
     zijn afloop uit de idempotentiesleutel, en zeven van de honderd sleutels
     geven `geweigerd`, vijf `traag`. De eerste oplaadpoging kwam op "De betaling
     wacht op bevestiging" en de hele proef viel om.

     Het antwoord is NIET de bank vragen om altijd te slagen -- dan test hij een
     demo. Het antwoord is opnieuw proberen met een andere sleutel, precies wat
     een mens ook zou doen, en TELLEN hoe vaak hij weigerde. Dat getal is geen
     ruis maar een tweede meting: het laat zien dat er werkelijk een rail met
     scenario's onder ligt en niet een altijd-ja.

     Lukt het na veertig pogingen niet, dan is er iets anders aan de hand dan
     pech -- meestal een dichte grendel -- en dan zegt dit dat met zoveel
     woorden. Een proef die stilzwijgend niets doet, is de gevaarlijkste uitslag
     die er is. */
  const POGINGEN = 40;

  async function vulAan(pay, merk) {
    let geweigerd = 0;
    for (const c of SPELERS) {
      let gelukt = false;
      let laatste = null;
      for (let p = 0; p < POGINGEN && !gelukt; p++) {
        const r = await pay.laadOp({ codenaam: c, centen: START, idem: merk + ':' + c + ':' + p });
        if (r && !r.error && (r.status == null || r.status < 400)) { gelukt = true; break; }
        laatste = (r && r.error) || 'onbekend';
        geweigerd++;
      }
      if (!gelukt)
        throw new Error('opladen lukte na ' + POGINGEN + ' pogingen niet (' + laatste +
          '). Staat RTG_SIMULATIEBANK=1, en is er geen echte provider geconfigureerd?');
    }
    return { geweigerd };
  }

  async function draai(sleutel) {
    const { db, pay } = opstelling();
    const { geweigerd } = await vulAan(pay, sleutel);
    const voor = aanTafel(pay);
    const regelsVoor = regels(pay);
    /* `db` gaat mee zodat een TEGENPROEF het grootboek met de hand scheef kan
       zetten. Geen echt scenario raakt hem aan -- maar zonder die mogelijkheid
       is de sluitcontrole-bewering hieronder niet te falsificeren, en dan meet
       zij niets. */
    await SCENARIOS[sleutel].doe(pay, db);
    return { totaal: aanTafel(pay), voor, geweigerd, boekingen: regels(pay) - regelsVoor,
      sluit: pay.sluitcontrole() };
  }

  /* Twee identieke ketens, precies zoals de spelmeter het doet: eentje in rust
     en eentje waarin gepompt wordt. Het verschil IS de bevinding. */
  async function meet(sleutel) {
    const rust = await draai('rust');
    const pomp = await draai(sleutel);
    return {
      naam: SCENARIOS[sleutel].naam,
      rust: rust.totaal,
      pomp: pomp.totaal,
      verschil: pomp.totaal - rust.totaal,
      sluit: pomp.sluit,
      geladen: pomp.voor,
      geweigerd: rust.geweigerd + pomp.geweigerd,
      boekingen: pomp.boekingen,
      boekingenVerwacht: SCENARIOS[sleutel].boekingen
    };
  }

  async function keur() {
    const rijen = [];
    const klachten = [];
    for (const sleutel of Object.keys(SCENARIOS)) {
      if (sleutel === 'rust') continue;
      const r = await meet(sleutel);
      rijen.push(Object.assign({ sleutel }, r));
      /* EXACT NUL, geen marge. Anders dan in het spel loopt hier geen economie
         mee die legitiem mag bewegen: dit zijn pure overdrachten. */
      if (r.verschil !== 0)
        klachten.push(sleutel + ': ' + r.naam + ' verandert het totaal met ' + r.verschil + ' cent');
      /* HEEFT HET SCENARIO WERKELIJK IETS GEDAAN? Zonder deze regel is "verschil
         nul" ook de uitslag van een scenario dat stilletjes niets doet -- en dat
         is hier echt gebeurd, zie de kop van tik(). */
      if (r.boekingen !== r.boekingenVerwacht)
        klachten.push(sleutel + ': ' + r.naam + ' leverde ' + r.boekingen +
          ' grootboekregels op in plaats van ' + r.boekingenVerwacht +
          ' -- het scenario doet iets anders dan het zegt');
      if (!r.sluit.klopt)
        klachten.push(sleutel + ': de sluitcontrole klopt niet (som ' + r.sluit.som +
          (r.sluit.rood.length ? ', rood: ' + r.sluit.rood.join(', ') : '') + ')');
    }
    return { rijen, klachten };
  }

  return { SPELERS, START, SCENARIOS, opstelling, draai, meet, keur, aanTafel, tik };
};

module.exports.SCENARIOS = SCENARIOS;
module.exports.SPELERS = SPELERS;
