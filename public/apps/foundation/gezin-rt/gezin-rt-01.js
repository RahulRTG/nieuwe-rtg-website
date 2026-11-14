/* GezinRT: chatten en (beeld)bellen tussen gezinsleden, in de app.
   Zelfstandige module: opent het live-kanaal (SSE), regelt WebRTC-bellen en
   spuit zijn eigen belscherm in. Werkt met een basis-URL + profieltoken, zodat
   zowel de RTFoundation-app als de RTG-app hem kan gebruiken.
   Init: GezinRT.init({ base, code, token, mijnId, mijnNaam, leden, onChat, onBelStatus }) */
(function (w) {
  var S = { base: '/api/foundation', code: '', token: '', mijnId: '', mijnNaam: '', leden: {} };
  var es = null, onChat = null, onBelStatus = null;
  var call = null, inkomend = null, ingezet = false, mee = null;   // mee: de tekstbaan (shared/meelezen.js)
  var epoch = 0;
  function actief(n) { return n === epoch && !!S.code && !!S.token; }

  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); }
  function post(pad, body) {
    var n = epoch;
    if (!actief(n)) return Promise.reject(new Error('De gezinssessie is gesloten.'));
    return fetch(S.base + pad, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.assign({ code: S.code, token: S.token }, body || {})) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { if (!actief(n)) throw new Error('De gezinssessie is gesloten.'); if (!r.ok) throw new Error(d.error || 'Er ging iets mis.'); return d; }); });
  }
  function lidNaam(id) { var l = S.leden[id]; return l ? l.naam : 'Gezinslid'; }
  function lidAvatar(id) { var l = S.leden[id]; return l ? (l.avatar || 'emo-blij') : 'emo-blij'; }
  function lees(pad) {
    var n = epoch;
    if (!actief(n)) return Promise.reject(new Error('De gezinssessie is gesloten.'));
    return fetch(S.base + '/gezin/' + S.code + pad, { headers: { Authorization: 'Bearer ' + S.token } })
      .then(function (r) { return r.json(); }).then(function (d) { if (!actief(n)) throw new Error('De gezinssessie is gesloten.'); return d; });
  }

  var GezinRT = {
    init: function (opts) {
      GezinRT.stop();
      S.base = opts.base || S.base; S.code = opts.code; S.token = opts.token;
      S.mijnId = opts.mijnId; S.mijnNaam = opts.mijnNaam || 'ik';
      GezinRT.setLeden(opts.leden || []);
      onChat = opts.onChat || null; onBelStatus = opts.onBelStatus || null;
      haalIce();
      injectUI();
      verbind();
    },
    setLeden: function (arr) { S.leden = {}; (arr || []).forEach(function (l) { S.leden[l.id] = l; }); },
    /* Een verse gezinssessie (de RTG-app haalt per keer een nieuwe van 12 uur via
       /api/rtf/kanaal). Het kanaal verbindt opnieuw, behalve midden in een gesprek. */
    setToken: function (t) { if (!actief(epoch) || !t || t === S.token) return; S.token = t; if (!call) verbind(); },
    // chat
    stuur: function (naarId, tekst) { return post('/gezin/chat', { naar: naarId, tekst: tekst }); },
    thread: function (metId) { return lees('/chat/' + metId); },
    chats: function () { return lees('/chats'); },
    // bellen
    bel: function (naarId, video) { beginGesprek(naarId, video); },
    stop: function () {
      epoch++; clearTimeout(wacht); wacht = null;
      try { if (es) es.close(); } catch (e) {} es = null;
      S.code = ''; S.token = ''; S.mijnId = ''; S.mijnNaam = ''; S.leden = {};
      onChat = null; onBelStatus = null; iceConfig = null; eindeGesprek(false);
    }
  };

  /* De sessie gaat niet in de URL (B18): eerst een eenmalig stroomticket van een
     minuut met de sessie in de header. Verbindt de browser vanzelf opnieuw, dan
     is dat ticket al op (401) en sluit EventSource; dan halen we een nieuw. */
  var wacht = null;
  function verbind() {
    try { if (es) es.close(); } catch (e) {}
    es = null; clearTimeout(wacht);
    var token = S.token, n = epoch;
    function geldig() { return actief(n) && token === S.token; }
    function later(ms) { if (actief(n)) wacht = setTimeout(function () { if (actief(n)) verbind(); }, ms); }
    if (!geldig()) return;
    fetch(S.base + '/gezin/stroom/ticket', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ code: S.code, kanaal: 'gezin' }) })
      .then(function (r) { return r.ok ? r.json() : (r.status === 403 ? 'weg' : null); })
      .then(function (t) {
        if (t === 'weg' || !geldig()) return;
        if (!t || !t.ticket) { later(30000); return; }
        var kanaal = new EventSource(S.base + '/gezin/' + S.code + '/kanaal?ticket=' + encodeURIComponent(t.ticket)); es = kanaal;
        // Tokenverversing onderbreekt een actief gesprek niet. Het geopende
        // kanaal blijft eigendom van deze epoch, niet van het oude ticket-token.
        function eigenaar() { return actief(n) && es === kanaal; }
        kanaal.addEventListener('chat', function (e) { if (!eigenaar()) return; try { var d = JSON.parse(e.data); if (onChat) onChat(d); } catch (x) {} });
        kanaal.addEventListener('bel', function (e) { if (!eigenaar()) return; try { opBelsignaal(JSON.parse(e.data)); } catch (x) {} });
        kanaal.onerror = function () { if (eigenaar() && kanaal.readyState === 2) { es = null; later(3000); } };
      }, function () { if (geldig()) later(10000); });
  }
