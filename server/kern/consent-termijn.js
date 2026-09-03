/* ============================================================================
   DE TERMIJN EN HET DOEL VAN EEN TOESTEMMING.

   Afgesplitst van ./consent-lezers.js toen dat bestand over de 10 KB van
   keuringsregel 13 ging. Die grens is een dakpan die zegt dat er een tweede
   onderwerp in zit, en dat klopte hier: daar staan de elf LEZERS (welke lagen
   er zijn en hoe je ze uitleest), hier staat wat er met een gelezen rij gebeurt.

   ELKE RIJ KRIJGT ZIJN DOEL EN ZIJN TERMIJN UIT HET REGISTER, en niet uit de
   laag zelf. Dat is met opzet: de laag weet WAT hij deelt, het register weet
   WAARVOOR de laag bestaat en hoe zijn venster afloopt. Zou elke laag dat zelf
   meesturen, dan stond dezelfde belofte op elf plekken (LAT.md regel 4).

   EN `tot: null` BESTAAT HIER NIET MEER. Vijf lagen gaven een kale null, en die
   betekende twee dingen die op een scherm identiek lezen: "loopt door tot u hem
   stopt" en "deze laag houdt geen einddatum bij". De termijn is daarom een STAND
   met een uitleg; zie de kop van ./consent-register.js.

   Krijgt LAGEN mee in plaats van het register zelf te laden: zo staat de bron
   van de definities op een plek en kan deze functie zonder database worden
   getoetst.
   ========================================================================== */
'use strict';

module.exports = (LAGEN) => {
  const perLaag = Object.fromEntries((LAGEN || []).map(l => [l.id, l]));

  return function verrijk(rij) {
    const def = perLaag[rij.laag] || {};
    const heeftDatum = !!rij.tot;
    /* Een laag die "venster" heet en geen datum meestuurt, is een fout in de
       laag en geen stand op het scherm. Hij wordt hier zichtbaar gemaakt in
       plaats van gladgestreken tot een lege datum. */
    const soort = def.termijn === 'venster'
      ? (heeftDatum ? 'venster' : 'venster-zonder-datum')
      : (def.termijn || 'zolang-het-staat');
    return Object.assign({}, rij, {
      doel: def.doel || null,
      termijn: {
        soort,
        tot: rij.tot || null,
        uitleg: soort === 'venster' ? ('Loopt tot ' + rij.tot + '.')
          : soort === 'venster-zonder-datum'
            ? 'Deze toestemming hoort een einddatum te hebben, en die kwam niet mee. Meld dit; tot dan is niet vast te stellen wanneer hij afloopt.'
            : (def.termijnUitleg || 'Loopt door tot u hem stopt.')
      }
    });
  };
};
