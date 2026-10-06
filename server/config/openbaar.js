/* IS DEZE INSTALLATIE AANTOONBAAR OPENBAAR? -- en wat mag er dan niet aanstaan.

   WAAROM DIT BESTAAT. De hele productiekeuring hangt aan een vraag:
   `NODE_ENV === 'production'` (../config.js). Datzelfde geldt voor de demostand
   (../testomgeving.js weigert demo zodra NODE_ENV op production staat). Die twee
   samen maken een grendel die niet kan afgaan: ../config/productie-lokaal.js
   verbiedt RTG_MAGNAAT_TEST=1 "in productie", maar in productie stond de vlag
   toch al uit. Precies in de enige stand waarin de vlag iets DOET -- een
   installatie die publiek draait terwijl NODE_ENV iets anders zegt -- wordt de
   keuring overgeslagen en is de fout een zachte hint.

   Dat is geen hypothese. Op een draaiende RTG-installatie werkte het
   demo-wachtwoord van het eigenaarsaccount. Dat wachtwoord kan alleen door
   accounts/kluis.js zaaiHash() gezet zijn, en die weigert buiten Magnaat Test.
   Er stonden dus demo-accounts, demo-personeel met een pincode uit de broncode
   en een synthetische betaalprovider op een adres waar mensen bij konden.

   DE VRAAG HEEFT DRIE ANTWOORDEN EN NIET TWEE. "Aantoonbaar lokaal" en
   "aantoonbaar openbaar" zijn geen tegenpolen; ertussen zit wat niemand heeft
   opgegeven. Dat onderscheid is de reden dat dit bestand bestaat in plaats van
   een `!lokaal`: een adres dat niemand heeft gezet mag nooit als openbaar
   gelden (dan valt elke lokale start om), en het mag ook nooit als lokaal
   gelden (dan is de grendel weer weg). `onbekend` is geen `openbaar` -- dezelfde
   regel die kern/envelop.js voor classificatie hanteert.

   EEN DEFINITIE, TWEE LEZERS. ../config/productie-lokaal.js vraagt "is dit
   aantoonbaar lokaal?" voor RTG_PRIVATE_BETA en moet daar STRENG zijn (bij
   twijfel een fout). Dit bestand vraagt "is dit aantoonbaar openbaar?" en moet
   daar VOORZICHTIG zijn (bij twijfel geen blokkade). Beide lezen dezelfde
   adresSoort(); wie er een tweede lijst naast legt, laat ze binnen een jaar uit
   elkaar lopen. */
'use strict';

/* De adressoort (lokaal | openbaar | onbekend) van een kale hostnaam staat in
   ./adressoort.js: een eigen onderwerp, en dit bestand ging erdoor over de 10 KB. */
const { adresSoort } = require('./adressoort');

/* De soort van deze installatie, afgeleid uit het adres dat zij zelf opgeeft.
   APP_URL is daarvoor de juiste bron en niet de Host-header: productie mag
   gevoelige links niet uit die header afleiden (../config/productie.js), dus
   APP_URL is al het vaste publieke adres van dit huis. */
