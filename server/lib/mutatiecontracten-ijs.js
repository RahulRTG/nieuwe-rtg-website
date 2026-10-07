/* Nagekeken contracten van de ICE-uitgifte (6 oktober 2026, docs/turn-server.md,
   kern/rtc/ijs.js). Elke oproep geeft een NIEUW kortlevend TURN-credential
   (een ander verloop in de gebruikersnaam, dus een andere HMAC) en telt mee
   in het plafond per actor. Een herhaling die het vorige credential teruggaf
   zou een geheim uit een cache heronthullen en het plafond omzeilen; daarom
   staan deze routes ook in lib/eenmalig-geheim-routes.js. Er verandert niets
   in de database. */
'use strict';
const OP = '2026-10-06';
const AF = { door: 'Claude, kern/rtc/ijs.js, de vier routes en hun poorten gelezen en tegen een echte coturn beproefd', op: OP };
const WAAROM = 'Elke oproep geeft een nieuw kortlevend TURN-credential en telt in het plafond per actor; een cache ' +
  'zou een uitgegeven geheim heronthullen en het plafond omzeilen. De route staat in lib/eenmalig-geheim-routes.js.';
const uitgifte = (mutatieId, toegang, gemeten) => ({ mutatieId, herkomst: 'mens',
  semantiek: { klasse: 'nietHerhaalbaar' }, toegang, stand: 'INTENTIONALLY_NON_IDEMPOTENT', waarom: WAAROM,
  bewijs: { gemeten, op: OP }, afgetekend: AF });

const CONTRACTEN = {
  'POST /api/ice': uitgifte('rtc.ijs.uitgeven',
    { klasse: 'PUBLIC', waarom: 'De router laat iedereen binnen omdat elke soort sessie (lid, personeel, zaak, ' +
      'kantoor) hier belt; de route stelt de actor zelf vast via resolveSession. Zonder geldige Bearer-sessie: 401 ' +
      'en alleen STUN, dus geen credential. De rem is het plafond per actor (kern/rtc/ijs.js).' },
    'test/rtc-relay.test.js: zonder sessie 401 zonder TURN, met een lid een credential met kloppende HMAC en ' +
    'ondoorzichtig label, en na het plafond 429; test/schild.test.js idem'),
  'POST /api/rtf/ice': uitgifte('rtc.ijs.gezin',
    { klasse: 'OBJECT_SCOPED', objectVeld: 'code', uitleg: 'gezinsPoort: het gezin uit het lijf plus een geldig profieltoken van dat gezin, geen gast; anders 403' },
    'test/rtc-relay.test.js: een vreemd profieltoken krijgt geen TURN'),
  'POST /api/foundation/gezin/ice': uitgifte('rtc.ijs.gezinsbellen',
    { klasse: 'OBJECT_SCOPED', objectVeld: 'code', uitleg: 'sessieVan: het gezin uit het lijf plus een geldig profieltoken van DAT gezin; anders 403' },
    'test/foundation.test.js: een gezinslid krijgt ijs-servers, een fout token 403'),
  'POST /api/foundation/school/ice': uitgifte('rtc.ijs.schoolbellen',
    { klasse: 'OBJECT_SCOPED', objectVeld: 'klasCode', uitleg: 'de leraar(token) of een ouder van een gezin in DEZE klas; anders 403' },
    'scripts/check.js regel 28 ziet de 403; de poort is dezelfde leraarQ/ouderQ als het belkanaal van de klas')
};

module.exports = { CONTRACTEN };
