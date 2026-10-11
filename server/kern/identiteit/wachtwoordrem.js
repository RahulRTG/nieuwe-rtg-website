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
   wel op het account, en daar geldt ook de vertraging. De emmernaam komt van
   hier en wordt daar niet nagebouwd: een tweede bouwer loopt uit de pas zodra
   hier iets verandert.

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

   EEN ACCOUNT, EEN SLEUTEL. De emmers van het account hangen aan het ACCOUNT
   dat findByLogin vond, en niet aan de ingetikte inlognaam. findByLogin vindt
   een account op zijn e-mailadres EN op zijn gebruikersnaam, in elke spelling;
   hing de emmer aan de tekst, dan had een account met allebei twee stellen
   emmers, en remde 25 keer mis op het e-mailadres een gok op de
   gebruikersnaam niet (I1 uit de keuring van ronde 6, ook bij de eigenaar en
   bij Nora). Elke deur zoekt dus EERST het account op en geeft het mee, ook als
   het er niet is (null). Alleen bij een onbekende naam hangt de emmer aan de
   genormaliseerde tekst. Vergeet een deur het mee te geven, dan gooit de rem
   een fout in plaats van stil terug te vallen op de tekst.

   GEEN E-MAILADRES EN GEEN ID IN KLARE TEKST in een emmernaam, alleen een
   vingerafdruk: over de id als het account bestaat, anders over de tekst. Een
   emmer die dichtgaat, meldt zijn naam als bron van een beveiligingsmelding
   (noteFailedTry in ../../server.js), en die melding wordt bewaard; het
   vergeten van een account (../vergeten.js) raakt haar niet. Een e-mailadres
   hoort niet in een spoor, net zo min als een echte naam naast een codenaam.
   test/werkplek-rem.test.js zoekt het in de datamap. Een vingerafdruk is
   PSEUDONIEM en geen anonimisering: hij is ongezouten, en een id is een klein
   getal, dus wie het journaal leest kan de id terugrekenen en ook zien of een
   naam bij een bestaand account hoorde. Het journaal is daarom kantoordata,
   geen publiek spoor. Het ANTWOORD aan de aanroeper verraadt het bestaan niet:
   status en tekst zijn bij een onbekende naam dezelfde (alleen de duur kan
   verschillen; dat staat apart).

   DE NOODREM. Elke emmer die dichtgaat meldt zich via noteFailedTry als brute
   force, met het adres als aanvaller (../../server.js). Hier geen eigen soort:
   wie hier gokt, kent het wachtwoord niet, en dat is precies wat de noodrem moet
   zien (anders dan bij de tweede stap, N4). Bij de adresemmer en die van adres
   plus account is dat adres ook de gokker. Bij de accountemmer is het het adres
   van wie de 25e misser doet, en dat kan de eigenaar van het account zelf zijn
   die zich vertypt; dan staat zijn adres in quarantaine. Dat is zo gelaten: de
   rem kan aan een misser niet zien van wie hij komt.

   EEN GESLAAGDE INLOG LEEGT ALLEEN WAT OVER DIT ACCOUNT GAAT: de emmer van adres
   plus account en die van het account. Nooit die van het adres. Een geslaagde
   inlog bewijst iets over dat ene account en niets over wie er verder vanaf dat
   adres klopt. Leegde hij ook de adresemmer, dan zette een aanvaller met een
   eigen account de grens van 50 per adres terug wanneer hij wilde, en gokte hij
   vanaf een adres onbeperkt op de accounts van anderen. Dat is de les van N4
   (./tweedestap-rem.js); de adresemmer loopt vanzelf af (../../opzet/onderhoud.js).
   De aanmelding van personeel houdt zich met haar eigen adresemmer aan dezelfde
   regel (I7).

   Tellers in `loginFails`, lopende pogingen in ./lopend.js (N39). Prijs op een
   gedeeld adres: ook een juiste inlog bezet even een plek, dus na veel
   tikfouten kan een golf juiste inlogs een losse 429 krijgen (geen slot).
   Elke deur bouwt haar eigen exemplaar uit de drie bestaande kernfuncties, en
   twee exemplaren zien dus dezelfde emmers. Geen nieuwe naam in de kern. */
