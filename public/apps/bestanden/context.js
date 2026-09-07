/* Routevoorkeuren worden pas toegepast nadat de eigen bestandenbron klaar is. */
(function (w, d) {
  'use strict';
  w.RTGBestandenContext = function (read, apply) {
    var $ = function (s) { return d.querySelector(s); };
    w.RTGRouteMemory.register('bestanden', {
      nativeFields: true,
      capture: function () { var state = read(); return { hier: state.hier, bak: state.bak, zoek: $('#zoek').value, sorteer: $('#sorteer').value }; },
      restore: function (value) {
        var state = read();
        if (!state.stand) return false;
        var hier = (state.stand.mappen || []).some(function (m) { return m.id === value.hier; }) ? value.hier : null;
        var bak = value.bak === true;
        $('#zoek').value = typeof value.zoek === 'string' ? value.zoek.slice(0, 256) : '';
        if (Array.from($('#sorteer').options).some(function (o) { return o.value === value.sorteer; })) $('#sorteer').value = value.sorteer;
        $('#toonBak').classList.toggle('aan', bak);
        $('#toonBak').textContent = bak ? 'Terug naar de kluis' : 'Prullenbak';
        apply({ hier: hier, bak: bak }); return true;
      }
    });
    w.RTGRouteMemory.start();
  };
}(window, document));
