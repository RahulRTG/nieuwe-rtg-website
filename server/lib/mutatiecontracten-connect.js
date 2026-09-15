/* FOUNDATION CONNECT -- de mutatiecontracten van de tweeentwintig deuren.

   TWEE TOEGANGSKLASSEN EN DAT IS DE HELE STRUCTUUR. Elke functie heeft een
   ledendeur (`auth`, klasse AUTHENTICATED) en de meeste ook een gezinsdeur
   (`gezinsPoort`, klasse OBJECT_SCOPED: het gezin staat in het lijf, het token
   bewijst het). Ze roepen DEZELFDE functies aan -- zelfde vorm en zelfde reden
   als /api/knelpunt naast /api/rtf/knelpunt: zou er een tweede motor komen
   "voor gezinnen", dan kan een kind een ander antwoord krijgen dan een lid
   zonder dat iemand dat heeft besloten.

   ZE STAAN HIER PER PAAR EN NIET PER STUK, en dat is een afwijking van
   ./mutatiecontracten-knelpunt.js die daar met opzet twee losse contracten
   schreef. Het verschil: daar ging het om EEN route die een tweede deur kreeg,
   hier om een LAAG die van meet af aan twee deuren heeft. Een lijst van
   tweeentwintig contracten waarvan elf letterlijke kopieen zijn met een ander
   pad, is een lijst die niemand naloopt. Wat per deur verschilt -- de
   toegangsklasse -- staat daarom per regel, en wat gedeeld is een keer.

   DE MEERDERHEID LEEST. Twaalf van de tweeentwintig veranderen niets; waarom
   dat is nagekeken en wat er eerst mis mee was, staat in
   ./idemsleutels-connect.js. */
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
  /* ---------------------------------------------------------- de ontdeklus */
  'POST /api/connect/ontdek': leest('connect.ontdek', LID,
    'stelt de lijst samen uit kern/leerstof.js en kern/rtfos/publiek.js. De sessiesleutel opent de ' +
    'voorkeuren en gaat NERGENS anders heen: de bronnen krijgen `onderwerpen`, `plaats` en `vandaag`, ' +
    'en geen codenaam -- dezelfde knip als vondsten(voorwaarde) in de aanvoerlaag. De uitkomst schuift ' +
    'per DAG en niet per verzoek, dus twee oproepen op dezelfde dag geven hetzelfde.'),
  'POST /api/rtf/connect/ontdek': leest('connect.ontdek.gezin', GEZIN,
    'dezelfde functie als POST /api/connect/ontdek; alleen de deur verschilt, juist zodat een gezin ' +
    'nooit een ander antwoord kan krijgen dan een lid.'),
  'POST /api/connect/uitleg': leest('connect.uitleg', LID,
    'geeft de werkwoorden, de motoren en de bruggen terug -- de vaste lijsten uit kern/connect/, zodat ' +
    'een scherm ze niet overtypt. Achter auth omdat een open route die de motoren opsomt een gratis ' +
    'kaart is van hoe de mixer werkt.'),
};

module.exports = { CONTRACTEN };
