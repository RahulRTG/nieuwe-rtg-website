/* RTG Office, de uitslag van een formulier: het kijkvenster van de bouwer
   en de CSV-export. Het bouwen en invullen woont in formulier.js; kijken
   is een ander vak, dus het staat apart.

   De weergave volgt de wijze van het formulier: op codenaam staan de namen
   bij de open antwoorden en onderaan de lijst van wie invulde; anoniem
   toont bewust geen enkele naam.

   Levert window.RTGOfficeFormulierUitslag. */
(function () {
  'use strict';
  var esc = function (t) {
    return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };

  function toon(opties) {
    var wrap = opties.wrap, api = opties.api, docId = opties.docId, meld = opties.meld, terug = opties.terug;
    api('uitslag', { id: docId }).then(function (r) {
      if (r.body.error) return meld(r.body.error);
      var u = r.body;
      wrap.innerHTML = '<div class="fkop"><b>' + u.aantal + (u.aantal === 1 ? ' inzending' : ' inzendingen') + '</b>' +
        '<span class="fstil">' + (u.wijze === 'anoniem'
          ? 'Anoniem: u ziet geen namen bij de antwoorden.' : 'Op codenaam.') + '</span>' +
        '<button class="knop" id="fTerugBouw" type="button">Terug naar de vragen</button></div>' +
        u.vragen.map(function (v, i) {
          var lijf = v.soort === 'keuze'
            ? v.telling.map(function (t) {
                return '<p class="fbalkje"><span>' + esc(t.optie) + '</span><b>' + t.aantal + '</b></p>';
              }).join('')
            : v.soort === 'schaal'
            ? '<p class="fbalkje"><span>Gemiddeld</span><b>' + (v.gemiddelde == null ? '-' :
                String(v.gemiddelde).replace('.', ',')) + '</b></p>' +
              v.telling.map(function (n, j) {
                return '<p class="fbalkje"><span>' + (j + 1) + '</span><b>' + n + '</b></p>';
              }).join('')
            : (v.teksten.length ? v.teksten.map(function (t) {
                return '<p class="fopen">' + (t.van ? '<b>' + esc(t.van) + '</b> · ' : '') + esc(t.tekst) + '</p>';
              }).join('') : '<p class="fstil">Nog geen antwoorden.</p>');
          return '<div class="fvraag"><div class="frij"><span class="fnr">' + (i + 1) + '</span>' +
            '<span class="fv-lab">' + esc(v.tekst || '(vraag zonder tekst)') + '</span></div>' + lijf + '</div>';
        }).join('') +
        (u.wie && u.wie.length ? '<p class="fstil">Ingevuld door: ' + u.wie.map(function (w) {
          return esc(w.van);
        }).join(', ') + '</p>' : '');
      wrap.querySelector('#fTerugBouw').addEventListener('click', terug);
    });
  }

  /* De CSV: per vraag zijn eigen regels -- keuzes als telling per optie,
     schalen als gemiddelde plus telling, open antwoorden een regel per
     antwoord (met codenaam als de wijze dat toestaat). */
  function csv(api, docId) {
    return api('uitslag', { id: docId }).then(function (r) {
      if (r.body.error) return null;
      var rij = function (a) {
        return a.map(function (c) { return '"' + String(c == null ? '' : c).replace(/"/g, '""') + '"'; }).join(';');
      };
      var regels = [rij(['vraag', 'soort', 'wie of optie', 'antwoord of aantal'])];
      r.body.vragen.forEach(function (v) {
        if (v.soort === 'keuze') v.telling.forEach(function (t) { regels.push(rij([v.tekst, 'keuze', t.optie, t.aantal])); });
        else if (v.soort === 'schaal') {
          regels.push(rij([v.tekst, 'schaal', 'gemiddeld', v.gemiddelde == null ? '' : v.gemiddelde]));
          v.telling.forEach(function (n, j) { regels.push(rij([v.tekst, 'schaal', j + 1, n])); });
        } else v.teksten.forEach(function (t) { regels.push(rij([v.tekst, 'open', t.van || '', t.tekst])); });
      });
      return regels.join('\n');
    });
  }

  window.RTGOfficeFormulierUitslag = { toon: toon, csv: csv };
})();
