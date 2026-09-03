/* WAT HEEFT ER AAN DIT GESPREK BIJGEDRAGEN -- de boekhouding, zonder oordeel.

   WAAROM DIT LOS STAAT VAN ../isolatie/herkomst.js. Dat bestand is de GRAMMATICA:
   welke kanalen bestaan, welke klasse ze dragen, en welke effecten daarmee
   dichtgaan. Dit is de BOEKHOUDING van een lopend gesprek: welke van die kanalen
   hebben er tot nu toe iets ingebracht. De grammatica is stabiel en gedeeld; de
   boekhouding leeft precies zolang als een lus draait. Ze samen in een module
   zetten zou van de grammatica een object met toestand maken, en dan is er een
   tweede kopie zodra er twee lussen tegelijk lopen.

   HIJ OORDEELT NERGENS OVER. Hij weet niet wat een klasse betekent en niet wat
   er dichtgaat; hij telt kanalen. Dat is dezelfde scheiding als bij de
   schaduwmeting in kern/commercie/schaduw.js: meten en beslissen zijn twee
   dingen, en wie ze samenvoegt kan de meting niet meer geloven.

   HET GAT DAT HIJ VULT. De herkomstregel stond, maar de dekking was NUL: de
   enige productie-aanroeper gaf het argument niet mee, dus `bronnen` was altijd
   `undefined`, `sluitDoorHerkomst([])` gaf altijd `[]` terug en de hele
   herkomstbranche draaide nooit. Een regel die staat en nergens werkt, is
   gevaarlijker dan geen regel: hij ziet er in een register uit als bescherming.

   WAT ER NOOIT IN GAAT, en dat is een grens en geen detail: alleen KANAALNAMEN
   en padnamen. Nooit inhoud, nooit een codenaam, nooit een adres. Anders staat
   er straks een fragment van iemands post in een beveiligingsspoor -- dezelfde
   grens als kern/envelop.js. */
'use strict';

const herkomst = require('../isolatie/herkomst');

/* WAAR EEN GESPREK MEE BEGINT. De systeemregels van de lus en de vraag van de
   mens; allebei gezaghebbend, dus een vers gesprek sluit niets. */
const START = Object.freeze(['systeemprompt', 'gebruikersvraag']);

/* HET KANAAL VAN EEN TOOLANTWOORD, en waarom het standaard onvertrouwd is.

   Alles wat `doe` teruggeeft gaat VERBATIM het gesprek in. Wat daarin zit weet
   deze laag niet: het effectmodel zegt wat een pad DOET, niet wat het
   TERUGGEEFT, en dat is met opzet -- de meting die het wel zou kunnen zeggen
   bestaat niet. Standaard onvertrouwd is dan de enige eerlijke stand. Een route
   die het beter weet mag zich VERFIJNEN (herkomst.js schrijft dat zelf voor:
   de klasse komt van het KANAAL, nooit van de tekst), maar vergeten maakt
   strenger en nooit losser. */
const TOOLANTWOORD = 'toolantwoord';

function nieuw(begin) {
  /* Een Set en geen lijst: hetzelfde kanaal twee keer melden verandert niets aan
     wat er dichtgaat, en een teller zou suggereren dat het dat wel doet. */
  const gezien = new Set(Array.isArray(begin) && begin.length ? begin : START);
  const spoorRegels = [];

  /* Een kanaal melden. Gooit op een kanaal dat de grammatica niet kent -- zelfde
     fail-fast als herkomst.keurIn(). Een onbekend kanaal stilzwijgend opnemen
     zou het als `onbekend` laten tellen (dus onvertrouwd, dus strenger), maar
     het zou ook een typefout onzichtbaar maken, en dan is niet te zeggen of de
     versmalling ergens vandaan komt of nergens vandaan. */
  function meld(kanaal, waarom) {
    const k = String(kanaal || '');
    if (!herkomst.KANALEN[k]) {
      throw new Error('stuur/besmetting: onbekend kanaal "' + k + '"; zet hem eerst in ' +
        'kern/isolatie/herkomst.js KANALEN, met een klasse');
    }
    if (!gezien.has(k)) {
      gezien.add(k);
      spoorRegels.push({ kanaal: k, klasse: herkomst.klasseVan(k), waarom: String(waarom || '').slice(0, 120) });
    }
    return k;
  }

  /* Een geslaagde gereedschapsaanroep. De aanroeper geeft het PAD mee zodat het
     spoor leesbaar blijft; het pad bepaalt het kanaal niet -- zie hierboven. */
  function meldToolantwoord(pad) {
    return meld(TOOLANTWOORD, 'antwoord van ' + String(pad || 'onbekend pad').slice(0, 80));
  }

  return {
    bronnen: () => [...gezien],
    meld, meldToolantwoord,
    spoor: () => spoorRegels.slice()
  };
}

module.exports = { nieuw, START, TOOLANTWOORD };
