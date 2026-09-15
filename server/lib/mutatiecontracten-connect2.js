/* FOUNDATION CONNECT -- de mutatiecontracten, deel twee: het leerdossier
   en de naklank.

   Uit ./mutatiecontracten-connect.js geknipt op de 10 kB-grens
   (keuringsregel 13). De knip loopt langs een echte naad: deel een is de
   ONTDEKLUS (de lijst samenstellen en de uitleg erbij), dit is alles wat een
   mens VAN ZICHZELF vastlegt of terugleest.

   De twee toegangsklassen en de bouwstenen staan hier opnieuw en niet
   geimporteerd. Dat is met opzet: ./idemsleutels-eenmaal.js bewaakt dat een
   route niet in twee zijbestanden staat, en een gedeelde bouwsteen tussen twee
   registerbestanden maakt de ene stil afhankelijk van de volgorde van de
   andere. Twee regels overtypen is hier goedkoper dan een draad terug.
   ========================================================================== */
'use strict';

const { AFGETEKEND, OP: DATUM } = require('./mutatiecontracten-connect-op');
const OP = 'Claude, ' + DATUM;

/* De twee deuren, als bouwsteen zodat ze niet elf keer worden overgetypt. */
const LID = { klasse: 'AUTHENTICATED',
  uitleg: 'een ingelogd lid; de sessiesleutel is het enige dat de handler van de mens krijgt.' };
const GEZIN = { klasse: 'OBJECT_SCOPED', objectVeld: 'code',
  uitleg: 'het gezin uit `code`, en alleen met het `token` dat bij DAT gezin hoort -- ' +
    'rtf.verifieerProfiel() keurt het paar. De code wijst het object aan, het token bewijst het. ' +
    'GASTEN ERUIT, zoals de naam `gezinsPoort` in kern/handlerpoorten/buiten.js verklaart: elke deur ' +
    'hier bewaart iets van de mens zelf, en een gastprofiel heeft geen codenaam om dat aan te hangen ' +
    '(foundation/gezinshulp.js roept ensureCodenaam juist niet aan voor een gast). Anders dan bij ' +
    '/api/rtf/knelpunt, dat rekent en niets bewaart.' };

/* Een leesroute: verandert niets, dus een tweede aanroep is per definitie
   dezelfde handeling. `stand: NOT_APPLICABLE` om dezelfde reden als bij de
   knelpuntmotor -- er is geen toestand om te bewaken. */
const leest = (id, toegang, wat) => ({
  mutatieId: id, herkomst: 'mens',
  semantiek: { klasse: 'idempotent' },
  toegang, stand: 'NOT_APPLICABLE',
  nagekeken: OP + ': ' + wat + ' Schrijft niets: de drie lezers van kern/connect/ hebben naast hun ' +
    'schrijver een peil()-functie die geen rij aanmaakt. Dat was eerst NIET zo -- horizon, dossier en ' +
    'naklank-tel lieten db.data groeien zodra iemand keek, zonder save(), dus onzichtbaar tot een ' +
    'andere handeling toevallig opsloeg.',
  bewijs: {
    gemeten: 'npm run lusproef, schakel 15 (15 september 2026): een VERS lid leest zijn horizon en ' +
      'zijn dossier twee keer, en houdt daarna nog steeds een leeg dossier en de standaardschuif 40 -- ' +
      'lezen laat dus geen stand achter. De andere helft is niet van buitenaf te zien en staat in ' +
      'test/connect.test.js toets 16: na vier leesaanroepen is db.data letterlijk leeg ({}) en is save() ' +
      'nul keer aangeroepen. Die toets zakt op een mutatie die peil() terugzet naar van().',
    op: OP
  },
  afgetekend: AFGETEKEND
});

/* Een schrijfroute die samenvalt: tweede aanroep, zelfde uitkomst, geen tweede
   regel. Waar dat vandaan komt staat per geval in `hoe`. */
const valtSamen = (id, toegang, hoe) => ({
  mutatieId: id, herkomst: 'mens',
  semantiek: { klasse: 'idempotent' },
  /* PROTECTED en niet ENFORCED: die eerste is de naam die
     kern/mutatiecontract/klassen.js kent, en dit huis heeft er zes. Beschermd
     door de sleutel die in ./idemsleutels-connect.js staat -- de poort speelt
     binnen het dubbeltikvenster het eerste antwoord terug, en de kern vangt de
     herhaling daarbuiten nog een keer op. */
  toegang, stand: 'PROTECTED',
  nagekeken: OP + ': ' + hoe,
  bewijs: {
    gemeten: 'npm run lusproef (15 september 2026) plus test/connect.test.js: de tweede aanroep laat ' +
      'geen tweede regel of teller achter. Bij `open` is dat toets 13 (nieuw:false, en de derde regel ' +
      'komt er niet bij), bij `naklank` toets 15 (dezelfde map-sleutel), bij `naklank/weg` storing 9 ' +
      '(terugnemen wat er niet staat geeft ok zonder effect).',
    op: OP
  },
  afgetekend: AFGETEKEND
});

