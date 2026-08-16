/* Vaste lokale contractproeven van de Integratiekamer. Geen invoer van de
   gebruiker, geen providerverbinding, geen echte ontvanger en geen echt geld. */
'use strict';

const sms = require('../../sms-sandbox');
const betaal = require('../../betaal-sandbox');

module.exports = function proef(id, mail) {
  if (id === 'smtp') {
    const b = mail.bouwBericht('integratieproef@localhost.invalid', 'RTG contractproef', 'Geen externe bezorging.');
    if (!b.messageId || !/Content-Type: text\/plain/.test(b.rauw)) throw new Error('SMTP-berichtcontract is onvolledig.');
    return 'Bericht lokaal opgebouwd; geen verbinding of ontvanger aangeraakt.';
  }
  if (id === 'sms') {
    const r = sms.maakSmsSandbox({ NODE_ENV: 'test', SMS_SANDBOX: '1' }).send('+31600000000', 'RTG proefcode 123456');
    if (!r.ok || r.bezorgd) throw new Error('SMS-contract gaf geen veilige lokale acceptatie.');
    return 'E.164 geaccepteerd; bezorgd=false en geen extern verkeer.';
  }
  if (id === 'connect') {
    const r = betaal.connect({ bedrag: 1250, valuta: 'eur', referentie: 'IK-proef', bestemming: 'acct_RTGTEST1' });
    if (r.status !== 'processing' || !r.sandbox) throw new Error('Connect-contract wacht niet op bevestiging.');
    return 'Destination charge staat processing; niets als omzet geboekt.';
  }
  const r = betaal.sepa({ bedrag: 3000, valuta: 'eur', referentie: 'IK-sepa', iban: 'NL91ABNA0417164300', begunstigde: 'RTFoundation' });
  if (r.status !== 'processing' || !r.sandbox) throw new Error('SEPA-contract wacht niet op bevestiging.');
  return 'IBAN modulo-97 klopt; opdracht staat processing en beweegt geen geld.';
};
