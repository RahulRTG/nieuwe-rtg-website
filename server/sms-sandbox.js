/* Lokale SMS-contractsandbox.

   Deze module doet bewust GEEN netwerkverkeer. Hij valideert dezelfde grens
   die een provider verwacht (E.164, tekstlengte), levert een providerachtige
   status terug en laat mail.js het bericht in de beveiligde outbox bewaren.
   Met SMS_SANDBOX_RESULT=failed kan een storing deterministisch worden getest.

   HIJ IS DE SMS-ADAPTER VAN DE TESTWERELD (BETROUWBAARHEID.md par. 4), en er
   zijn twee choke points die erlangs moeten: `sendSms()` uit mail.js (het
   sms-herstel in routes/auth/herstel.js) en `send('sms:...')`, dat in mail.js
   naar dezelfde verzender doorvalt. Beide komen uit bij toetsSms() in
   ./mail-lokaal.js en dus hier; test/testwereld-adapters.test.js houdt dat
   vast met een bericht langs elke ingang.

   DRIE GRENDELS, FAIL-CLOSED, ELK MET DE REDEN (waaromNiet):
     1. alleen met SMS_SANDBOX=1;
     2. nooit in productie, ook niet mét de vlag;
     3. nooit naast een echte sms-weg. Die grendel heeft VANDAAG GEEN ONDERWERP,
        en dat is gemeten en niet aangenomen: dit huis heeft geen extern
        sms-kanaal (mail.js exporteert `smsConfigured: false`, en er staat
        nergens een providersleutel). Komt er een bij, dan hoort zijn
        omgevingsvariabele in ECHTE_SMSWEGEN; de toets zakt zodra
        `smsConfigured` iets anders zegt dan false, zodat die stap niet
        vergeten kan worden.

   EEN ADAPTER LAAT NIETS SLAGEN WAT IN HET ECHT ZOU MISLUKKEN: een nummer dat
   geen E.164 is of een tekst die te lang is, weigert hij zoals een provider
   dat doet, en `bezorgd` blijft false -- geaccepteerd is niet afgeleverd. */
'use strict';

const crypto = require('crypto');

/* Omgevingsvariabelen die een ECHTE sms-weg zouden openen. Leeg, met opzet:
   zie grendel 3 hierboven. */
const ECHTE_SMSWEGEN = [];

function waaromNiet(env) {
  const e = env || {};
  if (e.SMS_SANDBOX !== '1')
    return 'De SMS-sandbox staat uit. Zet SMS_SANDBOX=1 in een omgeving die geen productie is.';
  if (e.NODE_ENV === 'production')
    return 'De SMS-sandbox draait nooit in productie, ook niet met SMS_SANDBOX=1.';
  const echt = ECHTE_SMSWEGEN.find((k) => String(e[k] || '').trim());
  if (echt)
    return 'Er is een echte sms-weg ingesteld (' + echt + '). De sandbox weigert die te overschaduwen.';
  return null;
}

function maakSmsSandbox(env) {
  env = env || process.env;
  const reden = waaromNiet(env);
  const enabled = reden === null;

  function send(naar, tekst) {
    if (!enabled) {
      const e = new Error(reden);
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

  return { enabled, reden, mode: enabled ? 'sandbox' : 'uit', live: false, send };
}

const standaard = maakSmsSandbox();
module.exports = Object.assign({ maakSmsSandbox, waaromNiet, ECHTE_SMSWEGEN }, standaard);
