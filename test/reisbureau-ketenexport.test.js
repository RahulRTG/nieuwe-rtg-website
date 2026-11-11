'use strict';
/* Projectie en roundtrip via de echte tenantuitgang; transactionele opslag
   wordt hier geïsoleerd nagebootst. De route-/SQLite-proef staat apart. */
const test = require('node:test'), assert = require('node:assert/strict'), crypto = require('node:crypto');
const maakExport = require('../server/kern/reisbureau-ketenexport');
const maakUitgang = require('../server/kern/tenant/uitgang');
const { offerte: maakKetenofferte } = require('../server/kern/reisbureau-ketencontract');
const { berichtHash } = require('../server/lib/zegel');
const kloon = x => structuredClone(x), AT = '2026-11-11T15:00:00.000Z';
const account = 'user-91919', klant = 'user-81818';
const actor = (supplierCode = 'BUREAU-A', org = 'ORG-A') => ({ actorRef: account, role: 'manager', supplierCode, org });
function reis(ref, supplierCode, org, titel) {
  const offerte = { schemaVersion: 1, versie: 2, geldigTot: '2026-11-20T00:00:00.000Z', voorwaarden: 'Eigen voorwaarden',
    valuta: 'EUR', totaalCenten: 50000, verkoper: { org, supplierCode },
    rollen: { hoedanigheid: 'reisagent', contractpartij: 'Eigen bureau', factureert: 'Eigen bureau', aansprakelijk: 'Gecontroleerde verklaring' },
    onderdelen: [{ id: 'hotel', wat: 'Eigen hotel', soort: 'verblijf', productRef: 'HOTEL-BRON', supplierCode: 'HOTEL-A',
      org: 'ORG-A', naam: 'Hotel A', centen: 40000, verschuldigdCenten: 30000 },
    { id: 'taxi', wat: 'Ander vervoer', soort: 'vervoer', productRef: 'ANDERE-BRON', supplierCode: 'TAXI-B', org: 'ORG-B',
      naam: 'Taxi B', centen: 10000, verschuldigdCenten: 7777 }] };
  offerte.hash = berichtHash(offerte);
  return { ref, titel, bestemming: 'Eigen bestemming', at: AT, status: 'geleverd', customerKey: klant, codename: 'eigen-reiziger',
    keten: { versie: 8, verkoper: { org, supplierCode, naam: titel }, offerte,
      offerteVersies: [{ ...kloon(offerte), versie: 1, hash: 'EERDERE-OFFERTE-HASH' }],
      akkoord: { offerteHash: offerte.hash, at: AT, actorRef: klant },
      leveringen: offerte.onderdelen.map(p => ({ ...kloon(p), status: 'geleverd', bewijsRef: p.id + '-geleverd', actorRef: account, at: AT,
        bewijsSoort: 'verklaring-bevoegde-aanbieder', bewijzen: [
          { besluit: 'accepteer', status: 'bevestigd', bewijsRef: p.id + '-acceptatie', actorRef: account, at: AT },
          { besluit: 'lever', status: 'geleverd', bewijsRef: p.id + '-geleverd', actorRef: account, at: AT }
        ] })),
      betaling: { status: 'betaald', centen: 50000, at: AT, boekingRef: 'PAY-REF-' + ref,
        van: 'lid:GEHEIME-BETAALREKENING', naar: 'partner:' + supplierCode, sleutel: 'GEHEIME-BETAALSLEUTEL' },
      gebeurtenissen: [{ volgnummer: 1, soort: 'aangevraagd', actorRef: klant, at: AT },
        { volgnummer: 8, soort: 'opdracht-lever', actorRef: account, at: AT }],
      nazorg: [{ id: 'RN-TEST', soort: 'annulering', status: 'beantwoord', offerteHash: offerte.hash,
        offerteVersie: offerte.versie, onderdelen: ['hotel'], toelichting: 'Mijn eigen nazorgtoelichting', at: AT,
        actorRef: klant, uitvoering: 'niet-uitgevoerd', financieleUitvoering: 'geblokkeerd',
        customerKey: 'GEHEIME-NAZORGSLEUTEL', internDossier: 'GEHEIME-INTERNE-NOTITIE',
        antwoord: { soort: 'voorstel', toelichting: 'Mijn eigen verkopersvoorstel', bronRef: 'NAZORG-BRONCLAIM',
          at: AT, actorRef: account, bewijsSoort: 'verklaring-eigen-verkoper', juridischGoedgekeurd: false,
          sessies: ['GEHEIME-ANTWOORDSESSIE'], betaalOpdracht: 'GEHEIME-BETAALOPDRACHT' } },
      { id: 'RN-OPEN', soort: 'wijziging', status: 'aangevraagd', offerteHash: offerte.hash,
        offerteVersie: offerte.versie, onderdelen: ['taxi'], toelichting: 'Nog onbeantwoorde vraag', at: AT,
        actorRef: klant, uitvoering: 'niet-uitgevoerd', financieleUitvoering: 'geblokkeerd', antwoord: null }],
      startsleutel: 'GEHEIME-STARTSLEUTEL', ontvangsten: [{ sleutel: 'GEHEIME-REPLAY', afdruk: 'GEHEIME-AFDRUK' }]
    } };
}
function huis() {
  const db = { data: { werkruimtes: {}, tenants: {}, reisAanvragen: [
    reis('EIGEN-REIS', 'BUREAU-A', 'ORG-A', 'Eigen bureau'),
    reis('ZELFDE-TENANT-ANDERE-ZAAK', 'BUREAU-A2', 'ORG-A', 'Andere zaak'),
    reis('ANDERE-TENANT', 'BUREAU-B', 'ORG-B', 'Concurrent'), { ref: 'LEGACY', codename: 'legacy' }
  ], payBoekingen: [{ id: 'PAY-REF-EIGEN-REIS' }], supplierStaff: [{ id: account }] } };
  const zaken = new Map([['BUREAU-A', 'ORG-A'], ['BUREAU-A2', 'ORG-A'], ['BUREAU-B', 'ORG-B'], ['HOTEL-A', 'ORG-A']]);
  const register = { vanWerkruimte: () => null };
  const uitgang = maakUitgang({ db, save() {}, register });
  const toegang = { ontvanger: code => code.startsWith('BUREAU') && zaken.has(code)
    ? { org: zaken.get(code), supplierCode: code, naam: 'Eigen zaak ' + code } : { status: 403, error: 'Gesloten' },
  leverancier: code => zaken.has(code) ? { org: zaken.get(code), supplierCode: code, naam: 'Eigen zaak ' + code } : { status: 403, error: 'Gesloten' } };
  let poort = 0;
  const uitvoer = maakExport({ toegang, uitgangVan: () => uitgang, nu: () => AT,
    bewerkCollectie: async (vorm, werk) => {
      assert.deepEqual(vorm, { reisAanvragen: 'lijst' }); poort++;
      const snapshot = kloon(db.data.reisAanvragen), r = werk({ reisAanvragen: snapshot });
      assert.deepEqual(snapshot, db.data.reisAanvragen, 'zelfexport schrijft geen ketenstatus of ontvangst');
      return r;
    } });
  return { db, zaken, uitgang, uitvoer, poort: () => poort };
}
// Ontvanger rekent het gepubliceerde recept zelf na, niet via serverhelpers.
function canoniek(v) {
  if (v === null || typeof v !== 'object') return JSON.stringify(v === undefined ? null : v);
  if (Array.isArray(v)) return '[' + v.map(canoniek).join(',') + ']';
  return '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + canoniek(v[k])).join(',') + '}';
}
const som = v => crypto.createHash('sha256').update(canoniek(v)).digest('hex');
function nagerekend(h, u) { u.catalogus = h.uitgang.catalogus(u.inhoud); u.checksum = som(u.catalogus); return u; }

