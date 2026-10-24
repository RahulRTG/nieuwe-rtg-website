/* Testcheckpoint rond de echte COMMIT nadat beide domeincollecties werkelijk
   zijn geschreven. Geen vervangende transactie of productiehaak. */
'use strict';
const fs = require('node:fs');
const { Client } = require('../../server/pgwire');
const query = Client.prototype.query, transacties = new WeakMap();
Client.prototype.query = async function (sql, params) {
  const tekst = String(sql).trim(), fase = process.env.RTG_AANVRAAG_CRASH_FASE;
  if (/^BEGIN\b/i.test(tekst)) transacties.set(this, new Set());
  const geschreven = transacties.get(this);
  const raakt = geschreven && geschreven.has('aanmeldingen') && geschreven.has('aanmeldingOntvangsten');
  const commit = /^COMMIT\b/i.test(tekst) && raakt && fase;
  const marker = () => fs.writeFileSync(process.env.RTG_AANVRAAG_CRASH_MARKER,
    JSON.stringify({ fase, geschreven: [...geschreven].sort() }));
  if (commit && fase === 'voor-commit') {
    marker();
    process.kill(process.pid, 'SIGKILL');
  }
  const uit = await query.call(this, sql, params);
  if (geschreven && /^INSERT INTO kv\b/i.test(tekst) && params) geschreven.add(params[0]);
  if (/^COMMIT\b|^ROLLBACK\b/i.test(tekst)) transacties.delete(this);
  if (commit && fase === 'na-commit') {
    marker();
    await new Promise(() => {});
  }
  return uit;
};
require('../../server/server');
