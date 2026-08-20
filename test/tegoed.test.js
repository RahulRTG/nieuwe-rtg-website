/* ============================================================================
   AI-TEGOED: regel 5 en 6, en nu voor het eerst afgedwongen.

   Ze stonden in PRIJZEN.md als NIET afgedwongen, en dat was eerlijk -- de laag
   bestond niet:

     5. AI boven de inbegrepen capaciteit vraagt een bundel, expliciete
        toestemming of een vooraf ingestelde aanvulling.
     6. Geen abonnement veroorzaakt ooit ONGEMERKT variabele kosten.

   Regel 6 is de strengste. "Ongemerkt" is het sleutelwoord: het gaat er niet om
   DAT er kosten zijn, maar dat een klant ze nooit ontdekt nadat ze zijn gemaakt.

   DE BEWERINGEN DIE ERTOE DOEN:

     toets 4  boven het plafond gebeurt er NIETS zonder een keuze van de klant
     toets 6  automatisch aanvullen zonder maandmaximum wordt geweigerd
     toets 9  er wordt nergens een tokenaantal getoond

   Draai los: node --experimental-sqlite --test test/tegoed.test.js
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const { maakTegoed, BELEID, BUNDELS, inbegrepenVoor } = require('../server/kern/commercie/tegoed');

function verse() {
  const db = { data: {} };
  return maakTegoed({ db, save: () => {}, nu: () => Date.parse('2026-08-20T10:00:00Z') });
}

test('1. elke trede heeft zijn eigen inbegrepen tegoed', () => {
  assert.equal(inbegrepenVoor('gratis'), 0, 'RTG Community heeft geen AI-tegoed');
  assert.equal(inbegrepenVoor('rtg'), 2000);
  assert.equal(inbegrepenVoor('business-lite'), 20000, 'een ruim zakelijk budget');
  assert.equal(inbegrepenVoor('business'), null, 'contractueel');
  assert.equal(inbegrepenVoor('lifestyle'), null, 'contractueel');
  assert.equal(inbegrepenVoor('bestaat-niet'), 0, 'onbekend is nul, niet onbeperkt');
});

test('2. een trede zonder AI-capability krijgt niets, ook niet een beetje', () => {
  const t = verse();
  const r = t.mag('Anemoon', 'gratis', 1);
  assert.equal(r.mag, false);
  assert.equal(r.reden, 'geen-ai');
  assert.match(r.uitleg, /bevat geen AI/);
});

test('3. binnen het tegoed mag het, met de rest erbij', () => {
  const t = verse();
  const r = t.verbruik('Anemoon', 'rtg', 500);
  assert.equal(r.mag, true);
  assert.equal(r.geboekt, 500);
  assert.equal(r.rest, 1500);
  assert.equal(t.stand('Anemoon', 'rtg').gebruiktPct, 25);
});

/* DE BEWERING. Boven het plafond gebeurt er niets zonder een keuze van de
   klant -- dat is regel 5 en 6 in een. */
test('4. boven het plafond gebeurt er niets zonder keuze, en het zegt wat je kunt doen', () => {
  const t = verse();
  t.verbruik('Anemoon', 'rtg', 2000);            // tegoed precies op
  const r = t.verbruik('Anemoon', 'rtg', 100);

  assert.equal(r.mag, false, 'er wordt niets stilzwijgend bijgekocht');
  assert.equal(r.geboekt, 0, 'en er wordt niets geboekt: geen ongemerkte kosten');
  assert.equal(r.reden, 'plafond');
  assert.equal(r.tekort, 100, 'met hoeveel er tekort is');
  assert.ok(r.bundels.length >= 3, 'en met wat de klant kan doen -- "nee" zonder uitweg is het probleem');
  assert.equal(t.stand('Anemoon', 'rtg').verbruikt, 2000, 'het verbruik is niet opgelopen');
});

test('5. de stand "stoppen bij de limiet" maakt echt geen kosten', () => {
  const t = verse();
  t.zetBeleid('Anemoon', 'rtg', { beleid: BELEID.STOP });
  t.verbruik('Anemoon', 'rtg', 2000);
  const r = t.verbruik('Anemoon', 'rtg', 1);
  assert.equal(r.mag, false);
  assert.equal(r.reden, 'gestopt');
  assert.match(r.uitleg, /geen extra kosten/);
});

/* DE TWEEDE BEWERING. Automatisch bijkopen zonder bovengrens IS ongemerkte
   variabele kosten, alleen met een vriendelijker naam. */
test('6. automatisch aanvullen vraagt een bundel EN een maandmaximum', () => {
  const t = verse();
  const zonderAlles = t.zetBeleid('Zaak', 'business-lite', { beleid: BELEID.AUTO_AANVULLEN });
  assert.equal(zonderAlles.status, 400);
  assert.match(zonderAlles.error, /welke bundel/);

  const zonderMax = t.zetBeleid('Zaak', 'business-lite', { beleid: BELEID.AUTO_AANVULLEN, bundel: 'ai-m' });
  assert.equal(zonderMax.status, 400);
  assert.match(zonderMax.error, /maandmaximum/, 'zonder bovengrens zijn het onzichtbare kosten');

  const nulMax = t.zetBeleid('Zaak', 'business-lite', { beleid: BELEID.AUTO_AANVULLEN, bundel: 'ai-m', maandMaxCenten: 0 });
  assert.equal(nulMax.status, 400, 'een maximum van nul is geen maximum maar een uitgezette functie');

  const goed = t.zetBeleid('Zaak', 'business-lite', { beleid: BELEID.AUTO_AANVULLEN, bundel: 'ai-m', maandMaxCenten: 5000 });
  assert.equal(goed.status, 200);
  assert.equal(goed.maandMaxCenten, 5000);
});

