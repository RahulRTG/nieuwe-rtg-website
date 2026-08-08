/* Eigen post aanzetten: sleutelpaar, DNS-regels, en de meting of het hier
   uberhaupt kan.

   TWEE RICHTINGEN, en tot voor kort ging dit script maar over een.

   UITGAAND. MAIL_DIRECT=1 laat server/mail.js de post ZELF bezorgen bij de
   mailserver van de ontvanger (server/smtp-direct.js), ondertekend met DKIM
   (server/dkim.js). Dat werkt alleen als drie dingen buiten de code kloppen: een
   open poort 25, een kloppende PTR, en de DNS-records hieronder.

   INKOMEND. Sinds server/smtp-in.js bestaat, kan dit huis ook post AANNEMEN --
   en daar hoort een MX-record bij, plus een poort 25 die van BUITEN bereikbaar
   is. Zonder dat MX-record weet geen enkele verzendende server waar hij moet
   zijn, en dan blijft de ontvanger stil zonder dat er iets stuk is. Dat is
   precies het soort "het werkt niet en niemand zegt waarom" waar dit script voor
   bestaat, dus staat het er nu bij.

   Dit scriptje maakt dat alles concreet in plaats van "regel uw DNS".

   Gebruik:
     npm run eigenpost                       meten + regels voor MAIL_DOMEIN
     npm run eigenpost -- rahultravelgroup.nl 203.0.113.7
     npm run eigenpost -- rahultravelgroup.nl 203.0.113.7 juli2026   (selector)

   De INKOMENDE kant meet hij alleen als MAIL_IN_POORT is gezet: dan weet hij op
   welke poort hij moet kijken. Staat die niet, dan zegt hij dat -- want een
   MX-record naar een machine die niets aanneemt, is erger dan geen MX-record.

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
  console.log('  Klopt die niet, dan weigeren grote ontvangers ondanks een geldige handtekening.');

  /* ---------------- de andere richting: post AANNEMEN ---------------- */
  console.log('\n=== 4. Post ONTVANGEN (server/smtp-in.js) ===');
  const inPoort = process.env.MAIL_IN_POORT || '';
  if (!inPoort) {
    console.log('  MAIL_IN_POORT staat NIET. De ontvanger luistert dus niet, en dan hoort er');
    console.log('  ook geen MX-record naar deze machine te wijzen: een MX die naar een stille');
    console.log('  poort verwijst, laat afzenders dagen vergeefs proberen.');
    console.log('  Zet MAIL_IN_POORT=25 (of 2525 met een doorstuurregel) en draai dit opnieuw.');
  } else {
    console.log('  MAIL_IN_POORT=' + inPoort + (Number(inPoort) < 1024
      ? '  -- onder de 1024: geef het proces CAP_NET_BIND_SERVICE, of gebruik 2525 met een doorstuurregel.'
      : '  -- boven de 1024, dus er hoort een doorstuurregel van 25 naar deze poort te staan.'));
    const bereik = await inkomendBereikbaar(inPoort);
    console.log('  ' + bereik);
  }
  console.log('\n  Het DNS-record dat hierbij hoort:');
  for (const r of regelsIn(domein, ip)) {
    console.log('\n  ' + r.naam + '   ' + r.soort);
    console.log('  ' + r.waarde);
    console.log('  -> ' + r.wat);
  }
  console.log('');
})();

/* De inkomende DNS-regels. Ze staan HIER en niet in server/dkim.js, en dat is
   geen slordigheid: dat bestand gaat over ONDERTEKENEN (DKIM, en de twee
   records die daarbij horen). Een MX-record heeft met handtekeningen niets te
   maken; het zegt alleen waar post heen moet. Ze bij elkaar zetten omdat het
   allebei "DNS" is, zou de reden van dat bestand oplossen in een categorie. */
function regelsIn(domein, ip) {
  const post = 'mail.' + domein;
  return [
    { naam: domein, soort: 'MX',
      waarde: '10 ' + post + '.',
      wat: 'zegt welke machine de post voor dit domein aanneemt; zonder dit record komt er niets binnen' },
    { naam: post, soort: 'A',
      waarde: ip || 'UW-IP',
      wat: 'de naam uit het MX-record moet naar een IP wijzen -- een MX naar een naam zonder A-record is een dood spoor' }
  ];
}

/* IS DE POORT VAN BUITEN TE BEREIKEN? Dat kan dit script niet met zekerheid
   vaststellen -- daarvoor moet je van buiten naar binnen kijken, en wij staan
   binnen. Wat hij WEL kan: nagaan of er hier iets luistert. Dat scheelt de helft
   van de gevallen, en de andere helft (een firewall ervoor) staat er met zoveel
   woorden bij in plaats van als stilte. */
function inkomendBereikbaar(poort) {
  const net = require('net');
  return new Promise((res) => {
    const s = net.createConnection({ host: '127.0.0.1', port: Number(poort), timeout: 4000 });
    const klaar = (t) => { try { s.destroy(); } catch (e) {} res(t); };
    s.once('connect', () => klaar('HIER luistert iets op deze poort. Of hij van BUITEN bereikbaar is, ' +
      'kan dit script niet zien -- vraag het uw hostingpartij, of laat iemand van buiten telnetten.'));
    s.once('timeout', () => klaar('NIEMAND antwoordde binnen vier seconden. Draait de server, en staat MAIL_IN_POORT daar ook?'));
    s.once('error', (e) => klaar('NIETS luistert hier (' + (e && e.code) + '). Start de server met MAIL_IN_POORT gezet.'));
  });
}
