/* DE WOORDEN VAN DE RESOLVER -- de taalkant van ./resolver.js.

   Apart bestand omdat het een ander soort ding is: hier staat wat een mens
   zegt (Nederlandse woorden, stopwoorden, scheidbare werkwoorden, en de brug
   naar het woord dat in een pad staat), en in ./resolver.js staat wat het huis
   ermee doet (wegen, sorteren, en de grens dat er nooit een pad bij komt).
   De naad kwam uit keuringsregel 13 -- het bestand ging over de 10 KB -- maar
   hij zit hier goed: wie een synoniem toevoegt, raakt de weging niet.

   ER STAAT GEEN PAD IN DIT BESTAND, en dat is de regel die het eerlijk houdt.
   Een brug mapt woord op WOORD; dat het doelwoord ook echt als segment in de
   routes voorkomt, toetst test/stuur-resolver.test.js. */
'use strict';

/* Woord dat een mens gebruikt -> woord(en) die in paden voorkomen. Alleen
   bruggen die een pad-segment NIET zelf al draagt; `agenda`, `factuur` en
   `bestel` staan er dus niet in, want die woorden staan letterlijk in de paden.

   EEN WOORD MAG MEER DAN EEN BRUG HEBBEN, en dat is geen luxe. "Boek een
   tafel" leverde eerst alleen /api/reservering/annuleer op: `tafel` bracht ons
   bij `reservering`, en het pad dat de gebruiker WILDE heet `booking`. Een
   versmalling die precies het gevraagde vermogen verbergt is erger dan geen
   versmalling -- gevonden door hem op echte vragen tegen de echte lijst te
   draaien (test/stuur-resolver.test.js houdt dit geval vast). Vandaar dat een
   sleutel een lijst mag zijn, en vandaar dat het model in ./lus.js altijd om de
   volledige lijst kan vragen.

   ELK DOELWOORD BESTAAT ECHT. De toets controleert dat elk woord rechts ook
   werkelijk als segment in de routes van dit huis voorkomt. Een brug die
   nergens meer heen wijst, laat de bouw zakken in plaats van stil niets te
   doen -- de les van de cap `rooms` die een document noemde en die niet
   bestond (PLATFORM.md). */
const SYNONIEMEN = Object.freeze({
  rekening: 'bank', saldo: 'pay', overmaken: 'overboek', overmaak: 'overboek',
  storting: 'storten', geld: 'pay', betalen: 'pay', betaling: 'pay',
  taxi: 'ride', vervoer: 'ride', rijden: 'ride', rit: 'ride',
  mail: 'rtmail', mailtje: 'rtmail', bericht: 'rtmail', post: 'rtmail',
  afspraak: 'agenda', kalender: 'agenda', vergadering: 'agenda',
  website: 'site', pagina: 'site', webshop: 'site',
  school: 'onderwijs', les: 'leerstof', huiswerk: 'leerstof', leren: 'leerstof',
  kamer: ['room', 'booking'], hotel: ['room', 'booking'], overnachting: ['room', 'booking'],
  tafel: ['reservering', 'booking'], reserveren: ['reservering', 'booking'],
  boek: 'booking', boeken: 'booking', geboekt: 'booking', boeking: 'booking',
  kaartje: 'ticket', toegangsbewijs: 'ticket',
  vestiging: 'zaak', bedrijf: 'zaak',
  plek: 'locatie', waar: 'locatie',
  spaargeld: 'spaardoel', sparen: 'spaardoel',
  lening: 'krediet', lenen: 'krediet',
  loon: 'salaris', uitbetaling: 'uitbetaal',
  inchecken: 'checkin', incheck: 'checkin', inchecked: 'checkin'
});

/* De doelwoorden van een sleutel, altijd als lijst. */
function bruggenVan(woord) {
  if (!Object.prototype.hasOwnProperty.call(SYNONIEMEN, woord)) return [];
  const b = SYNONIEMEN[woord];
  return Array.isArray(b) ? b : [b];
}

const STOPWOORDEN = new Set([
  'de', 'het', 'een', 'en', 'of', 'ik', 'je', 'jij', 'u', 'we', 'wij', 'mijn', 'me', 'mij',
  'is', 'ben', 'zijn', 'was', 'wordt', 'worden', 'heb', 'heeft', 'hebben', 'had',
  'voor', 'van', 'met', 'op', 'in', 'aan', 'te', 'dat', 'die', 'dit', 'deze', 'er',
  'niet', 'wel', 'ook', 'maar', 'als', 'dan', 'nog', 'even', 'graag', 'kun', 'kan',
  'wil', 'moet', 'mag', 'zou', 'naar', 'bij', 'om', 'uit', 'over', 'per', 'wat', 'hoe',
  'api', 'mijn'
]);

/* SCHEIDBARE WERKWOORDEN. "Maak 200 euro over" draagt het werkwoord
   `overmaken`, maar in de zin staan `maak` en `over` los en `over` is een
   stopwoord. Zonder deze stap won /api/meet/maak het van /api/bank/overboek --
   gevonden door de resolver op een echte zin te proberen, niet door erover na
   te denken. Elk partikel wordt daarom met elk ander woord samengevoegd als
   EXTRA kandidaat; het oorspronkelijke woord blijft gewoon staan. Dit is
   Nederlandse morfologie en geen routekennis: er staat geen pad in. */
const PARTIKELS = Object.freeze(['over', 'af', 'aan', 'in', 'uit', 'op', 'terug', 'mee', 'door', 'bij', 'weg']);


/* De woorden van een vraag: kleingemaakt, ontdaan van leestekens en
   stopwoorden, met hun synoniem erbij (het oorspronkelijke woord blijft ook
   staan -- "betaling" kan best een pad met `betaal` raken). */
/* De inhoudswoorden van een vraag: wat er overblijft na leestekens en
   stopwoorden, ZONDER de bruggen en de samengevoegde partikels. De resolver
   telt hiermee hoe dun het bewijs onder een versmalling is: raakt maar een van
   de zes woorden iets, dan is de rest weglaten een gok. */
function inhoudswoorden(vraag) {
  return String(vraag || '').toLowerCase()
    .replace(/[^a-z0-9à-ÿ]+/g, ' ')
    .split(' ')
    .filter(w => w.length >= 3 && !STOPWOORDEN.has(w));
}

function woordenUit(vraag) {
  const alle = String(vraag || '').toLowerCase()
    .replace(/[^a-z0-9à-ÿ]+/g, ' ')
    .split(' ')
    .filter(Boolean);
  const partikels = alle.filter(w => PARTIKELS.includes(w));
  const ruw = alle.filter(w => w.length >= 3 && !STOPWOORDEN.has(w));
  const kandidaten = [...ruw];
  for (const p of partikels) for (const w of ruw) if (w !== p) kandidaten.push(p + w);
  const uit = new Set();
  for (const w of kandidaten) {
    uit.add(w);
    for (const brug of bruggenVan(w)) uit.add(brug);
  }
  return [...uit];
}


module.exports = { woordenUit, inhoudswoorden, bruggenVan, SYNONIEMEN, STOPWOORDEN, PARTIKELS };