/* Een restaurant hoort niet op vrijdagavond te ontdekken dat de
   menukaartvertaling stilstaat. */
test('7. met automatisch aanvullen loopt het door, zichtbaar en geboekt', () => {
  const t = verse();
  t.zetBeleid('Zaak', 'business-lite', { beleid: BELEID.AUTO_AANVULLEN, bundel: 'ai-m', maandMaxCenten: 5000 });
  t.verbruik('Zaak', 'business-lite', 20000);      // het inbegrepen tegoed op
  const r = t.verbruik('Zaak', 'business-lite', 100);

  assert.equal(r.mag, true);
  assert.equal(r.reden, 'auto-aangevuld');
  assert.equal(r.bundel, 'ai-m');
  const s = t.stand('Zaak', 'business-lite');
  assert.equal(s.bijgekocht, BUNDELS['ai-m'].credits, 'de bundel staat er echt bij');
  assert.ok(s.bundels.length, 'en de aanvulling is terug te vinden');
});

test('8. een contractuele trede kent hier geen plafond', () => {
  const t = verse();
  const r = t.verbruik('Zaak', 'business', 999999);
  assert.equal(r.mag, true);
  assert.equal(r.reden, 'contract', 'de hoogte staat op het contract, niet in deze tabel');
  assert.equal(t.stand('Zaak', 'business').contractueel, true);
});

/* DE DERDE BEWERING. Niet "nog 1.293.582 tokens" maar "AI-tegoed deze maand:
   72% gebruikt". */
test('9. de stand toont een percentage en nergens een tokenaantal', () => {
  const t = verse();
  t.verbruik('Anemoon', 'rtg', 1440);
  const s = t.stand('Anemoon', 'rtg');
  assert.equal(s.gebruiktPct, 72);
  assert.match(s.tekst, /72% gebruikt/);
  assert.doesNotMatch(s.tekst, /token/i, 'een klant koopt capaciteit, geen tokens');

  /* En niet alleen in die ene zin. Elk ding dat deze laag NAAR BUITEN geeft --
     de stand, het oordeel, de bundels -- mag geen veld of waarde dragen dat over
     tokens of modellen gaat. Op het gedrag getoetst en niet op de brontekst:
     die bevat het woord juist in de uitleg dat het er niet hoort. */
  const verdacht = /token|model|gpt|claude|llm/i;
  const schoon = (waarde, pad) => {
    if (waarde == null) return;
    if (typeof waarde === 'string')
      return assert.doesNotMatch(waarde, verdacht, pad + ' noemt een model of tokens: ' + waarde);
    if (typeof waarde !== 'object') return;
    for (const [k, v] of Object.entries(waarde)) {
      assert.doesNotMatch(k, verdacht, pad + '.' + k + ' is een veld over tokens of modellen');
      schoon(v, pad + '.' + k);
    }
  };
  schoon(s, 'stand');
  schoon(t.mag('Anemoon', 'rtg', 999999), 'oordeel');
  schoon(BUNDELS, 'bundels');
});

test('10. bij 80% gaat de waarschuwing aan, en niet eerder', () => {
  const t = verse();
  const onder = t.verbruik('Anemoon', 'rtg', 1500);   // 75%
  assert.equal(onder.waarschuwing, false);
  const over = t.verbruik('Anemoon', 'rtg', 200);     // 85%
  assert.equal(over.waarschuwing, true);
});

test('11. het tegoed rolt om bij een nieuwe maand', () => {
  const db = { data: {} };
  let klok = Date.parse('2026-08-20T10:00:00Z');
  const t = maakTegoed({ db, save: () => {}, nu: () => klok });
  t.verbruik('Anemoon', 'rtg', 1800);
  assert.equal(t.stand('Anemoon', 'rtg').verbruikt, 1800);

  klok = Date.parse('2026-09-01T10:00:00Z');
  const s = t.stand('Anemoon', 'rtg');
  assert.equal(s.verbruikt, 0, 'inbegrepen PER MAAND is een leugen als het verbruik blijft staan');
  assert.equal(s.maand, '2026-09');
  assert.equal(s.beleid, BELEID.VRAAG_MIJ, 'maar de gekozen stand blijft wel staan');
});

test('12. een bundel is capaciteit met een naam, en noemt geen model', () => {
  for (const b of Object.values(BUNDELS)) {
    assert.ok(b.naam && b.wat, b.id + ' hoort een naam en een uitleg te hebben');
    assert.equal(b.model, undefined,
      'een klant koopt capaciteit, geen model -- anders kan een beter model er niet in zonder contractbreuk');
    assert.equal(b.prijsCenten, undefined,
      'de verkoopprijs wordt gerekend uit de inkoopkant en niet hier verzonnen (PRIJZEN.md 4.12)');
  }
  const t = verse();
  assert.equal(t.koopBundel('Zaak', 'business-lite', 'ai-xl').status, 400,
    'AI Enterprise is een contractafspraak en wordt niet los gekocht');
  assert.equal(t.koopBundel('Zaak', 'business-lite', 'bestaat-niet').status, 404);
});
