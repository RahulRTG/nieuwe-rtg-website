'use strict';

module.exports = function maakBetaalwaarheidAanmaker(deps) {
  const { doos, hash, idVan, nuIso, gebeurtenis, save, STATUS } = deps;
  return function maakNieuweBetaalwaarheid(invoer) {
    const actor = String(invoer.actor || ''), idem = String(invoer.idem || '');
    const centen = Math.round(Number(invoer.centen));
    if (!actor || !idem) throw new Error('Betaling mist een eigenaar of idempotentiesleutel.');
    if (!Number.isFinite(centen) || centen <= 0) throw new Error('Betaling mist een geldig bedrag.');
    const id = idVan(actor, idem), bestaand = doos()[id];
    if (bestaand) {
      if (bestaand.actor !== actor || bestaand.centen !== centen ||
        bestaand.bronRef !== String(invoer.bronRef || ''))
        throw new Error('Deze veilige betaalsleutel hoort al bij een andere betaling.');
      return bestaand;
    }
    const record = doos()[id] = { id, actor, idemHash: hash(idem),
      soort: String(invoer.soort || 'betaling'), bronRef: String(invoer.bronRef || ''),
      supplierCode: invoer.supplierCode || null, centen,
      valuta: String(invoer.valuta || 'eur').toLowerCase(), status: STATUS.AANGEMAAKT,
      provider: null, providerId: null, providerStatus: null,
      context: invoer.context || null, aangemaaktAt: nuIso(), bijgewerktAt: nuIso(),
      gebeurtenissen: [], terugbetaaldCenten: 0 };
    gebeurtenis(record, 'AANGEMAAKT', { bron: 'server' });
    save();
    return record;
  };
};
