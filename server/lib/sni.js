'use strict';
/* SNI ALLEEN BIJ EEN NAAM.

   Een IP-adres als TLS-servername is volgens RFC 6066 niet toegestaan. Node
   weigert het sinds kort ook hard: `The property 'options.servername' Setting
   the TLS ServerName to an IP address is not permitted`. Dat is geen theorie --
   het liet test/smtp.test.js in CI zakken (waar de nepserver op 127.0.0.1
   draait) terwijl hij lokaal groen was, en het zou in productie precies zo
   omvallen bij een SMTP- of Redis-host die als IP is geconfigureerd.

   De regel stond al in server/smtp-direct.js, maar alleen daar; server/smtp.js
   en server/redis.js zetten de servername onvoorwaardelijk. Een regel die op
   een plek klopt en op twee andere niet, is geen regel maar een gelukje --
   vandaar dit bestand.

   Het geeft een OBJECT terug en geen boolean, zodat de aanroeper hem gewoon in
   zijn opties kan spreiden: bij een naam { servername }, bij een IP niets. */

/* Een host is een IP als hij alleen cijfers en punten draagt (IPv4) of een
   dubbele punt bevat (IPv6, en die kan sowieso geen SNI-naam zijn). */
function isIpAdres(host) {
  const h = String(host || '');
  return /^[\d.]+$/.test(h) || h.includes(':');
}

function sniVan(host) {
  return isIpAdres(host) ? {} : { servername: String(host || '') };
}

module.exports = { sniVan, isIpAdres };
