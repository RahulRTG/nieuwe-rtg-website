/* DE REM OP EEN WACHTWOORD -- een plek voor elke deur die er een toetst.

   Vier deuren toetsen een RTG-wachtwoord op een inlognaam, en drie daarvan
   gebruiken deze rem: de gewone inlog (/api/auth/login) en de werkplekinlog van
   een lid (/api/supplier/mijn/login) helemaal, de aanmelding van personeel
   alleen voor de accountemmer (hieronder). De rem stond alleen in de eerste. De
   tweede telde alleen per ADRES, dus dertig foute wachtwoorden op een account
   vanaf dertig adressen werden nergens geremd (N28 van de V1-audit,
   eindkeuring ronde 5), en wat daar gegokt werd, telde bij de gewone inlog niet
   mee. Een deur met eigen emmers geeft per deur opnieuw tien gokken; dat is
   dezelfde les als de rem op de tweede factor (./tweedestap-rem.js,
   RTG-V1-RELEASE C3). Beide deuren delen daarom DEZE emmers, op dezelfde namen:
   wat op de een gegokt wordt, telt ook op de ander.

   DE AANMELDING VAN PERSONEEL (/api/supplier/staff/join, N29) DEELT ALLEEN DE
   ACCOUNTEMMER, via `account` hieronder. Haar adres remt zij zelf ('join:'),
   want daar is niet elke weigering een gok: zonder geldige kassacode wordt het
   wachtwoord niet eens getoetst, en zo'n poging hoort de 50 per adres van de
   gewone inlog niet op te maken. Een fout wachtwoord met een geldige code telt
   wel op het account, en daar geldt ook de vertraging. Die aanmelding bouwde de
   emmernaam eerst zelf na (een eigen sha256 op dezelfde vorm); bij het
   samenvoegen van N28 en N29 kwam dat hier, want een nagebouwde emmernaam loopt
   uit de pas zodra hier een naam verandert, en dat is al eens gebeurd (de emmer
   van adres plus account, hieronder).

   DE TECHNIEKINLOG STAAT HIER NOG BUITEN, dus de rem geldt niet overal.
   /api/techniek/inloggen remt met een eigen emmer 'tech:'; wat daar gegokt
   wordt, telt hier niet mee. Wie hem aansluit, gebruikt deze hulp.

   DRIE EMMERS, uit routes/auth/inlog.js hierheen gehaald, met dezelfde grenzen:
     - adres plus account (10). Raakt alleen de aanvaller, en daarna 429;
     - het adres alleen (50). Kan een kantoor achter een NAT-adres treffen, dus
       ruim, en ook daarna 429;
     - het account alleen (25), en die geeft GEEN slot maar een VERTRAGING van
       twee seconden op elke mislukte poging. Een slot op het account geeft een
       vreemde de macht om een lid uit zijn eigen account te houden. Wie het
       wachtwoord weet, komt dus zonder wachten binnen (test/inlogrem.test.js).

   HET ACCOUNT STAAT GEHASHT IN ELKE EMMERNAAM DIE HET DRAAGT, in die van het
   account en in die van adres plus account. Een emmer die dichtgaat, meldt zijn
   naam als bron van een beveiligingsmelding (noteFailedTry in ../../server.js),
   en die melding wordt bewaard; het vergeten van een account (../vergeten.js)
   raakt haar niet. De emmer van adres plus account droeg de inlognaam eerst in
   klare tekst, terwijl deze kop al beloofde dat dat niet kon: na tien foute
   gokken stond "brute-force|auth:<adres>:<e-mailadres>" in de opslag. Op de
   werkdeur was dat nieuw, want haar oude emmer 'mijn:'+adres droeg geen
   inlognaam. Een e-mailadres hoort niet in een spoor, net zo min als een echte
   naam naast een codenaam. test/werkplek-rem.test.js zoekt het in de datamap.

   DE NOODREM. Elke emmer die dichtgaat meldt zich via noteFailedTry als brute
   force, met het adres als aanvaller (../../server.js). Hier geen eigen soort:
   wie hier gokt, kent het wachtwoord niet, en dat is precies wat de noodrem moet
   zien (anders dan bij de tweede stap, N4).

   EEN GESLAAGDE INLOG LEEGT ALLEEN WAT OVER DIT ACCOUNT GAAT: de emmer van adres
   plus account en die van het account. Nooit die van het adres. Een geslaagde
   inlog bewijst iets over dat ene account en niets over wie er verder vanaf dat
   adres klopt. Leegde hij ook de adresemmer, dan zette een aanvaller met een
   eigen account de grens van 50 per adres terug wanneer hij wilde, en gokte hij
   vanaf een adres onbeperkt op de accounts van anderen. Dat is de les van N4
   (./tweedestap-rem.js); de adresemmer loopt vanzelf af (../../opzet/onderhoud.js).

   Deze module houdt zelf geen staat: alles staat in de gedeelde `loginFails`.
   Elke deur bouwt haar eigen exemplaar uit de drie bestaande kernfuncties, en
   twee exemplaren zien dus dezelfde emmers. Geen nieuwe naam in de kern. */
