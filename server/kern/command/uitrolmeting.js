/* HET METEN VAN EEN UITROLTREDE -- en met opzet niet het besluit.

   Dit stond in ./uitrolregie.js, en die stond met 13,0 kB boven de maat. De naad
   die TAKEN.md 5.57 benoemt loopt precies hier: dit bestand MEET (hoeveel
   antwoorden en hoeveel serverfouten sinds deze trede werd gezet, en wat dat
   over de trede zegt), en de regie ernaast BESLIST (klimmen, zakken, pauzeren,
   wachten op een mens).

   Waarom dat verschil de moeite waard is om te knippen: een oordeel is te
   toetsen zonder ook maar een trede te zetten, en een regie is te lezen zonder
   de rekenregels van de meting ertussendoor.

   DRIE VAN DE VIER UITKOMSTEN ZIJN "NOG NIET WETEN", en die worden met opzet uit
   elkaar gehouden: een nulmeting die kwijt is (het proces is herstart) vraagt
   iets anders van de bediener dan te weinig verkeer, en dat weer iets anders dan
   een trede die simpelweg nog niet lang genoeg staat. Ze samenvatten tot "nee"
   zou de bediener laten wachten op iets dat nooit komt.

   ------------------------------------------------------------------------
   DRIE KEUZES DIE ERTOE DOEN

   1. DE METING KOMT UIT server/meting.js, dezelfde tellers als /api/metrics, de
      servicedoelen en de canary. Een uitrol die zelf telt kan een ander verhaal
      vertellen dan het foutbudget, en dan is niet meer te zeggen welke van de
      twee had moeten stoppen. Omdat die tellers sinds procesbegin lopen, legt
      elke trede een NULMETING vast en rekent de regie op het verschil.

   2. HERSTARTEN WIST DE NULMETING, en dan KLIMT DE REGIE NIET. Het verschil
      staat dan lager dan de nulmeting, en dat is geen groen maar een onbekende.
      Stilzwijgend doorrekenen geeft een negatief foutaantal en dus altijd groen
      -- precies de kant waarop een uitrolautomaat niet fout mag gaan. Hij meldt
      'nulmeting kwijt' en wacht tot er weer echt gemeten is.

   3. HIJ MEET ALLE VERKEER EN NIET ALLEEN DE NIEUWE PADEN. Een trede openzetten
      kan iets breken dat er niet in staat -- een nieuwe query die de database
      belast, een laag die ineens meer werk krijgt. Alleen de nieuwe paden wegen
      zou juist dat missen.

   Draai los: node --test test/uitrolregie.test.js */
'use strict';

function maakUitrolmeting({ meting, nu, STANDAARD }) {
  const tijd = nu;

/* Alle antwoorden en alle serverfouten van dit moment. Zie keuze 3 in de kop:
   bewust over het HELE verkeer en niet over de paden van de nieuwe trede. */
function tel() {
  const r = meting.reeksen();
  let antwoorden = 0, fouten = 0;
  for (const v of r.verzoeken) {
    antwoorden += v.aantal;
    if (v.status === '5xx') fouten += v.aantal;
  }
  return { antwoorden, fouten };
}

/* Het oordeel over de HUIDIGE trede. Vier uitkomsten, en drie ervan zijn
   "nog niet weten" -- die worden met opzet uit elkaar gehouden, want ze
   vragen om ander gedrag van de bediener. */
function oordeel(u) {
  if (!u.trede) return { stand: 'geen trede', klimbaar: false };
  const nuTel = tel();
  const antwoorden = nuTel.antwoorden - ((u.basis && u.basis.antwoorden) || 0);
  const fouten = nuTel.fouten - ((u.basis && u.basis.fouten) || 0);
  if (antwoorden < 0 || fouten < 0) {
    return { stand: 'nulmeting kwijt', klimbaar: false, zakbaar: false,
      uitleg: 'het proces is herstart, dus er valt niets te wegen tot deze trede opnieuw wordt gezet' };
  }
  const wachtMs = u.sinds ? (tijd() - Date.parse(u.sinds)) : 0;
  const deel5xx = antwoorden ? Number((fouten / antwoorden).toFixed(4)) : null;
  const genoeg = antwoorden >= STANDAARD.minimum;
  const uitgerust = wachtMs >= STANDAARD.rustMs;
  if (genoeg && deel5xx > STANDAARD.drempel) {
    return { stand: 'over de drempel', klimbaar: false, zakbaar: true, antwoorden, fouten, deel5xx, wachtMs,
      uitleg: Math.round(deel5xx * 1000) / 10 + '% serverfouten op ' + antwoorden + ' antwoorden' };
  }
  if (!genoeg) return { stand: 'onvoldoende gemeten', klimbaar: false, zakbaar: false, antwoorden, fouten, deel5xx, wachtMs,
    uitleg: antwoorden + ' van de ' + STANDAARD.minimum + ' antwoorden die nodig zijn om iets te durven zeggen' };
  if (!uitgerust) return { stand: 'nog niet uitgerust', klimbaar: false, zakbaar: false, antwoorden, fouten, deel5xx, wachtMs,
    uitleg: 'deze trede staat ' + Math.round(wachtMs / 60000) + ' van de ' + Math.round(STANDAARD.rustMs / 60000) + ' minuten' };
  return { stand: 'binnen de drempel', klimbaar: true, zakbaar: false, antwoorden, fouten, deel5xx, wachtMs };
}

  return { tel, oordeel };
}

module.exports = { maakUitrolmeting };
