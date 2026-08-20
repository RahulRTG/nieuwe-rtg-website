/* ============================================================================
   DE PRIJS VAN EEN AI-BUNDEL: gerekend, niet gekozen.

   De bundels stonden in kern/commercie/tegoed.js met capaciteit en een naam en
   NADRUKKELIJK zonder prijs -- de verkoopprijs hoort gerekend te worden, en de
   inkoopkant bestond niet. Dat was eerlijk maar geen eindstand: de klant krijgt
   te horen dat hij een bundel kan kopen, en dan hoort er te staan wat die kost.

   DE BEWERINGEN DIE ERTOE DOEN:

     toets 1  zonder ingestelde inkoopkosten is er GEEN prijs -- geen nul, geen
              geraden bedrag
     toets 5  geen enkele bundel verkoopt onder de kostprijs, ook niet na
              afronding

   Draai los: node --experimental-sqlite --test test/bundelprijs.test.js
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const bp = require('../server/kern/commercie/bundelprijs');
const tegoed = require('../server/kern/commercie/tegoed');

const INSTEL = { inkoopCentenPer1000: 40 };

/* DE BEWERING. Zelfde regel als bij een contractuele pas: null betekent "hier is
   nog niets afgesproken", nul zou "gratis" betekenen, en een geraden bedrag is
   precies gat 4.12. */
test('1. zonder ingestelde inkoopkosten is er geen prijs, en dat is een antwoord', () => {
  const p = bp.prijsVan('ai-m', {});
  assert.equal(p.centen, null);
  assert.match(p.reden, /inkoopkosten staan niet ingesteld/);
  assert.notEqual(p.centen, 0, 'nul zou "gratis" betekenen');

  assert.equal(bp.prijsVan('ai-m', { inkoopCentenPer1000: -1 }).centen, null,
    'een onmogelijke instelling is ook geen instelling');
  assert.equal(bp.prijsVan('ai-m', null).centen, null);
});

test('2. de som staat in het antwoord, zodat de prijs na te rekenen is', () => {
  const p = bp.prijsVan('ai-m', INSTEL);          // 20.000 credits
  assert.equal(p.som.inkoopCenten, 800, '20 x 40 cent per 1000');
  assert.equal(p.som.veiligheidsmarge, bp.VEILIGHEIDSMARGE);
  assert.equal(p.som.naVeiligheidCenten, 1000);
  assert.equal(p.som.platformmarge, bp.PLATFORMMARGE);
  assert.equal(p.som.naPlatformCenten, 1400);
  assert.equal(p.centen, 1400, 'en dat is precies een heel bedrag, dus geen afronding');
  assert.equal(p.margeCenten, 600);
});

test('3. een contractuele bundel heeft geen losse prijs', () => {
  const p = bp.prijsVan('ai-xl', INSTEL);
  assert.equal(p.contractueel, true);
  assert.equal(p.centen, null);
  assert.match(p.reden, /contractafspraak/);
  assert.ok(bp.prijsVan('bestaat-niet', INSTEL).error);
});

test('4. afronden gaat omhoog, en levert bedragen op die een mens kan lezen', () => {
  assert.equal(bp.nettePrijs(137), 200, 'kleine bedragen op hele euro naar boven');
  assert.equal(bp.nettePrijs(100), 100, 'een rond bedrag blijft staan');
  assert.equal(bp.nettePrijs(13744), 14000, 'grotere bedragen op vijf euro');
  assert.equal(bp.nettePrijs(5001), 5500);
  /* Omlaag afronden zou een bundel onder zijn eigen som brengen, en dat merk je
     pas bij volume. */
  assert.ok(bp.nettePrijs(137) > 137);
});

