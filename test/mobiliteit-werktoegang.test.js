/* Zuivere grensproef: echte vervoers-, beleids- en abonnementslogica, zonder
   serverlistener. De routeadapter meet de handler, niet HTTP-authenticatie;
   die wordt afzonderlijk in mobiliteit-werktoegang-http.test.js geraakt. */
'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { fixture: abonnement } = require('./abonnementsdiensten-fixture.cjs');
const schoon = (s, n) => String(s || '').trim().slice(0, n);
const aanvraag = extra => ({ ritsoort: 'direct', categorie: 'taxi', stad: 'Ibiza',
  van: { lat: 38.9, lng: 1.4, label: 'Werk' }, naar: { lat: 39, lng: 1.5, label: 'Bestemming' },
  namensOrganisatie: 'ZAAK', betaler: 'organisatie', ...extra });

async function fixture() {
  const abo = await abonnement();
  const persoon = { id: 7, actief: 1, tier: 'guest' };
  const sessie = { key: 'user-7', tier: 'guest', account: persoon };
  const zaak = { code: 'ZAAK', name: 'Werkgever', partnerStatus: 'actief' };
  const posities = [{ member_id: 7, supplier_code: 'ZAAK', name: 'Medewerker', active: 1 }];
  const zaken = [zaak], routes = new Map();
  const ctx = { db: abo.db, opslag: require('../server/kern/mobiliteit/opslag')({ db: abo.db }),
    save() {}, schoon, crypto, nu: () => abo.stand.at, id: () => 'fixture',
    notify() {}, sseToOffice() {}, sseToCustomer() {}, co2Van: () => ({ gram: 0 }),
    accounts: { getUserById: id => id === persoon.id ? persoon : null,
      isActief: p => !!p && p.actief === 1,
      staffPositions: id => posities.filter(p => p.member_id === id && p.active === 1) },
    zaakAbonnement: abo.zaakAbonnement, findSupplier: code => zaken.find(z => z.code === code) || null,
    modAan: () => ({ aan: true }), plekBepaal: p => ({ ...p }), haversine: () => 2000,
    etaMinutes: () => 10, codenaamVan: key => 'Codenaam-' + key,
    favLijst: () => { throw Error('Gratis nazorg opent geen persoonlijke favorieten.'); } };
  for (const deel of ['opdracht', 'voortgang', 'reisbeleid', 'reisbeleid-toets', 'zakelijk', 'ontvangst'])
    Object.assign(ctx, require('../server/kern/mobiliteit/' + deel)(ctx));
  Object.assign(ctx, require('../server/kern/mobiliteit/reiziger')({ ctx, schoon }));
  ctx.beleidZet('ZAAK', { goedkeuringVanaf: 500 }, 'Eigen manager');
  let gegevens = 0;
  require('../server/routes/mobiliteit')({ ...ctx,
    app: { post: (pad, ...handlers) => routes.set(pad, handlers.at(-1)) },
    gegevensStop() { gegevens++; return false; } });
  function route(pad, body = {}, session = sessie) {
    const res = { statusCode: 200, status(n) { this.statusCode = n; return this; },
      json(body) { this.body = body; return this; } };
    routes.get(pad)({ session, body }, res);
    return { status: res.statusCode, body: res.body };
  }
  return { abo, ctx, persoon, sessie, zaak, zaken, posities, route,
    gegevens: () => gegevens, ritten: () => ctx.opslag.bak('mobOpdrachten') };
}

test('gratis medewerker vraagt in de kern een werkgeversrit, zonder persoonlijke pas of prijsvoordeel', async () => {
  const f = await fixture();
  const r = f.ctx.mobVraag(f.sessie, aanvraag());
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.opdracht.betaler.soort, 'organisatie');
  assert.equal(r.opdracht.organisatie, 'ZAAK');
  assert.equal(r.opdracht.goedkeuring.status, 'wacht');
  assert.equal(r.opdracht.prijs, f.ctx.prijsUit(f.ctx.STANDAARD_TARIEF, 2, 10));
  assert.equal(f.sessie.tier, 'guest'); assert.equal(f.persoon.tier, 'guest');
});

test('de route bereikt dezelfde werkpoort en behoudt gegevenscontrole en menselijke beleidsdrempel', async () => {
  const f = await fixture(), r = f.route('/api/mob/vraag', aanvraag());
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const ref = r.body.opdracht.ref;
  assert.equal(f.gegevens(), 1);
  assert.equal(f.ctx.opdrachtenOpen().length, 0, 'geen dispatch vóór akkoord');
  assert.equal(f.ctx.opdrachtNaar(ref, 'geaccepteerd', 'dispatcher').status, 409);
  assert.equal(f.ctx.zakelijkBesluit('ANDER', 'Vreemde manager', { ref, akkoord: true }).status, 403);
  assert.equal(f.ctx.zakelijkBesluit('ZAAK', 'Eigen manager', { ref, akkoord: true }).ok, true);
  assert.equal(f.ctx.opdrachtenOpen().length, 1);
});

