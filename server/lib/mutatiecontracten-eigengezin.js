/* De mutatiecontracten van het gezin aan een ouderaccount
   (foundation/gezinseigenaar.js, 5 oktober 2026). Elke route is in
   test/gezinseigenaar.test.js toets 9 twee keer met hetzelfde lijf aangeroepen
   tegen een echte server.

   Het object is het EIGEN account uit de sessie: er staat geen gezinscode in
   het lijf, dus een tweede eigenaar is hier niet te kiezen. Daarom
   AUTHENTICATED en niet OBJECT_SCOPED. Maken en een sessie openen staan in
   lib/eenmalig-geheim-routes.js: een herhaling krijgt nooit een sessie uit een
   cache. */
'use strict';
const OP = '2026-10-05';
const AF = { door: 'Claude, op grond van test/gezinseigenaar.test.js toets 9; niet door een mens nagelezen', op: OP };
const LID = { klasse: 'AUTHENTICATED', deur: 'auth' };
const gemeten = (hoe) => ({ gemeten: 'test/gezinseigenaar.test.js toets 9 (' + OP + '): ' + hoe, op: OP });

const CONTRACTEN = {
  'POST /api/rtf/eigen-gezin': {
    mutatieId: 'foundation.eigengezin.lezen', herkomst: 'mens',
    semantiek: { klasse: 'idempotent' }, toegang: LID, stand: 'NOT_APPLICABLE',
    bewijs: gemeten('twee keer 200 met een byte voor byte gelijk antwoord.'),
    nagekeken: 'de handler leest het gezin en de lidstand; hij bewaart niets',
    afgetekend: AF
  },
  'POST /api/rtf/eigen-gezin/maak': {
    mutatieId: 'foundation.eigengezin.maken', herkomst: 'mens',
    semantiek: { klasse: 'idempotent' }, toegang: LID, stand: 'PROTECTED',
    bewijs: gemeten('de tweede gaf 409 zonder sessie, en er bleef een gezin. Een toestandscontrole: een account, een gezin.'),
    afgetekend: AF
  },
  'POST /api/rtf/eigen-gezin/sessie': {
    mutatieId: 'foundation.eigengezin.sessie', herkomst: 'mens',
    semantiek: { klasse: 'nietHerhaalbaar' }, toegang: LID, stand: 'INTENTIONALLY_NON_IDEMPOTENT',
    waarom: 'Elke oproep opent een NIEUWE 128-bit gezinssessie (gezinstoken.geef), net als inloggen. Een herhaling ' +
      'die de vorige teruggaf zou een geheim uit een cache heronthullen; daarom staat de route in ' +
      'lib/eenmalig-geheim-routes.js. De eerdere sessie blijft geldig tot verval of intrekken.',
    bewijs: gemeten('twee keer 200 met twee verschillende sessies, en de eerste opende daarna nog steeds het gezin.'),
    afgetekend: AF
  },
  'POST /api/rtf/eigen-gezin/kind': {
    mutatieId: 'foundation.eigengezin.kind', herkomst: 'mens',
    semantiek: { klasse: 'idempotent' }, toegang: LID, stand: 'PROTECTED',
    bewijs: gemeten('twee keer 200 met hetzelfde profiel-id, en het gezin telde een kind met die naam.'),
    afgetekend: AF
  }
};

module.exports = { CONTRACTEN };
