/* WAAR JE BENT, GEZEGD DOOR HET SCHERM ZELF (EDGE.md besluit 11, stap 24).

   Een scherm dat een eigen hoofdactie aanwijst (data-hoofdactie) zegt ook zelf
   waar je bent: het publiceert zijn context via RTGAdaptief.context met een
   bron. Doet het dat niet, dan valt het blikveld terug op de documenttitel
   (herkomst 'edge-casco' of 'document') en staat het scherm op CONTEXT_SCHULD
   in scripts/edgedekking.js.

   Agenda en Notities losten dat af met elk een eigen context.js van dezelfde
   twaalf regels. Dit is die ene regel op EEN plek (LAT.md regel 4): het scherm
   zegt in zijn eigen HTML wie het is -- data-rtg-context-bron op <body> -- en
   deze module zegt het aan het register. Een scherm zonder die verklaring
   krijgt hier niets; een scherm dat zelf al een rijkere context publiceerde
   (met handelingen, een object of een selectie) wordt niet overschreven, want
   dan weet het meer dan de titel.

   De titel is de documenttitel van het scherm -- dezelfde naam die het tabblad
   en de werktafel tonen, geen tweede naam. Die titel wordt na het laden nog
   vertaald (rtg-daily-fields.js, i18n), dus de context volgt hem: verandert de
   titel, dan zegt het scherm het opnieuw. In de schil reist hij via
   adaptief/brug.js naar het blikveld van de schil.

   Het scherm publiceert hiermee GEEN handelingen: het declareert er geen, en
   een lijst ids zonder declaratie zou een knop beloven die er niet is.

   Laden NA shared/adaptief/register.js (defer, documentvolgorde). Hij woont onder
   apps/ en niet onder shared/: in de schil (app.html) zet alleen de brug een
   context, en test/edgedekking-zelf.test.js toets 5 houdt dat lexicaal vast over
   alles wat onder shared/ staat. Dit is een module VAN de schermen. */
(function (w, d) {
  'use strict';
  if (w.RTGSchermcontext) return;
  function bron() {
    var b = d.body && d.body.getAttribute('data-rtg-context-bron');
    return b ? String(b).trim() : '';
  }
  function zeg() {
    var A = w.RTGAdaptief, b = bron();
    if (!A || !b) return false;
    var nu = A.context();
    if (nu && nu.bron && nu.bron !== b) return false;        // een rijkere context van het scherm zelf
    if (nu && nu.bron === b && (nu.acties || []).length) return false;
    A.context({ bron: b, titel: d.title });
    return true;
  }
  function start() {
    zeg();
    var t = d.querySelector('head > title');
    if (t && w.MutationObserver) new w.MutationObserver(zeg).observe(t, { childList: true, characterData: true, subtree: true });
  }
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', start, { once: true }); else start();
  w.RTGSchermcontext = { zeg: zeg, bron: bron };
})(window, document);
