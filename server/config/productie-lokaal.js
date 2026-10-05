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

  /* RTG_DEV_LINKS zet de herstellink, de verificatielink en de sms-code in het
     HTTP-antwoord (routes/auth.js, member/herstelkanaal.js, algpin.js), zodat
     toetsen de stroom kunnen doorlopen. Op een echte server is dat elk account
     over te nemen met een POST op een willekeurig adres -- precies het gat uit
     de kop van routes/auth.js. Hier stond hij niet, dus een vergeten vlag kwam
     zonder melding door de productiekeuring (RTG-V1-RELEASE C4). Via
     ./openbaar.js geldt dit ook op een openbaar adres zonder NODE_ENV. */
  if (env.RTG_DEV_LINKS === '1')
    fouten.push('RTG_DEV_LINKS=1 in productie: herstel- en verificatielinks en sms-codes zouden in het HTTP-antwoord staan, en daarmee is elk account over te nemen. Zet hem uit.');

  /* Meet- en proefstanden die ELK antwoord raken, dezelfde klasse als
     RTG_DEV_LINKS (de herkeuring van C4). RTG_STAATLOG telt alleen in de twee
     standen die hem echt aanzetten (staatlog.js begin), zodat RTG_STAATLOG=false
     geen start breekt met een melding die niet klopt. */
  if (env.RTG_LIEG)
    fouten.push('RTG_LIEG staat aan in productie: de gekozen paden geven met opzet een leeg antwoord. Zet hem uit.');
  if (env.RTG_STAATLOG === '1' || env.RTG_STAATLOG === '2')
    fouten.push('RTG_STAATLOG staat aan in productie: elk antwoord draagt de omvang van de opslag. Zet hem uit.');

  /* RTG_VERRAAD, RTG_KLOK en RTG_DUURZAAM=uit weigeren zichzelf al, maar alleen
     bij NODE_ENV=production (lib/verraad.js, lib/klok.js, lib/duurzaam.js). Op
     een openbaar adres zonder NODE_ENV startte de server dan met een opslag die
     schrijfacties weggooit of een verzette klok (tweede herkeuring van C4). Hier
     staan ze, zodat ./openbaar.js ze ook daar hard weigert. */
  if (String(env.RTG_VERRAAD || '').split(',').some(d => d.trim()))
    fouten.push('RTG_VERRAAD staat aan in productie: de opslag gooit met opzet schrijfacties weg. Zet hem uit.');
  if (String(env.RTG_KLOK || '').trim())
    fouten.push('RTG_KLOK staat aan in productie: een verzette klok raakt sessies, facturen en het auditlog. Zet hem uit.');
  if (String(env.RTG_DUURZAAM || '').toLowerCase() === 'uit')
    fouten.push('RTG_DUURZAAM=uit in productie: bevestigd werk zou niet zijn vastgelegd. Zet hem uit.');

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