test('verkoper neemt volledige benoemde eigen geschiedenis mee, niet zusterzaak of concurrent', async () => {
  const h = huis(), voor = kloon(h.db.data), r = await h.uitvoer.zaken(actor());
  assert.equal(r.ok, true); const u = r.uitvoer, archief = u.inhoud.reisarchief, a = archief.reizen[0];
  assert.equal(u.status, 'gedeeltelijk'); assert.equal(archief.operationeelHerstel, false);
  assert.deepEqual(archief.reizen.map(x => x.ref), ['EIGEN-REIS']);
  assert.equal(a.offerteVersies[0].hash, 'EERDERE-OFFERTE-HASH');
  assert.equal(a.offerte.hash, h.db.data.reisAanvragen[0].keten.offerte.hash);
  assert.equal(a.leveringen[0].bewijzen.length, 2); assert.equal(a.betaling.boekingRef, 'PAY-REF-EIGEN-REIS');
  assert.equal(a.gebeurtenissen[0].actor, a.akkoord.actor);
  assert.equal(a.gebeurtenissen[1].actor, a.leveringen[0].bewijzen[0].actor);
  assert.equal(a.nazorg[0].actor, a.akkoord.actor);
  assert.equal(a.nazorg[0].antwoord.actor, a.gebeurtenissen[1].actor);
  assert.ok(archief.dekking.volledig.length); assert.ok(archief.dekking.nietGedekt.length);
  assert.equal(h.uitgang.controleer(u).ok, true);
  for (const c of u.catalogus) assert.equal(c.checksum, som(u.inhoud[c.soort]));
  assert.equal(u.checksum, som(u.catalogus)); assert.deepEqual(h.db.data, voor);
});

