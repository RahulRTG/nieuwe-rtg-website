/* HET KETENSPOOR -- welke schakel van de uitvoeringsketen raakt een echte
   mensenzin werkelijk aan?

   WAAROM DIT BESTAAT. "De module bestaat" en "een mens kan er komen" zijn twee
   verschillende uitspraken, en het verschil is niet cosmetisch: kern/stuur/
   mandaat.js is een volwaardige grammatica met nul productie-aanroepers. Een
   perfecte module die niemand bereikt is architectonisch iets heel anders dan
   een ontbrekende module, en statisch is dat onderscheid niet te maken --
   AANROEPGRAAF.json kan een op de zes aanroepen in dit huis niet herleiden,
   omdat modules via een contextobject reizen en niet via `require`.

   WAT HIJ NIET IS. Geen productiecode. Hij wordt geladen met
   NODE_OPTIONS=--require en doet zonder RTG_KETENSPOOR letterlijk niets --
   dezelfde vorm als server/opzet/contextspoor.js, en om dezelfde reden: een
   meter die altijd meeloopt is een meter die iets verandert.

   WAAROM HIJ NIET AAN contextspoor.js GENOEG HAD. Die noteert toegang tot het
   CONTEXTOBJECT, en dat is het enige choke point voor `kern.xxx`. Maar plan,
   gevolg en mandaat worden binnen kern/stuur.js rechtstreeks ge-`require`d; ze
   komen daar nooit langs. Dit is dus geen tweede meter naast die ene maar een
   meting van een andere as.

   HIJ ZEGT "AANGEROEPEN" EN NIET "GESLAAGD". Een regel betekent dat de functie
   is binnengegaan. Of zij ja of nee zei, staat er niet in -- dat is met opzet:
   deze meter gaat over of de keten een schakel BEREIKT, en een weigering op de
   juiste plek is even goed bewijs van bereik als een goedkeuring.

   EN EEN SCHAKEL DIE NIET TE WIKKELEN IS, HEET NIET "NIET BEREIKT". Dat
   onderscheid draagt het hele register: `nietGeinstrumenteerd` met de reden
   erbij, nooit een stilzwijgende nul. Zonder die regel zou een kapotte haak
   eruitzien als een gat in de architectuur. */
'use strict';

const fs = require('fs');
const path = require('path');

const UIT_PAD = process.env.RTG_KETENSPOOR || '';
if (!UIT_PAD) return;

const WORTEL = path.join(__dirname, '..', '..');

/* De schakels van mens naar effect, in de volgorde waarin ze horen te vallen.
   `soort` zegt wat het wikkelen moet doen: een gewoon object met functies, of
   een fabriek waarvan ook de UITKOMST gewikkeld moet worden. */
const SCHAKELS = [
  { id: 'menscontext', mod: 'server/kern/stuur/menscontext.js', soort: 'object' },
  { id: 'resolver', mod: 'server/kern/stuur/resolver.js', soort: 'object' },
  { id: 'beleid', mod: 'server/kern/stuur/beleid.js', soort: 'object' },
  { id: 'plan', mod: 'server/kern/stuur/plan.js', soort: 'object' },
  { id: 'gevolg', mod: 'server/kern/stuur/gevolg.js', soort: 'object' },
  { id: 'mandaat', mod: 'server/kern/stuur/mandaat.js', soort: 'object' },
  { id: 'executor', mod: 'server/kern/stuur/lusstap.js', soort: 'fabriek' },
  { id: 'lus', mod: 'server/kern/stuur/lus.js', soort: 'fabriek' },
  { id: 'nacontrole', mod: 'server/kern/command/transactie-poorten.js', soort: 'object' }
];

const stand = { geinstrumenteerd: [], nietGeinstrumenteerd: [] };

/* Een regel per aanraking. Append en geen buffer: het meetscript leest tussen
   twee verzoeken door, en een buffer zou de toewijzing aan een zin verschuiven. */
function noteer(schakel, fn) {
  try { fs.appendFileSync(UIT_PAD, JSON.stringify({ s: schakel, f: fn, t: Date.now() }) + '\n'); }
  catch (e) { /* meten mag de server nooit stukmaken */ }
}

/* Wikkelt EEN functie. Roept door, geeft door, en gooit door -- er is geen tak
   waarlangs dit het gedrag verandert. */
function wikkel(schakel, naam, fn) {
  return function (...args) { noteer(schakel, naam); return fn.apply(this, args); };
}

function wikkelObject(schakel, obj) {
  let aantal = 0;
  for (const naam of Object.keys(obj)) {
    if (typeof obj[naam] !== 'function') continue;
    const d = Object.getOwnPropertyDescriptor(obj, naam);
    if (d && d.set === undefined && d.get !== undefined) continue;  // een getter laten we staan
    if (d && !d.writable && !d.configurable) continue;              // bevroren: niet te wikkelen
    try { obj[naam] = wikkel(schakel, naam, obj[naam]); aantal++; } catch (e) { /* zie hieronder */ }
  }
  return aantal;
}

for (const s of SCHAKELS) {
  const vol = path.join(WORTEL, s.mod);
  try {
    if (!fs.existsSync(vol)) {
      stand.nietGeinstrumenteerd.push({ schakel: s.id, reden: 'het bestand bestaat niet: ' + s.mod });
      continue;
    }
    const m = require(vol);
    if (s.soort === 'fabriek') {
      if (typeof m !== 'function') {
        stand.nietGeinstrumenteerd.push({ schakel: s.id, reden: 'verwacht een fabriek, kreeg ' + typeof m });
        continue;
      }
      /* De fabriek zelf telt als aanraking, EN de uitkomst wordt gewikkeld --
         anders zie je wel het bedraden bij het opstarten en nooit het gebruik
         tijdens een verzoek, en dat is precies het verschil dat hier telt. */
      const origineel = m;
      require.cache[require.resolve(vol)].exports = function (...args) {
        noteer(s.id, '(fabriek)');
        const uit = origineel.apply(this, args);
        if (uit && typeof uit === 'object') { try { wikkelObject(s.id, uit); } catch (e) {} }
        else if (typeof uit === 'function') return wikkel(s.id, '(uitkomst)', uit);
        return uit;
      };
      stand.geinstrumenteerd.push({ schakel: s.id, vorm: 'fabriek' });
      continue;
    }
    const n = wikkelObject(s.id, m);
    if (!n) {
      stand.nietGeinstrumenteerd.push({ schakel: s.id, reden: 'geen enkele functie-export om te wikkelen' });
      continue;
    }
    stand.geinstrumenteerd.push({ schakel: s.id, vorm: 'object', functies: n });
  } catch (e) {
    /* EEN MISLUKTE HAAK IS GEEN GAT IN DE ARCHITECTUUR. Hij komt hier terecht
       met zijn reden, en het meetscript leest die schakel als
       NIET_GEINSTRUMENTEERD -- nooit als "niet bereikt". */
    stand.nietGeinstrumenteerd.push({ schakel: s.id, reden: String(e && e.message || e) });
  }
}

/* De haakstand naast het spoor, zodat het meetscript weet WAT er te zien viel.
   Zonder dit bestand kan hij niet vaststellen of een lege schakel niet werd
   geraakt of niet werd gemeten. */
try {
  fs.writeFileSync(UIT_PAD + '.haak', JSON.stringify(stand, null, 2) + '\n');
} catch (e) { /* zie boven */ }
