/* ============================================================================
   DE EFFECTMETER -- wat heeft DIT verzoek werkelijk aangeraakt?

   WAAROM HIJ ER KOMT. Het contractregister kent een stand NOT_APPLICABLE:
   "deze route verandert niets". Die eist bewijs, en het bestaande bewijs is te
   zwak. server/staatlog.js kijkt naar de COLLECTIES in de database, dus hij ziet
   een bestand niet, een verstuurde mail niet, een sms niet, en een teller buiten
   die collecties evenmin. "Geen spoor" is uit die ene meter een gevolgtrekking
   uit AFWEZIG bewijs, en daar zijn 1.194 routes op blijven staan.

   WAAROM NIET STATISCH. Dat is geprobeerd en gemeten (scripts/schrijfanalyse.js):
   met een resolver die een hop over de modulegrens gaat, ging 'ja' van 938 naar
   979 en 'onbekend' van 3441 naar 3413. Achtentwintig routes op vierenveertig-
   honderd. De reden is structureel: de routelaag krijgt zijn modules niet via
   `require` maar via een contextobject dat in server/opzet/ wordt samengesteld,
   dus een aanroep als `bank.bankOverboek()` staat nergens als afhankelijkheid.
   Soepele code, blinde statische analyse.

   DUS METEN WE HET LOPEND. Niet wat de code KAN doen, maar wat dit ene verzoek
   HEEFT gedaan.

   DRIE REGELS DIE DEZE METER EERLIJK HOUDEN:

   1. HIJ STAAT UIT. Zonder RTG_STAATLOG doet dit bestand niets: geen context,
      geen tellers, geen kop. Dezelfde vlag als de opslagmeter, want het is
      hetzelfde soort gereedschap en twee vlaggen voor een meetopstelling is er
      een te veel.

   2. HIJ TELT ALLEEN CHOKE POINTS. Een teller die op honderd plekken wordt
      aangeroepen, is een teller die op de honderdeneerste wordt vergeten. Daarom
      hangt hij op de plekken waar per definitie ALLES langskomt: save() in
      server/db/index.js (de ene schrijfweg, die daarom ook de verraadmotor
      draagt), en de twee verzendfuncties in server/mail-lokaal.js.

   3. WAT HIJ NIET TELT, STAAT HIERONDER MET NAAM. Er is geen veld dat "0"
      teruggeeft voor iets dat niet gemeten wordt -- dat is precies hoe een meter
      een geruststelling wordt. `nietGemeten` noemt ze bij naam, en het
      contractregister leest dat mee.

   WAT HIJ NIET TELT, en waarom:

     bestandsschrijfacties  Er is geen enkel choke point. Uploads gaan via
                            server/kluis.js, de outbox schrijft rechtstreeks, en
                            een handvol modules doet fs.writeFileSync zelf. Een
                            lijst van vijf plekken is er een die verouderd is
                            zodra iemand de zesde toevoegt. Wie dit wil meten,
                            maakt eerst EEN schrijfweg -- dat is een opruimklus
                            en geen meetklus.
     externe aanroepen      Betaalproviders, AI, webhooks. server/ai.js is wel
                            een choke point (de kostenmeter hangt er al aan),
                            maar de betaalrails niet. Halve dekking is hier
                            erger dan geen: hij zou bij drie van de vier routes
                            zwijgen en dat leest als "niets gebeurd".

   EN EEN GRENS DIE GEEN SOORT IS MAAR EEN VORM: een STROMEND antwoord draagt
   geen kop. Een route die zelf `res.setHeader` en `res.write` doet -- de drie
   .csv-uitvoeren, bijvoorbeeld -- heeft zijn koppen al verstuurd voordat
   `res.end` hier langskomt, dus `headersSent` staat aan en er komt niets bij.

   Dat is met opzet zo gelaten. De kop alsnog forceren kan niet (hij is weg), en
   hem eerder zetten kan ook niet: het getal is pas bekend als het verzoek klaar
   is. Wat wel kan, en wat er gebeurt: die routes komen in de proef binnen als
   ONGEMETEN in plaats van als "geen effect". Dat is precies het onderscheid
   waar deze meter voor bestaat, nu op zichzelf toegepast -- vier routes op
   4.653, en ze staan liever eerlijk ongemeten dan onterecht stil.
   ========================================================================== */
'use strict';

const { AsyncLocalStorage } = require('async_hooks');
const handeling = require('./opzet/handeling');

/* Dezelfde vlag als de opslagmeter (server/staatlog.js). Uit is de stand die je
   krijgt als je niets doet. */
let aan = false;

/* De soorten die deze meter WEL telt. Elke naam hier is een choke point met een
   adres; wie er een toevoegt, voegt eerst dat adres toe. */
const SOORTEN = ['opslag', 'mail', 'sms'];