test('een nieuwe offerte houdt productbronnen en oorspronkelijke hashes na export en documentaire roundtrip', async () => {
  const h = huis(), a = h.db.data.reisAanvragen[0], k = a.keten, basis = kloon(k.offerte);
  const providerVan = code => basis.onderdelen.find(p => p.supplierCode === code);
  const maak = versie => maakKetenofferte(basis, k.verkoper, versie - 1, providerVan, AT).offerte;
  k.offerte = maak(2); k.offerteVersies = [maak(1)];
  k.leveringen.forEach((p, i) => { p.bron = kloon(k.offerte.onderdelen[i].bron); });
  k.akkoord.offerteHash = k.offerte.hash;
  const voor = kloon(h.db.data), r = await h.uitvoer.zaken(actor());
  assert.equal(r.ok, true);
  const u = r.uitvoer, uit = u.inhoud.reisarchief.reizen[0];
  assert.deepEqual(uit.offerte, k.offerte);
  assert.deepEqual(uit.offerteVersies, k.offerteVersies);
  for (const o of [uit.offerte, ...uit.offerteVersies]) {
    const { hash: afdruk, ...grond } = o;
    assert.equal(som(grond), afdruk, 'de oorspronkelijke offerte blijft onafhankelijk herhashbaar');
  }
  assert.deepEqual(uit.leveringen.map(p => p.bron), k.leveringen.map(p => p.bron));
  const aanbieder = (await h.uitvoer.opdrachten(actor('HOTEL-A'))).uitvoer.inhoud.reisarchief.reizen[0];
  assert.deepEqual(aanbieder.opdrachten[0].bron, k.leveringen[0].bron);
  assert.equal(JSON.stringify(aanbieder).includes('TAXI-B'), false);
  const ingelezen = h.uitgang.lees(u);
  assert.equal(ingelezen.ok, true);
  const terug = h.uitgang.exporteer(ingelezen.werkruimte).uitvoer;
  assert.deepEqual(terug.inhoud.reisarchief.reizen[0], uit);
  assert.equal(terug.inhoud.reisarchief.operationeelHerstel, false);
  uit.offerte.onderdelen[0].bron.org = 'GEWIJZIGD';
  uit.leveringen[0].bron.productRef = 'GEWIJZIGD';
  aanbieder.opdrachten[0].bron.supplierCode = 'GEWIJZIGD';
  assert.deepEqual(h.db.data.reisAanvragen, voor.reisAanvragen, 'bronprojecties delen geen geneste opslagobjecten');
});

