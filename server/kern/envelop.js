/* DE EVENTENVELOP: de taal waarin dit huis over gebeurtenissen praat.

   WAAROM DIT BESTAAT. OS.md par. 3 mat het zo op: *de bus vervoert, er is geen
   taal.* server/bus.js levert een bericht netjes af -- in proces of over Redis
   -- maar wat er in dat bericht staat, verzint elke publicerende plek zelf. Van
   de zeven plekken die zelf een bericht samenstellen (scripts/envelop.js telt
   ze) droeg er één een `versie`, één een `id`, en geen enkele iets waarmee je
   twee gebeurtenissen aan elkaar kunt knopen. Bij een
   incident is dat het verschil tussen "er ging iets mis" en "dit verzoek raakte
   deze zaak en veroorzaakte die drie meldingen".

   ACHT VELDEN, EN GEEN NEGENDE. De envelop is met opzet gesloten: hij zegt
   WIE, WANNEER, WAARDOOR en HOE GEVOELIG, en nooit WAT. Zodra er inhoud in een
   envelop mag, wordt hij binnen een jaar een tweede berichtformaat.

     id             deze gebeurtenis, een keer
     at             wanneer, in ISO
     versie         het formaat van deze envelop
     kanaal         waarover hij ging
     actor          WIE het veroorzaakte -- een codenaam, nooit een echte naam
     correlatie     de hele keten waar dit bij hoort
     oorzaak        de gebeurtenis die deze direct veroorzaakte
     classificatie  hoe gevoelig de inhoud is (gesloten lijst)

   DE ACTOR IS EEN CODENAAM. Dat is geen stijlafspraak maar de kern van de
   privacyopzet van dit huis: klantdata draait op codenamen en echte namen wonen
   in de gescheiden identiteitskluis. Een envelop die over de bus gaat -- en met
   REDIS_URL dus over een netwerk en door een geheugendatabase -- is precies de
   plek waar een echte naam ongemerkt naar buiten lekt. maak() weigert daarom
   een actor die eruitziet als een contactgegeven. Dat is een grove zeef en geen
   garantie; hij vangt de fout die iemand per ongeluk maakt (`req.body.email`
   doorgeven), niet iemand die het expres wil.

   ONBEKEND IS EEN UITSLAG. Wie niets over de gevoeligheid zegt, krijgt
   `onbekend` en niet `openbaar`. Dat is dezelfde regel als `niet gemeten` in de
   dienstmeting en `niet vast te stellen` in BESTUUR.md: een leeg vakje mag nooit
   de geruststellende waarde krijgen. scripts/envelop.js telt hoeveel er zo de
   bus over gaan, zodat het getal zichtbaar is in plaats van weggewerkt.

   DE KETEN LOOPT VANZELF DOOR. Wie binnen de afhandeling van een gebeurtenis
   opnieuw publiceert, krijgt automatisch dezelfde `correlatie` en als `oorzaak`
   de gebeurtenis die hij aan het afhandelen is. Dat gaat via AsyncLocalStorage,
   net zoals server/db/bijeen.js dat al doet voor de schrijfronde. Zonder die
   automatiek moet elke publicerende plek de keten met de hand doorgeven, en dan
   is hij binnen een maand op de helft van de plekken vergeten. */
'use strict';
const { AsyncLocalStorage } = require('async_hooks');
const crypto = require('crypto');
/* De tijd komt van de huisklok en niet van het OS. Dat is hier geen detail: een
   envelop is de enige tijdstempel die een gebeurtenis draagt, en met `new Date()`
   trekt hij zich van RTG_KLOK niets aan. Dan is geen enkele beproeving op
   schrikkeldag, zomertijd of een verlopen mandaat te doen OVER de bus -- terwijl
   dat precies de plek is waar zulke fouten zich verstoppen. scripts/klok.js
   telde deze regel dan ook als schuld. */
const { datum } = require('../lib/klok');