function installatieSoort(env) {
  /* EEN TWEEDE OPGAVE: een publiek certificaat. Wie RTG_ACME=1 met een
     RTG_TLS_DOMAIN zet, vraagt Let's Encrypt om een certificaat voor die naam --
     en dat lukt alleen als de wereld die naam op deze machine kan bereiken. Dat
     is dus net zo goed een bewering "ik ben openbaar" als APP_URL, en hij gaat
     voor: een lokaal APP_URL naast een publiek certificaat is een installatie
     die zichzelf tegenspreekt, en bij twijfel telt de openbare kant.

     RTG_DOMAINS ook. Die variabele draagt meestal de namen van CODEdomeinen
     (member, social -- server/opzet/routes.js), en die hebben geen punt en
     blijven dus 'onbekend'. Maar ../server.js leest het eerste element als
     HOSTNAAM voor de links in een e-mail (APP_URL_VAST), dus staat er een
     publieke naam in, dan beweert de installatie daarmee dat ze daar woont. */
  const lijst = (v) => String(v || '').split(',').map(d => d.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/[/:].*$/, '')).filter(Boolean);
  const opgaven = [
    ...(env && env.RTG_ACME === '1' ? lijst(env.RTG_TLS_DOMAIN).map(h => [h, 'RTG_TLS_DOMAIN (RTG_ACME=1)']) : []),
    ...lijst(env && env.RTG_DOMAINS).map(h => [h, 'RTG_DOMAINS'])
  ];
  const publiek = opgaven.find(([h]) => adresSoort(h) === 'openbaar');
  if (publiek) return { soort: 'openbaar', host: publiek[0], reden: null, bron: publiek[1] };
  const ruw = String((env && env.APP_URL) || '').trim();
  if (!ruw) return { soort: 'onbekend', host: null, reden: 'APP_URL is niet gezet' };
  let host = null;
  try { host = new URL(ruw).hostname; } catch (e) { host = null; }
  if (!host) return { soort: 'onbekend', host: null, reden: 'APP_URL is geen leesbaar adres' };
  return { soort: adresSoort(host), host: host.toLowerCase(), reden: null };
}

function demoAan(env) {
  return (env && env.RTG_MAGNAAT_TEST === '1') || (env && env.RTG_DEMO === '1');
}

/* "Is dit adres aantoonbaar openbaar?" voor poorten die alleen dat vragen (de
   inlogrem). Bij twijfel false: een storing maakt een adres nooit openbaar. */
function isOpenbaar(env) {
  try { return installatieSoort(env || process.env).soort === 'openbaar'; } catch (e) { return false; }
}

/* De keuring zelf. Draait BUITEN de productietak van ../config.js -- dat is de
   hele bedoeling -- en schrijft in drie bakken:

     hardeFouten    breken de start af ongeacht NODE_ENV
     fouten         het bestaande gedrag (alleen blokkerend in productie)
     waarschuwingen luid, maar houden niets tegen

   Op een AANTOONBAAR OPENBAAR adres zijn de productieregels geen schaduw: de
   demostand en een ontbrekende productiebeveiliging gaan allebei naar
   hardeFouten (blocker 3). 'onbekend' blijft een melding, zodat een lokale
   start of een toets niet omvalt. */