test('privé en een losse werkgeversclaim maken een gratis medewerker niet betaald', async () => {
  const f = await fixture();
  for (const body of [aanvraag({ betaler: 'reiziger' }), aanvraag({ betaler: undefined }),
    aanvraag({ betaler: 'reiziger', namensOrganisatie: undefined, tier: 'business', manager: true })]) {
    assert.equal(f.ctx.mobVraag(f.sessie, body).status, 403);
    assert.equal(f.route('/api/mob/vraag', body).status, 403);
  }
  for (const org of ['', {}, 'ZAAK'.padEnd(21, 'X')]) {
    assert.equal(f.route('/api/mob/vraag', aanvraag({ namensOrganisatie: org })).status, 400);
    assert.equal(f.ctx.mobVraag({ ...f.sessie, tier: 'rtg' }, aanvraag({ namensOrganisatie: org })).status, 400);
  }
  assert.equal(f.ritten().length, 0);
});

test('werkrelatie komt opnieuw van de personeelsbron, nooit uit verzoekvelden', async () => {
  const f = await fixture();
  f.zaken.push({ code: 'ANDER', partnerStatus: 'actief' });
  const spoof = aanvraag({ namensOrganisatie: 'ANDER', member_id: 7, staffId: 1, manager: true,
    account: f.persoon, tier: 'business', organisatie: 'ZAAK', key: 'user-7' });
  assert.equal(f.route('/api/mob/vraag', spoof).status, 403);
  f.posities[0].active = 0;
  assert.equal(f.ctx.mobVraag(f.sessie, aanvraag()).status, 403);
  assert.equal(f.route('/api/mob/vraag', aanvraag()).status, 403);
  assert.equal(f.ritten().length, 0);
});

test('demo, verwisselde identiteit en inmiddels gedeactiveerd account geven geen gratis werkrecht', async () => {
  const f = await fixture();
  for (const session of [{ key: 'guest', tier: 'guest' }, { ...f.sessie, account: null },
    { ...f.sessie, key: 'user-8' }, { ...f.sessie, account: { id: 8, actief: 1 } }]) {
    assert.equal(f.route('/api/mob/vraag', aanvraag(), session).status, 403);
    assert.equal(f.route('/api/mob/mijn', {}, session).status, 403);
  }
  f.persoon.actief = 0;
  assert.equal(f.ctx.mobVraag(f.sessie, aanvraag()).status, 403);
  assert.equal(f.route('/api/mob/mijn').status, 403);
  assert.equal(f.ritten().length, 0);
});

test('ontbrekende of gesloten werkgever geeft geen legacyrechten; etalagezichtbaarheid is geen werkrol', async () => {
  const f = await fixture();
  for (const status of ['geschorst', 'beeindigd', 'onbekend']) {
    f.zaak.partnerStatus = status;
    assert.equal(f.route('/api/mob/vraag', aanvraag()).status, 403);
  }
  f.zaken.length = 0;
  assert.equal(f.route('/api/mob/vraag', aanvraag()).status, 403);
  assert.equal(f.ritten().length, 0);
  f.zaak.partnerStatus = 'actief'; f.zaak.online = false; f.zaken.push(f.zaak);
  assert.equal(f.route('/api/mob/vraag', aanvraag()).status, 200);
});

test('zonder WorkOS-productrecht, abonnementsbron of controle ontstaat geen werkgeversrit', async () => {
  const f = await fixture();
  f.abo.db.data.zaakAbonnement.ZAAK.pas = 'gratis';
  assert.equal(f.route('/api/mob/vraag', aanvraag()).status, 403);
  const g = await fixture();
  delete g.ctx.zaakAbonnement.magDienst;
  assert.equal(g.route('/api/mob/vraag', aanvraag()).status, 503);
  const h = await fixture();
  h.ctx.zaakAbonnement.mag = () => { throw Error('bron onbereikbaar'); };
  assert.equal(h.route('/api/mob/vraag', aanvraag()).status, 503);
  assert.equal(f.ritten().length + g.ritten().length + h.ritten().length, 0);
});

