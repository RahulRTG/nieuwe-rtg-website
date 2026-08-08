/* IS DIT EEN ADRES WAARVOOR EEN CERTIFICAAT KAN BESTAAN?

   Eén vraag, en het antwoord bepaalt of we een bezoeker op http doorsturen
   naar https (zie opzet/verzoekketen.js). Doorsturen naar https op een adres
   waar geen TLS kan zijn, is doorsturen naar niets: de browser krijgt
   ERR_CONNECTION_RESET en de server lijkt stuk terwijl hij staat te draaien.

   Dat is echt gebeurd, op een machine met 192.0.2.x -- TEST-NET-1 (RFC 5737),
   letterlijk de reeks die is gereserveerd voor proefopstellingen. Die valt
   buiten de drie bekende privé-reeksen, werd dus als "een echt domein" gelezen
   en kreeg een 301 naar een poort waar niets luisterde. Zoeken naar een fout in
   de app die er niet was.

   De lijst hieronder is daarom geen verzameling uitzonderingen maar één regel:
   VOOR GEEN ENKEL ADRES HIERIN KAN IEMAND EEN CERTIFICAAT KRIJGEN. Loopback,
   het eigen netwerk (RFC 1918), link-local, carrier-grade NAT (RFC 6598, waar
   een toestel aan een gedeelde provider-verbinding of een VPN zit) en de drie
   TEST-NET-reeksen. Een naam die op .local eindigt hoort er ook bij (mDNS).

   Wat er NIET in staat is net zo belangrijk: een echt publiek IP. Wie zijn site
   op zo'n adres serveert, hoort https te doen en wordt gewoon doorgestuurd.

   Dit staat los in een eigen bestand omdat het een OORDEEL is en geen detail
   van de verzoekketen: het is met de hand te lezen, apart te toetsen, en de
   volgende die zich afvraagt "waarom stuurt hij dit adres wel/niet door" vindt
   hier het hele antwoord op één plek. */
'use strict';

const REEKSEN = [
  /^127\./,                                    // loopback
  /^10\./,                                     // RFC 1918
  /^192\.168\./,                               // RFC 1918
  /^172\.(1[6-9]|2\d|3[01])\./,                // RFC 1918
  /^169\.254\./,                               // link-local (RFC 3927)
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./,  // CGNAT (RFC 6598): 100.64.0.0/10
  /^192\.0\.2\./,                              // TEST-NET-1 (RFC 5737)
  /^198\.51\.100\./,                           // TEST-NET-2
  /^203\.0\.113\./                             // TEST-NET-3
];

/* De host zoals hij in de Host-kop staat, met of zonder poort. Een lege host
   telt als lokaal: dan is er niets om naar door te sturen. */
function lokaalAdres(hostKop) {
  const host = String(hostKop || '').split(':')[0].toLowerCase().replace(/^\[|\]$/g, '');
  if (!host) return true;
  if (host === 'localhost' || host === '::1' || host.endsWith('.local')) return true;
  return REEKSEN.some(r => r.test(host));
}

module.exports = { lokaalAdres, REEKSEN };
