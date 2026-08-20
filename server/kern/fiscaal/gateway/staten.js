/* DE AANGIFTEGATEWAY (deelmodule): DE STAAT VAN EEN ZENDING -- puur.

   Zelfde vorm als kern/betaalwaarheid/staten.js, en met opzet: een zending naar
   een instantie en een betaling naar een provider hebben hetzelfde probleem --
   een buitenwereld die traag antwoordt, soms twee keer, en soms niet. Dat is
   daar opgelost met een staat die maar een kant op gaat en een keten die elke
   overgang verzegelt. Hier hetzelfde, zodat wie het een begrijpt het ander ook
   begrijpt.

   DE STATEN, en waarom er geen 'VERZONDEN' bij zit. Er is AANGEBODEN (wij
   hebben het weggegeven) en BEVESTIGD (zij hebben het aangenomen). Een toestand
   die 'verzonden' heet zou die twee laten samenvallen, en dan staat er straks
   iets op verzonden waarvan niemand weet of het ooit is aangekomen. Precies de
   fout die kern/payroll/aangifte.js en de btw-aangifte al vermijden met
   "vastleggen DAT er is ingediend" -- daar is het een mens die het bevestigt,
   hier een instantie.

   AFGEWEZEN IS EEN EINDSTATION. Een afgewezen zending wordt niet opnieuw
   aangeboden: de inhoud deugde niet, dus er hoort een NIEUWE zending te komen
   met een eigen verzegeling. Hem opnieuw sturen zou betekenen dat er twee
   dingen onder een kenmerk hangen. MISLUKT is dat niet -- daar ging het
   TECHNISCH mis en is de inhoud nog ongewijzigd, dus daar mag een retry op. */
'use strict';

const STATUS = Object.freeze({
  KLAAR: 'KLAAR',                 // opgemaakt en verzegeld; nog niets weggegeven
  AANGEBODEN: 'AANGEBODEN',       // aan het kanaal gegeven, wachtend op antwoord
  BEVESTIGD: 'BEVESTIGD',         // de instantie nam hem aan, met kenmerk
  AFGEWEZEN: 'AFGEWEZEN',         // de instantie wees hem af, met reden
  MISLUKT: 'MISLUKT',             // technisch misgegaan; de inhoud staat nog
  INGETROKKEN: 'INGETROKKEN'      // voor aanbieding teruggenomen
});

const OVERGANGEN = Object.freeze({
  KLAAR: ['AANGEBODEN', 'INGETROKKEN'],
  AANGEBODEN: ['BEVESTIGD', 'AFGEWEZEN', 'MISLUKT'],
  MISLUKT: ['AANGEBODEN', 'INGETROKKEN'],
  BEVESTIGD: [],
  AFGEWEZEN: [],
  INGETROKKEN: []
});

/* Een eindstation is een staat waar niets meer uit vertrekt. Afgeleid en niet
   apart opgeschreven: een tweede lijst zou uit de pas lopen met de eerste. */
const EINDE = Object.freeze(Object.keys(OVERGANGEN).filter(s => !OVERGANGEN[s].length));

function mag(van, naar) {
  return !!(OVERGANGEN[van] && OVERGANGEN[van].includes(naar));
}

/* Waarom een overgang niet mag -- in woorden, want "false" laat de aanroeper
   zelf een reden verzinnen en die is dan bijna altijd te vaag. */
function waarom(van, naar) {
  if (!STATUS[van]) return 'Onbekende beginstaat: ' + van + '.';
  if (!STATUS[naar]) return 'Onbekende eindstaat: ' + naar + '.';
  if (mag(van, naar)) return null;
  if (EINDE.includes(van)) return 'Deze zending staat op ' + van + ' en daar vertrekt niets meer uit.';
  return 'Van ' + van + ' kan een zending alleen naar ' + OVERGANGEN[van].join(' of ') + '.';
}

module.exports = { STATUS, OVERGANGEN, EINDE, mag, waarom };
