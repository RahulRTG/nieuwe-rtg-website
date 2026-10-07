/* De autoritatieve requestcommit, los van de responspoort in
   ./postgres-verzoeken.js (die op de modulegrens zat).

   Er valt iets te committen als het verzoek een collectie wijzigde (save()) OF
   als een deelnemer werk heeft -- een accountmutatie roept geen save() aan, en
   zonder deze tweede helft zou een registratie een 2xx krijgen terwijl de
   nieuwe gebruiker nooit PostgreSQL haalde. */
'use strict';

const context = require('./verzoekcontext');
const GEEN_STORING = new Set(['PG_REQUEST_CONFLICT', 'PG_AUDIT_KETEN_GEBROKEN']);

module.exports = function maakVerzoekCommit({ motor, slot, state, gezond, reden, ongezond }) {
  function teCommitten(ctx) {
    return !!ctx.opslaan || context.deelnemersMetWerk(ctx).length > 0;
  }

  async function commit(ctx) {
    if (!gezond()) throw Object.assign(new Error(reden() || 'PostgreSQL is niet schrijfgezond.'), { code: 'PG_ONGEZOND' });
    const p = motor();
    if (!p || typeof p.commitVerzoek !== 'function')
      throw Object.assign(new Error('PostgreSQL-requestcommit ontbreekt.'), { code: 'PG_GEEN_COMMIT' });
    const w = context.wijzigingen(ctx);
    const d = context.deelnemersMetWerk(ctx);
    if (!w.length && !d.length) return { geschreven: 0 };
    try { return await slot(() => p.commitVerzoek(state.getRuweData(), w, d)); }
    catch (e) {
      /* Een conflict en een gebroken auditspoor gaan over DIT verzoek en zijn
         geen opslagstoring: de schrijfpoort voor iedereen dichtzetten zou van een
         vervalsing in een journaal een volledige storing maken. */
      if (!e || !GEEN_STORING.has(e.code)) ongezond(e, 'requestcommit');
      throw e;
    }
  }

  return { teCommitten, commit };
};
