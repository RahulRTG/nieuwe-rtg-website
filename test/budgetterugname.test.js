/* EEN MISLUKT BUDGET MAG EEN LID NIET BUITENSLUITEN.

   Twee besluiten die elk apart kloppen:

     kern/pay/budget.js      eerst de positie klaarzetten, dan boeken -- want
                             andersom staat er even saldo op een rekening
                             zonder klasse, en dat is precies wat deze laag
                             moet voorkomen
     kern/waarde/uitgifte.js MAX_PER_LID = 25, "meer open budgetten per lid is
                             een lek, geen gebruik"

   Samen sloten ze een lid buiten. Gemeten op 31 augustus 2026: 24 mislukte
   pogingen van EEN werkgever met te weinig saldo laten 24 lege posities
   achter, en bij de 25e krijgt het LID 429 "Dit lid heeft te veel open
   posities" -- van iedereen, niet alleen van die werkgever. Geen kwade opzet
   nodig: een werkgever die het even niet heeft en het opnieuw probeert.

   De reparatie neemt de registratie terug als de boeking faalt. Deze toets
   bewaakt de GRENS daaromheen, want een grootboek hoort niet te kunnen
   vergeten: er wordt alleen iets teruggenomen waarvan is AANGETOOND dat er
   nooit geld op stond. */
'use strict';
const test = require('node:test');
const assert = require('node:assert');

function maakWaarde() {
  const db = { data: {} };
  const crypto = require('node:crypto');
  const { maakWaarde } = require('../server/kern/waarde');
  return maakWaarde({ db, save: () => {}, crypto, nu: () => Date.now() }).waarde;
}

test('een lege positie wordt teruggenomen', () => {
  const w = maakWaarde();
  const v = w.uitgifteVoorbereiden({ klasse: 'EMPLOYER_BUDGET', aanCodenaam: 'Proef Lid',
    centen: 1000, uitgever: 'ZAAK' });
  assert.ok(v.ok, v.error);
  assert.equal(w.positiesVan('Proef Lid').length, 2, 'de eigen wallet plus deze positie');
  const t = w.uitgifteTerug(v.rek, { saldoCenten: 0 });
  assert.ok(t.ok, t.error);
  assert.equal(w.positiesVan('Proef Lid').length, 1, 'alleen de eigen wallet blijft over');
});

/* DE GRENS. Een positie met geld erop wordt niet teruggenomen -- ook niet als
   de aanroeper dat vraagt. */
test('een positie met saldo wordt NIET teruggenomen', () => {
  const w = maakWaarde();
  const v = w.uitgifteVoorbereiden({ klasse: 'EMPLOYER_BUDGET', aanCodenaam: 'Proef Lid',
    centen: 1000, uitgever: 'ZAAK' });
  const t = w.uitgifteTerug(v.rek, { saldoCenten: 5000 });
  assert.ok(t.error, 'een positie met geld hoort te blijven staan');
  assert.equal(t.status, 409);
  assert.ok(w.positie(v.rek), 'en hij staat er nog');
});

/* En zonder BEWIJS gebeurt er niets: de waardelaag houdt zelf geen saldo bij
   (dat staat in de kop van kern/waarde/index.js), dus wie niets aantoont
   krijgt een weigering en geen stilte. */
test('zonder aangetoond saldo wordt er niets teruggenomen', () => {
  const w = maakWaarde();
  const v = w.uitgifteVoorbereiden({ klasse: 'EMPLOYER_BUDGET', aanCodenaam: 'Proef Lid',
    centen: 1000, uitgever: 'ZAAK' });
  for (const arg of [undefined, {}, { saldoCenten: null }]) {
    const t = w.uitgifteTerug(v.rek, arg);
    assert.ok(t.error, 'zonder bewijs hoort dit te weigeren');
    assert.equal(t.status, 400);
  }
  assert.ok(w.positie(v.rek), 'en de positie staat er nog');
});

test('een positie die niet bestaat levert een nette weigering', () => {
  const w = maakWaarde();
  const t = w.uitgifteTerug('waarde:BESTAATNIET', { saldoCenten: 0 });
  assert.equal(t.status, 404);
});

/* En de reden dat dit alles bestaat: het plafond per lid mag niet vollopen met
   mislukte pogingen. */
test('mislukte pogingen vullen het plafond per lid niet', () => {
  const w = maakWaarde();
  const max = w.MAX_PER_LID;
  for (let i = 0; i < max + 5; i++) {
    const v = w.uitgifteVoorbereiden({ klasse: 'EMPLOYER_BUDGET', aanCodenaam: 'Proef Lid',
      centen: 1000, uitgever: 'ZAAK' });
    assert.ok(v.ok, 'poging ' + (i + 1) + ' werd geweigerd: ' + v.error);
    w.uitgifteTerug(v.rek, { saldoCenten: 0 });   // de boeking faalde
  }
  const nog = w.uitgifteVoorbereiden({ klasse: 'EMPLOYER_BUDGET', aanCodenaam: 'Proef Lid',
    centen: 1000, uitgever: 'ZAAK' });
  assert.ok(nog.ok, 'na ' + (max + 5) + ' mislukte pogingen hoort een budget nog te kunnen: ' + nog.error);
});
