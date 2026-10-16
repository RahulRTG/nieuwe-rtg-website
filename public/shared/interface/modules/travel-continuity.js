/* Tabgebonden TravelOS-hervatting. Alleen datum en reizigers mogen naar de
   bestaande RTGIntent-store; vrije wensen blijven in het actieve paneel. */
(function (w) {
  'use strict';
  w.RTGTravelContinuity = function (options) {
    var ctx = options.context, touched = false, remember = false, busy = false, unloadUntil = 0;
    function fields() {
      var draft = options.draft(); return { date: draft.date, participants: draft.participants };
    }
    function model() { return { remember: remember, busy: busy }; }
    function hasWork() {
      var state = options.state(), draft = options.draft();
      return !!state.trip && state.phase !== 'received' && (state.phase === 'uncertain' ||
        (touched || state.phase === 'review') && (!remember || !!draft.note));
    }
    function beforeUnload(event) {
      if (!hasWork() || Date.now() <= unloadUntil) return;
      event.preventDefault(); event.returnValue = '';
    }
    function persist() {
      if (!remember || !ctx.intents) return Promise.resolve(null);
      return ctx.intents.remember('travel', fields());
    }
    function touch() {
      touched = true;
      return persist().catch(function () { ctx.setStatus('bewaren mislukt', 'warning'); });
    }
    function set(enabled) {
      if (!ctx.intents || busy) return Promise.resolve(false);
      busy = true; options.draw();
      var work = enabled ? ctx.intents.remember('travel', fields()) : ctx.intents.forget('travel');
      return Promise.resolve(work).then(function () {
        remember = enabled; ctx.setStatus(enabled ? 'hervatten aan' : 'niet bewaard', enabled ? 'ok' : 'quiet'); return true;
      }).catch(function () {
        ctx.setStatus('bewaren mislukt', 'warning'); return false;
      }).finally(function () { busy = false; options.draw(); });
    }
    function complete() {
      touched = false; remember = false;
      if (ctx.intents) ctx.intents.complete('travel').catch(function () {
        ctx.setStatus('tijdelijke context niet gewist', 'warning');
      });
    }
    function resume() {
      if (!ctx.intents) return;
      ctx.intents.resume('travel').then(function (row) {
        if (!row || touched || !(ctx.session && ctx.session.unchanged())) return;
        options.apply({ date: row.fields && row.fields.date || '', participants: Number(row.fields && row.fields.participants) || 2 });
        remember = true; ctx.setStatus('reiswens hervat', 'ok'); options.draw();
      }).catch(function () { ctx.setStatus('hervatten niet beschikbaar', 'warning'); });
    }
    function retain() {
      var value = fields();
      return remember ? { date: value.date, participants: value.participants, note: '' } : { date: '', participants: 2, note: '' };
    }
    function handoff(payload) {
      var work = payload.remember && ctx.intents ?
        ctx.intents.remember('travel', { date: payload.date, participants: payload.participants }) : Promise.resolve();
      return Promise.resolve(work).then(function () { unloadUntil = Date.now() + 1500; });
    }
    function mount() { w.addEventListener('beforeunload', beforeUnload); resume(); }
    function destroy() { w.removeEventListener('beforeunload', beforeUnload); }
    return { model: model, fields: fields, touch: touch, set: set, complete: complete,
      retain: retain, handoff: handoff, mount: mount, destroy: destroy,
      reset: function () { touched = false; } };
  };
})(window);
