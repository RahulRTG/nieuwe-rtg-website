/* Lokale versleutelde mediabewaring. De inhoud is al door media.js versleuteld;
   deze laag bewaakt alleen maprechten, objectgrootte en bestandslevensloop. */
'use strict';
const fs = require('fs');
const path = require('path');
const { MAX_OBJECT_BYTES } = require('./s3');

function maakDiskBackend(dir) {
  function ensure() {
    try {
      fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
      fs.chmodSync(dir, 0o700);
    } catch (e) {
      try { fs.mkdirSync(dir, { recursive: true }); } catch (x) {}
    }
  }
  return {
    naam: 'disk',
    async put(naam, enc) {
      if (enc.length > MAX_OBJECT_BYTES) throw new Error('Mediaobject overschrijdt de maximale mediagrootte.');
      ensure();
      fs.writeFileSync(path.join(dir, naam), enc, { mode: 0o600 });
    },
    async get(naam) {
      const p = path.join(dir, naam);
      if (fs.statSync(p).size > MAX_OBJECT_BYTES) throw new Error('Mediaobject overschrijdt de maximale mediagrootte.');
      const buf = fs.readFileSync(p);
      if (buf.length > MAX_OBJECT_BYTES) throw new Error('Mediaobject overschrijdt de maximale mediagrootte.');
      return buf;
    },
    async del(naam) { try { fs.unlinkSync(path.join(dir, naam)); } catch (e) {} },
    async has(naam) { return fs.existsSync(path.join(dir, naam)); }
  };
}

module.exports = { maakDiskBackend };
