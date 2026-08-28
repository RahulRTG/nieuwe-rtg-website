'use strict';

const STATUS = Object.freeze({
  AANGEMAAKT: 'AANGEMAAKT',
  WACHT_OP_KLANT: 'WACHT_OP_KLANT',
  IN_BEHANDELING: 'IN_BEHANDELING',
  BEVESTIGD: 'BEVESTIGD',
  GEWEIGERD: 'GEWEIGERD',
  GEANNULEERD: 'GEANNULEERD',
  CONTROLE_NODIG: 'CONTROLE_NODIG',
  TERUGBETALING_WACHT: 'TERUGBETALING_WACHT',
  GEDEELTELIJK_TERUGBETAALD: 'GEDEELTELIJK_TERUGBETAALD',
  TERUGBETAALD: 'TERUGBETAALD'
});

const OVERGANGEN = {
  AANGEMAAKT: ['WACHT_OP_KLANT', 'IN_BEHANDELING', 'BEVESTIGD', 'GEWEIGERD', 'GEANNULEERD', 'CONTROLE_NODIG'],
  WACHT_OP_KLANT: ['IN_BEHANDELING', 'BEVESTIGD', 'GEWEIGERD', 'GEANNULEERD', 'CONTROLE_NODIG'],
  IN_BEHANDELING: ['WACHT_OP_KLANT', 'BEVESTIGD', 'GEWEIGERD', 'GEANNULEERD', 'CONTROLE_NODIG'],
  GEWEIGERD: ['WACHT_OP_KLANT', 'IN_BEHANDELING', 'CONTROLE_NODIG'],
  GEANNULEERD: ['WACHT_OP_KLANT', 'IN_BEHANDELING', 'CONTROLE_NODIG'],
  BEVESTIGD: ['TERUGBETALING_WACHT', 'CONTROLE_NODIG'],
  TERUGBETALING_WACHT: ['GEDEELTELIJK_TERUGBETAALD', 'TERUGBETAALD', 'CONTROLE_NODIG'],
  GEDEELTELIJK_TERUGBETAALD: ['TERUGBETALING_WACHT', 'TERUGBETAALD', 'CONTROLE_NODIG'],
  CONTROLE_NODIG: [],
  TERUGBETAALD: []
};

function providerStatus(aanbieder, stand, gebeurtenis) {
  const s = String(stand || '').toLowerCase();
  const g = String(gebeurtenis || '').toLowerCase();
  if (aanbieder === 'magnaat-test' || aanbieder === 'demo') return s === 'betaald' ? STATUS.BEVESTIGD : STATUS.WACHT_OP_KLANT;
  if (aanbieder === 'mollie') {
    if (s === 'paid') return STATUS.BEVESTIGD;
    if (s === 'authorized' || s === 'pending') return STATUS.IN_BEHANDELING;
    if (s === 'open') return STATUS.WACHT_OP_KLANT;
    if (s === 'failed') return STATUS.GEWEIGERD;
    if (s === 'canceled' || s === 'expired') return STATUS.GEANNULEERD;
  }
  if (aanbieder === 'stripe') {
    if (s === 'succeeded' || g === 'payment_intent.succeeded') return STATUS.BEVESTIGD;
    if (g === 'payment_intent.payment_failed') return STATUS.GEWEIGERD;
    /* processing en requires_capture zijn uitdrukkelijk GEEN geld binnen. */
    if (s === 'processing' || s === 'requires_capture') return STATUS.IN_BEHANDELING;
    if (s === 'requires_action' || s === 'requires_confirmation' || s === 'requires_payment_method')
      return STATUS.WACHT_OP_KLANT;
    if (s === 'canceled' || g === 'payment_intent.canceled') return STATUS.GEANNULEERD;
  }
  if (aanbieder === 'adyen') {
    /* Een Payment Link met status completed is nog geen vrijgavesignaal. De
       HMAC-gecontroleerde AUTHORISATION/CAPTURE-melding levert captured. */
    if (s === 'captured') return STATUS.BEVESTIGD;
    if (s === 'authorised' || s === 'authorized' || s === 'completed' || s === 'paymentpending' || s === 'received')
      return STATUS.IN_BEHANDELING;
    if (s === 'active') return STATUS.WACHT_OP_KLANT;
    if (s === 'refused' || s === 'error' || s === 'failed') return STATUS.GEWEIGERD;
    if (s === 'cancelled' || s === 'canceled' || s === 'expired') return STATUS.GEANNULEERD;
  }
  return STATUS.IN_BEHANDELING;
}

function mag(van, naar) {
  return van === naar || (OVERGANGEN[van] || []).includes(naar);
}

const definitiefBetaald = (s) => s === STATUS.BEVESTIGD ||
  s === STATUS.TERUGBETALING_WACHT || s === STATUS.GEDEELTELIJK_TERUGBETAALD || s === STATUS.TERUGBETAALD;

module.exports = { STATUS, OVERGANGEN, providerStatus, mag, definitiefBetaald };
