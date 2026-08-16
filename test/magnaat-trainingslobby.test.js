'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const maak = require('../server/kern/magnaat-trainingslobby');

function model() {
  return {
    meta: { hash: 'abc123release', releaseModel: 'vier-ogen-v2' },
    snapshot: {
      code: 'ACME', naam: 'Acme Systems', type: 'software', stad: 'Amsterdam',
      rollen: [
        { id: 'operator', naam: 'Operator', rechten: ['bekijken', 'bewerken', 'oefenen'] },
        { id: 'lead', naam: 'Incident lead', rechten: ['bekijken', 'oefenen', 'goedkeuren'] }
      ],
      werkprocessen: [{ id: 'incident', naam: 'Incident veilig afhandelen', doel: 'Herstel met bewijs',
        stappen: ['Controleer impact en bevoegdheid', 'Stabiliseer de dienstverlening', 'Wijs een eigenaar toe', 'Leg bewijs en controlemoment vast'] }]
    }
  };
}

function omgeving() {
  const db = { data: {} }; let saves = 0;
  const namen = { host: 'Atlas', gast: 'Nova', derde: 'Orion' };
  const lobby = maak({ db, crypto, save: () => { saves += 1; }, codenaamVan: k => namen[k],
    partnerstudio: { trainingsmodel: code => code === 'ACME' ? model() : null } });
  return { db, lobby, saves: () => saves };
}

test('een gepubliceerd bedrijf wordt een afgeschermde teamkamer met rollen', () => {
  const { lobby } = omgeving();
  let r = lobby.maak('host', { code: 'ACME' });
  assert.equal(r.kamer.bedrijf.releaseModel, 'vier-ogen-v2');
  assert.equal(r.kamer.regels.echtGeld, false);
  assert.equal(r.kamer.host, true);
  assert.equal(JSON.stringify(r).includes('"key"'), false, 'interne ledensleutels verlaten de server niet');
  const code = r.kamer.toegangscode;
  const gast = lobby.deelnemen('gast', code);
  assert.equal(gast.kamer.team.length, 2);
  assert.equal(gast.kamer.ik.naam, 'Nova');
  assert.equal(lobby.deelnemen('gast', code).herhaald, true);
});

test('start, revisies, taakverdeling en servergezag vormen één gedeelde training', () => {
  const { lobby } = omgeving();
  let host = lobby.maak('host', { code: 'ACME' }).kamer;
  const startTeVroeg = lobby.start('host', host.id, host.revisie, 'start-1');
  assert.equal(startTeVroeg.status, 409);
  let gast = lobby.deelnemen('gast', host.toegangscode).kamer;
  host = lobby.mijn('host', host.id).kamer;
  host = lobby.kiesRol('host', host.id, 'operator', host.revisie).kamer;
  gast = lobby.mijn('gast', host.id).kamer;
  gast = lobby.kiesRol('gast', gast.id, 'lead', gast.revisie).kamer;
  host = lobby.mijn('host', host.id).kamer;
  const oud = host.revisie - 1;
  assert.equal(lobby.start('host', host.id, oud, 'start-1').status, 409, 'een oud scherm start niet');
  host = lobby.start('host', host.id, host.revisie, 'start-1').kamer;
  assert.equal(host.status, 'bezig');
  assert.equal(host.taak.eigenaar.naam, 'Atlas');
  assert.equal(lobby.start('host', host.id, host.revisie, 'start-1').herhaald, true, 'dezelfde opdracht start nooit dubbel');
  assert.equal(lobby.actie('gast', host.id, { actie: 'voltooien', bewijs: 'Ik deed dit buiten mijn taak.', revisie: host.revisie, commandoId: 'fout-1' }).status, 403);
  host = lobby.actie('host', host.id, { actie: 'voltooien', bewijs: 'Impact, bevoegdheid en actuele status gecontroleerd.', revisie: host.revisie, commandoId: 'taak-1' }).kamer;
  assert.equal(host.taak.eigenaar.naam, 'Nova');
  let actueel = lobby.mijn('gast', host.id).kamer;
  actueel = lobby.actie('gast', actueel.id, { actie: 'voltooien', bewijs: 'Dienstverlening gestabiliseerd en risico vastgelegd.', revisie: actueel.revisie, commandoId: 'taak-2' }).kamer;
  actueel = lobby.actie('host', actueel.id, { actie: 'voltooien', bewijs: 'Dossiereigenaar en overdracht aantoonbaar vastgelegd.', revisie: actueel.revisie, commandoId: 'taak-3' }).kamer;
  actueel = lobby.actie('gast', actueel.id, { actie: 'voltooien', bewijs: 'Bewijs en volgend controlemoment als lead goedgekeurd.', revisie: actueel.revisie, commandoId: 'taak-4' }).kamer;
  assert.equal(actueel.status, 'voltooid');
  assert.deepEqual(actueel.voortgang, { klaar: 4, totaal: 4 });
  assert.ok(actueel.log.some(x => x.actie === 'training-voltooid'));
});

test('host kan pauzeren, hervatten en taken veilig aan een teamgenoot overdragen', () => {
  const { lobby } = omgeving();
  let k = lobby.maak('host', { code: 'ACME' }).kamer;
  lobby.deelnemen('gast', k.toegangscode);
  k = lobby.mijn('host', k.id).kamer;
  k = lobby.kiesRol('host', k.id, 'operator', k.revisie).kamer;
  let g = lobby.mijn('gast', k.id).kamer;
  lobby.kiesRol('gast', g.id, 'lead', g.revisie);
  k = lobby.mijn('host', k.id).kamer;
  k = lobby.start('host', k.id, k.revisie, 'start').kamer;
  const gastId = k.team.find(d => !d.ik).id;
  k = lobby.actie('host', k.id, { actie: 'overdragen', naar: gastId, revisie: k.revisie, commandoId: 'overdracht' }).kamer;
  assert.equal(k.taak.eigenaar.naam, 'Nova');
  k = lobby.bedien('host', k.id, 'pauzeren', k.revisie, 'pauze').kamer;
  assert.equal(k.status, 'gepauzeerd');
  assert.equal(lobby.bedien('gast', k.id, 'hervatten', k.revisie, 'geen-host').status, 403);
  k = lobby.bedien('host', k.id, 'hervatten', k.revisie, 'hervat').kamer;
  assert.equal(k.status, 'bezig');
});

test('een buitenstaander kan een teamkamer niet lezen of bedienen', () => {
  const { lobby } = omgeving();
  const k = lobby.maak('host', { code: 'ACME' }).kamer;
  assert.equal(lobby.mijn('derde', k.id).status, 403);
  assert.equal(lobby.kiesRol('derde', k.id, 'lead', k.revisie).status, 403);
  assert.equal(lobby.deelnemen('derde', 'VERKEERD').status, 404);
});
