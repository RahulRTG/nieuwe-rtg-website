// Isolated test entry point. No production route or environment flag imports this fixture.
'use strict';
const fs = require('node:fs'), path = require('node:path');
if (process.env.NODE_ENV !== 'test' || !process.env.RTG_DATA_DIR) throw Error('isolated fixture only');
const target = require.resolve('../../../server/kern/document-capability');
const original = require(target), dir = process.env.RTG_DATA_DIR;
require.cache[target].exports = deps => original({ ...deps, bewerkCollectie: async (name, work) => {
  const arm = path.join(dir, 'arm-document-wait');
  if (fs.existsSync(arm)) {
    fs.unlinkSync(arm); fs.writeFileSync(path.join(dir, 'document-waiting'), 'waiting');
    await new Promise((resolve, reject) => {
      const started = Date.now();
      const poll = setInterval(() => {
        if (fs.existsSync(path.join(dir, 'release-document-wait'))) { clearInterval(poll); resolve(); }
        else if (Date.now() - started > 10000) { clearInterval(poll); reject(Error('isolated test gate timed out')); }
      }, 10);
    });
  }
  return deps.bewerkCollectie(name, work);
} });
require('../../../server/server');
