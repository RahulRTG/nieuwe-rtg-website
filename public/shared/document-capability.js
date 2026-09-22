/* The panel, gesture and Edge Bar share this transport adapter. Meaning lives on the server. */
(function (w) {
  'use strict';
  var pending = new Map();
  w.RTGDocumentCapability = function (api, capability, file) {
    var key = [capability, file.id, file.documentVersion].join(':');
    var body = pending.get(key);
    if (!body) {
      body = { capability: capability, contractVersion: 1, id: file.id,
        expectedVersion: file.documentVersion, operationId: w.crypto.randomUUID() };
      pending.set(key, body);
    }
    return api('actie', body).then(function (r) {
      if (r.status === 200 && r.body.ok && r.body.resource) {
        pending.delete(key);
        // A delayed reply must not overwrite a newer projection.
        if (file.documentVersion === body.expectedVersion) {
          file.documentVersion = r.body.resource.version;
          file.weg = r.body.resource.state === 'trashed';
        }
      } else if (r.status >= 400 && r.status < 500) pending.delete(key);
      // Network/5xx retry retains the same operation, never a new intent.
      return r;
    });
  };
}(window));
