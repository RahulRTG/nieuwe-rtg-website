/* ============================================================================
   DE VORM VAN EEN MACHTIGING -- de stand en wat er naar buiten gaat.

   Apart van ./machtiging.js omdat dat bestand er over de omvangsgrens van
   keuringsregel 13 mee ging. De naad ligt op een echte grens: hier staat geen
   levensloop en geen opslag, alleen hoe een machtiging eruitziet.

   DE STAND IS BEREKEND EN NOOIT OPGESLAGEN. Verlopen is een toestand die uit de
   klok volgt, geen vlag die een opruimtaak omzet -- een opruimtaak die een uur
   niet draait, laat een verlopen machtiging een uur lang open staan, en dat is
   precies de faalvorm die deze laag niet mag hebben.

   EN `gebruikt` GAAT NAAR BUITEN ALS EEN AANTAL. De regels eronder zeggen WAT
   er is opgevraagd en WANNEER; dat hoort in het journaal en in de zaak, niet in
   elk lijstje dat een scherm ophaalt.
   ========================================================================== */
'use strict';

const klok = require('../../lib/klok');

function stand(m) {
  if (m.ingetrokken) return 'ingetrokken';
  return Date.parse(m.tot) <= klok.nu() ? 'verlopen' : 'geldig';
}

function kortM(m) {
  return { id: m.id, zaak: m.zaak, mens: m.mens, doel: m.doel, capabilities: m.capabilities.slice(),
    zwaar: m.zwaar.slice(), stand: stand(m), at: m.at, tot: m.tot, minuten: m.minuten,
    tweedeMens: m.tweedeMens, gebruikt: m.gebruikt.length };
}

module.exports = { stand, kortM };
