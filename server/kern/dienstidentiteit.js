/* DIENSTEN EN TOESTELLEN MET EEN EIGEN IDENTITEIT -- AUTHORITY.md fase 7.

   De meting (23 september 2026): de achtergrondtaken die gegevens schrijven,
   deden dat zonder actor (de bus-envelop gaf `null`) of met een los woord als
   'automaat' of 'systeem'; een gekoppeld toestel schreef met een eigen sleutel,
   maar kwam op de bus niet voor. Dat is "het systeem" als alibi: achteraf is niet
   te zien WELKE dienst iets deed.

   De vorm is die van de AI-agent (./agentteken.js): een VOORVOEGSEL in de actor
   van de bus-envelop, `dienst:<naam>` en `toestel:<id>`, zoals `ai:rahul`. Geen
   nieuwe soort in de verzoek-envelop en geen nieuwe rol: een identiteit zegt WIE
   er handelt, en verleent niets. Alles wat binnen `alsDienst` gebeurt draagt die
   actor, ook de gebeurtenissen die het werk verderop veroorzaakt (de keten van
   kern/envelop.js).

   EEN GESLOTEN LIJST. Een dienst die hier niet staat, bestaat niet: `alsDienst`
   gooit, en test/dienstidentiteit.test.js zakt zodra een verklaarde dienst
   nergens wordt gebruikt. Een vrij tekstveld zou binnen een jaar 'automaat',
   'Automaat' en 'auto' bevatten. */
'use strict';

const envelop = require('./envelop');

const DIENSTEN = Object.freeze({
  bewaarveger: 'wist dossiers en posities na hun bewaartermijn (AVG)',
  'webmaker-plan': 'publiceert sites op het geplande moment',
  prplus: 'zet geplande campagneposts live',
  'payroll-bijwerken': 'werkt de loonadministratie bij met nieuwe regelpakketten',
  zelfzorg: 'de automatische zelfherstelronde',
  rtgai: 'traint het eigen taalmodel op de ingestuurde voorbeelden',
  'agenda-ics': 'haalt gekoppelde agenda-abonnementen op'
});

const actorVan = (naam) => 'dienst:' + naam;

/* Een apparaat-id is geen contactgegeven, maar kern/envelop.js weigert terecht
   elke actor met acht of meer cijfers op rij (een telefoonnummer of een BSN). Een
   toestel-id van acht hex-tekens is soms alleen cijfers, en dan gaf de meting
   500 -- ongeveer een op de veertig toestellen. Een reeks cijfers wordt daarom na
   elke vier tekens met een dubbelepunt gebroken: '12345678' wordt '1234:5678'. De
   grens van de envelop blijft zoals hij is. */
const zonderCijferreeks = (id) => String(id).replace(/[\d\s.-]{4}(?=[\d\s.-])/g, m => m + ':');

/* Voer fn uit als deze dienst. Een onbekende naam is een fout in de code, geen
   randgeval: die hoort bij het opstarten of in een toets te zakken. */
function alsDienst(naam, fn) {
  if (!Object.prototype.hasOwnProperty.call(DIENSTEN, naam)) throw new Error('dienstidentiteit: onbekende dienst ' + naam);
  const e = envelop.alsStart(envelop.maak({ kanaal: 'dienst', actor: actorVan(naam), classificatie: 'intern' }));
  return envelop.inKeten(e, fn);
}

/* Een gekoppeld toestel. De id is die van het toestel en niet die van het lid:
   het lid staat in de meting zelf, en een actor die een lid noemt terwijl een
   apparaat schreef, is precies de verwarring die dit oplost. */
function alsToestel(id, fn) {
  const e = envelop.alsStart(envelop.maak({ kanaal: 'toestel', actor: 'toestel:' + zonderCijferreeks(String(id).slice(0, 48)),
    classificatie: 'persoonsgegeven' }));
  return envelop.inKeten(e, fn);
}

/* Een zaakdoos met een EIGEN sleutel (kern/zaakdoos/sleutels.js). Alleen dan: een
   doos die met de gedeelde sleutel binnenkomt noemt zichzelf, en die naam op de
   bus zetten zou een zelfopgave als identiteit verkopen. */
function alsDoos(naam, fn) {
  const e = envelop.alsStart(envelop.maak({ kanaal: 'doos', actor: 'doos:' + zonderCijferreeks(String(naam).slice(0, 40)),
    classificatie: 'intern' }));
  return envelop.inKeten(e, fn);
}

/* AANBIEDERS die ons een webhook sturen. Ook een gesloten lijst, en de identiteit
   geldt pas NA de controle van hun handtekening -- wie hem ervoor zou zetten,
   laat een onbewezen afzender als aanbieder op de bus verschijnen. */
const AANBIEDERS = Object.freeze({
  stripe: 'kaartbetalingen en uitbetalingen',
  mollie: 'betalingen; het bericht zelf is geen bewijs, RTG haalt de betaling opnieuw op',
  adyen: 'betalingen, met een HMAC per melding',
  munt: 'de munt-aanbieder die ontvangst en omzetting bevestigt',
  storingen: 'de foutmeldingen van de eigen installaties'
});
/* Voer fn uit als deze aanbieder. Een lege naam (een webhook zonder bewezen
   aanbieder, zoals de demo-afzender) draait gewoon zonder actor. Bewust GEEN
   AsyncLocalStorage.enterWith: dat zet de identiteit op de hele asynchrone
   context van de aanroeper, en de toets vond dat hij daarmee in een naastgelegen
   keten opdook. Het werk na de handtekening gaat hier dus als functie in. */
function alsAanbieder(naam, fn) {
  if (!naam) return fn();
  if (!Object.prototype.hasOwnProperty.call(AANBIEDERS, naam)) throw new Error('dienstidentiteit: onbekende aanbieder ' + naam);
  const e = envelop.alsStart(envelop.maak({ kanaal: 'webhook', actor: 'aanbieder:' + naam, classificatie: 'intern' }));
  return envelop.inKeten(e, fn);
}

module.exports = { DIENSTEN, AANBIEDERS, alsDienst, alsToestel, alsDoos, alsAanbieder, actorVan };
