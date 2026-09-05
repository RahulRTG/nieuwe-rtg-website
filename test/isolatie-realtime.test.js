/* De persoonlijke SSE-deur: een handshake is geen eeuwigdurende machtiging.
   Draai los: node --test test/isolatie-realtime.test.js */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const maakIsolatie = require('../server/kern/isolatie');
const functies = require('../server/functies');
const poort = require('../server/middleware/isolatiepoort');
const realtime = require('../server/middleware/isolatiepoort-realtime');
const dragers = require('../server/kern/isolatie/sessiedragers');
const intrekking = require('../server/kern/intreksignaal');
const { maakSse } = require('../server/kern/sse');

function antwoord() {
  return {
    tekst: '', writableEnded: false,
    write(s) { this.tekst += String(s); return true; },
    end() { this.writableEnded = true; }
  };
}

function opstelling() {
  const db = { data: {} };
  const iso = maakIsolatie({ db, save() {}, functies, klok: null, huisStand: () => 'normaal' });
  let sessie = { tier: 'rtg', key: 'user-live', account: { id: 7 }, sid: 'aaaaaaaaaaaa' };
  dragers.zetSessieOplosser(() => sessie);
  poort.zetLaag(null);
  poort.zetLaag(iso, { afdwingen: true });
  const bus = { subscribe() {} };
  return { iso, maakSse: () => maakSse({ bus }), trekIn: () => { sessie = null; },
    fout: () => { dragers.zetSessieOplosser(() => { throw new Error('intreklijst onleesbaar'); }); } };
}

test.afterEach(() => {
  realtime._wis();
  poort.zetLaag(null);
  poort._wisTelling();
  dragers.zetSessieOplosser(null);
});

test('1. een al geisoleerde identiteit kan geen nieuwe persoonlijke stream openen', () => {
  const { iso } = opstelling();
  iso.zet({ drager: 'identiteit', sleutel: 'user-live', naar: 'isolatie',
    door: 'toets', reden: 'verdachte live-sessie' });
  const res = antwoord();
  const uit = realtime.registreer({ res, token: 'token-live',
    sessie: { tier: 'rtg', key: 'user-live', account: { id: 7 } } });
  assert.equal(uit.toegestaan, false);
  assert.equal(uit.status, 503);
  assert.equal(uit.antwoord.reden, 'ISOLATIE_REALTIME_DICHT');
  assert.equal(res.tekst, '', 'voor de weigering zijn nog geen SSE-headers of gegevens geschreven');
});

test('2. een nieuwe isolatiestand sluit een bestaande lokale stream direct', () => {
  const { iso } = opstelling();
  const res = antwoord();
  const open = realtime.registreer({ res, token: 'token-live',
    sessie: { tier: 'rtg', key: 'user-live', account: { id: 7 } } });
  assert.equal(open.toegestaan, true);
  iso.zet({ drager: 'identiteit', sleutel: 'user-live', naar: 'isolatie',
    door: 'toets', reden: 'verdachte live-sessie' });
  assert.equal(realtime.sluitDrager('identiteit', 'user-live'), 1);
  assert.equal(res.writableEnded, true, 'de open verbinding is niet tot de volgende heartbeat blijven leven');
});

test('3. tokenintrekking geldt voor de eerstvolgende payload en lekt geen halve SSE-frame', () => {
  const { maakSse: bouw, trekIn } = opstelling();
  const res = antwoord();
  assert.equal(realtime.registreer({ res, token: 'token-live',
    sessie: { tier: 'rtg', key: 'user-live', account: { id: 7 } } }).toegestaan, true);
  const sse = bouw();
  assert.equal(sse.sseSend(res, 'voor', { zichtbaar: true }), true);
  const voor = res.tekst;
  trekIn();
  assert.equal(sse.sseSend(res, 'geheim', { magNietLekken: true }), false);
  assert.equal(res.tekst, voor, 'na intrekking is geen id-, event- of dataregel geschreven');
  assert.equal(res.writableEnded, true);
});

test('4. onzekerheid in sessie/intreklijst of isolatie-opslag faalt realtime dicht', () => {
  const a = opstelling();
  const resA = antwoord();
  realtime.registreer({ res: resA, token: 'token-live',
    sessie: { tier: 'rtg', key: 'user-live', account: { id: 7 } } });
  a.fout();
  assert.equal(a.maakSse().sseSend(resA, 'geheim', { x: 1 }), false);
  assert.equal(resA.tekst, '');
  assert.equal(resA.writableEnded, true);

  realtime._wis();
  dragers.zetSessieOplosser(() => ({ tier: 'rtg', key: 'user-live', account: { id: 7 } }));
  const kapot = maakIsolatie({ db: { data: { isolatie: { identiteit: [] } } },
    save() {}, functies, klok: null, huisStand: () => 'normaal' });
  poort.zetLaag(null);
  poort.zetLaag(kapot, { afdwingen: true });
  const resB = antwoord();
  const uit = realtime.registreer({ res: resB, token: 'token-live',
    sessie: { tier: 'rtg', key: 'user-live', account: { id: 7 } } });
  assert.equal(uit.toegestaan, false);
  assert.equal(uit.antwoord.reden, 'ISOLATIE_ONBEPAALD');
  assert.equal(resB.tekst, '');
});

test('5. een token- of sid-intrekking sluit de bestaande stream synchroon', () => {
  opstelling();
  const resToken = antwoord();
  realtime.registreer({ res: resToken, token: 'token-live',
    sessie: { tier: 'rtg', key: 'user-live', account: { id: 7 }, sid: 'aaaaaaaaaaaa' } });
  assert.equal(intrekking.meldToken('token-live'), true);
  assert.equal(resToken.writableEnded, true,
    'de lokale stream blijft niet op een payload of heartbeat wachten');

  const resSid = antwoord();
  realtime.registreer({ res: resSid, token: 'ander-token',
    sessie: { tier: 'rtg', key: 'user-live', account: { id: 7 }, sid: 'bbbbbbbbbbbb' } });
  assert.equal(intrekking.meldSessie('bbbbbbbbbbbb'), true);
  assert.equal(resSid.writableEnded, true);
});
