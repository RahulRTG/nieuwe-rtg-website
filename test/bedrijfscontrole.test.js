/* Bewijst de toelatingsgrens voor WORK-bedrijven: ieder bedrijf krijgt vaste
   KVK-, bevoegdheids-, vergunning- en integriteitscontroles; gereguleerde
   sectoren krijgen hun eigen officiële registerbewijs; een open, afgekeurd of
   verlopen onderdeel blokkeert de bedrijfscode. De KVK-API is aantoonbaar
   alleen een voorcontrole en nooit een automatische toelating. */
const test = require('node:test');
const assert = require('node:assert/strict');
const controle = require('../server/kern/bedrijfscontrole');
const kvk = require('../server/kern/kvkvoorcontrole');
const internationaal = require('../server/kern/internationalehandel');

test('elk bedrijf krijgt de vaste toelatingspoort en alleen passende sectorbewijzen', () => {
  const restaurant = controle.eisenVoor('restaurant', {});
  assert.deepEqual(restaurant.slice(0, 4).map(e => e.id), ['kvk', 'bevoegdheid', 'vergunningenscan', 'integriteit']);
  assert.ok(restaurant.some(e => e.id === 'nvwa'));
  assert.ok(!restaurant.some(e => e.id === 'taxi'));
  assert.ok(controle.eisenVoor('taxi', {}).some(e => e.id === 'taxi'));
  assert.ok(controle.eisenVoor('kinderopvang', {}).some(e => e.id === 'kinderopvang'));
  assert.ok(controle.eisenVoor('zzp', { pakketreis: true }).some(e => e.id === 'pakketreis'));
});

test('geen goedkeuring zolang een verplichte controle open, afgekeurd of verlopen is', () => {
  const at = '2026-08-17T10:00:00.000Z';
  const aanvraag = { businessPass: { key: 'business' }, toelating: controle.startControle({
    genre: 'taxi', data: {}, kvkNummer: '12345678', vestigingsnummer: '000012345678',
    bewijzen: { taxi: 'P-123456' }, at
  }) };
  assert.equal(controle.magGoedkeuren(aanvraag, Date.parse(at)).ok, false);
  for (const eis of aanvraag.toelating.eisen) {
    const uitkomst = eis.id === 'vergunningenscan' ? 'niet_van_toepassing' : 'geverifieerd';
    const r = controle.controleer(aanvraag.toelating, { onderdeel: eis.id, uitkomst,
      referentie: uitkomst === 'niet_van_toepassing' ? 'Geen extra gemeentelijke vergunning voor deze activiteit' : 'register ' + eis.id }, 'user-1', at);
    assert.equal(r.ok, true, eis.id);
  }
  assert.equal(controle.magGoedkeuren(aanvraag, Date.parse(at)).ok, true);
  controle.controleer(aanvraag.toelating, { onderdeel: 'taxi', uitkomst: 'geverifieerd',
    referentie: 'Kiwa P-123456', geldigTot: '2026-08-18' }, 'user-1', at);
  assert.equal(controle.magGoedkeuren(aanvraag, Date.parse('2026-08-19T00:00:00Z')).ok, false);
  const nvt = controle.controleer(aanvraag.toelating, { onderdeel: 'taxi', uitkomst: 'niet_van_toepassing',
    referentie: 'zou niet mogen' }, 'user-1', at);
  assert.equal(nvt.status, 409);
});

test('KVK-voorcontrole vergelijkt handelsnaam en vestigingsnummer maar blijft een voorcontrole', async () => {
  const fetchFn = async () => ({ ok: true, status: 200, json: async () => ({
    kvkNummer: '68750110', naam: 'Voorbeeld Bedrijf B.V.',
    materieleRegistratie: { startdatum: '20200101' },
    handelsnamen: [{ naam: 'Voorbeeld Bedrijf' }],
    sbiActiviteiten: [{ sbiCode: '56101', sbiOmschrijving: 'Restaurant', indHoofdactiviteit: true }],
    _embedded: { hoofdvestiging: { vestigingsnummer: '000037178598' } }
  }) });
  const r = await kvk.voorcontrole({ apiKey: 'test', kvkNummer: '68750110',
    vestigingsnummer: '000037178598', company: 'Voorbeeld Bedrijf BV', fetchFn });
  assert.equal(r.status, 'gevonden');
  assert.equal(r.actief, true);
  assert.equal(r.naamMatch, true);
  assert.equal(r.vestigingMatch, true);
  assert.equal(r.activiteiten[0].code, '56101');
  assert.equal((await kvk.voorcontrole({ kvkNummer: '68750110' })).status, 'handmatig');
});

test('alle bestaande wereldlanden gebruiken hun eigen officiële ondernemingsregister', () => {
  const landen = internationaal.landen();
  assert.equal(landen.length, 189);
  assert.ok(landen.some(l => l.code === 'NL' && l.naam === 'Nederland'));
  assert.match(internationaal.registerSuggestie('GB').url, /company-information/);
  assert.match(internationaal.registerSuggestie('BE').url, /e-justice/);
  assert.match(internationaal.registerSuggestie('JP').url, /houjin-bangou/);
  assert.equal(internationaal.registratieUit({ landCode: 'US', registratieNummer: 'AB-1234',
    registerBron: 'https://example.gov/register' }).error.includes('staat'), true);
  const gb = internationaal.registratieUit({ landCode: 'GB', registratieNummer: '1234 5678',
    registerBron: 'https://find-and-update.company-information.service.gov.uk/' }).registratie;
  assert.equal(gb.sleutel, 'GB:12345678');
  assert.equal(gb.kvkNummer, null);
});

test('wereldhandel voegt sanctie-, douane-, btw-, goederen- en exportcontroles toe', () => {
  const data = { landCode: 'BE', internationaleHandel: true, goederen: true,
    euBtw: true, douane: true, gecontroleerdeGoederen: true, vsBetrokken: true };
  const reg = internationaal.registratieUit({ ...data, registratieNummer: 'BE 0123.456.789',
    registerBron: internationaal.BRONNEN.bris }).registratie;
  const ids = internationaal.eisenVoor('restaurant', data, reg).map(e => e.id);
  for (const id of ['sector_lokaal', 'sancties_vn', 'sancties_eu', 'handelsscope',
    'lokale_handelsregels', 'vies', 'eori', 'goederencode', 'exportvergunning', 'ofac'])
    assert.ok(ids.includes(id), id);
  assert.ok(!controle.eisenVoor('restaurant', data).some(e => e.id === 'nvwa'),
    'een Belgisch bedrijf mag geen Nederlandse NVWA-eis krijgen');
  const dossier = controle.startControle({ genre: 'restaurant', data,
    registratieReferentie: 'BE · BE 0123.456.789', extraEisen: internationaal.eisenVoor('restaurant', data, reg),
    bewijzen: { sector_lokaal: 'FAVV 2026-1', vies: 'BE0123456789', eori: 'BE0123456789',
      goederencode: 'HS 0901 · BE naar JP', exportvergunning: 'BE exportcontrole D-1' },
    at: '2026-08-17T10:00:00.000Z' });
  assert.equal(dossier.eisen[0].id, 'handelsregister');
  assert.equal(dossier.eisen.find(e => e.id === 'eori').referentie, 'BE0123456789');
  assert.equal(controle.magGoedkeuren({ businessPass:{ key:'business' }, toelating:dossier }).ok, false);
});
