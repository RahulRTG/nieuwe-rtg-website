/* RTG Speler: de gedeelde now-playing-laag van het huis.

   Een muziek-app (zoals RTG Sound) meldt wát er speelt via RTGSpeler.zet(...),
   en luistert met RTGSpeler.opCommando(...) naar bediening. De ROS (of elk
   ander scherm) toont die stand met RTGSpeler.opStand(...) en stuurt bediening
   terug met RTGSpeler.stuur(...). Zo bedien je je muziek vanaf het beginscherm,
   ook als ze uit een andere app komt.

   Het loopt over BroadcastChannel (live tussen tabs en tweede schermen) met
   localStorage als geheugen, zodat een net geopende ROS meteen de laatste
   stand kent. Puur transport en metadata; hier klinkt geen audio. */
(function () {
  if (window.RTGSpeler) return;
  var KEY = 'rtg_media_nu';
  var kanaal = ('BroadcastChannel' in window) ? new BroadcastChannel('rtg-media') : null;
  var standLuisteraars = [], cmdHandler = null;

  function laatste() { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { return null; } }
  function bewaar(s) { try { s ? localStorage.setItem(KEY, JSON.stringify(s)) : localStorage.removeItem(KEY); } catch (e) {} }
  function meld(soort, data) { if (kanaal) { try { kanaal.postMessage({ soort: soort, data: data }); } catch (e) {} } }
  function roepStand(s) { for (var i = 0; i < standLuisteraars.length; i++) { try { standLuisteraars[i](s); } catch (e) {} } }

  // een speler publiceert zijn stand: { app, titel, artiest, station, glyph, speelt, seed }
  function zet(state) {
    state = state || {};
    state.ts = Date.now();
    bewaar(state);
    meld('stand', state);
    roepStand(state);
  }
  // muziek is gestopt/afgesloten
  function stop() { bewaar(null); meld('stand', null); roepStand(null); }

  // een bediener stuurt een commando: 'toggle' | 'play' | 'pause' | 'next' | 'prev'
  function stuur(cmd) { meld('cmd', cmd); }
  // een speler luistert naar commando's
  function opCommando(fn) { cmdHandler = fn; }
  // een bediener luistert naar standwijzigingen; geeft de huidige stand terug
  function opStand(fn) { standLuisteraars.push(fn); return laatste(); }
  // is er een speler die de laatste paar seconden nog van zich liet horen?
  function live() { var s = laatste(); return !!(s && s.ts && Date.now() - s.ts < 5000); }

  if (kanaal) kanaal.onmessage = function (ev) {
    var m = ev.data || {};
    if (m.soort === 'stand') roepStand(m.data);
    else if (m.soort === 'cmd' && cmdHandler) { try { cmdHandler(m.data); } catch (e) {} }
  };
  // fallback voor tabs zonder BroadcastChannel: standwijzigingen via storage
  window.addEventListener('storage', function (e) { if (e.key === KEY) roepStand(laatste()); });

  window.RTGSpeler = { zet: zet, stop: stop, stuur: stuur, opCommando: opCommando, opStand: opStand, laatste: laatste, live: live, kanaalLive: !!kanaal };
})();
