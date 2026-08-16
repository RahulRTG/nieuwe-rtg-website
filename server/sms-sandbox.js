/* Lokale SMS-contractsandbox.

   Deze module doet bewust GEEN netwerkverkeer. Hij valideert dezelfde grens
   die een provider verwacht (E.164, tekstlengte), levert een providerachtige
   status terug en laat mail.js het bericht in de beveiligde outbox bewaren.
   Met SMS_SANDBOX_RESULT=failed kan een storing deterministisch worden getest.
   In productie kan deze stand nooit aan. */
'use strict';

const crypto = require('crypto');

function maakSmsSandbox(env) {
  env = env || process.env;
  const enabled = env.NODE_ENV !== 'production' && env.SMS_SANDBOX === '1';

  function send(naar, tekst) {
    if (!enabled) {
      const e = new Error('De lokale SMS-sandbox staat uit.');
      e.code = 'SMS_SANDBOX_UIT';
      throw e;
    }
    const telefoon = String(naar || '').replace(/^sms:/i, '').replace(/[\s()-]/g, '');
    if (!/^\+[1-9]\d{7,14}$/.test(telefoon)) {
      const e = new Error('SMS-nummer moet in E.164-formaat staan.');
      e.code = 'SMS_NUMMER_ONGELDIG';
      throw e;
    }
    const body = String(tekst == null ? '' : tekst);
    if (!body || body.length > 1600) {
      const e = new Error('SMS-tekst ontbreekt of is te lang.');
      e.code = 'SMS_TEKST_ONGELDIG';
      throw e;
    }
    if (env.SMS_SANDBOX_RESULT === 'failed') {
      const e = new Error('Gesimuleerde SMS-providerstoring.');
      e.code = 'SMS_SANDBOX_MISLUKT';
      throw e;
    }
    return {
      ok: true,
      id: 'sms_test_' + crypto.createHash('sha256').update(telefoon + '|' + body).digest('hex').slice(0, 16),
      status: 'accepted', provider: 'lokaal-contract', sandbox: true,
      bezorgd: false
    };
  }

  return { enabled, mode: enabled ? 'sandbox' : 'uit', live: false, send };
}

const standaard = maakSmsSandbox();
module.exports = Object.assign({ maakSmsSandbox }, standaard);