function keurOpenbareBouwstand(env, bakken) {
  const { fouten, waarschuwingen, hardeFouten, productie } = bakken;
  const stand = installatieSoort(env);

  if (stand.soort === 'openbaar' && demoAan(env)) {
    const vlag = env.RTG_MAGNAAT_TEST === '1' ? 'RTG_MAGNAAT_TEST=1' : 'RTG_DEMO=1';
    hardeFouten.push(vlag + ' terwijl APP_URL een openbaar adres is (' + stand.host + '). '
      + 'Magnaat Test zet verzonnen leden en zaken klaar, personeel met een pincode die in de broncode staat, '
      + 'en een betaalprovider die betalingen zelf bevestigt; het zet bovendien bij elke start het wachtwoord van '
      + 'het eigenaarsaccount terug naar het demo-wachtwoord. Dat hoort niet op een adres waar mensen bij kunnen. '
      + 'Zet de vlag uit, of zet APP_URL op het lokale adres van de testinstallatie.');
  }

  /* Staat de vlag aan zonder dat we het adres kennen, dan blijft het bij een
     melding. Blokkeren zou elke lokale start en elke toets omleggen op een
     variabele die daar niet voor bedoeld is, en een grendel die het normale
     werk breekt wordt binnen een week uitgezet. */
  if (stand.soort !== 'openbaar' && demoAan(env) && !productie) {
    waarschuwingen.push('Magnaat Test staat aan. Of deze installatie openbaar is, is hier NIET vast te stellen ('
      + (stand.reden || 'APP_URL wijst naar ' + stand.host) + '). '
      + 'Draait dit op een adres waar anderen bij kunnen, zet de vlag dan uit: er staan nu demo-accounts, '
      + 'een pincode uit de broncode en een betaalprovider die zichzelf bevestigt.');
  }

  /* RTG_DEV_LINKS ALLEEN OP EEN AANTOONBAAR LOKALE INSTALLATIE (P1-2 config).
     Hier stond een waarschuwing voor elk adres dat niet aantoonbaar openbaar
     was -- de VOORZICHTIGE richting van dit bestand. Voor deze vlag is dat de
     verkeerde: hij zet de herstellink, de verificatielink en de sms-code in het
     antwoord, dus een POST met het e-mailadres van een ander neemt diens
     account over. Een server zonder APP_URL op een publiek IP is 'onbekend', en
     startte daarmee met elk account open. Deze vlag vraagt daarom de STRENGE
     richting, dezelfde als RTG_PRIVATE_BETA in ./productie-lokaal.js: bewezen
     lokaal, of geen start. In productie weigert ./productie-lokaal.js hem al. */
  if (env.RTG_DEV_LINKS === '1' && !productie) {
    const bewijs = require('./omgeving').bewezenLokaal(env);
    if (!bewijs.ja) hardeFouten.push('RTG_DEV_LINKS=1 terwijl niet vast te stellen is dat deze installatie alleen lokaal '
      + 'bereikbaar is (' + bewijs.waarom + '). Met deze vlag staan herstel- en verificatielinks en sms-codes in het '
      + 'HTTP-antwoord, en is elk account over te nemen met alleen een e-mailadres. Zet APP_URL op een lokaal adres '
      + '(localhost, .local of een privaat netwerkadres), zet RTG_BIND=127.0.0.1, of zet de vlag uit.');
    else waarschuwingen.push('RTG_DEV_LINKS=1: herstellinks staan in het antwoord (' + bewijs.waarom + ').');
  }

  /* FAIL-CLOSED OP EEN OPENBAAR ADRES (RTG-V1-RELEASE blocker 3). Hier stond
     een schaduwronde die de productiekeuring alleen als MELDING liet lopen: wie
     NODE_ENV vergat, startte publiek zonder kluissleutel en met de gedeelde
     kantoorcode open. Nu breekt elke productiefout de start af ongeacht NODE_ENV;
     'onbekend' blijft buiten schot. */
  if (stand.soort === 'openbaar' && !productie) {
    const productieFouten = [];
    try { require('./productie').keur(env, productieFouten, waarschuwingen); }
    catch (e) {
      hardeFouten.push('APP_URL wijst naar een openbaar adres (' + stand.host + ') maar de productiekeuring kon niet draaien: '
        + (e && e.message ? e.message : e) + '. Fail-closed: de start wordt afgebroken.');
    }
    /* A-P1-02: een openbare installatie zonder NODE_ENV=production start NIET.
       Het was een melding; nu is het een harde fout, want zonder die vlag
       draaien de productiekeuring, de testomgevingsgrendels en de cookieregels
       niet. 'onbekend' blijft een melding: het adres is dan niet vast te stellen. */
    hardeFouten.push('APP_URL wijst naar een openbaar adres (' + stand.host + ') terwijl NODE_ENV niet op production staat. '
      + 'Dan wordt de productiekeuring overgeslagen (' + productieFouten.length + ' regel(s) zouden nu blokkeren). '
      + 'Zet NODE_ENV=production (alle officiele startpaden doen dat al), of zet APP_URL op een lokaal adres.');
    /* En zeg erbij WELKE productieregels dit adres nu nog tegenhouden (RTG-V1
       blocker 3): elk ervan geldt op een publiek adres net zo hard. */
    for (const f of productieFouten) hardeFouten.push('Op dit openbare adres geldt ook: ' + f);
  }

  return stand;
}

module.exports = { adresSoort, installatieSoort, isOpenbaar, keurOpenbareBouwstand };
