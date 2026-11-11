/* Geen eigen identiteitsbeleid: de route bindt de bestaande onboarding.payGate
   aan de actuele sessie. Een afwezige/onduidelijke poort verleent niets.
   Alleen NIEUWE inning vraagt deze poort; bestaand betaalbewijs lezen niet. */
'use strict';
module.exports = function betaaltoestemming(controleer, pay) {
  let r;
  try { r = typeof controleer === 'function' ? controleer() : null; } catch (_) { r = null; }
  if (r && r.ok === true) {
    if (!pay || !pay.vrijgavePoort || typeof pay.vrijgavePoort.intern !== 'function')
      return { status: 503, error: 'De bestaande geldvrijgavepoort is niet beschikbaar. Er wordt niets nieuws geïnd.' };
    try {
      const weigering = pay.vrijgavePoort.intern();
      // De bestaande Pay-poort geeft alleen null bij toestemming.
      if (weigering === null) return { ok: true };
      if (weigering && weigering.error) return { status: weigering.status || 503,
        error: weigering.error, code: weigering.code, capability: weigering.capability };
    } catch (_) { /* een onleesbare poort is dicht */ }
    return { status: 503, error: 'De geldvrijgave kon niet worden vastgesteld. Er wordt niets nieuws geïnd.' };
  }
  if (r && r.ok === false && r.status === 403 && typeof r.error === 'string')
    return { status: 403, error: r.error, ...(r.kyc === true ? { kyc: true } : {}) };
  return { status: 503, error: 'De bestaande betaaltoegang kan niet worden gecontroleerd. Er wordt niets nieuws geïnd.' };
};
