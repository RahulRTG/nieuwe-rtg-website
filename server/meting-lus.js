'use strict';
/* ============================================================================
   DE EVENT-LOOP-VERTRAGING.

   Node draait alles op een lus. Blokkeert er iets -- een JSON.stringify over een
   collectie van 200.000 items, een synchrone leesactie, een lus over een hele
   array -- dan staat ELKE andere aanvraag stil zolang dat duurt. Dat is de
   klassieke manier waarop een Node-server traag wordt zonder dat een enkele
   route er traag uitziet: de tijd gaat niet op aan het verzoek dat je meet, maar
   aan het verzoek ervoor.

   DAT WERD HIER NERGENS GEMETEN. Niet in deze meting, niet op het techniekbord,
   niet in De Beproeving. Er staat wel een taak "de event-loop-stall uit het
   warme pad halen" -- maar een stall die je niet meet kun je niet repareren, en
   je kunt al helemaal niet bewijzen dat hij weg is. Dat is dezelfde vorm als de
   metrics-deur: een reparatie zonder meter die kan zakken.

   monitorEventLoopDelay uit node:perf_hooks doet het meten in C++ (een timer die
   elke resolutie-tick kijkt hoeveel later hij is dan afgesproken), dus de meter
   zelf houdt de lus niet op. De percentielen komen uit een histogram met vaste
   emmers -- zelfde afweging als hierboven: vast geheugen, ongeacht de looptijd.

   Best-effort: is monitorEventLoopDelay er niet (oudere Node), dan blijft alles
   werken en meldt de meter niets in plaats van om te vallen. */
const LUS_RESOLUTIE_MS = 10;
let lus = null;
try {
  const { monitorEventLoopDelay } = require('perf_hooks');
  lus = monitorEventLoopDelay({ resolution: LUS_RESOLUTIE_MS });
  lus.enable();
  if (lus.unref) lus.unref();
} catch (e) { lus = null; }

/* De vertraging in milliseconden. Geeft null als er niet gemeten kan worden --
   NIET nul, want nul is een meetwaarde en "ik weet het niet" is dat niet.

   DE RESOLUTIE GAAT ERAF, en dat is geen cosmetica. monitorEventLoopDelay meet
   het verschil tussen de geplande en de werkelijke tijd van zijn eigen timer, en
   die timer is per definitie op zijn vroegst na een volle resolutie-tick aan de
   beurt. Een volstrekt rustige lus meldt daardoor ~10 ms. Gemeten op deze
   machine:

       rustig                10.16 / p99 10.29 ms
       na 200 ms blokkade    16.01 / p99 209.98 ms

   Wie die 10,16 als vertraging leest, denkt dat een idle server 10 ms achterloopt
   en heeft geen idee meer wat een echte stall is -- en erger, hij went eraan.
   Na aftrek staat er wat er staat: rustig ~0,2 ms, en die blokkade van 200 ms
   komt eruit als 200. De ondergrens op 0 is er omdat de klok soms een fractie
   vroeger tikt dan gepland; een negatieve vertraging is geen meting maar ruis. */
function lusVertraging() {
  if (!lus) return null;
  const ms = (n) => Number(Math.max(0, n / 1e6 - LUS_RESOLUTIE_MS).toFixed(2));
  return { gemiddeld: ms(lus.mean), p50: ms(lus.percentile(50)), p99: ms(lus.percentile(99)), max: ms(lus.max) };
}
// na een meetvenster de teller leegmaken, zodat een volgende fase vers meet
function lusWis() { if (lus) lus.reset(); }

module.exports = { lusVertraging, lusWis, LUS_RESOLUTIE_MS };
