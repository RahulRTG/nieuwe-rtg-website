/* De echte bureau-montage: directe opdracht, duurzame bedoeling en lusintake
   delen één creatiepoort. Afhandeling, besloten dossiers en incidenten niet. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

function wereld() {
  const db = { data: { lifestyle: {} }, writable: true }, vragen = [];
  const stand = { beperkt: false };
  const kern = { aanmeldingen: { automatisch: { magDienst: (id, d) => {
    vragen.push([id, d]);
    return require('../server/kern/aanmeldingen/abonnementsherstel').magDienst(
      { beperkNieuweBetaaldeDiensten: stand.beperkt }, d);
  } } } };
  const save = () => {};
  const bewerkCollectie = require('../server/db/collectie-bewerken')({ store: 'memory', db, save });
  const lg = require('../server/kern/levensgraaf')({ db, paspoortVervalt: () => null });
  Object.assign(kern, require('../server/kern/bureau')({ db, save, bewerkCollectie, crypto,
    anthropic: null, liveCodename: () => '', levensgraaf: lg.levensgraaf,
    magDienst: require('../server/kern/bureau/diensten')(kern) }));
  return { db, kern, bureau: kern.bureau, stand, vragen };
}

test('nieuwe bureauzaken blokkeren vóór dossiermutatie, ook bijzonder/inkoop en vervalste basisrechten', () => {
  const w = wereld(); w.stand.beperkt = true;
  for (const soort of ['regulier', 'bijzonder', 'inkoop']) {
    const r = w.bureau.caseOpen('user-17', { titel: 'Een nieuw diner', domein: 'gelegenheden', soort,
      basisrecht: 'nazorg', accountId: 999, nieuweBetaaldeDienst: false });
    assert.equal(r.status, 402);
  }
  assert.deepEqual(w.db.data.lifestyle, {});
  assert.ok(w.vragen.every(([id, d]) => id === 17 && d.nieuweBetaaldeDienst === true));
});

test('duurzame bedoeling: nieuwe opdracht geweigerd, eigen replay toegestaan en gewijzigde inhoud conflict', async () => {
  const w = wereld(), b = { titel: 'Transfer', domein: 'vervoer', idem: crypto.randomUUID() };
  w.stand.beperkt = true;
  assert.equal((await w.bureau.caseOpenBedoeling('user-17', b)).status, 402);
  assert.deepEqual(w.db.data.lifestyle, {}, 'ook geen leeg ontvangstregister');
  w.stand.beperkt = false;
  const eerste = await w.bureau.caseOpenBedoeling('user-17', b);
  assert.equal(eerste.ok, true); w.stand.beperkt = true;
  const replay = await w.bureau.caseOpenBedoeling('user-17', b);
  assert.equal(replay.herhaald, true); assert.equal(replay.zaak.id, eerste.zaak.id);
  assert.equal((await w.bureau.caseOpenBedoeling('user-17', { ...b, titel: 'Andere reis' })).status, 409);
  assert.equal((await w.bureau.caseOpenBedoeling('user-18', b)).status, 402, 'andere actor heeft geen replayrecht');
  assert.equal(w.db.data.lifestyle['user-17'].cases.length, 1);
});

test('lusintake deelt de poort, maar bestaande case, toelichting en intrekking blijven beschikbaar', () => {
  const w = wereld(), b = { zin: 'Een tafel morgen voor 2 personen in Utrecht.', sleutel: 'bureau-lus-0123456789' };
  const eerste = w.bureau.lusIntake('user-17', b); assert.equal(eerste.ok, true);
  w.stand.beperkt = true;
  assert.equal(w.bureau.lusIntake('user-17', b).herhaald, true);
  assert.equal(w.bureau.lusIntake('user-17', { ...b, sleutel: 'bureau-lus-nieuw-0123456789' }).status, 402);
  assert.equal(w.bureau.lusToelichting('user-17', eerste.zaak.id, 'Graag de bestaande afspraak aanpassen.').ok, true);
  assert.equal(w.bureau.lusLid('user-17', eerste.zaak.id).id, eerste.zaak.id);
  assert.equal(w.bureau.caseIntrek('user-17', eerste.zaak.id).ok, true);
  assert.equal(w.db.data.lifestyle['user-17'].cases.length, 1);
});

test('incidenten en besloten gezondheid/nalatenschap blijven bereikbaar, zonder externe deelopdrachten', async () => {
  const w = wereld(); w.stand.beperkt = true;
  const incident = await w.bureau.caseOpenBedoeling('user-17', { titel: 'Hulp na incident', soort: 'warroom', idem: 'nood-1' });
  assert.equal(incident.ok, true); assert.equal(incident.zaak.status, 'in uitvoering');
  assert.ok(incident.zaak.team.some(x => x.rol === 'Incidentcoördinator'));
  for (const domein of ['gezondheid', 'nalatenschap']) {
    const r = w.bureau.caseOpen('user-17', { titel: 'Mijn eigen gegevens', domein });
    assert.equal(r.ok, true); assert.equal(r.zaak.besloten, true);
    assert.deepEqual(r.zaak.team, [{ rol: 'U zelf' }]); assert.deepEqual(r.zaak.deelopdrachten, []);
  }
  assert.ok(w.vragen.every(([, d]) => d.basisrecht === 'nazorg'));
});

test('een eerder geopende zaak kan nog worden goedgekeurd en afgehandeld', () => {
  const w = wereld(), r = w.bureau.caseOpen('user-17', { titel: 'Bestaande transfer', domein: 'vervoer' });
  assert.equal(r.ok, true); assert.equal(r.zaak.beslissing.nodig, true);
  w.stand.beperkt = true;
  assert.equal(w.bureau.caseBeslis('user-17', r.zaak.id, true).ok, true);
  assert.equal(w.bureau.cases('user-17').zaken[0].status, 'in uitvoering');
});

test('echte ondertekende Lifestyle-policy bereikt beide bureau-intakes en herstelt na betaling', async () => {
  const f = await require('./abonnementsdiensten-fixture.cjs').fixture('lifestyle'), w = wereld();
  w.kern.aanmeldingen.automatisch = require('../server/kern/aanmeldingen/abonnementen')({ db: f.db, accounts: {}, nu: () => f.stand.at });
  const b = { titel: 'Transfer', idem: 'getekend-bureau-1' };
  assert.equal((await w.bureau.caseOpenBedoeling('user-1', b)).ok, true);
  f.beperk();
  assert.equal((await w.bureau.caseOpenBedoeling('user-1', { ...b, idem: 'getekend-bureau-2' })).status, 402);
  assert.equal(w.bureau.lusIntake('user-1', { zin: 'Diner morgen in Utrecht', sleutel: 'getekend-lus-0123456789' }).status, 402);
  assert.equal((await w.bureau.caseOpenBedoeling('user-1', b)).herhaald, true);
  assert.equal(w.bureau.caseOpen('user-1', { titel: 'Medische gegevens', domein: 'gezondheid' }).ok, true);
  f.betaal();
  assert.equal(w.bureau.lusIntake('user-1', { zin: 'Diner morgen in Utrecht', sleutel: 'getekend-lus-0123456789' }).ok, true);
});
