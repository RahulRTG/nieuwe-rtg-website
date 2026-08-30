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
