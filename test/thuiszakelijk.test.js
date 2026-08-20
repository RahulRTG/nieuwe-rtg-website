/* RTG Thuis, de commerciele tak + de plek in de Mall.
   Getest: een zaak zet haar huis commercieel (een prive-lid mag dat niet),
   de logies-btw komt uit de landtabel en staat apart in de prijsopbouw,
   langverblijf rekent op het maandtarief, op factuur boeken met een
   kostenplaats belooft nooit dat er betaald is, het commerciele bord telt
   omzet, btw, commissie en netto uitbetaling, en de Mall toont de
   verdieping RTG Thuis met een verwijzing naar de app zelf.
   Draai los: node --test test/thuiszakelijk.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer } = require('./helper');

let BASE, child, manager, lid, ander;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-thuisz-'));

const api = (pad, body, token) => fetch(BASE + pad, {
  method: 'POST',
  headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { Authorization: 'Bearer ' + token } : {}),
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

const dag = n => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

test.before(async () => {
  ({ child, base: BASE } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' } }));
  const roster = (await api('/api/supplier/roster', { code: 'KIKUNOI' })).body;
  const man = roster.staff.find(x => x.role === 'manager');
  manager = (await api('/api/supplier/login', { code: 'KIKUNOI', staffId: man.id, pin: '1234' })).body.token;
  lid = (await api('/api/login', { tier: 'rtg' })).body.token;
  ander = (await api('/api/login', { tier: 'business' })).body.token;
});
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

let huisId, loftId;

test('een zaak zet een huis live en maakt er commercieel aanbod van', async () => {
  const r = await api('/api/supplier/thuis/huis', { huis: {
    titel: 'Casa Botafoch, zakensuite', plaats: 'Ibiza', land: 'Spanje', type: 'appartement',
    prijs: 300, schoonmaak: 60, maxGasten: 4, slaapkamers: 2, instant: true, keyless: true,
    voorzieningen: ['wifi', 'werkplek', 'airco'], annulering: 'gemiddeld' } }, manager);
  assert.equal(r.status, 200);
  huisId = r.body.huis.id;
  assert.equal(r.body.huis.land, 'ES');

  const z = await api('/api/supplier/thuis/zakelijk', { id: huisId, zakelijk: {
    aan: true, opFactuur: true, maandprijs: 6000, doelgroep: 'Zakenreis en relocatie' } }, manager);
  assert.equal(z.status, 200);
  assert.equal(z.body.huis.commercieel, true);
  assert.equal(z.body.huis.btwPct, 10, 'Spanje: logies-btw 10% uit de landtabel');
  assert.match(z.body.huis.btwTekst, /Regelwacht/);
  assert.equal(z.body.huis.zakelijk.maandprijs, 6000);
  assert.equal(z.body.huis.commissiePct, 0,
    'RTG rekent geen commissie over de omzet van een partner (kern/commercie/vergoeding.js). ' +
    'Dit was tot 20 augustus 2026 de enige plek op het platform waar dat wel gebeurde -- ' +
    'met een eigen terugval van 10% en over het tarief van het eerste huis van de host.');

  // een tweede huis blijft gewoon particulier aanbod van dezelfde zaak
  const r2 = await api('/api/supplier/thuis/huis', { huis: {
    titel: 'Loft boven de haven', plaats: 'Ibiza', type: 'appartement', prijs: 140, maxGasten: 2, instant: true } }, manager);
  loftId = r2.body.huis.id;
  assert.ok(loftId);
});

test('een prive-host komt de commerciele tak niet in', async () => {
  const eigen = await api('/api/thuis/huis', { huis: { titel: 'Mijn zolderkamer', plaats: 'Utrecht', prijs: 60, maxGasten: 2 } }, lid);
  assert.equal(eigen.status, 200);
  const z = await api('/api/thuis/zakelijk', { id: eigen.body.huis.id, zakelijk: { aan: true } }, lid);
  assert.equal(z.status, 403, 'de commerciele tak is voor zaken');
  assert.match(z.body.error, /voor zaken/);
});

test('de prijsopbouw: logies-btw apart, en nog steeds 0% servicekosten voor het lid', async () => {
  const van = dag(20), tot = dag(23); // drie nachten
  const d = await api('/api/thuis/detail', { id: huisId, van, tot }, lid);
  assert.equal(d.status, 200);
  const p = d.body.huis.prijsopbouw;
  assert.equal(p.zakelijk, true);
  assert.equal(p.serviceKosten, 0, 'het lid betaalt nooit servicekosten, ook niet bij een zaak');
  assert.equal(p.exclBtw, 960, '3 x 300 + 60 schoonmaak');
  assert.equal(p.btwPct, 10);
  assert.equal(p.btw, 96);
  assert.equal(p.totaal, 1056, 'exclusief plus btw');
  assert.equal(p.opFactuur, true);

  // het particuliere huis van dezelfde zaak: geen btw-regel, gewoon de prijs
  const d2 = await api('/api/thuis/detail', { id: loftId, van, tot }, lid);
  assert.ok(!d2.body.huis.prijsopbouw.zakelijk, 'niet-commercieel aanbod krijgt geen btw-opbouw');
  assert.equal(d2.body.huis.prijsopbouw.totaal, 420);
});

test('langverblijf rekent op het maandtarief van de zaak, niet op de nachtprijs', async () => {
  const d = await api('/api/thuis/detail', { id: huisId, van: dag(60), tot: dag(90) }, lid);
  const p = d.body.huis.prijsopbouw;
  assert.equal(p.nachten, 30);
  assert.equal(p.perNacht, 200, '6000 per maand gedeeld door 30 nachten');
  assert.equal(p.basis, 6000);
  assert.equal(p.kortingPct, 0, 'het maandtarief vervangt de maandkorting, hij stapelt niet');
  assert.match(p.langverblijf.tekst, /28 nachten/);
  assert.equal(p.totaal, 6666, '6000 + 60 schoonmaak + 10% logies-btw');
});

test('op factuur boeken met een kostenplaats, en nooit de belofte dat er betaald is', async () => {
  const b = await api('/api/thuis/boek', { id: huisId, van: dag(20), tot: dag(23), gasten: 2,
    kostenplaats: 'PROJECT-IBIZA-07', bericht: 'Twee collegas, aankomst in de avond.' }, lid);
  assert.equal(b.status, 200);
  assert.equal(b.body.boeking.status, 'bevestigd', 'instant boeken');
  assert.equal(b.body.boeking.kostenplaats, 'PROJECT-IBIZA-07');
  assert.equal(b.body.boeking.opFactuur, true);
  assert.match(b.body.boeking.betaling, /nog niets afgeschreven|factuur volgt/i);
  assert.ok(!/is betaald|betaling verwerkt/i.test(b.body.boeking.betaling), 'nooit beweren dat het rond is');
  assert.equal(b.body.boeking.prijsopbouw.btw, 96, 'de btw reist mee op de boeking');
  assert.ok(b.body.reiswijzer, 'de Reiswijzer van Spanje reist gewoon mee');
});

test('het commerciele bord telt omzet, btw en wat er netto overblijft (zonder commissie)', async () => {
  // het verblijf afmaken zodat het meetelt
  const mijn = (await api('/api/thuis/mijn', {}, lid)).body.reizen;
  const ref = mijn.find(x => x.huisId === huisId).ref;
  assert.equal((await api('/api/thuis/checkin', { ref }, lid)).status, 200);
  assert.equal((await api('/api/supplier/thuis/checkuit', { ref }, manager)).status, 200);

  const bord = await api('/api/supplier/thuis/zakelijkbord', {}, manager);
  assert.equal(bord.status, 200);
  assert.equal(bord.body.portefeuille.commercieel, 1);
  assert.equal(bord.body.verblijven, 1);
  assert.equal(bord.body.nachten, 3);
  assert.equal(bord.body.omzetExclBtw, 960);
  assert.equal(bord.body.btwAfTeDragen, 96);
  assert.equal(bord.body.omzetInclBtw, 1056);
  assert.equal(bord.body.opFactuur, 1);
  assert.equal(bord.body.commissiePct, 0, 'geen commissie over de omzet van de zaak');
  assert.equal(bord.body.commissie, 0);
  assert.equal(bord.body.nettoUitbetaling, 960,
    'netto = de omzet exclusief btw, onverminderd: RTG houdt er niets van in');
  assert.match(bord.body.uitleg, /0% servicekosten/);
  assert.match(bord.body.uitleg, /nog niets overgemaakt/);
  assert.ok(!/^zaak:/.test(bord.body.zaak), 'de zaakvlag wordt nooit als naam getoond');
  assert.equal(bord.body.zaak, 'Sal de Mar');
});

test('de Mall heeft een verdieping RTG Thuis die naar de app zelf wijst', async () => {
  const m = await api('/api/mall', {}, lid);
  assert.equal(m.status, 200);
  const t = m.body.thuis;
  assert.ok(t, 'de Mall draagt de Thuis-verdieping');
  assert.equal(t.pagina, '/apps/thuis.html', 'boeken doe je in RTG Thuis, niet in de Mall');
  assert.equal(t.aantal, 1, 'alleen het commerciele aanbod staat op deze verdieping');
  assert.equal(t.zaken, 1);
  const ibiza = t.steden.find(s => s.stad === 'Ibiza');
  assert.ok(ibiza, 'per stad gegroepeerd');
  assert.equal(ibiza.vanaf, 300);
  assert.equal(ibiza.huizen[0].zaak, 'Sal de Mar');
  assert.equal(ibiza.huizen[0].btwPct, 10);
  assert.ok(t.particulier >= 1, 'het aanbod van leden zelf wordt apart geteld');
  assert.match(t.opmerking, /0% servicekosten/);
});

test('een zaak mag een portefeuille draaien, een lid houdt het bij tien huizen', async () => {
  for (let i = 0; i < 10; i++) {
    const r = await api('/api/thuis/huis', { huis: { titel: 'Kamer ' + i, plaats: 'Utrecht', prijs: 50, maxGasten: 1 } }, ander);
    assert.equal(r.status, 200);
  }
  const teveel = await api('/api/thuis/huis', { huis: { titel: 'Kamer elf', plaats: 'Utrecht', prijs: 50 } }, ander);
  assert.equal(teveel.status, 429, 'een prive-host blijft op tien huizen');

  const zaak = await api('/api/supplier/thuis/huis', { huis: { titel: 'Suite 12', plaats: 'Ibiza', prijs: 220, maxGasten: 2 } }, manager);
  assert.equal(zaak.status, 200, 'een zaak kan door: een portefeuille is geen hobbyverhuur');
});
