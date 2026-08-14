const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const maak = require('../server/kern/ov/operatie');

function kern() {
  const db = { data: {} }; let saves = 0;
  return { api: maak({ db, save: () => { saves++; }, crypto, schoon: (v, n) => String(v || '').replace(/[<>]/g, '').slice(0, n) }), db, saves: () => saves };
}

test('alle vervoerswerelden vormen één afgeschermd concept', () => {
  const { api } = kern();
  const r = api.ovOperatieConcept('k', 'business', { van: 'Rotterdam', naar: 'Monaco', personen: 18,
    modi: ['konvooi', 'privejet', 'helikopter', 'jacht', 'bagage'], rollen: ['hoofdgast', 'familie', 'beveiliging', 'medisch'] });
  assert.equal(r.status, 200); assert.equal(r.operatie.status, 'concept'); assert.equal(r.operatie.segmenten.length, 5);
  assert.equal(r.operatie.privacy.needToKnow, true); assert.equal(r.operatie.veiligheid.betalingBevestigen, true);
  assert.match(r.bevestigCode, /^[0-9A-F]{6}$/);
});

test('RTG/Lifestyle kunnen Private-operaties niet via een verzoek ontsluiten', () => {
  const { api, saves } = kern();
  assert.equal(api.ovOperatieConcept('k', 'rtg', { van: 'A', naar: 'B' }).status, 403);
  assert.equal(api.ovOperatieOverzicht('k', 'lifestyle').status, 403); assert.equal(saves(), 0);
});

test('activeren vraagt de eenmalige code en boekt of betaalt nog niets', () => {
  const { api, db } = kern();
  const c = api.ovOperatieConcept('k', 'business', { van: 'Hotel', naar: 'Stadion', modi: ['chauffeur', 'bus'] });
  assert.equal(api.ovOperatieBevestig('k', 'business', { id: c.operatie.id, code: 'FOUT00' }).status, 403);
  const goed = api.ovOperatieBevestig('k', 'business', { id: c.operatie.id, code: c.bevestigCode });
  assert.equal(goed.operatie.status, 'gereed-voor-boeken');
  assert.ok(goed.operatie.segmenten.every(s => s.status === 'voorbereid' && s.prijs === null && s.bevestigingNodig));
  assert.equal(db.data.rides, undefined, 'de operatie maakt niet stiekem een rit');
});
