'use strict';
// Eigen wegwerp-SQLite per proef; echte opslag en BW, alleen de provider is IPC.
const crypto = require('node:crypto'), opslag = require('../../server/db');
opslag.load();
let at = '2026-11-13T10:00:00.000Z', seq = 0;
const wacht = new Map();
function provider(soort, args) {
  const nr = ++seq;
  return new Promise((resolve, reject) => { wacht.set(nr, { resolve, reject }); process.send({ provider: nr, soort, args }); });
}
const betaal = { maakBetaling: o => provider('post', o),
  haalBetaling: (aanbieder, id) => provider('get', { aanbieder, id }) };
const { betaalWaarheid: bw } = require('../../server/opzet/betaalketen')({ ...opslag, crypto, betaal,
  nu: () => at, log: { warn() {} }, env: process.env });
bw.registreerAfhandeling('factuur', async () => {});
process.on('message', async m => {
  if (m.provider) {
    const p = wacht.get(m.provider); wacht.delete(m.provider);
    if (m.error) p.reject(Error(m.error)); else p.resolve(m.result);
    return;
  }
  try {
    if (m.at) at = m.at;
    let result;
    if (m.op === 'prepare') {
      const r = bw.maak({ actor: 'acc:1', idem: 'invoice:termijn2', soort: 'factuur', bronRef: 'INV-2', centen: 1200,
        context: { own: true, accountId: 1, invoiceId: 'INV-2', contractId: 'C-1', termijn: 2 } });
      bw.bereidVoor(r.id, { aanbieder: 'stripe', terugkerend: { modus: 'innen', toestemmingRef: 'getekend-C-1',
        customerId: 'cus_eigen', paymentMethodId: 'pm_eigen' } }); result = r;
    } else if (m.op === 'begin') result = await bw.begin(m.id, bw.van(m.id)?.start);
    else if (m.op === 'round') result = await bw.ronde();
    else if (m.op === 'snapshot') result = { r: bw.van(m.id), open: bw.openstaand() };
    else throw Error('Onbekende testopdracht');
    process.send({ nr: m.nr, result });
  } catch (e) { process.send({ nr: m.nr, error: { message: e.message, code: e.code } }); }
});
process.send({ ready: true });