/* En wat hij niet telt, bij naam. Het contractregister leest dit veld: een
   NOT_APPLICABLE die op deze meter leunt, moet weten waarover hij zwijgt. */
const NIET_GEMETEN = ['bestand', 'externe-aanroep'];

const winkel = new AsyncLocalStorage();

/* Eén teller per verzoek. Geen globale optelling: die zou van achtergrondwerk
   niet te onderscheiden zijn, en dat is precies het onderscheid dat hier telt.

   HET TELLEN STAAT ALTIJD AAN SINDS 13 SEPTEMBER 2026, en dat is een besluit met een
   reden. Alleen de KOPPEN en de zware opslagmeter hangen nog aan RTG_STAATLOG; de tellers
   zelf zijn de observatie waar ./effectbon.js op staat, en een observatie die alleen
   bestaat als een diagnostische vlag aanstaat, maakt van een causale runtime een
   meetopstelling. Wat het kost is een object per verzoek en een Map-opzoeking per save;
   wat het oplevert is dat "niet waargenomen" in productie iets betekent.

   EN HIJ NEST NIET. Bestaat er al een teller in deze async-context, dan wordt DIE
   gebruikt in plaats van een tweede erbovenop gezet. Zonder die regel zou een tweede
   aanroeper (de effectbon hangt zijn schil eromheen) een eigen teller krijgen, `tel()`
   in de binnenste schrijven en de buitenste op nul laten staan -- twee lezers van
   dezelfde waarheid die verschillende getallen zien, en de bon zou dan melden dat er
   geen mail uitging. */
function perVerzoek(fn) {
  const bestaand = winkel.getStore();
  if (bestaand) return fn(bestaand);
  const teller = { opslag: 0, mail: 0, sms: 0, collecties: new Set(), collectieDekking: 'proxy-v1' };
  return winkel.run(teller, () => fn(teller));
}

/* Tellen. Buiten een verzoek (een achtergrondlus, het opstarten) is er geen
   context en gebeurt er niets -- die schrijfacties horen ook bij niemand. */
function tel(soort, hoeveel) {
  const t = winkel.getStore();
  if (!t || !Object.prototype.hasOwnProperty.call(t, soort)) return;
  /* Na afloop is de kop al weg: tellen zou een teller ophogen die niemand meer
     leest. Dat wordt zichtbaar geteld in opzet/handeling.js (I5). */
  if (handeling.afgelopen()) { handeling.naAfloopMeld('effectmeter', soort); return false; }
  t[soort] += (hoeveel == null ? 1 : Number(hoeveel)) || 0;
  return true;
}

/* De teller van DIT verzoek, of null. Voor wie de stand niet als tekst wil maar als
   getallen -- ./effectbon.js leest hem zo, en bouwt er geen tweede naast. */
function huidig() { return winkel.getStore() || null; }

/* De opslagtracker meldt uitsluitend de top-level collectienaam. Geen rij,
   sleutel of waarde komt hier binnen. Daardoor kan de effectbon exact zeggen
   WELKE soort toestand bewoog zonder twee volledige wereldscans per verzoek. */
function wijziging(feit) {
  const t = winkel.getStore();
  if (!t || !t.collecties || !feit || typeof feit.collectie !== 'string') return false;
  t.collecties.add(feit.collectie); return true;
}

/* De stand van dit verzoek, als korte tekst voor de kop. Leeg blijft leeg: een
   kop met alleen nullen suggereert een meting waar er geen was. */
function stand(teller) {
  const t = teller || winkel.getStore();
  if (!t) return '';
  const stukken = SOORTEN.filter(s => t[s]).map(s => s + '=' + t[s]);
  return stukken.length ? stukken.join(',') : 'geen';
}

/* De middleware. Hij zet de context neer en hangt de kop aan het antwoord, net
   als staatlog dat met X-RTG-Staat doet. Twee koppen en niet een: de opslagmeter
   zegt WAT er in de database veranderde, deze zegt DAT er iets gebeurde -- en
   die twee samenvatten maakt ze allebei onleesbaar. */
function haak(app) {
  return require('./effectmeter-http').koppelEffectmeterHttp(app,
    { aan, perVerzoek, stand, nietGemeten: NIET_GEMETEN });
}

function begin(vlag) {
  aan = String(vlag || '') === '1' || String(vlag || '') === '2';
  return aan;
}

begin(process.env.RTG_STAATLOG);

/* Eén waarnemingsweg voor iedere opslagmotor: de tracker zit om db.data en deze
   teller zit om het verzoek. Registreren aan het eind voorkomt een modulekring
   tijdens het opstarten van db/state. */
try { require('./db/mutatietracker').voegWaarnemerToe(wijziging); } catch (e) {}

module.exports = { haak, tel, stand, begin, perVerzoek, huidig, wijziging, SOORTEN, NIET_GEMETEN,
  get aan() { return aan; } };
