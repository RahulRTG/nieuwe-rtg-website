/* Het actormodel van de communicatiekern (server/kern/comm/wie.js).

   WAAROM DIT DE TOETS IS DIE VOOR DE CODE UIT GING.

   De kern kende tot nu toe een soort deelnemer: een lid, met zijn kale
   sleutel. Elke andere partij die in dit huis praat -- een zaak, een collega
   op de werkvloer, het kantoor -- had daarom een eigen berichtenvoorraad, en
   dat is precies wat de kern moest opheffen. Dus gaat de deur open.

   Maar een deur die opengaat in een model waar de deelnemerslijst de ENIGE
   poort is (magErin), is de gevaarlijkste verbouwing van dit hele platform.
   Als een leverancier een sleutel kan kiezen, kiest hij die van een lid, en
   dan leest hij mee in een gesprek tussen twee mensen die hem niet kennen.
   Dat is geen bug die je terugdraait; dat is een datalek.

   Vier beloftes, en alle vier zijn ze een NEE:

   1. EEN SLEUTEL WORDT AFGELEID, NOOIT AANGELEVERD. Het actormodel maakt de
      sleutel uit de sessie (welke zaak, welke persoon). Er is geen weg waarop
      een verzoek zelf zegt wie het is.

   2. EEN LEDENSLEUTEL EN EEN ACTORSLEUTEL LOPEN NOOIT DOOR ELKAAR. De
      naamruimtes zijn gescheiden met een dubbele punt, en `lid()` WEIGERT een
      sleutel met een dubbele punt erin. Zou een ledensleutel die ooit krijgen,
      dan valt dat om met een fout in plaats van stil een zaak te worden.

   3. EEN ZAAK KOMT NIET IN HET GESPREK VAN EEN ANDERE ZAAK, en al helemaal
      niet in dat van twee leden. Ook niet met het gesprek-id in de hand.

   4. WIE ER NAMENS DE ZAAK ANTWOORDDE, BLIJFT BINNEN DE ZAAK. Het team ziet
      welke collega het typte; de klant ziet de zaak. Op een platform op
      codenaam is de naam van een medewerker geen bijzaak.

   Draait zonder server, op een nagemaakte database: dit gaat over het model
   zelf. De routes eromheen staan in comm.e2e.js. */
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const { maakComm } = require('../server/kern/comm');
const wie = require('../server/kern/comm/wie');

const ZAKEN = { AB12: 'Osteria Bianca', CD34: 'Hotel Nord' };
const LEDEN = { 'user-1': 'Amberen Vos', 'user-2': 'Noordelijke Ster' };
const MENSEN = { 7: 'Sanne', 9: 'Joris' };

function opzet() {
  const db = { data: {} };
  const comm = maakComm({
    db, save: () => {}, crypto,
    codenaamVan: (k) => LEDEN[k] || null,
    naamVan: wie.maakNaam({
      codenaamVan: (k) => LEDEN[k] || null,
      zaakNaam: (code) => ZAKEN[code] || null,
      mensNaam: (code, id) => MENSEN[id] || null
    })
  });
  return { db, comm };
}

/* ----------------------------------------- 1. afleiden, niet aanleveren */

test('de sleutel van een zaak komt uit de sessie en nergens anders vandaan', () => {
  /* Dit is de vorm die de route gebruikt: hij krijgt req.supplier en req.actor
     van supplierAuth (die de sessie las) en geeft die door. Er is geen
     parameter waar een verzoek zijn eigen sleutel in kwijt kan. */
  const uit = wie.vanZaak({ supplier: { code: 'AB12' }, actor: { staffId: 7 } });
  assert.equal(uit.zaak, 'zaak:AB12');
  assert.equal(uit.mens, 'mens:AB12:7');
  assert.deepEqual(uit.alle, ['zaak:AB12', 'mens:AB12:7']);

  // zonder persoonlijke login is er geen persoon, alleen de zaak
  const beheer = wie.vanZaak({ supplier: { code: 'AB12' }, actor: { staffId: null } });
  assert.equal(beheer.mens, null);
  assert.deepEqual(beheer.alle, ['zaak:AB12']);

  // en zonder zaak is er niets -- geen lege sleutel die toevallig ergens past
  assert.equal(wie.vanZaak({}), null);
  assert.equal(wie.vanZaak({ supplier: {} }), null);
});

/* --------------------------------- 2. de naamruimtes lopen niet door elkaar */

test('een ledensleutel met een dubbele punt erin valt om in plaats van een zaak te worden', () => {
  assert.equal(wie.lid('user-1'), 'user-1', 'een gewone ledensleutel blijft kaal');
  /* Deze regel is de hele reden dat lid() bestaat. Zou een ledensleutel ooit
     de vorm 'zaak:...' kunnen krijgen, dan zou ontleed() hem als een zaak
     lezen en zat er ineens iemand anders aan tafel. Liever een fout. */
  assert.throws(() => wie.lid('zaak:AB12'), /dubbele punt/i);
  assert.throws(() => wie.lid('van:alles'), /dubbele punt/i);
});

