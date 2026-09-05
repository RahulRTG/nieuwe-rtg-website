/* De configuratiekeuring, PRODUCTIEDEEL.

   Wat hier staat blokkeert een productiestart (fouten) of wordt luid gemeld
   (waarschuwingen). De regel om te onthouden: een instelling die ontbreekt mag
   nooit STIL in een onveilige stand vallen. Bijna elke regel hier is ooit
   toegevoegd omdat precies dat gebeurde -- de demo-provider die zichzelf
   bevestigt, de webhook zonder secret die onondertekende berichten gelooft, het
   eigenaarsadres dat iedereen kon claimen.

   Afgesplitst uit ../config.js toen die de 10 KB passeerde; dit is het deel dat
   bij elke doorlichting groeit. */
'use strict';

const { keurGeld } = require('./productie-geld');
const { keurAi } = require('./productie-ai');
const { keurCommunicatie } = require('./productie-communicatie');
const { keurInvulplekken } = require('./productie-invoer');
const { keurLokaleBouwstanden } = require('./productie-lokaal');
const { keurOpslag } = require('./productie-opslag');
const { keurMotor } = require('./productie-motor');
const { keurPin } = require('./productie-pin');
const { keurIdentiteit } = require('./productie-identiteit');
const { keurMedia } = require('./productie-media');

