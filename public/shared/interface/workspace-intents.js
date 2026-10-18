/* Veilige adapter tussen Workspace-modules en de bestaande RTGIntent-store.
   De Runtime houdt het credential; modules zien alleen hun toegestane velden. */
(function (w) {
  'use strict';
  w.RTGWorkspaceIntents = function (options) {
    var identity = options.identity;
    function store(purpose) {
      if (!w.RTGIntent || typeof w.RTGIntent.forSession !== 'function' || !identity.sameSession()) return Promise.resolve(null);
      var auth = identity.headers().Authorization || '', token = auth.replace(/^Bearer\s+/i, '');
      if (!token) return Promise.resolve(null);
      return w.RTGIntent.forSession(w, token, purpose).then(function (value) {
        return identity.sameSession() ? value : null;
      });
    }
    function active(value) {
      return value.list().filter(function (row) { return row.status === 'ACTIVE'; });
    }
    function resume(purpose) {
      return store(purpose).then(function (value) {
        if (!value || !identity.sameSession()) return null;
        var rows = active(value); return rows.length ? rows[rows.length - 1] : null;
      });
    }
    function remember(purpose, fields) {
      return store(purpose).then(function (value) {
        if (!value || !identity.sameSession()) throw new Error('session-changed');
        var rows = active(value), current = rows.length ? rows[rows.length - 1] : null;
        return current ? value.update(current.id, fields) : value.begin(fields);
      });
    }
    function end(purpose, status) {
      return store(purpose).then(function (value) {
        if (!value || !identity.sameSession()) return false;
        var rows = active(value);
        return !rows.length || value.end(rows[rows.length - 1].id, status);
      });
    }
    var api = { resume: resume, remember: remember,
      forget: function (purpose) { return end(purpose, 'REVOKED'); },
      complete: function (purpose) { return end(purpose, 'FULFILLED'); } };
    return Object.freeze ? Object.freeze(api) : api;
  };
})(window);
