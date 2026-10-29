/* Alleen beoordelen: credentialbinding, bestaande bearerreden en reserveringsstatus.
   Geen uitgifte-, intrek-, opslag- of transactiebevoegdheid. De Arrival Pass
   blijft zelf eigenaar van alle mutaties en de aparte lidcontrole. */
'use strict';
module.exports = (ctx) => {
  const { redenVan, doel } = ctx;
  const DOEL = doel;
  const DICHT = Object.freeze(['geweigerd', 'geannuleerd', 'no-show', 'afgerond']);
  // een reservering die niet meer doorgaat maakt de pass nutteloos
  function oordeel(rij, reserveringVan, { puls } = {}) {
    if (!rij) return { status: 401, error: 'Deze Arrival Pass is niet geldig.' };
    const t = rij.toegang, ow = (t && t.onderwerp) || {};
    if (ow.id !== rij.id || ow.supplierCode !== rij.supplierCode || ow.reserveringId !== rij.reserveringId)
      return { status: 401, error: 'Deze Arrival Pass is niet geldig.' };
    const reden = redenVan(t, { doel: DOEL, scope: puls ? ['arrival.puls'] : ['arrival.pass.lezen'], negeerGebruik: !puls });
    if (reden === 'verlopen') return { status: 410, error: 'Deze Arrival Pass is verlopen.' };
    if (reden === 'ingetrokken') return { status: 410, error: 'Deze Arrival Pass is ingetrokken.' };
    if (reden === 'opgebruikt') return { status: 429, error: 'Met deze pass is het maximale aantal statusupdates gedeeld.' };
    if (reden) return { status: 401, error: 'Deze Arrival Pass is niet geldig.' };
    const r = typeof reserveringVan === 'function' ? reserveringVan(rij.reserveringId) : null;
    if (!r || r.supplierCode !== rij.supplierCode || DICHT.includes(r.status))
      return { status: 410, error: 'Deze reservering gaat niet (meer) door; de pass is gesloten.', dicht: true };
    return null;
  }

  return oordeel;
};
