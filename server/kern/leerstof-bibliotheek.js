/* RTG School, de bibliotheek: alle leerlijnen bij elkaar, plat en op id.

   Dit bestand doet een ding: de losse leerlijnbestanden uit ./leerstof-data/
   samenvoegen tot EEN register (DOELEN) plus twee ingangen erop (PER_GROEP
   voor het basisonderwijs, PER_FASE voor de ladder daarna). De graaf en de
   keuring staan in ./leerstof-fabric.js, de stroom eromheen in ./leerstof.js.

   Waarom apart: hier staan alleen requires en twee lussen, en juist dat deel
   groeit met elk vak dat erbij komt. De motor ernaast hoort daar niet mee te
   groeien. */
const { keurLeerstof } = require('./leerstof-fabric');

const { REKENEN } = require('./leerstof-data/rekenen');
const { TAAL } = require('./leerstof-data/taal');
const { AARDRIJKSKUNDE } = require('./leerstof-data/aardrijkskunde');
const { GESCHIEDENIS } = require('./leerstof-data/geschiedenis');
const { NATUUR } = require('./leerstof-data/natuur');
const { VERKEER, ENGELS_PO } = require('./leerstof-data/verkeer-engels');
const { VO_WISKUNDE } = require('./leerstof-data/vo-wiskunde');
const { VO_NATUURWET } = require('./leerstof-data/vo-natuurwet');
const { VO_TALEN } = require('./leerstof-data/vo-talen');
const { VO_MENS } = require('./leerstof-data/vo-mens');
const { VO_ECONOMIE } = require('./leerstof-data/vo-economie');
const { VERVOLG } = require('./leerstof-data/vervolg');
const { VERVOLG_HOGER } = require('./leerstof-data/vervolg-hoger');
const { VERVOLG_VAARDIG } = require('./leerstof-data/vervolg-vaardig');
/* De graaf (voorkennis, uitlegvormen, meting, de keuring en het pad naar een
   doel) woont in ./leerstof-fabric.js. Hier staat de stroom eromheen. */

const OPGAVEN_PER_SESSIE = 5;
const BEHAALD_BIJ = 4;



/* alle leerdoelen plat, geindexeerd op id, met vak en groep erbij -- op
   moduleniveau, zodat ook de schooltoetsen (school/toets.js) uit dezelfde
   bibliotheek putten zonder de stateful motor nodig te hebben */
const DOELEN = {};
const PER_GROEP = {};
for (const [vak, lijn] of [['rekenen', REKENEN], ['taal', TAAL], ['aardrijkskunde', AARDRIJKSKUNDE],
  ['geschiedenis', GESCHIEDENIS], ['natuur', NATUUR], ['verkeer', VERKEER], ['engels', ENGELS_PO]]) {
  for (const g of lijn) {
    PER_GROEP[g.groep] = PER_GROEP[g.groep] || [];
    for (const d of g.doelen) {
      DOELEN[d.id] = Object.assign({ vak, groep: g.groep }, d);
      PER_GROEP[g.groep].push(d.id);
    }
  }
}
/* golf 3: het voortgezet en vervolgonderwijs, per FASE uit de niveauladder
   (vmbo t/m wo). Zelfde bibliotheek, dus toetsen en huiswerk kunnen er net
   zo uit putten als bij groep 1 t/m 8. */
const PER_FASE = {};
for (const blok of VO_WISKUNDE.concat(VO_NATUURWET, VO_TALEN, VO_MENS, VO_ECONOMIE, VERVOLG, VERVOLG_HOGER, VERVOLG_VAARDIG)) {
  for (const fase of blok.fasen) {
    PER_FASE[fase] = PER_FASE[fase] || [];
    for (const d of blok.doelen) {
      /* Een doel mag zijn EIGEN fasen noemen. Zonder dat stond alles van een
         blok bij elke fase van dat blok, en kreeg een vmbo-leerling de
         vwo-doelen van hetzelfde vak erbij -- een leerlijn zonder niveau. */
      if (Array.isArray(d.fasen) && !d.fasen.includes(fase)) continue;
      /* Een id hoort op EEN plek te staan. Stond hij eerder in twee
         bestanden, dan won stilletjes de eerste en verscheen het doel bovendien
         dubbel in de lijst van zijn fase. Nu valt dat luid om. */
      if (DOELEN[d.id] && DOELEN[d.id].fase !== (d.fasen || blok.fasen)[0])
        throw new Error('leerstof: het leerdoel ' + d.id + ' staat twee keer in de leerlijnen');
      DOELEN[d.id] = DOELEN[d.id] || Object.assign({ vak: blok.vak, fase: (d.fasen || blok.fasen)[0] }, d);
      PER_FASE[fase].push(d.id);
    }
  }
}

keurLeerstof(DOELEN);
module.exports = { DOELEN, PER_GROEP, PER_FASE, BEHAALD_BIJ };
