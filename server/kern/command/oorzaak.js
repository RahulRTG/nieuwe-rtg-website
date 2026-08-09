/* DE OORZAAKMETING -- welk veld verklaart deze gevallen samen?

   Dit is het stuk van de operator dat "33 worden veroorzaakt door twee
   voertuigen" mogelijk maakt. Het staat apart omdat het een ANDERE vraag
   beantwoordt dan de rest van ./operator.js: die kiest wat er moet gebeuren,
   dit meet wat er aan de hand is. En omdat het los te toetsen hoort te zijn --
   een groepering die de verkeerde kolom aanwijst, zegt met gezag iets onwaars,
   en dat is erger dan niets zeggen.

   HET WORDT GEMETEN, NIET GERADEN. Er is geen tabel "wat verklaart wat": zo'n
   tabel veroudert zodra er een collectie bij komt, en dan blijft de operator
   stellig het verkeerde zeggen. In plaats daarvan zoekt hij zelf het veld dat
   de gevallen het strakst clustert. Vindt hij niets dat bijna alles verklaart,
   dan zegt hij dat er geen gedeelde oorzaak is. */
'use strict';

const { s } = require('./register');

/* Velden die nooit een oorzaak zijn: unieke sleutels en tijdstempels clusteren
   niets, ze verdelen alleen. Zonder deze lijst wordt "id" altijd de winnaar. */
const GEEN_OORZAAK = new Set(['id', 'at', 'created_at', 'createdAt', 'updatedAt', 'bijgewerkt',
  'key', 'uuid', 'zegel', 'idem', 'token']);

/* Zoek het veld dat de gevallen het sterkst groepeert: aanwezig in vrijwel elk
   geval, weinig verschillende waarden, en de grootste groep zo groot mogelijk.
   Dat is precies wat een mens "de oorzaak" noemt als hij naar een storingslijst
   kijkt: het ding dat steeds terugkomt. */
function groepeer(gevallen) {
  if (!gevallen.length) return { veld: null, groepen: [] };
  const kandidaten = new Map();
  for (const g of gevallen) {
    for (const [k, v] of Object.entries(g.rij || {})) {
      if (GEEN_OORZAAK.has(k) || v == null || typeof v === 'object') continue;
      const w = s(v); if (!w || w.length > 60) continue;
      if (!kandidaten.has(k)) kandidaten.set(k, new Map());
      const per = kandidaten.get(k);
      per.set(w, (per.get(w) || 0) + 1);
    }
  }
  let beste = null;
  for (const [veld, per] of kandidaten) {
    const gedekt = [...per.values()].reduce((a, b) => a + b, 0);
    if (gedekt < gevallen.length * 0.8) continue;          // moet bijna alles verklaren
    if (per.size < 2 || per.size > Math.max(2, gevallen.length / 2)) continue;
    const grootste = Math.max(...per.values());
    const punt = grootste / gevallen.length - per.size / (gevallen.length * 4);
    if (!beste || punt > beste.punt) beste = { veld, per, punt };
  }
  if (!beste) return { veld: null, groepen: [] };
  const groepen = [...beste.per.entries()].sort((a, b) => b[1] - a[1])
    .map(([waarde, aantal]) => ({ waarde, aantal }));
  return { veld: beste.veld, groepen };
}

module.exports = { groepeer, GEEN_OORZAAK };
