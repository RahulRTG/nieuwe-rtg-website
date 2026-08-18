/* Het Consent Center (kern/consent.js). De belofte van dit scherm is "wie raakt
   mijn gegevens aan, en hier zet u het stop", en die belofte heeft twee helften
   die allebei kunnen breken:

   1. VOLLEDIGHEID. Een overzicht dat er drie vergeet, geeft zekerheid die er
      niet is. Elke toestemming die een lid ergens aanzet, hoort hier te
      verschijnen -- daarom zet deze toets ze een voor een AAN via hun eigen app
      en kijkt of ze op de lijst komen.
   2. DE KNOP. Een intrekknop die het scherm groen maakt maar de laag niet
      raakt, is erger dan geen knop. Daarom wordt elke intrek heen en terug
      nagelopen: weg uit de lijst EN weg bij de bron zelf.

   Draai los: node --experimental-sqlite --test test/consent.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');
const { LAGEN, NIET_GEDEKT } = require('../server/kern/consent');

let srv, base, lid;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-consent-'));

const api = (pad, body, t) => fetch(base + '/api/' + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t },
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

const lijst = async () => (await api('toestemming', {}, lid)).body;
const vanLaag = (d, laag) => d.toestemmingen.filter(t => t.laag === laag);

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  lid = await fetch(base + '/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tier: 'rtg' }) }).then(r => r.json()).then(d => d.token);
  assert.ok(lid);
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('een lid dat niets deelt, ziet een lege lijst en geen storing', async () => {
  const d = await lijst();
  assert.deepEqual(d.toestemmingen, [], 'niets aangezet is niets op de lijst');
  assert.deepEqual(d.storingen, [], 'en alle lagen zijn bereikbaar');
  assert.ok(d.voorbehoud && /toets let mee|toets mee/i.test(d.voorbehoud),
    'het scherm zegt dat er iets op de lijst let');
  assert.match(d.voorbehoud, /anders uitziet|mensenwerk/i,
    'en waar dat ophoudt: een toestemming van een andere vorm valt er nog buiten');
  assert.ok(d.nietGedekt.length >= 3, 'en het zegt waar de lijst ophoudt');
  assert.deepEqual(d.nietGedekt.map(x => x.naam), NIET_GEDEKT.map(x => x.naam));
  for (const x of d.nietGedekt) assert.ok(x.reden, 'elke uitzondering draagt een reden');
});

test('elke laag in het register komt echt op de lijst als je hem aanzet', async () => {
  /* 1. het zorgprofiel laten meereizen */
  await api('zorgprofiel/zet', { allergenen: ['noten'], dieet: '', medisch: '', delen: true }, lid);

  /* 2. medische context delen met een kliniek */
  const care = (await api('care', {}, lid)).body;
  const kliniek = care.aanbieders.find(a => a.soort === 'kliniek');
  assert.ok(kliniek, 'de demo-kliniek staat er');
  await api('care/intake/deel', { aanbiederId: kliniek.id, medisch: 'bloedverdunner' }, lid);

  /* 3. een toestel koppelen */
  await api('toestellen/koppel', { naam: 'Horloge' }, lid);

  const d = await lijst();
  assert.deepEqual(d.storingen, []);

  const zp = vanLaag(d, 'zorgprofiel');
  assert.equal(zp.length, 1);
  assert.match(zp[0].wat, /allergenen/, 'er staat bij WAT er meereist, niet alleen dat er iets meereist');
  assert.equal(zp[0].richting, 'ziet');

  const ci = vanLaag(d, 'care-intake');
  assert.equal(ci.length, 1);
  assert.equal(ci[0].wie, kliniek.naam, 'met de naam van de aanbieder die het mag zien');
  assert.ok(ci[0].tot, 'en tot wanneer');

  const t = vanLaag(d, 'toestel');
  assert.equal(t.length, 1);
  assert.equal(t[0].wie, 'Horloge');
  assert.equal(t[0].richting, 'schrijft', 'een toestel LEEST niet maar schrijft, en dat staat er ook zo');
});

