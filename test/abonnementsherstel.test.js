'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const P = require('../server/kern/aanmeldingen/abonnementsherstel');
const { maakAanbod } = require('../server/kern/aanmeldingen/abonnementsaanbod-vorm');
const { abonnementsAanbod } = require('../server/kern/pasprijs');
const kopie = x => JSON.parse(JSON.stringify(x));
const AT = '2026-11-13T10:00:00.000Z';
function fixture(at = AT) {
  const c = { id: 'c-1', accountId: 42, aanmeldingId: 'a-1', pas: 'rtg', frequentie: 'maand',
    automatischAbonnement: true, status: 'ACTIEF' };
  const prijs = abonnementsAanbod('rtg', { frequentie: 'maand', btwProfiel: 'nl-21' });
  c.aanbod = maakAanbod(c, { prijs, at, opdracht: 'fixture', scope: { soort: 'persoon', code: null, capaciteiten: [] },
    verrekening: { ok: true, bronContractId: null, regels: [], creditCenten: 0, overCenten: 0, teBetalenCenten: prijs.termijn.brutoCenten } });
  c.ondertekening = { scope: 'abonnement:c-1', profiel: 'user-42', versie: 1, hash: 'a'.repeat(64), at: '2026-01-01T10:00:00.000Z' };
  const t = { id: 'c-1:1', nr: 1, contractId: 'c-1', invoiceId: 'ABO-c-1-1',
    brutoCenten: 1210, centen: 1000, vervalt: '2026-01-02T10:00:00.000Z', status: 'open', betaalWaarheidId: null };
  return { contract: c, termijnen: [t], op: at };
}
function betaling(f, status = 'BEVESTIGD', extra = {}) {
  const t = f.termijnen[0]; t.betaalWaarheidId = 'bw-1';
  t.betaling = { id: 'bw-1', actor: 'acc:42', soort: 'factuur', bronRef: t.invoiceId,
    centen: t.brutoCenten, valuta: 'eur', provider: 'stripe', providerId: 'pi-1', status,
    context: { own: true, accountId: 42, invoiceId: t.invoiceId, contractId: 'c-1', termijn: 1 },
    afgehandeldAt: AT, terugbetaaldCenten: 0, terugbetaalOpdrachten: [], ...extra };
}
function bericht(f) {
  const r = P.aankondiging(f); assert.equal(r.ok, true);
  f.contract.herstel = r.herstel;
  f.contract.herstel.aankondiging = { kanaal: 'rtg-inbox', referentie: 'melding-1', beschikbaarAt: f.op, inhoudHash: r.herstel.inhoudHash };
  return f.contract.herstel;
}
const beoordeel = f => P.beoordeel(f);
test('31 kalenderdagen: na de eindgrens alleen nieuwe betaalde diensten beperkt', () => {
  const f = fixture(), h = bericht(f), voor = kopie(f);
  assert.equal(h.herstelTot, '2026-12-14T10:00:00.000Z');
  assert.equal(beoordeel(f).stand, 'HERSTELTERMIJN');
  f.op = h.herstelTot; assert.equal(beoordeel(f).beperkNieuweBetaaldeDiensten, false);
  f.op = '2026-12-14T10:00:00.001Z'; const o = beoordeel(f);
  assert.equal(o.stand, 'BEPERKT'); assert.equal(o.beperkNieuweBetaaldeDiensten, true);
  assert.equal(o.tier, undefined); assert.equal(o.accountGeblokkeerd, undefined);
  f.op = voor.op; assert.deepEqual(f, voor);
});
test('kalenderdagen volgen Amsterdam over beide zomertijdwissels en bewaren seconden', () => {
  assert.equal(P.herstelTot('2026-03-01T09:15:37.123Z'), '2026-04-01T08:15:37.123Z');
  assert.equal(P.herstelTot('2026-10-01T08:15:37.123Z'), '2026-11-01T09:15:37.123Z');
  assert.equal(P.herstelTot('2026-03-01T09:15:37.123Z', 'UTC'), '2026-04-01T09:15:37.123Z');
  assert.equal(P.herstelTot('2026-02-26T01:30:00.000Z'), '2026-03-29T01:30:00.000Z');
  assert.equal(P.herstelTot('2026-09-24T00:30:00.000Z'), '2026-10-25T01:30:00.000Z');
  assert.equal(P.herstelTot('ongeldig'), null); assert.equal(P.herstelTot(AT, 'geen-zone'), null);
});
test('oude afspraken of afwijkende hersteltermijn worden niet automatisch gemigreerd', () => {
  for (const verander of [c => delete c.automatischAbonnement, c => { c.automatischAbonnement = false; },
    c => { c.aanbod.voorwaarden.herstelDagen = 14; }]) {
    const f = fixture(); verander(f.contract);
    assert.equal(beoordeel(f).stand, 'BESTAANDE_AFSPRAAK'); assert.equal(P.aankondiging(f).ok, false);
  }
});
test('concept, algemene ondertekening en ontbrekende ontvangst zijn geen basis voor beperking', () => {
  for (const verander of [c => { delete c.ondertekening; }, c => { c.ondertekening.scope = 'lidmaatschap'; },
    c => { c.ondertekening.profiel = 'user-43'; }, c => { c.aanbod.voorwaarden.herstelDagen = 32; },
    c => { c.aanbod.tekst += 'anders'; }]) {
    const f = fixture(); verander(f.contract); assert.equal(beoordeel(f).beperkNieuweBetaaldeDiensten, false);
  }
  const f = fixture(); f.contract.status = 'GEACCEPTEERD'; assert.equal(beoordeel(f).stand, 'NIET_VAN_TOEPASSING');
});
test('conceptaankondiging bewijst geen beschikbaarstelling', () => {
  const f = fixture(); assert.equal(beoordeel(f).stand, 'AANKONDIGING_NODIG');
  f.contract.herstel = P.aankondiging(f).herstel; f.op = '2027-01-01T00:00:00.000Z';
  assert.equal(beoordeel(f).stand, 'CONTROLE_NODIG');
  assert.equal(f.contract.herstel.aankondiging, undefined);
});
test('kanaal, referentie, beschikbaarheid en inhoud moeten dezelfde eigen aankondiging bewijzen', () => {
  const basis = fixture(); bericht(basis); basis.op = '2027-01-01T00:00:00.000Z';
  for (const verander of [h => { h.aankondiging.kanaal = 'email'; }, h => { h.aankondiging.referentie = ''; },
    h => { h.aankondiging.beschikbaarAt = '2026-11-14T10:00:00.000Z'; },
    h => { h.aankondiging.beschikbaarAt = '2026-11-12T10:00:00.000Z'; },
    h => { h.aankondiging.inhoudHash = 'anders'; }, h => { h.accountId = 43; },
    h => { h.contractId = 'c-ander'; }, h => { h.tekst += ' gewijzigd'; }, h => { h.termijnIds.push('onbekend'); },
    h => { h.herstelTot = '2026-12-13T10:00:00.000Z'; }]) {
    const f = kopie(basis); verander(f.contract.herstel); assert.equal(beoordeel(f).stand, 'CONTROLE_NODIG');
  }
});
test('betaling herstelt direct op definitieve eigen betaalwaarheid, ook met achterlopende termijnstatus', () => {
  const f = fixture(); bericht(f); f.op = '2027-01-01T00:00:00.000Z';
  assert.equal(beoordeel(f).stand, 'BEPERKT'); betaling(f);
  assert.equal(f.termijnen[0].status, 'open'); assert.equal(beoordeel(f).stand, 'GEEN_ACHTERSTAND');
});
test('handmatig voldaan of betaald zonder het eigen bewijs is geen herstelbewijs', () => {
  const f = fixture(); bericht(f); f.op = '2027-01-01T00:00:00.000Z';
  for (const status of ['voldaan', 'betaald', 'gepland']) {
    f.termijnen[0].status = status; assert.equal(beoordeel(f).stand, 'CONTROLE_NODIG');
  }
});
test('netto centen vervangen nooit het bruto verschuldigde bedrag', () => {
  const f = fixture(); bericht(f); betaling(f, 'BEVESTIGD', { centen: 1000 });
  assert.equal(beoordeel(f).stand, 'CONTROLE_NODIG');
  delete f.termijnen[0].brutoCenten; assert.equal(beoordeel(f).stand, 'GEEN_ACHTERSTAND');
});
test('vreemd account, andere factuur, andere termijn en ontbrekende afhandeling vragen controle', () => {
  for (const verander of [b => { b.actor = 'acc:43'; }, b => { b.context.accountId = 43; },
    b => { b.context.invoiceId = 'ander'; }, b => { b.context.contractId = 'ander'; },
    b => { b.context.termijn = 2; }, b => { b.bronRef = 'ander'; }, b => { b.valuta = 'usd'; },
    b => { b.id = 'ander'; }, b => { b.providerId = null; }, b => { b.afgehandeldAt = null; },
    b => { b.afgehandeldAt = '2027-01-01T00:00:00.000Z'; }]) {
    const f = fixture(); betaling(f); verander(f.termijnen[0].betaling); assert.equal(beoordeel(f).stand, 'CONTROLE_NODIG');
  }
});
test('pending of onzekere betalingen worden niet als mislukte betaling benoemd', () => {
  for (const status of ['AANGEMAAKT', 'WACHT_OP_KLANT', 'IN_BEHANDELING', 'CONTROLE_NODIG']) {
    const f = fixture(); bericht(f); f.op = '2027-01-01T00:00:00.000Z'; betaling(f, status);
    assert.equal(beoordeel(f).beperkNieuweBetaaldeDiensten, false);
    assert.equal(beoordeel(f).stand, status === 'CONTROLE_NODIG' ? status : 'BETALING_IN_BEHANDELING');
  }
  const f = fixture(); bericht(f); f.op = '2027-01-01T00:00:00.000Z'; betaling(f, 'GEWEIGERD');
  assert.equal(beoordeel(f).stand, 'BEPERKT');
});
test('refund, pending refund of betwisting wordt menselijke controle, geen nieuw betalingsverzuim', () => {
  for (const extra of [{ status: 'TERUGBETAALD' }, { terugbetaaldCenten: 1 },
    { terugbetaalOpdrachten: [{ status: 'IN_BEHANDELING' }] }]) {
    const f = fixture(); betaling(f, 'BEVESTIGD', extra); assert.equal(beoordeel(f).stand, 'CONTROLE_NODIG');
  }
  const f = fixture(); bericht(f); f.op = '2027-01-01T00:00:00.000Z'; f.termijnen[0].betwist = true;
  assert.equal(beoordeel(f).stand, 'CONTROLE_NODIG');
});
test('nieuwe of gewijzigde termijnen kunnen niet meeliften op een verlopen aankondiging', () => {
  const f = fixture(); bericht(f); f.op = '2027-01-01T00:00:00.000Z'; betaling(f);
  f.termijnen.push({ ...f.termijnen[0], id: 'c-1:2', nr: 2, invoiceId: 'ABO-c-1-2',
    vervalt: '2026-12-13T10:00:00.000Z', betaalWaarheidId: null, betaling: null });
  assert.equal(beoordeel(f).stand, 'AANKONDIGING_NODIG');
  delete f.termijnen[0].betaling; f.termijnen[0].betaalWaarheidId = null; f.termijnen[0].brutoCenten++;
  assert.equal(beoordeel(f).stand, 'CONTROLE_NODIG');
});
test('toekomst, nul, dubbele bronnen en ontbrekende bronnen worden onderscheiden', () => {
  const f = fixture(); f.termijnen[0].vervalt = f.op; assert.equal(beoordeel(f).stand, 'GEEN_ACHTERSTAND');
  f.termijnen[0].vervalt = '2026-01-01T00:00:00.000Z'; f.termijnen[0].brutoCenten = 0;
  assert.equal(beoordeel(f).stand, 'GEEN_ACHTERSTAND');
  f.termijnen.push(kopie(f.termijnen[0])); assert.equal(beoordeel(f).stand, 'CONTROLE_NODIG');
  f.termijnen = []; assert.equal(beoordeel(f).stand, 'CONTROLE_NODIG');
});
test('alle beschermde diensten blijven bereikbaar; nooit een account- of tierblokkade', () => {
  const f = fixture(); bericht(f); f.op = '2027-01-01T00:00:00.000Z'; const o = beoordeel(f);
  for (const basisrecht of P.BASISRECHTEN) assert.equal(P.magDienst(o, { basisrecht, nieuweBetaaldeDienst: true }), true);
  assert.equal(P.magDienst(o, { nieuweBetaaldeDienst: true }), false);
  assert.equal(P.magDienst(o, {}), true);
  assert.equal(P.magDienst(o, { nieuweBetaaldeDienst: false }), true);
  assert.equal(P.magDienst(P.beoordeel(fixture()), { nieuweBetaaldeDienst: true }), true);
});
