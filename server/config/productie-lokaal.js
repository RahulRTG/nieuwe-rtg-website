/* Lokale bouwstanden die in productie hard dicht moeten blijven. */
'use strict';

function keurLokaleBouwstanden(env, fouten, waarschuwingen) {
  const priveBeta = env.RTG_PRIVATE_BETA === '1';
  if (env.RTG_DEMO === '1')
    fouten.push('RTG_DEMO=1 in productie: de demo-inlog zou openstaan. Zet hem uit.');

  /* De rem op het raden van een gezinscode. Toetsen mogen hem uitzetten (ze
     delen een adres en zouden elkaar anders remmen); een echte server nooit.
     Achter een gezinscode liggen kinderprofielen met locatie en gezondheid. */
  if (env.RTG_GEZIN_REM_UIT === '1')
    fouten.push('RTG_GEZIN_REM_UIT=1 in productie: het raden van gezinscodes zou onbeperkt zijn. Zet hem uit.');

  for (const naam of ['SMTP_SANDBOX', 'SMS_SANDBOX', 'STRIPE_CONNECT_SANDBOX', 'SEPA_SANDBOX']) {
    if (env[naam] === '1')
      fouten.push(naam + '=1 is uitsluitend lokaal: een contract-sandbox mag productie nooit als een echte integratie laten starten.');
  }

  /* Een private beta is een bouwstand, geen sluiproute naar internet. */
  if (priveBeta) {
    let lokaal = false;
    try {
      const host = new URL(String(env.APP_URL || '')).hostname.toLowerCase();
      lokaal = host === 'localhost' || host === '127.0.0.1' || host === '::1' || host.endsWith('.local') ||
        /^10\./.test(host) || /^192\.168\./.test(host) ||
        (() => { const m = /^172\.(\d+)\./.exec(host); return !!m && Number(m[1]) >= 16 && Number(m[1]) <= 31; })();
    } catch (e) {}
    if (!lokaal)
      fouten.push('RTG_PRIVATE_BETA=1 mag alleen met een lokaal APP_URL (localhost, .local of een privaat netwerkadres). Een private beta mag nooit per ongeluk publiek staan.');
    else
      waarschuwingen.push('RTG_PRIVATE_BETA=1: alleen lokaal bouwen; mail blijft in de outbox en demo-betalingen zijn geen echte betalingen. Verwijder deze vlag voor publieke livegang.');
  }
  return priveBeta;
}

module.exports = { keurLokaleBouwstanden };
