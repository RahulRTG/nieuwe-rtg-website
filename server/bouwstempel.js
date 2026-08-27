/* WELKE BUILD DRAAIT HIER? -- de runtimekant van de release-provenance.

   Een materiaallijst (scripts/sbom.js) zegt waar een release uit bestaat. Die
   lijst is niets waard als niemand van een DRAAIENDE server kan vragen welke
   release het is: dan blijft "is wat er draait ook wat er is gebouwd" een
   kwestie van vertrouwen, en dat is precies wat provenance moet vervangen.

   De twee waarden komen uit de omgeving en worden bij het bouwen van het image
   gezet (zie de Dockerfile en .github/workflows/release-image.yml). Ze worden
   hier NIET berekend: een proces dat zijn eigen afdruk uitrekent, rekent hem uit
   over de bestanden die het op dat moment heeft -- en dat is precies de vraag
   niet. Het antwoord hoort van de bouwer te komen, niet van de gebouwde.

   EN ALS ZE ER NIET ZIJN, STAAT DAT ER. Niet een leeg veld en niet een gok, maar
   `vastgelegd: false` met de reden erbij. Een ontwikkelserver hoort te zeggen
   dat hij geen release is; dat is een eerlijk antwoord en geen storing. Dat is
   dezelfde regel als overal in dit huis: wat niet gemeten is, wordt niet als
   getal getoond (BESTUUR.md). */
'use strict';

const KORT = (v) => (typeof v === 'string' && v.trim() ? v.trim() : null);

function bouwstempel() {
  const commit = KORT(process.env.RTG_BOUW_COMMIT);
  const afdruk = KORT(process.env.RTG_BRON_AFDRUK);
  const at = KORT(process.env.RTG_BOUW_AT);
  const vastgelegd = !!(commit && afdruk);
  return {
    vastgelegd,
    commit, bronAfdruk: afdruk, gebouwdOp: at,
    /* De reden staat erbij en niet in de documentatie: wie dit veld leest,
       heeft geen documentatie bij de hand. */
    reden: vastgelegd ? null
      : 'Dit proces is niet uit een release-image gestart, of de bouwpijplijn heeft geen stempel meegegeven. ' +
        'Er is dus geen afdruk om tegen de materiaallijst te leggen.'
  };
}

module.exports = { bouwstempel };