/* DE TWEEDE BEWERING, en de enige die er echt toe doet. */
test('5. geen enkele bundel verkoopt onder de kostprijs', () => {
  assert.equal(bp.keur(INSTEL), null, bp.keur(INSTEL));
  // ook niet bij extreme inkoopprijzen, waar de afronding het meeste doet
  for (const per1000 of [1, 7, 13, 99, 250, 1000, 9999]) {
    const inst = { inkoopCentenPer1000: per1000 };
    assert.equal(bp.keur(inst), null, 'bij ' + per1000 + ' cent per 1000: ' + bp.keur(inst));
    for (const p of bp.lijst(inst)) {
      if (p.centen === null) continue;
      assert.ok(p.centen >= p.som.inkoopCenten, p.naam + ' onder inkoop bij ' + per1000);
      assert.ok(p.margeCenten > 0, p.naam + ' zonder marge bij ' + per1000);
    }
  }
});

test('6. de veiligheidsmarge zit er echt in, en dat is een productkeuze', () => {
  const p = bp.prijsVan('ai-l', INSTEL);
  assert.ok(p.som.naVeiligheidCenten > p.som.inkoopCenten,
    'een klant koopt capaciteit en geen model, dus RTG mag het model vervangen -- ' +
    'wordt het duurder voordat de bundel op is, dan draagt RTG dat verschil. ' +
    'De marge is precies die verzekering.');
  assert.equal(p.som.naVeiligheidCenten, Math.round(p.som.inkoopCenten * 1.25));
});

test('7. elke bundel uit het tegoed heeft een prijsregel', () => {
  const uit = bp.lijst(INSTEL);
  assert.equal(uit.length, Object.keys(tegoed.BUNDELS).length,
    'een bundel die te koop is en geen prijsregel heeft, is de vorige fout terug');
  for (const p of uit) assert.ok(p.naam, 'elke regel heeft een naam');
});

/* Zonder prijs geen verkoop. Credits weggeven omdat een som ontbreekt, is de
   duurste manier om een gat te verbergen -- en het is precies wat `koopBundel`
   deed toen bundels nog geen prijs hadden. */
test('8. een bundel zonder vastgestelde prijs is niet te koop', () => {
  const t = tegoed.maakTegoed({ db: { data: {} }, save: () => {}, nu: () => 1 });
  const zonder = t.koopBundel('Zaak', 'business-lite', 'ai-m', bp.prijsVan('ai-m', {}));
  assert.equal(zonder.status, 409, 'geen prijs, geen verkoop');
  assert.match(zonder.error, /inkoopkosten staan niet ingesteld/);
  assert.equal(t.stand('Zaak', 'business-lite').bijgekocht, 0, 'en er zijn geen credits weggegeven');

  const met = t.koopBundel('Zaak', 'business-lite', 'ai-m', bp.prijsVan('ai-m', INSTEL));
  assert.equal(met.status, 200);
  assert.equal(met.centen, 1400, 'de gerekende prijs, en die staat op de aankoop');
  assert.equal(t.stand('Zaak', 'business-lite').bijgekocht, 20000);
});

/* Het maandmaximum van automatisch aanvullen telde tegen NUL, zolang er geen
   prijs was. Een maximum waar niets tegenaan telt, is geen maximum. */
test('9. de bundelprijs telt mee in het maandmaximum van automatisch aanvullen', () => {
  const t = tegoed.maakTegoed({ db: { data: {} }, save: () => {}, nu: () => 1 });
  t.zetBeleid('Zaak', 'business-lite', { beleid: 'AUTO_AANVULLEN', bundel: 'ai-m', maandMaxCenten: 1000 });
  t.verbruik('Zaak', 'business-lite', 20000);

  const prijs = bp.prijsVan('ai-m', INSTEL);      // 1400 centen, boven het maximum van 1000
  const r = t.mag('Zaak', 'business-lite', 100, { bundelPrijs: prijs });
  assert.equal(r.mag, false);
  assert.equal(r.reden, 'maandmaximum',
    'een aanvulling die het maandmaximum overschrijdt, hoort geweigerd te worden');
  assert.match(r.uitleg, /maandmaximum/);
});
