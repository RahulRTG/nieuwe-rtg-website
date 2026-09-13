/* DE VERGELIJKER -- houdt de VOORSPELLING van een domein tegen het CONTRACT van de
   handeling, en meldt drie soorten conflict.

   WAAR DIT IN DE KETEN ZIT:

     voorgenomen handeling
            |
            v  het domein rekent vooruit wat zij zou doen (de as `tegenfeit` in
            |  kern/kantoor/geldketen/klaarzet.js -- alleen het domein weet wat
            |  "wat zou dit doen" betekent)
            v
     het gevolgcontract zegt wat deze handeling veroorzaakt en wat zij NOOIT veroorzaakt
            |
            v
     DEZE VERGELIJKER
            |
            +-- IN_ORDE   -> de keten loopt door
            +-- GATEN     -> de keten loopt door, met de gaten bij naam in het dossier
            +-- CONFLICT  -> de keten STOPT, met de soort en de reden erbij

   ER WORDT NIET OP NAAMGELIJKHEID VERGELEKEN, en dat is de dragende keuze. Een
   vooruitblik op een incassoronde zegt "3 posten, 4 boekingen, 1200 cent"; een
   contract zegt "de collectie kantoorHandtekeningen verandert". Die twee hebben geen
   enkel woord gemeen en een tekstvergelijking zou altijd nul vinden -- en nul
   conflicten uit een vergelijker die niets kan zien, is het gevaarlijkste groen dat
   er is. Er wordt daarom vergeleken op een GESLOTEN, GEDEELDE woordenlijst: de
   dertien effectwerkwoorden uit kern/isolatie/effectwoorden.js. Het domein zegt welke
   werkwoorden zijn voorspelling IMPLICEERT (bedragCenten > 0 betekent GELD_BEWEGEN),
   het contract zegt welke het veroorzaakt en welke nooit, en daarover is te rekenen.

   DE DRIE SOORTEN, en ze zijn met opzet niet een cijfer:

     TEGENSPRAAK  de voorspelling impliceert een werkwoord dat het contract
                  UITSLUIT. Dit is het enige van de drie dat een defect is: of de
                  handeling doet iets anders dan verklaard, of de verklaring is
                  onjuist. Een keten hoort hierop te zakken.
     GAT          de voorspelling impliceert een werkwoord waarover het contract
                  NIETS zegt. Dat is geen leugen maar een ontbrekende verklaring, en
                  het verschil is het hele punt van deze laag: "ik weet het niet" is
                  geen "er gebeurt niets". Een gat blokkeert daarom niet vanzelf --
                  wie hem laat blokkeren, doet dat expliciet.
     OVERCLAIM    het contract beweert iets HARDER dan de meting toelaat. Die staat
                  al in ./keuring.js (een `gemeten` claim op een collectie die de
                  proef daar nooit zag) en wordt hier niet nagebouwd maar AANGEROEPEN.

   WAT DEZE MODULE NIET DOET: beslissen. Zij geeft een uitslag met een soort en een
   reden; of een keten daarop zakt, staat bij de keten. Zelfde scheiding als
   ./voorspelling.js, dat de schaduwregel telt en niets weigert.

   EN ZIJ MAAKT VAN "GEEN CONTRACT" GEEN "GEEN CONFLICT". Een handeling zonder
   contract levert `zonderContract` met de reden erbij, en dat is een eigen uitslag
   naast in orde en conflict -- BESTUUR.md: `niet vast te stellen` is een eersteklas
   uitslag. Wie dat als nul telt, heeft een vergelijker gebouwd die alles goedkeurt
   wat hij niet kent. */
'use strict';

const { keur } = require('./keuring');
const { werkwoorden } = require('./woorden');
const { CONTRACTEN } = require('./register');

const SOORTEN = Object.freeze(['TEGENSPRAAK', 'GAT', 'OVERCLAIM']);

/* WELKE SOORT EEN KETEN HOORT TE STOPPEN, en deze lijst is de hele reden dat de drie
   soorten geen cijfer zijn geworden. Een TEGENSPRAAK en een OVERCLAIM zijn DEFECTEN
   tussen twee VERKLARINGEN van mensen -- de een zegt dat de handeling iets doet dat de
   ander uitsluit, of het contract draagt een stempel dat de meting niet geeft. Daar is
   geen dekkingsprobleem aan: beide kanten zijn opgeschreven, dus een tegenstrijdigheid
   is nu al vast te stellen en hoeft niet eerst in de schaduw te lopen.

   EEN GAT IS DAT NIET. Een gat zegt "hierover heeft niemand iets verklaard", en dat is
   een ontbrekende verklaring en geen leugen. Wie daarop blokkeert, zet het huis stil
   op zijn eigen achterstand -- precies waarom ./voorspelling.js zijn schaduwregel niet
   afdwingt. Hij wordt GEMELD en met naam, en verder niets.

   De lijst staat hier en niet bij de aanroeper: twee plekken die beslissen wat
   blokkeert, is een halve dag zoeken zodra ze uiteenlopen. */
const BLOKKEERT = Object.freeze(['TEGENSPRAAK', 'OVERCLAIM']);

