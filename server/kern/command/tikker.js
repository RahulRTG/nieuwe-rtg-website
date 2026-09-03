/* DE ACHTERGRONDTIK, EEN KEER.

   Drie modules onder deze map lieten zichzelf op een vaste tik opnieuw wegen --
   alarm.js elke minuut, canary.js en uitrolregie.js op hun eigen STANDAARD.tikMs
   -- en alle drie schreven ze daarvoor dezelfde vijf regels op: een setInterval,
   een try/catch eromheen, unref, en de timer terug. Dat is LAT.md regel 4 op zijn
   kleinst: drie plekken die dezelfde waarheid vasthouden, en de eerste die er
   iets aan verandert (een tik overslaan als de vorige nog loopt, een fout melden
   in plaats van slikken) laat de andere twee stil achter.

   TWEE DINGEN ZITTEN ER MET OPZET IN, en het zijn precies de twee die je bij het
   overtypen vergeet:

     DE LUS BREEKT NOOIT. Een uitzondering uit `weeg` mag de tikker niet
     stilzetten -- dan zou een enkele storing de bewaking voorgoed uitzetten, en
     dat is de stilste manier waarop een wachter verdwijnt.

     HIJ HOUDT HET PROCES NIET WAKKER. Zonder unref() blijft een node-proces
     draaien om een timer die niemand nodig heeft; dan sluit een toets of een
     script niet meer af, en dat kost een suite haar looptijd voordat iemand
     doorheeft waarom.

   Wat hij NIET doet: de tik overslaan als de vorige nog loopt. Alle drie de
   wegingen zijn vandaag synchroon, dus dat geval bestaat niet -- en een
   voorziening voor een geval dat niet bestaat is een belofte zonder toets. */
'use strict';

function maakTikker(weeg, ms) {
  return function tikker() {
    const t = setInterval(() => { try { weeg(); } catch (e) { /* nooit de lus breken */ } }, ms);
    if (t.unref) t.unref();
    return t;
  };
}

module.exports = { maakTikker };