test('een oude offerte blijft hashbaar zonder achteraf toegevoegde bron; oude opdrachten noemen de onbekende bron', async () => {
  const h = huis(), r = await h.uitvoer.zaken(actor()), a = r.uitvoer.inhoud.reisarchief.reizen[0];
  assert.equal(Object.hasOwn(a.offerte.onderdelen[0], 'bron'), false, 'geen nieuw veld in een historische hashgrond');
  const { hash: afdruk, ...grond } = a.offerte;
  assert.equal(som(grond), afdruk);
  assert.equal(a.leveringen[0].bron, null);
  const eigen = (await h.uitvoer.opdrachten(actor('HOTEL-A'))).uitvoer.inhoud.reisarchief.reizen[0];
  assert.equal(eigen.opdrachten[0].bron, null, 'onbekend is geen teruggevulde productclaim');
});

test('bronexport bevat alleen de eigen scalaire referentievelden, geen vreemde binding of geneste geheimen', async () => {
  const h = huis(), p = h.db.data.reisAanvragen[0].keten.leveringen[0];
  const bron = { soort: 'opgegeven-productreferentie', org: p.org, supplierCode: p.supplierCode, productRef: p.productRef };
  p.bron = { ...bron, token: 'GEHEIM', metadata: { actorRef: account, economischeEigenaar: 'rtg' } };
  let u = (await h.uitvoer.opdrachten(actor('HOTEL-A'))).uitvoer;
  assert.deepEqual(u.inhoud.reisarchief.reizen[0].opdrachten[0].bron, bron);
  assert.equal(JSON.stringify(u).includes('GEHEIM'), false);
  for (const afwijking of [{ soort: 'live-boeking' }, { org: 'ORG-B' }, { supplierCode: 'TAXI-B' },
    { productRef: 'ANDERE-BRON' }, { productRef: { token: 'GEHEIM' } }]) {
    p.bron = { ...bron, ...afwijking };
    u = (await h.uitvoer.opdrachten(actor('HOTEL-A'))).uitvoer;
    assert.equal(u.inhoud.reisarchief.reizen[0].opdrachten[0].bron, null, 'afwijkende referentie is geen eigen bronbewijs');
    assert.equal(JSON.stringify(u).includes('GEHEIM'), false);
  }
});

test('zaakzelfexport bevat geen account-, replay-, sessie- of betaalopdrachtsleutel', async () => {
  const h = huis(), u = (await h.uitvoer.zaken(actor())).uitvoer, tekst = JSON.stringify(u);
  for (const geheim of [account, klant, 'customerKey', 'actorRef', 'GEHEIME', 'startsleutel', 'ontvangsten', '"sleutel":'])
    assert.equal(tekst.includes(geheim), false, geheim);
  assert.match(tekst, /PAY-REF-EIGEN-REIS/); assert.match(tekst, /eigen-reiziger/);
  const a = u.inhoud.reisarchief.reizen[0]; a.leveringen[0].bewijzen[0].bewijsRef = 'GEWIJZIGD';
  assert.equal(h.db.data.reisAanvragen[0].keten.leveringen[0].bewijzen[0].bewijsRef, 'hotel-acceptatie', 'geen gedeelde opslagreferentie');
});