test('ontleed leest elke vorm terug, en een onbekende ruimte is geen actor', () => {
  assert.deepEqual(wie.ontleed('user-1'), { soort: 'lid', sleutel: 'user-1', code: null, nummer: null });
  assert.deepEqual(wie.ontleed('zaak:AB12'), { soort: 'zaak', sleutel: 'zaak:AB12', code: 'AB12', nummer: null });
  assert.deepEqual(wie.ontleed('mens:AB12:7'), { soort: 'mens', sleutel: 'mens:AB12:7', code: 'AB12', nummer: 7 });
  assert.deepEqual(wie.ontleed('kantoor'), { soort: 'kantoor', sleutel: 'kantoor', code: null, nummer: null });
  /* Een verzonnen ruimte levert null en geen half ingevulde actor: alles wat
     hierop leunt (mag deze sessie hierbij?) moet dan weigeren, niet gokken. */
  assert.equal(wie.ontleed('rechter:1'), null);
  assert.equal(wie.ontleed('mens:AB12'), null, 'een persoon zonder nummer is geen persoon');
  assert.equal(wie.ontleed(''), null);
  assert.equal(wie.ontleed(null), null);
});

/* De vierde soort kwam er later bij, en om een concrete reden: een
   sollicitatie kan van een RTF-GEZINSPROFIEL komen (een jongere die via zijn
   gezin solliciteert). Dat is geen lid -- het heeft geen ledensleutel en geen
   codenaam -- maar het is wel de ene kant van een echt gesprek. Zonder deze
   soort had de sollicitatiechat maar half kunnen verhuizen: leden wel,
   gezinsprofielen niet. Een halve verhuizing is twee voorraden. */
test('een gezinsprofiel is een eigen soort deelnemer, met zijn gezin in de sleutel', () => {
  assert.equal(wie.gezin('fam7', 3), 'gezin:FAM7:3');
  assert.deepEqual(wie.ontleed('gezin:FAM7:3'),
    { soort: 'gezin', sleutel: 'gezin:FAM7:3', code: 'FAM7', nummer: 3 });
  /* Net als bij een medewerker zit de CODE in de sleutel. Twee gezinnen met
     allebei een profiel 3 zijn twee verschillende mensen, en zonder de code
     zouden ze hetzelfde gesprek delen. */
  assert.notEqual(wie.gezin('FAM7', 3), wie.gezin('FAM8', 3));
  assert.equal(wie.ontleed('gezin:FAM7'), null, 'een profiel zonder nummer is geen profiel');
  // en een gezinsprofiel hoort bij geen enkele ZAAK, dus deelt het niets met een team
  assert.equal(wie.zelfdeZaak('gezin:FAM7:3', 'mens:FAM7:3'), false,
    'een gezinsprofiel en een medewerker met dezelfde code gelden als dezelfde zaak');
});

test('zelfdeZaak vergelijkt de zaak en niet de tekst', () => {
  assert.equal(wie.zelfdeZaak('zaak:AB12', 'mens:AB12:7'), true);
  assert.equal(wie.zelfdeZaak('mens:AB12:9', 'mens:AB12:7'), true);
  assert.equal(wie.zelfdeZaak('zaak:AB12', 'zaak:CD34'), false);
  assert.equal(wie.zelfdeZaak('zaak:AB12', 'user-1'), false, 'een lid hoort bij geen enkele zaak');
  assert.equal(wie.zelfdeZaak('user-1', 'user-1'), false, 'twee leden zijn geen zaak');
});

/* --------------------------------------------------- 3. de poort houdt stand */

test('een zaak komt niet in het gesprek van twee leden, ook niet met het id', () => {
  const { comm } = opzet();
  const g = comm.tussen('user-1', 'user-2');
  comm.bericht({ gesprekId: g.id, van: 'user-1', tekst: 'zie je zo' });

  for (const sleutel of ['zaak:AB12', 'mens:AB12:7', 'kantoor']) {
    assert.throws(() => comm.gesprek(sleutel, g.id), /niet van jou/i,
      sleutel + ' kon een gesprek van twee leden openen');
    assert.throws(() => comm.bericht({ gesprekId: g.id, van: sleutel, tekst: 'hallo' }), /niet van jou/i,
      sleutel + ' kon in een gesprek van twee leden schrijven');
  }
  assert.equal(comm.inbox('zaak:AB12').gesprekken.length, 0, 'het gesprek stond in de inbox van een zaak');
  assert.equal(comm.zoek('zaak:AB12', 'zo').treffers.length, 0, 'de zaak kon erin zoeken');
});

