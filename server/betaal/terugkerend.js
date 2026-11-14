/* Provideropties, geen bevoegdheidsregister. De caller haalt deze waarden
   uitsluitend uit een getekende, opgeslagen afspraak; nooit uit een betaalbody.
   Een toestemmingRef is de binding aan dat bewijs, niet het bewijs zelf. */
'use strict';

function ongeldig(tekst) {
  return Object.assign(new Error(tekst), { code: 'BETAALAFSPRAAK_ONGELDIG', nietVerstuurd: true });
}
function referentie(waarde) {
  if (typeof waarde !== 'string' || !waarde.trim() || waarde !== waarde.trim() ||
      waarde.length > 200 || /[\u0000-\u001f\u007f]/.test(waarde))
    throw ongeldig('Een terugkerende betaling vereist een vaste toestemmingreferentie.');
  return waarde;
}
function providerId(waarde, prefix) {
  if (typeof waarde !== 'string' || !new RegExp('^' + prefix + '_[A-Za-z0-9_]+$').test(waarde) || waarde.length > 255)
    throw ongeldig('Een terugkerende betaling mist een geldig Stripe-' + prefix + '-kenmerk.');
  return waarde;
}
function normaliseer(invoer) {
  if (invoer === undefined) return null;
  if (!invoer || ![Object.prototype, null].includes(Object.getPrototypeOf(invoer)))
    throw ongeldig('Terugkerende betaalopties moeten expliciet zijn.');
  const velden = ['modus', 'toestemmingRef', 'customerId', 'paymentMethodId', 'mandateId'];
  for (const k of Reflect.ownKeys(invoer)) {
    const d = Object.getOwnPropertyDescriptor(invoer, k);
    if (!velden.includes(k) || !d.enumerable || !Object.hasOwn(d, 'value'))
      throw ongeldig('Onbekende of niet-opslagbare terugkerende betaaloptie.');
  }
  const { modus } = invoer;
  if (!['vastleggen', 'innen'].includes(modus)) throw ongeldig('Kies vastleggen of innen voor terugkerend betalen.');
  const uit = { modus, toestemmingRef: referentie(invoer.toestemmingRef) };
  if (modus === 'vastleggen') {
    if (['customerId', 'paymentMethodId', 'mandateId'].some(k => Object.hasOwn(invoer, k)))
      throw ongeldig('De eerste betaalmethode komt uitsluitend uit Stripe Checkout.');
  } else {
    uit.customerId = providerId(invoer.customerId, 'cus');
    uit.paymentMethodId = providerId(invoer.paymentMethodId, 'pm');
    if (invoer.mandateId != null) uit.mandateId = providerId(invoer.mandateId, 'mandate');
  }
  return Object.freeze(uit);
}

module.exports = { normaliseer, referentie, providerId, ongeldig };
