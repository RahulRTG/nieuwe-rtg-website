/* De krant en Saloon tonen dezelfde openbare versie en correctietoelichting. */
(function (w) {
  'use strict';
  w.RTGPublicatieInfo = function (a, esc) {
    function datum(t) { return t ? esc(new Date(t).toLocaleString(document.documentElement.lang || 'nl-NL',
      { dateStyle: 'medium', timeStyle: 'short' })) : 'Onbekend'; }
    return '<p>Gepubliceerd: ' + datum(a.gepubliceerd) + ' · Editie ' + (Number(a.versie) || 1)
      + (a.bij && a.bij !== a.gepubliceerd ? ' · Bijgewerkt: ' + datum(a.bij) : '') + '</p>'
      + ((a.correcties || []).length ? '<details><summary>Correcties en actualiseringen</summary><ol>'
        + a.correcties.slice().reverse().map(function (c) { return '<li><time>' + datum(c.at) + '</time><p>' + esc(c.toelichting) + '</p></li>'; }).join('')
        + '</ol></details>' : '');
  };
}(window));
