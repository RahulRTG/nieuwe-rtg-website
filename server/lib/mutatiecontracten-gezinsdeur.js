/* Nagekeken contracten van de routes van de gezinsdeur (4 oktober 2026,
   RELEASEKANDIDAAT.md B18 en B19, foundation/gezinsdeur.js en
   routes/member/gezin.js). Een nieuwe gezinscode, een stroomticket en een
   verlengde sessie zijn met opzet nooit dezelfde uitkomst (elk een nieuw geheim
   dat alleen in dat antwoord staat); intrekken en ontkoppelen zijn standen die
   een tweede keer niets meer veranderen. Het object is het gezin uit het lijf,
   de sleutel een gezinssessie van DAT gezin; roteren en intrekken vragen
   daarbovenop de beheerder, verlengen en koppelen een verse passkey. */
'use strict';
const AF = { door: 'Claude, gezinscode.js, gezinsstroom.js, gezinsdeur.js en de routes gelezen en beproefd', op: '2026-10-04' };
const OP = '2026-10-04';
const GEZIN = { klasse: 'OBJECT_SCOPED', objectVeld: 'code',
  uitleg: 'het gezin uit het lijf plus een geldige gezinssessie van DAT gezin; anders 403' };
const BEHEERDER = Object.assign({}, GEZIN, { uitleg: GEZIN.uitleg + '; alleen de beheerder van dat gezin' });
const NIEUW = (mutatieId, toegang, waarom, gemeten) => ({ mutatieId, herkomst: 'mens',
  semantiek: { klasse: 'nietHerhaalbaar' }, toegang, stand: 'INTENTIONALLY_NON_IDEMPOTENT', waarom,
  bewijs: { gemeten, op: OP }, afgetekend: AF });
const STAND = (mutatieId, toegang, gemeten) => ({ mutatieId, herkomst: 'mens',
  semantiek: { klasse: 'idempotent' }, toegang, stand: 'PROTECTED', bewijs: { gemeten, op: OP }, afgetekend: AF });

const CONTRACTEN = {
  'POST /api/foundation/gezin/inloggen': NIEUW('foundation.gezin.inloggen',
    { klasse: 'OBJECT_SCOPED', objectVeld: 'gezinscode', uitleg: 'de 128-bit gezinscode plus de profielpincode begrenzen de toegang en zowel adres als gezin hebben een pogingenrem' },
    'Een geldige inlog geeft een nieuwe gezinssessie voor dit apparaat. Een antwoordcache zou een eerder sessiegeheim opnieuw tonen; de route staat daarom in lib/eenmalig-geheim-routes.js.',
    'test/gezinsdeur.test.js: een geldige pincode geeft een verse sessie, verkeerde codes en pincodes falen dicht en de rem is per adres en gezin begrensd'),
  'POST /api/foundation/gezin/profiel/kies': NIEUW('foundation.gezin.profiel.kies',
    { klasse: 'OBJECT_SCOPED', objectVeld: 'gezinscode', uitleg: 'de 128-bit gezinscode, het profiel-id en de eigen profielpincode begrenzen de toegang' },
    'Profielkeuze geeft een nieuwe gezinssessie voor exact dit profiel. Een antwoordcache zou een sessiegeheim heronthullen; de route staat daarom in lib/eenmalig-geheim-routes.js.',
    'test/gezinsdeur.test.js en test/gezinssessie.test.js: alleen de juiste gezinscode, profielkeuze en pincode geven een sessie en iedere nieuwe inlog geeft een ander token'),
  'POST /api/foundation/gezin/code/roteer': NIEUW('foundation.gezinscode.roteren', BEHEERDER,
    'Elke oproep maakt een nieuwe 128-bit gezinscode en vervangt de vorige; een herhaling die de vorige ' +
    'teruggaf zou een vervangen code heronthullen. De route staat in lib/eenmalig-geheim-routes.js.',
    'test/gezinsdeur.test.js: na roteren opent de vorige gezinscode niets, een kind krijgt 403'),
  'POST /api/foundation/gezin/code/intrek': STAND('foundation.gezinscode.intrekken', BEHEERDER,
    'test/gezinsdeur.test.js: na intrekken opent de gezinscode niets, een tweede keer zegt ingetrokken 0 niet als fout'),
  'POST /api/foundation/gezin/stroom/ticket': NIEUW('foundation.gezinsstroom.ticket', GEZIN,
    'Elke oproep geeft een nieuw eenmalig stroomticket van een minuut; een cache zou een ingewisseld ticket teruggeven.',
    'test/gezinsdeur.test.js: een ticket opent precies een stroom, een tweede keer 401, en een ticket voor het ' +
    'gezinskanaal opent de sociale stroom niet'),
  'POST /api/foundation/gezin/sessie/verleng': NIEUW('foundation.gezinssessie.verlengen', GEZIN,
    'Verlengen vraagt een verse passkeyceremonie en geeft een nieuwe sessie van zeven dagen terwijl de oude wordt ' +
    'ingetrokken; een herhaling met de oude vindt haar niet meer.',
    'test/gezinsdeur.test.js: zonder passkey aan het profiel 409, zonder Authorization-header 400, een gast 403'),
  'POST /api/foundation/gezin/passkey/weg': STAND('foundation.gezinspasskey.ontkoppelen', GEZIN,
    'test/gezinsdeur.test.js: ontkoppelen haalt de passkey van het eigen profiel, een tweede keer ontkoppeld 0'),
  'POST /api/rtf/gezin/passkey': NIEUW('foundation.gezinspasskey.koppelen',
    { klasse: 'AUTHENTICATED', uitleg: 'een eigen RTG-account plus een gezinssessie van het profiel in het lijf' },
    'Koppelen vraagt een eenmalige passkeyceremonie gebonden aan deze lid-sessie; een herhaling vraagt een nieuwe.',
    'test/gezinsdeur.test.js: zonder gezinssessie 403, een gast 403, een account zonder passkey 403 (geen terugval)')
};

module.exports = { CONTRACTEN };
