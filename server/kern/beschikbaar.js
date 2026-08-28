/* BESCHIKBAARHEID ZONDER AGENDA -- gedeeld door Vonk en Rendez-vous.

   HET PROBLEEM. "Wanneer kan jij?" -- "vrijdag?" -- "nee" -- "zondag?" is het
   deel van daten waar de meeste goede voornemens sneuvelen. De voor de hand
   liggende oplossing, agenda's koppelen, is hier uitgesloten: dat deelt precies
   het soort gegevens dat een lid niet kan terugnemen, met iemand die hij nog
   nooit heeft ontmoet.

   DE OPLOSSING IS EEN RITME, GEEN KALENDER. Een lid vinkt dagdelen aan --
   "donderdagavond", "zaterdagmiddag". Eenentwintig hokjes, en verder niets. Er
   is geen datum, geen tijdstip en geen "volgende week". Wat u aanvinkt zegt hoe
   uw week er meestal uitziet, niet waar u op 24 augustus bent. Dat laatste weet
   deze module niet en hoort hij niet te weten; aanwezigheid in een stad is een
   ander ding en woont in kern/rendezvous-aanwezig.js.

   EEN MECHANISME, TWEE GEZICHTEN (ONTMOETEN.md fase 3). Vonk noemt het Blind
   Availability, Rendez-vous noemt het Private Availability, en het is dezelfde
   code -- net als kern/ontmoetpoort.js. Wat verschilt is alleen het scherm
   eromheen.

   ---------------------------------------------------------------------------
   WAT ER GEDEELD WORDT, EN DE EERLIJKE VERSIE VAN "DE ANDER ZIET NIETS"

   De belofte is: de ander ziet uw hokjes niet. Er komt er precies EEN ding uit
   deze module, en pas na een wederzijdse match: het eerste dagdeel in de week
   dat u allebei aankruiste. Niet de lijst, niet het aantal, niet "u heeft er
   drie gemeen".

   WAAROM EEN EN NIET ALLEMAAL, want dat is de hele beveiliging. Zou de doorsnede
   compleet teruggegeven worden, dan hoefde iemand alleen alle eenentwintig
   hokjes aan te vinken om de volledige beschikbaarheid van de ander uitgelezen
   te krijgen. De belofte was dan onwaar voor iedereen die de moeite nam.

   EN WAT DIT NIET OPLOST, want dat hoort erbij. Wie het echt op iemand gemunt
   heeft, kan zijn eigen hokjes eenentwintig keer omzetten en zo alsnog het hele
   ritme aflezen. Daar is deze constructie geen bewijs tegen -- het maakt het een
   volgehouden handeling in plaats van een vinkje. Twee dingen dempen de schade:
   het gaat om een ritme en niet om een agenda (u leert dat iemand meestal op
   donderdagavond kan, niet waar hij dan is), en het kan alleen na een
   wederzijdse match. Wie zich zo gedraagt, hoort in de meldstroom thuis en niet
   in een slimmer algoritme.

   NIETS ERBIJ. Geen "nog 2 dagen", geen "plan nu", geen teller. De zin noemt het
   dagdeel en houdt op. LIFE.md par. 4.1: de software port niet aan tot een
   volgende stap -- de knop mag, de aansporing niet. */

const DAGEN = [['ma', 'maandag'], ['di', 'dinsdag'], ['wo', 'woensdag'], ['do', 'donderdag'],
  ['vr', 'vrijdag'], ['za', 'zaterdag'], ['zo', 'zondag']];
const DELEN = [['ochtend', 'ochtend'], ['middag', 'middag'], ['avond', 'avond']];

/* De volgorde van deze lijst IS de voorrang: maandagochtend eerst, zondagavond
   laatst. Vast en niet afhankelijk van vandaag, zodat twee leden op hetzelfde
   moment hetzelfde dagdeel te zien krijgen en het antwoord niet verschuift
   terwijl er niets veranderde. */
const SLOTS = [];
for (const [d, dl] of DAGEN) for (const [p, pl] of DELEN) SLOTS.push({ id: d + '-' + p, label: dl + pl });

const SLOT = Object.fromEntries(SLOTS.map(s => [s.id, s]));
const labelVan = id => (SLOT[id] ? SLOT[id].label : id);

/* Schoonmaken: alleen bestaande hokjes, zonder dubbele, in weekvolgorde. De
   volgorde wordt hier afgedwongen en niet bij het vergelijken, zodat de
   opgeslagen vorm en de vergeleken vorm dezelfde zijn (LAT.md regel 4). */
function schoonBeschikbaar(lijst) {
  if (!Array.isArray(lijst)) return [];
  const gewild = new Set(lijst.filter(x => typeof x === 'string' && SLOT[x]));
  return SLOTS.filter(s => gewild.has(s.id)).map(s => s.id);
}

/* Het ENIGE wat naar buiten gaat: het eerste dagdeel dat beiden aankruisten,
   of null. Geen lijst, geen telling -- zie de kop. */
function samenValt(a, b) {
  const eenB = new Set(schoonBeschikbaar(b));
  for (const id of schoonBeschikbaar(a)) if (eenB.has(id)) return { slot: id, label: labelVan(id) };
  return null;
}

/* De zin die het lid leest. `mijn` is de eigen lijst, zodat we het verschil
   kunnen maken tussen "u heeft nog niets aangekruist" (uw eigen zaak, geen
   informatie over de ander) en "u heeft nu geen dagdeel samen".

   Allebei zonder aansporing: er staat wat er is, en niet wat u zou moeten doen. */
function zin(mijn, ander) {
  const ik = schoonBeschikbaar(mijn);
  if (!ik.length) return { samen: null, tekst: 'U heeft nog geen dagdelen aangekruist.' };
  const s = samenValt(ik, ander);
  return s ? { samen: s, tekst: s.label.charAt(0).toUpperCase() + s.label.slice(1) + ' komt u beiden uit.' }
    : { samen: null, tekst: 'U heeft op dit moment geen dagdeel samen.' };
}

// de hokjes zoals een scherm ze nodig heeft
const rooster = () => ({ dagen: DAGEN.map(([id, label]) => ({ id, label })),
  delen: DELEN.map(([id, label]) => ({ id, label })), slots: SLOTS.map(s => ({ ...s })) });

module.exports = { SLOTS, schoonBeschikbaar, samenValt, zin, labelVan, rooster };
