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
const uitz = require('../server/kern/commercie/risicouitzondering');
const geldomkeer = require('../server/kern/commercie/geldomkeer');
const bewijs = require('../server/kern/commercie/bewijstoken');

function huis({ grendel } = {}) {
  const bakken = {};
  const bak = (naam) => (bakken[naam] = bakken[naam] || []);
  const token = bewijs.maakBewijstoken({ sleutel: Buffer.from('01234567890123456789012345678901'),
    gezien: bewijs.geheugenGezien() });
  const beslisser = maakBeslis({ munt: token.munt, onomkeerbaarGrendel: grendel });
  const voornemens = maakVoornemens({ db: { data: {} }, save: () => {}, verbruikToken: token.verbruik,
    beslis: (v) => beslisser.beslis(v) });
  const frictie = require('../server/kern/frictie').maakRisico({
    beleid: { getal: (n, s) => s, waarde: (n, s) => s } });
  return { ketenlaag: maakGeldketen({ voornemens, frictie, bak, onomkeerbaarGrendel: grendel }), voornemens };
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

const OPEN = () => ({ open: true });

test('b. boven de grens en niet omkeerbaar: meteen geweigerd bij het klaarzetten, met reden en weg, en er staat niets klaar', () => {
  const { ketenlaag, voornemens } = huis();
  const r = ketenlaag.klaarzet(opgave());
  assert.equal(r.status, 403, JSON.stringify(r));
  assert.match(r.error, /terug te draaien/);
  assert.match(r.error, /klant van RTG Bank/, 'de reden komt uit de tabel (waar het geld landt)');
  assert.match(r.error, /staat dicht/, 'de weg: de uitzonderingsprocedure en dat zij dicht staat');
  assert.doesNotMatch(r.error, /splits|buiten het systeem/, 'de weg moedigt geen opknippen of geld buiten het spoor aan');
  assert.equal(voornemens.lijst({ limit: 10 }).aantal, 0, 'er is toch een voornemen opgesteld');
  assert.equal(ketenlaag.lijst({}).aantal, 0, 'er is toch een dossier aangelegd');
});

test('b. een aanroeper kan omkeerbaar niet zelf aanzetten: de tabel beslist', () => {
  const { ketenlaag } = huis();
  const r = ketenlaag.klaarzet(opgave({ omkeerbaar: true, sleutel: 'incasso:zelf' }));
  assert.equal(r.status, 403, JSON.stringify(r));
});

test('a. een tweede handtekening maakt een onomkeerbare handeling niet omkeerbaar (grendel open, geen risicogoedkeuring)', async () => {
  const { ketenlaag, voornemens } = huis({ grendel: OPEN });
  const klaar = ketenlaag.klaarzet(opgave());
  assert.equal(klaar.voornemen.stand, 'WACHT', JSON.stringify(klaar));
  assert.equal(klaar.dossier.omkeerbaarheid.omkeerbaar, false);
  const t = ketenlaag.tekenAf({ id: klaar.voornemen.id, door: 'bert' });
  assert.equal(t.status, 403, JSON.stringify(t));
  const v = voornemens.vind(klaar.voornemen.id);
  assert.equal(v.stand, 'AFGEWEZEN');
  assert.equal(v.besluit.uitkomst, UITKOMST.OMKEERBAAR);
  assert.equal(v.besluit.omkeerbaar, false, 'na de handtekening heet de handeling omkeerbaar');
  let geraakt = false;
  const r = await ketenlaag.uitvoer({ id: klaar.voornemen.id, door: 'bert', doe: async () => { geraakt = true; return { ok: true }; } });
  assert.ok(r.status >= 400);
  assert.equal(geraakt, false, 'er is geld bewogen na een weigering');
});

test('c. de uitzonderingsprocedure weigert zolang de grendel dicht is, ook met een geldige risicogoedkeuring', () => {
  assert.equal(uitz.stand().open, false, 'zonder grendel hoort de procedure dicht te staan');
  const b = maakBesluit({ zoekBevoegdheid: () => ({ capability: 'X', scope: '*', grenzen: {}, keten: [] }) });
  const r = b.beslis({ actor: 'ans', handeling: 'X', waardeCenten: GROOT,
    context: { goedgekeurdDoor: 'bert', bevestigingVers: true, risicogoedkeuring: { door: 'carla', reden: 'Met de bank afgestemd, risico gedragen.' } } });
  assert.equal(r.uitkomst, UITKOMST.OMKEERBAAR);
  assert.match(r.reden, /staat dicht/);
  assert.equal(r.omkeerbaar, false);
});

test('d. met de grendel open (alleen hier) gaat het door met een risicogoedkeuring, en het blijft onomkeerbaar', async () => {
  const { ketenlaag, voornemens } = huis({ grendel: OPEN });
  const klaar = ketenlaag.klaarzet(opgave({ sleutel: 'incasso:d' }));
  const id = klaar.voornemen.id;
  assert.equal(voornemens.risicoGoedkeur(id, { door: 'carla', reden: 'Met de bank afgestemd, risico gedragen.' }).status, 200);
  const t = ketenlaag.tekenAf({ id, door: 'bert' });
  assert.ok(t.ok, JSON.stringify(t));
  const v = voornemens.vind(id);
  assert.equal(v.stand, 'GEKEURD');
  assert.equal(v.besluit.uitkomst, UITKOMST.TOESTAAN);
  assert.equal(v.besluit.omkeerbaar, false, 'een uitzondering beweert nooit dat het terug kan');
  assert.equal(v.besluit.uitzondering.soort, 'onomkeerbaar, uitzondering met risicogoedkeuring');
  assert.match(v.besluit.reden, /Onomkeerbaar, uitzondering met risicogoedkeuring van carla/);
});

test('d. wie de tweede handtekening zet, geeft niet ook de risicogoedkeuring; en de context kan hem niet inschuiven', () => {
  const { ketenlaag, voornemens } = huis({ grendel: OPEN });
  const klaar = ketenlaag.klaarzet(opgave({ sleutel: 'incasso:dubbel' }));
  const id = klaar.voornemen.id;
  voornemens.risicoGoedkeur(id, { door: 'bert', reden: 'Ik teken en ik draag het risico.' });
  assert.equal(ketenlaag.tekenAf({ id, door: 'bert' }).status, 403);

  const k2 = ketenlaag.klaarzet(opgave({ sleutel: 'incasso:context' }));
  const t2 = voornemens.tekenAf(k2.voornemen.id, { door: 'bert',
    context: { risicogoedkeuring: { door: 'carla', reden: 'Via de context naar binnen geschoven.' } } });
  assert.equal(t2.voornemen.stand, 'AFGEWEZEN', 'een risicogoedkeuring via de context werd meegewogen');
});

test('een voornemen van voor het besluit boven de grens, zonder gewogen omkeerbaarheid, wordt bij uitvoeren gestaakt', async () => {
  const { voornemens } = huis({ grendel: OPEN });
  const o = voornemens.stelOp({ actor: 'ans', handeling: 'GELD_INNEN', doel: 'oud', sleutel: 'oud:1',
    stappen: [{ wat: 'incassoronde', doel: 'oud', centen: GROOT }] });
  const v = voornemens.vind(o.voornemen.id);
  v.stand = 'GEKEURD'; v.besluit = { uitkomst: 'TOESTAAN', reden: 'van voor 2B-aangepast' };   // zoals het in de db staat
  let geraakt = false;
  const r = await voornemens.voerUit(v.id, { doe: async () => { geraakt = true; return { ok: true }; } });
  assert.equal(r.status, 409, JSON.stringify(r));
  assert.equal(geraakt, false);
  assert.equal(voornemens.vind(v.id).stand, 'GESTAAKT');
});

test('de tabel: elke handeling op een bekende rail, alleen woorden van de herstelproef, geen enkele exact, en onbekend is dicht', () => {
  for (const [naam, h] of Object.entries(geldomkeer.HANDELINGEN)) {
    assert.ok(geldomkeer.RAILS[h.rail], naam + ' wijst naar een onbekende rail');
    assert.ok(h.grond, naam + ' heeft geen grond');
  }
  for (const [naam, r] of Object.entries(geldomkeer.RAILS)) {
    assert.ok(geldomkeer.SOORTEN.includes(r.soort), naam + ': ' + r.soort);
    assert.notEqual(r.soort, 'exact', naam + ': een tegenboeking laat twee regels achter en is nooit exact');
    assert.ok(r.grond && r.wie && r.mechanisme, naam + ' mist grond, wie of mechanisme');
  }
  const t = geldomkeer.voor('GELD_TERUGGEVEN');
  assert.equal(t.omkeerbaar, false);
  assert.match(t.reden, /een lid/);
  assert.equal(geldomkeer.voor('GELD_INNEN').omkeerbaar, false);
  const onbekend = geldomkeer.voor('IETS_ANDERS');
  assert.equal(onbekend.omkeerbaar, false);
  assert.match(onbekend.reden, /onbekend is niet omkeerbaar/);
});

test('een risicogoedkeuring hoort voor het besluit en draagt naam en reden', () => {
  const { ketenlaag, voornemens } = huis({ grendel: OPEN });
  const klaar = ketenlaag.klaarzet(opgave({ sleutel: 'incasso:rg' }));
  const id = klaar.voornemen.id;
  assert.equal(voornemens.risicoGoedkeur(id, { door: 'carla', reden: 'kort' }).status, 400);
  assert.equal(voornemens.risicoGoedkeur(id, { door: 'ans', reden: 'Ik keur mijn eigen risico goed.' }).status, 400);
  ketenlaag.tekenAf({ id, door: 'bert' });
  assert.equal(voornemens.risicoGoedkeur(id, { door: 'carla', reden: 'Te laat, er is al besloten.' }).status, 409);
});

test('de afleidregel heeft een ja-tak: een tegenboeking naar een eigen positie van RTG is omkeerbaar (compensatie)', () => {
  assert.equal(geldomkeer.afleid({ naar: 'rtg' }, geldomkeer.RAILS['rtg-pay-intern']), true);
  assert.equal(geldomkeer.RAILS['rtg-pay-intern'].soort, 'compensatie', 'een tegenboeking is nooit exact');
  assert.equal(geldomkeer.afleid({ naar: 'lid' }, geldomkeer.RAILS['rtg-pay-intern']), false);
  assert.equal(geldomkeer.afleid({ naar: 'rtg' }, geldomkeer.RAILS['sepa-uit']), false);
});

test('de keuring negeert omkeerbaar uit de context: de tabel beslist, ook buiten de geldketen', () => {
  const { voornemens } = huis({ grendel: OPEN });
  const o = voornemens.stelOp({ actor: 'ans', handeling: 'GELD_TERUGGEVEN', doel: 'teruggave', sleutel: 'ctx:1',
    stappen: [{ wat: 'teruggave', doel: 'R1', centen: GROOT }] });
  voornemens.keur(o.voornemen.id, { context: { omkeerbaar: true } });
  const t = voornemens.tekenAf(o.voornemen.id, { door: 'bert', context: { omkeerbaar: true } });
  assert.equal(t.voornemen.stand, 'AFGEWEZEN', JSON.stringify(t.voornemen.besluit));
  assert.equal(t.voornemen.besluit.uitkomst, UITKOMST.OMKEERBAAR);
});

test('de vroege weigering rekent het totaal uit de stappen, niet uit wat de aanroeper opgeeft', () => {
  const { ketenlaag } = huis();
  const r = ketenlaag.klaarzet(opgave({ totaalCenten: 100, sleutel: 'incasso:laag' }));
  assert.equal(r.status, 403, JSON.stringify(r));
});
