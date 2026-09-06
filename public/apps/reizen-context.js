(function (w) {
  'use strict';
  var R = w.RTGReizen, M = w.RTGRouteMemory;
  if (!R || !M) return;
  var tabs = ['vandaag', 'reizen', 'taxi', 'samen', 'rahul'];
  var explicit = tabs.indexOf(String(w.location.hash || '').slice(1)) >= 0;
  M.register('travel-home', {
    capture: function () { return { tab: R.staat.blad }; },
    restore: function (x) {
      if (!explicit && x && tabs.indexOf(x.tab) >= 0) R.wisselBlad(x.tab, false, { restore: true });
      return true;
    }
  });
  w.addEventListener('hashchange', function () {
    var tab = String(w.location.hash || '').slice(1);
    if (tabs.indexOf(tab) >= 0) { M.cancel(); R.wisselBlad(tab, false, { restore: true }); }
  });
  M.start();
}(window));
