/* DE ZOEKENDE TEGENSTANDER (scripts/lib/tegenvoorbeeld.js, BEWIJSLUS.md par. 3).

   Wat hier bewezen wordt is niet dat RTG Pay klopt -- dat is de vraag die de
   zoeker stelt, en zijn antwoord hoort niet in een toets vastgevroren te worden.
   Wat hier bewezen wordt, is dat het INSTRUMENT werkt:

   1. HIJ KAN UITSLAAN, op elke wet die hij bewaakt. Twee gesaboteerde versies van
      kern/pay, elk met een fout die de andere wet niet raakt, en de zoeker moet
      ze allebei vinden en de JUISTE wet noemen (LAT.md regel 10: een meter die je
      niet hebt zien uitslaan, meet niets).
   2. HIJ KRIMPT. Het tegenvoorbeeld komt terug op hooguit twee stappen, en het
      verkleinde voorbeeld breekt nog steeds DEZELFDE wet.
   3. HIJ IS NA TE SPELEN. Hetzelfde zaad geeft dezelfde reeksen.
   4. HIJ ZEGT WAT HIJ NIET DEED. Weigert pay alles, dan is "niets gevonden" geen
      uitslag en noemt de zoeker de soorten die nooit slaagden.

   MUTATIES die zijn gedraaid (LAT.md regel 2):
   - in oordeelMetSpoor() de p2p-telling weghalen          -> toets 1b zakt
   - in oordeel() de sluitcontrole weghalen                -> toets 1a zakt
   - in krimp() de eis "dezelfde wet" weghalen             -> kan niet zakken op
     deze sabotage (er is maar een wet stuk), en daarom staat toets 2 op de
     wetnaam van het EINDresultaat en niet alleen op de lengte
   - in zoek() de telling `nietBeproefd` weghalen          -> toets 4 zakt
   - in oordeelMetSpoor() de telling per verzoek weghalen  -> toets 1c zakt

   LET OP bij 1c: RTG Pay had op 24 september 2026 zelf precies deze fout (twee
   gelijktijdige betalingen van hetzelfde verzoek, elk met een eigen sleutel).
   Zolang die er zit, kan 1c ook door de ECHTE fout groen staan in plaats van
   door de sabotage; de mutatie hierboven is daarom op de sabotage gedraaid.

   Draai los: node --test test/tegenvoorbeeld.test.js */
'use strict';
/* VOOR de require van server/betaal: die leest de omgeving eenmalig. Zonder de
   simulatiebank heeft deze opstelling geen geldbron en slaagt geen enkele
   oplading -- dan meet deze toets niets (zie toets 4). Zelfde opzet als
   test/magnaat-rtgketen.test.js, met de echte providers uit de omgeving. */
process.env.RTG_SIMULATIEBANK = '1';
delete process.env.STRIPE_SECRET_KEY;
delete process.env.MOLLIE_API_KEY;
delete process.env.ADYEN_API_KEY;
const test = require('node:test');
const assert = require('node:assert/strict');
const m = require('../scripts/lib/tegenvoorbeeld');
const { maakTeller } = require('../scripts/lib/rommel');

const SPELERS = m.maakWereld().spelers;

/* Sabotage A: na een geslaagde overdracht krijgt de ontvanger een cent bij
   zonder tegenboeking. Dat breekt de sluitcontrole en verder niets. */
const centErbij = (pay, db) => {
  const echt = pay.stuur;
  pay.stuur = async (a) => {
    const r = await echt(a);
    if (r && r.ok) db.data.paySaldi[pay.rekLid(a.aanCodenaam)] += 1;
    return r;
  };
};

/* Sabotage B: na een geslaagde overdracht staat er een tweede p2p-regel in het
   grootboek die bij geen enkel antwoord hoort. De saldi blijven kloppen, dus de
   sluitcontrole ziet niets -- alleen de tweede wet kan dit vangen. */
