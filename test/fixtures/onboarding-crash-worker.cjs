/* Alleen een testcheckpoint rond de echte collectiecommit. Geen nagemaakte
   opslag, sessie of tekenmotor. De ouder beëindigt het echte proces. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const ROOT = process.env.RTG_ONB_PROEF_ROOT || path.resolve(__dirname, '../..');
const pad = require.resolve(path.join(ROOT, 'server/kern/onboarding'));
const origineel = require(pad);
require.cache[pad].exports = { ...origineel, maakOnboarding(ctx) {
  const marker = process.env.RTG_ONB_PROEF_MARKER;
  const fase = process.env.RTG_ONB_PROEF_FASE;
  if (!marker) return origineel.maakOnboarding(ctx);
  return origineel.maakOnboarding({ ...ctx, bewerkCollectie: async (sleutel, werk) => {
    const r = await ctx.bewerkCollectie(sleutel, bron => {
      const uit = werk(bron);
      if (sleutel === 'onboarding' && uit.ok && fase === 'voor-commit') {
        fs.writeFileSync(marker, JSON.stringify({ fase, at: uit.contract.ondertekendAt }));
        process.kill(process.pid, 'SIGKILL');
      }
      return uit;
    });
    if (sleutel === 'onboarding' && r.ok && fase === 'na-commit') {
      fs.writeFileSync(marker, JSON.stringify({ fase, at: r.contract.ondertekendAt }));
      await new Promise(() => {});
    }
    return r;
  } });
} };
require(path.join(ROOT, 'server/server'));
