/* DEZELFDE WAARHEID, VIER KEER OPGESCHREVEN.

   Dit is geen vertaallaag en het zijn geen vier schermen. Het zijn vier lagen
   van HETZELFDE scherm, en de regel eronder is dat ze niet mogen uiteenlopen:
   wat op laag 1 "werkt" heet, moet op laag 4 een meting met een datum zijn. Een
   samenvatting die zijn eigen zinnen verzint in plaats van ze uit de bevindingen
   te halen, is binnen een maand het vriendelijkere verhaal.

     1 mens          een zin. Geen getal, geen jargon, geen percentage.
     2 operationeel  wat elke bron zegt, in de taal van die bron.
     3 technisch     de getallen eronder, per bron.
     4 bewijs        waar het vandaan komt, wanneer het gemeten is, en wat het
                     NIET aantoont.

   LAAG 4 IS DE ENIGE DIE ER NIET UIT MAG. De eerste drie kun je verzinnen; de
   vierde niet, want die verwijst naar een bron die er is of niet is. Dat is wat
   dit onderscheidt van een dashboard met een uitklapje.

   EN DE MENSENZIN LIEGT NIET OVER DOORWERKING. Een vermogen dat zelf in orde is
   maar leunt op iets dat storing heeft, zegt "dit werkt; wat er via X loopt,
   wacht" -- en niet "storing". Alles rood kleuren omdat er ergens iets stuk is,
   maakt van een kaart een alarmklok, en dan kijkt niemand meer. */
'use strict';

const NIET = 'niet vast te stellen';

/* Alleen de EERSTE letter klein. Het hele woord kleinmaken verminkt
   "De RTFoundation"; dit maakt er "de RTFoundation" van en van "Betalen"
   gewoon "betalen". */
const klein = (s) => String(s).charAt(0).toLowerCase() + String(s).slice(1);

function taal(v, r) {
  /* DE GOEDE ZIN IS DE ENIGE DIE UIT DE KAART KOMT. Bij een storing of een
     twijfel wordt hij NIET verbogen ("er staat een back-up -- maar nu niet"):
     dan staat er een eigen zin op de naam van het vermogen. Een belofte
     ontkennen leest als een belofte.

     Die drie zinnen staan met opzet in de LIJDENDE vorm ("er is iets mis met de
     gegevens"), en niet met het vermogen als onderwerp. "De gegevens doet het
     niet" is fout Nederlands zodra een naam meervoud is, en dat gebeurt bij de
     helft van deze twaalf. */
  const n = klein(r.naam);
  let mens;
  if (r.oordeel === 'storing') mens = 'Er is iets mis met ' + n + '.';
  else if (r.oordeel === 'let op') mens = 'Bij ' + n + ' vraagt iets aandacht.';
  else if (r.oordeel === NIET) mens = 'Van ' + n + ' is nu niet vast te stellen of het werkt.';
  else mens = v.mens;

  if (r.moetOpnieuw) mens += ' De laatste controle is te oud om nog iets te betekenen.';

  /* De doorwerking komt ACHTER het eigen oordeel en vervangt het niet. Bij een
     eigen storing blijft hij weg: dan is het geen nuance meer maar ruis. */
  if (r.geraakt && r.geraakt.length && r.oordeel !== 'storing') {
    mens += ' Wat hier via ' + r.geraakt.map(g => klein(g.naam)).join(' en ') + ' loopt, wacht.';
  }

  return {
    mens,
    operationeel: r.bevindingen.filter(b => b.oordeel).map(b => b.bron + ': ' + b.zin),
    technisch: r.bevindingen.map(b => ({ bron: b.bron, graad: b.graad, oordeel: b.oordeel || null,
      at: b.at, zin: b.zin, getallen: b.getallen || null, afgeleid: !!b.afgeleid })),
    bewijs: r.bewijs
  };
}

module.exports = { taal, NIET };
