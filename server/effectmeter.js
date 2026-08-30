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
   ========================================================================== */
'use strict';

const { AsyncLocalStorage } = require('async_hooks');

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
   niet te onderscheiden zijn, en dat is precies het onderscheid dat hier telt. */
function perVerzoek(fn) {
  if (!aan) return fn();
  const teller = { opslag: 0, mail: 0, sms: 0 };
  return winkel.run(teller, () => fn(teller));
}

/* Tellen. Buiten een verzoek (een achtergrondlus, het opstarten) is er geen
   context en gebeurt er niets -- die schrijfacties horen ook bij niemand. */
function tel(soort, hoeveel) {
  if (!aan) return;
  const t = winkel.getStore();
  if (!t || !Object.prototype.hasOwnProperty.call(t, soort)) return;
  t[soort] += (hoeveel == null ? 1 : Number(hoeveel)) || 0;
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
  if (!aan || !app || typeof app.use !== 'function') return false;
  app.use((req, res, next) => {
    perVerzoek((teller) => {
      /* AAN res.end EN NIET AAN res.json.

         Hij hing eerst aan res.json, zoals de opslagmeter. Dat is de gangbare
         uitgang maar niet de enige: 282 routes die de kale ronde met 200
         beantwoordde droegen geen kop, want zij antwoorden via res.send, een
         redirect of een bestand -- en die gaan in server/web/verrijk.js niet
         langs res.json. Gemeten, niet bedacht: het contractregister moest die
         282 als ONGEMETEN afwijzen terwijl de meter gewoon had geteld.

         res.end is de ene uitgang waar alle andere doorheen lopen (res.json
         roept hem aan, res.send ook, een redirect ook). Vandaar hier. */
      const echt = res.end;
      res.end = function (...args) {
        try {
          if (!res.headersSent) {
            /* De teller van DIT verzoek, meegegeven en niet opgevraagd. Een
               antwoord dat uit een andere context wordt verstuurd (een
               afgehandelde wachtrij, een foutafhandelaar hogerop) zou anders de
               stand van een ander verzoek dragen, of geen. */
            res.setHeader('X-RTG-Effect', stand(teller));
            res.setHeader('X-RTG-Effect-Niet-Gemeten', NIET_GEMETEN.join(','));
          }
        } catch (e) { /* een kop die niet meer kan, mag het antwoord niet breken */ }
        return echt.apply(this, args);
      };
      next();
    });
  });
  return true;
}

function begin(vlag) {
  aan = String(vlag || '') === '1' || String(vlag || '') === '2';
  return aan;
}

begin(process.env.RTG_STAATLOG);

module.exports = { haak, tel, stand, begin, perVerzoek, SOORTEN, NIET_GEMETEN,
  get aan() { return aan; } };
