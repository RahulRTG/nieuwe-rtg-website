/* ============================================================================
   DE SCHADUWMETER van het bezitsbewijs -- meten, niet beslissen.

   Afgesplitst van ./bezitsbewijs.js omdat het twee dingen zijn: dat bestand
   BESLIST of een verzoek door mag, dit TELT wat er zou gebeuren. Zolang ze in
   een bestand zaten, was het verleidelijk om de teller iets over het besluit te
   laten zeggen -- en dat is precies wat hier niet mag (zie stand() onder).

   ZONDER DEZE TELLERS blijft de stand voor altijd op `schaduw` staan, want
   niemand weet wat er zou gebeuren als je hem omzet. Dat is hoe een
   handhavingsregel die "eerst meeloopt" er een wordt die nooit gaat lopen.

   WAT HIJ TELT EN WAT NIET. Alleen uitkomsten per pad -- geen leden, geen
   sessies, geen tijdstippen per persoon. Om te besluiten of je mag gaan
   weigeren, hoef je niet te weten WIE er zou zijn geweigerd. Een teller is
   genoeg; een journaal per lid zou een gedragslogboek zijn dat niemand voor dit
   besluit nodig heeft (dezelfde redenering als kern/kosten: tellers en geen
   journaal).

   WAT HIJ NIET DEKT, en dat hoort in het antwoord te staan en niet alleen hier:
   hij telt per PROCES en overleeft geen herstart. Dit huis draait meerdere
   werkprocessen, dus wie hem uitleest ziet er een. Voor een besluit over dagen
   tot weken is een steekproef genoeg; wie exacte cijfers wil, moet hem in de
   database zetten -- en dan hoort er een bewaartermijn bij.
   ========================================================================== */
'use strict';
const klok = require('../../lib/klok');

function maakMeter(standNu) {
  const meter = { sinds: klok.datum().toISOString(), totaal: 0, perUitkomst: {}, perPad: {} };

  function tel(pad, uitkomst) {
    meter.totaal++;
    meter.perUitkomst[uitkomst] = (meter.perUitkomst[uitkomst] || 0) + 1;
    const p = meter.perPad[pad] || (meter.perPad[pad] = {});
    p[uitkomst] = (p[uitkomst] || 0) + 1;
  }

  /* DE STAND, met het oordeel er NIET bij.

     Er staat met opzet geen "klaar om aan te zetten: ja". Dat zou het ene groene
     cijfer zijn dat LAT-regel 11 en check.js regel 48 verbieden, en het zou de
     drempel -- een besluit van de eigenaar -- verstoppen in code. Wat hier wel
     staat is het getal waar dat besluit op rust.

     `dekking` is null zolang er niets gemeten is. Nul zou "niets werkt"
     betekenen terwijl het "wij weten het niet" is, en dat verschil is de hele
     reden dat deze laag bestaat. */
  function stand() {
    const u = meter.perUitkomst;
    const bewezen = u.bewezen || 0;
    const zouWeigeren = (u.geweigerd || 0) + (u.schaduw || 0);
    const beschermbaar = bewezen + zouWeigeren;
    return {
      stand: standNu(),
      sinds: meter.sinds,
      zwareVerzoeken: meter.totaal,
      perUitkomst: Object.assign({}, u),
      perPad: JSON.parse(JSON.stringify(meter.perPad)),
      /* Van de verzoeken die een bewijs KONDEN dragen (dus uit een gebonden
         sessie): welk deel deed dat ook. Dat is de vraag die telt -- gaat
         `aanbevolen` aanzetten iets breken. */
      dekking: beschermbaar ? Math.round((bewezen / beschermbaar) * 1000) / 10 : null,
      onbeschermd: u.onbeschermd || 0,
      nietGemeten: 'Deze tellers lopen per werkproces en beginnen opnieuw bij een herstart. Dit huis draait er meerdere, dus dit is een steekproef en geen totaal.',
      uitleg: beschermbaar
        ? 'Dekking is het deel van de verzoeken uit een GEBONDEN sessie dat een geldig bewijs meestuurde. Onbeschermd telt de verzoeken uit sessies zonder sleutelbinding; die worden pas geraakt door de stand "verplicht".'
        : 'Er is nog niets gemeten sinds de start van dit proces. Dat is iets anders dan nul procent.'
    };
  }

  return { tel, stand };
}

module.exports = { maakMeter };
