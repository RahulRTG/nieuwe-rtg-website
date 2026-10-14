/* REVENUE CATALOG CONTRACT V1.

   Deze toets bewaakt dat AI Extra S één leesbare commerciële identiteit krijgt
   zonder een tweede bron voor capability, aanbod of prijs te maken. De pilot is
   bewust onkoopbaar: zelfs met een berekende prijs initieert hij geen betaling,
   boekt hij geen tegoed en verleent hij geen entitlement. De zwaarste toetsen
   zijn 4 en 7: commerciële effecten blijven false en semantische drift wordt
   door het gesloten contract geweigerd. */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const revenue = require('../server/kern/revenue');
const { OP_ID } = require('../server/functies/register');
const { BUNDELS } = require('../server/kern/commercie/tegoed/inhoud');
const bundelprijs = require('../server/kern/commercie/bundelprijs');

const C = revenue.catalogusV1;
const kopie = waarde => JSON.parse(JSON.stringify(waarde));

test('1. AI Extra S projecteert capability, aanbieding en prijs uit de bestaande bronnen', () => {
  const instellingen = { inkoopCentenPer1000: 20 };
  const catalogus = C.projecteerAiExtraS(instellingen);
  const product = catalogus.products[0];
  assert.equal(product.featureId, OP_ID['gld-aitegoed'].id);
  assert.equal(product.capabilityId, 'service.' + OP_ID['gld-aitegoed'].id);
  assert.equal(product.name, BUNDELS['ai-s'].naam);
  assert.equal(product.description, BUNDELS['ai-s'].wat);
  assert.equal(product.unit.quantity, BUNDELS['ai-s'].credits);
  assert.equal(product.price.amountCenten, bundelprijs.prijsVan('ai-s', instellingen).centen);
});

test('2. versie, commerciële identiteiten en contractdigest zijn expliciet en valide', () => {
  const catalogus = C.projecteerAiExtraS({ inkoopCentenPer1000: 20 });
  assert.equal(catalogus.schemaVersion, 1);
  assert.equal(catalogus.catalogVersion, '1.0.0');
  assert.equal(catalogus.products[0].productId, 'rtg.product.ai.extra-s');
  assert.equal(catalogus.products[0].productVersion, 1);
  assert.equal(catalogus.products[0].offerVersion, 1);
  assert.match(catalogus.contractDigest, /^sha256:[a-f0-9]{64}$/);
  assert.deepEqual(C.valideer(catalogus), { ok: true, fouten: [] });
});

test('3. zonder kostprijs is er geen prijs en blijft de pilot zichtbaar maar onkoopbaar', () => {
  const product = C.projecteerAiExtraS({}).products[0];
  assert.equal(product.price.state, 'UNAVAILABLE');
  assert.equal(product.price.amountCenten, null);
  assert.match(product.price.reason, /inkoopkosten/i);
  assert.equal(product.availability.catalogVisible, true);
  assert.equal(product.availability.purchasable, false);
});

test('3b. een nulprijs zonder marge wordt niet als beschikbare prijs geprojecteerd', () => {
  const product = C.projecteerAiExtraS({ inkoopCentenPer1000: 0 }).products[0];
  assert.equal(product.price.state, 'UNAVAILABLE');
  assert.equal(product.price.amountCenten, null);
  assert.match(product.price.reason, /marge/i);
});

test('4. ook met een berekende prijs ontstaan geen betaling, credits, abonnement of entitlement', () => {
  const product = C.projecteerAiExtraS({ inkoopCentenPer1000: 20 }).products[0];
  assert.equal(product.price.state, 'AVAILABLE');
  assert.equal(product.availability.purchasable, false);
  assert.deepEqual(product.effects, {
    paymentInitiated: false,
    creditGranted: false,
    subscriptionActivated: false,
    entitlementGranted: false
  });
});

test('5. de projectie is diep immutable en heeft geen mutatie-ingang', () => {
  const catalogus = C.projecteerAiExtraS({ inkoopCentenPer1000: 20 });
  assert.equal(Object.isFrozen(catalogus), true);
  assert.equal(Object.isFrozen(catalogus.products[0]), true);
  assert.equal(Object.isFrozen(catalogus.products[0].effects), true);
  assert.throws(() => { catalogus.products[0].name = 'Andere waarheid'; }, TypeError);
  assert.deepEqual(Object.keys(C).filter(k => /koop|betaal|verleen|activeer|credit/i.test(k)), []);
});

