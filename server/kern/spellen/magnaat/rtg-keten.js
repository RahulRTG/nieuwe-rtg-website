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

const { SPELERS, START, tik, SCENARIOS } = require('./rtg-keten-pomp');

/* Wat een speler heeft. Alleen de ledenrekeningen: de extern-rekeningen zijn de
   tegenboeking van het opladen en horen per definitie negatief te staan. */
const aanTafel = (pay) => SPELERS.reduce((n, c) => n + pay.saldoVan(pay.rekLid(c)), 0);

/* Hoeveel grootboekregels de spelers samen dragen. Dit is de tweede meting, en
   hij bestaat omdat de eerste een scenario dat NIETS doet niet van een werkend
   scenario kan onderscheiden -- zie de kop van tik() in ./rtg-keten-pomp.js. */
const regels = (pay) => SPELERS.reduce((n, c) => n + pay.boekingenVan(pay.rekLid(c)).length, 0);

module.exports = function rtgKeten({ betaal, crypto }) {
  if (!betaal) throw new Error('rtg-keten heeft de betaalnaad nodig; injecteer server/betaal.');

  /* EEN VERSE KETEN. Een lege database, een echte kern/pay eroverheen, en de
     betaalnaad als geldbron. Alles wat pay nodig heeft en hier niet toe doet,
     is een stub -- maar de poort, het grootboek en de idempotentie zijn echt. */
  function opstelling() {
    const db = { data: {} };
    const { pay } = require('../../pay')({
      db,
      /* Als PROPERTY en niet als methode-verkorting: kruisscan (keuringsregel 9)
         leest `save() {}` als een kale verwijzing naar de top-level `save` van een
         zusterbestand in dezelfde opgeknipte module, en meldt dan een kruis-slice
         die er niet is. Een pijlfunctie als waarde heeft die dubbelzinnigheid niet. */
      save: () => {},
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
