'use strict';
/* AUTORISATIE IS GEEN OMKEERBAARHEID -- eigenaarsbesluit 2B-aangepast, 11 oktober 2026.

   Na een tweede handtekening gaf voornemen/keuring.js `omkeerbaar: true` mee aan de
   herkeuring. Daarmee ging elke geldhandeling boven de omkeerbaarheidsgrens van
   kern/commercie/besluit.js (2.500 euro) door zodra er een tweede mens tekende, ook
   een teruggave of een incassoronde die per definitie niet terug kan. Vier beweringen:

   a. na een tweede handtekening blijft een onomkeerbare handeling onomkeerbaar;
   b. boven de grens wordt zij geweigerd, met de reden en de weg erbij, en er beweegt
      geen geld;
   c. de uitzonderingsprocedure weigert zolang de grendel dicht is (de standaard);
   d. staat de grendel open (alleen in deze toets), dan gaat het door MET een
      risicogoedkeuring op naam -- en de uitslag beweert nog steeds niet dat het terug
      kan. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { maakBesluit, UITKOMST, BELEID } = require('../server/kern/commercie/besluit');
const { maakGeldketen } = require('../server/kern/kantoor/geldketen');
const { maakVoornemens } = require('../server/kern/commercie/voornemen');
const { maakBeslis } = require('../server/kern/kantoor/geldbevoegdheid');
const uitz = require('../server/kern/commercie/uitzondering');
const bewijs = require('../server/kern/commercie/bewijstoken');

function huis({ grendel } = {}) {
  const bakken = {};
  const bak = (naam) => (bakken[naam] = bakken[naam] || []);
  const token = bewijs.maakBewijstoken({ sleutel: Buffer.from('01234567890123456789012345678901'),
    gezien: bewijs.geheugenGezien() });
  const beslisser = maakBeslis({ munt: token.munt, uitzondering: grendel });
  const voornemens = maakVoornemens({ db: { data: {} }, save: () => {}, verbruikToken: token.verbruik,
    beslis: (v) => beslisser.beslis(v) });
  const frictie = require('../server/kern/frictie').maakRisico({
    beleid: { getal: (n, s) => s, waarde: (n, s) => s } });
  return { ketenlaag: maakGeldketen({ voornemens, frictie, bak }), voornemens };
}

const GROOT = BELEID.omkeerbaarBovenCenten + 50000;   // 3.000 euro
const opgave = (extra) => Object.assign({
  klasse: 'geld-reeks', handeling: 'GELD_INNEN', pad: '/api/office/bank/incasso', doel: 'incassoronde groot',
  mens: { naam: 'ans', sleutel: 'user-1' }, assurance: { ok: true, bewezen: true },
  streefstand: 'elke vaste betaling die aan de beurt was, is geind of staat met een mislukking bij zijn post',
  tegenfeit: { graad: 'vermoed', uitslag: { bedragCenten: GROOT }, reden: 'bovengrens',
    over: '/api/office/bank/handtekening/bevestig', effecten: ['GELD_BEWEGEN', 'SCHRIJVEN_ANDERMANS'] },
  stappen: [{ wat: 'incassoronde', doel: 'groot', centen: GROOT, gegevens: { tot: 1 } }],
  totaalCenten: GROOT, sleutel: 'incasso:groot',
  uitvoerbelofte: { graad: 'gemeten', uitslag: 'hervatbaar per post', reden: 'per post' },
}, extra || {});

test('a+b. een tweede handtekening maakt een onomkeerbare handeling niet omkeerbaar; boven de grens weigert zij met reden', async () => {
  const { ketenlaag, voornemens } = huis();
  const klaar = ketenlaag.klaarzet(opgave());
  assert.equal(klaar.voornemen.stand, 'WACHT', JSON.stringify(klaar.voornemen.besluit));
  const t = ketenlaag.tekenAf({ id: klaar.voornemen.id, door: 'bert' });
  assert.equal(t.status, 403, JSON.stringify(t));
  assert.match(t.error, /terug te draaien/);
  assert.match(t.error, /uitzonderingsprocedure.*dicht/, 'de weigering noemt de weg (de procedure en dat zij dicht staat)');
  const v = voornemens.vind(klaar.voornemen.id);
  assert.equal(v.stand, 'AFGEWEZEN');
  assert.equal(v.besluit.uitkomst, UITKOMST.OMKEERBAAR);
  assert.equal(v.besluit.omkeerbaar, false, 'na de handtekening heet de handeling omkeerbaar');
  let geraakt = false;
  const r = await ketenlaag.uitvoer({ id: klaar.voornemen.id, door: 'bert', doe: async () => { geraakt = true; return { ok: true }; } });
  assert.ok(r.status >= 400);
  assert.equal(geraakt, false, 'er is geld bewogen na een weigering');
});

test('a. een handeling die het DOMEIN omkeerbaar noemt, gaat na de handtekening wel door', async () => {
  const { ketenlaag } = huis();
  const klaar = ketenlaag.klaarzet(opgave({ omkeerbaar: true, sleutel: 'incasso:omkeerbaar' }));
  const t = ketenlaag.tekenAf({ id: klaar.voornemen.id, door: 'bert' });
  assert.ok(t.ok, JSON.stringify(t));
  assert.equal(t.voornemen.stand, 'GEKEURD');
});

test('c. de uitzonderingsprocedure weigert zolang de grendel dicht is, ook met een geldige risicogoedkeuring', async () => {
  assert.equal(uitz.stand().open, false, 'zonder grendel hoort de procedure dicht te staan');
  const { ketenlaag, voornemens } = huis();
  const klaar = ketenlaag.klaarzet(opgave());
  const rg = voornemens.risicoGoedkeur(klaar.voornemen.id, { door: 'carla', reden: 'De ronde is met de bank afgestemd.' });
  assert.ok(rg.ok, JSON.stringify(rg));
  const t = ketenlaag.tekenAf({ id: klaar.voornemen.id, door: 'bert' });
  assert.equal(t.status, 403);
  assert.match(t.error, /staat dicht/);
});

test('d. met de grendel open (alleen hier) gaat het door met een risicogoedkeuring, en het blijft onomkeerbaar', async () => {
  const open = () => ({ open: true });
  const b = maakBesluit({ zoekBevoegdheid: () => ({ capability: 'X', scope: '*', grenzen: {}, keten: [] }), uitzondering: open });
  const zonder = b.beslis({ actor: 'ans', handeling: 'X', waardeCenten: GROOT,
    context: { goedgekeurdDoor: 'bert', bevestigingVers: true } });
  assert.equal(zonder.uitkomst, UITKOMST.OMKEERBAAR, 'zonder risicogoedkeuring gaat ook een open grendel niet door');
  const zelf = b.beslis({ actor: 'ans', handeling: 'X', waardeCenten: GROOT,
    context: { goedgekeurdDoor: 'bert', bevestigingVers: true, risicogoedkeuring: { door: 'ans', reden: 'mijn eigen akkoord graag' } } });
  assert.equal(zelf.uitkomst, UITKOMST.OMKEERBAAR, 'de aanvrager gaf zichzelf de risicogoedkeuring');
  const met = b.beslis({ actor: 'ans', handeling: 'X', waardeCenten: GROOT,
    context: { goedgekeurdDoor: 'bert', bevestigingVers: true, risicogoedkeuring: { door: 'carla', reden: 'Met de bank afgestemd, risico gedragen.' } } });
  assert.equal(met.uitkomst, UITKOMST.TOESTAAN, JSON.stringify(met));
  assert.equal(met.omkeerbaar, false, 'een uitzondering beweert nooit dat het terug kan');
  assert.equal(met.uitzondering.soort, 'onomkeerbaar, uitzondering met risicogoedkeuring');
  assert.match(met.reden, /Onomkeerbaar, uitzondering met risicogoedkeuring van carla/);
});

test('een risicogoedkeuring hoort voor het besluit en draagt naam en reden', () => {
  const { ketenlaag, voornemens } = huis();
  const klaar = ketenlaag.klaarzet(opgave());
  const id = klaar.voornemen.id;
  assert.equal(voornemens.risicoGoedkeur(id, { door: 'carla', reden: 'kort' }).status, 400);
  assert.equal(voornemens.risicoGoedkeur(id, { door: 'ans', reden: 'Ik keur mijn eigen risico goed.' }).status, 400);
  ketenlaag.tekenAf({ id, door: 'bert' });
  assert.equal(voornemens.risicoGoedkeur(id, { door: 'carla', reden: 'Te laat, er is al besloten.' }).status, 409);
});
