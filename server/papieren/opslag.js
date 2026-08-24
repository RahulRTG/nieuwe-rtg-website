/* Waar de antwoorden liggen: een eigen bestandje, bewust NIET in de database.

   Drie redenen, en de derde is de belangrijkste:

   1. Het zijn geen ledengegevens. Een KvK-nummer en het mobiele nummer van de
      jurist horen niet tussen de bestellingen en gesprekken van leden.

   2. npm run golive draait zonder server. De keuring moet kunnen zien of het
      papierwerk af is, ook als er niets draait -- en of de opslag nu JSON,
      SQLite of PostgreSQL is, doet er dan niet toe.

   3. TIJDENS EEN DATALEK IS DE DATABASE PRECIES HET DING DAT MISSCHIEN NIET
      MEER TE VERTROUWEN IS. Het draaiboek dat vertelt wie je om drie uur
      's nachts belt, mag niet achter het systeem zitten dat op dat moment het
      probleem is. Het staat in een leesbaar bestand op de schijf.

   Het bestand bevat privénummers en staat daarom op 0600, in server/data/ --
   die map staat in .gitignore en hoort daar te blijven. */
const fs = require('fs');
const path = require('path');

// Lezingen en geen constanten: de paden volgen de datamap van dit moment.
// Zie de kop van server/db/opslag.js voor waarom dat uitmaakt.
const dataMap = () => process.env.RTG_DATA_DIR || path.join(__dirname, '..', 'data');
const bestandPad = () => path.join(dataMap(), 'papieren.json');
const LEEG = () => ({ antwoorden: {}, bijgewerkt: null });

/* Lezen faalt nooit hard: geen bestand betekent "nog niets uitgevraagd", en dat
   is een geldige toestand (op een verse machine de enige juiste). Een kapot
   bestand behandelen we net zo -- niet stilzwijgend "af" verklaren. */
function laad() {
  try {
    const s = JSON.parse(fs.readFileSync(bestandPad(), 'utf8'));
    if (!s || typeof s !== 'object' || typeof s.antwoorden !== 'object' || !s.antwoorden) return LEEG();
    return s;
  } catch (e) { return LEEG(); }
}

/* Schrijven via een tijdelijk bestand en een hernoeming: valt de stroom uit
   midden in het schrijven, dan is het oude bestand nog heel. Half papierwerk is
   erger dan oud papierwerk. */
function bewaar(staat) {
  try { fs.mkdirSync(dataMap(), { recursive: true }); } catch (e) {}
  const tmp = bestandPad() + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(staat, null, 2), { mode: 0o600 });
  fs.renameSync(tmp, bestandPad());
  try { fs.chmodSync(bestandPad(), 0o600); } catch (e) {}
  return staat;
}

module.exports = { laad, bewaar, bestandPad };
// BESTAND blijft als levende eigenschap bestaan voor wie hem leest.
Object.defineProperty(module.exports, 'BESTAND', { enumerable: true, get: bestandPad });
