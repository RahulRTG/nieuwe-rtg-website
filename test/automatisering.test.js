/* De automatiseringen (draaiboeken) op de RTMAIL-rail. Unit-test op het welkom-
   draaiboek met een nep-db, zodat we los kunnen bewijzen dat een nieuw lid een
   welkom in zijn eigen RTMAIL-postvak krijgt -- zonder echte namen (codenaam-privacy).
   node --test test/automatisering.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');

function maak() {
  const db = { data: {} };
  const rtmail = require('../server/kern/rtmail')({ db, save: () => {}, crypto });
  const automatisering = require('../server/kern/automatisering')({ rtmail });
  return { rtmail, automatisering };
}

test('welkom-draaiboek RTG: bericht in het eigen postvak, van de systeem-afzender', () => {
  const { rtmail, automatisering } = maak();
  const m = automatisering.welkomLid({ codename: 'ORCHIDEE', wereld: 'RTG' });
  assert.ok(m, 'er wordt een welkom bezorgd');
  assert.equal(m.van, 'rtg@rtmail');
  assert.equal(m.naar, 'orchidee@rtmail');
  assert.match(m.onderwerp, /Rahul Travel Group/);
  const vak = rtmail.postvak('orchidee');
  assert.equal(vak.length, 1);
  assert.equal(rtmail.ongelezen('orchidee'), 1);
});

test('welkom-draaiboek RTF: het merk staat in het bericht', () => {
  const { automatisering } = maak();
  const m = automatisering.welkomLid({ codename: 'lelie', wereld: 'RTF' });
  assert.match(m.onderwerp, /RTFoundation/);
});

test('codenaam-privacy: een meegegeven echte naam belandt niet in het bericht', () => {
  const { automatisering } = maak();
  // zelfs als er per ongeluk een naam wordt meegegeven, gebruikt het draaiboek
  // alleen de codenaam -- de echte naam blijft in de kluis, niet in RTMAIL.
  const m = automatisering.welkomLid({ codename: 'jasmijn', naam: 'Zeldzame Testnaam', wereld: 'RTG' });
  assert.doesNotMatch(m.tekst, /Zeldzame Testnaam/);
  assert.doesNotMatch(m.onderwerp, /Zeldzame Testnaam/);
});

test('zonder bruikbaar adres gebeurt er niets (geen crash)', () => {
  const { automatisering } = maak();
  assert.equal(automatisering.welkomLid({ codename: '', wereld: 'RTG' }), null);
  assert.equal(automatisering.welkomLid({}), null);
});