'use strict';
const crypto = require('crypto');

const lopend = require('./lopend');   // N39: een poging telt vanaf dicht()
const VERTRAGING_MS = 2000;
const TE_VEEL = 'Te veel pogingen. Probeer het over een paar minuten opnieuw.';
const vingerafdruk = waarde => crypto.createHash('sha256').update(String(waarde || '')).digest('hex').slice(0, 24);
/* De sleutel van het account; zie EEN ACCOUNT, EEN SLEUTEL in de kop. `lid` is
   wat findByLogin gaf: een account, of null bij een onbekende naam. Alleen dan
   telt de tekst, in kleine letters en zonder witruimte eromheen, want zo zoekt
   findByLogin ook. */
function accountSleutel(login, lid) {
  if (lid === undefined) throw new Error('wachtwoordrem: geef het account van findByLogin mee (null als er geen is)');
  if (lid && lid.id != null) return vingerafdruk('id:' + lid.id);
  return vingerafdruk('account:' + String(login || '').toLowerCase().trim());
}

function maakWachtwoordRem({ tooManyTries, noteFailedTry, loginFails }) {
  const emmers = (ip, login, lid) => {
    const account = accountSleutel(login, lid);
    return { paar: 'auth:' + ip + ':' + account, bron: 'auth:bron:' + ip,
      doel: 'auth:doel:' + account };
  };
  const doelVan = (login, lid) => emmers('', login, lid).doel;
  /* DE ACCOUNTEMMER LOS, voor een deur die haar adres zelf remt (de aanmelding
     van personeel, zie de kop). mis() en gelukt() hieronder lopen hier ook
     langs, zodat naam, grens en wachttijd op een plek staan. */
  const account = {
    gok(ip, login, lid) { noteFailedTry(doelVan(login, lid), ip, 25); },
    /* Wacht zolang het account onder vuur ligt. Een deur mag dit bij ELKE
       weigering aanroepen en niet alleen bij een fout wachtwoord: anders verraadt
       een snel antwoord dat het wachtwoord klopte (N29). */
    async wacht(login, lid) {
      const doel = loginFails.get(doelVan(login, lid));
      if (doel && doel.until > Date.now()) await new Promise(r => setTimeout(r, VERTRAGING_MS));
    },
    gelukt(login, lid) { loginFails.delete(doelVan(login, lid)); }
  };
  return {
    /* true als de emmer van adres plus account of die van het adres dicht is;
       dan is het 429-antwoord al gestuurd. De accountemmer remt hier niet. */
    dicht(res, ip, login, lid) {
      const e = emmers(ip, login, lid);
      if (tooManyTries(res, e.paar) || tooManyTries(res, e.bron)) return true;
      // N39: wat al loopt telt mee, anders gaat een golf tegelijk langs de grens
      const vol = (k, grens) => ((loginFails.get(k) || {}).n || 0) + lopend.aantal(k) >= grens;
      if (vol(e.paar, 10) || vol(e.bron, 50)) { res.status(429).json({ error: TE_VEEL }); return true; }
      lopend.neem(e.paar); lopend.neem(e.bron);
      return false;
    },
    /* Een mislukte poging. Het tellen gebeurt synchroon, voordat mis() zijn
       belofte teruggeeft; alleen het wachten daarna is asynchroon. Een deur die
       de belofte vergeet af te wachten, verliest dus de vertraging maar nooit
       de telling. Gelijktijdige verzoeken houdt dicht() tegen (./lopend.js). */
    async mis(ip, login, lid) {
      const e = emmers(ip, login, lid);
      lopend.geef(e.paar); lopend.geef(e.bron);
      noteFailedTry(e.paar, ip);
      noteFailedTry(e.bron, ip, 50);
      account.gok(ip, login, lid);
      await account.wacht(login, lid);
    },
    gelukt(ip, login, lid) {
      const e = emmers(ip, login, lid);
      lopend.geef(e.paar); lopend.geef(e.bron);
      loginFails.delete(e.paar);
      account.gelukt(login, lid);   // nooit de adresemmer; zie de kop
    },
    account
  };
}

module.exports = { maakWachtwoordRem, VERTRAGING_MS };
