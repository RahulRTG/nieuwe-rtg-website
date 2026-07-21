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
      async call(pad, body) {
        var headers = { 'Content-Type': 'application/json' };
        if (this.token) headers['Authorization'] = 'Bearer ' + this.token;
        var lang = (w.RTGi18n ? w.RTGi18n.lang : 'nl');
        var res = await fetch(prefix + pad, {
          method: 'POST', headers: headers,
          body: JSON.stringify(Object.assign({ lang: lang }, body || {}))
        });
        var data = await res.json().catch(function () { return {}; });
        // de HTTP-status gaat mee op de fout, zodat aanroepers erop kunnen sturen.
        if (!res.ok) throw Object.assign(new Error(data.error || foutTekst), { status: res.status, data: data });
        return data;
      }
    };
  }
  w.RTGApp = { maakAPI: maakAPI };
})(window);
