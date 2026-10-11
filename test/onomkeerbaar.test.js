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

function huis() {
  const bakken = {};
  const bak = (naam) => (bakken[naam] = bakken[naam] || []);
  const token = bewijs.maakBewijstoken({ sleutel: Buffer.from('01234567890123456789012345678901'),
    gezien: bewijs.geheugenGezien() });
  const beslisser = maakBeslis({ munt: token.munt });
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

/* De teruggave: niet omkeerbaar en NIET toegelaten tot de uitzonderingsprocedure. */
const terug = (extra) => opgave(Object.assign({ klasse: 'geld-eenmalig', handeling: 'GELD_TERUGGEVEN',
  pad: '/api/office/reisbureau/teruggave', doel: 'teruggave groot', sleutel: 'teruggave:groot',
  stappen: [{ wat: 'teruggave', doel: 'R1', centen: GROOT, gegevens: { id: 'RTG1' } }],
  uitvoerbelofte: { graad: 'gemeten', uitslag: 'atomair: een boeking', reden: 'een deel' } }, extra || {}));
const RG = { door: 'user-3', naam: 'carla', reden: 'Met de bank afgestemd, risico gedragen.' };

test('b. boven de grens, niet omkeerbaar en niet toegelaten: meteen geweigerd bij het klaarzetten, met reden en weg', () => {
  const { ketenlaag, voornemens } = huis();
  const r = ketenlaag.klaarzet(terug());
  assert.equal(r.status, 403, JSON.stringify(r));
  assert.match(r.error, /terug te draaien/);
  assert.match(r.error, /een lid/, 'de reden komt uit de tabel (waar het geld landt)');
  assert.match(r.error, /staat voor deze handeling dicht/, 'de weg: de uitzonderingsprocedure en dat zij dicht staat');
  assert.doesNotMatch(r.error, /splits|buiten het systeem/, 'de weg moedigt geen opknippen of geld buiten het spoor aan');
  assert.equal(voornemens.lijst({ limit: 10 }).aantal, 0, 'er is toch een voornemen opgesteld');
  assert.equal(ketenlaag.lijst({}).aantal, 0, 'er is toch een dossier aangelegd');
});

test('b. een aanroeper kan omkeerbaar niet zelf aanzetten: de tabel beslist', () => {
  const { ketenlaag } = huis();
  const r = ketenlaag.klaarzet(terug({ omkeerbaar: true, sleutel: 'teruggave:zelf' }));
  assert.equal(r.status, 403, JSON.stringify(r));
});

test('a. een tweede handtekening maakt een onomkeerbare handeling niet omkeerbaar (incasso boven de grens, zonder risicogoedkeuring)', async () => {
  const { ketenlaag, voornemens } = huis();
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

test('c. voor elke handeling buiten de toelating blijft de procedure dicht, ook met een geldige risicogoedkeuring', () => {
  assert.equal(uitz.stand('GELD_TERUGGEVEN').open, false, 'de teruggave hoort dicht te staan (besluit 2C)');
  assert.equal(uitz.stand('IETS_ANDERS').open, false);
  assert.equal(uitz.stand('GELD_INNEN').open, true, 'de incassoronde is toegelaten (besluit 2C)');
  const b = maakBesluit({ zoekBevoegdheid: () => ({ capability: 'X', scope: '*', grenzen: {}, keten: [] }) });
  const r = b.beslis({ actor: 'ans', handeling: 'GELD_TERUGGEVEN', waardeCenten: GROOT,
    context: { goedgekeurdDoor: 'bert', bevestigingVers: true, risicogoedkeuring: { door: 'carla', reden: 'Met de bank afgestemd, risico gedragen.' } } });
  assert.equal(r.uitkomst, UITKOMST.OMKEERBAAR);
  assert.match(r.reden, /staat voor deze handeling dicht/);
  assert.equal(r.omkeerbaar, false);
});

test('d. een incassoronde boven de grens gaat door met een risicogoedkeuring, en het dossier zegt onomkeerbaar + uitzondering', async () => {
  const { ketenlaag, voornemens } = huis();
  const klaar = ketenlaag.klaarzet(opgave({ sleutel: 'incasso:d' }));
  const id = klaar.voornemen.id;
  assert.equal(ketenlaag.risicoGoedkeur(Object.assign({ id }, RG)).status, 200);
  const t = ketenlaag.tekenAf({ id, door: 'bert' });
  assert.ok(t.ok, JSON.stringify(t));
  const as = ketenlaag.dossier(id).dossier.assen.find(a => a.as === 'omkeerbaarheid');
  assert.equal(as && as.uitslag, 'onomkeerbaar, uitzondering met risicogoedkeuring', JSON.stringify(as));
  assert.strictEqual(as.omkeerbaar, false);
  assert.equal(as.bron, 'eigenaarsbesluit 2C, 11 oktober 2026');
  const v = voornemens.vind(id);
  assert.equal(v.stand, 'GEKEURD');
  assert.equal(v.besluit.uitkomst, UITKOMST.TOESTAAN);
  assert.equal(v.besluit.omkeerbaar, false, 'een uitzondering beweert nooit dat het terug kan');
  assert.equal(v.besluit.uitzondering.soort, 'onomkeerbaar, uitzondering met risicogoedkeuring');
  assert.match(v.besluit.reden, /Onomkeerbaar, uitzondering met risicogoedkeuring van carla \(eigenaarsbesluit 2C/);
});

test('d. wie de tweede handtekening zet, geeft niet ook de risicogoedkeuring; en de context kan hem niet inschuiven', () => {
  const { ketenlaag, voornemens } = huis();
  const klaar = ketenlaag.klaarzet(opgave({ sleutel: 'incasso:dubbel' }));
  const id = klaar.voornemen.id;
  voornemens.risicoGoedkeur(id, { door: 'bert', naam: 'bert', reden: 'Ik teken en ik draag het risico.' });
  assert.equal(ketenlaag.tekenAf({ id, door: 'bert' }).status, 403);

  const k2 = ketenlaag.klaarzet(opgave({ sleutel: 'incasso:context' }));
  const t2 = voornemens.tekenAf(k2.voornemen.id, { door: 'bert',
    context: { risicogoedkeuring: { door: 'carla', reden: 'Via de context naar binnen geschoven.' } } });
  assert.equal(t2.voornemen.stand, 'AFGEWEZEN', 'een risicogoedkeuring via de context werd meegewogen');
});

test('een voornemen van voor het besluit boven de grens, zonder gewogen omkeerbaarheid, wordt bij uitvoeren gestaakt', async () => {
  const { voornemens } = huis();
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
  const { ketenlaag, voornemens } = huis();
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
  const { voornemens } = huis();
  const o = voornemens.stelOp({ actor: 'ans', handeling: 'GELD_TERUGGEVEN', doel: 'teruggave', sleutel: 'ctx:1',
    stappen: [{ wat: 'teruggave', doel: 'R1', centen: GROOT }] });
  voornemens.keur(o.voornemen.id, { context: { omkeerbaar: true } });
  const t = voornemens.tekenAf(o.voornemen.id, { door: 'bert', context: { omkeerbaar: true } });
  assert.equal(t.voornemen.stand, 'AFGEWEZEN', JSON.stringify(t.voornemen.besluit));
  assert.equal(t.voornemen.besluit.uitkomst, UITKOMST.OMKEERBAAR);
});

test('de vroege weigering rekent het totaal uit de stappen, niet uit wat de aanroeper opgeeft', () => {
  const { ketenlaag } = huis();
  const r = ketenlaag.klaarzet(terug({ totaalCenten: 100, sleutel: 'teruggave:laag' }));
  assert.equal(r.status, 403, JSON.stringify(r));
});

test('2C: een risicogoedkeuring geldt voor precies EEN ronde; een kopie op de volgende opent niets', () => {
  const { ketenlaag, voornemens } = huis();
  const een = ketenlaag.klaarzet(opgave({ sleutel: 'incasso:ronde1' }));
  assert.equal(ketenlaag.risicoGoedkeur(Object.assign({ id: een.voornemen.id }, RG)).status, 200);
  const twee = ketenlaag.klaarzet(opgave({ sleutel: 'incasso:ronde2', doel: 'ronde 2' }));
  // dezelfde goedkeuring overgezet op de tweede ronde, zoals het in de opslag zou kunnen belanden
  voornemens.vind(twee.voornemen.id).risicogoedkeuring = Object.assign({}, voornemens.vind(een.voornemen.id).risicogoedkeuring);
  const t = ketenlaag.tekenAf({ id: twee.voornemen.id, door: 'bert' });
  assert.equal(t.status, 403, 'een goedkeuring van een andere ronde werd hergebruikt: ' + JSON.stringify(t));
  // en een tweede goedkeuring op dezelfde ronde kan niet
  assert.equal(ketenlaag.risicoGoedkeur(Object.assign({ id: een.voornemen.id }, RG, { door: 'user-9' })).status, 409);
});

test('2C: de aanvrager geeft zijn eigen risicogoedkeuring niet, ook niet met een andere naam (sleutel)', () => {
  const { ketenlaag } = huis();
  const k = ketenlaag.klaarzet(opgave({ sleutel: 'incasso:eigen' }));
  const r = ketenlaag.risicoGoedkeur({ id: k.voornemen.id, door: 'user-1', naam: 'iemand anders', reden: 'Mijn eigen ronde, mijn eigen risico.' });
  assert.equal(r.status, 403, JSON.stringify(r));
});

test('2C: een teruggave boven de grens met een "goedkeuring" blijft geweigerd', () => {
  const { ketenlaag, voornemens } = huis();
  assert.equal(ketenlaag.klaarzet(terug({ sleutel: 'teruggave:2c' })).status, 403);
  // ook rechtstreeks in de voornemenlaag, zonder de vroege poort
  const o = voornemens.stelOp({ actor: 'ans', handeling: 'GELD_TERUGGEVEN', doel: 't', sleutel: 'teruggave:direct',
    stappen: [{ wat: 'teruggave', doel: 'R1', centen: GROOT }] });
  voornemens.keur(o.voornemen.id, { context: {} });
  const rg = voornemens.risicoGoedkeur(o.voornemen.id, { door: 'user-3', naam: 'carla', reden: 'Toch maar doen, risico gedragen.' });
  assert.equal(rg.status, 409, JSON.stringify(rg));
  assert.match(rg.error, /alleen de incassoronde/);
  const b = maakBesluit({ zoekBevoegdheid: () => ({ capability: 'X', scope: '*', grenzen: {}, keten: [] }) });
  const r = b.beslis({ actor: 'ans', handeling: 'GELD_TERUGGEVEN', waardeCenten: GROOT,
    context: { goedgekeurdDoor: 'bert', bevestigingVers: true, risicogoedkeuring: RG } });
  assert.equal(r.uitkomst, UITKOMST.OMKEERBAAR);
});
