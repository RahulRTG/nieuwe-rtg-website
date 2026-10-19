/* DE CONTEXTBUS VOLGEN -- de eerste ontvanger (19 oktober 2026).
   WERKRUIMTE.md par. 5 en rtg-schil/05-context.js. Kiest iemand in een andere
   app een object, dan stuurt de schil een VERWIJZING rond: soort, id, label.
   Dit is de eerste ontvanger, en hij houdt zich aan het contract dat voor
   elke ontvanger geldt:

     1. alleen {rtg:'context', ref} van het eigen bovenvenster (de schil),
        van dezelfde herkomst; een ander venster wordt niet gehoord;
     2. oplossen met de EIGEN sessie en de eigen rechten -- hier: de eigen
        afspraken. De verwijzing draagt geen gegevens, en wat de verzender
        heeft, komt hier niet binnen;
     3. een soort die we niet kennen, of niets gevonden: zwijgen en niets
        tonen. Zwijgen is "volg niet";
     4. wel gevonden: het zelf tonen, en de schil laten weten dat we volgen
        ({rtg:'context-volgt', soort, id, wat}). Geen gegevens terug, alleen
        wat we doen;
     5. ref null is "context weg": de eigen weergave terug zoals hij was.

   De bediening van de agenda zelf woont in ./app.js; die geeft hier via
   window.RTGAgendaBus zijn stand, zijn laadfunctie en zijn api door. */
(function () {
  'use strict';
  var bus = window.RTGAgendaBus;
  if (!bus) return;
  var $ = function (s) { return document.querySelector(s); };
  var VOLGT = {
    /* Een reis die als afspraak hierheen is gesleept, draagt zijn label als
       titel (zie KAN in ./app.js). Op de titel zoeken is dus zoeken in wat het
       lid zelf in zijn agenda heeft staan -- niets daarbuiten. */
    reis: function (ref, items) { return items.filter(function (x) { return x.titel === ref.label; }); }
  };
  var contextVersie = 0, contextVoor = null;
  function contextRegel(tekst) {
    var p = $('#agendaContext');
    if (!p && tekst) {
      p = document.createElement('p');
      p.id = 'agendaContext'; p.className = 'stil'; p.setAttribute('role', 'status');
      var kal = $('#kal'); kal.parentNode.insertBefore(p, kal);
    }
    if (p) { p.textContent = tekst || ''; p.hidden = !tekst; }
  }
  function wisContext() {
    contextVersie++;
    if (document.body.dataset.context === undefined) return;
    delete document.body.dataset.context;
    contextRegel('');
    if (contextVoor) { bus.stand.anker = contextVoor.anker; bus.stand.weergave = contextVoor.weergave; contextVoor = null; bus.laad(); }
  }
  window.addEventListener('message', function (e) {
    if (e.origin !== location.origin || e.source !== window.parent || !e.data || e.data.rtg !== 'context') return;
    var ref = e.data.ref;
    if (!ref || !ref.id || !bus.sessie || !VOLGT[ref.soort]) return wisContext();
    var versie = ++contextVersie;
    bus.api('mijn-lijst').then(function (r) {
      if (versie !== contextVersie) return;                 // er kwam al een nieuwere context
      var raak = r.status === 200 ? VOLGT[ref.soort](ref, r.body.items || []) : [];
      if (!raak.length) return wisContext();
      raak.sort(function (a, b) { return String(a.datum).localeCompare(String(b.datum)); });
      if (!contextVoor) contextVoor = { anker: bus.stand.anker, weergave: bus.stand.weergave };
      bus.stand.anker = raak[0].datum; bus.stand.weergave = 'dag';
      document.body.dataset.context = String(ref.id);
      var wat = raak.length + (raak.length === 1 ? ' afspraak' : ' afspraken') + ' bij ' + String(ref.label || ref.id).slice(0, 80);
      contextRegel('Context: ' + wat);
      bus.laad();
      try { window.parent.postMessage({ rtg: 'context-volgt', soort: String(ref.soort), id: String(ref.id), wat: wat }, location.origin); } catch (x) {}
    });
  });
})();
