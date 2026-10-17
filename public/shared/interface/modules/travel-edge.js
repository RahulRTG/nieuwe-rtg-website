/* TravelOS publiceert taakacties in de bestaande Adaptieve Edge. De Edge
   voert ze via de Workspace Broker uit en krijgt geen eigen workflowstaat. */
(function (w) {
  'use strict';
  w.RTGTravelEdge = function (options) {
    var declared = false;
    function run(id, payload) { options.run(id, payload || {}).catch(function () {}); }
    function declare() {
      var edge = w.RTGAdaptief; if (!edge || declared) return;
      function capability(id, name, weight, effect, payload) {
        edge.declareer({ id: id, naam: name, label: name, groep: 'TravelOS', primair: id === 'travel.request.submit',
          telefoon: ['balk', 'lade'], tablet: ['balk', 'lade'], bureau: ['werkbalk'],
          gewicht: weight || 'licht', effect: effect || 'lokaal', herstel: id === 'travel.request.submit' ? 'geen' : 'exact',
          doe: function () { run(id, payload()); } });
      }
      capability('travel.open', 'Reisoverzicht', 'licht', 'lokaal', function () { return {}; });
      capability('travel.request.review', 'Aanvraag controleren', 'licht', 'lokaal', options.actionPayload);
      capability('travel.request.edit', 'Invoer aanpassen', 'licht', 'lokaal', function () { return {}; });
      capability('travel.request.catalog', 'Andere reis', 'licht', 'lokaal', function () { return {}; });
      capability('travel.request.submit', 'Aanvraag versturen', 'bewust', 'server', options.actionPayload);
      capability('travel.request.check', 'Uitkomst controleren', 'licht', 'server', function () {
        var state = options.state(); return { tripId: state.trip && state.trip.id || '' };
      });
      capability('travel.request.status', 'Status verversen', 'licht', 'server', function () {
        var state = options.state(), request = state.request;
        return { ref: request && request.application && request.application.ref || '' };
      });
      capability('travel.request.open-flow', 'Open volledig reisbureau', 'licht', 'lokaal', options.flowPayload);
      declared = true;
    }
    function clear() { if (w.RTGAdaptief) w.RTGAdaptief.wisContext('workspace.travel'); }
    function sync(active, surface) {
      var edge = w.RTGAdaptief; if (!edge) return;
      if (!active || surface === 'peek') { clear(); return; }
      declare();
      var state = options.state(), trip = state.trip, phase = state.phase, actions;
      if (!trip) actions = ['travel.open'];
      else if (phase === 'review') actions = ['travel.request.edit', 'travel.request.submit', 'travel.request.open-flow'];
      else if (phase === 'uncertain') actions = ['travel.request.check', 'travel.request.open-flow'];
      else if (phase === 'received') actions = ['travel.request.status', 'travel.open'];
      else actions = ['travel.request.review', 'travel.request.catalog', 'travel.request.open-flow'];
      var request = state.request, application = request && request.application;
      edge.context({ bron: 'workspace.travel', titel: trip ? 'TravelOS · ' + (trip.titel || 'Reisaanvraag') : 'TravelOS',
        acties: actions, selectie: false,
        object: application && application.ref ? { soort: 'reisaanvraag', id: application.ref,
          label: trip && trip.titel || 'Reisaanvraag' } : trip ? { soort: 'travel', id: trip.id, label: trip.titel || 'Reis' } : null,
        activiteit: application && application.status === 'bevestigd' ? 'reis-bevestigd' :
          application && application.status === 'afgewezen' ? 'aanvraag-afgewezen' :
            phase === 'received' ? 'aanvraag-ontvangen' : trip ? 'reisaanvraag' : 'reisoverzicht' });
    }
    return { sync: sync, clear: clear };
  };
})(window);
