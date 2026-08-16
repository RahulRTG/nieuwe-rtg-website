'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const maak = require('../server/kern/magnaat-trainingslobby');

function model() {
  return { meta: { hash: 'release-team', releaseModel: 'vier-ogen-v2' }, snapshot: {
    code: 'TEAM', naam: 'Teampraktijk', type: 'software', stad: 'Amsterdam',
    rollen: [
      { id: 'operator', naam: 'Operator', rechten: ['bekijken', 'oefenen'] },
      { id: 'lead', naam: 'Lead', rechten: ['bekijken', 'oefenen', 'goedkeuren'] }
    ],
    werkprocessen: [{ id: 'incident', naam: 'Incidentregie', doel: 'Herstel',
      stappen: ['Controleer impact', 'Stabiliseer de dienst', 'Draag aantoonbaar over'] }]
  } };
}

function omgeving() {
  const db = { data: {} }, seintjes = [];
  let gedeeld = {}, staart = Promise.resolve(), faalVolgende = false;
  function bewerkCollectie(sleutel, werk) {
    const beurt = staart.then(async () => {
      const kopie = structuredClone(gedeeld[sleutel] || db.data[sleutel] || {});
      const uitkomst = werk(kopie);
      await new Promise(resolve => setImmediate(resolve));
      if (faalVolgende) { faalVolgende = false; throw new Error('gesimuleerde commitstoring'); }
      gedeeld[sleutel] = kopie;
      db.data[sleutel] = structuredClone(kopie);
      return uitkomst;
    });
    staart = beurt.catch(() => {});
    return beurt;
  }
  const lobby = maak({ db, crypto, save() { throw new Error('atomair pad mag save() niet gebruiken'); }, bewerkCollectie,
    partnerstudio: { trainingsmodel: code => code === 'TEAM' ? model() : null },
    codenaamVan: key => ({ host: 'Atlas', gast: 'Nova' })[key],
    sseToCustomer: (key, event, data) => seintjes.push({ key, event, data }) });
  return { db, lobby, seintjes, faal: () => { faalVolgende = true; } };
}

test('250 gelijktijdige oude teamkamercommando’s leveren één commit en directe SSE op', async () => {
  const { lobby, seintjes } = omgeving();
  let kamer = (await lobby.maak('host', { code: 'TEAM' })).kamer;
  await lobby.deelnemen('gast', kamer.toegangscode);
  kamer = (await lobby.mijn('host', kamer.id)).kamer;
  seintjes.length = 0;
  const revisie = kamer.revisie;
  const uitslagen = await Promise.all(Array.from({ length: 250 }, () =>
    lobby.kiesRol('host', kamer.id, 'operator', revisie)));
  assert.equal(uitslagen.filter(x => x.ok).length, 1);
  assert.equal(uitslagen.filter(x => x.status === 409).length, 249);
  const actueel = (await lobby.mijn('host', kamer.id)).kamer;
  assert.equal(actueel.revisie, revisie + 1);
  assert.equal(seintjes.length, 2, 'alleen de ene commit seint beide deelnemers');
  assert.ok(seintjes.every(x => x.event === 'sync' && x.data.scope === 'magnaat-teamkamer'));
  assert.equal(JSON.stringify(seintjes).includes('"hostKey"'), false);
});

test('een commitstoring bevestigt niets, seint niets en laat de revisie intact', async () => {
  const { lobby, seintjes, faal } = omgeving();
  let kamer = (await lobby.maak('host', { code: 'TEAM' })).kamer;
  await lobby.deelnemen('gast', kamer.toegangscode);
  kamer = (await lobby.mijn('host', kamer.id)).kamer;
  seintjes.length = 0;
  faal();
  await assert.rejects(lobby.kiesRol('host', kamer.id, 'operator', kamer.revisie), /commitstoring/);
  const actueel = (await lobby.mijn('host', kamer.id)).kamer;
  assert.equal(actueel.revisie, kamer.revisie);
  assert.equal(actueel.ik.rolId, null);
  assert.deepEqual(seintjes, []);
});
