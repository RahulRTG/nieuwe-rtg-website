/* FOUNDATION CONNECT -- de mutatiecontracten, deel drie: de horizon en de kring.

   Uit ./mutatiecontracten-connect2.js geknipt op de 10 kB-grens
   (keuringsregel 13), en de knip loopt langs dezelfde soort naad als de vorige:
   deel een is de ONTDEKLUS, deel twee wat een mens van zichzelf VASTLEGT, en dit
   is wat hij INSTELT. Dat laatste is een eigen soort: de horizon en de kring
   bewaren geen gebeurtenis maar een keuze, en de kring bewaart zelfs dat niet --
   kern/connect/kring.js REKENT alleen.

   De bouwstenen staan hier opnieuw en niet geimporteerd, om dezelfde reden als
   in deel twee: ./idemsleutels-eenmaal.js bewaakt dat een route niet in twee
   zijbestanden staat, en een gedeelde bouwsteen tussen registerbestanden maakt
   de ene stil afhankelijk van de volgorde van de andere.
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
  /* ------------------------------------------------------------- de horizon */
  'POST /api/connect/horizon': leest('connect.horizon', LID,
    'de schuif en de onderwerpen die de mens ZELF heeft aangeklikt. Gesorteerd op naam en niet op ' +
    'gewicht: een lijst van je eigen interesses op volgorde van sterkte is een ranglijst van jezelf.'),
  'POST /api/rtf/connect/horizon': leest('connect.horizon.gezin', GEZIN,
    'zelfde functie, gezinsdeur.'),
  'POST /api/connect/schuif': valtSamen('connect.schuif', LID,
    'zet een getal van 0 tot 100. Twee keer dezelfde waarde is dezelfde stand; buiten bereik weigert ' +
    'de kern met de reden.'),
  'POST /api/connect/signaal': {
    mutatieId: 'connect.signaal', herkomst: 'mens',
    /* Twee keer "meer hiervan" betekent meer dan een keer. Het loopt niet weg:
       kern/connect/horizon.js knijpt af op +-3. */
    semantiek: { klasse: 'nietHerhaalbaar' },
    toegang: LID, stand: 'INTENTIONALLY_NON_IDEMPOTENT',
    waarom: 'Twee keer "meer hiervan" betekent meer dan een keer. Wie die twee samenvoegt, gooit er ' +
      'stil een weg en noemt dat een verbetering. Het loopt niet weg: kern/connect/horizon.js knijpt ' +
      'af op +-3, dus honderd keer drukken betekent hetzelfde als drie keer.',
    nagekeken: OP + ': het signaal `verras` schrijft NIETS -- hij komt terug als `eenmalig` en de ' +
      'aanroeper geeft hem door aan de mixer. Een knop die stilletjes je instelling verandert, is ' +
      'precies de manipulatie waar deze laag tegen is. De vier andere schuiven een gewicht op, ' +
      'begrensd op +-3.',
    bewijs: { gemeten: 'npm run lusproef (15 september 2026): de lus is met twee leden, een gezinsbeheerder en een kindprofiel volledig gelopen -- 14 van 15 schakels gesloten en 10 van 10 storingen gehouden. Deze route is met opzet NIET samen te vatten; de reden staat in server/lib/idemsleutels-connect.js.', op: OP },
    afgetekend: AFGETEKEND
  },
  'POST /api/rtf/connect/signaal': {
    mutatieId: 'connect.signaal.gezin', herkomst: 'mens',
    semantiek: { klasse: 'nietHerhaalbaar' },
    toegang: GEZIN, stand: 'INTENTIONALLY_NON_IDEMPOTENT',
    waarom: 'Zelfde handler en zelfde begrenzing als POST /api/connect/signaal.',
    nagekeken: OP + ': zelfde handler en zelfde begrenzing als POST /api/connect/signaal.',
    bewijs: { gemeten: 'npm run lusproef (15 september 2026): de lus is met twee leden, een gezinsbeheerder en een kindprofiel volledig gelopen -- 14 van 15 schakels gesloten en 10 van 10 storingen gehouden. Deze route is met opzet NIET samen te vatten; de reden staat in server/lib/idemsleutels-connect.js.', op: OP },
    afgetekend: AFGETEKEND
  },

  /* --------------------------------------------------------------- de kring */
  /* DEZE VIER REKENEN ALLEEN. kern/connect/kring.js bewaart niets: hij krijgt
     een huidige en een gewenste kring en geeft terug of dat mag. Waar de kring
     van een gemaakt ding LANDT, is de zaak van het domein dat dat ding bezit --
     deze laag is de poort en niet de opslag. */
  'POST /api/connect/kring': leest('connect.kring', LID,
    'rekent uit of een kring verbreed mag worden. De `beschermd`-vlag komt UIT de sessie en nooit uit ' +
    'het lijf; zou hij uit req.body mogen komen, dan zet een kind hem zelf op false.'),
  'POST /api/rtf/connect/kring': leest('connect.kring.gezin', GEZIN,
    'zelfde berekening, en dit is de deur waar het om gaat: alleen de gezinssessie weet of een profiel ' +
    'minderjarig is, en die vlag houdt een kind binnen de kring `team`.'),
  'POST /api/connect/kring/keuzes': leest('connect.kring.keuzes', LID,
    'de vijf kringen met per stuk of hij open staat en zo niet waarom -- geen grijze knop zonder ' +
    'uitleg (GRAMMATICA.md).'),
  'POST /api/rtf/connect/kring/keuzes': leest('connect.kring.keuzes.gezin', GEZIN,
    'zelfde lijst, gezinsdeur.')
};

module.exports = { CONTRACTEN };
