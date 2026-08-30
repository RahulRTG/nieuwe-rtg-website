/* ============================================================================
   MUTATIECONTRACTEN -- WAT TWEE METERS ALLEBEI OP NUL ZETTEN.

   Deel van server/lib/mutatiecontracten.js; zie de kop daar voor de vorm en de
   regels.

   HET BEWIJS. NOT_APPLICABLE eist bewijs dat er niets verandert, en de
   opslagmeter alleen is daar te zwak voor: hij ziet de collecties in de database,
   dus geen mail, geen sms en geen schrijfactie daarbuiten. "Geen spoor" is uit
   die ene meter een gevolgtrekking uit AFWEZIG bewijs, en daar stonden 1.194
   routes op te wachten.

   ./mutatiecontracten-leest.js vult dat gat met scripts/schrijfanalyse.js en
   kwam niet verder dan veertig routes: die analyse volgt met opzet geen aanroep
   over een modulegrens, en in dit huis gaat bijna elke handler meteen de kern in.
   server/effectmeter.js sluit hetzelfde gat van de andere kant -- hij meet niet
   wat de code KAN maar wat het verzoek HEEFT gedaan, en schaalt daarom wel: hij
   hangt aan de aanroep en niet aan de brontekst.

   Een route staat hier alleen als ALLE VIER waar is: twee geslaagde kale
   oproepen, geen spoor in de gemeten collecties, GEEN op de effectmeter bij
   allebei, en geen tegenspraak uit de statische analyse. Wat die vier afwezen en
   waarom staat in MUTATIECONTRACT-VOORSTEL.json.

   DAT DE METER 142 VOORSTELLEN VERWIERP is het beste argument voor deze lijst.
   /api/bank/bevries, /api/bank/pas/limiet, /api/boardroom/reset en
   /api/home/alles-uit zagen er voor de opslagmeter uit alsof er niets gebeurde;
   de effectmeter telde er een schrijfpoging. Die zouden hier hebben gestaan met
   "deze route verandert niets" -- over een pas bevriezen en een boardroom
   resetten. Vier van die vijf staan in SCHRIJFANALYSE.json op `onbekend`, dus de
   statische analyse had ze niet tegengehouden.

   WAT DEZE METER NIET ZIET, en het staat ook in elk contract hieronder:
   bestandsschrijfacties en externe aanroepen. Bestanden hebben geen enkel choke
   point (uploads via server/kluis.js, de outbox rechtstreeks, een handvol
   modules met een eigen fs.writeFileSync). Van de externe aanroepen is alleen
   server/ai.js er een; halve dekking zou bij drie van de vier routes zwijgen, en
   dat leest als "er gebeurde niets".

   DE ROUTES STAAN IN ./effectroutes.json, en met opzet daar. Alleen hun naam en
   hun deur; de redenering, het bewijs en de aftekening staan hier, EEN keer. 788
   keer dezelfde zin uitschrijven is de vorm waarin een verschil onopgemerkt
   insluipt -- zie ./mutatiecontracten-beschermd.js, waar dat met zoveel woorden
   staat. Dat bestand wordt geschreven door scripts/effectcontracten.js; wie een
   route wil toevoegen of weghalen, draait dat script en niet zijn editor.

   WIE ER NIET IN STAAN. Zestig routes haalden de vier eisen wel maar hebben geen
   waargenomen toegangsklasse. Een contract zonder deur bestaat niet, en een
   verzonnen deur is erger dan een route die op LEGACY blijft staan. Ze staan in
   de wachtrij en wachten op de vraag welke deur zij hebben.
   ========================================================================== */
'use strict';

const { routes } = require('./effectroutes.json');

/* DE AFTEKENING, EN ZIJ IS EERLIJK OVER WAT ZIJ IS.

   Dit is een BESLUIT VAN DE EIGENAAR over de bewijsstandaard, genomen op 30
   augustus 2026: twee onafhankelijke runtime-metingen die allebei nul lezen, met
   genoemd waarover zij zwijgen, is voldoende grond voor NOT_APPLICABLE.

   Het is uitdrukkelijk NIET een mens die deze 788 routes een voor een heeft
   gelezen, en dat verschil hoort te blijven staan. Wie er later een naleest en er
   zijn eigen naam onder wil zetten, haalt die route hier weg en zet hem met zijn
   naam in een van de andere contractbestanden -- een mens wint van een besluit
   over een standaard, net zoals een mens van een script wint. */
const AFGETEKEND = {
  door: 'besluit van de eigenaar over de bewijsstandaard (30 augustus 2026): twee onafhankelijke ' +
    'runtime-metingen die allebei nul lezen. Niet route voor route door een mens gelezen',
  op: '2026-08-30'
};

const NIET_GEMETEN = 'bestandsschrijfacties en externe aanroepen -- die hebben geen choke point, ' +
  'en halve dekking daar leest als "er gebeurde niets"';

const GEMETEN = 'kale ronde zonder sleutel: twee geslaagde oproepen, geen van beide liet iets achter in ' +
  'de gemeten collecties';

const NAGEKEKEN = 'server/effectmeter.js, 2026-08-30: op allebei de kale oproepen telde de meter GEEN -- ' +
  'geen schrijfpoging via save(), geen mail, geen sms. Dat is de tweede, onafhankelijke lijn die het gat ' +
  'sluit dat de opslagmeter laat. Wat ook deze meter NIET ziet: ' + NIET_GEMETEN;

const CONTRACTEN = {};
for (const r of routes) {
  const toegang = { klasse: r.toegang };
  if (r.objectVeld) toegang.objectVeld = r.objectVeld;
  /* De reden bij PUBLIC komt uit scripts/lib/publiekeroutes.js -- door een mens
     geschreven, over deze route. Open is een besluit; zonder reden is het een
     gat dat toevallig nog niemand heeft gedicht, en de keuring weigert het. */
  if (r.waarom) toegang.waarom = r.waarom;
  CONTRACTEN[r.route] = {
    mutatieId: r.mutatieId,
    herkomst: 'mens',
    semantiek: { klasse: 'idempotent' },
    toegang,
    stand: 'NOT_APPLICABLE',
    bewijs: { gemeten: GEMETEN, op: '2026-08-30' },
    nagekeken: NAGEKEKEN,
    afgetekend: AFGETEKEND
  };
}

module.exports = CONTRACTEN;
