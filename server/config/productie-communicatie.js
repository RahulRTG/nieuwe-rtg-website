/* Productiekeuring van de herstelkanalen. De module controleert alleen routes
   die de verzendlaag werkelijk leest; een ingevuld maar ongebruikt veld mag
   nooit een groen productiebewijs opleveren. */
'use strict';

const OUD_MAILVELD = 'SMTP_' + 'HOST';

function keurCommunicatie(env, fouten, waarschuwingen, priveBeta) {
  /* mail.js leest SMTP_URL (of de afzonderlijke MAIL_DIRECT-route), niet het
     historische SMTP_HOST-veld. */
  if (!env.SMTP_URL) {
    if (priveBeta) {
      waarschuwingen.push('Geen mailprovider in private beta: herstel- en bevestigingsmail blijft zichtbaar in de lokale outbox.');
    } else if (env[OUD_MAILVELD]) {
      fouten.push(OUD_MAILVELD + ' wordt niet door de verzendlaag gelezen. Zet de werkelijke mailroute met SMTP_URL.');
    } else {
      fouten.push('Geen echte mailprovider ingesteld: herstel- en bevestigingsmail zou alleen in de lokale outbox belanden. Zet SMTP_URL.');
    }
  }

  /* Er is nog geen extern SMS-kanaal. Productie blijft dicht totdat de
     beheerder telefoonherstel aantoonbaar fail-closed heeft uitgeschakeld. */
  if (!priveBeta && env.RTG_HERSTEL_SMS_UIT_BEWUST !== '1') {
    fouten.push('Geen echte SMS-provider aangesloten: zet RTG_HERSTEL_SMS_UIT_BEWUST=1 om telefoonherstel bewust fail-closed uit te schakelen.');
  }
}

module.exports = { keurCommunicatie };
