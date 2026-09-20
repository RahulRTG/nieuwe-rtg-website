/* Allowlisted, existing domain contracts. No arbitrary endpoint from a card.
   Reads coalesce in this module; task changes go through the Action Broker. */
(function (w) {
  'use strict';
  var sources = {
    agenda: '/api/agenda/bereik', notities: '/api/notities/mijn', reizen: '/api/reis/reizen',
    foodcourt: '/api/foodcourt', table: '/api/member/rechterhand/table', attenties: '/api/member/rechterhand/attenties',
    verificatie: '/api/auth/me', geld: '/api/pay/overzicht', bestanden: '/api/bestanden/mijn',
    training: '/api/training', kantoor: '/api/kantoor/wereld', veilig: '/api/veiligheid', comm: '/api/comm/inbox',
    reisboek: '/api/member/rechterhand/reisboek', 'mijn-isolatie': '/api/isolatie/mijn'
  };
  var family = { 'foundation-agenda': '/api/foundation/gezin/agenda/bereik',
    'foundation-leren': '/api/rtf/leerling/dag', 'foundation-schrijven': '/api/rtf/leren/schrijfsels' };
  function date(day) { var x = new Date(); x.setDate(x.getDate() + (day || 0));
    return [x.getFullYear(), String(x.getMonth() + 1).padStart(2, '0'), String(x.getDate()).padStart(2, '0')].join('-'); }
  w.RTGWidgetData = {
    supports: function (id) { return Object.prototype.hasOwnProperty.call(sources, id) || Object.prototype.hasOwnProperty.call(family, id); }, date: date,
    definition: function () {
      return w.RTGModuleSDK.define({ id: 'desktop.widgets', title: 'Widgets', maturity: 'L3', pinned: true,
        capabilities: ['widgets.read', 'notes.update'], services: ['agenda', 'notities', 'kern-comm', 'tg-account'],
        actions: ['desktop.widget.read', 'desktop.task.check'], permissions: [], state: { persistence: 'session' }
      }, function (ctx) {
        var cache = Object.create(null), pending = Object.create(null), controller = new AbortController();
        function read(p) {
          var id = p.id, offset = Math.max(0, Math.min(30, Number(p.offset) || 0)), key = id + ':' + offset;
          if (p.fresh) delete cache[key];
          if (cache[key] && Date.now() - cache[key].at < 30000) return Promise.resolve(cache[key].data);
          if (pending[key]) return pending[key];
          var body = id === 'agenda' || id === 'foundation-agenda' ? { van: date(offset), tot: date(offset + 6) } : {};
          var job = family[id] ? ctx.services.familyRequest(family[id], body) :
            ctx.request(sources[id], body, { signal: controller.signal });
          pending[key] = job.then(function (j) { var data = Object.assign({}, j, { widgetReadAt: Date.now() });
            cache[key] = { at: data.widgetReadAt, data: data }; return data; })
            .finally(function () { delete pending[key]; }); return pending[key];
        }
        return { actions: {
          'desktop.widget.read': { validate: function (p) { return !!p && w.RTGWidgetData.supports(p.id); }, run: read },
          'desktop.task.check': { audit: true, validate: function (p) {
            return !!p && typeof p.id === 'string' && Number.isInteger(p.index) && p.index >= 0 && typeof p.af === 'boolean';
          }, run: function (p) { return ctx.request('/api/notities/vink', { id: p.id, index: p.index, af: p.af }, { signal: controller.signal })
            .then(function (j) { delete cache['notities:0']; return j; }); } }
        }, destroy: function () { controller.abort(); cache = Object.create(null); } };
      });
    }
  };
})(window);
