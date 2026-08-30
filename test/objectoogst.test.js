/* ============================================================================
   HET OBJECT MAKEN VOOR JE ERAAN KOMT.

   1635 mutatieroutes strandden op 404: het ding waar ze over gaan bestaat niet.
   Deze laag draait eerst de MAAKroutes en geeft het teruggegeven id mee aan de
   zusterroutes in dezelfde tak. Gemeten (scripts/objectoogst.js): 121 komen op
   2xx, 53 voorbij de 404, 546 liggen in een tak zonder werkende maakroute.

   DRIE DINGEN DIE HIER VASTLIGGEN, en alle drie zijn het aannames die eerst
   fout waren:

   1. DE OOGST HANGT PER TAK. De eerste versie hield een enkele `id`-plek bij;
      elk nieuw object overschreef het vorige, en een id uit de kluis van een
      lid is zinloos voor een festival van een zaak. Met een globale zak kwam er
      NUL uit; per tak 121.
   2. NIET DIEPER DAN EEN NIVEAU plukken. Een maakroute geeft zijn ding vaak in
      een omhulsel terug ({ ok, ontwerp: { id } }). Twee niveaus diep zou id's
      meenemen van GENESTE dingen die bij een ander object horen.
   3. ER WORDT NIETS GERADEN. De laag geeft mee wat de maakroute teruggaf, onder
      dezelfde naam. Past dat niet bij wat de route verwacht, dan blijft het
      404 -- en dat is de eerlijke uitkomst, geen groen.

   DE MUTATIE: laat de oogst in een globale zak lopen in plaats van per tak ->
   de eerste toets zakt.
   ========================================================================== */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { oogstObjecten, uitOogst, MAAK, IDVELD } = require('../scripts/lib/objectoogst');

const routes = [
  { methode: 'POST', pad: '/api/supplier/festival/maak', rol: 'supplier' },
  { methode: 'POST', pad: '/api/member/kluis/maak', rol: 'member' }
];
const nep = (perPad) => async (pad) => perPad[pad] || { status: 404, data: null };

test('de oogst hangt per tak, niet in een globale zak', async () => {
  const u = await oogstObjecten({
    post: nep({
      '/api/supplier/festival/maak': { status: 200, data: { id: 'FEST-1' } },
      '/api/member/kluis/maak': { status: 200, data: { id: 'KLUIS-9' } }
    }),
    routes, tokenVoor: () => '', lijfVoor: () => ({})
  });
  assert.equal(u.gelukt, 2);
  assert.equal(u.voor('/api/supplier/festival/zet').id, 'FEST-1',
    'een festivalroute hoort het festival-id te krijgen');
  assert.equal(u.voor('/api/member/kluis/zet').id, 'KLUIS-9',
    'en een kluisroute het kluis-id; met een globale zak won hier het laatst gemaakte ding');
});

test('een omhulsel wordt uitgepakt, maar niet twee niveaus diep', async () => {
  const u = await oogstObjecten({
    post: nep({ '/api/supplier/festival/maak': { status: 200,
      data: { ok: true, festival: { id: 'BUITEN', podium: { id: 'BINNEN' } } } } }),
    routes: [routes[0]], tokenVoor: () => '', lijfVoor: () => ({})
  });
  assert.equal(u.voor('/api/supplier/festival/x').id, 'BUITEN',
    'het ding zelf hoort geoogst te worden');
});

test('een maakroute die niet doorkomt, levert geen oogst en geen fout', async () => {
  const u = await oogstObjecten({
    post: nep({}), routes, tokenVoor: () => '', lijfVoor: () => ({})
  });
  assert.equal(u.gelukt, 0);
  assert.deepEqual(u.voor('/api/supplier/festival/zet'), {},
    'zonder gemaakt object hoort er niets meegestuurd te worden');
});

test('een bouwer die stukloopt, laat de ronde niet omvallen', async () => {
  const u = await oogstObjecten({
    post: async () => { throw new Error('stuk'); },
    routes, tokenVoor: () => '', lijfVoor: () => ({})
  });
  assert.equal(u.gelukt, 0);
});

test('alleen velden die naar identiteit ruiken, en alleen korte waarden', async () => {
  const u = await oogstObjecten({
    post: nep({ '/api/supplier/festival/maak': { status: 200, data: {
      id: 'FEST-7', naam: 'Een naam die geen verwijzing is',
      code: 'x'.repeat(200), kort: 'ab', toelichting: 'lang verhaal' } } }),
    routes: [routes[0]], tokenVoor: () => '', lijfVoor: () => ({})
  });
  const v = u.voor('/api/supplier/festival/x');
  assert.equal(v.id, 'FEST-7');
  assert.ok(!('naam' in v), 'een naam is geen verwijzing');
  assert.ok(!('code' in v), 'tweehonderd tekens is geen id');
  assert.ok(!('toelichting' in v));
  /* DE ONDERGRENS IS DRIE TEKENS, en dat is een keuze met een prijs: een echt
     id van twee tekens valt er ook buiten. De drempel houdt korte statuswoorden
     tegen die toevallig in een id-veld staan. Hij staat hier zodat een
     verlaging een besluit is en geen slip. */
  assert.equal(IDVELD.test('kort'), false, 'kort is geen id-veldnaam');
});

