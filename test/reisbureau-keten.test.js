'use strict';
/* Onafhankelijke contractproeven met seriële copy-on-write testopslag en een
   expliciet gesimuleerde Pay-poort. Dit is geen bewijs van leverancier-, PSP-,
   browser-, PostgreSQL- of operationele productieacceptatie. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { maakReisketen } = require('../server/kern/reisbureau-keten');
const { hash } = require('../server/kern/reisbureau-ketencontract');

const lid = { actorRef: 'user-17' };
const anderLid = { actorRef: 'user-18' };
const kantoor = { org: 'rtg', actorRef: 'user-90', role: 'kantoor' };
const bureau = { org: 'ORG-BUREAU', supplierCode: 'BUREAU', actorRef: 'user-91', role: 'manager' };
const hotel = { org: 'ORG-HOTEL', supplierCode: 'HOTEL', actorRef: 'user-92', role: 'manager' };
const transfer = { org: 'ORG-TRANSFER', supplierCode: 'TRANSFER', actorRef: 'user-93', role: 'manager' };
const clone = value => structuredClone(value);

function huis() {
  let data = { reisAanvragen: [{ ref: 'LEGACY', customerKey: lid.actorRef, codename: 'oude-reiziger' }] };
  let queue = Promise.resolve(), failPublish = null, tijd = '2026-11-11T10:00:00.000Z', teller = 0;
  const bronnen = new Map([
    ['BUREAU', { org: bureau.org, supplierCode: 'BUREAU', naam: 'Zelfstandig Reisbedrijf' }],
    ['HOTEL', { org: hotel.org, supplierCode: 'HOTEL', naam: 'Zelfstandige accommodatie' }],
    ['TRANSFER', { org: transfer.org, supplierCode: 'TRANSFER', naam: 'Zelfstandig vervoer' }]
  ]);
  const selecteer = code => bronnen.has(code) ? clone(bronnen.get(code)) : { status: 403, error: 'Geen actieve aanbieder.' };
  const toegang = {
    ontvanger: code => code ? selecteer(code) : { org: 'rtg', supplierCode: null, naam: 'RTG Travel' },
    leverancier: selecteer
  };
  const bewerkCollectie = (vorm, werk) => {
    assert.deepEqual(vorm, { reisAanvragen: 'lijst' });
    const result = queue.then(async () => {
      const concept = clone(data), uit = await werk(concept);
      if (failPublish && failPublish(concept, uit)) { failPublish = null; throw new Error('gesimuleerde opslaguitval vóór publicatie'); }
      data = concept;
      return clone(uit);
    });
    queue = result.catch(() => {});
    return result;
  };
  const boekingen = new Map(), pogingen = [], bekendPogingen = [], modes = [];
  const pay = {
    vrijgavePoort: { intern: () => null }, // lokale, expliciet gesimuleerde huispoort
    rekLid: codenaam => 'lid:' + codenaam,
    rekPartner: code => 'partner:' + code,
    boekBekend: async vraag => {
      bekendPogingen.push(clone(vraag));
      const boeking = boekingen.get(vraag.economischeSleutel);
      if (!boeking) return { status: 404, onbekend: true, code: 'PAY_BOEKING_ONBEKEND' };
      if (!['van', 'naar', 'centen', 'soort', 'ref'].every(k => boeking[k] === vraag[k]))
        return { status: 503, error: 'Afwijkende economische identiteit.' };
      return { ok: true, boeking: clone(boeking), herhaald: true };
    },
    boekAsync: async vraag => {
      pogingen.push(clone(vraag));
      const mode = modes.shift();
      if (mode === 'throw-before') throw new Error('gesimuleerde uitval vóór betaling');
      let boeking = boekingen.get(vraag.economischeSleutel);
      if (!boeking) {
        boeking = { id: 'PAY-' + (boekingen.size + 1), at: tijd, ...clone(vraag) };
        boekingen.set(vraag.economischeSleutel, boeking);
      }
      if (mode === 'throw-after') throw new Error('gesimuleerde uitval na betaling');
      if (mode === 'error-after') return { status: 503, error: 'Gesimuleerd onbekend antwoord na commit.' };
      if (typeof mode === 'function') return mode(clone(boeking));
      return { ok: true, boeking: clone(boeking) };
    }
  };
  const dienst = maakReisketen({ bewerkCollectie, toegang, payVan: () => pay, nu: () => tijd });
  // De kernproef simuleert uitsluitend de bestaande identiteitspoort;
  // echte sessie/intrekkingscontroles staan in reisketen-financiele-grenzen.
  const betaal = dienst.betaal;
  dienst.betaal = (actor, codenaam, b) => betaal(actor, codenaam, b, () => ({ ok: true }));
  const h = { dienst, pay, boekingen, pogingen, bekendPogingen, modes, bronnen,
    snapshot: () => clone(data), nu: value => { tijd = value; },
    failPublish: predicate => { failPublish = predicate; },
    body: (reis, extra = {}) => ({ ref: reis.ref, versie: reis.versie, idem: 'handeling_' + (++teller), ...extra }),
    rij: ref => clone(data.reisAanvragen.find(a => a.ref === ref)) };
  return h;
}

function offerte(h, reis, extra = {}) {
  return h.body(reis, { valuta: 'EUR', geldigTot: '2026-11-20T10:00:00.000Z',
    voorwaarden: 'Aanvraag onder deze expliciete voorwaarden.',
    rollen: { hoedanigheid: 'reisagent', contractpartij: 'Eigen verkoper', factureert: 'Eigen verkoper',
      aansprakelijk: 'Aansprakelijkheid volgens de overeengekomen voorwaarden.' },
    onderdelen: [
      { id: 'slaap', wat: 'Twee overnachtingen', soort: 'verblijf', productRef: 'HOTEL-EIGEN-42', supplierCode: 'HOTEL', centen: 30000, verschuldigdCenten: 24000 },
      { id: 'rit', wat: 'Transfer naar accommodatie', soort: 'vervoer', productRef: 'TRANSFER-EIGEN-51', supplierCode: 'TRANSFER', centen: 5000, verschuldigdCenten: 4000 }
    ], ...extra });
}
function geslaagd(uit) { assert.equal(uit.ok, true, JSON.stringify(uit)); return uit.reis; }
async function aangevraagd(h, actor = kantoor) {
  return geslaagd(await h.dienst.start(lid, 'reiziger-maan', { titel: 'Eigen vakantie', bestemming: 'Eigen bestemming',
    supplierCode: actor.supplierCode, idem: h.body({}).idem }));
}
async function aangeboden(h, actor = kantoor) {
  const reis = await aangevraagd(h, actor);
  return geslaagd(await h.dienst.biedAan(actor, offerte(h, reis)));
}
async function geaccepteerd(h, actor = kantoor) {
  const reis = await aangeboden(h, actor);
  return geslaagd(await h.dienst.akkoord(lid, h.body(reis, { offerteHash: reis.offerte.hash })));
}
async function bevestigd(h, actor = kantoor) {
  let reis = await geaccepteerd(h, actor);
  reis = geslaagd(await h.dienst.opdracht(hotel, h.body(reis, { onderdeel: 'slaap', besluit: 'accepteer', bewijsRef: 'HOTEL-ACCEPTATIE-1' })));
  return geslaagd(await h.dienst.opdracht(transfer, h.body(reis, { onderdeel: 'rit', besluit: 'accepteer', bewijsRef: 'TRANSFER-ACCEPTATIE-1' })));
}

test('dezelfde spiegelreis werkt voor RTG en zelfstandig bureau zonder schijn-afwikkeling', async () => {
  const h = huis(), refs = [];
  for (const actor of [kantoor, bureau]) {
    let reis = await bevestigd(h, actor); refs.push(reis.ref);
    assert.equal(reis.status, 'bevestigd');
    reis = geslaagd(await h.dienst.betaal(lid, 'reiziger-maan', h.body(reis)));
    assert.equal(reis.betaling.status, 'betaald');
    assert.equal(reis.betaling.centen, 35000);
    reis = geslaagd(await h.dienst.opdracht(hotel, h.body(reis, { onderdeel: 'slaap', besluit: 'lever', bewijsRef: 'HOTEL-LEVERING-1' })));
    assert.equal(reis.status, 'bevestigd', 'één levering is niet de hele reis');
    reis = geslaagd(await h.dienst.opdracht(transfer, h.body(reis, { onderdeel: 'rit', besluit: 'lever', bewijsRef: 'TRANSFER-LEVERING-1' })));
    assert.equal(reis.status, 'geleverd');
    const voor = h.rij(reis.ref);
    const sluit = await h.dienst.afronden(actor, h.body(reis));
    assert.equal(sluit.status, 409);
    assert.match(sluit.error, /settlement/);
    assert.deepEqual(h.rij(reis.ref), voor, 'geen afgewezen afsluitmutatie of bewijs');
    const beeld = (await h.dienst.zaken(actor, reis.ref)).reizen[0];
    assert.deepEqual(beeld.aansluiting, { ontvangenCenten: 35000, verschuldigdCenten: 28000,
      settlement: 'niet-gekwalificeerd', externeBetaalprovider: 'niet-gekoppeld', kostenbesparing: 'niet-gemeten' });
    assert.equal(beeld.kwalificatie, 'ondersteund');
    assert.equal(beeld.operationeelBewezen, false);
    assert.equal(beeld.directBoekbaarBewezen, false);
  }
  assert.notEqual(refs[0], refs[1]);
  assert.deepEqual([...h.boekingen.values()].map(b => b.naar), ['rtg:reisbureau', 'partner:BUREAU']);
  assert.equal((await h.dienst.zaken(kantoor)).reizen.length, 1);
  assert.equal((await h.dienst.zaken(bureau)).reizen.length, 1);
  assert.deepEqual(h.snapshot().reisAanvragen.find(a => a.ref === 'LEGACY'),
    { ref: 'LEGACY', customerKey: lid.actorRef, codename: 'oude-reiziger' });
});

test('verkoper-, klant- en leveranciersgrenzen zijn niet te wijzigen via de body', async () => {
  const h = huis(), reis = await aangeboden(h, bureau), voor = h.rij(reis.ref);
  assert.deepEqual((await h.dienst.zaken(kantoor, reis.ref)).reizen, []);
  assert.deepEqual((await h.dienst.zaken({ ...bureau, org: 'ANDERE-ORG' }, reis.ref)).reizen, []);
  assert.deepEqual((await h.dienst.mijn(anderLid, reis.ref)).reizen, []);
  assert.equal((await h.dienst.biedAan(kantoor, offerte(h, reis, { org: bureau.org, supplierCode: bureau.supplierCode }))).status, 404);
  assert.equal((await h.dienst.akkoord(anderLid, h.body(reis, { offerteHash: reis.offerte.hash, customerKey: lid.actorRef }))).status, 404);
  assert.equal((await h.dienst.afronden(kantoor, h.body(reis, { org: bureau.org }))).status, 404);
  assert.equal((await h.dienst.betaal(anderLid, 'reiziger-maan', h.body(reis, { customerKey: lid.actorRef }))).status, 404);
  assert.deepEqual(h.rij(reis.ref), voor);
  assert.equal(h.pogingen.length, 0);
});

test('een leverancier ziet uitsluitend de eigen opdracht en niet klantkey, marge of andere leverancier', async () => {
  const h = huis(), reis = await geaccepteerd(h, bureau);
  const beeld = (await h.dienst.opdrachten(hotel)).reizen[0];
  assert.deepEqual(Object.keys(beeld).sort(), ['opdrachten', 'ref', 'status', 'verkoper', 'versie']);
  assert.deepEqual(beeld.opdrachten.map(p => p.id), ['slaap']);
  assert.equal(beeld.opdrachten[0].verschuldigdCenten, 24000);
  const json = JSON.stringify(beeld);
  for (const verboden of ['user-17', 'reiziger-maan', 'customerKey', 'codenaam', 'totaalCenten', 'TRANSFER', 'TRANSFER-EIGEN-51', '35000', '30000'])
    assert.equal(json.includes(verboden), false, verboden);
  assert.deepEqual((await h.dienst.opdrachten({ ...hotel, org: 'ANDERE-ORG' })).reizen, []);
  assert.equal((await h.dienst.opdracht(hotel, h.body(reis, { onderdeel: 'rit', besluit: 'accepteer',
    bewijsRef: 'VERVALST', org: transfer.org, supplierCode: transfer.supplierCode }))).status, 404);
  beeld.opdrachten[0].status = 'geleverd';
  assert.equal(h.rij(reis.ref).keten.leveringen[0].status, 'aangevraagd', 'projecties delen geen opslagreferenties');
  const klant = (await h.dienst.mijn(lid, reis.ref)).reizen[0];
  assert.equal(JSON.stringify(klant).includes('verschuldigdCenten'), false);
  assert.equal(JSON.stringify(klant).includes('user-17'), false);
  klant.offerte.rollen.contractpartij = 'VERVALST';
  assert.equal(h.rij(reis.ref).keten.offerte.rollen.contractpartij, 'Eigen verkoper');
});

test('dubbele start is transactioneel één aanvraag; gewijzigde gegevens met dezelfde sleutel conflicteren', async () => {
  const h = huis(), vraag = { titel: 'Vakantie', bestemming: 'Bestemming', idem: 'start_uniek', org: bureau.org };
  const uitslagen = await Promise.all([h.dienst.start(lid, 'reiziger-maan', vraag), h.dienst.start(lid, 'reiziger-maan', clone(vraag))]);
  assert.equal(geslaagd(uitslagen[0]).ref, geslaagd(uitslagen[1]).ref);
  assert.equal(uitslagen[1].herhaald, true);
  assert.equal(h.snapshot().reisAanvragen.filter(a => a.keten).length, 1);
  assert.equal(h.rij(uitslagen[0].reis.ref).keten.verkoper.org, 'rtg', 'body-org is geen ontvanger');
  assert.equal((await h.dienst.start(lid, 'reiziger-maan', { ...vraag, bestemming: 'Anders' })).status, 409);
  assert.equal((await h.dienst.start(lid, 'reiziger-maan', { ...vraag, supplierCode: 'BUREAU' })).status, 409);
});

test('twee apparaten: exacte versie voorkomt lost update, idem replay schrijft geen tweede gebeurtenis', async () => {
  const h = huis(), reis = await aangevraagd(h), eerste = offerte(h, reis), tweede = offerte(h, reis, { voorwaarden: 'Andere voorwaarden.' });
  const uit = await Promise.all([h.dienst.biedAan(kantoor, eerste), h.dienst.biedAan(kantoor, tweede)]);
  const actueel = geslaagd(uit[0]);
  assert.equal(uit[1].status, 409);
  const voor = h.rij(reis.ref);
  const opnieuw = await h.dienst.biedAan(kantoor, clone(eerste));
  assert.equal(opnieuw.herhaald, true);
  assert.equal(opnieuw.reis.versie, actueel.versie);
  assert.deepEqual(h.rij(reis.ref), voor);
  assert.equal((await h.dienst.biedAan(kantoor, { ...eerste, voorwaarden: 'Manipulatie.' })).status, 409);
  assert.equal((await h.dienst.biedAan(kantoor, { ...eerste, idem: 'nieuwe_idem', versie: 0 })).status, 409);
  assert.deepEqual(h.rij(reis.ref), voor);
});

test('offerte is gehasht, versiegebonden en niet na verval of met oude hash te aanvaarden', async () => {
  const h = huis(); let reis = await aangeboden(h);
  const raw = h.rij(reis.ref).keten.offerte, { hash: digest, ...inhoud } = raw;
  assert.equal(digest, hash(inhoud));
  assert.equal((await h.dienst.akkoord(lid, h.body(reis, { offerteHash: 'onjuist' }))).status, 409);
  const oudeHash = reis.offerte.hash;
  reis = geslaagd(await h.dienst.biedAan(kantoor, offerte(h, reis, { voorwaarden: 'Gewijzigde voorwaarden.' })));
  assert.equal(reis.offerte.versie, 2);
  assert.notEqual(reis.offerte.hash, oudeHash);
  assert.equal((await h.dienst.akkoord(lid, h.body(reis, { offerteHash: oudeHash }))).status, 409);
  h.nu(reis.offerte.geldigTot);
  const voor = h.rij(reis.ref);
  assert.equal((await h.dienst.akkoord(lid, h.body(reis, { offerteHash: reis.offerte.hash }))).status, 409);
  assert.deepEqual(h.rij(reis.ref), voor);
});

test('gesloten of hergebonden leverancier maakt een bestaande offerte niet alsnog uitvoerbaar', async () => {
  for (const verander of [h => h.bronnen.delete('HOTEL'), h => h.bronnen.set('HOTEL', { org: 'NIEUWE-ORG', supplierCode: 'HOTEL', naam: 'Andere eigenaar' })]) {
    const h = huis(), reis = await aangeboden(h); verander(h);
    assert.equal((await h.dienst.akkoord(lid, h.body(reis, { offerteHash: reis.offerte.hash }))).status, 409);
    assert.equal(h.rij(reis.ref).keten.akkoord, null);
    assert.deepEqual(h.rij(reis.ref).keten.leveringen, []);
  }
});

test('ongeldige geld-, rol-, termijn- en aanbiedercontracten veranderen niets', async () => {
  const h = huis(), reis = await aangevraagd(h), basis = offerte(h, reis), voor = h.rij(reis.ref);
  const varianten = [
    { valuta: 'USD' }, { voorwaarden: '' }, { geldigTot: '2026-11-11T10:00:00Z' }, { geldigTot: '2030-01-01' },
    { rollen: { ...basis.rollen, hoedanigheid: 'platformbeheerder' } }, { onderdelen: [] },
    { onderdelen: [basis.onderdelen[0], basis.onderdelen[0]] },
    ...[0, -1, 1.5, 10000001, Infinity].map(centen => ({ onderdelen: [{ ...basis.onderdelen[0], centen }] })),
    { onderdelen: [{ ...basis.onderdelen[0], verschuldigdCenten: 30001 }] },
    { onderdelen: [{ ...basis.onderdelen[0], supplierCode: 'ONBEKEND' }] }
  ];
  for (const extra of varianten) {
    const uit = await h.dienst.biedAan(kantoor, { ...basis, ...extra });
    assert.ok([400, 403].includes(uit.status), JSON.stringify(extra));
    assert.deepEqual(h.rij(reis.ref), voor);
  }
  const goed = geslaagd(await h.dienst.biedAan(kantoor, { ...basis,
    onderdelen: basis.onderdelen.map(p => ({ ...p, org: 'VERVALSTE-ORG', naam: 'VERVALST' })) }));
  assert.equal(goed.offerte.onderdelen[0].org, hotel.org);
  assert.equal(goed.offerte.onderdelen[0].naam, 'Zelfstandige accommodatie');
});

test('een gesloten of hergebonden verkoper krijgt geen nieuw akkoord of leveranciersopdrachten', async () => {
  for (const verander of [h => h.bronnen.delete('BUREAU'), h => h.bronnen.set('BUREAU',
    { org: 'ANDERE-EIGENAAR', supplierCode: 'BUREAU', naam: 'Ander bureau' })]) {
    const h = huis(), reis = await aangeboden(h, bureau), voor = h.rij(reis.ref);
    verander(h);
    assert.equal((await h.dienst.akkoord(lid, h.body(reis, { offerteHash: reis.offerte.hash }))).status, 409);
    assert.deepEqual(h.rij(reis.ref), voor);
  }
});

test('meerregelige offertevoorwaarden werken; HTML en andere besturingstekens blijven geweigerd', async () => {
  const h = huis(), reis = await aangevraagd(h), b = offerte(h, reis);
  b.voorwaarden = 'Dag 1: aankomst.\nDag 2: excursie.';
  b.rollen.aansprakelijk = 'Leverancier voor eigen uitvoering.\r\nVerkoper voor coördinatie.';
  for (const fout of ['Regel\u0000nul', '<script>tekst</script>', 'Regel\tverborgen']) {
    assert.equal((await h.dienst.biedAan(kantoor, { ...b, voorwaarden: fout })).status, 400);
  }
  const uit = geslaagd(await h.dienst.biedAan(kantoor, b));
  assert.equal(uit.offerte.voorwaarden, b.voorwaarden);
  assert.equal(uit.offerte.rollen.aansprakelijk, b.rollen.aansprakelijk);
  const { hash: afdruk, ...grond } = uit.offerte;
  assert.equal(hash(grond), afdruk);
});

test('leveringsbewijs bewaart de eerdere acceptatie met actor en tijd; replay voegt niets toe', async () => {
  const h = huis(); let reis = await bevestigd(h, bureau);
  const acceptatie = h.rij(reis.ref).keten.leveringen[0].bewijzen[0];
  assert.equal(acceptatie.besluit, 'accepteer');
  assert.equal(acceptatie.bewijsRef, 'HOTEL-ACCEPTATIE-1');
  assert.equal(acceptatie.actorRef, hotel.actorRef);
  reis = geslaagd(await h.dienst.betaal(lid, 'reiziger-maan', h.body(reis)));
  h.nu('2026-11-12T12:00:00.000Z');
  const b = h.body(reis, { onderdeel: 'slaap', besluit: 'lever', bewijsRef: 'HOTEL-LEVERING-2' });
  geslaagd(await h.dienst.opdracht(hotel, b));
  const bewijzen = h.rij(reis.ref).keten.leveringen[0].bewijzen;
  assert.equal(bewijzen.length, 2);
  assert.deepEqual(bewijzen[0], acceptatie);
  assert.equal(bewijzen[1].besluit, 'lever');
  assert.equal(bewijzen[1].at, '2026-11-12T12:00:00.000Z');
  assert.equal((await h.dienst.opdracht(hotel, b)).herhaald, true);
  assert.deepEqual(h.rij(reis.ref).keten.leveringen[0].bewijzen, bewijzen);
});

test('leveranciersweigering stopt inning en vervolg; geen schijnbevestiging of automatische compensatie', async () => {
  const h = huis(); let reis = await geaccepteerd(h);
  reis = geslaagd(await h.dienst.opdracht(hotel, h.body(reis, { onderdeel: 'slaap', besluit: 'weiger', bewijsRef: 'HOTEL-WEIGERING-1' })));
  assert.equal(reis.status, 'herstel-vereist');
  assert.equal((await h.dienst.betaal(lid, 'reiziger-maan', h.body(reis))).status, 409);
  assert.equal((await h.dienst.opdracht(transfer, h.body(reis, { onderdeel: 'rit', besluit: 'accepteer', bewijsRef: 'TRANSFER-ACCEPTATIE' }))).status, 409);
  assert.equal((await h.dienst.afronden(kantoor, h.body(reis))).status, 409);
  assert.equal(h.pogingen.length, 0);
  assert.equal(h.rij(reis.ref).keten.leveringen[0].status, 'geweigerd');
  assert.equal(h.rij(reis.ref).keten.leveringen[1].status, 'aangevraagd');
});

test('aanvraag, gedeeltelijke acceptatie en ongeïnde bevestiging zijn geen bewijs van levering', async () => {
  const h = huis(); let reis = await geaccepteerd(h);
  assert.equal((await h.dienst.betaal(lid, 'reiziger-maan', h.body(reis))).status, 409);
  assert.equal((await h.dienst.opdracht(hotel, h.body(reis, { onderdeel: 'slaap', besluit: 'lever', bewijsRef: 'VOORBARIG' }))).status, 409);
  reis = geslaagd(await h.dienst.opdracht(hotel, h.body(reis, { onderdeel: 'slaap', besluit: 'accepteer', bewijsRef: 'HOTEL-OK' })));
  assert.equal(reis.status, 'gedeeltelijk-bevestigd');
  assert.equal((await h.dienst.betaal(lid, 'reiziger-maan', h.body(reis))).status, 409);
  reis = geslaagd(await h.dienst.opdracht(transfer, h.body(reis, { onderdeel: 'rit', besluit: 'accepteer', bewijsRef: 'TRANSFER-OK' })));
  assert.equal((await h.dienst.opdracht(hotel, h.body(reis, { onderdeel: 'slaap', besluit: 'lever', bewijsRef: 'NOG-ONBETAALD' }))).status, 409);
  assert.equal(h.pogingen.length, 0);
});

test('ontbrekende Pay of verouderde eerste betaalversie maakt geen claim of boeking', async () => {
  const h = huis(), reis = await bevestigd(h), voor = h.rij(reis.ref);
  assert.equal((await h.dienst.betaal(lid, 'reiziger-maan', h.body(reis, { versie: reis.versie - 1 }))).status, 409);
  delete h.pay.boekAsync;
  assert.equal((await h.dienst.betaal(lid, 'reiziger-maan', h.body(reis))).status, 503);
  assert.deepEqual(h.rij(reis.ref), voor);
  assert.equal(h.boekingen.size, 0);
});

test('concurrente betaling en replay delen één economische boeking en één bevestiging', async () => {
  const h = huis(), reis = await bevestigd(h, bureau), b = h.body(reis);
  const uit = await Promise.all([h.dienst.betaal(lid, 'reiziger-maan', b), h.dienst.betaal(lid, 'reiziger-maan', clone(b))]);
  for (const r of uit) assert.equal(geslaagd(r).betaling.status, 'betaald');
  assert.equal(h.boekingen.size, 1);
  assert.equal(new Set(h.pogingen.map(p => p.economischeSleutel)).size, 1);
  assert.equal(h.rij(reis.ref).keten.gebeurtenissen.filter(e => e.soort === 'betaling-bevestigd').length, 1);
  const voor = h.rij(reis.ref), pogingen = h.pogingen.length;
  assert.equal(geslaagd(await h.dienst.betaal(lid, 'reiziger-maan', b)).betaling.status, 'betaald');
  assert.deepEqual(h.rij(reis.ref), voor);
  assert.equal(h.pogingen.length, pogingen);
});

for (const mode of ['throw-before', 'throw-after', 'error-after']) {
  test('onbekende betaaluitkomst herstelt zonder dubbele inning: ' + mode, async () => {
    const h = huis(), reis = await bevestigd(h), b = h.body(reis);
    h.modes.push(mode);
    assert.equal((await h.dienst.betaal(lid, 'reiziger-maan', b)).status, 503);
    assert.equal(h.rij(reis.ref).keten.betaling.status, 'bezig');
    assert.equal(h.boekingen.size, mode === 'throw-before' ? 0 : 1);
    assert.equal((await h.dienst.opdracht(hotel, h.body(reis, { onderdeel: 'slaap', besluit: 'lever', bewijsRef: 'TE-VROEG' }))).status, 409);
    assert.equal(geslaagd(await h.dienst.betaal(lid, 'reiziger-maan', b)).betaling.status, 'betaald');
    assert.equal(h.boekingen.size, 1);
    assert.equal(h.rij(reis.ref).keten.gebeurtenissen.filter(e => e.soort === 'betaling-bevestigd').length, 1);
    assert.equal(new Set(h.pogingen.map(p => p.economischeSleutel)).size, 1);
  });
}

test('crash na Pay-commit vóór reispublicatie blijft herstelbaar via dezelfde economische identiteit', async () => {
  const h = huis(), reis = await bevestigd(h), b = h.body(reis);
  h.failPublish(concept => concept.reisAanvragen.some(a => a.keten && a.keten.betaling && a.keten.betaling.status === 'betaald'));
  await assert.rejects(h.dienst.betaal(lid, 'reiziger-maan', b), /opslaguitval/);
  assert.equal(h.boekingen.size, 1);
  assert.equal(h.rij(reis.ref).keten.betaling.status, 'bezig');
  assert.equal(h.rij(reis.ref).keten.gebeurtenissen.some(e => e.soort === 'betaling-bevestigd'), false);
  assert.equal(geslaagd(await h.dienst.betaal(lid, 'reiziger-maan', b)).betaling.status, 'betaald');
  assert.equal(h.boekingen.size, 1);
  assert.equal(h.pogingen.length, 1, 'herstel leest alleen het bestaande betaalbewijs');
  assert.equal(h.pogingen[0].economischeSleutel, h.bekendPogingen[0].economischeSleutel);
});

test('veranderde betaler kan een reeds geclaimde inning niet overnemen', async () => {
  const h = huis(), reis = await bevestigd(h), b = h.body(reis);
  h.modes.push('throw-before');
  assert.equal((await h.dienst.betaal(lid, 'reiziger-maan', b)).status, 503);
  assert.equal((await h.dienst.betaal(lid, 'andere-codenaam', b)).status, 409);
  assert.equal(h.pogingen.length, 1);
  assert.equal(h.boekingen.size, 0);
});

test('al geboekte inning herstelt read-only na sluiting, herbinding of codenaamwijziging', async () => {
  for (const wijzig of [h => h.bronnen.delete('HOTEL'), h => h.bronnen.delete('BUREAU'),
    h => h.bronnen.set('HOTEL', { org: 'NIEUWE-ORG', supplierCode: 'HOTEL', naam: 'Nieuwe eigenaar' }),
    h => h.bronnen.set('BUREAU', { org: 'NIEUWE-ORG', supplierCode: 'BUREAU', naam: 'Nieuwe verkoper' })]) {
    const h = huis(), reis = await bevestigd(h, bureau), b = h.body(reis);
    h.modes.push('throw-after');
    assert.equal((await h.dienst.betaal(lid, 'reiziger-maan', b)).status, 503);
    wijzig(h);
    const uit = geslaagd(await h.dienst.betaal(lid, 'nieuwe-codenaam', b));
    assert.equal(uit.betaling.status, 'betaald');
    assert.equal(h.pogingen.length, 1, 'gesloten zaken krijgen geen nieuwe geldactie');
    assert.equal(h.boekingen.size, 1);
    assert.equal(h.bekendPogingen[0].van, 'lid:reiziger-maan', 'het oorspronkelijke betaalbewijs wordt opgezocht');
    assert.equal(h.rij(reis.ref).keten.gebeurtenissen.filter(g => g.soort === 'betaling-bevestigd').length, 1);
  }
});

test('onbekende niet-geboekte claim blijft dicht na verkoper- of leveranciersluiting', async () => {
  for (const code of ['HOTEL', 'BUREAU']) {
    const h = huis(), reis = await bevestigd(h, bureau), b = h.body(reis);
    h.modes.push('throw-before');
    assert.equal((await h.dienst.betaal(lid, 'reiziger-maan', b)).status, 503);
    h.bronnen.delete(code);
    assert.equal((await h.dienst.betaal(lid, 'reiziger-maan', b)).status, 409);
    assert.equal(h.bekendPogingen.length, 1);
    assert.equal(h.pogingen.length, 1);
    assert.equal(h.boekingen.size, 0);
    assert.equal(h.rij(reis.ref).keten.betaling.status, 'bezig');
  }
});

test('een onbereikbare of afwijkende read-only betaalcontrole autoriseert nooit opnieuw innen', async () => {
  for (const antwoord of [null, { status: 404, onbekend: true }, { status: 409, error: 'andere beweging' },
    { status: 503, onbekend: true, code: 'PAY_BOEKING_ONBEKEND' }, { ok: true, boeking: { id: 'VERKEERD' } }]) {
    const h = huis(), reis = await bevestigd(h), b = h.body(reis);
    h.modes.push('throw-before');
    assert.equal((await h.dienst.betaal(lid, 'reiziger-maan', b)).status, 503);
    h.pay.boekBekend = async () => antwoord;
    assert.equal((await h.dienst.betaal(lid, 'reiziger-maan', b)).status, 503);
    assert.equal(h.pogingen.length, 1);
    assert.equal(h.boekingen.size, 0);
    assert.equal(h.rij(reis.ref).keten.betaling.status, 'bezig');
  }
});

test('een afwijkend betaalbewijs bevestigt niets en bewaart de herstelclaim', async () => {
  for (const afwijking of [b => ({ ...b, van: 'lid:ander' }), b => ({ ...b, naar: 'partner:ANDER' }),
    b => ({ ...b, centen: b.centen - 1 }), b => ({ ...b, ref: 'ANDERE-REIS' }),
    ...[null, '', 1, {}, [], true].map(id => b => ({ ...b, id }))]) {
    const h = huis(), reis = await bevestigd(h), b = h.body(reis);
    h.modes.push(boeking => ({ ok: true, boeking: afwijking(boeking) }));
    assert.equal((await h.dienst.betaal(lid, 'reiziger-maan', b)).status, 503);
    assert.equal(h.rij(reis.ref).keten.betaling.status, 'bezig');
    assert.equal(h.rij(reis.ref).keten.gebeurtenissen.some(e => e.soort === 'betaling-bevestigd'), false);
    assert.equal(geslaagd(await h.dienst.betaal(lid, 'reiziger-maan', b)).betaling.status, 'betaald');
    assert.equal(h.boekingen.size, 1);
  }
});

test('de boekingssoort is onderdeel van betaalbewijs, niet alleen bedrag en rekeningen', async () => {
  const h = huis(), reis = await bevestigd(h), b = h.body(reis);
  h.modes.push(boeking => ({ ok: true, boeking: { ...boeking, soort: 'verkeerde-handeling' } }));
  assert.equal((await h.dienst.betaal(lid, 'reiziger-maan', b)).status, 503);
  assert.equal(h.rij(reis.ref).keten.betaling.status, 'bezig');
});

test('teruggedraaide opslagmutatie publiceert geen offerte of auditregel', async () => {
  const h = huis(), reis = await aangevraagd(h), b = offerte(h, reis), voor = h.rij(reis.ref);
  h.failPublish(concept => concept.reisAanvragen.some(a => a.keten && a.keten.offerte));
  await assert.rejects(h.dienst.biedAan(kantoor, b), /opslaguitval/);
  assert.deepEqual(h.rij(reis.ref), voor);
  assert.equal(geslaagd(await h.dienst.biedAan(kantoor, b)).versie, reis.versie + 1);
  assert.equal(h.rij(reis.ref).keten.ontvangsten.length, 1);
});