test('aanbieder krijgt alleen eigen opdrachten en bewijs, nooit klant, verkoopprijs, andere aanbieders of accountkeys', async () => {
  const h = huis(), u = (await h.uitvoer.opdrachten(actor('HOTEL-A'))).uitvoer;
  const archief = u.inhoud.reisarchief, tekst = JSON.stringify(archief);
  assert.equal(archief.scope.rol, 'aanbieder'); assert.equal(archief.reizen.length, 3, 'eigen opdrachten bij drie verkopers');
  for (const a of archief.reizen) {
    assert.deepEqual(a.opdrachten.map(p => p.id), ['hotel']); assert.equal(a.opdrachten[0].verschuldigdCenten, 30000);
    assert.equal(a.opdrachten[0].bewijzen.length, 2);
  }
  for (const verboden of [account, klant, 'eigen-reiziger', 'customerKey', 'codenaam', 'offerte', '40000', '50000',
    '7777', 'TAXI-B', 'ANDERE-BRON', 'PAY-REF', 'GEHEIME', '"nazorg":', 'NAZORG-BRONCLAIM',
    'Mijn eigen nazorgtoelichting']) assert.equal(tekst.includes(verboden), false, verboden);
});

test('nazorg is een expliciete documentaire projectie, nooit een gevalideerde contract- of betaalbeslissing', async () => {
  const h = huis();
  h.db.data.reisAanvragen[0].keten.nazorg[0].antwoord.juridischGoedgekeurd = true;
  const u = (await h.uitvoer.zaken(actor())).uitvoer, a = u.inhoud.reisarchief, v = a.reizen[0].nazorg[0];
  assert.deepEqual(v.onderdelen, ['hotel']); assert.equal(v.offerteHash, a.reizen[0].offerte.hash);
  assert.equal(v.offerteVersie, 2); assert.equal(v.status, 'beantwoord');
  assert.equal(v.uitvoering, 'niet-uitgevoerd'); assert.equal(v.financieleUitvoering, 'geblokkeerd');
  assert.equal(v.antwoord.bronRef, 'NAZORG-BRONCLAIM'); assert.equal(v.antwoord.juridischGoedgekeurd, false);
  assert.equal(v.antwoord.bewijsSoort, 'verklaring-eigen-verkoper');
  assert.equal(a.reizen[0].nazorg[1].antwoord, null);
  assert.equal(v.internDossier, undefined); assert.equal(v.antwoord.betaalOpdracht, undefined);
  assert.match(a.dekking.bewijs, /nazorgbronref is een ongeverifieerde verkopersverklaring, geen contractgoedkeuring/);
  assert.ok(a.dekking.volledig.some(s => s.includes('Nazorgvragen')));
  assert.ok(a.dekking.nietGedekt.includes('Uitgevoerde contractwijzigingen, refunds en settlement'));
  v.onderdelen.push('NIET-OPSLAG');
  assert.deepEqual(h.db.data.reisAanvragen[0].keten.nazorg[0].onderdelen, ['hotel']);
});

test('org alleen, verkeerde rol, gedeelde actor, herbinding en gesloten zaak geven geen export', async () => {
  const h = huis();
  for (const a of [{ org: 'ORG-A' }, { ...actor(), role: 'medewerker' }, { ...actor(), actorRef: 'gedeelde-code' },
    actor('BUREAU-A', 'ORG-B'), actor('HOTEL-A')]) assert.equal((await h.uitvoer.zaken(a)).status, 403);
  h.zaken.set('BUREAU-A', 'NIEUWE-ORG'); assert.equal((await h.uitvoer.zaken(actor())).status, 403);
  h.zaken.delete('BUREAU-A'); assert.equal((await h.uitvoer.zaken(actor())).status, 403);
  assert.equal((await h.uitvoer.opdrachten(actor('HOTEL-A', 'ORG-B'))).status, 403);
});

