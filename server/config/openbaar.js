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

/* Gereserveerde en niet-routeerbare naamruimtes. Een adres hierin is geen bewijs
   van openbaar EN geen bewijs van lokaal -- het is een naam die nooit op het
   open internet uitkomt maar ook geen privaat netwerkadres is. RFC 6761 (.test,
   .invalid, .example, .localhost) plus de twee achtervoegsels die dit huis zelf
   in zijn eigen documenten gebruikt. */
const ONBESLIST_ACHTERVOEGSEL = ['.test', '.invalid', '.example', '.localhost', '.internal', '.intern'];

function priveIPv4(host) {
  if (/^10\./.test(host) || /^192\.168\./.test(host)) return true;
  const m = /^172\.(\d+)\./.exec(host);
  return !!m && Number(m[1]) >= 16 && Number(m[1]) <= 31;
}

/* 'lokaal' | 'openbaar' | 'onbekend' voor een kale hostnaam (zonder schema).
   Een lege of onleesbare naam is 'onbekend' en nooit iets anders. */
function adresSoort(host) {
  const h = String(host || '').trim().toLowerCase();
  if (!h) return 'onbekend';
  if (h === 'localhost' || h === '127.0.0.1' || h === '::1' || h === '[::1]') return 'lokaal';
  if (h.endsWith('.local')) return 'lokaal';
  if (priveIPv4(h)) return 'lokaal';
  if (ONBESLIST_ACHTERVOEGSEL.some(s => h.endsWith(s))) return 'onbekend';
  /* Een naam zonder punt is een hostnaam op het eigen netwerk (een
     containernaam, een servicenaam), geen publiek domein. */
  if (!h.includes('.')) return 'onbekend';
  /* Een adres waar de wereld bij kan, is per definitie niet te bewijzen vanaf
     binnen het proces. Wat hier overblijft is een naam die als publiek domein
     is OPGEGEVEN, en dat is de bewering waar we hem aan houden. */
  return 'openbaar';
}

/* De soort van deze installatie, afgeleid uit het adres dat zij zelf opgeeft.
   APP_URL is daarvoor de juiste bron en niet de Host-header: productie mag
   gevoelige links niet uit die header afleiden (../config/productie.js), dus
   APP_URL is al het vaste publieke adres van dit huis. */
function installatieSoort(env) {
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

/* De keuring zelf. Draait BUITEN de productietak van ../config.js -- dat is de
   hele bedoeling -- en schrijft in drie bakken:

     hardeFouten    breken de start af ongeacht NODE_ENV
     fouten         het bestaande gedrag (alleen blokkerend in productie)
     waarschuwingen luid, maar houden niets tegen

   Waarom alleen de demostand een HARDE fout is en de rest een melding: een
   nieuwe handhavingsregel loopt eerst mee zonder te blokkeren (CONTROLPLANE.md,
   kern/stuur/schaduw.js). De demostand is de uitzondering omdat hij geen
   ontbrekende instelling is maar een AANGEZETTE: er staan dan verzonnen
   accounts, een pincode uit de broncode en een betaalprovider die zichzelf
   bevestigt op een adres waar mensen bij kunnen. Dat is geen tekort dat je mag
   uitrollen en daarna repareren. */
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

  /* DE SCHADUWRONDE. Een openbare installatie die niet op productie staat, komt
     de hele productiekeuring nooit tegen -- versleuteling-at-rest, de sleutels
     van de identiteitskluis, de betaalcontroles. Die draaien hier wel, maar
     uitsluitend als melding, zodat de beheerder de volledige lijst ziet zonder
     dat een site die vandaag draait morgen niet meer opkomt. */
  if (stand.soort === 'openbaar' && !productie) {
    const schaduwFouten = [];
    try { require('./productie').keur(env, schaduwFouten, waarschuwingen); }
    catch (e) { waarschuwingen.push('De schaduwronde van de productiekeuring kon niet draaien: ' + (e && e.message ? e.message : e)); }
    for (const f of schaduwFouten) {
      waarschuwingen.push('SCHADUW (zou de start blokkeren met NODE_ENV=production): ' + f);
    }
    if (schaduwFouten.length) {
      waarschuwingen.push('SCHADUW: ' + schaduwFouten.length + ' productieregel(s) zouden deze start blokkeren. '
        + 'APP_URL wijst naar een openbaar adres (' + stand.host + ') terwijl NODE_ENV niet op production staat, '
        + 'dus de productiekeuring wordt overgeslagen. Zet NODE_ENV=production zodra bovenstaande klopt.');
    }
  }

  return stand;
}

module.exports = { adresSoort, installatieSoort, keurOpenbareBouwstand };
