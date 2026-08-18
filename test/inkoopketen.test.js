/* ============================================================================
   DE KETEN VAN BESTELLEN NAAR KEUKEN -- 5 endpoints uit de supplier-groep.

   groothandel/product, groothandel/voorraad, inkoop/annuleer,
   inkoop/ai-bevestig en mep/daily/done stonden als nooit aangeroepen in de
   waargenomen dekkingsmeting. test/groothandel.test.js beproefde het
   assortiment tonen, bestellen en het AI-voorstel opvragen; wat er daarna
   gebeurt -- het voorstel bevestigen, de bestelling annuleren, de voorraad
   bijstellen -- niet.

   WAT ER OP HET SPEL STAAT

   - DE VOORRAAD MOET KLOPPEN. Een bestelling haalt voorraad af; annuleren zet
     hem terug. Zou dat niet gebeuren, dan verdwijnt er bij elke afgezegde
     bestelling voorraad die er wel is, en staat de groothandel op papier leeg
     terwijl het magazijn vol ligt. Dit is de enige bewering hier die je met
     tellen kunt controleren, en hij staat in toets 3.
   - ANNULEREN KAN ALLEEN ZOLANG ER NIETS GEBEURD IS. Een bevestigde
     bestelling annuleren is geen annulering maar een terugboeking, en die
     hoort niet achter dezelfde knop te zitten.
   - EEN AI-VOORSTEL IS EEN VOORSTEL. inkoop/ai-bevestig plaatst de bestelling
     pas als een mens op de knop drukt, met de regels die DIE mens meestuurt
     -- niet met wat de AI voorstelde. Het verschil staat in toets 4.
   - EEN BESTELLING VAN DE BUREN BESTAAT HIER NIET.

   Draai los: node --test test/inkoopketen.test.js
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let srv, base, gh, ghWerker, horeca, horecaWerker, buurzaak;
let productId = null, ref = null;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-inkoop-'));

function api(pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}
async function inlog(code, rol) {
  const roster = await api('/api/supplier/roster', { code });
  const wie = (roster.body.staff || []).find(x => x.role === rol);
  return wie ? (await api('/api/supplier/login', { code, staffId: wie.id, pin: rol === 'manager' ? '1234' : '5678' })).body.token : null;
}
const assortiment = t => api('/api/supplier/groothandel/overzicht', {}, t).then(r => r.body.producten || []);
const voorraadVan = async (t, pid) => (await assortiment(t)).find(p => p.id === pid).voorraad;

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, DEMO_SUPPLIER: 'MERCABIZA' } });
  base = srv.base;
  gh = (await api('/api/supplier/login', { username: 'rahul', password: 'Imran' })).body.token;
  ghWerker = await inlog('MERCABIZA', 'staff');
  horeca = await inlog('KIKUNOI', 'manager');
  horecaWerker = await inlog('KIKUNOI', 'staff');
  buurzaak = await inlog('HOSHI', 'manager');
  assert.ok(gh && horeca && buurzaak, 'de groothandel en twee kopers staan klaar');
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('1. het assortiment beheert de eigenaar van de groothandel', async () => {
  assert.equal((await api('/api/supplier/groothandel/product', { naam: 'Iets' }, horeca)).status, 409,
    'een restaurant is geen groothandel');
  if (ghWerker) assert.equal((await api('/api/supplier/groothandel/product', { naam: 'Iets' }, ghWerker)).status, 403,
    'en binnen de groothandel is het assortiment van de eigenaar');
  assert.equal((await api('/api/supplier/groothandel/product', { naam: '' }, gh)).status, 400, 'zonder naam');

  const mk = await api('/api/supplier/groothandel/product',
    { naam: 'Ibiza-zeezout, grof', categorie: 'Droog & houdbaar', eenheid: 'kg',
      inkoopPrijs: 3.20, voorraad: 40, minBestel: 2, btw: 9, herkomst: 'Ses Salines' }, gh);
  assert.equal(mk.status, 200, JSON.stringify(mk.body));
  productId = mk.body.product.id;
  assert.equal(mk.body.product.voorraad, 40);
  assert.equal(mk.body.product.actief, true, 'een nieuw product staat aan');
  /* Zonder consumentprijs rekent het huis er zelf een: inkoop maal 1,35. Dat
     is geen verzonnen marge maar de afspraak in kern/groothandel/assortiment.js;
     hier staat hij vast zodat hij niet stilletjes verandert. */
  assert.equal(mk.body.product.consumentPrijs, 4.32, 'de consumentprijs volgt de vaste opslag');

  // hetzelfde id nog eens is bijwerken, geen tweede product
  const bij = await api('/api/supplier/groothandel/product', { id: productId, naam: 'Ibiza-zeezout, fijn', inkoopPrijs: 3.5 }, gh);
  assert.equal(bij.body.producten.filter(p => p.id === productId).length, 1, 'geen dubbel product');
  assert.equal(bij.body.product.naam, 'Ibiza-zeezout, fijn');
  assert.equal(bij.body.product.voorraad, 40, 'wat je niet meestuurt blijft staan');
});

