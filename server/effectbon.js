/* DE EFFECTBON -- wat heeft DIT verzoek waarneembaar veroorzaakt, altijd aan.

   WAAROM HIJ ALTIJD AAN STAAT, en dat is de dragende keuze. De effectmeter en de
   opslagmeter hangen aan RTG_STAATLOG, en dat is juist voor wat zij doen: zware
   diagnostiek hoort in een proef. Maar als de OBSERVATIE alleen bestaat wanneer een
   diagnostische vlag aanstaat, dan heeft dit huis geen causale runtime -- dan heeft het
   een meetopstelling. Een voorspelling die nooit tegen de werkelijkheid wordt gehouden,
   is een bewering die nooit kan zakken.

   WAT ER DUS ALTIJD IS, en met opzet niet meer dan dit:

     verzoek      de correlatie van req.envelop (dat is req.id; GEEN tweede id)
     oorzaak      waardoor dit verzoek ontstond, als iets dat meegaf
     capability   welk begrensd recht, uit dezelfde envelop
     klassen      de WAARGENOMEN effectklassen, uit kern/isolatie/effectcollecties.js
     objectrefs   de COLLECTIES die bewogen -- namen, nooit rijen en nooit sleutels
     at           wanneer
     dekking      wat deze bon wel en niet kon zien, bij naam

   EN WAT ER NOOIT IN KOMT: geen momentopnames, geen lijven, geen payload, geen diff,
   geen codenaam, geen enkele rij-id. Een bon die de inhoud draagt is een gedragslogboek
   per lid, en dat is precies wat KOSTEN.md weigert ("de meter houdt tellers en geen
   journaal"). Een collectieNAAM zegt genoeg om een gevolg te herkennen en niets over een
   mens.

   HIJ BOUWT NIETS NA. Alle drie de bronnen bestonden:
     ./staatlog.js          `stand()` is in de ondiepe stand alleen `.length` per array,
                            O(1) per collectie, en `verschil()` zegt wat er bewoog.
     ./effectmeter.js       de tellers per verzoek (opslag, mail, sms) op choke points.
     kern/isolatie/effectcollecties.js  collectie -> effectklasse, met een grond.
   Een tweede implementatie van een van die drie zou LAT.md regel 4 zijn op de plek waar
   het het duurst is: twee lezers van "wat is er gebeurd".

   EN DE DIEPTE VOLGT DE VLAG. `staatlog.stand()` is dieper zodra RTG_STAATLOG=2 staat:
   dan ziet hij ook een wijziging op zijn plaats en objectcollecties. Deze bon wordt
   daardoor automatisch scherper zonder een tweede stand te kennen -- de vlag VERDIEPT en
   schakelt niet aan. Wat hij in de ondiepe stand niet kan zien, staat in `dekking.blind`.

   DE KOSTEN ZIJN NIET GEMETEN OP DE LATMACHINE, en dat staat hier in plaats van een nul.
   De ondiepe stand is O(1) per collectie en wordt twee keer per verzoek gelezen; op een
   geseede proefdatabase meet staatlog zijn DIEPE stand op 0,29 ms, dus de ondiepe is een
   fractie daarvan. Maar de p99-lat in NORM.json is op een andere machine gezet en staat
   op NIET VERGELEKEN, dus "geen regressie" is hier niet te beweren. `RTG_EFFECTBON=0`
   zet hem uit, en dat is er voor het geval dat en niet als normale stand. */
'use strict';

const staatlog = require('./staatlog');
const effectmeter = require('./effectmeter');
const effectcollecties = require('./kern/isolatie/effectcollecties');
const { nameet } = require('./kern/stuur/gevolgcontract/nameting');

/* DE VOORSPELLER WORDT ERIN GEHANGEN EN NIET OPGEHAALD. Deze laag mag kern LEZEN, maar
   zij hoort niet te weten dat er een geldketen bestaat -- en kern hoort niets naar de
   serverlaag te duwen. server/opzet/ kent beide en geeft hier een zuiver lezende functie
   mee (`verzoek -> voorspelde klassen of null`), zelfde vorm als de frictiemotor die lui
   aan de geldketen wordt meegegeven. Hangt er niets in, dan draagt de bon geen nameting
   en dat is geen fout: dan heeft niemand iets voorspeld om tegen te houden. */
let voorspeller = null;
function zetVoorspeller(fn) { voorspeller = typeof fn === 'function' ? fn : null; return !!voorspeller; }

/* UIT is hier een UITZONDERING en niet de standaard -- omgekeerd aan RTG_STAATLOG. */
let aan = String(process.env.RTG_EFFECTBON || '') !== '0';

/* WAT DEZE BON NIET KAN ZIEN, bij naam en per stand. Een bon zonder dit veld laat
   "niet waargenomen" lezen als "niet gebeurd", en dat is exact de fout die de hele laag
   moet uitsluiten. De eerste twee verdwijnen zodra RTG_STAATLOG=2 staat; de laatste twee
   zijn van de effectmeter en verdwijnen nooit vanzelf. */
const BLIND_ONDIEP = Object.freeze(['wijziging-zonder-lengteverschil', 'objectcollecties']);
const BLIND_ALTIJD = Object.freeze(effectmeter.NIET_GEMETEN.slice());

/* De bonnen van de laatste verzoeken, begrensd. GEEN collectie in de database: een bon
   die blijft staan is een journaal, en daarvoor is dit niet gebouwd. Wie hem wil bewaren,
   neemt dat besluit apart en met een bewaartermijn. */
