/* De aftekening en de datum van de Connect-contracten, apart zodat de twee
   contractbestanden hem delen zonder elkaar te hoeven laden (een kringverwijzing
   tussen de twee zou de een half geladen aan de ander geven) -- zelfde vorm en
   zelfde reden als ./mutatiecontracten-beschermzaak-op.js.

   WAT ER IS GEMETEN, want een aftekening zonder meting is een handtekening
   onder een gevoel. `npm run lusproef` draait de hele lus tegen een echte
   wegwerpserver: vijftien schakels en tien storingen, met twee leden, een
   gezinsbeheerder en een kindprofiel dat langs de gewone inlog binnenkomt. De
   leeskant is daar schakel 15 (alleen lezen verandert niets aan de eigen
   stand) en in test/connect.test.js toets 16, waar db.data zelf te lezen is --
   die tweede is er omdat de eerste maar de helft kan zien.

   DIE MEETRONDE VOND TWEE ECHTE GEBREKEN, en ze staan hier omdat een
   aftekening die alleen het gelukkige pad noemt, niets waard is:

     - `maker` kwam uit het VERZOEK, waarmee iedereen een regel `onderwezen` in
       het dossier van een willekeurig ander kon schrijven -- de enige trede met
       bewijskracht. De zelf-weigering sloeg nooit aan, want een verzonnen
       codenaam is per definitie niet gelijk aan de gever.
     - drie leesroutes maakten hun rij in db.data AAN zodra iemand keek, zonder
       save(), dus onzichtbaar tot een andere handeling toevallig opsloeg. Een
       route die `leest: true` heet en de opslag laat groeien, klopt niet met
       zijn eigen contract.

   Beide zijn gerepareerd en beide hebben een toets die zakt als ze terugkomen
   (test/connect.test.js 24 en 16); die eerste bestaat omdat een mutatie op de
   oude weg de bestaande toetsen NIET liet zakken. */
'use strict';

module.exports = {
  AFGETEKEND: {
    door: 'Claude, op grond van een eigen gemeten ronde tegen een draaiende wegwerpserver ' +
      '(npm run lusproef) plus test/connect.test.js; niet door een mens nagelezen',
    op: '2026-09-15'
  },
  OP: '2026-09-15'
};