test('echte 31-dagen-grens en betaalherstel gelden voor de werkgever, niet als privépas van de werknemer', async () => {
  const f = await fixture();
  f.abo.stand.at = f.abo.contract.herstel.herstelTot;
  assert.equal(f.route('/api/mob/vraag', aanvraag()).status, 200, 'tot en met hersteltermijn');
  const aantal = f.ritten().length;
  f.abo.beperk();
  assert.equal(f.route('/api/mob/vraag', aanvraag()).status, 402);
  assert.equal(f.ctx.mobVraag(f.sessie, aanvraag()).status, 402);
  assert.equal(f.ritten().length, aantal);
  f.abo.betaal();
  assert.equal(f.route('/api/mob/vraag', aanvraag()).status, 200);
  assert.equal(f.sessie.tier, 'guest');
  assert.equal(f.route('/api/mob/vraag', aanvraag({ betaler: 'reiziger' })).status, 403);
});

test('exact contracteinde en ongeldige zaakbinding sluiten nieuwe ritten zonder nominale pas te herschrijven', async () => {
  const f = await fixture(); f.abo.betaal();
  f.abo.contract.status = 'OPZEGGEND'; f.abo.contract.eindigtOp = '2026-11-14T10:00:00.000Z';
  assert.equal(f.route('/api/mob/vraag', aanvraag()).status, 200);
  f.abo.stand.at = f.abo.contract.eindigtOp;
  assert.equal(f.route('/api/mob/vraag', aanvraag()).status, 402);
  assert.equal(f.abo.zaakAbonnement.van('ZAAK').pas, 'business-lite');
  const g = await fixture(); g.abo.contract.zaakCode = 'BUUR';
  assert.equal(g.route('/api/mob/vraag', aanvraag()).status, 402);
  assert.equal(g.ritten().length, 0);
});

test('personeels- en contractintrekking nemen eigen lezen, volgen, ontvangst en annuleren niet af', async () => {
  const f = await fixture(), gemaakt = f.route('/api/mob/vraag', aanvraag());
  const ref = gemaakt.body.opdracht.ref, o = f.ctx.opdrachtMet(ref);
  f.posities[0].active = 0; f.abo.beperk(); f.zaak.partnerStatus = 'beeindigd';
  assert.equal(f.route('/api/mob/vraag', aanvraag()).status, 403);
  const mijn = f.route('/api/mob/mijn', { key: 'user-999', accountId: 999, namensOrganisatie: 'ANDER' });
  assert.equal(mijn.status, 200); assert.deepEqual(mijn.body.ritten.map(r => r.ref), [ref]);
  assert.deepEqual(mijn.body.favorieten, []);
  assert.equal(f.route('/api/mob/volg', { ref }).status, 200);
  o.status = 'aangekomen'; o.goedkeuring.status = 'akkoord';
  assert.equal(f.route('/api/mob/ontvangst', { ref, wat: 'aankomst' }).status, 200);
  assert.equal(f.route('/api/mob/ontvangst/probleem', { ref, soort: 'andere-chauffeur' }).status, 200);
  assert.equal(f.route('/api/mob/annuleer', { ref, reden: 'eigen herstel' }).status, 200);
  assert.equal(f.ctx.opdrachtMet(ref).status, 'geannuleerd');
});

test('nazorg volgt het opgeslagen object; verzoekvelden kunnen een vreemde rit nooit eigen maken', async () => {
  const f = await fixture(), ref = f.ctx.mobVraag(f.sessie, aanvraag()).opdracht.ref;
  const o = f.ctx.opdrachtMet(ref); o.reiziger = 'user-8';
  const voor = JSON.stringify(o);
  for (const pad of ['/api/mob/volg', '/api/mob/annuleer', '/api/mob/ontvangst', '/api/mob/ontvangst/probleem']) {
    assert.equal(f.route(pad, { ref, wat: 'aankomst', soort: 'andere-chauffeur',
      reiziger: 'user-7', accountId: 8, key: 'user-8', manager: true }).status, 403, pad);
    assert.equal(f.route(pad, { ref: 'BESTAAT-NIET' }).status, 404, pad);
  }
  assert.deepEqual(f.route('/api/mob/mijn').body.ritten, []);
  assert.equal(JSON.stringify(o), voor);
});

test('aanbod, plekken, favorieten, pendel en persoonlijke kaartverkoop blijven ongewijzigd dicht', async () => {
  const f = await fixture();
  for (const pad of ['/api/mob/aanbod', '/api/mob/plekken', '/api/mob/favoriet',
    '/api/mob/pendel', '/api/mob/beleid', '/api/mob/kaart/koop', '/api/mob/reis/boek'])
    assert.equal(f.route(pad, aanvraag()).status, 403, pad);
  assert.equal(f.ritten().length, 0);
});
