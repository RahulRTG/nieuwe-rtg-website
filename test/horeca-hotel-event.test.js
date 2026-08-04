/* RTG Horeca OS, deel 4: de gastrekening van het hotel en de zakelijke kant
   van een event.

   Wat hier bewezen wordt:
   - op de kamer boeken kan alleen als daar een open gastrekening staat, en een
     restaurantrekening die op de kamer wordt gezet, landt er ook echt op;
   - de nachtrun is idempotent op de datum en zet de toeristenbelasting apart;
   - een borg is een aantekening en blokkeert niets bij de bank;
   - een offerte wordt pas een opdracht na een akkoord MET naam, en posten
     wijzigen na akkoord vraagt een nieuw akkoord;
   - een nacalculatie zonder kosten toont geen marge van 100%, maar zegt dat
     hij niet compleet is.
   Draai: node --experimental-sqlite --test test/horeca-hotel-event.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'); const os = require('os'); const path = require('path');
const { startServer } = require('./helper');

let BASE, child, tok;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-folio-'));
const api = (pad, body, token) => fetch(BASE + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
const H = (pad, body) => api('/api/supplier/horeca' + pad, body, tok);

test.before(async () => {
  ({ child, base: BASE } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' } }));
  const roster = (await api('/api/supplier/roster', { code: 'KIKUNOI' })).body;
  const mgr = roster.staff.find(x => x.role === 'manager') || roster.staff[0];
  tok = (await api('/api/supplier/login', { code: 'KIKUNOI', staffId: mgr.id, pin: '1234' })).body.token;
});
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('een rekening op de kamer boeken kan alleen als die kamer een gastrekening heeft', async () => {
  const rek = (await H('/rekening/open', { kanaal: 'hotelrestaurant', tafel: 'Rest 4', kamer: '204' })).body.rekening;
  await H('/rekening/regel', { rekeningId: rek.id, naam: 'Diner', prijs: 62.5 });

  const zonder = await H('/betaal', { rekeningId: rek.id, wijze: 'kamer' });
  assert.equal(zonder.status, 404, 'zonder open folio verdwijnt er niets in kamer 204');
  assert.match(zonder.body.error, /geen open gastrekening/);

  const folio = (await H('/folio/open', { kamer: '204', gastnaam: 'Fam. Okafor', gasten: 2,
    nachtprijs: 189, toeristenbelasting: 4.5, van: '2026-08-01', tot: '2026-08-04' })).body.folio;
  assert.equal(folio.totaal, 0);
  assert.equal((await H('/folio/open', { kamer: '204' })).status, 409, 'twee open gastrekeningen op een kamer kan niet');

  const betaald = (await H('/betaal', { rekeningId: rek.id, wijze: 'kamer' })).body;
  assert.equal(betaald.gesloten, true);
  const na = (await H('/folio', { kamer: '204' })).body.folio;
  assert.equal(na.totaal, 6250, 'het diner staat op de folio');
  assert.equal(na.regels[0].soort, 'restaurant');
  assert.match(na.regels[0].omschrijving, /Rest 4/);
});

test('de nachtrun is idempotent en zet de toeristenbelasting apart', async () => {
  const eerste = (await H('/folio/nacht', { datum: '2026-08-01' })).body;
  assert.equal(eerste.geboekt, 1);
  assert.equal(eerste.centen, 18900 + 450 * 2, 'kamer plus toeristenbelasting per gast');

  const nogeens = (await H('/folio/nacht', { datum: '2026-08-01' })).body;
  assert.equal(nogeens.geboekt, 0);
  assert.equal(nogeens.overgeslagen, 1, 'twee keer draaien boekt niet twee nachten');

  await H('/folio/nacht', { datum: '2026-08-02' });
  const f = (await H('/folio', { kamer: '204' })).body.folio;
  const kamerregels = f.regels.filter(r => r.soort === 'kamer');
  const belasting = f.regels.filter(r => r.soort === 'toeristenbelasting');
  assert.equal(kamerregels.length, 2);
  assert.equal(belasting.length, 2);
  assert.equal(belasting[0].centen, 900, 'de belasting staat op een eigen regel, niet in de kamerprijs');
});

test('de borg is een aantekening en blokkeert niets bij de bank', async () => {
  const borg = (await H('/folio/borg', { kamer: '204', bedrag: 250 })).body;
  assert.equal(borg.borg.centen, 25000);
  assert.equal(borg.borg.geblokkeerdBijBank, false);
  assert.match(borg.let, /niets vastgezet bij de bank/);

  const zonderReden = await H('/folio/borg', { kamer: '204', terug: true, ingehouden: 40 });
  assert.equal(zonderReden.status, 400, 'inhouden zonder reden kan niet');

  const terug = (await H('/folio/borg', { kamer: '204', terug: true, ingehouden: 40, reden: 'gebroken lamp' })).body;
  assert.equal(terug.borg.ingehouden, 4000);
  const f = (await H('/folio', { kamer: '204' })).body.folio;
  assert.ok(f.regels.some(r => r.soort === 'schade' && /lamp/.test(r.omschrijving)), 'de inhouding staat als regel op de folio');
});

test('afrekenen sluit de folio en toont het totaal per soort', async () => {
  const voor = (await H('/folio', { kamer: '204' })).body.folio;
  const deel = (await H('/folio/afrekenen', { kamer: '204', wijze: 'pin', bedrag: 100 })).body;
  assert.equal(deel.gesloten, false);
  assert.equal(deel.openstaand, voor.openstaand - 10000);

  const teveel = await H('/folio/afrekenen', { kamer: '204', wijze: 'pin', bedrag: 9999 });
  assert.equal(teveel.status, 400);

  const rest = (await H('/folio/afrekenen', { kamer: '204', wijze: 'pin' })).body;
  assert.equal(rest.gesloten, true);
  assert.equal(rest.openstaand, 0);
  assert.ok(rest.perSoort.kamer > 0 && rest.perSoort.restaurant > 0, 'per soort uitgesplitst');
  assert.equal((await H('/folio', { kamer: '204' })).status, 404, 'de folio is dicht');
});

test('een offerte wordt pas een opdracht na een akkoord met naam', async () => {
  const e = (await H('/event/offerte', { naam: 'Bruiloft Okafor', datum: '2026-09-12', gasten: 350,
    posten: [{ omschrijving: 'Diner 3 gangen', aantal: 350, prijs: 62.5 }, { omschrijving: 'Drankarrangement', aantal: 350, prijs: 32 }] })).body.event;
  assert.equal(e.status, 'offerte');
  assert.equal(e.totaalCenten, 350 * 6250 + 350 * 3200);

  const vroeg = await H('/event/aanbetaling', { eventId: e.id, bedrag: 5000 });
  assert.equal(vroeg.status, 409, 'aanbetalen op een offerte zonder opdracht hoort niet');

  const naamloos = await H('/event/akkoord', { eventId: e.id });
  assert.equal(naamloos.status, 400);
  assert.match(naamloos.body.error, /Zonder naam is het geen opdracht/);

  const akkoord = (await H('/event/akkoord', { eventId: e.id, door: 'A. Okafor', op: '2026-06-01', kanaal: 'mail' })).body.event;
  assert.equal(akkoord.status, 'bevestigd');
  assert.equal(akkoord.akkoord.versie, 1);
  assert.equal(akkoord.akkoord.totaalCenten, e.totaalCenten, 'het akkoord legt het bedrag van dat moment vast');

  const aan = (await H('/event/aanbetaling', { eventId: e.id, bedrag: 8000 })).body;
  assert.equal(aan.event.aanbetaald, 800000);
  assert.equal(aan.deel, Math.round(800000 / e.totaalCenten * 100));
  assert.equal((await H('/event/aanbetaling', { eventId: e.id, bedrag: 1000000 })).status, 400, 'meer dan het totaal kan niet');
});

test('posten wijzigen na akkoord vraagt een nieuw akkoord, en de oude versie blijft', async () => {
  const e = (await H('/event/offerte', { naam: 'Diner Nova', gasten: 40,
    posten: [{ omschrijving: 'Menu', aantal: 40, prijs: 55 }] })).body.event;
  await H('/event/akkoord', { eventId: e.id, door: 'NOVA bv' });

  const gewijzigd = (await H('/event/posten', { eventId: e.id,
    posten: [{ omschrijving: 'Menu', aantal: 55, prijs: 55 }] })).body;
  assert.equal(gewijzigd.opnieuwAkkoordNodig, true);
  assert.equal(gewijzigd.event.status, 'offerte', 'het akkoord vervalt bij een nieuwe versie');
  assert.equal(gewijzigd.event.versie, 2);
  assert.equal(gewijzigd.event.historie.length, 1);
  assert.equal(gewijzigd.event.historie[0].totaal, 40 * 5500, 'de vorige versie blijft bewaard');

  const opnieuw = (await H('/event/akkoord', { eventId: e.id, door: 'NOVA bv' })).body.event;
  assert.equal(opnieuw.status, 'bevestigd');
  assert.equal(opnieuw.akkoord.versie, 2);
});

test('een nacalculatie zonder kosten toont geen marge van honderd procent', async () => {
  const e = (await H('/event/offerte', { naam: 'Lunch Atlas', gasten: 20,
    posten: [{ omschrijving: 'Lunch', aantal: 20, prijs: 27.5 }] })).body.event;
  const leeg = (await H('/event/nacalculatie', { eventId: e.id })).body;
  assert.equal(leeg.compleet, false);
  assert.equal(leeg.margeCenten, null);
  assert.equal(leeg.margeProcent, null);
  assert.match(leeg.let, /geen nacalculatie/);

  await H('/event/kosten', { eventId: e.id, soort: 'inkoop', omschrijving: 'Versmarkt', bedrag: 180 });
  await H('/event/kosten', { eventId: e.id, soort: 'uren', omschrijving: 'Bediening', bedrag: 240, uren: 16 });
  const uit = (await H('/event/nacalculatie', { eventId: e.id })).body;
  assert.equal(uit.compleet, true);
  assert.equal(uit.opbrengstCenten, 55000);
  assert.equal(uit.kostenCenten, 42000);
  assert.equal(uit.margeCenten, 13000);
  assert.equal(uit.margeProcent, 23.6);
  assert.equal(uit.gewerkteUren, 16);
  assert.equal(uit.perGast, 650);
});

test('de eventlijst toont de stand per event, en filtert op status', async () => {
  const e = (await H('/event/offerte', { naam: 'Personeelsfeest Atlas', datum: '2026-12-19', gasten: 80,
    posten: [{ omschrijving: 'Walking dinner', aantal: 80, prijs: 39.5 }] })).body.event;

  const alles = (await H('/event/lijst', {})).body;
  const rij = alles.events.find(x => x.id === e.id);
  assert.ok(rij, 'het event staat in de lijst');
  assert.equal(rij.status, 'offerte');
  assert.equal(rij.totaalCenten, 316000, '80 x 39,50');
  assert.equal(rij.aanbetaald, 0);

  await H('/event/akkoord', { eventId: e.id, door: 'H. Atlas', kanaal: 'getekend' });
  await H('/event/aanbetaling', { eventId: e.id, bedrag: 1000 });

  const bevestigd = (await H('/event/lijst', { status: 'bevestigd' })).body;
  const na = bevestigd.events.find(x => x.id === e.id);
  assert.ok(na, 'na het akkoord staat hij onder bevestigd');
  assert.equal(na.aanbetaald, 100000, 'en de aanbetaling telt mee in de lijst');
  assert.ok(!(await H('/event/lijst', { status: 'afgerond' })).body.events.some(x => x.id === e.id),
    'een filter dat niets hoort te vinden, vindt ook niets');
});

test('op de folio boeken kan per soort, en niet op een kamer zonder gastrekening', async () => {
  await H('/folio/open', { kamer: '404', gastnaam: 'Mevrouw Devries', gasten: 1, nachtprijs: 120 });

  const raar = await H('/folio/boek', { kamer: '404', soort: 'wasserij', omschrijving: 'Overhemden', bedrag: 0 });
  assert.equal(raar.status, 400, 'een boeking zonder bedrag doet niets');

  const leeg = await H('/folio/boek', { kamer: '900', soort: 'minibar', omschrijving: 'Water', bedrag: 3 });
  assert.equal(leeg.status, 404, 'op een lege kamer boekt niemand iets');

  const spa = (await H('/folio/boek', { kamer: '404', soort: 'spa', omschrijving: 'Massage 50 min', bedrag: 89 })).body;
  assert.equal(spa.regel.soort, 'spa');
  assert.equal(spa.folio.totaal, 8900);

  // een onbekende soort belandt bewust op "overig" in plaats van te verdwijnen
  const gek = (await H('/folio/boek', { kamer: '404', soort: 'helikopter', omschrijving: 'Transfer', bedrag: 250 })).body;
  assert.equal(gek.regel.soort, 'overig');
  assert.equal(gek.folio.totaal, 33900);
  assert.equal(gek.folio.openstaand, 33900, 'er is nog niets betaald');
  assert.ok(gek.soorten.includes('toeristenbelasting'), 'de soortenlijst reist mee voor het scherm');
});

