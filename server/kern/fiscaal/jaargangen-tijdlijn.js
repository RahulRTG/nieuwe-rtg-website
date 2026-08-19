/* De fiscale jaargangen (deelmodule): DE TIJDLIJN -- puur rekenwerk.

   Afgesplitst van ./jaargangen.js, dat over de 10 kB-lat ging, en de snede valt
   op een echte grens -- dezelfde als bij payroll tussen regelpakket en
   regelpakket-keuring. Hiernaast staat hoe je een wijziging BEWAART en
   TERUGVINDT; hier staat hoe je uit een basis en een reeks wijzigingen de tabel
   van EEN DAG opbouwt.

   PUUR: geen database, geen klok, geen state. Dat is geen netheid maar de reden
   dat dit te toetsen is zonder een halve server op te tuigen -- en juist deze
   som moet over tien jaar nog hetzelfde antwoord geven. */
'use strict';

const isDatum = (d) => /^\d{4}-\d{2}-\d{2}$/.test(String(d || ''));
const diep = (v) => JSON.parse(JSON.stringify(v));

/* De genestelde velden van een landrecord. Bewust bij NAAM: een wijziging die
   `tarieven` als geheel zou vervangen, gooit de tarieven weg die er niet in
   stonden. Alleen deze twee worden samengevoegd, de rest wordt gezet. */
const GENEST = ['tarieven', 'reis'];

/* Een wijzigingenset op een landrecord leggen. Muteert het doel; het doel is
   altijd een kopie, nooit de basis zelf. */
function voegSamen(doel, wijz) {
  for (const [veld, waarde] of Object.entries(wijz || {})) {
    if (GENEST.includes(veld) && waarde && typeof waarde === 'object') {
      doel[veld] = Object.assign(doel[veld] || {}, waarde);
    } else {
      doel[veld] = waarde;
    }
  }
  return doel;
}

/* Uit een landrecord de waarden lichten die een wijzigingenset gaat raken --
   de "wat was het" bij een "wat wordt het". */
function lichtUit(record, wijz) {
  const uit = {};
  for (const [veld, waarde] of Object.entries(wijz || {})) {
    if (GENEST.includes(veld) && waarde && typeof waarde === 'object') {
      const sub = {};
      for (const k of Object.keys(waarde)) sub[k] = record && record[veld] ? record[veld][k] : undefined;
      uit[veld] = sub;
    } else {
      uit[veld] = record ? record[veld] : undefined;
    }
  }
  return uit;
}

/* Op ingangsdatum, en bij gelijke datum op volgorde van opnemen. Twee
   wijzigingen die op dezelfde dag ingaan komen in de echte wereld voor (een
   pakket dat een eerder pakket corrigeert), en dan wint de laatst opgenomen. */
const opVolgorde = (lijst) => (Array.isArray(lijst) ? lijst : []).slice().sort((a, b) =>
  a.geldigVanaf < b.geldigVanaf ? -1 : a.geldigVanaf > b.geldigVanaf ? 1 :
    String(a.opgenomenOp) < String(b.opgenomenOp) ? -1 : 1);

/* DE OPBOUW: basis + alles wat op of voor die dag is INGEGAAN. Geeft een kopie
   terug, dus wie hier iets in wijzigt, wijzigt de geschiedenis niet. */
function bouwOp(basisRecord, lijst, datum) {
  if (!basisRecord) return null;
  const uit = diep(basisRecord);
  for (const j of opVolgorde(lijst)) if (j.geldigVanaf <= datum) voegSamen(uit, j.wijzigingen);
  return uit;
}

module.exports = { isDatum, diep, GENEST, voegSamen, lichtUit, opVolgorde, bouwOp };
