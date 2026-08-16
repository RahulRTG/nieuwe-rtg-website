/* Volledig lokale contractrails voor Connect en SEPA. Deze module maakt
   providerachtige opdrachten, maar doet geen netwerkverkeer en beweegt geen
   geld. Productie kan de vlaggen nooit activeren. */
'use strict';

const crypto = require('crypto');
const iban = require('./iban');

const NIET_PRODUCTIE = process.env.NODE_ENV !== 'production';
const CONNECT = NIET_PRODUCTIE && process.env.STRIPE_CONNECT_SANDBOX === '1';
const SEPA = NIET_PRODUCTIE && process.env.SEPA_SANDBOX === '1';

function connect({ bedrag, valuta, referentie, bestemming }) {
  if (!/^acct_[A-Za-z0-9]{6,}$/.test(String(bestemming))) {
    const e = new Error('Connected-account heeft geen geldig sandbox-id.');
    e.code = 'CONNECT_ACCOUNT_ONGELDIG';
    throw e;
  }
  const id = 'pi_test_' + crypto.randomBytes(10).toString('hex');
  return {
    id, status: 'processing', clientSecret: id + '_secret_test',
    aanbieder: 'stripe-connect-sandbox', sandbox: true,
    bedrag: Math.round(bedrag), valuta, referentie,
    transferData: { destination: String(bestemming) }
  };
}

function sepa({ bedrag, valuta, referentie, iban: rekening, begunstigde, omschrijving }) {
  const doel = iban.normaliseer(rekening);
  if (!iban.geldig(doel)) {
    const e = new Error('SEPA-sandbox weigert een ongeldig IBAN.');
    e.code = 'IBAN_ONGELDIG';
    throw e;
  }
  return {
    id: 'sepa_test_' + crypto.randomBytes(10).toString('hex'), status: 'processing',
    aanbieder: 'sepa-sandbox', sandbox: true, bedrag: Math.round(bedrag),
    valuta, referentie, iban: doel, begunstigde: String(begunstigde || '').slice(0, 120),
    omschrijving: String(omschrijving || '').slice(0, 140)
  };
}

module.exports = { CONNECT, SEPA, connect, sepa };
