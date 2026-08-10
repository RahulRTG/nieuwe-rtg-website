/* De API-poort (kern/command/apipoort.js): sleutels, scopes, quota en
   contractregels voor koppelingen.

   WAT DEZE TOETS VOORAL BEWAAKT zijn vier dingen die allemaal onzichtbaar
   kapot kunnen gaan:

   1. DE TOELATING IS EEN GRENS EN GEEN SUGGESTIE. Een scope buiten de toelating
      levert GEEN ingeperkte sleutel op maar een weigering. Stil inperken geeft
      een koppeling die denkt dat hij ergens bij mag en dat pas in productie
      merkt.
   2. HET GEHEIM STAAT NERGENS. Wat bewaard wordt is een hash met zout; het
      geheim gaat één keer mee terug.
   3. HET QUOTUM OVERLEEFT EEN HERSTART. Hij staat in de opslag en niet in het
      geheugen -- en juist een koppeling die te hard loopt, veroorzaakt de
      herstart.
   4. UITFASERING WORDT AANGEKONDIGD VOORDAT HIJ BIJT. Tot de datum werkt het
      pad en zegt het antwoord dat hij verdwijnt; daarna weigert hij met
      dezelfde reden.

   MUTATIES die zijn gedraaid en welke toets erop zakte (LAT.md regel 2):
   - scopes buiten de toelating stil inperken in plaats van weigeren
     -> "een scope buiten de toelating levert geen sleutel op" ZAKT (RAAK)
   - de quotateller in het geheugen zetten in plaats van in de opslag
     -> "het quotum overleeft een herstart" ZAKT (RAAK)
   - de uitfaseringsdatum negeren
     -> "een uitgefaseerd pad weigert, en kondigde dat aan" ZAKT (RAAK)

   Draai: npm test */
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const { maakApiPoort } = require('../server/kern/command/apipoort');

function maak() {
  const db = { data: {} };
  const regels = [];
  const poort = maakApiPoort({ db, save: () => {}, crypto,
    journaal: { noteer: r => regels.push(r) } });
  return { db, poort, regels };
}

function metSleutel(poort, opties) {
  poort.laatToe('/api/extern/aanbod', { versie: 'v1' }, 'ik');
  const r = poort.maak('Koppeling', [{ pad: '/api/extern/aanbod', methoden: ['GET'] }],
    Object.assign({ door: 'ik' }, opties || {}));
  return r;
}

test('zonder toelating staat er niets achter de poort, en dat wordt gezegd', () => {
  const { poort } = maak();
  const st = poort.stand();
  assert.equal(st.toelating.length, 0);
  assert.match(st.let, /besluit en geen omissie/);
  assert.equal(poort.maak('X', [{ pad: '/api/extern/iets' }], { door: 'ik' }).status, 403);
});

test('een scope buiten de toelating levert geen sleutel op', () => {
  /* DE KERN. Stil inperken zou een koppeling opleveren die denkt dat hij ergens
     bij mag en dat pas in productie merkt. */
  const { poort } = maak();
  poort.laatToe('/api/extern/aanbod', {}, 'ik');
  const r = poort.maak('Koppeling', [
    { pad: '/api/extern/aanbod' },
    { pad: '/api/leden' }
  ], { door: 'ik' });
  assert.equal(r.status, 403);
  assert.match(r.error, /buiten de toelating/);
  assert.equal(poort.stand().sleutels.length, 0, 'er is ook geen half-ingeperkte sleutel gemaakt');
});

test('het geheim gaat één keer mee terug en staat nergens', () => {
  const { db, poort } = maak();
  const r = metSleutel(poort);
  assert.match(r.geheim, /^RTG-[a-z0-9-]+\./);
  const bewaard = JSON.stringify(db.data.apiPoort.sleutels);
  assert.ok(!bewaard.includes(r.geheim.split('.')[1]), 'het geheim zelf staat niet in de opslag');
  assert.ok(bewaard.includes('"hash"') && bewaard.includes('"zout"'));
  assert.equal(poort.stand().sleutels[0].geheim, undefined, 'en de stand toont het niet');
});

test('een geldige sleutel komt binnen zijn scope binnen en daarbuiten niet', () => {
  const { poort } = maak();
  const r = metSleutel(poort);
  const goed = poort.apiSleutelOk(r.geheim, '/api/extern/aanbod/lijst', 'GET');
  assert.equal(goed.ok, true);
  assert.equal(goed.versie, 'v1');
  assert.ok(goed.rest > 0, 'het resterende quotum komt mee');

  assert.equal(poort.apiSleutelOk(r.geheim, '/api/extern/aanbod', 'POST').status, 403, 'verkeerde methode');
  assert.equal(poort.apiSleutelOk(r.geheim, '/api/leden', 'GET').status, 403, 'buiten de scope');
  assert.equal(poort.apiSleutelOk('RTG-onzin.abc', '/api/extern/aanbod', 'GET').status, 401);
  assert.equal(poort.apiSleutelOk('geen sleutel', '/api/extern/aanbod', 'GET').status, 401);

  /* Een bijna-goed geheim telt niet, en wordt geteld. */
  const bijna = r.geheim.slice(0, -1) + (r.geheim.slice(-1) === 'a' ? 'b' : 'a');
  assert.equal(poort.apiSleutelOk(bijna, '/api/extern/aanbod', 'GET').status, 401);
  assert.ok(poort.stand().sleutels[0].geweigerd >= 1);
});