function keur(env, fouten, waarschuwingen) {
    keurInvulplekken(env, fouten);
    const priveBeta = keurLokaleBouwstanden(env, fouten, waarschuwingen);

    // 2. Versleuteling-at-rest is een harde productievoorwaarde. Een bewuste
    //    keuze voor plaintext maakt gestolen productiegegevens niet minder
    //    leesbaar en hoort daarom geen releasepoort te kunnen omzeilen.
    if (!env.RTG_ENC_KEY)
      fouten.push('RTG_ENC_KEY ontbreekt: productiegegevens zouden onversleuteld op schijf staan. Zet een echte sleutel uit de secrets manager.');
    if (env.RTG_ENC_KEY && env.RTG_ENC_KEY.length < 16)
      fouten.push('RTG_ENC_KEY is te kort; gebruik 32+ willekeurige tekens of 64 hex-tekens.');

    /* 2b. De twee sleutels van de identiteitskluis MOETEN uit de omgeving komen.

       Zonder deze regel valt server/accounts terug op vault.key en secret.key
       IN DE DATAMAP -- dezelfde map als rtg.db. Wie die map heeft, heeft dan de
       database en de sleutel om hem te ontcijferen, en is de hele
       pseudonimisering waardeloos: codenamen worden weer namen.

       De kluis hoort te beschermen tegen een gestolen dump. Dat doet ze alleen
       als de sleutel ergens anders woont: een secrets manager, een gemounte
       sleutel, of desnoods een pad buiten het datavolume. Daarom blokkeert dit
       de start in plaats van te waarschuwen -- een waarschuwing die je kunt
       negeren beschermt niemand.

       Bij meer dan één instance is dit trouwens sowieso verplicht: elke
       instance zou anders zijn eigen sleutel maken, en dan klopt de
       e-mail-hash niet meer en kan de ene instance de gegevens van de andere
       niet lezen. */
    for (const [naam, waarvoor] of [
      ['RTG_VAULT_KEY', 'de identiteitskluis (namen, e-mail, telefoon)'],
      ['RTG_SECRET_KEY', 'de ondertekening van sessietokens']
    ]) {
      const v = String(env[naam] || '');
      if (!v)
        fouten.push(naam + ' ontbreekt: de sleutel voor ' + waarvoor + ' zou dan als bestand naast de database komen te staan. Wie de datamap steelt heeft dan ook de sleutel. Zet hem uit een secrets manager.');
      else if (v.length < 32)
        fouten.push(naam + ' is te kort; gebruik 64 hex-tekens (openssl rand -hex 32).');
    }

    // 3. Geen standaard-/zwakke geheimen laten staan.
    if (env.DEMO_PASS && env.DEMO_PASS === 'Imran')
      fouten.push('DEMO_PASS staat nog op de standaardwaarde.');
    if (env.RTG_CLUSTER_KEY && env.RTG_CLUSTER_KEY.length < 16)
      fouten.push('RTG_CLUSTER_KEY is te kort om de failover-endpoints te beschermen.');
    keurIdentiteit(env, fouten);

    // 3b. Geen grootboek, geen productie. Zie ./productie-opslag.js.
    keurOpslag(env, fouten, waarschuwingen);
    keurMotor(env, fouten, waarschuwingen);

    // 4. Herstel-, uitnodigings- en bevestigingslinks mogen in productie nooit
    //    uit een door de client aangeleverde Host-kop worden afgeleid. Zonder
    //    canoniek adres kan een vervalste Host in een gevoelige e-maillink
    //    belanden, dus dit is een startfout en geen aanbeveling.
    if (!env.APP_URL) {
      fouten.push('APP_URL ontbreekt: productie mag gevoelige links niet uit de Host-header afleiden. Zet het vaste publieke HTTPS-adres.');
    } else {
      try {
        const appUrl = new URL(String(env.APP_URL));
        if (!priveBeta && appUrl.protocol !== 'https:')
          fouten.push('APP_URL moet in publieke productie een https-adres zijn.');
        if (appUrl.username || appUrl.password || appUrl.pathname !== '/' || appUrl.search || appUrl.hash)
          fouten.push('APP_URL moet uitsluitend de domeinroot zijn, zonder credentials, pad, query of fragment.');
      } catch (e) {
        fouten.push('APP_URL is geen geldig absoluut adres.');
      }
    }
    /* RTG_VAULT_KEY en RTG_SECRET_KEY stonden hier vroeger als waarschuwing.
       Ze zijn nu blokkerende fouten (punt 2b hierboven) -- twee keer melden zou
       de lijst alleen langer maken zonder iets toe te voegen. */
    keurPin(env, fouten, waarschuwingen);
    // De database en mediabytes moeten dezelfde schaalgrens delen. Deze poort
    // gebruikt exact dezelfde S3-parser als de runtime; geen tweede, lossere
    // voorstelling van wat een geldige configuratie is.
    keurMedia(env, fouten);
    /* HIER STOND SENTRY_DSN. Niets in deze codebase leest die variabele -- het
       pakket @sentry/node is er nooit gekomen (zero dependencies) en
       server/foutmelder.js nam zijn plaats in, op ERR_WEBHOOK_URL. De
       waarschuwing stuurde de beheerder dus naar een knop die nergens op zit.
       Zie test/alarmweg.test.js en check.js regel 27. */
    /* Het alarm gaat hier sinds 3 september 2026 ook langs (TAKEN.md 7.12); dat
       staat nu in de waarschuwing. Gevaarlijker dan een lege url is een url die
       er WEL staat en wordt geweigerd: dan gooit de foutmelder hem bij het
       opstarten weg terwijl het bord "externe alarmering" toont. */
    if (!env.ERR_WEBHOOK_URL) {
      const melding = 'ERR_WEBHOOK_URL niet gezet: geen EXTERNE alarmering. De eigen fout-aggregatie op het techniekbord helpt niet als de doos plat ligt. Zet een veilige webhook en beproef hem met de zelfproef op het techniekbord.';
      if (priveBeta) waarschuwingen.push(melding);
      else fouten.push(melding);
    }
    else {
      let keur = { ok: true };
      try { keur = require('../kern/ssrf').veiligeWebhookUrl(env.ERR_WEBHOOK_URL, { intern: String(env.ERR_WEBHOOK_INTERN || '') === '1' }); }
      catch (e) { keur = { ok: false, reden: 'de keuring kon niet draaien: ' + (e && e.message) }; }
      if (!keur.ok) fouten.push('ERR_WEBHOOK_URL is gezet maar wordt geweigerd (' + keur.reden + '): server/foutmelder.js gooit hem bij het opstarten weg, dus er gaat NIETS naar buiten terwijl het techniekbord en de alarmstand doen alsof er een uitgang is.');
    }
    if (env.SENTRY_DSN && !env.ERR_WEBHOOK_URL) waarschuwingen.push('SENTRY_DSN is gezet maar wordt door niets gelezen: deze codebase heeft geen Sentry-koppeling (zero dependencies). De externe alarmering loopt via ERR_WEBHOOK_URL.');
    /* RTG_OWNER_BOOTSTRAP staat BEWUST niet in deze lijst. De eenmalige sleutel
       waarmee de eerste eigenaar zijn account claimt hoort weg zodra dat account
       bestaat -- dat is de normale eindstand. Hier waarschuwen zodra hij ontbreekt
       betekende dus: waarschuwen bij elke gezonde productiestart, en een melding
       die altijd afgaat leert iedereen hem weg te kijken. De vraag die er wél toe
       doet (bestaat dat account al?) valt hier ook niet te beantwoorden: deze
       functie kent alleen de omgeving, niet de database. Die controle staat nu in
       server.js, na load(), waar hij het antwoord echt weet. */
    /* AI is een versneller, geen afhankelijkheid. Zonder provider start RTG in
       de ingebouwde werkmodus: schermen, regels, controles en handmatige routes
       blijven beschikbaar en de UI meldt eerlijk dat vrije AI niet actief is.
       Mail is anders: een herstelbericht lokaal parkeren terwijl de gebruiker
       denkt dat het verzonden is, is geen werkbare uitwijk en blijft blokkeren. */
    keurAi(env, fouten, waarschuwingen);
    keurCommunicatie(env, fouten, waarschuwingen, priveBeta);
    // De geldkant (Stripe, munt, RTF-afdracht) staat in ./productie-geld.js
    keurGeld(env, fouten, waarschuwingen);
}

module.exports = { keur };
