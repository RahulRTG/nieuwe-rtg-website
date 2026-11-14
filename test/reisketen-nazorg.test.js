/* Echte lokale HTTP-/SQLite-proef. Aanvragen, tenantgrenzen en Pay-ledger
   gebruiken de bestaande server. De ondernemingen en bronreferenties zijn
   uitdrukkelijk fictief: geen externe acceptatie, annulering of refundbewijs. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { startServer, stop } = require('./helper');
const { maakReisketenFixture, goed } = require('./lib/reisketen-fixture');
const map = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-reisketen-nazorg-'));
const env = { RTG_DATA_DIR: map, SMTP_URL: '', OFFICE_CODE: 'RTG-OFFICE' };
const MP = '/api/reisbureau/keten', OP = '/api/office/reisbureau/keten';
const SP = '/api/supplier/reisbureau/keten', DP = '/api/supplier/reisbureau/opdracht/besluit';
let srv, x, herstel;
test.before(async () => { srv = await startServer({ env }); x = await maakReisketenFixture(() => srv.base); });
test.after(async () => { await stop(srv); fs.rmSync(map, { recursive: true, force: true }); });
const lees = async (ref, token = x.reiziger.token) => goed(await x.api(MP, { ref }, token), 'eigen reis').reizen[0];
const verkoper = async (ref, rtg = false) => goed(await x.api(rtg ? OP : SP, { ref }, rtg ? x.office : x.bureau.token), 'verkoper leest').reizen[0];
const stand = r => ({ status: r.status, offerte: r.offerte, akkoord: r.akkoord,
  leveringen: r.leveringen, betaling: r.betaling, aansluiting: r.aansluiting,
  operationeelBewezen: r.operationeelBewezen, directBoekbaarBewezen: r.directBoekbaarBewezen });
const vraag = (r, merk, extra = {}) => ({ ref: r.ref, versie: r.versie, idem: 'nazorg-' + merk,
  offerteHash: r.offerte && r.offerte.hash, soort: 'annulering', onderdelen: ['hotel'],
  toelichting: 'Ik wil dit onderdeel laten beoordelen, zonder automatische annulering.', ...extra });
const antwoord = (r, merk, extra = {}) => ({ ref: r.ref, versie: r.versie, idem: 'antwoord-' + merk,
  nazorgId: r.nazorg[0].id, soort: 'voorstel', toelichting: 'Wij onderzoeken de mogelijkheden; er is niets uitgevoerd.',
  bronRef: 'UITSLUITEND-FICTIEVE-BRON-' + merk, ...extra });
async function start(merk, rtg = false) {
  return goed(await x.api(MP + '/start', { titel: 'Nazorgproef ' + merk, bestemming: 'Ibiza',
    ...(rtg ? {} : { supplierCode: x.bureau.code }), idem: 'start-nazorg-' + merk }, x.reiziger.token), 'aanvraag').reis;
}
async function bied(r, rtg = false) {
  goed(await x.api((rtg ? OP : SP) + '/offerte', x.offerte(r), rtg ? x.office : x.bureau.token), 'offerte');
  return lees(r.ref);
}
async function accepteer(r) {
  return goed(await x.api(MP + '/akkoord', { ref: r.ref, versie: r.versie,
    offerteHash: r.offerte.hash, idem: 'akkoord-' + r.ref }, x.reiziger.token), 'persoonlijk akkoord').reis;
}
async function reis(merk, rtg = false) { return accepteer(await bied(await start(merk, rtg), rtg)); }

test('nazorg vereist de geaccepteerde offerte, exacte hash en bestaande unieke onderdelen', async () => {
  let r = await start('grond');
  assert.equal((await x.api(MP + '/nazorg', vraag(r, 'geen-offerte'), x.reiziger.token)).status, 409);
  r = await bied(r);
  assert.equal((await x.api(MP + '/nazorg', vraag(r, 'geen-akkoord'), x.reiziger.token)).status, 409);
  r = await accepteer(r);
  const voor = await verkoper(r.ref);
  for (const [merk, extra, status] of [
    ['andere-hash', { offerteHash: 'niet-de-geaccepteerde-hash' }, 409],
    ['geen-deel', { onderdelen: [] }, 400], ['vreemd-deel', { onderdelen: ['onbestaand'] }, 400],
    ['dubbel-deel', { onderdelen: ['hotel', 'hotel'] }, 400], ['verkeerde-soort', { soort: 'refund' }, 400],
    ['geen-uitleg', { toelichting: 'kort' }, 400], ['html', { toelichting: '<script>uitvoeren()</script>' }, 400]
  ]) assert.equal((await x.api(MP + '/nazorg', vraag(r, merk, extra), x.reiziger.token)).status, status, merk);
  assert.deepEqual(await verkoper(r.ref), voor, 'alle afwijzingen laten ook versie en journaal ongemoeid');
});

test('alleen eigen klant vraagt; herhaling is een ontvangst, geen tweede vraag of stale write', async () => {
  const r = await reis('eigenaar'), b = vraag(r, 'eigenaar');
  assert.equal((await x.api(MP + '/nazorg', { ...b, actorRef: 'user-1', customerKey: 'user-1' }, x.anderLid.token)).status, 404);
  assert.equal((await x.api(MP + '/nazorg', b)).status, 401);
  const gemaakt = goed(await x.api(MP + '/nazorg', b, x.reiziger.token), 'eigen nazorg').reis;
  assert.equal(gemaakt.nazorg.length, 1);
  assert.equal(gemaakt.nazorg[0].offerteHash, r.offerte.hash);
  assert.equal(gemaakt.nazorg[0].offerteVersie, r.offerte.versie);
  assert.equal(JSON.stringify(gemaakt.nazorg).includes('actorRef'), false, 'lid krijgt geen interne actoridentiteiten');
  const herhaald = goed(await x.api(MP + '/nazorg', b, x.reiziger.token), 'zelfde ontvangst');
  assert.equal(herhaald.herhaald, true);
  assert.deepEqual(herhaald.reis, gemaakt);
  assert.equal((await x.api(MP + '/nazorg', { ...b, toelichting: 'Deze andere vraag mag niet worden overgeschreven.' }, x.reiziger.token)).status, 409);
  assert.equal((await x.api(MP + '/nazorg', vraag(r, 'stale', { onderdelen: ['transfer'] }), x.reiziger.token)).status, 409);
  assert.equal((await x.api(MP + '/nazorg', vraag(gemaakt, 'overlap'), x.reiziger.token)).status, 409);
  assert.deepEqual(await lees(r.ref), gemaakt);
});

test('partnernazorg is alleen voor eigen verkoper; kantoor, concurrent, klant en aanbieder kunnen niet antwoorden', async () => {
  let r = await reis('antwoord-eigenaar');
  r = goed(await x.api(MP + '/nazorg', vraag(r, 'antwoord-eigenaar'), x.reiziger.token), 'vraag').reis;
  const b = antwoord(r, 'eigenaar'), voor = await verkoper(r.ref);
  assert.equal((await x.api(OP + '/nazorg/antwoord', b, x.office)).status, 404);
  assert.equal((await x.api(SP + '/nazorg/antwoord', b, x.anderBureau.token)).status, 404);
  assert.equal((await x.api(SP + '/nazorg/antwoord', b, x.hotel.token)).status, 403);
  assert.equal((await x.api(SP + '/nazorg/antwoord', b, x.fiets.token)).status, 404, 'aanbieder met reisbureaugenre is nog geen verkoper');
  assert.equal((await x.api(SP + '/nazorg/antwoord', b, x.bureau.gedeeldeManager)).status, 403);
  assert.ok([401, 403].includes((await x.api(SP + '/nazorg/antwoord', b, x.anderLid.token)).status));
  assert.equal((await x.api(SP + '/nazorg/antwoord', { ...b, nazorgId: 'RN-vreemde-vraag' }, x.bureau.token)).status, 404);
  assert.equal((await x.api(SP + '/nazorg/antwoord', { ...b, bronRef: '' }, x.bureau.token)).status, 400);
  assert.equal((await x.api(SP + '/nazorg/antwoord', { ...b, soort: 'goedgekeurd' }, x.bureau.token)).status, 400);
  assert.equal((await x.api(SP + '/nazorg/antwoord', { ...b, versie: r.versie - 1 }, x.bureau.token)).status, 409);
  assert.deepEqual(await verkoper(r.ref), voor);
  const na = goed(await x.api(SP + '/nazorg/antwoord', b, x.bureau.token), 'eigen antwoord').reis;
  assert.equal(na.nazorg[0].status, 'beantwoord');
  assert.deepEqual(stand(na), stand(voor));
  const opnieuw = goed(await x.api(SP + '/nazorg/antwoord', b, x.bureau.token), 'antwoordreplay');
  assert.equal(opnieuw.herhaald, true);
  assert.deepEqual(opnieuw.reis, na);
  assert.equal((await x.api(SP + '/nazorg/antwoord', { ...b, bronRef: 'ANDERE-FICTIEVE-BRON' }, x.bureau.token)).status, 409);
  assert.equal((await x.api(SP + '/nazorg/antwoord', { ...b, versie: na.versie, idem: 'antwoord-overschrijven',
    toelichting: 'Dit vervangende antwoord mag niet worden opgeslagen.' }, x.bureau.token)).status, 409);
  assert.deepEqual(await verkoper(r.ref), na);
});

test('RTG-kantoor antwoordt uitsluitend eigen reis; bronverwijzing verleent geen juridische of financiële goedkeuring', async () => {
  let r = await reis('rtg', true);
  const voor = await verkoper(r.ref, true);
  r = goed(await x.api(MP + '/nazorg', vraag(r, 'rtg', { uitvoering: 'uitgevoerd',
    financieleUitvoering: 'betaald', centen: 80000, status: 'geannuleerd' }), x.reiziger.token), 'RTG vraag').reis;
  const b = antwoord(r, 'rtg', { juridischGoedgekeurd: true, bewijsSoort: 'goedgekeurd-contract',
    refundCenten: 80000, naar: 'zaak:vreemde-zaak', betaling: { status: 'terugbetaald' } });
  assert.equal((await x.api(SP + '/nazorg/antwoord', b, x.bureau.token)).status, 404);
  assert.equal((await x.api(OP + '/nazorg/antwoord', b, x.gedeeld)).status, 403);
  const na = goed(await x.api(OP + '/nazorg/antwoord', b, x.office), 'RTG antwoord').reis;
  const v = na.nazorg[0];
  assert.equal(v.uitvoering, 'niet-uitgevoerd');
  assert.equal(v.financieleUitvoering, 'geblokkeerd');
  assert.equal(v.antwoord.juridischGoedgekeurd, false);
  assert.equal(v.antwoord.bewijsSoort, 'verklaring-eigen-verkoper');
  assert.equal(v.antwoord.bronRef, b.bronRef);
  assert.deepEqual(stand(na), stand(voor));
});

test('gelijktijdige vragen voor hetzelfde onderdeel krijgen één duurzame eigenaar en geen dubbele ontvangst', async () => {
  const r = await reis('race');
  const uitkomsten = await Promise.all(['een', 'twee'].map(merk =>
    x.api(MP + '/nazorg', vraag(r, 'race-' + merk), x.reiziger.token)));
  assert.deepEqual(uitkomsten.map(a => a.status).sort(), [200, 409]);
  const na = await verkoper(r.ref);
  assert.equal(na.nazorg.length, 1);
  assert.equal(na.versie, r.versie + 1);
  assert.equal(na.gebeurtenissen.filter(g => g.soort === 'nazorg-vraag').length, 1);
  const winnend = uitkomsten.findIndex(a => a.status === 200) === 0 ? 'een' : 'twee';
  assert.equal(goed(await x.api(MP + '/nazorg', vraag(r, 'race-' + winnend), x.reiziger.token), 'race replay').herhaald, true);
});

test('deelannuleringsvoorstel na betaling en deeluitvoering verandert geen contract, leveringsbewijs of ledger', async () => {
  let r = await reis('betaald');
  for (const [onderdeel, actor] of [['hotel', x.hotel], ['transfer', x.transfer], ['fiets', x.fiets]]) {
    goed(await x.api(DP, { ref: r.ref, versie: r.versie, onderdeel, besluit: 'accepteer',
      bewijsRef: 'FICTIEVE-NAZORG-ACCEPTATIE-' + onderdeel, idem: 'nazorg-acceptatie-' + onderdeel }, actor.token), 'aanbieder accepteert');
    r = await lees(r.ref);
  }
  r = goed(await x.api(MP + '/betaal', { ref: r.ref, versie: r.versie,
    idem: 'nazorg-echte-lokale-inning' }, x.reiziger.token), 'lokale ledgerinning').reis;
  goed(await x.api(DP, { ref: r.ref, versie: r.versie, onderdeel: 'hotel', besluit: 'lever',
    bewijsRef: 'FICTIEVE-NAZORG-DEELLEVERING', idem: 'nazorg-deellevering' }, x.hotel.token), 'deeluitvoering');
  r = await lees(r.ref);
  assert.equal(r.betaling.status, 'betaald');
  assert.equal(r.leveringen.find(p => p.id === 'hotel').status, 'geleverd');
  const voor = await verkoper(r.ref);
  const geld = goed(await x.api('/api/pay/overzicht', {}, x.reiziger.token), 'ledger voor nazorg');
  const kas = goed(await x.api('/api/supplier/pay/overzicht', {}, x.bureau.token), 'verkoperskas voor nazorg');
  const b = vraag(r, 'betaalde-vraag', { onderdelen: ['transfer', 'fiets'] });
  r = goed(await x.api(MP + '/nazorg', b, x.reiziger.token), 'deelannulering gevraagd').reis;
  const reactie = antwoord(r, 'betaald');
  const na = goed(await x.api(SP + '/nazorg/antwoord', reactie, x.bureau.token), 'niet-uitvoerbaar voorstel').reis;
  assert.deepEqual(stand(na), stand(voor), 'ook alle oorspronkelijke acceptatie- en leveringsbewijzen blijven gelijk');
  assert.deepEqual(goed(await x.api('/api/pay/overzicht', {}, x.reiziger.token), 'ledger na nazorg'), geld);
  assert.deepEqual(goed(await x.api('/api/supplier/pay/overzicht', {}, x.bureau.token), 'verkoperskas na nazorg'), kas);
  const provider = goed(await x.api('/api/supplier/reisbureau/opdrachten', {}, x.transfer.token), 'providerbeeld').reizen.find(a => a.ref === r.ref);
  assert.equal(Object.hasOwn(provider, 'nazorg'), false, 'vertrouwelijke klantvraag is geen automatische providerdoorgifte');
  assert.equal(na.aansluiting.settlement, 'niet-gekwalificeerd');
  herstel = { ref: r.ref, b, reactie, na, geld, kas };
});

test('herstart bewaart vraag, onveranderlijk antwoord en eigen geldstand; oude ontvangst geeft actuele nazorg', async () => {
  assert.ok(herstel, 'de voorafgaande betaalde proef is geslaagd');
  await stop(srv); srv = await startServer({ env });
  assert.deepEqual(await verkoper(herstel.ref), herstel.na);
  const herhaald = goed(await x.api(MP + '/nazorg', herstel.b, x.reiziger.token), 'herstart vraagreplay');
  assert.equal(herhaald.herhaald, true);
  assert.equal(herhaald.reis.nazorg[0].status, 'beantwoord');
  assert.equal(goed(await x.api(SP + '/nazorg/antwoord', herstel.reactie, x.bureau.token), 'herstart antwoordreplay').herhaald, true);
  assert.deepEqual(await verkoper(herstel.ref), herstel.na);
  assert.deepEqual(goed(await x.api('/api/pay/overzicht', {}, x.reiziger.token), 'duurzame lidledger'), herstel.geld);
  assert.deepEqual(goed(await x.api('/api/supplier/pay/overzicht', {}, x.bureau.token), 'duurzame verkoperskas'), herstel.kas);
});
