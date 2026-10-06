/* RTGStroom: een live-stroom (EventSource) ZONDER sessie in het adres.

   EventSource kan geen kop sturen, en een adres staat in proxy- en
   serverlogs, in de browsergeschiedenis en in een Referer. Daarom ruilt dit
   eerst de sessie (in de kop Authorization) voor een kortlevend, eenmalig
   stroomticket (POST /api/stroom/ticket, server/kern/sessiestroom.js), en
   opent het de stroom met alleen dat ticket. Verbindt de browser later vanzelf
   opnieuw met hetzelfde adres, dan is het ticket al gebruikt: de server
   antwoordt 401, EventSource sluit, en dit haalt een nieuw ticket. Weigert de
   server het ticket zelf (401/403), dan is de sessie weg en stopt het.

   Gebruik, op de plek waar eerst new EventSource(pad + '?token=' + x) stond:
     var bron = RTGStroom.open('/api/stream', { token: x });            // lid
     var bron = RTGStroom.open('/api/supplier/stream', { stroom: 'zaak', token: x });
     var bron = RTGStroom.open('/api/office/stream', { stroom: 'kantoor', token: x });
     bron.addEventListener('sync', fn); bron.onerror = fn; bron.close();
   `token` mag een functie zijn (een sessie die onderweg ververst wordt).
   Een eigen ruilplek (het schoolkanaal) geeft `ticketPad` en `lijf` mee.

   Voor een <video> (die een adres vaker opvraagt) is er RTGStroom.ticket():
   een begrensd kijkticket voor DEZE video, zie server/routes/theater.js.

   Dit bestand laadt ZONDER defer, voor de code die het gebruikt (zelfde regel
   als shared/id.js; keuringsregel 15b bewaakt dat). */
(function (w) {
  'use strict';
  function ticket(o) {
    var t = typeof o.token === 'function' ? o.token() : o.token;
    if (!t) return Promise.resolve({ status: 401 });
    var lijf = o.lijf || { stroom: o.stroom || 'lid', id: o.id };
    return fetch(o.ticketPad || '/api/stroom/ticket', {
      method: 'POST', referrerPolicy: 'no-referrer', cache: 'no-store',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t },
      body: JSON.stringify(lijf)
    }).then(function (r) {
      if (!r.ok) return { status: r.status };
      return r.json().then(function (d) { return d && d.ticket ? { ticket: d.ticket } : { status: 502 }; });
    }, function () { return { status: 0 }; });
  }

  function open(pad, opts) {
    var o = opts || {};
    var es = null, dicht = false, wacht = null, sinds = 0, luister = {};
    var bron = { readyState: 0, onerror: null, onopen: null, onmessage: null,
      addEventListener: function (naam, fn) {
        (luister[naam] = luister[naam] || []).push(fn);
        if (es) koppel(naam, fn);
      },
      removeEventListener: function (naam, fn) {
        var l = luister[naam] || [];
        var i = l.indexOf(fn);
        if (i >= 0) l.splice(i, 1);
      },
      close: function () {
        dicht = true; bron.readyState = 2; clearTimeout(wacht);
        if (es) { es.close(); es = null; }
      }
    };
    function meld(e) {
      if (typeof bron.onerror === 'function') bron.onerror(e);
      (luister.error || []).forEach(function (fn) { fn(e); });
    }
    function koppel(naam, fn) {
      if (naam === 'error' || naam === 'open') return;
      es.addEventListener(naam, function (e) {
        if (e.lastEventId && Number(e.lastEventId)) sinds = Number(e.lastEventId);
        if (luister[naam] && luister[naam].indexOf(fn) >= 0) fn(e);
      });
    }
    function later(ms) { clearTimeout(wacht); if (!dicht) wacht = setTimeout(verbind, ms); }
    function verbind() {
      if (dicht) return;
      ticket(o).then(function (t) {
        if (dicht) return;
        if (t.status === 401 || t.status === 403) { bron.close(); meld({ type: 'error', status: t.status }); return; }
        if (!t.ticket) { meld({ type: 'error', status: t.status }); return later(15000); }
        var url = pad + (pad.indexOf('?') < 0 ? '?' : '&') + 'ticket=' + encodeURIComponent(t.ticket) +
          (sinds && o.sinds !== false ? '&since=' + sinds : '');
        es = new EventSource(url);
        Object.keys(luister).forEach(function (naam) { luister[naam].forEach(function (fn) { koppel(naam, fn); }); });
        es.onopen = function (e) {
          bron.readyState = 1;
          if (typeof bron.onopen === 'function') bron.onopen(e);
          (luister.open || []).forEach(function (fn) { fn(e); });
        };
        es.onmessage = function (e) {
          if (e.lastEventId && Number(e.lastEventId)) sinds = Number(e.lastEventId);
          if (typeof bron.onmessage === 'function') bron.onmessage(e);
        };
        /* Zelf herverbinden zou HETZELFDE, al gebruikte ticket opnieuw sturen;
           dus sluiten en met een nieuw ticket verder. */
        es.onerror = function (e) {
          if (es) { es.close(); es = null; }
          bron.readyState = dicht ? 2 : 0;
          meld(e);
          later(3000);
        };
      });
    }
    verbind();
    return bron;
  }

  /* Een <video> met een KIJKTICKET: begrensd en aan deze video gebonden, want
     het element vraagt het adres vaker op (laden, spoelen). Verloopt het ticket
     midden in de film, dan weigert de server de volgende Range-vraag; dan
     haalt dit een nieuw ticket en gaat verder waar de film was. Geeft een
     belofte die vervult zodra de bron gezet is (of met { status } als dat niet
     lukte). */
  function kijk(el, pad, opts) {
    var spec = { pad: pad, o: opts || {}, pogingen: 0 };
    el.__rtgKijk = spec;
    function zet(positie) {
      return ticket(spec.o).then(function (t) {
        if (el.__rtgKijk !== spec || !t.ticket) return t;
        el.src = pad + (pad.indexOf('?') < 0 ? '?' : '&') + 'ticket=' + encodeURIComponent(t.ticket);
        if (positie) el.addEventListener('loadedmetadata', function eens() {
          el.removeEventListener('loadedmetadata', eens);
          try { el.currentTime = positie; } catch (e) {}
          el.play().catch(function () {});
        });
        return t;
      });
    }
    if (!el.__rtgKijkLuistert) {
      el.__rtgKijkLuistert = true;
      el.addEventListener('playing', function () { if (el.__rtgKijk) el.__rtgKijk.pogingen = 0; });
      el.addEventListener('error', function () {
        var s = el.__rtgKijk;
        if (!s || !el.getAttribute('src') || s.pogingen++ >= 3) return;
        var positie = el.currentTime || 0;
        s.herzet(positie);
      });
    }
    spec.herzet = zet;
    return zet(0);
  }

  w.RTGStroom = { open: open, ticket: ticket, kijk: kijk };
})(window);