test('een ingetrokken of verlopen sleutel komt er niet meer in', () => {
  const { poort, regels } = maak();
  const r = metSleutel(poort);
  assert.equal(poort.trekIn(r.sleutel.id, 'ik', 'niet meer nodig').sleutel.ingetrokken.reden, 'niet meer nodig');
  assert.equal(poort.apiSleutelOk(r.geheim, '/api/extern/aanbod', 'GET').status, 401);
  assert.equal(poort.trekIn(r.sleutel.id, 'ik').status, 409, 'twee keer intrekken kan niet');
  assert.ok(regels.some(x => x.actie === 'api-sleutel ingetrokken'));

  /* En een sleutel met einddatum werkt tot die datum en daarna niet. */
  const { poort: p2 } = maak();
  const r2 = metSleutel(p2, { dagen: 1 });
  assert.equal(p2.apiSleutelOk(r2.geheim, '/api/extern/aanbod', 'GET').ok, true);
  const na = p2.apiSleutelOk(r2.geheim, '/api/extern/aanbod', 'GET', Date.now() + 2 * 86400000);
  assert.equal(na.status, 401);
  assert.match(na.reden, /verlopen/);
});

test('het quotum overleeft een herstart', () => {
  /* Een quotum in het geheugen begint bij elke herstart op nul -- en juist een
     koppeling die te hard loopt, veroorzaakt die herstart. */
  const { db, poort } = maak();
  const r = metSleutel(poort, { quotaPerUur: 3 });
  for (let i = 0; i < 3; i++) assert.equal(poort.apiSleutelOk(r.geheim, '/api/extern/aanbod', 'GET').ok, true);
  const op = poort.apiSleutelOk(r.geheim, '/api/extern/aanbod', 'GET');
  assert.equal(op.status, 429);
  assert.ok(op.herstartOver > 0, 'en er staat bij wanneer het weer mag');

  /* Herstart: een nieuwe motor op dezelfde opslag. De teller staat er nog. */
  const opnieuw = maakApiPoort({ db, save: () => {}, crypto, journaal: null });
  assert.equal(opnieuw.apiSleutelOk(r.geheim, '/api/extern/aanbod', 'GET').status, 429);

  /* Een uur later mag het weer. */
  const later = Date.now() + 3600000;
  assert.equal(opnieuw.apiSleutelOk(r.geheim, '/api/extern/aanbod', 'GET', later).ok, true);
});

test('een uitgefaseerd pad weigert, en kondigde dat aan', () => {
  const { poort } = maak();
  const morgen = new Date(Date.now() + 86400000).toISOString();
  poort.laatToe('/api/extern/oud', { versie: 'v1', uitfasering: morgen }, 'ik');
  const r = poort.maak('Koppeling', [{ pad: '/api/extern/oud', methoden: ['GET'] }], { door: 'ik' });

  const nu = poort.apiSleutelOk(r.geheim, '/api/extern/oud', 'GET');
  assert.equal(nu.ok, true, 'tot de datum werkt hij gewoon');
  assert.equal(nu.uitfasering, morgen, 'en het antwoord kondigt het einde aan');

  const na = poort.apiSleutelOk(r.geheim, '/api/extern/oud', 'GET', Date.now() + 2 * 86400000);
  assert.equal(na.status, 410);
  assert.match(na.reden, /uitgefaseerd/);
});

test('een pad uit de toelating halen sluit de bestaande sleutels ook', () => {
  const { poort } = maak();
  const r = metSleutel(poort);
  assert.equal(poort.apiSleutelOk(r.geheim, '/api/extern/aanbod', 'GET').ok, true);
  poort.haalWeg('/api/extern/aanbod', 'ik');
  const uit = poort.apiSleutelOk(r.geheim, '/api/extern/aanbod', 'GET');
  assert.equal(uit.status, 403);
  assert.match(uit.reden, /niet \(meer\) in de toelating/);
  assert.equal(poort.haalWeg('/api/extern/aanbod', 'ik').status, 404);
});

test('een toelating is een /api-pad en een sleutel zonder scope heeft geen zin', () => {
  const { poort } = maak();
  assert.equal(poort.laatToe('gewoon-iets', {}, 'ik').status, 400);
  poort.laatToe('/api/extern/aanbod', {}, 'ik');
  assert.equal(poort.laatToe('/api/extern/aanbod', {}, 'ik').status, 409);
  assert.equal(poort.maak('X', [], { door: 'ik' }).status, 400);
});
