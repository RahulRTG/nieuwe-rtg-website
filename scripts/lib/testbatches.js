'use strict';

/* Kleine, duurgewogen procesbatches voor de Node-testloper.

   Node rekent de tijd van een toetsbestand vanaf het moment dat het in de
   procesronde bekend is. Bij bijna tweeduizend bestanden kon een bestand dus
   zijn tienminutengrens bereiken terwijl het nog achter honderden voorgangers
   wachtte. Dat is wachttijd, geen hangtijd.

   Een batch is daarom zowel in aantal begrensd als op bekend gewicht verdeeld.
   De zwaarste bestanden gaan eerst naar de lichtste batch. Zo blijft ieder
   bestand ruim binnen dezelfde echte uitvoeringstijdgrens; de grens zelf hoeft
   niet ruimer en een werkelijk hangende toets blijft gewoon rood. */

const STANDAARD_MAX = 80;

function positiefGeheel(getal, terugval) {
  const n = Number(getal);
  return Number.isInteger(n) && n > 0 ? n : terugval;
}

function maakBatches(lijst, opties) {
  const o = opties || {};
  const maxBestanden = positiefGeheel(o.maxBestanden, STANDAARD_MAX);
  const gewicht = typeof o.gewicht === 'function' ? o.gewicht : (() => 1);
  const namen = [...new Set((lijst || []).map(String))];
  if (!namen.length) return [];

  const aantal = Math.ceil(namen.length / maxBestanden);
  const bakken = Array.from({ length: aantal }, () => ({ namen: [], gewicht: 0 }));
  const kost = naam => {
    const n = Number(gewicht(naam));
    return Number.isFinite(n) && n > 0 ? n : 1;
  };

  for (const naam of namen.sort((a, b) => (kost(b) - kost(a)) || a.localeCompare(b))) {
    let keuze = -1;
    for (let i = 0; i < bakken.length; i++) {
      if (bakken[i].namen.length >= maxBestanden) continue;
      if (keuze < 0 || bakken[i].gewicht < bakken[keuze].gewicht ||
          (bakken[i].gewicht === bakken[keuze].gewicht && bakken[i].namen.length < bakken[keuze].namen.length)) {
        keuze = i;
      }
    }
    if (keuze < 0) throw new Error('testbatch-planner verloor een bestand');
    bakken[keuze].namen.push(naam);
    bakken[keuze].gewicht += kost(naam);
  }

  return bakken.map(b => b.namen);
}

module.exports = { maakBatches, STANDAARD_MAX };
