/* VIEL HET INSTRUMENT OM? -- een ongevangen fout van Node is geen bevinding.

   De instrumenten van de meetronde eindigen met uitgang 1 als ze iets VINDEN.
   Node eindigt een ongevangen fout met dezelfde 1, en dan las een instrument dat
   niet eens laadde als "klaar (register onveranderd)" -- zo stond
   AUDITPROEF.json drie weken stil (28 september 2026). Een crash herken je aan
   een regel `...Error: ...` met direct daaronder een stapelspoor; een
   waarschuwing (`ExperimentalWarning`) heeft er geen. */
'use strict';
const valOm = (fout) => /(^|\n)[A-Za-z]*Error: [^\n]*\n\s+at /.test(String(fout || ''));
module.exports = { valOm };
