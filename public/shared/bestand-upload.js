/* One upload path for Bestanden and Galerij. Large files use the existing
   chunked upload endpoints; permissions and quota remain with Bestanden. */
(function (w) {
  'use strict';
  w.RTGBestandUpload = function (file, api, context) {
    var o = context || {}, STUK = 4 * 1024 * 1024;
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onerror = function () { reject(new Error('Dit bestand kon niet worden gelezen. Probeer het opnieuw.')); };
      reader.onabort = function () { reject(new Error('Het lezen van dit bestand is afgebroken.')); };
      reader.onload = function () {
        var dataUrl = String(reader.result || ''), b64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
        if (b64.length <= STUK) {
          resolve(api('upload', o.id ? { id: o.id, dataUrl: dataUrl } : { naam: file.name, map: o.map, dataUrl: dataUrl }));
          return;
        }
        resolve(api('upstart', { naam: file.name, map: o.map, id: o.id || undefined, mime: file.type || 'application/octet-stream' })
          .then(function (start) {
            if (start.body.error) return start;
            var queue = Promise.resolve({ status: 200, body: {} });
            for (var i = 0; i < b64.length; i += STUK) {
              (function (chunk) {
                queue = queue.then(function (last) { return last.body.error ? last : api('updeel', { uploadId: start.body.uploadId, stuk: chunk }); });
              })(b64.slice(i, i + STUK));
            }
            return queue.then(function (last) { return last.body.error ? last : api('upklaar', { uploadId: start.body.uploadId }); });
          }));
      };
      reader.readAsDataURL(file);
    });
  };
})(window);
