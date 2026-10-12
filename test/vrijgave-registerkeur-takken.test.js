/* DE KEURING VAN HET VRIJGAVEREGISTER (server/kern/vrijgave/registerkeur.js):
   iedere regel die een register laat zakken, afzonderlijk. Het echte register
   is de goede uitgangsstand; per toets breken we precies een ding en eisen dat
   de keuring die fout bij naam noemt -- en geen andere. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { valideerRegister } = require('../server/kern/vrijgave/registerkeur');
const reg = require('../server/kern/vrijgave/register');

const CONTROLES = ['paymentProvider', 'webhookDelivery', 'payoutProvider', 'refundPayoutSettlement', 'reconciliation'];
const VERMOGENS = { WALLET_SALDO: {}, PARTNER_UITBETALING: {}, LID_UITBETALING: {} };
const kopie = () => reg.REGISTER.map(c => JSON.parse(JSON.stringify(c)));
const breek = (fn, opties = { controles: CONTROLES, vermogens: VERMOGENS }) => {
  const l = kopie(); fn(l); return valideerRegister(l, opties);
};

test('het echte register is goed, met en zonder de lijsten van vermogens en controles', () => {
  assert.deepEqual(valideerRegister(kopie(), { controles: CONTROLES, vermogens: VERMOGENS }), { ok: true, fouten: [] });
  assert.deepEqual(valideerRegister(kopie()), { ok: true, fouten: [] });
  assert.deepEqual(reg.valideerRegister().fouten, [], 'de doorgifte in register.js gebruikt het eigen register');
});

test('een regel zonder geldige id wordt gemeld met "?" en verder overgeslagen', () => {
  const r = valideerRegister([null, { id: 3 }, { id: 'Geld.A' }, { id: 'geld' }]);
  assert.equal(r.ok, false);
  assert.deepEqual(r.fouten.filter(f => /id ongeldig/.test(f)), ['?: id ongeldig', '3: id ongeldig', 'Geld.A: id ongeldig', 'geld: id ongeldig']);
});

test('iedere ontbrekende of verkeerd getypte eigenschap heeft een eigen fout', () => {
  const geval = [
    [l => { l[0].naam = ''; }, 'naam ontbreekt'],
    [l => { delete l[0].eigenaar; }, 'eigenaar ontbreekt'],
    [l => { l[0].geimplementeerd = 'ja'; }, 'geimplementeerd is geen boolean'],
    [l => { l[0].geld = 1; }, 'geld is geen boolean'],
    [l => { l[0].beveiliging = null; }, 'beveiliging is geen boolean'],
    [l => { l[0].noodknop = 'ja'; }, 'noodknop is geen boolean'],
    [l => { l[0].standen = []; }, 'standen ontbreken'],
    [l => { l[0].standen = ['disabled', 'emergency_disabled', 'half']; }, 'onbekende stand half'],
    [l => { l[0].veiligeStand = 'shadow'; l[0].standen = ['disabled', 'emergency_disabled']; }, 'veilige stand staat niet in de eigen standen'],
    [l => { l[0].veiligeStand = 'enabled'; }, 'geld of veiligheid moet veilig op disabled staan'],
    [l => { l[0].standen = ['disabled', 'enabled']; }, 'noodknop zonder emergency_disabled'],
    [l => { l[0].afhankelijk = 'geld.inkomend'; }, 'afhankelijk is geen lijst'],
    [l => { l[0].bewijs = null; }, 'bewijs zonder controles'],
    [l => { l[0].bewijs = { controles: 'reconciliation' }; }, 'bewijs zonder controles'],
    [l => { l[0].bewijs.controles = ['verzonnen']; }, 'onbekende externe controle verzonnen'],
    [l => { l[0].bevoegdheid = null; }, 'autorisatiebeleid ontbreekt'],
    [l => { l[0].bevoegdheid = { besluit: 'verzonnen.besluit' }; }, 'onbekend besluit verzonnen.besluit'],
    [l => { l[1].bevoegdheid = { vermogen: 'VERZONNEN' }; }, 'onbekend bevoegdheidsvermogen VERZONNEN'],
    [l => { l[0].toetsen = []; }, 'geen toetsen genoemd'],
    [l => { delete l[0].toetsen; }, 'geen toetsen genoemd']
  ];
  for (const [fn, zin] of geval) {
    const r = breek(fn);
    assert.equal(r.ok, false, zin);
    assert.ok(r.fouten.some(f => f.endsWith(': ' + zin)), zin + ' -> ' + r.fouten.join(' / '));
  }
});

test('een niet-geldregel mag een andere veilige stand hebben, en zonder noodknop is emergency_disabled niet verplicht', () => {
  const r = breek(l => {
    Object.assign(l[0], { geld: false, beveiliging: false, noodknop: false, standen: ['disabled', 'shadow'], veiligeStand: 'shadow' });
  });
  assert.deepEqual(r.fouten, []);
  /* Zonder standenlijst kan de noodknopregel niet eens kijken; dan meldt hij
     alleen dat de standen ontbreken. */
  const s = breek(l => { delete l[0].standen; });
  assert.ok(s.fouten.includes('geld.inkomend: standen ontbreken'));
  assert.equal(s.fouten.some(f => /noodknop/.test(f)), false);
});

test('zonder lijst van vermogens wordt een onbekend vermogen niet gekeurd, met lijst wel', () => {
  assert.deepEqual(breek(l => { l[1].bevoegdheid = { vermogen: 'VERZONNEN' }; }, {}).fouten, []);
});

test('een afhankelijkheid die niet bestaat en een kring worden genoemd; een lege regel breekt de kringcontrole niet', () => {
  const r = breek(l => { l[0].afhankelijk = ['geld.nergens']; l.push(null); });
  assert.ok(r.fouten.includes('geld.inkomend: afhankelijkheid geld.nergens bestaat niet'));
  const k = breek(l => { l[8].afhankelijk = ['geld.opwaarderen']; });
  assert.ok(k.fouten.some(f => /^kring in afhankelijkheden: .*geld\.opwaarderen -> geld\.intern_saldo -> geld\.opwaarderen|^kring in afhankelijkheden: .*geld\.intern_saldo -> geld\.opwaarderen -> geld\.intern_saldo/.test(f)), k.fouten.join(' / '));
});

test('een echte provider op een neplijst laat de keuring zakken, ook in een andere schrijfwijze', () => {
  const rails = (nep, lokaal) => ({ NEPRAILS: nep, LOKALE_NEPRAILS: lokaal, ECHTE_PROVIDERS: ['stripe', 'stripe_connect', 'mollie'] });
  assert.deepEqual(valideerRegister(kopie(), { rails: rails(['simulatie'], ['intern']) }).fouten, []);
  const a = valideerRegister(kopie(), { rails: rails(['simulatie', 'Stripe'], ['intern']) });
  assert.deepEqual(a.fouten, ['neprail Stripe is een echte provider']);
  const b = valideerRegister(kopie(), { rails: rails([], ['stripe-connect']) });
  assert.deepEqual(b.fouten, ['neprail stripe-connect is een echte provider']);
});
