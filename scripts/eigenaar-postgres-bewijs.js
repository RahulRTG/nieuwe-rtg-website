#!/usr/bin/env node
'use strict';

require('./lib/eigenaar-postgres-bewijs').meet(process.env).then(bewijs => {
  process.stdout.write('RTG_OWNER_READBACK_JSON=' + JSON.stringify(bewijs) + '\n');
}).catch(e => {
  console.error('[ownerproof] ' + (e && e.message ? e.message : e));
  process.exitCode = 1;
});
