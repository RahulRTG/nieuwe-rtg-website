/* DE REM OP EEN WACHTWOORD -- een plek voor elke deur die er een toetst.

   Twee deuren toetsen een RTG-wachtwoord om er een sessie voor te geven: de
   gewone inlog (/api/auth/login) en de werkplekinlog van een lid
   (/api/supplier/mijn/login). De rem stond alleen in de eerste. De tweede telde
   alleen per ADRES, dus dertig foute wachtwoorden op een account vanaf dertig
   adressen werden nergens geremd (N28 van de V1-audit, eindkeuring ronde 5), en
   wat daar gegokt werd, telde bij de gewone inlog niet mee. Een deur met eigen
   emmers geeft per deur opnieuw tien gokken; dat is dezelfde les als de rem op
   de tweede factor (./tweedestap-rem.js, RTG-V1-RELEASE C3). Beide deuren delen
   daarom DEZE emmers, op dezelfde namen: wat op de een gegokt wordt, telt ook
   op de ander.

   DRIE EMMERS, uit routes/auth/inlog.js hierheen gehaald, met dezelfde grenzen:
     - adres plus account (10). Raakt alleen de aanvaller, en daarna 429;
     - het adres alleen (50). Kan een kantoor achter een NAT-adres treffen, dus
       ruim, en ook daarna 429;
     - het account alleen (25), en die geeft GEEN slot maar een VERTRAGING van
       twee seconden op elke mislukte poging. Een slot op het account geeft een
       vreemde de macht om een lid uit zijn eigen account te houden. Wie het
       wachtwoord weet, komt dus zonder wachten binnen (test/inlogrem.test.js).
   Het account staat gehasht in de emmernaam, zodat een e-mailadres nooit in het
   geheugen van de rem of in een beveiligingsmelding belandt.

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

function maakWachtwoordRem({ tooManyTries, noteFailedTry, loginFails }) {
  const emmers = (ip, login) => {
    const sleutel = String(login || '').toLowerCase().trim();
    return { paar: 'auth:' + ip + ':' + sleutel.slice(0, 60), bron: 'auth:bron:' + ip,
      doel: 'auth:doel:' + vingerafdruk('account:' + sleutel) };
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
      noteFailedTry(e.doel, ip, 25);
      const doel = loginFails.get(e.doel);
      if (doel && doel.until > Date.now()) await new Promise(r => setTimeout(r, VERTRAGING_MS));
    },
    gelukt(ip, login) {
      const e = emmers(ip, login);
      loginFails.delete(e.paar);
      loginFails.delete(e.doel);   // nooit e.bron; zie de kop
    }
  };
}

module.exports = { maakWachtwoordRem, VERTRAGING_MS };