const RING = [];
const RING_MAX = 200;

function bewaar(bon) {
  RING.push(bon);
  while (RING.length > RING_MAX) RING.shift();
  return bon;
}

/* De klassen en de collecties die bewogen. `verschil()` geeft per collectie een getal of
   'gewijzigd'; welke van de twee doet hier niet toe -- de vraag is of zij bewoog. */
function uitVerschil(voor, na) {
  const verschil = staatlog.verschil(voor, na);
  const klassen = new Set();
  const refs = [];
  let zonderIndeling = 0;
  for (const naam of Object.keys(verschil || {})) {
    const rij = effectcollecties.effectVan(naam);
    if (rij) { klassen.add(rij.effect); refs.push(naam); } else { zonderIndeling++; }
  }
  return { klassen: [...klassen].sort(), refs: refs.sort(), zonderIndeling };
}

/* De bon van EEN verzoek. `teller` komt van de effectmeter en wordt meegegeven en niet
   opgevraagd: een antwoord dat uit een andere context wordt verstuurd zou anders de stand
   van een ander verzoek dragen. */
function maak({ envelop, voor, na, teller }) {
  const e = envelop || {};
  const ctx = e.context || {};
  const { klassen, refs, zonderIndeling } = uitVerschil(voor, na);
  const t = teller || {};

  /* De twee choke points buiten de opslag. Zij dragen dezelfde klasse en dat is geen
     versimpeling: mail en sms bereiken allebei een tweede persoon buiten RTG, en dat IS
     het effect (kern/isolatie/effectwoorden.js). */
  if (t.mail || t.sms) klassen.push('EXTERN_BEREIKEN');
  const schreef = !!t.opslag;

  /* DE NAMETING HOORT BIJ DE BON EN NIET ERNAAST, want zij gaat over precies dit verzoek
     en deze observatie. Is er niets voorspeld, dan staat er niets -- een leeg
     nametingveld zou lezen als "vier keer niets gevonden". */
  const voorspeld = voorspeller ? voorspeller(e.correlatie || null) : null;

  const bon = {
    verzoek: e.correlatie || null,
    oorzaak: e.oorzaak || null,
    capability: e.capability || (ctx.methode && ctx.pad ? ctx.methode + ' ' + ctx.pad : null),
    at: new Date().toISOString(),
    klassen: Object.freeze([...new Set(klassen)].sort()),
    objectrefs: Object.freeze(refs),
    dekking: Object.freeze({
      /* WAARGENOMEN EN NIET-WAARGENOMEN ZIJN TWEE VELDEN EN GEEN EEN. `schreef` zegt dat
         de opslag is aangeroepen; `klassen` zegt wat daarvan te herkennen was. Schreef
         hij wel en zijn er geen klassen, dan bewoog er iets dat niemand heeft ingedeeld
         -- en dat is iets anders dan "er gebeurde niets". */
      schreefOpslag: schreef,
      collectiesZonderIndeling: zonderIndeling,
      diep: staatlog.diep === true,
      blind: Object.freeze((staatlog.diep === true ? [] : BLIND_ONDIEP).concat(BLIND_ALTIJD))
    })
  };
  if (Array.isArray(voorspeld)) bon.nameting = nameet(voorspeld, bon);
  return Object.freeze(bon);
}

/* De middleware. Hij hangt NAAST de effectmeter en niet erin: die telt, deze stelt vast.
   De stand voor het verzoek wordt genomen voordat de route draait, de stand erna in
   res.end -- dezelfde uitgang als de effectmeter gebruikt, en om dezelfde reden (res.json
   is niet de enige weg naar buiten). */
function haak(app) {
  if (!aan || !app || typeof app.use !== 'function') return false;
  app.use((req, res, next) => {
    /* DE TELLERCONTEXT WORDT HIER GEZET, want deze schil staat altijd aan en die van de
       effectmeter niet. Nesten is geen probleem: perVerzoek hergebruikt een bestaande
       teller in plaats van er een tweede bovenop te zetten. */
    effectmeter.perVerzoek((teller) => {
      const voor = staatlog.stand();
      const echt = res.end;
      res.end = function (...args) {
        try {
          const bon = bewaar(maak({ envelop: req && req.envelop, voor, na: staatlog.stand(), teller }));
          /* De kop draagt de KLASSEN en niet de bon: een bon in een header is een payload,
             en de klassen zijn wat een lezer buiten dit proces nodig heeft. Leeg blijft
             leeg -- `geen` zou een meting suggereren waar er geen was. */
          if (!res.headersSent)
            res.setHeader('X-RTG-Effectbon', bon.klassen.length ? bon.klassen.join(',') : 'geen-klasse');
          require('./kern/agentteken').meld(req, res); // A5: een agent zegt wie hij is
        } catch (e) { /* een bon die niet kan, mag het antwoord niet breken */ }
        return echt.apply(this, args);
      };
      next();
    });
  });
  return true;
}

function bonnen({ limit = 50 } = {}) {
  const n = Math.min(RING_MAX, Math.max(1, Number(limit) || 50));
  return RING.slice(-n);
}
function laatste(verzoek) {
  for (let i = RING.length - 1; i >= 0; i--) if (RING[i].verzoek === verzoek) return RING[i];
  return null;
}

module.exports = { haak, maak, bonnen, laatste, zetVoorspeller, BLIND_ONDIEP, BLIND_ALTIJD, RING_MAX,
  get aan() { return aan; } };