test('2. de voorraad bijstellen mag het hele magazijn, maar alleen het eigen', async () => {
  assert.equal((await api('/api/supplier/groothandel/voorraad', { id: productId, voorraad: 60 }, horeca)).status, 409,
    'een restaurant heeft geen groothandelsvoorraad');
  assert.equal((await api('/api/supplier/groothandel/voorraad', { id: 'bestaatniet', voorraad: 5 }, gh)).status, 404);

  const z = await api('/api/supplier/groothandel/voorraad', { id: productId, voorraad: 60 }, gh);
  assert.equal(z.status, 200);
  assert.equal(z.body.voorraad, 60);
  /* Het magazijn tellen is werk van de vloer, niet van de directie -- vandaar
     geen managercontrole hier terwijl die bij het assortiment wel staat. Wat
     een product KOST bepaalt de eigenaar; hoeveel er LIGT ziet wie er staat. */
  if (ghWerker) assert.equal((await api('/api/supplier/groothandel/voorraad', { id: productId, voorraad: 55 }, ghWerker)).status, 200,
    'wie in het magazijn staat mag tellen');

  const terug = await api('/api/supplier/groothandel/voorraad', { id: productId, voorraad: -5 }, gh);
  assert.ok(terug.body.voorraad >= 0, 'een negatieve voorraad bestaat niet');
  await api('/api/supplier/groothandel/voorraad', { id: productId, voorraad: 60 }, gh);
});

test('3. annuleren zet de voorraad terug -- en dat is te tellen', async () => {
  const voor = await voorraadVan(gh, productId);
  const bestel = await api('/api/supplier/inkoop/bestel',
    { groothandelCode: 'MERCABIZA', regels: [{ productId, aantal: 12 }] }, horeca);
  assert.equal(bestel.status, 200, JSON.stringify(bestel.body));
  ref = bestel.body.order.ref;
  assert.equal(bestel.body.order.status, 'aangevraagd');

  const tijdens = await voorraadVan(gh, productId);
  assert.equal(tijdens, voor - 12, 'de bestelling haalt de voorraad af');

  assert.equal((await api('/api/supplier/inkoop/annuleer', { ref }, buurzaak)).status, 404,
    'de bestelling van een andere zaak bestaat hier niet');
  assert.equal((await api('/api/supplier/inkoop/annuleer', { ref: 'BESTAATNIET' }, horeca)).status, 404);
  assert.equal(await voorraadVan(gh, productId), tijdens, 'en die mislukte pogingen raakten de voorraad niet');

  const weg = await api('/api/supplier/inkoop/annuleer', { ref }, horeca);
  assert.equal(weg.status, 200);
  assert.equal(await voorraadVan(gh, productId), voor,
    'na annuleren ligt alles weer in het magazijn: de balans klopt');

  assert.equal((await api('/api/supplier/inkoop/annuleer', { ref }, horeca)).status, 409,
    'twee keer annuleren is geen tweede handeling');
});

