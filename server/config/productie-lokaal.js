/* Lokale bouwstanden die in productie hard dicht moeten blijven. */
'use strict';

function keurLokaleBouwstanden(env, fouten, waarschuwingen) {
  const priveBeta = env.RTG_PRIVATE_BETA === '1';
  if (env.RTG_DEMO === '1')
    fouten.push('RTG_DEMO=1 in productie: de demo-inlog zou openstaan. Zet hem uit.');
  if (env.RTG_MAGNAAT_TEST === '1')
    fouten.push('RTG_MAGNAAT_TEST=1 in productie: Magnaat Test hoort op een afzonderlijke testinstallatie. Zet hem uit.');

  /* De rem op het raden van een gezinscode. Toetsen mogen hem uitzetten (ze
     delen een adres en zouden elkaar anders remmen); een echte server nooit.
     Achter een gezinscode liggen kinderprofielen met locatie en gezondheid. */
  if (env.RTG_GEZIN_REM_UIT === '1')
    fouten.push('RTG_GEZIN_REM_UIT=1 in productie: het raden van gezinscodes zou onbeperkt zijn. Zet hem uit.');

  for (const naam of ['SMTP_SANDBOX', 'SMS_SANDBOX', 'STRIPE_CONNECT_SANDBOX', 'SEPA_SANDBOX']) {
    if (env[naam] === '1')
      fouten.push(naam + '=1 is uitsluitend lokaal: een contract-sandbox mag productie nooit als een echte integratie laten starten.');
  }

  /* Een private beta is een bouwstand, geen sluiproute naar internet.

     DE ADRESTEST STOND HIER ALS EIGEN KOPIE en woont nu in ./openbaar.js, omdat
     er een tweede lezer bij kwam. Let op het verschil in RICHTING, want dat is
     precies waarom het een functie met drie uitkomsten is en geen boolean: hier
     eist de regel `aantoonbaar lokaal`, dus alles wat niet te bewijzen valt
     (geen APP_URL, een onleesbaar adres, een gereserveerde naam als .test) komt
     terecht bij de fout hieronder -- net als voorheen. ./openbaar.js eist het
     omgekeerde, `aantoonbaar openbaar`, en laat datzelfde middengebied juist
     ongemoeid. Een gedeelde `!lokaal` zou een van die twee stilzwijgend
     omdraaien. */
  if (priveBeta) {
    const lokaal = require('./openbaar').installatieSoort(env).soort === 'lokaal';
    if (!lokaal)
      fouten.push('RTG_PRIVATE_BETA=1 mag alleen met een lokaal APP_URL (localhost, .local of een privaat netwerkadres). Een private beta mag nooit per ongeluk publiek staan.');
    else
      waarschuwingen.push('RTG_PRIVATE_BETA=1: alleen lokaal bouwen; mail blijft in de outbox. Betalen is echt gekoppeld of fail-closed uit. Verwijder deze vlag voor publieke livegang.');
  }
  return priveBeta;
}

module.exports = { keurLokaleBouwstanden };
