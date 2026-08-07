/* DE HAAK WAAR HET DOORGEEFJOURNAAL AAN HANGT.

   WAAROM DIT EEN APART, LEEG DINGETJE IS. Het journaal (kern/doorgeefjournaal.js)
   wordt pas bij het samenstellen van de kern gebouwd, en het heeft db en save
   nodig. Maar de plekken die eraan moeten MELDEN zitten juist onderin: mail.js
   verstuurt post, de verzoekketen ziet elk verzoek binnenkomen. Die zouden dan
   naar boven moeten reiken, en dan draait de afhankelijkheid de verkeerde kant
   op -- een lage laag die een hoge nodig heeft.

   Deze haak keert dat om. Onderin roept iedereen `meld(...)` aan; of daar iets
   mee gebeurt, bepaalt de kern door zich een keer aan te melden. Voor het
   opstarten, in toetsen en in scripts is er niets aangemeld en doet melden dus
   niets -- geen fout, geen kosten.

   Het blijft met opzet een dun laagje: geen buffer, geen formatteren, geen
   beslissingen. Alles wat een keuze is, hoort in het journaal zelf. */
'use strict';

let ontvanger = null;

/* Aanmelden doet het journaal een keer, bij het samenstellen van de kern. Een
   tweede aanmelding overschrijft de eerste: dat is beter dan er twee naast
   elkaar te hebben, want dan zou een toets die zijn eigen journaal opzet stil
   ook in dat van de vorige blijven schrijven. */
function zet(fn) { ontvanger = typeof fn === 'function' ? fn : null; }

/* Melden mag NOOIT iets breken. Een journaal dat een verzoek laat mislukken is
   erger dan geen journaal: dan is de meting zelf de storing. */
function meld(regel) {
  if (!ontvanger) return;
  try { ontvanger(regel); } catch (e) { /* een logboek mag nooit in de weg lopen */ }
}

module.exports = { zet, meld };