test('intrekken raakt de bron zelf, en niet alleen deze lijst', async () => {
  /* Dit is de scherpste bewering van het scherm. Na elke intrek wordt bij de
     EIGEN app van die laag nagekeken of het er echt af is; een knop die alleen
     deze lijst opschoont, zou hier groen blijven en toch liegen. */
  const voor = await lijst();
  assert.equal(voor.toestemmingen.length, 3);
  let kliniek;
  {
    const care = (await api('care', {}, lid)).body;
    kliniek = care.aanbieders.find(a => a.soort === 'kliniek');
  }

  const intake = vanLaag(voor, 'care-intake')[0];
  assert.equal((await api('toestemming/intrek', { laag: 'care-intake', id: intake.id }, lid)).status, 200);
  assert.equal(((await api('care', {}, lid)).body.intakes || []).length, 0,
    'de deling is ook bij Zorg zelf weg');

  const toestel = vanLaag(voor, 'toestel')[0];
  assert.equal((await api('toestemming/intrek', { laag: 'toestel', id: toestel.id }, lid)).status, 200);
  assert.equal((await api('toestellen', {}, lid)).body.toestellen.length, 0,
    'het toestel is ook bij Toestellen zelf weg');

  /* De wachtlijst is de achtste laag, en de handhaver heeft hem zelf
     aangewezen: hij verscheen als nieuwe toestemmingsvorm in kern/, en toen was
     de vraag of hij op dit scherm hoort. Hij hoort er, en dus wordt hij hier op
     dezelfde manier nagelopen als de rest: intrekken raakt de BRON. */
  const opWacht = await api('care/wachtlijst/zet', { aanbiederId: kliniek.id }, lid);
  assert.equal(opWacht.status, 200);
  const wachtRij = (await lijst()).toestemmingen.find(t => t.laag === 'wachtlijst');
  assert.ok(wachtRij, 'de wachtlijst staat op het toestemmingsscherm');
  assert.equal(wachtRij.richting, 'seint', 'seinen is niet zien en niet schrijven');
  assert.equal((await api('toestemming/intrek', { laag: 'wachtlijst', id: wachtRij.id }, lid)).status, 200);
  assert.equal((await api('care/wachtlijst', {}, lid)).body.lijsten.length, 0,
    'en hij is ook bij de wachtlijst zelf weg');

  assert.equal((await api('toestemming/intrek', { laag: 'zorgprofiel', id: 'profiel' }, lid)).status, 200);
  const profiel = (await api('zorgprofiel', {}, lid)).body.zorg;
  assert.equal(profiel.delen, false, 'het meereizen staat uit');
  assert.deepEqual(profiel.allergenen, ['noten'],
    'maar het profiel zelf staat er nog: uitzetten is niet weggooien');

  const na = await lijst();
  assert.deepEqual(na.toestemmingen, [], 'en de lijst is leeg');
});

test('een onbekende laag of een vreemd id trekt niets in', async () => {
  assert.equal((await api('toestemming/intrek', { laag: 'gedachten', id: 'x' }, lid)).status, 404);
  assert.equal((await api('toestemming/intrek', { laag: 'care-intake', id: 'bestaat-niet' }, lid)).status, 404);
  assert.equal((await api('toestemming/intrek', { laag: 'toestel', id: 'bestaat-niet' }, lid)).status, 404);
});

test('het register en het scherm lopen niet uiteen', () => {
  /* Een laag die in het register staat maar nergens wordt gelezen, is een lege
     belofte; een laag die wel getoond wordt maar niet in het register staat,
     ontbreekt in de uitleg op het scherm. Beide kanten worden hier vastgezet. */
  const maak = require('../server/kern/consent');
  const alles = maak({ kern: {
    careOverzicht: () => ({ intakes: [{ id: 'i1', aanbiederNaam: 'Kliniek', vervaltOp: '2026-12-01' }] }),
    rtgid: {
      inzage: () => ({
        sessies: [{ dienst: 'Gemeente', attributen: ['naam'], verloopt: '2026-12-01T00:00:00.000Z' }],
        machtigingen: [{ id: 'm1', naar: 'ADELAAR', dienst: 'Gemeente', tot: '2026-12-01T00:00:00.000Z', ik: 'geef' },
          { id: 'm2', naar: 'IK', dienst: 'Gemeente', tot: '2026-12-01T00:00:00.000Z', ik: 'krijg' }]
      })
    },
    paspoortMijn: () => ([{ id: 'p1', supplierName: 'Hotel Aurora', niveau: 'idkaart',
      status: 'goedgekeurd', vervalt: '2099-01-01T00:00:00.000Z', incident: false }]),
    vastleggingenVan: () => ({ vastleggingen: [{ id: 'v1', aanbiederNaam: 'Kliniek Clara', sinds: '2026-08-01' }] }),
    wachtlijstVan: () => ({ lijsten: [{ id: 'w1', aanbiederNaam: 'Zenith Spa', sinds: '2026-08-01' }] }),
    locMijn: () => ({ actief: [{ id: 'l1', supplierName: 'Kikunoi' }] }),
    zorgVan: () => ({ allergenen: ['noten'], dieet: '', medisch: '', delen: true }),
    toestellenVan: () => ({ toestellen: [{ id: 't1', naam: 'Horloge', geschreven: 3 }] })
  } });
  const d = alles.consentVan('sleutel');
  assert.deepEqual(d.storingen, []);

  const getoond = [...new Set(d.toestemmingen.map(t => t.laag))].sort();
  const geregistreerd = LAGEN.filter(l => l.gedekt).map(l => l.id).sort();
  assert.deepEqual(getoond, geregistreerd,
    'elke gedekte laag levert een regel, en er komt geen laag langs die niet in het register staat');

  assert.equal(d.toestemmingen.filter(t => t.laag === 'rtgid-machtiging').length, 1,
    'een machtiging die u KRIJGT is geen toestemming die u geeft, en staat er dus niet bij');
  assert.ok(d.toestemmingen.every(t => t.wie && t.wat && t.richting),
    'elke regel zegt wie, wat en welke kant het op gaat');
});

