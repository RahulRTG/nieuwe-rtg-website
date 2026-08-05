/* Eigen post aanzetten: sleutelpaar, DNS-regels, en de meting of het hier
   uberhaupt kan.

   MAIL_DIRECT=1 laat server/mail.js de post ZELF bezorgen bij de mailserver van
   de ontvanger (server/smtp-direct.js), ondertekend met DKIM (server/dkim.js).
   Dat werkt alleen als drie dingen buiten de code kloppen: een open poort 25,
   een kloppende PTR, en de DNS-records hieronder. Dit scriptje maakt die drie
   concreet in plaats van "regel uw DNS".

   Gebruik:
     npm run eigenpost                       meten + regels voor MAIL_DOMEIN
     npm run eigenpost -- rahultravelgroup.nl 203.0.113.7
     npm run eigenpost -- rahultravelgroup.nl 203.0.113.7 juli2026   (selector)

   De private sleutel wordt hier GETOOND en nergens weggeschreven. Hij hoort in
   de omgeving (DKIM_PRIVATE_KEY) of in een secrets manager -- een sleutel die
   dit script netjes in een bestand zet, staat morgen in git. */
'use strict';
const dkim = require('../server/dkim');
const direct = require('../server/smtp-direct');

const domein = process.argv[2] || process.env.MAIL_DOMEIN ||
  (/@([^>\s]+)/.exec(process.env.MAIL_FROM || '') || [])[1] || '';
const ip = process.argv[3] || process.env.MAIL_IP || '';
const selector = process.argv[4] || process.env.DKIM_SELECTOR || 'rtg';

if (!domein) {
  console.log('Geef een domein mee, of zet MAIL_DOMEIN in de omgeving:\n  npm run eigenpost -- rahultravelgroup.nl 203.0.113.7');
  process.exit(1);
}

(async () => {
  console.log('\n=== Kan deze machine zelf bezorgen? ===');
  const m = await direct.beschikbaar();
  if (m.poort25) {
    console.log('  JA -- uitgaand poort 25 naar ' + m.host + ' is open.');
  } else {
    console.log('  NEE -- ' + m.waarom);
    console.log('  Zolang dit nee blijft heeft MAIL_DIRECT=1 geen zin: de post komt in de outbox.');
    console.log('  Blijf dan bij een smarthost (SMTP_URL); die is niet minder van onszelf,');
    console.log('  server/smtp.js is ook onze eigen client.');
  }

  const paar = dkim.maakSleutelpaar(2048);
  console.log('\n=== 1. In de omgeving (nooit in de repo) ===');
  console.log('  MAIL_DIRECT=1');
  console.log('  MAIL_DOMEIN=' + domein);
  console.log('  DKIM_SELECTOR=' + selector);
  console.log('  DKIM_PRIVATE_KEY="' + paar.prive.trim().split('\n').join('\\n') + '"');

  console.log('\n=== 2. In het DNS (mensenwerk, gebeurt hier niet vanzelf) ===');
  for (const r of dkim.dnsRegels({ domein, selector, publiekeSleutel: paar.publiek, ip })) {
    console.log('\n  ' + r.naam + '   ' + r.soort);
    console.log('  ' + r.waarde);
    console.log('  -> ' + r.wat);
  }
  if (!ip) console.log('\n  LET OP: geen IP meegegeven, dus in het SPF-record staat UW-IP als plaatshouder.');

  console.log('\n=== 3. Bij de hosting ===');
  console.log('  PTR (omgekeerde DNS) van het verzendende IP moet de naam teruggeven waarmee');
  console.log('  wij ons voorstellen (MAIL_HELO, standaard de hostnaam van de machine).');
  console.log('  Klopt die niet, dan weigeren grote ontvangers ondanks een geldige handtekening.\n');
})();
