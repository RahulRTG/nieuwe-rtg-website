'use strict';
/* ============================================================================
   ONDER WELKE OMSTANDIGHEDEN IS ER GEMETEN? -- een plek, en deze.

   Elke duurmeting draagt een BRON (`waar|node|kernen|commit`) en een MODUS
   (`normaal` of `dekking`). Die twee bepalen of een gewicht later nog iets
   betekent: met dekking aan is ast-grens.test.js meer dan drie keer zo duur als
   zonder, en een register dat die twee door elkaar haalt stuurt de verdeling op
   een kostenmodel dat nergens bestaat. Dat is hier een keer gebeurd -- de
   scherven liepen 1348s tegen 526s terwijl de projectie 1,00x zei.

   HIJ STAAT HIER OMDAT ER TWEE LOPERS ZIJN. scripts/test-runner.js draait de
   unit-scherven en scripts/e2e.js de schermtoetsen; allebei spawnen ze
   toetsprocessen en allebei moeten ze hetzelfde etiket plakken. Twee kopieen
   van deze regel is precies LAT.md regel 4, en dan is het over een half jaar
   drie -- met een register dat zichzelf tegenspreekt.

   DE MODUS IS TWEE KEER NODIG, EN DAT IS DE VALKUIL. Niet alleen bij het METEN
   (welk etiket krijgt deze waarneming) maar ook bij het PLANNEN (met welke
   gewichten verdeel ik de scherven). Zet je hem alleen in de omgeving van het
   kindproces, dan meet de loper netjes `dekking` en verdeelt hij intussen op
   `normaal` -- dezelfde fout als hierboven, een niveau lager, en net zo
   onzichtbaar. Vandaar `zetModus()`: hij zet hem in DIT proces, zodat
   scripts/lib/delen.js hem leest, en geeft hem terug voor de kinderen.
   ========================================================================== */
const path = require('path');
const WORTEL = path.join(__dirname, '..', '..');

let onthouden = null;

/* Een keer per proces. `git rev-parse` per toetsproces zou duizend spawns zijn
   voor een waarde die de hele ronde hetzelfde is. */
function bron() {
  if (onthouden) return onthouden;
  let commit = 'onbekend';
  try {
    commit = require('child_process')
      .execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: WORTEL, encoding: 'utf8' }).trim();
  } catch (e) { /* zonder git ook goed */ }
  onthouden = [process.env.GITHUB_ACTIONS ? 'ci' : 'lokaal', process.version,
    require('os').cpus().length, commit].join('|');
  return onthouden;
}

/* Zet de modus voor DIT proces (de planner leest hem) en geef hem terug voor de
   kinderen (de meting draagt hem). */
function zetModus(metDekking) {
  const modus = metDekking ? 'dekking' : 'normaal';
  process.env.RTG_TOETSMODUS = modus;
  return modus;
}

module.exports = { bron, zetModus };