test('de paspoort-inzage: alleen een venster dat NU nog openstaat', () => {
  /* Deze laag is de enige op het scherm met een venster van minuten in plaats
     van dagen, en de bron schoont haar eigen lijst niet op -- alleen de
     partnerkant doet dat. Een verlopen goedkeuring staat er dus nog met status
     'goedgekeurd' bij. Zou dit scherm die overnemen, dan meldt het een inzage
     die allang dicht is: precies de schijnzekerheid die dit scherm hoort te
     voorkomen. Vandaar deze drie gevallen naast elkaar. */
  const maak = require('../server/kern/consent');
  let ingetrokken = null;
  const c = maak({ kern: {
    paspoortMijn: () => ([
      { id: 'open', supplierName: 'Hotel Aurora', niveau: 'idkaart', status: 'goedgekeurd',
        vervalt: new Date(Date.now() + 5 * 60000).toISOString(), incident: false },
      { id: 'verlopen', supplierName: 'Slijterij De Kurk', niveau: 'idkaart', status: 'goedgekeurd',
        vervalt: new Date(Date.now() - 60000).toISOString(), incident: false },
      { id: 'gevraagd', supplierName: 'Vage Webshop', niveau: 'paspoort', status: 'aangevraagd', vervalt: null }
    ]),
    paspoortTrekIn: (key, id) => { ingetrokken = [key, id]; return { ok: true }; }
  } });

  const rijen = c.consentVan('sleutel').toestemmingen.filter(t => t.laag === 'paspoort-inzage');
  assert.deepEqual(rijen.map(r => r.id), ['open'],
    'een verlopen venster en een verzoek dat nog wacht zijn geen lopende toestemming');
  assert.equal(rijen[0].wie, 'Hotel Aurora');
  assert.match(rijen[0].wat, /ID-kaart/, 'het lid leest welk niveau er openstaat, niet de code ervan');
  assert.match(rijen[0].tot, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/,
    'een venster van tien minuten toont de klok; alleen een dag leest als "de hele dag nog"');

  /* En de knop raakt de bron, niet een vlaggetje van dit scherm. */
  assert.deepEqual(c.consentIntrek('sleutel', { laag: 'paspoort-inzage', id: 'open' }), { ok: true });
  assert.deepEqual(ingetrokken, ['sleutel', 'open']);
});

test('een vrijgegeven incident staat er met die reden bij', () => {
  /* RTG kan bij een incident een identiteit vrijgeven zonder dat het lid
     goedkeurde. Dat venster staat wel degelijk open, dus het hoort op deze
     lijst -- maar dan met de reden erbij, anders leest het als iets wat het lid
     zelf heeft aangezet. */
  const maak = require('../server/kern/consent');
  const c = maak({ kern: { paspoortMijn: () => ([{ id: 'i1', supplierName: 'Bar Vesper',
    niveau: 'paspoort', status: 'goedgekeurd',
    vervalt: new Date(Date.now() + 5 * 60000).toISOString(), incident: true }]) } });
  const rij = c.consentVan('sleutel').toestemmingen.find(t => t.laag === 'paspoort-inzage');
  assert.match(rij.wat, /incident/i, 'het lid ziet waarom dit openstaat');
});

test('een laag die het niet doet, wordt gemeld en niet als leegte getoond', () => {
  /* Op dit scherm is stilte gevaarlijker dan elders: een ontbrekende regel
     leest als "niemand kijkt mee". */
  const maak = require('../server/kern/consent');
  const stuk = maak({ kern: { careOverzicht: () => { throw new Error('kapot'); } } });
  const d = stuk.consentVan('sleutel');
  assert.ok(d.storingen.length >= 1);
  assert.match(d.storingen[0], /Zorg/i, 'de laag die stukging staat met naam in de melding');
  assert.equal(d.storingen.length, 8, 'en de zeven lagen die ontbreken melden zich ook, geen stilte');
});