'use strict';
const crypto = require('crypto');

const VERTRAGING_MS = 2000;
const vingerafdruk = waarde => crypto.createHash('sha256').update(String(waarde || '')).digest('hex').slice(0, 24);
/* EEN ACCOUNT, EEN SLEUTEL. findByLogin vindt het account ook als de inlognaam
   andere hoofdletters of witruimte draagt; elke spelling hoort dus in dezelfde
   emmers, anders is elke spelling een verse rij gokken. */
const accountSleutel = login => vingerafdruk('account:' + String(login || '').toLowerCase().trim());

function maakWachtwoordRem({ tooManyTries, noteFailedTry, loginFails }) {
  const emmers = (ip, login) => {
    const account = accountSleutel(login);
    return { paar: 'auth:' + ip + ':' + account, bron: 'auth:bron:' + ip,
      doel: 'auth:doel:' + account };
  };
  const doelVan = login => emmers('', login).doel;
  /* DE ACCOUNTEMMER LOS, voor een deur die haar adres zelf remt (de aanmelding
     van personeel, zie de kop). mis() en gelukt() hieronder lopen hier ook
     langs, zodat naam, grens en wachttijd op een plek staan. */
  const account = {
    gok(ip, login) { noteFailedTry(doelVan(login), ip, 25); },
    /* Wacht zolang het account onder vuur ligt. Een deur mag dit bij ELKE
       weigering aanroepen en niet alleen bij een fout wachtwoord: anders verraadt
       een snel antwoord dat het wachtwoord klopte (N29). */
    async wacht(login) {
      const doel = loginFails.get(doelVan(login));
      if (doel && doel.until > Date.now()) await new Promise(r => setTimeout(r, VERTRAGING_MS));
    },
    gelukt(login) { loginFails.delete(doelVan(login)); }
  };
  return {
    /* true als de emmer van adres plus account of die van het adres dicht is;
       dan is het 429-antwoord al gestuurd. De accountemmer remt hier niet. */
    dicht(res, ip, login) {
      const e = emmers(ip, login);
      return tooManyTries(res, e.paar) || tooManyTries(res, e.bron);
    },
    /* Een mislukte poging. De drie emmers worden METEEN gevuld, nog voor de
       eerste await: een deur die de belofte vergeet af te wachten, verliest dan
       de vertraging maar nooit de telling. Wacht de deur wel (en dat hoort),
       dan kost een mislukte poging op een aangevallen account twee seconden. */
    async mis(ip, login) {
      const e = emmers(ip, login);
      noteFailedTry(e.paar, ip);
      noteFailedTry(e.bron, ip, 50);
      account.gok(ip, login);
      await account.wacht(login);
    },
    gelukt(ip, login) {
      loginFails.delete(emmers(ip, login).paar);
      account.gelukt(login);   // nooit de adresemmer; zie de kop
    },
    account
  };
}

module.exports = { maakWachtwoordRem, VERTRAGING_MS };
