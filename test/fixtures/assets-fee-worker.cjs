'use strict';
/* Alleen testconfiguratie en een startbarrière. De echte huisbetaling,
   fee-kern, duurzame bundel en HTTP-requestcommit blijven aangesloten. */
const fs = require('node:fs');
const pad = require.resolve('../../server/kern/assets/kantoor');
const origineel = require(pad);
require.cache[pad].exports = ctx => origineel({ ...ctx, serviceFeeVan: () => 7,
  pay: { ...ctx.pay, huisIn: async invoer => {
    if (process.env.RTG_ASSET_BARRIER) {
      fs.writeFileSync(process.env.RTG_ASSET_BARRIER + '.' + process.pid, JSON.stringify(invoer));
      const eind = Date.now() + 15000;
      while (!fs.existsSync(process.env.RTG_ASSET_BARRIER + '.vrij')) {
        if (Date.now() > eind) throw new Error('assetfee startbarrière verlopen');
        await new Promise(r => setTimeout(r, 20));
      }
    }
    return ctx.pay.huisIn(invoer);
  } }
});
require('../../server/server');
