/* Brokeracties van de Travel Living Module. Alle domeinmutaties blijven bij
   de bestaande TravelRequestController en RTG-routes. */
(function (w) {
  'use strict';
  w.RTGTravelActions = function (options) {
    var ctx = options.context, controller = options.controller, continuity = options.continuity;
    function valid(payload) {
      var trip = options.trip();
      return !!(trip && payload.tripId === trip.id && payload.participants >= 1 && payload.participants <= 20);
    }
    return {
      'travel.open': { run: function () { return ctx.open('/apps/reizen.html#reizen', 'Travel'); } },
      'travel.request.open-flow': { permission: 'travel.read',
        confirm: function (payload) {
          var lines = [];
          if (payload.hasNote) lines.push('Uw vrije wensen worden niet meegenomen naar het volledige reisbureau.');
          if (!payload.remember && (payload.date || payload.participants !== 2)) lines.push('Datum en reizigers zijn niet gemarkeerd om te hervatten.');
          return lines.length ? lines.join(' ') + ' Toch doorgaan?' : '';
        },
        validate: function (payload) {
          return (!payload.tripId || !!options.find(payload.tripId)) && payload.participants >= 1 && payload.participants <= 20;
        },
        run: function (payload) {
          return continuity.handoff(payload).then(function () {
            return ctx.open('/apps/reisbureau.html' + (payload.tripId ? '?reis=' + encodeURIComponent(payload.tripId) : ''), 'RTG-reisbureau');
          });
        } },
      'travel.request.review': { permission: 'travel.manage', inputSchema: 'travel.request.input.v1', validate: valid,
        run: function (payload) {
          var result = controller.review({ date: payload.date, participants: payload.participants, note: payload.note });
          options.result(result); options.draw();
          if (result && result.ok) options.focus('[data-rtg-travel-action="submit"]');
          return result;
        } },
      'travel.request.edit': { run: function () {
        controller.edit(); options.result(null); options.draw(); options.focus('[data-rtg-travel-input="date"]'); return { ok: true };
      } },
      'travel.request.catalog': { run: function () { options.catalog(); return { ok: true }; } },
      'travel.request.remember': { validate: function (payload) { return typeof payload.enabled === 'boolean'; },
        run: function (payload) {
          return continuity.set(payload.enabled).then(function (ok) { return { ok: ok, enabled: continuity.model().remember }; });
        } },
      'travel.request.submit': { permission: 'travel.manage', confirm: 'Deze reisaanvraag versturen?', audit: true,
        inputSchema: 'travel.request.input.v1', validate: valid,
        run: function (payload) {
          return controller.submit({ date: payload.date, participants: payload.participants, note: payload.note })
            .then(function (result) { options.process(result); return result; });
        } },
      'travel.request.check': { permission: 'travel.manage', inputSchema: 'travel.request.check.v1',
        validate: function (payload) { var trip = options.trip(); return !!(trip && payload.tripId === trip.id); },
        run: function () { return controller.check().then(function (result) { options.process(result); return result; }); } },
      'travel.request.status': { permission: 'travel.read', inputSchema: 'travel.request.status.v1',
        validate: function (payload) {
          var current = options.currentResult(), application = current && current.application;
          return !!(application && application.ref && payload.ref === application.ref);
        },
        run: function (payload) {
          return ctx.request('/api/reisbureau/mijn', {}).then(function (response) {
            if (!(ctx.session && ctx.session.unchanged())) return { ok: false, type: 'ignored', reason: 'session' };
            var rows = response && response.aanvragen;
            var application = Array.isArray(rows) && rows.find(function (row) { return row.ref === payload.ref; });
            if (!application) return { ok: false, type: 'missing' };
            var result = { ok: true, type: 'status', application: application };
            options.process(result); return result;
          });
        } },
      'travel.driver.attach': { permission: 'travel.manage', confirm: 'Chauffeurdetails aan deze reis toevoegen?', audit: true,
        inputSchema: 'travel.driver.attach.v1', validate: function (payload) { return !!payload.conversationId; },
        run: options.attach }
    };
  };
})(window);
