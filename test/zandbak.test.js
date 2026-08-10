/* De zandbak (kern/command/zandbak.js): een proces proeven zonder ook maar één
   productierij aan te raken.

   WAT DEZE TOETS VOORAL BEWAAKT is de ISOLATIE, en dan van twee kanten. Naar
   binnen: er komt niets uit de productiegegevens in een zandbak, ook niet als
   die gegevens er staan. Naar buiten: een recept dat in een zandbak nat draait
   verandert de productie niet -- en dat moet blijken uit een geval waarin
   hetzelfde recept op de echte gegevens WEL iets zou raken. Zonder die
   tegenproef zou de toets ook groen blijven als het recept helemaal niets doet.

   MUTATIES die zijn gedraaid en welke toets erop zakte (LAT.md regel 2):
   - de laag het echte db-object geven in plaats van het venster
     -> "een recept in de zandbak laat de productie ongemoeid" ZAKT (RAAK)
   - maak() de productiegegevens laten kopiëren in plaats van de zaaiset
     -> "er komt niets uit de productie in een zandbak" ZAKT (RAAK)
   - de vervaltermijn niet meer opruimen in veeg()
     -> "een verlopen zandbak wordt opgeruimd" ZAKT (RAAK)

   Draai: npm test */
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const { maakRegister } = require('../server/kern/command/register');
const { maakZandbak } = require('../server/kern/command/zandbak');

/* Twee werelden met dezelfde vorm: de productie en de zaaiset. De namen
   verschillen expres, zodat elke verwisseling meteen zichtbaar is. */
const REGISTER = maakRegister([
  { type: 'bestelling', label: 'Bestelling', meervoud: 'bestellingen', domein: 'handel',
    collectie: 'orders', sleutel: 'ref', zoek: ['ref', 'status'], titel: r => 'Bestelling ' + r.ref }
]);

const RECEPT = {
  RUNBOOKS: [{
    id: 'stations-klaar', naam: 'Openstaande bestellingen afronden', wat: 'zet status op klaar',
    type: 'bestelling', veld: 'status', naar: 'klaar', actie: 'status zetten',
    past: (r) => r.status === 'open', terugDraaibaar: true, klantImpact: false,
    titel: (r) => 'Bestelling ' + r.ref
  }]
};

function maak() {
  const db = { data: {
    orders: [{ ref: 'ECHT-1', status: 'open' }, { ref: 'ECHT-2', status: 'open' }]
  } };
  const zaai = () => ({ orders: [{ ref: 'ZAAI-1', status: 'open' }, { ref: 'ZAAI-2', status: 'klaar' }] });
  const zandbak = maakZandbak({ db, save: () => {}, crypto, zaai, register: REGISTER, catalogus: RECEPT });
  return { db, zandbak };
}

test('er komt niets uit de productie in een zandbak', () => {
  /* DE KERN NAAR BINNEN. Een zandbak die "de echte gegevens, maar dan een
     kopie" zou zijn, zet persoonsgegevens in precies de omgeving waar mensen
     dingen mogen proberen. Dan is de zandbak zelf het datalek. */
  const { zandbak } = maak();
  assert.equal(zandbak.maak('proef', { door: 'ik' }).zandbak.objecten, 2);
  const uit = zandbak.laag('proef').zoek('ECHT');
  assert.equal(uit.totaal, 0, 'de productierijen zijn onvindbaar in de zandbak');
  assert.ok(zandbak.laag('proef').zoek('ZAAI').totaal >= 1, 'de zaairijen wel');
});

test('een recept in de zandbak laat de productie ongemoeid', () => {
  const { db, zandbak } = maak();
  zandbak.maak('proef', { door: 'ik' });
  const l = zandbak.laag('proef');
  const r = l.runbooks.voer('stations-klaar', { droog: false, door: 'ik', reden: 'proef' });
  assert.equal(r.run.geraakt, 1, 'in de zandbak wordt echt geschreven: ' + JSON.stringify(r.error || r.run));
  assert.equal(r.run.voorbeelden[0].id, 'ZAAI-1');
  assert.equal(db.data.zandbakken.proef.data.orders[0].status, 'klaar',
    'en de zaairij is echt veranderd, niet alleen gemeld');

  /* DE TEGENPROEF. Hetzelfde recept zou op de echte gegevens WEL iets doen --
     er staan twee open bestellingen. Blijven die open, dan is dat de isolatie
     en niet een recept dat toevallig niets deed. */
  assert.deepEqual(db.data.orders.map(o => o.status), ['open', 'open'],
    'de productiebestellingen staan onaangeroerd op open');
});

test('de zandbak schrijft zijn eigen sporen in zijn eigen vak', () => {
  const { db, zandbak } = maak();
  zandbak.maak('proef', { door: 'ik' });
  zandbak.laag('proef').runbooks.voer('stations-klaar', { droog: false, door: 'ik', reden: 'proef' });
  assert.equal(db.data.commandJournaal, undefined, 'niets in het journaal van de productie');
  const eigen = db.data.zandbakken.proef.eigen;
  assert.ok(eigen && Array.isArray(eigen.commandJournaal) && eigen.commandJournaal.length >= 1,
    'wel in het journaal van de zandbak');
});

test('een lege zandbak zegt dat hij leeg is', () => {
  /* In productie start de zaaiset bewust zonder demogegevens. Dan is een lege
     zandbak de normale uitkomst en geen storing, en dat hoort er te staan. */
  const db = { data: {} };
  const z = maakZandbak({ db, save: () => {}, crypto, zaai: () => ({}), register: REGISTER, catalogus: RECEPT });
  const k = z.maak('leeg', { door: 'ik' }).zandbak;
  assert.equal(k.objecten, 0);
  assert.match(k.let, /RTG_DEMO/);
});

test('een verlopen zandbak wordt opgeruimd', () => {
  const { db, zandbak } = maak();
  zandbak.maak('oud', { door: 'ik', dagen: 1 });
  db.data.zandbakken.oud.vervalt = new Date(Date.now() - 1000).toISOString();
  zandbak.maak('nieuw', { door: 'ik' });
  const l = zandbak.lijst();
  assert.deepEqual(l.zandbakken.map(z => z.naam), ['nieuw'],
    'een zandbak zonder eind blijft liggen tot iemand hem voor productie aanziet');
  assert.equal(db.data.zandbakken.oud, undefined);
});

test('namen en aantallen zijn begrensd', () => {
  const { zandbak } = maak();
  assert.equal(zandbak.maak('', {}).status, 400);
  zandbak.maak('Proef Een!', { door: 'ik' });
  assert.ok(zandbak.lijst().zandbakken.some(z => z.naam === 'proef-een-'), 'de naam wordt schoongemaakt');
  assert.equal(zandbak.maak('proef-een-', {}).status, 409, 'twee keer dezelfde naam kan niet');
  for (let i = 0; i < zandbak.MAX_ZANDBAKKEN; i++) zandbak.maak('vul-' + i, { door: 'ik' });
  const vol = zandbak.maak('een-te-veel', { door: 'ik' });
  assert.equal(vol.status, 409);
  assert.match(vol.error, /niet gratis in opslag/);
});

test('opruimen kan met de hand en een onbekende zandbak is een 404', () => {
  const { zandbak } = maak();
  zandbak.maak('proef', { door: 'ik' });
  assert.equal(zandbak.weg('proef', 'ik').weg, true);
  assert.equal(zandbak.weg('proef', 'ik').status, 404);
  assert.equal(zandbak.laag('bestaatniet'), null);
});
