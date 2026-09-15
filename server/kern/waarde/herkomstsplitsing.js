/* DE SPLITSING VAN EEN STEL GELDRIJEN -- aan wie komt dit geld toe?

   WAAROM DIT EEN TWEEDE BESTAND IS. Het stond eerst in economischeherkomst.js
   en kwam daar over de tien kilobyte van keuringsregel 13. Die regel is een
   dakpan en geen wet, en zijn eigen diagnose bleek hier te kloppen: er zaten
   TWEE onderwerpen in. Een geldrij is een ETIKET op EEN bedrag -- waar kwam hij
   vandaan, van wie is hij, waar gaat hij heen. Een splitsing is een TELLING over
   VELE bedragen, en die heeft zijn eigen regels (wat mag bij elkaar, wat nooit).
   Ze delen een vorm en geen vraag, dus hier loopt de naad.

   WAT HIER MET OPZET NIET STAAT: een vergoeding, een tarief of een percentage.
   Deze module telt en rekent niet af. Zodra er een tarief in zou staan, is de
   waarheid en het beleid hetzelfde bestand, en dan is bij een geschil niet meer
   uit elkaar te halen of een getal verkeerd GEMETEN of verkeerd BEDACHT is.
   test/doorbelasting.test.js toets 17 houdt dat vast over beide bestanden.

   WAAROM DE FUNCTIE NIET `splits` HEET. Dat was de eerste naam en hij is bezet:
   kern/commercie/subsidie.js en kern/pdf-bouw.js dragen hem allebei al, met een
   andere betekenis (een subsidie verdelen, en een document opdelen). Een derde
   betekenis op dezelfde naam is de botsing waar SEMANTIEK.json over gaat -- 105
   van de 123 gedeelde namen dragen daar meer dan een betekenis -- en de keuring
   telde hem meteen als dubbeling. `naarEigenaar` zegt bovendien iets wat `splits`
   niet zei: LANGS WELKE AS er wordt gesplitst. Dat is hier het hele punt, want
   langs de herkomst zou een andere uitkomst geven. */
'use strict';

const { ONBEKEND } = require('./economischeherkomst.js');

/* ---------- de bijdragebasis, en waarom hij hier NIET wordt uitgerekend ----------
   Wat hier wel staat is de SPLITSING van een stel rijen naar wie de waarde
   toekomt. Dat is een telling en geen tarief; er zit geen percentage in en er
   komt er ook geen in. Het verschil doet ertoe: zodra deze module een
   vergoeding zou kennen, is hij geen primitief meer maar beleid, en dan zit het
   tarief op de plek waar de waarheid hoort te staan.

   `onbekend` staat er als EIGEN post en wordt nergens in verrekend. Dat is de
   hele reden dat deze functie bestaat: een basis waarin de onbekende helft
   stilzwijgend is meegeteld, ziet er precies zo uit als een basis die klopt. */
function naarEigenaar(rijen) {
  /* `lid` en `gast` hebben een EIGEN bak en vallen niet in de restpost. Dat
     klinkt als een detail en het is de hele regel: een terugbetaling komt toe
     aan het LID, en die is bekend. Zonder deze bak liep de onbekende post
     NEGATIEF -- de gezaaide wereld vond dat binnen een minuut, en een negatief
     gat is precies het soort getal waar niemand op klikt omdat het klein
     lijkt. */
  const uit = { rtgEigen: 0, derde: 0, overheid: 0, psp: 0, aanDeKlant: 0, onbekend: 0 };
  const perValuta = new Map();
  let geteld = 0, overgeslagen = 0;

  for (const r of (Array.isArray(rijen) ? rijen : [])) {
    if (!r || r.bedragCenten == null) { overgeslagen++; continue; }
    geteld++;
    const v = r.valuta || ONBEKEND;
    perValuta.set(v, (perValuta.get(v) || 0) + r.bedragCenten);

    const e = r.economischeEigenaar;
    if (e === 'rtg') uit.rtgEigen += r.bedragCenten;
    else if (e === 'derde' || e === 'zaak') uit.derde += r.bedragCenten;
    else if (e === 'overheid') uit.overheid += r.bedragCenten;
    else if (e === 'psp') uit.psp += r.bedragCenten;
    else if (e === 'lid' || e === 'gast') uit.aanDeKlant += r.bedragCenten;
    else uit.onbekend += r.bedragCenten;
  }

  /* SPLITS EN VOLGBAAR ZIJN TWEE VRAGEN, en ze lopen met opzet uiteen. Een rij
     met een bekende EIGENAAR en een onbekende HERKOMST telt hier gewoon mee bij
     die eigenaar -- het geld is van iemand -- maar `volgbaar()` noemt hem NIET
     volgbaar, want bij een geschil is niet aan te tonen waar hij vandaan kwam.
     De splitsing zegt hoe het geld ligt; volgbaarheid zegt of je het kunt
     verdedigen. Wie die twee gelijk trekt, verliest een van beide antwoorden. */
  return {
    perEigenaar: uit,
    perValuta: Object.fromEntries(perValuta),
    geteld, overgeslagen,
    /* MEERDERE VALUTA WORDEN NIET OPGETELD. Er staat geen koers in dit huis die
       een bijdragebasis mag bepalen (kern/payroll/valuta.js: een koers zou een
       loonstrook laten bewegen met de markt, en hier geldt hetzelfde voor een
       vergoeding). Zijn er meer munten, dan is er geen totaal en zegt de uitslag
       dat. */
    eenValuta: perValuta.size === 1 ? [...perValuta.keys()][0] : null,
    waaromGeenTotaal: perValuta.size > 1
      ? 'er staan ' + perValuta.size + ' valuta in deze rijen (' + [...perValuta.keys()].join(', ') +
        ') en dit huis kent geen koers die een bijdragebasis mag bepalen'
      : null
  };
}

module.exports = { naarEigenaar };
