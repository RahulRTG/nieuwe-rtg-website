/* HET LIVE-KANAAL VAN EEN GEZIN, ZONDER SESSIE IN DE URL (B18).

   EventSource kan geen header sturen, en een URL staat in de
   browsergeschiedenis, in logs en in een Referer. Daarom vraagt dit eerst met de
   gezinssessie in de Authorization-header een EENMALIG stroomticket van een
   minuut (POST /api/foundation/gezin/stroom/ticket), en opent het de stroom met
   dat ticket. Verbindt de browser later vanzelf opnieuw met dezelfde URL, dan
   is het ticket al gebruikt: de server antwoordt 401, EventSource sluit, en dit
   haalt een nieuw ticket. Is de sessie zelf weg (403), dan stopt het.

   Gebruik:
     RTGGezinsstroom.open({ code, token, kanaal: 'sociaal' | 'gezin',
       url: function (ticket, sinds) { return '/api/...?ticket=' + ticket; },
       op: { social: function (e) {}, call: function (e) {} } })
   `token` mag een functie zijn (een sessie die onderweg ververst wordt). */
(function (w) {
  function open(opts) {
    var es = null, dicht = false, wacht = null, sinds = 0;
    function token() { return typeof opts.token === 'function' ? opts.token() : opts.token; }
    function later(ms) { clearTimeout(wacht); wacht = setTimeout(verbind, ms); }
    function verbind() {
      if (dicht) return;
      fetch((opts.base || '/api/foundation') + '/gezin/stroom/ticket', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token() },
        body: JSON.stringify({ code: opts.code, kanaal: opts.kanaal })
      }).then(function (r) {
        if (r.status === 403) { dicht = true; return null; }
        return r.ok ? r.json() : null;
      }).then(function (t) {
        if (dicht) return;
        if (!t || !t.ticket) return later(30000);
        es = new EventSource(opts.url(encodeURIComponent(t.ticket), sinds));
        Object.keys(opts.op || {}).forEach(function (naam) {
          es.addEventListener(naam, function (e) {
            if (e.lastEventId && Number(e.lastEventId)) sinds = Number(e.lastEventId);
            opts.op[naam](e);
          });
        });
        es.onerror = function () { if (es && es.readyState === 2) { es = null; later(3000); } };
      }, function () { later(10000); });
    }
    verbind();
    return {
      sluit: function () { dicht = true; clearTimeout(wacht); if (es) { es.close(); es = null; } },
      opnieuw: function () { if (es) { es.close(); es = null; } dicht = false; later(0); }
    };
  }
  w.RTGGezinsstroom = { open: open };
})(window);
