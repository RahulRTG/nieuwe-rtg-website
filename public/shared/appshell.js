/* Gedeelde app-shell: één canonieke API-client voor alle apps, zodat elke app
   zich identiek gedraagt en niet z'n eigen fetch-wrapper hoeft te onderhouden.
   maakAPI() geeft een object met .token en .call(pad, body): POST naar /api+pad,
   met de taal meegestuurd, Authorization als er een token is, en een nette fout
   als de server een fout teruggeeft. Insluiten na /shared/i18n.js. */
(function (w) {
  'use strict';
  function maakAPI(opties) {
    opties = opties || {};
    var prefix = opties.prefix || '/api';
    var foutTekst = opties.foutTekst || 'Fout';
    return {
      // enabled: alleen echt praten met de server op http(s); token maakt 'live'.
      enabled: (typeof location !== 'undefined') && (location.protocol === 'http:' || location.protocol === 'https:'),
      token: null,
      get live() { return this.enabled && !!this.token; },
      async call(pad, body, herkans) {
        var headers = { 'Content-Type': 'application/json' };
        if (this.token) headers['Authorization'] = 'Bearer ' + this.token;
        var lang = (w.RTGi18n ? w.RTGi18n.lang : 'nl');
        var res = await fetch(prefix + pad, {
          method: 'POST', headers: headers,
          body: JSON.stringify(Object.assign({ lang: lang }, body || {}))
        });
        var data = await res.json().catch(function () { return {}; });
        /* De gegevenspoort (428): de server houdt een handeling met een derde
           partij tegen omdat er nog iets nodig is. Dat hoort hier af te lopen en
           niet bij de aanroeper, want anders moet elk scherm het los onthouden.
           Rahul vraagt het, en daarna doen we gewoon wat er gevraagd was. Een
           herkansing krijgt geen tweede: anders kan dit blijven rondlopen. */
        var self = this;
        if (!herkans && w.RTGPoort) {
          var p = w.RTGPoort.vang(data, res.status,
            function () { return self.call(pad, body, true); },
            function (q, b) { return self.call(String(q).replace(/^\/api/, ''), b); });
          if (p) return p;
        }
        // de HTTP-status gaat mee op de fout, zodat aanroepers erop kunnen sturen.
        if (!res.ok) throw Object.assign(new Error(data.error || foutTekst), { status: res.status, data: data });
        return data;
      }
    };
  }
  w.RTGApp = { maakAPI: maakAPI };
})(window);