test('de vorm van een maakroute en een id-veld staat vast', () => {
  assert.ok(MAAK.test('/api/x/maak') && MAAK.test('/api/x/nieuw'));
  assert.ok(!MAAK.test('/api/x/lijst'), 'een lijstroute maakt niets');
  assert.ok(IDVELD.test('id') && IDVELD.test('iban') && !IDVELD.test('naam'));
});

/* ============================================================================
   HET VELD HEET NAAR HET OBJECT, EN NIET `id`.

   Dit verklaart waarom de eerste versie maar een op de tien haalde. Het huis
   noemt zijn verwijzingen naar het DING, niet naar de vorm:

     /api/festival/bewijs     leest req.body.festival
     /api/concern/bulk/lees   leest req.body.entiteit
     /api/lab2/app/lijst      leest req.body.lab

   Een geoogste `id` uit /api/festival/nieuw komt dus nooit aan bij
   /api/festival/bewijs, hoe goed de tak ook klopt. Gemeten: 1313 van de 1450
   geblokkeerde routes hebben een maakroute in hun tak -- ze konden elkaar
   alleen niet vinden.

   TWEE GRENZEN DIE ERBIJ HOREN:
   - de naam uit het pad staat NAAST de oorspronkelijke en nooit eroverheen, dus
     een route die wel `id` leest blijft werken;
   - het werkwoord aan het eind is geen object: `nieuw`, `maak` en `zet` horen
     er niet in.

   DE MUTATIE: haal de objectNamen-lus uit bewaar() -> de eerste toets zakt.
   ========================================================================== */
test('een geoogst id gaat ook mee onder de naam van het object', async () => {
  const u = await oogstObjecten({
    post: async (pad) => (pad === '/api/festival/nieuw'
      ? { status: 200, data: { id: 'FEST-1' } } : { status: 404, data: null }),
    routes: [{ methode: 'POST', pad: '/api/festival/nieuw', rol: 'supplier' }],
    tokenVoor: () => '', lijfVoor: () => ({})
  });
  const v = u.voor('/api/festival/bewijs');
  assert.equal(v.festival, 'FEST-1',
    'de route leest req.body.festival; een `id` komt daar nooit aan');
  assert.equal(v.id, 'FEST-1', 'en de oorspronkelijke naam hoort te blijven staan');
});

test('twee segmenten diep geeft twee namen, want welke de route leest verschilt', async () => {
  const u = await oogstObjecten({
    post: async () => ({ status: 200, data: { id: 'E-1' } }),
    routes: [{ methode: 'POST', pad: '/api/concern/entiteit/nieuw', rol: 'member' }],
    tokenVoor: () => '', lijfVoor: () => ({})
  });
  const v = u.voor('/api/concern/bulk/lees');
  assert.equal(v.concern, 'E-1');
  assert.equal(v.entiteit, 'E-1', 'concern/bulk/lees leest req.body.entiteit');
});

test('het werkwoord aan het eind is geen object', async () => {
  const u = await oogstObjecten({
    post: async () => ({ status: 200, data: { id: 'X-1' } }),
    routes: [{ methode: 'POST', pad: '/api/festival/nieuw', rol: 'supplier' }],
    tokenVoor: () => '', lijfVoor: () => ({})
  });
  const v = u.voor('/api/festival/bewijs');
  assert.ok(!('nieuw' in v), '`nieuw` is een werkwoord en geen ding');
});

/* De verwijzingsvorm. Deze regels kwamen uit de oogst zelf: die meldde sinds
   kort waarom een maakroute niets opleverde, en toen bleek
   /api/bedrijf/lid/aanmeld een `lidId` terug te geven die niemand zag. */
test('een veld met een voorvoegsel is ook een verwijzing', () => {
  const { IDVELD } = require('../scripts/lib/objectoogst');
  for (const k of ['id', 'code', 'lidId', 'partnerCode', 'zaakRef']) {
    assert.ok(IDVELD.test(k), k + ' hoort een verwijzing te zijn');
  }
});

/* En de grens: een token is een sleutel tot een sessie en geen verwijzing naar
   een ding. Die als object-id rondsturen vergiftigt de oogst. */
test('een token is GEEN verwijzing', () => {
  const { IDVELD } = require('../scripts/lib/objectoogst');
  for (const k of ['token', 'beheerToken', 'lidToken', 'naam', 'status']) {
    assert.ok(!IDVELD.test(k), k + ' hoort geen verwijzing te zijn');
  }
});