test('reisarchief roundtrip bewaart bewijsbytes maar creëert geen live reis, tenantbinding, actor of geld', async () => {
  const h = huis(), u = (await h.uitvoer.zaken(actor())).uitvoer;
  const voor = kloon({ reizen: h.db.data.reisAanvragen, geld: h.db.data.payBoekingen, staff: h.db.data.supplierStaff });
  const r = h.uitgang.lees(u); assert.equal(r.ok, true);
  const w = h.db.data.werkruimtes[r.werkruimte];
  assert.deepEqual(w.reisarchief, u.inhoud.reisarchief); assert.deepEqual(w.leden, {});
  assert.equal(w.reisarchief.reizen[0].nazorg[0].antwoord.juridischGoedgekeurd, false);
  assert.equal(w.reisarchief.reizen[0].nazorg[0].financieleUitvoering, 'geblokkeerd');
  assert.equal(w.reisAanvragen, undefined); assert.equal(w.moeder, null);
  assert.deepEqual({ reizen: h.db.data.reisAanvragen, geld: h.db.data.payBoekingen, staff: h.db.data.supplierStaff }, voor);
  const terug = h.uitgang.exporteer(r.werkruimte).uitvoer;
  assert.equal(h.uitgang.controleer(terug).ok, true);
  assert.equal(som(terug.inhoud.reisarchief), som(u.inhoud.reisarchief));
  assert.equal(h.uitgang.lees(terug).ok, true, 'ook het opnieuw uitgegeven leesarchief blijft herleesbaar');
});

test('tamper, herrekende live-status, oude autoriteit en extra operationele soorten worden geweigerd', async () => {
  const h = huis(), u = (await h.uitvoer.zaken(actor())).uitvoer, voor = kloon(h.db.data);
  const gewijzigde = kloon(u); gewijzigde.inhoud.reisarchief.reizen[0].titel = 'Anders';
  assert.equal(h.uitgang.controleer(gewijzigde).ok, false);
  for (const vervals of [a => { a.inhoud.reisarchief.operationeelHerstel = true; },
    a => { a.inhoud.reisarchief.status = 'operationeel'; },
    a => { a.inhoud.reisarchief.reizen[0].actorRef = account; },
    a => { a.inhoud.reisarchief.reizen[0].token = 'oude-sessie'; },
    a => { a.inhoud.reisAanvragen = [{ ref: 'GEACTIVEERD', keten: {} }]; },
    a => { a.inhoud.leden = { M1: { rollen: [{ id: 'directie' }] } }; },
    a => { a.inhoud.reisketenUitgang.volledigeTenantexport = true; }]) {
    const poging = kloon(u); vervals(poging); nagerekend(h, poging);
    assert.equal(h.uitgang.lees(poging).status, 400); assert.deepEqual(h.db.data, voor);
  }
});

test('leesbaar overzicht noemt echte eigen referenties plus volledige en ontbrekende scope', async () => {
  const h = huis(), u = (await h.uitvoer.zaken(actor())).uitvoer, md = h.uitgang.leesbaar(u);
  assert.match(md, /Documentair reisarchief/); assert.match(md, /EIGEN-REIS/);
  assert.match(md, /Volledig opgenomen binnen deze zaakscope/); assert.match(md, /Niet gedekt:/);
  assert.match(md, /geen reizen, toegang, leveranciersacceptaties of betalingen/);
  assert.doesNotMatch(md, /ZELFDE-TENANT-ANDERE-ZAAK|ANDERE-TENANT|user-91919/);
});

test('een zelf herrekende bronclaim blijft een onbevoegd document, niet een tenant- of betaalbesluit', async () => {
  const h = huis(), u = (await h.uitvoer.zaken(actor())).uitvoer;
  const voor = kloon({ tenants: h.db.data.tenants, reizen: h.db.data.reisAanvragen, geld: h.db.data.payBoekingen });
  u.inhoud.reisarchief.scope.org = 'ORG-ANDERMANS';
  u.inhoud.reisarchief.reizen[0].betaling.boekingRef = 'ZELF-GETYPTE-BANKCLAIM';
  nagerekend(h, u);
  const r = h.uitgang.lees(u); assert.equal(r.ok, true, 'de checksum is geen afzenderhandtekening');
  const w = h.db.data.werkruimtes[r.werkruimte];
  assert.equal(w.reisarchief.operationeelHerstel, false); assert.equal(w.moeder, null);
  assert.match(w.reisarchief.dekking.bewijs, /geen authenticiteit/);
  assert.deepEqual({ tenants: h.db.data.tenants, reizen: h.db.data.reisAanvragen, geld: h.db.data.payBoekingen }, voor);
});
