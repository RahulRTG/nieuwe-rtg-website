/* RTG Horeca OS, deel 5: HACCP, de fooienpot, de loonkosten, het gastprofiel
   en het dagbeeld.

   Wat hier bewezen wordt:
   - een temperatuur buiten de grens kan niet worden genoteerd zonder actie, en
     een correctie laat de oude waarde staan;
   - een controlelijst kan niet in een keer worden afgevinkt;
   - de fooienpot telt exact op tot de pot, ook als de deling niet uitkomt;
   - het loonpercentage rekent met de omzet ZONDER fooi;
   - een verkochte rekening boekt de ingredienten af via het bestaande
     keukenbrein (geen tweede voorraadadministratie);
   - het dagbeeld noemt bij elk gemiddelde zijn noemer en houdt fooi en
     oninbaar apart.
   Draai: node --experimental-sqlite --test test/horeca-vloer.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'); const os = require('os'); const path = require('path');
const { startServer } = require('./helper');

let BASE, child, tok;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-vloer-'));
const api = (pad, body, token) => fetch(BASE + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
const H = (pad, body) => api('/api/supplier/horeca' + pad, body, tok);
const vandaag = new Date().toISOString().slice(0, 10);

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

test('een temperatuur buiten de grens kan niet zonder actie worden weggeschreven', async () => {
  const zonderGrens = await H('/haccp/punt', { naam: 'Koeling 1' });
  assert.equal(zonderGrens.status, 400, 'een meetpunt zonder grens is geen controle');

  const punt = (await H('/haccp/punt', { id: 'koel1', naam: 'Koeling 1', min: 0, max: 7 })).body.punt;
  assert.equal((await H('/haccp/meting', { puntId: punt.id, waarde: 4 })).body.meting.afwijking, false);

  const heet = await H('/haccp/meting', { puntId: punt.id, waarde: 11 });
  assert.equal(heet.status, 400);
  assert.equal(heet.body.afwijking, true);
  assert.match(heet.body.error, /Noteer wat u hebt gedaan/);

  const met = (await H('/haccp/meting', { puntId: punt.id, waarde: 11, actie: 'product weggegooid, monteur gebeld' })).body.meting;
  assert.equal(met.afwijking, true);
  assert.match(met.actie, /monteur/);

  // corrigeren mag, maar de oude waarde blijft staan
  const zonderReden = await H('/haccp/meting/corrigeer', { metingId: met.id, waarde: 5 });
  assert.equal(zonderReden.status, 400);
  const gecorrigeerd = (await H('/haccp/meting/corrigeer', { metingId: met.id, waarde: 5, reden: 'verkeerde thermometer' })).body.meting;
  assert.equal(gecorrigeerd.waarde, 5);
  assert.equal(gecorrigeerd.afwijking, false);
  assert.equal(gecorrigeerd.correcties[0].was, 11, 'de oorspronkelijke waarde blijft staan');

  const log = (await H('/haccp/logboek', {})).body;
  assert.equal(log.aantal, 2);
  assert.deepEqual(log.gemistVandaag, [], 'dit punt is vandaag gemeten');
});

test('batches: wat over de datum is staat bovenaan en gaat niet vanzelf weg', async () => {
  await H('/haccp/batch', { naam: 'Kipfilet', tht: '2020-01-01', batch: 'L2019', leverancier: 'Versgroep' });
  await H('/haccp/batch', { naam: 'Room', tht: '2099-01-01' });
  const lijst = (await H('/haccp/batches', {})).body;
  assert.equal(lijst.over, 1);
  assert.equal(lijst.batches[0].naam, 'Kipfilet', 'het oudste staat bovenaan');
  assert.ok(lijst.batches[0].dagenTeGaan < 0);
  assert.match(lijst.let, /niet automatisch afgeboekt/);

  const zonderReden = await H('/haccp/batch/weg', { batchId: lijst.batches[0].id });
  assert.equal(zonderReden.status, 400);
  const weg = (await H('/haccp/batch/weg', { batchId: lijst.batches[0].id, reden: 'over de datum, weggegooid' })).body;
  assert.equal(weg.batch.weg, true);
  assert.equal((await H('/haccp/batches', {})).body.over, 0);
});

test('een controlelijst kan niet in een keer worden afgevinkt', async () => {
  await H('/haccp/lijst', { naam: 'Opening', moment: 'opening', vragen: ['Koelingen gecontroleerd', 'Werkbladen schoon', 'Afwasmachine op temperatuur'] });
  const half = await H('/haccp/afvinken', { naam: 'Opening', antwoorden: [{ akkoord: true }] });
  assert.equal(half.status, 400);
  assert.match(half.body.error, /alle 3 punten/);

  const zonderOpmerking = await H('/haccp/afvinken', { naam: 'Opening',
    antwoorden: [{ akkoord: true }, { akkoord: false }, { akkoord: true }] });
  assert.equal(zonderOpmerking.status, 400, 'niet-akkoord vraagt een opmerking');

  const uit = (await H('/haccp/afvinken', { naam: 'Opening',
    antwoorden: [{ akkoord: true }, { akkoord: false, opmerking: 'plint bij de spoelbak' }, { akkoord: true }] })).body;
  assert.equal(uit.controle.akkoord, false);
  assert.equal(uit.controle.rijen.length, 3);
});

test('de fooienpot telt exact op tot de pot, ook als de deling niet uitkomt', async () => {
  // twee rekeningen met fooi, allebei vandaag gesloten
  for (const [tafel, prijs, fooi] of [['Tafel 1', 40, 5], ['Tafel 2', 60, 5.01]]) {
    const r = (await H('/rekening/open', { kanaal: 'tafel', tafel })).body.rekening;
    await H('/rekening/regel', { rekeningId: r.id, naam: 'Diner', prijs });
    await H('/fooi', { rekeningId: r.id, bedrag: fooi });
    await H('/betaal', { rekeningId: r.id, wijze: 'pin' });
  }
  const zonder = await H('/fooienpot', { datum: vandaag });
  assert.equal(zonder.status, 400, 'zonder deelnemers valt er niets te verdelen');

  const uit = (await H('/fooienpot', { datum: vandaag, deelnemers: [
    { naam: 'Sam', uren: 8 }, { naam: 'Isa', uren: 5 }, { naam: 'Kees (afwas)', uren: 4 }
  ] })).body;
  assert.equal(uit.potCenten, 1001, 'de fooi van beide rekeningen zit in de pot');
  assert.equal(uit.verdeling.reduce((t, v) => t + v.centen, 0), uit.potCenten, 'de som van de delen is exact de pot');
  assert.equal(uit.verdeling.length, 3);
  assert.ok(uit.verdeling[0].centen >= uit.verdeling[1].centen, 'wie meer uren maakt, krijgt niet minder');
  assert.match(uit.let, /inclusief keuken en afwas/);
});

test('het loonpercentage rekent met de omzet zonder fooi', async () => {
  const zonder = await H('/loonkosten', { datum: '2020-01-01' });
  assert.equal(zonder.status, 404, 'zonder diensten geen percentage');

  const uit = (await H('/loonkosten', { datum: vandaag, diensten: [
    { naam: 'Sam', uren: 8, uurloon: 16, afdeling: 'zaal' },
    { naam: 'Isa', uren: 5, uurloon: 18, afdeling: 'keuken' }
  ] })).body;
  assert.equal(uit.omzetCenten, 10000, 'de omzet van de twee rekeningen, zonder fooi');
  assert.equal(uit.fooiCenten, 1001, 'de fooi staat apart');
  assert.equal(uit.loonCenten, 8 * 1600 + 5 * 1800);
  assert.equal(uit.loonpercentage, Math.round((8 * 1600 + 5 * 1800) / 10000 * 1000) / 10);
  assert.equal(uit.perAfdeling.keuken, 9000);
  assert.equal(uit.omzetPerUur, Math.round(10000 / 13));
});

test('een betaalde rekening boekt de ingredienten af via het bestaande keukenbrein', async () => {
  // eigen opzet: een artikel, een gerecht en een recept -- geen afhankelijkheid
  // van wat er toevallig in de startdata staat
  const art = (await api('/api/supplier/voorraad/zet',
    { naam: 'Kipfilet', aantal: 20, min: 2, eenheid: 'kg', kostprijs: 9 }, tok)).body;
  const artikel = (art.voorraad || []).find(a => a.naam === 'Kipfilet');
  assert.ok(artikel, 'het artikel staat in de voorraad');
  await api('/api/supplier/menu', { menu: [{ id: 'kip1', cat: 'Hoofd', name: 'Kip van het huis', price: 22 }] }, tok);
  const recept = await api('/api/supplier/keuken/recept',
    { menuItemId: 'kip1', regels: [{ artikelId: artikel.id, hoeveelheid: 2 }] }, tok);
  assert.equal(recept.status, 200, 'het recept is gekoppeld');
  const voor = (await api('/api/supplier/keuken', {}, tok)).body.artikelen.find(a => a.id === artikel.id).aantal;

  const r = (await H('/rekening/open', { kanaal: 'tafel', tafel: 'Tafel 9' })).body.rekening;
  await H('/rekening/regel', { rekeningId: r.id, naam: 'Kip van het huis', prijs: 22, aantal: 3 });
  await H('/betaal', { rekeningId: r.id, wijze: 'pin' });

  const na = (await api('/api/supplier/keuken', {}, tok)).body.artikelen.find(a => a.id === artikel.id).aantal;
  assert.equal(Math.round((voor - na) * 1000) / 1000, 6, 'drie porties van twee eenheden zijn afgeboekt');

  // en de logregel zegt dat het uit de horeca-rekening kwam
  const log = (await api('/api/supplier/keuken', {}, tok)).body.logboek;
  assert.ok(log.some(x => x.soort === 'verkoop' && /horeca/.test(String(x.wie))), 'de afboeking staat op naam van de horecarekening');
});

test('het dagbeeld houdt fooi en oninbaar apart en noemt bij elk gemiddelde zijn noemer', async () => {
  const weg = (await H('/rekening/open', { kanaal: 'terras', tafel: 'T5', gasten: 2 })).body.rekening;
  await H('/rekening/regel', { rekeningId: weg.id, naam: 'Bier', prijs: 6, aantal: 2 });
  await H('/oninbaar', { rekeningId: weg.id, reden: 'gasten weggelopen' });

  const d = (await H('/dagbeeld', {})).body;
  assert.ok(d.omzetCenten >= 10000);
  assert.equal(d.fooiCenten, 1001, 'fooi staat apart van de omzet');
  assert.equal(d.oninbaar.bonnen, 1);
  assert.equal(d.oninbaar.centen, 1200);
  assert.match(d.oninbaar.redenen[0], /weggelopen/);
  assert.equal(d.gemiddeldePerBon, Math.round(d.omzetCenten / d.bonnen), 'het gemiddelde noemt zijn noemer');
  assert.ok(d.perKanaal.some(k => k.kanaal === 'tafel'));
  assert.ok(d.perBetaalwijze.pin > 0);

  const sig = (await H('/signalen', {})).body;
  assert.ok(Array.isArray(sig.signalen));
  assert.match(sig.let, /geen advies bij dat wij niet kunnen onderbouwen/);
});

test('een gastprofiel bewaart voorkeuren, geen waarde-per-gast', async () => {
  const g = (await H('/gast', { naam: 'M. Okafor', allergie: 'noten', voorkeur: 'stille tafel, geen muziek dichtbij', bezoek: true })).body.gast;
  assert.equal(g.allergie, 'noten');
  assert.equal(g.bezoeken, 1);
  const plat = JSON.stringify(g);
  assert.ok(plat.indexOf('waarde') < 0 && plat.indexOf('score') < 0, 'geen waarde- of scoreveld');

  const min = await H('/gast', { naam: 'M. Okafor', punten: -50 });
  assert.equal(min.status, 400, 'een gast kan niet onder nul punten');
  const punten = (await H('/gast', { naam: 'M. Okafor', punten: 120, reden: 'diner' })).body.gast;
  assert.equal(punten.punten, 120);

  const lijst = (await H('/gasten', {})).body;
  assert.equal(lijst.metAllergie, 1);
});