test('de ene zaak leest niet mee bij de andere', () => {
  const { comm } = opzet();
  const g = comm.gesprekMaak({ soort: 'order', deelnemers: ['user-1', 'zaak:AB12'],
    meta: { sleutel: 'bestelling:1' } });
  comm.bericht({ gesprekId: g.id, van: 'user-1', tekst: 'is de keuken nog open' });

  assert.equal(comm.inbox('zaak:AB12').gesprekken.length, 1, 'de eigen zaak zag zijn eigen bestelling niet');
  assert.equal(comm.inbox('zaak:CD34').gesprekken.length, 0);
  assert.throws(() => comm.gesprek('zaak:CD34', g.id), /niet van jou/i);
  /* En een medewerker van die andere zaak evenmin -- de persoonlijke sleutel
     is geen achterdeur op de zaaksleutel. */
  assert.throws(() => comm.gesprek('mens:CD34:7', g.id), /niet van jou/i);
});

test('een medewerker komt bij de zaak binnen omdat zijn sessie de zaaksleutel draagt, niet omdat hij het vraagt', () => {
  const { comm } = opzet();
  const g = comm.gesprekMaak({ soort: 'order', deelnemers: ['user-1', 'zaak:AB12'] });

  /* De persoonlijke sleutel staat NIET in het gesprek: een bestelling is van
     de zaak, niet van wie er die dag staat. Dat de medewerker hem toch mag
     lezen, komt doordat zijn sessie ook de zaaksleutel draagt (vanZaak.alle)
     -- en dat is een afgeleide, geen keuze van de medewerker. */
  assert.throws(() => comm.gesprek('mens:AB12:7', g.id), /niet van jou/i);
  const mag = wie.vanZaak({ supplier: { code: 'AB12' }, actor: { staffId: 7 } });
  const sleutel = mag.alle.find((s) => comm.magErin(g, s));
  assert.equal(sleutel, 'zaak:AB12');
  assert.equal(comm.gesprek(sleutel, g.id).id, g.id);
});

test('een collega-gesprek is van de twee collegas, niet van de hele zaak', () => {
  const { comm } = opzet();
  const g = comm.gesprekMaak({ soort: 'project', deelnemers: ['mens:AB12:7', 'mens:AB12:9'] });
  comm.bericht({ gesprekId: g.id, van: 'mens:AB12:7', tekst: 'neem jij de late dienst' });

  assert.equal(comm.gesprek('mens:AB12:9', g.id).berichten.length, 1);
  /* De zaaksleutel zit in de sessie van ELKE medewerker. Stond die ook in een
     collega-DM, dan las het halve team mee in een gesprek tussen twee mensen.
     Hij staat er dus niet in, en de poort houdt dat vast. */
  assert.throws(() => comm.gesprek('zaak:AB12', g.id), /niet van jou/i);
  assert.throws(() => comm.gesprek('mens:AB12:3', g.id), /niet van jou/i);
});

/* ------------------------------------- 4. de naam van de medewerker blijft binnen */

test('de klant ziet de zaak, het team ziet de collega die antwoordde', () => {
  const { comm } = opzet();
  const g = comm.gesprekMaak({ soort: 'order', deelnemers: ['user-1', 'zaak:AB12'] });
  comm.bericht({ gesprekId: g.id, van: 'zaak:AB12', door: 'mens:AB12:7',
    tekst: 'de keuken draait tot elf uur' });

  const bijKlant = comm.gesprek('user-1', g.id).berichten[0];
  assert.equal(bijKlant.van, 'Osteria Bianca', 'de klant hoort de zaak te zien');
  assert.equal(bijKlant.door, null, 'de naam van de medewerker lekte naar de klant');

  const bijTeam = comm.gesprek('zaak:AB12', g.id).berichten[0];
  assert.equal(bijTeam.van, 'Osteria Bianca');
  assert.equal(bijTeam.door, 'Sanne', 'het team kon niet zien wie er antwoordde');
});

test('een lid heet bij zijn codenaam en een zaak bij zijn zaaknaam', () => {
  const { comm } = opzet();
  const g = comm.gesprekMaak({ soort: 'order', deelnemers: ['user-1', 'zaak:AB12'] });
  assert.equal(comm.gesprek('user-1', g.id).titel, 'Osteria Bianca');
  assert.equal(comm.gesprek('zaak:AB12', g.id).titel, 'Amberen Vos');
  /* De echte naam van het lid staat in de kluis (accounts.js) en komt hier
     langs geen enkele weg naar buiten -- ook niet bij een zakelijke partij. */
  assert.equal(comm.gesprek('zaak:AB12', g.id).deelnemers.join(), 'Amberen Vos');
});