const CONTRACTEN = {
  /* -------------------------------------------------------- het leerdossier */
  'POST /api/connect/dossier': leest('connect.dossier', LID,
    'alleen het EIGEN dossier: er is geen parameter waarmee je een ander opgeeft, en geen functie die ' +
    'over sleutels heen leest (HDI.md par. 5.1).'),
  'POST /api/rtf/connect/dossier': leest('connect.dossier.gezin', GEZIN,
    'het dossier van DIT gezinsprofiel. De sleutel is rtf:CODE:profiel (foundation/gezinshulp.js) en ' +
    'kan per constructie niet botsen met een ledensleutel.'),

  'POST /api/connect/noteer': {
    mutatieId: 'connect.noteer', herkomst: 'mens',
    /* NIET IDEMPOTENT, EN DAT IS EEN BESLUIT PER TREDE. `begrepen` valt samen
       (de kern geeft ok:true, nieuw:false), `geoefend` en `toegepast` niet:
       twee keer iets toepassen zijn twee keer, en die samenvoegen gooit er stil
       een weg. De poort mag hier dus niets terugspelen. */
    semantiek: { klasse: 'nietHerhaalbaar' },
    toegang: LID, stand: 'INTENTIONALLY_NON_IDEMPOTENT',
    waarom: 'Een tweede aanroep IS hier een tweede gebeurtenis, en die keuze valt per TREDE. ' +
      '`begrepen` valt samen (kern/connect/tredenlijst.js draagt `eenmalig`, en de kern geeft ' +
      'ok:true met nieuw:false), maar `geoefend` en `toegepast` niet: twee keer iets toepassen zijn ' +
      'twee keer, en die samenvoegen gooit er stil een weg. Een sleutel op de poort zou het antwoord ' +
      'van de eerste tik terugspelen en daarmee juist die tredebeslissing overslaan.',
    nagekeken: OP + ': de trede bepaalt het gedrag, niet de route. `door` staat hier hard op "zelf", ' +
      'dus de treden die het SYSTEEM of een ANDER schrijft (gezien, geoefend, gemaakt, onderwezen) ' +
      'worden door kern/connect/leerdossier.js geweigerd -- een mens kan zijn eigen `onderwezen` niet ' +
      'zetten, en dat is precies wat die trede buiten Foundation iets waard maakt.',
    bewijs: { gemeten: 'npm run lusproef (15 september 2026): de lus is met twee leden, een gezinsbeheerder en een kindprofiel volledig gelopen -- 14 van 15 schakels gesloten en 10 van 10 storingen gehouden. Deze route is met opzet NIET samen te vatten; de reden staat in server/lib/idemsleutels-connect.js.', op: OP },
    afgetekend: AFGETEKEND
  },
  'POST /api/rtf/connect/noteer': {
    mutatieId: 'connect.noteer.gezin', herkomst: 'mens',
    semantiek: { klasse: 'nietHerhaalbaar' },
    toegang: GEZIN, stand: 'INTENTIONALLY_NON_IDEMPOTENT',
    waarom: 'Zelfde handler, zelfde tredebeslissing en dus dezelfde reden als POST /api/connect/noteer.',
    nagekeken: OP + ': zelfde handler en zelfde grendel als POST /api/connect/noteer.',
    bewijs: { gemeten: 'npm run lusproef (15 september 2026): de lus is met twee leden, een gezinsbeheerder en een kindprofiel volledig gelopen -- 14 van 15 schakels gesloten en 10 van 10 storingen gehouden. Deze route is met opzet NIET samen te vatten; de reden staat in server/lib/idemsleutels-connect.js.', op: OP },
    afgetekend: AFGETEKEND
  },

  'POST /api/connect/open': valtSamen('connect.open', LID,
    'schrijft de trede `gezien`, en die is EENMALIG per ding (kern/connect/tredenlijst.js). Twee keer ' +
    'openen is geen twee feiten; een dossier dat per opening een regel bijschrijft is een kijklog ' +
    'geworden -- precies waar de eerste trede voor waarschuwt. De tweede tik komt terug met ' +
    'nieuw:false en is geen fout.'),
  'POST /api/rtf/connect/open': valtSamen('connect.open.gezin', GEZIN,
    'zelfde handler en zelfde eenmalig-regel als POST /api/connect/open.'),

  /* ------------------------------------------------------------- de naklank */
  'POST /api/connect/naklank': valtSamen('connect.naklank', LID,
    'een naklank van dezelfde mens op hetzelfde ding is EEN naklank: de opslag is een map op ' +
    'codenaam, dus een tweede tik overschrijft dezelfde sleutel. Alleen de EERSTE laat de haak naar ' +
    'het leerdossier lopen (`nieuw`), zodat `geholpen` niet twee regels bij de maker oplevert. ' +
    'ER GAAT ALLEEN EEN id EN EEN soort NAAR BINNEN: hier stonden ook `maker` en `onderwerp` uit het ' +
    'lijf, en daarmee kon iedereen een regel `onderwezen` in het dossier van een willekeurig ander ' +
    'schrijven -- de enige trede met bewijskracht. De kern zoekt de maker nu op en weigert de haak ' +
    'als hij het ding niet thuis kan brengen. Gevonden door scripts/lusproef.js, schakel 8.'),
  'POST /api/rtf/connect/naklank': valtSamen('connect.naklank.gezin', GEZIN,
    'zelfde handler en zelfde map-sleutel als POST /api/connect/naklank.'),
  'POST /api/connect/naklank/weg': valtSamen('connect.naklank.weg', LID,
    'terugnemen wat er niet staat, is geen fout: de route geeft ok:true met weg:false. Een uitweg met ' +
    'voorwaarden is geen uitweg.'),
  'POST /api/connect/naklank/tel': leest('connect.naklank.tel', LID,
    'zes aantallen en wat ze NIET zeggen. Er is met opzet geen veld `totaal` en geen `score`: een ' +
    'samengesteld getal verbergt welke van de zes bewoog.'),
};

module.exports = { CONTRACTEN };
