/* ============================================================================
   DE VIRUSSCAN OP EEN WEBBUNDEL -- de algemene scanner, met een filter dat bij
   naam wordt verantwoord.

   Apart bestand omdat het een ADAPTER is en geen poort: het vertaalt een
   scanner die voor uploads is gebouwd naar een soort inhoud waarvoor hij niet
   is gebouwd. Zo'n vertaling hoort zichtbaar te zijn, met zijn eigen uitleg, en
   niet verstopt tussen de vormregels van ./keuring.js.
   ========================================================================== */
'use strict';

const { TOEGESTAAN, TEKSTSOORT } = require('./verboden');

/* ----------------------------------------------------------------------------
   DE VIRUSSCAN OP EEN WEBBUNDEL, EN WAAROM HIJ EEN FILTER HEEFT.

   kern/antivirus is gebouwd voor wat een lid UPLOADT: paspoortfoto's, selfies,
   PDF's. Daar is "<script in dit bestand" een polyglot-aanval en ".js" een
   gevaarlijke extensie, en dat klopt.

   Een app-bundel is het tegenovergestelde: daar IS <script de inhoud en .js het
   product. Draait de scanner daar ongewijzigd overheen, dan zegt hij "besmet"
   over elke correcte inzending -- en een controle die altijd afgaat is even
   waardeloos als een die nooit afgaat (LAT-regel 9). Wie hem dan uitzet, zet de
   hele scan uit, en dat is precies de verzwakking die deze uitleg voorkomt.

   Daarom worden er voor de TEKSTSOORTEN uit onze eigen allowlist twee
   bevindingen bij naam overgeslagen, en geen enkele andere:

     'Script-tag in bestand (polyglot)'  -- dat is wat een HTML-pagina is
     'gevaarlijke extensie: .js'         -- dat is wat een app is

   Alles wat overblijft telt gewoon mee: EICAR, PHP, webshells (eval(base64_decode,
   shell_exec), WScript.Shell, uitvoerbare magie, dubbele extensies, en de
   afgepelde gzip-/base64-lagen daaronder. Voor de BINAIRE soorten (beeld,
   lettertype) draait de scanner volledig ongewijzigd: daar is een <script of
   PE-magie wel degelijk wat de scanner denkt dat het is. */
const OVERSLAAN_IN_TEKST = ['Script-tag in bestand (polyglot)'];
const EXT_STRUCTUREEL = /^gevaarlijke extensie: \.js$/;

function scanBundel(antivirus, buf, pad, e) {
  const av = antivirus.scan(buf, { naam: pad, mime: TOEGESTAAN[e] });
  if (!TEKSTSOORT.has(e) || av.verdict === 'schoon') return av;
  const over = av.redenen.filter(r =>
    !OVERSLAAN_IN_TEKST.some(n => r.includes(n)) && !EXT_STRUCTUREEL.test(r));
  if (!over.length) return Object.assign({}, av, { verdict: 'schoon', redenen: [] });
  /* Opnieuw wegen op wat er OVERBLIJFT, en op de ernst die de definitie zelf
     draagt -- niet op de ernst die de scanner had berekend inclusief wat we net
     hebben overgeslagen. */
  const zwaar = (typeof antivirus.definities === 'function' ? antivirus.definities() : [])
    .filter(d => d.ernst === 'besmet').map(d => d.naam);
  const besmet = over.some(r => /extensie:/.test(r) || zwaar.some(n => r.includes(n)));
  return Object.assign({}, av, { verdict: besmet ? 'besmet' : 'verdacht', redenen: over });
}

module.exports = { scanBundel, OVERSLAAN_IN_TEKST };