test('4. een AI-voorstel is een voorstel: de mens bepaalt wat er besteld wordt', async () => {
  const voorstel = await api('/api/supplier/inkoop/ai', { groothandelCode: 'MERCABIZA' }, horeca);
  assert.equal(voorstel.status, 200, JSON.stringify(voorstel.body).slice(0, 200));

  /* Het bevestigen gebruikt de regels die de MENS meestuurt, niet wat de AI
     voorstelde. Daarom kan de gemachtigde er hier andere regels in zetten en
     wordt precies dat besteld. Zou de route zijn eigen voorstel opnieuw
     berekenen, dan bestelt het huis iets wat niemand goedkeurde. */
  const voor = await voorraadVan(gh, productId);
  const b = await api('/api/supplier/inkoop/ai-bevestig',
    { groothandelCode: 'MERCABIZA', regels: [{ productId, aantal: 3 }] }, horeca);
  assert.equal(b.status, 200, JSON.stringify(b.body));
  assert.equal(b.body.order.regels.length, 1, 'precies de regels van de mens');
  assert.equal(b.body.order.regels[0].aantal, 3);
  assert.equal(b.body.order.bron, 'ai', 'wel met de herkomst erbij: dit kwam uit een AI-voorstel');
  assert.equal(await voorraadVan(gh, productId), voor - 3);

  // zonder regels valt er niets te bevestigen
  assert.equal((await api('/api/supplier/inkoop/ai-bevestig', { groothandelCode: 'MERCABIZA', regels: [] }, horeca)).status, 400);
  assert.equal((await api('/api/supplier/inkoop/ai-bevestig', { groothandelCode: 'BESTAATNIET', regels: [{ productId, aantal: 1 }] }, horeca)).status, 404);

  await api('/api/supplier/inkoop/annuleer', { ref: b.body.order.ref }, horeca);
});

test('5. de mise en place afvinken is werk van de vloer', async () => {
  const datum = new Date().toISOString().slice(0, 10);
  const plan = await api('/api/supplier/mep/daily', { date: datum, covers: 60 }, horeca);
  assert.equal(plan.status, 200, JSON.stringify(plan.body).slice(0, 200));
  const taken = plan.body.plan.tasks || [];
  assert.ok(taken.length, 'er staat een dagplan');
  const taakId = taken[0].id;

  assert.equal((await api('/api/supplier/mep/daily/done', { date: datum, taskId: 'bestaatniet' }, horeca)).status, 404);
  assert.equal((await api('/api/supplier/mep/daily/done', { date: '2020-01-01', taskId: taakId }, horeca)).status, 404,
    'een dag zonder plan');

  const af = await api('/api/supplier/mep/daily/done', { date: datum, taskId: taakId }, horecaWerker);
  assert.equal(af.status, 200, 'afvinken doet wie het werk doet, niet alleen de chef');
  const na = (af.body.plan.tasks || []).find(t => t.id === taakId);
  assert.equal(na.done, true);
  assert.ok(na.doneBy, 'met de naam erbij: wie zegt dat het klaar is, staat erbij');

  /* Nog eens drukken zet hem weer open. Dat is met opzet een schakelaar en
     geen eenrichtingsknop: wie zich vergist in de drukte moet het kunnen
     terugzetten zonder een chef te zoeken. */
  const terug = await api('/api/supplier/mep/daily/done', { date: datum, taskId: taakId }, horecaWerker);
  const uit = (terug.body.plan.tasks || []).find(t => t.id === taakId);
  assert.equal(uit.done, false, 'nog eens drukken zet de taak weer open');
  assert.equal(uit.doneBy, null, 'en de naam gaat er dan ook af');

  assert.equal((await api('/api/supplier/mep/daily/done', { date: datum, taskId: taakId }, buurzaak)).status, 404,
    'het dagplan van een andere zaak bestaat hier niet');
});
