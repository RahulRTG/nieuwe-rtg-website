/* Date strip and editorial timeline use the same appointment records and
   paneel callbacks as the existing month/week/list views. */
(function (w, d) {
  'use strict';
  var K = w.RTGAgendaKal, C = w.RTGDailyCopy;
  K.dag = function (host, anker, items, acties, vandaag) {
    var day = items.filter(function (x) { return x.datum === anker; });
    K.lijst(host, anker, day, acties, vandaag);
    if (!day.length) host.innerHTML = '<p class="stil">' + C.text('emptyDay') + '</p>';
    return C.date(anker, { weekday: 'long', day: 'numeric', month: 'long' });
  };
  w.RTGAgendaEditorial = function (stand, select, retry) {
    d.body.dataset.dailyView = stand.weergave;
    w.RTGDaily.render('agenda', stand.items.length ? 'ready' : 'empty', {
      retry: retry,
      title: stand.items.length && stand.weergave === 'dag' ? C.date(stand.anker, { weekday: 'long', day: 'numeric', month: 'long' }) : ''
    });
    var host = d.getElementById('dailyWeek'), monday = K.maandagVan(stand.anker);
    host.hidden = stand.weergave === 'maand' || stand.weergave === 'week';
    host.innerHTML = Array.from({ length: 7 }, function (_, i) {
      var date = K.plusDagen(monday, i);
      return '<button type="button" data-daily-date="' + date + '" aria-pressed="' + (date === stand.anker)
        + '" aria-label="' + C.esc(C.date(date, { weekday: 'long', day: 'numeric', month: 'long' })) + '" translate="no">'
        + C.esc(C.date(date, { weekday: 'short' })) + '<b>' + C.esc(C.date(date, { day: 'numeric' })) + '</b></button>';
    }).join('');
    host.querySelectorAll('[data-daily-date]').forEach(function (button) {
      button.addEventListener('click', function () { select(button.dataset.dailyDate); });
    });
  };
})(window, document);