const verborgenTweede = (pay, db) => {
  const echt = pay.stuur;
  pay.stuur = async (a) => {
    const r = await echt(a);
    if (r && r.ok) {
      const rij = db.data.payBoekingen.find(x => x.id === r.boeking);
      db.data.payBoekingen.push(Object.assign({}, rij, { id: rij.id + '-X' }));
    }
    return r;
  };
};

/* Sabotage C: een betaald verzoek krijgt een tweede klompje-regel. Geen p2p,
   saldi kloppen -- alleen de derde wet kan dit zien. */
const verzoekTweeKeer = (pay, db) => {
  const echt = pay.verzoekBetaal;
  pay.verzoekBetaal = async (a) => {
    const r = await echt(a);
    if (r && r.ok) {
      const rij = db.data.payBoekingen.filter(x => x.soort === 'klompje' && x.ref === a.verzoekId).pop();
      if (rij) db.data.payBoekingen.push(Object.assign({}, rij, { id: rij.id + '-X' }));
    }
    return r;
  };
};

const zoekMet = (sabotage, extra) => m.zoek(Object.assign({
  zaad: 3, reeksen: 40, lengte: 10, spelers: SPELERS,
  maak: () => m.maakWereld({ sabotage })
}, extra || {}));

test('1a. hij vindt een cent uit het niets, en noemt de sluitcontrole', async () => {
  const u = await zoekMet(centErbij);
  assert.equal(u.gevonden, true, 'een saldo zonder tegenboeking hoort gevonden te worden');
  assert.equal(u.schending.wet, 'geld-conservatie');
});

test('1b. hij vindt een verborgen tweede boeking die de sluitcontrole niet ziet', async () => {
  const u = await zoekMet(verborgenTweede);
  assert.equal(u.gevonden, true, 'een boeking zonder antwoord hoort gevonden te worden');
  assert.equal(u.schending.wet, 'een herhaling boekt niets',
    'de sluitcontrole klopt hier; alleen de tweede wet kan dit zien');
});

test('1c. hij vindt een verzoek dat twee keer betaald is', async () => {
  const u = await zoekMet(verzoekTweeKeer);
  assert.equal(u.gevonden, true);
  assert.equal(u.schending.wet, 'een verzoek wordt ten hoogste een keer betaald');
});

test('2. het tegenvoorbeeld wordt verkleind en breekt dan nog steeds dezelfde wet', async () => {
  const u = await zoekMet(verborgenTweede);
  assert.ok(u.stappen.length <= 2, 'verkleind tot ' + u.stappen.length + ' stappen, verwacht hooguit 2');
  const ops = u.stappen.reduce((n, s) => n + s.ops.length, 0);
  assert.ok(ops <= 3, 'verkleind tot ' + ops + ' handelingen');
  const nog = await m.voerUit(u.stappen, () => m.maakWereld({ sabotage: verborgenTweede }));
  assert.equal(nog.schending && nog.schending.wet, 'een herhaling boekt niets',
    'het verkleinde voorbeeld breekt een andere wet, of geen');
});

test('3. hetzelfde zaad geeft dezelfde reeksen', () => {
  const a = m.genereer(maakTeller(11), 15, SPELERS);
  const b = m.genereer(maakTeller(11), 15, SPELERS);
  assert.deepEqual(a, b);
  const c = m.genereer(maakTeller(12), 15, SPELERS);
  assert.notDeepEqual(a, c, 'een ander zaad hoort een andere reeks te geven');
});

test('4. weigert pay alles, dan is niets gevonden geen uitslag', async () => {
  const allesNee = (pay) => {
    for (const k of ['laadOp', 'stuur', 'verzoekMaak', 'verzoekBetaal'])
      pay[k] = async () => ({ status: 503, error: 'dicht' });
  };
  const u = await zoekMet(allesNee, { reeksen: 10 });
  assert.equal(u.gevonden, false);
  assert.deepEqual(u.nietBeproefd.sort(), ['betaal', 'laad', 'stuur', 'verzoek'],
    'elke soort die nooit slaagde hoort genoemd te worden');
});