const VERSIE = 1;

/* De gesloten lijst. Wie een zesde gevoeligheid nodig heeft, voegt hem HIER
   toe en nergens anders -- een vrij tekstveld levert "gevoelig-ish" op, en dat
   is niet te tellen, niet te filteren en niet te verantwoorden. */
const CLASSIFICATIES = {
  openbaar: 'mag iedereen zien',
  intern: 'binnen RTG, niet naar buiten',
  persoonsgegeven: 'gaat over een herleidbaar mens -- een codenaam telt mee',
  bijzonder: 'gezondheid, geloof, biometrie; AVG artikel 9',
  onbekend: 'niemand heeft het gezegd, en dat is geen synoniem voor openbaar'
};

const keten = new AsyncLocalStorage();

/* Een contactgegeven verkleed als actor. `@` vangt het e-mailadres, de lange
   cijferreeks een telefoonnummer of een BSN. Bewust geen naamdetectie: een
   codenaam mag "Reiziger Zeven" heten, en een zeef die daarop aanslaat wordt
   binnen een week uitgezet. */
const CONTACTGEGEVEN = /@|\+?\d[\d\s.-]{7,}/;

const nieuwId = () => (crypto.randomUUID ? crypto.randomUUID()
  : crypto.randomBytes(16).toString('hex'));

/* De actor nakijken. Gooit, want een echte naam op de bus is geen randgeval dat
   je afrondt maar een fout die in een toets hoort te zakken. De bus vangt hem
   op en laat de gebeurtenis dan ZONDER actor door (met een waarschuwing), want
   een realtime-melding mag geen verzoek omgooien. */
function keurActor(actor) {
  if (actor == null) return null;
  if (typeof actor !== 'string') throw new TypeError('envelop: actor is een codenaam (tekst), geen ' + typeof actor);
  const a = actor.trim();
  if (!a) return null;
  if (a.length > 64) throw new Error('envelop: actor is te lang voor een codenaam (' + a.length + ')');
  if (CONTACTGEGEVEN.test(a)) throw new Error('envelop: actor lijkt een contactgegeven; op de bus hoort een codenaam');
  return a;
}

/* De envelop van de gebeurtenis die op DIT moment wordt afgehandeld. */
const huidige = () => keten.getStore() || null;

/* Een envelop maken. Alles is optioneel behalve het kanaal: wat er niet gezegd
   is, wordt niet verzonnen. */
function maak(opgave) {
  const o = opgave || {};
  const ouder = huidige();
  const classificatie = CLASSIFICATIES[o.classificatie] ? o.classificatie : 'onbekend';
  return Object.freeze({
    id: o.id || nieuwId(),
    at: o.at || datum().toISOString(),
    versie: VERSIE,
    kanaal: o.kanaal || null,
    actor: keurActor(o.actor != null ? o.actor : (ouder ? ouder.actor : null)),
    /* De keten: zonder ouder is deze gebeurtenis zelf het begin. */
    correlatie: o.correlatie || (ouder ? ouder.correlatie : null) || null,
    oorzaak: o.oorzaak || (ouder ? ouder.id : null) || null,
    classificatie
  });
}

/* Alles wat binnen fn gebeurt, hoort bij deze envelop. */
function inKeten(envelop, fn) {
  if (!envelop) return fn();
  return keten.run(envelop, fn);
}

/* De correlatie invullen als hij nog leeg is: de eerste gebeurtenis van een
   keten IS zijn eigen correlatie. Apart gehouden van maak(), omdat maak() geen
   idee heeft of hij de eerste is -- dat weet alleen wie hem verstuurt. */
function alsStart(envelop) {
  if (!envelop || envelop.correlatie) return envelop;
  return Object.freeze(Object.assign({}, envelop, { correlatie: envelop.id }));
}

module.exports = { VERSIE, CLASSIFICATIES, maak, huidige, inKeten, alsStart, keurActor };
