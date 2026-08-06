/* De soorten stedelijke objecten, als pure tabel. Per soort: het label, het
   stad-domein waar hij onder valt (dezelfde acht als het bord van RTG Stad), de
   technische levensduur in jaren, de standaard risicoklasse en de
   vervangingswaarde in hele euro's.

   Die getallen zijn beheerdata en geen sier: ze voeden de vervangingsplanning,
   de kosten per domein en de prioriteit van een zaak (een storing aan een
   kritiek object weegt zwaarder dan een losse tegel). Ze staan hier los omdat
   een tabel iets anders is dan een register: deze lijst groeit met elke soort
   die de stad erbij krijgt, de motor eromheen verandert niet mee. */

const SOORTEN = {
  lantaarn: { label: 'Lantaarnpaal', domein: 'licht', jaar: 25, risico: 'laag', waarde: 1400 },
  container: { label: 'Afvalcontainer', domein: 'afval', jaar: 12, risico: 'laag', waarde: 2600 },
  sensor: { label: 'Stadsdoos', domein: null, jaar: 8, risico: 'midden', waarde: 900 },
  verkeerslicht: { label: 'Verkeerslicht', domein: 'verkeer', jaar: 20, risico: 'hoog', waarde: 32000 },
  gemaal: { label: 'Rioolgemaal', domein: 'water', jaar: 30, risico: 'kritiek', waarde: 180000 },
  transformator: { label: 'Transformatorstation', domein: 'energie', jaar: 40, risico: 'kritiek', waarde: 260000 },
  laadpaal: { label: 'Laadpunt', domein: 'energie', jaar: 10, risico: 'midden', waarde: 8000 },
  put: { label: 'Straatkolk / put', domein: 'water', jaar: 40, risico: 'laag', waarde: 700 },
  brug: { label: 'Brug', domein: 'verkeer', jaar: 60, risico: 'kritiek', waarde: 1200000 },
  boom: { label: 'Boom', domein: null, jaar: 80, risico: 'laag', waarde: 1800 },
  speeltoestel: { label: 'Speeltoestel', domein: null, jaar: 15, risico: 'midden', waarde: 5200 },
  halte: { label: 'OV-halte', domein: 'verkeer', jaar: 20, risico: 'midden', waarde: 14000 }
};
const STATUS = ['in-dienst', 'storing', 'onderhoud', 'uit-dienst'];
const RISICO = ['laag', 'midden', 'hoog', 'kritiek'];

/* De conditieschaal is NEN 2767-achtig: 1 is uitstekend, 6 is zeer slecht. Dat
   is met opzet geen eigen schaal van 1-5 "want dat leest lekkerder": wie met
   een echte beheerder praat, praat in deze zes. */
const CONDITIE = { 1: 'uitstekend', 2: 'goed', 3: 'redelijk', 4: 'matig', 5: 'slecht', 6: 'zeer slecht' };

module.exports = { SOORTEN, STATUS, RISICO, CONDITIE };
