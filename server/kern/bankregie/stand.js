/* De genormaliseerde bankregiestand. Schrijfpaden mogen hiermee een oude kast
   aanvullen; leespaden geven een kopie door zodat defaults nooit stil als
   opslagmutatie in een verder zuiver verzoek belanden. */
'use strict';

module.exports = ({ MODI }) => function normaliseer(b) {
  if (!MODI.includes(b.modus)) b.modus = 'partner';
  if (typeof b.operationeel !== 'boolean') b.operationeel = false;
  if (!Number.isFinite(b.spaarrenteBp)) b.spaarrenteBp = 150;
  if (!Number.isFinite(b.roodLimietCenten)) b.roodLimietCenten = 0;
  if (!b.tarieven || typeof b.tarieven !== 'object') b.tarieven = { sepaUitCenten: 0, spoedCenten: 0, passenCenten: 0 };
  /* De twee plafonds horen bij hetzelfde besluit als de vergunning en mogen
     daarom niet als verspreide codeconstanten een tweede waarheid vormen. */
  if (!Number.isFinite(b.walletPlafondCenten)) b.walletPlafondCenten = 1000000;
  if (!Number.isFinite(b.puntenTegoedMaxCenten)) b.puntenTegoedMaxCenten = 50000;
  if (!b.iban || typeof b.iban !== 'object') b.iban = { landcode: 'NL', bankcode: 'RTGB', bic: 'RTGBNL2A' };
  if (!b.nood || typeof b.nood !== 'object') b.nood = { actief: false, sinds: null, reden: '', door: '' };
  if (!Number.isFinite(b.mislukt)) b.mislukt = 0;
  if (!('autorisatie' in b)) b.autorisatie = null;
  if (typeof b.ledenAan !== 'boolean') b.ledenAan = false;
  if (!('vergunning' in b)) b.vergunning = null;
  if (!b.partnerRails || typeof b.partnerRails !== 'object') b.partnerRails = { sepa: true, passen: true, rekeningen: true };
  return b;
};