/* De voorspelling draagt zelf WAAROVER zij gaat. Dat is geen formaliteit: in de
   gouden geldweg staat de vooruitblik bij de AANVRAAG (/api/office/bank/incasso) en
   beschrijft hij wat de RONDE zou doen, en die ronde loopt op een andere route
   (/api/office/bank/handtekening/bevestig). Tegen het contract van de aanvraag
   gehouden zou elke geldvoorspelling een tegenspraak zijn -- die aanvraag verplaatst
   met zoveel woorden geen euro. Een vergelijker die het subject raadt, vindt dus
   precies de conflicten die er niet zijn. */
function vergelijk(voorspelling, opties) {
  const contracten = (opties && opties.contracten) || CONTRACTEN;
  const over = String((voorspelling && voorspelling.over) || '');
  /* EEN ONTBREKENDE LIJST IS GEEN LEGE LIJST, en dat verschil is hier duur betaald.
     Zonder deze regel gaf een voorspelling die geen werkwoorden noemt de uitslag
     IN_ORDE: er werd niets geimpliceerd, dus sprak niets iets tegen. Dat is exact het
     groen waar de kop hierboven tegen waarschuwt -- een poort die niets kan zien en
     "in orde" zegt. In de gouden keten stond de toets er daardoor 9 van 9 groen bij
     terwijl de as leeg was.

     Een EXPLICIETE lege lijst is wel bruikbaar: het domein zegt dan "deze vooruitblik
     impliceert niets" (een incassoronde met niets op de rol), en dat is een bewering
     waarover te vergelijken valt. `Array.isArray` is precies dat onderscheid. */
  if (!Array.isArray(voorspelling && voorspelling.effecten))
    return { uitslag: 'ZONDER_WERKWOORDEN', blokkeert: false, conflicten: [], over,
      reden: 'de voorspelling noemt geen werkwoorden, dus er is niets om tegen het contract te ' +
        'houden. Een ontbrekende lijst is geen lege lijst: "niets geimpliceerd" moet het domein ' +
        'ZEGGEN (effecten: []), anders leest een stille poort als een gehaalde poort' };
  const geimpliceerd = voorspelling.effecten.slice();

  const onbekendWoord = geimpliceerd.filter(w => !werkwoorden().includes(w));
  if (onbekendWoord.length)
    return { uitslag: 'ONBRUIKBAAR', blokkeert: false, conflicten: [], over,
      reden: 'de voorspelling noemt ' + onbekendWoord.join(', ') + ', en dat staat niet in de ' +
        'woordenlijst van kern/isolatie/effectwoorden.js -- er is niets om tegen te vergelijken' };

  const c = contracten[over] || null;
  if (!c)
    return { uitslag: 'ZONDER_CONTRACT', blokkeert: false, conflicten: [], over,
      reden: over
        ? 'er is geen gevolgcontract voor ' + over + ', dus er valt niets te vergelijken. Dat is ' +
          'niet hetzelfde als "geen conflict"'
        : 'de voorspelling zegt niet waarover zij gaat; zonder subject is elke vergelijking een gok' };

  const conflicten = [];

  /* OVERCLAIM: aangeroepen en niet nagebouwd. */
  for (const bezwaar of keur(c))
    conflicten.push({ soort: 'OVERCLAIM', wat: bezwaar,
      reden: 'het contract beweert iets harder dan de meting toelaat (./keuring.js)' });

  const veroorzaakt = Array.isArray(c.veroorzaakt) ? c.veroorzaakt : [];
  const nooit = Array.isArray(c.nooit) ? c.nooit : [];

  for (const w of geimpliceerd) {
    if (nooit.includes(w))
      conflicten.push({ soort: 'TEGENSPRAAK', werkwoord: w,
        reden: 'de voorspelling impliceert ' + w + ' en het contract van ' + over +
          ' sluit dat uit; of de handeling doet iets anders dan verklaard, of de verklaring is onjuist' });
    else if (!veroorzaakt.includes(w))
      conflicten.push({ soort: 'GAT', werkwoord: w,
        reden: 'de voorspelling impliceert ' + w + ' en het contract van ' + over +
          ' zegt daar niets over -- een ontbrekende verklaring, geen leugen' });
  }

  const tegenspraak = conflicten.filter(x => x.soort === 'TEGENSPRAAK').length;
  const gat = conflicten.filter(x => x.soort === 'GAT').length;
  const overclaim = conflicten.filter(x => x.soort === 'OVERCLAIM').length;
  /* DRIE UITSLAGEN EN NIET TWEE. `GATEN` is met opzet geen `CONFLICT`: de
     vergelijking heeft gelopen en niets sprak elkaar tegen -- er is alleen iets
     waarover het contract zwijgt. Die twee op een hoop gooien zou een keten laten
     zakken op een ontbrekende verklaring, en dan wordt deze poort losgedraaid. */
  const blokkerend = conflicten.filter(x => BLOKKEERT.includes(x.soort));
  return {
    uitslag: blokkerend.length ? 'CONFLICT' : (gat ? 'GATEN' : 'IN_ORDE'),
    blokkeert: blokkerend.length > 0,
    over, conflicten, telling: { tegenspraak, gat, overclaim },
    /* De reden zegt wat er GEZIEN is en niet alleen hoeveel. Een teller zonder
       namen laat een swap door (dezelfde regel als de genoemde lijst in
       ./voorspelling.js). */
    reden: conflicten.length
      ? conflicten.map(x => x.soort + ': ' + (x.werkwoord || x.wat)).join('; ')
      : 'elk werkwoord dat de voorspelling impliceert, staat in `veroorzaakt` van het contract'
  };
}

module.exports = { vergelijk, SOORTEN, BLOKKEERT };
