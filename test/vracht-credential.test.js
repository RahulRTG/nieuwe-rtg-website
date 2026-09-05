/* Productiecontract voor de publieke vrachtstatus: 128-bit, hash-only,
   eenmalige uitgifte en alle lifecycle-mutaties onder één collectieslot. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');

const schoon = (waarde, max) => String(waarde == null ? '' : waarde).trim().slice(0, max);
const lijf = idem => ({ idem, klant:'Klant', inhoud:'Vier kisten', gewichtKg:80, colli:4, incoterm:'DAP',
  van:{ plaats:'A', land:'NL' }, naar:{ plaats:'B', land:'BE' },
  etappes:[{ modaliteit:'weg', van:'A', naar:'B' }] });

function opstelling(begin = {}, opties = {}) {
  const db = { writable:true, data:{ vracht:JSON.parse(JSON.stringify(begin)) } };
  let keten = Promise.resolve(), commits = 0;
  const save = () => { if (opties.saveFout) throw new Error('opslag stuk'); commits++; };
  const bewerkCollectie = opties.zonderSlot ? undefined : (sleutel, werk) => {
    const taak = keten.then(() => {
      const concept = JSON.parse(JSON.stringify(db.data[sleutel] || {}));
      const antwoord = werk(concept);
      db.data[sleutel] = concept; commits++;
      return antwoord;
    });
    keten = taak.then(() => undefined, () => undefined);
    return taak;
  };
  const vracht = require('../server/kern/vracht')({ db, save, bewerkCollectie, crypto, schoon }).vracht;
  return { db, vracht, commits:() => commits };
}

test('dezelfde maakopdracht is atomair en geeft de code maar eenmaal uit', async () => {
  const { db, vracht } = opstelling();
  const invoer = lijf('vracht-gelijktijdig-000001');
  const [a, b] = await Promise.all([vracht.maak('EXPEDITIE', invoer), vracht.maak('EXPEDITIE', invoer)]);
  const goed = [a, b].filter(x => x.ok), dubbel = [a, b].filter(x => x.status === 409);
  assert.equal(goed.length, 1);
  assert.equal(dubbel.length, 1);
  assert.match(goed[0].zending.volgcode, /^VRT\.[0-9A-F]{32}$/);
  assert.equal(dubbel[0].zending.volgcode, undefined);
  assert.equal(db.data.vracht.EXPEDITIE.length, 1);
  const opgeslagen = JSON.stringify(db.data.vracht);
  assert.ok(!opgeslagen.includes(goed[0].zending.volgcode));
  assert.match(db.data.vracht.EXPEDITIE[0].volg_toegang.code_hash, /^[a-f0-9]{64}$/);
});

test('rotatie serialiseert voor een claim en bindt de code aan haar zending', async () => {
  const { db, vracht } = opstelling();
  const gemaakt = await vracht.maak('EXPEDITIE', lijf('vracht-rotatie-maak-0001'));
  const oud = gemaakt.zending.volgcode;
  const z = db.data.vracht.EXPEDITIE[0];
  const [rotatie, claim] = await Promise.all([
    vracht.volgcodeRoteer('EXPEDITIE', z.id, 'Planner', 'vracht-rotatie-code-0001'),
    vracht.volg(oud)
  ]);
  assert.equal(rotatie.ok, true);
  assert.equal(claim.status, 404, 'een claim na de rotatiecommit ziet de oude code niet meer');
  assert.equal((await vracht.volg(rotatie.zending.volgcode)).ok, true);
  db.data.vracht.EXPEDITIE[0].volg_toegang.onderwerp.id = 'andere-zending';
  assert.equal((await vracht.volg(rotatie.zending.volgcode)).status, 404, 'onderwerpbinding valt dicht');
});

test('een oude kale volgcode wordt gewist en hard ingetrokken', async () => {
  const oud = 'RTG-A1B2C3D4';
  const begin = { EXPEDITIE:[{ id:'z-oud', ref:'VR-OUD', klant:'K', inhoud:'I', gewichtKg:1, colli:1,
    incoterm:'DAP', van:{plaats:'A',land:'NL'}, naar:{plaats:'B',land:'BE'}, eta:'2026-09-05',
    status:'onderweg', gemaakt:'2026-01-01T00:00:00.000Z', volgcode:oud,
    etappes:[{modaliteit:'weg',van:'A',naar:'B',document:'CMR-vrachtbrief',status:'bezig'}], gebeurtenissen:[] }] };
  const { db, vracht } = opstelling(begin);
  const overzicht = await vracht.overzicht('EXPEDITIE');
  assert.equal(overzicht.zendingen[0].volgcode, undefined);
  assert.equal(db.data.vracht.EXPEDITIE[0].volgcode, undefined);
  assert.equal(db.data.vracht.EXPEDITIE[0].volg_toegang.ingetrokken_door, 'legacy-migratie');
  assert.equal((await vracht.volg(oud)).status, 404);
});

test('opslagfalen lekt geen halve zending naar het geheugen', async () => {
  const { db, vracht } = opstelling({}, { zonderSlot:true, saveFout:true });
  await assert.rejects(Promise.resolve().then(() => vracht.maak('EXPEDITIE', lijf('vracht-save-fout-000001'))), /opslag stuk/);
  assert.deepEqual(db.data.vracht, {});
});

test('de uitgifte- en rotatieroutes kunnen nooit door een antwoordcache worden herhaald', () => {
  const geheim = require('../server/lib/eenmalig-geheim-routes');
  assert.equal(geheim.isEenmalig('POST', '/api/supplier/vracht/maak'), true);
  assert.equal(geheim.isEenmalig('POST', '/api/supplier/vracht/volgcode/roteer'), true);
  assert.equal(geheim.isEenmalig('POST', '/api/supplier/vracht'), false);
});

test('de leverancier-UI toont alleen lifecycle en houdt de verse code vluchtig', () => {
  const delen = ['../public/apps/leverancier/leverancier-43.js',
    '../public/apps/leverancier/leverancier-44.js', '../public/apps/leverancier/leverancier-45.js']
    .map(p => fs.readFileSync(require.resolve(p), 'utf8')).join('\n');
  assert.match(delen, /RTGIdem\('vracht-maak'\)/);
  assert.match(delen, /RTGIdem\('vracht-code'\)/);
  for (const naam of ['vracht-etappe', 'vracht-douane', 'vracht-afleveren', 'vracht-melding'])
    assert.match(delen, new RegExp("RTGIdem\\('" + naam + "'\\)"));
  assert.match(delen, /z\.volgtoegang/);
  assert.doesNotMatch(delen, /esc\(z\.volgcode\)/, 'een lijstkaart mag geen kale code tekenen');
  assert.doesNotMatch(delen, /localStorage[^\n]*volgcode|sessionStorage[^\n]*volgcode/i);
  require('../scripts/bundel').controleer();
});
