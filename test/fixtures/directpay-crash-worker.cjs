/* Test-only checkpoint after the synthetic rail answers, before Payment Truth
   receives that answer. No auth/state rewrite and no external provider. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const ROOT = process.env.RTG_DP_PROEF_ROOT || path.resolve(__dirname, '../..');
const pad = require.resolve(path.join(ROOT, 'server/betaal/ontvangst')); 
const origineel = require(pad);
require.cache[pad].exports = function (ctx) {
  const rail = origineel(ctx);
  const maak = rail.maakBetaling;
  rail.maakBetaling = async function (opdracht) {
    const uit = await maak.call(rail, opdracht);
    if (process.env.RTG_DP_PROEF_MARKER) {
      if (uit.aanbieder !== 'simulatie') throw new Error('De crashproef vereist de simulatiebank');
      fs.writeFileSync(process.env.RTG_DP_PROEF_MARKER, JSON.stringify({
        fase: 'provider-antwoord-voor-verwerking', status: uit.status,
        sleutel: opdracht.idempotentieSleutel, referentie: opdracht.referentie
      }));
      await new Promise(() => {}); // parent kills this real worker after observing marker
    }
    return uit;
  };
  return rail;
};
require(path.join(ROOT, 'server/server'));
