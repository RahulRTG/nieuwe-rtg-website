/* GezinRT: chatten en (beeld)bellen tussen gezinsleden, in de app.
   Zelfstandige module: opent het live-kanaal (SSE), regelt WebRTC-bellen en
   spuit zijn eigen belscherm in. Werkt met een basis-URL + profieltoken, zodat
   zowel de RTFoundation-app als de RTG-app hem kan gebruiken.
   Init: GezinRT.init({ base, code, token, mijnId, mijnNaam, leden, onChat, onBelStatus }) */
(function (w) {
  var S = { base: '/api/foundation', code: '', token: '', mijnId: '', mijnNaam: '', leden: {} };
  var es = null, onChat = null, onBelStatus = null;
  var call = null, inkomend = null, ingezet = false;

  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); }
  function post(pad, body) {
    return fetch(S.base + pad, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.assign({ code: S.code, token: S.token }, body || {})) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { if (!r.ok) throw new Error(d.error || 'Er ging iets mis.'); return d; }); });
  }
  function lidNaam(id) { var l = S.leden[id]; return l ? l.naam : 'Gezinslid'; }
  function lidAvatar(id) { var l = S.leden[id]; return l ? (l.avatar || 'emo-blij') : 'emo-blij'; }

  var GezinRT = {
    init: function (opts) {
      S.base = opts.base || S.base; S.code = opts.code; S.token = opts.token;
      S.mijnId = opts.mijnId; S.mijnNaam = opts.mijnNaam || 'ik';
      GezinRT.setLeden(opts.leden || []);
      onChat = opts.onChat || null; onBelStatus = opts.onBelStatus || null;
      haalIce();
      injectUI();
      verbind();
    },
    setLeden: function (arr) { S.leden = {}; (arr || []).forEach(function (l) { S.leden[l.id] = l; }); },
    // chat
    stuur: function (naarId, tekst) { return post('/gezin/chat', { naar: naarId, tekst: tekst }); },
    thread: function (metId) { return fetch(S.base + '/gezin/' + S.code + '/chat/' + metId, { headers: { Authorization: 'Bearer ' + S.token } }).then(function (r) { return r.json(); }); },
    chats: function () { return fetch(S.base + '/gezin/' + S.code + '/chats', { headers: { Authorization: 'Bearer ' + S.token } }).then(function (r) { return r.json(); }); },
    // bellen
    bel: function (naarId, video) { beginGesprek(naarId, video); },
    stop: function () { try { if (es) es.close(); } catch (e) {} eindeGesprek(false); }
  };

  function verbind() {
    try { if (es) es.close(); } catch (e) {}
    es = new EventSource(S.base + '/gezin/' + S.code + '/kanaal?token=' + encodeURIComponent(S.token));
    es.addEventListener('chat', function (e) { try { var d = JSON.parse(e.data); if (onChat) onChat(d); } catch (x) {} });
    es.addEventListener('bel', function (e) { try { opBelsignaal(JSON.parse(e.data)); } catch (x) {} });
    es.onerror = function () { /* de browser verbindt vanzelf opnieuw (retry) */ };
  }