test('6. capability-, aanbod- en prijsherkomst zijn afzonderlijk traceerbaar', () => {
  const bronnen = C.projecteerAiExtraS({}).products[0].sources;
  assert.deepEqual(bronnen.map(x => x.role), ['CAPABILITY', 'OFFER', 'PRICING']);
  for (const bron of bronnen) {
    const bestand = path.join(__dirname, '..', bron.file);
    assert.equal(fs.existsSync(bestand), true, bron.file + ' bestaat');
    assert.match(fs.readFileSync(bestand, 'utf8'), new RegExp(bron.symbol.split('.').pop().replace('-', "[-']?"), 'i'));
  }
});

test('7. schema en gesloten validator weigeren semantische drift en extra velden', () => {
  const voorbeelden = [];
  const basis = C.projecteerAiExtraS({ inkoopCentenPer1000: 20 });
  let x = kopie(basis); x.catalogVersion = '2.0.0'; voorbeelden.push(x);
  x = kopie(basis); x.products[0].capabilityId = 'service.iets-anders'; voorbeelden.push(x);
  x = kopie(basis); x.products[0].availability.purchasable = true; voorbeelden.push(x);
  x = kopie(basis); x.products[0].effects.creditGranted = true; voorbeelden.push(x);
  x = kopie(basis); x.products[0].price.amountCenten = -1; voorbeelden.push(x);
  x = kopie(basis); x.products[0].price.reason = 'toch een fout'; voorbeelden.push(x);
  x = kopie(basis); x.products[0].name = 'Losse tweede waarheid'; voorbeelden.push(x);
  x = kopie(basis); x.products[0].unit.quantity += 1; voorbeelden.push(x);
  x = kopie(basis); x.products[0].kind = 'ABONNEMENT'; voorbeelden.push(x);
  x = kopie(basis); x.products[0].sources[0].file = 'verzonnen.js'; voorbeelden.push(x);
  x = kopie(basis); x.products[0].onbekend = true; voorbeelden.push(x);
  x = kopie(basis); x.products[0].price.onbekend = true; voorbeelden.push(x);
  for (const voorbeeld of voorbeelden) assert.equal(C.valideer(voorbeeld).ok, false);
});

test('8. het machineleesbare schema draagt dezelfde vaste contractidentiteiten', () => {
  const s = C.schema;
  assert.equal(s.properties.schemaVersion.const, 1);
  assert.equal(s.properties.catalogId.const, C.CATALOG_ID);
  assert.equal(s.properties.catalogVersion.const, C.CATALOG_VERSION);
  const product = s.$defs.product.properties;
  assert.equal(product.productId.const, C.PRODUCT_ID);
  assert.equal(product.offerId.const, C.OFFER_ID);
  assert.equal(product.capabilityId.const, C.CAPABILITY_ID);
  assert.equal(product.featureId.const, C.FEATURE_ID);
  assert.equal(product.kind.const, 'CAPACITY_ADD_ON');
  assert.ok(C.schema.$defs.price.allOf, 'prijsstatus en prijsvelden zijn samen gecontracteerd');
  const loop = (deel, pad) => {
    if (!deel || typeof deel !== 'object') return;
    if (Array.isArray(deel.required)) for (const veld of deel.required)
      assert.ok(deel.properties && Object.prototype.hasOwnProperty.call(deel.properties, veld),
        pad + ': verplicht veld ' + veld + ' moet ook als eigenschap zijn gedeclareerd');
    for (const [sleutel, waarde] of Object.entries(deel)) loop(waarde, pad + '.' + sleutel);
  };
  loop(s, '$');
});

test('9. het bekende risico reist mee zonder de bestaande kooproute te wijzigen', () => {
  const product = C.projecteerAiExtraS({}).products[0];
  assert.deepEqual(product.riskRefs, ['REV-AI-CREDIT-001']);
  const route = fs.readFileSync(path.join(__dirname, '../server/routes/member/aitegoed.js'), 'utf8');
  assert.match(route, /tegoed\.koopBundel/);
  assert.doesNotMatch(fs.readFileSync(require.resolve('../server/kern/revenue/catalogus-v1'), 'utf8'), /\.koopBundel\s*\(/);
});
