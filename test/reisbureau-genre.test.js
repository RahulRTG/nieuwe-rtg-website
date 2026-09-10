/* HET REISBUREAU ALS KLANT -- het genre, niet de kamer.

   WAAROM DIT BESTAND ER IS. Van de vierenzeventig genres was er geen enkele
   waarin een reisbedrijf paste: wel `hotel`, `vervoer`, `ov` en `activiteiten`,
   maar niets voor wie die drie SAMENSTELT. Een extern reisbureau kon zich dus
   niet aanmelden -- geen zaakcode, geen leverancier-app, geen klantenboek, geen
   facturatie. "Run your entire travel business through RTG" kon letterlijk niet
   (TRAVELCOMMERCE.md par. 3).

   VIER BEWERINGEN, en ze kunnen alle vier zakken:

   1. het genre bestaat, is aanvraagbaar, en hangt onder de sector Reizen;
   2. de papieren hangen aan de HANDELING en niet aan het genre -- wie
      pakketreizen verkoopt heeft insolventiebescherming nodig, wie alleen
      adviseert niet, en een hotel dat een arrangement verkoopt heeft hem WEL;
   3. daarom staat reisbureau NIET op de bewijslijst van de acht gereguleerde
      genres; dat is een besluit met een reden, en wie het omdraait komt hier
      langs;
   4. het krijgt de gewone leverancier-app: geen kamers, geen deurverkoop.

   Draait zonder server: dit zijn allemaal pure registers en pure functies.
   Draai: npm test */
const test = require('node:test');
const assert = require('node:assert/strict');

const register = require('../server/seed/genres');
const controle = require('../server/kern/bedrijfscontrole');
const { modulesVoor, PER_CAP, PER_GENRE } = require('../server/kern/pda/modules');

test('1. het genre bestaat, is aanvraagbaar en woont in de sector Reizen', () => {
  const g = register.GENRES.reisbureau;
  assert.ok(g, 'het genre reisbureau staat in het register');
  assert.equal(g.industry, 'travel');
  assert.equal(register.SECTOREN.travel, 'Reizen', 'en die sector bestaat met een leesbare naam');
  assert.ok(register.aanvraagbareGenres().includes('reisbureau'),
    'een ondernemer kan hem aanvragen; een genre dat niemand kan kiezen is geen genre');
});

test('2. de papieren hangen aan de HANDELING en niet aan het genre', () => {
  const zonder = controle.eisenVoor('reisbureau', {}).map(e => e.id);
  const met = controle.eisenVoor('reisbureau', { pakketreis: true }).map(e => e.id);
  assert.ok(!zonder.includes('pakketreis'),
    'een reisbureau dat alleen adviseert hoeft geen garantieregeling');
  assert.ok(met.includes('pakketreis'),
    'wie pakketreizen verkoopt wel');

  /* En de andere kant op, want dat is de hele reden dat de eis aan de vlag
     hangt: een hotel dat een arrangement verkoopt, verkoopt een pakketreis. */
  const hotel = controle.eisenVoor('hotel', { pakketreis: true }).map(e => e.id);
  assert.ok(hotel.includes('pakketreis'),
    'de eis volgt de handeling, ook bij een genre dat niets met reizen te maken lijkt te hebben');
});

test('3. reisbureau staat NIET op de bewijslijst, en dat is een besluit', () => {
  const eisen = Object.keys(controle.BEWIJS_EISEN);
  assert.ok(!eisen.includes('reisbureau'),
    'de acht op die lijst zijn beroepen waar iemand zonder papier direct schade aanricht; ' +
    'bij reizen hangt het papier aan de handeling (toets 2). Wie reisbureau hier toevoegt, ' +
    'stelt dezelfde eis twee keer en mist hem tegelijk bij wie hem wel nodig heeft.');
  // de acht zelf blijven staan: dit is geen uitnodiging om de lijst te legen
  for (const genre of ['huisarts', 'apotheek', 'kinderopvang', 'beveiliging']) {
    assert.ok(eisen.includes(genre), genre + ' hoort wel op de bewijslijst');
  }
});

test('4. een reisbureau krijgt de gewone leverancier-app', () => {
  const g = register.GENRES.reisbureau;
  assert.deepEqual(modulesVoor({ type: 'reisbureau' }, g.caps), [],
    'geen eigen PDA-module: een reisbureau heeft geen kamers en geen deurverkoop');
  for (const cap of g.caps) {
    assert.ok(!PER_CAP[cap], 'cap "' + cap + '" hangt aan een PDA-module en hoort hier dus niet');
  }
  assert.ok(!PER_GENRE.reisbureau, 'en het genre zelf hangt er ook niet aan');
});
