/* Alleen herstel van een bestaande economische boeking. De JS-opslag krijgt
   een callback die uitsluitend ONBEKEND teruggeeft; de motor alleen zijn
   bestaande leesdeur. Deze functie kan nooit een nieuwe geldbeweging boeken.
   404 is uitsluitend bewezen afwezigheid, 503 ook bij afwijking of storing. */
'use strict';
const { SLEUTEL, bewegingGelijk } = require('../../db/economische-identiteit');
const { boekOpSleutel } = require('../betaalopdracht/terugboeking');
const onbekend = () => ({ status: 404, code: 'PAY_BOEKING_ONBEKEND', onbekend: true,
  error: 'Deze economische boeking is niet aanwezig.' });
const onzeker = () => ({ status: 503, code: 'PAY_BOEKING_NIET_BEVESTIGD',
  error: 'De bestaande economische boeking kon niet betrouwbaar worden bevestigd. Er is niets nieuws geboekt.' });

module.exports = ({ geldModus, motorklant, grootboek, boekEenmaal, bevestigMotor }) => async args => {
  const a = args || {};
  if (!SLEUTEL.test(String(a.economischeSleutel || '')) ||
      !Number.isSafeInteger(a.centen) || a.centen < 1 ||
      !['van', 'naar', 'soort', 'ref'].every(k => typeof a[k] === 'string' && a[k].trim()) || a.van === a.naar)
    return onzeker();
  try {
    let r;
    if (geldModus === 'motor') {
      if (!motorklant || typeof motorklant.boekBekend !== 'function') return onzeker();
      r = await motorklant.boekBekend(a);
      if (r && r.onbekend === true && r.status === 404) return onbekend();
    } else {
      // Geen proceslokale bewegingzoeker: zonder duurzame sleutelindex is
      // afwezigheid niet bewezen en mag de aanroeper geen nieuwe inning doen.
      if (typeof boekEenmaal !== 'function') return onzeker();
      r = await boekOpSleutel({ domein: 'pay', grootboek, boek: onbekend,
        boekEenmaal, sleutel: a.economischeSleutel, args: a });
      if (r && r.onbekend === true && r.status === 404 && r.code === 'PAY_BOEKING_ONBEKEND') return onbekend();
    }
    if (!r || r.ok !== true || !r.boeking || !bewegingGelijk(a, r.boeking) ||
        typeof r.boeking.id !== 'string' || !r.boeking.id.trim()) return onzeker();
    if (geldModus === 'motor') {
      const bevestigd = bevestigMotor(r);
      return bevestigd && bevestigd.ok === true ? bevestigd : onzeker();
    }
    return { ok: true, boeking: r.boeking, herhaald: true };
  } catch (_) { return onzeker(); }
};
