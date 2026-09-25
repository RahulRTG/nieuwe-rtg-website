/* Het modelmanifest als grendel (TOESTEL.md par. 9.3).

   Een artefact is pas uitvoerbaar als het de vijf stappen haalt, in volgorde:
   sleutel, handtekening, hash, licentie, contract. Deze toets zet per stap een
   regel neer die precies daar hoort te weigeren, en eist dat de weigering ook
   DAAR valt -- een grendel die op de verkeerde stap weigert, heeft de eerdere
   stappen niet gedaan. Daarnaast de drie sleutelstanden, en het eigen
   vertrouwensdomein: een handtekening uit een andere rol geldt hier niet.
   Draai los: node --test test/toestel-manifest.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const M = require('../public/shared/toestel/manifest.js');
const { nieuweSleutel, teken, sha256 } = require('../scripts/lib/toestelteken.js');

const bytes = Buffer.from('dit is een proefartefact');
const s1 = nieuweSleutel('model-2026');
const vertrouwd = (stand) => [{ id: s1.id, publiek: s1.publiek, vanaf: '2026-09-25', stand }];
const basis = () => ({ id: 'proef', versie: '1', soort: 'model', sha256: sha256(bytes), grootte: bytes.length,
  licentie: 'MIT', bron: 'RTG, proef', naamsvermelding: 'RTG', contracten: ['proef.vermenigvuldig'] });
const regel = teken(basis(), { id: s1.id, stand: 'actief' }, s1.privateKey);
const ab = (b) => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);

test('1. een goede regel met de juiste bytes en het juiste contract laadt', async () => {
  const u = await M.controleer(regel, { sleutels: vertrouwd('actief'), bytes: ab(bytes), contract: 'proef.vermenigvuldig' });
  assert.equal(u.ok, true, JSON.stringify(u));
  assert.equal(u.bytesGecontroleerd, true);
  assert.ok(u.eisen.includes('naamsvermelding'));
});

test('2. elke stap weigert op zijn eigen plek', async () => {
  const opts = { sleutels: vertrouwd('actief'), bytes: ab(bytes), contract: 'proef.vermenigvuldig' };
  const vreemd = nieuweSleutel('vreemd');
  const gevallen = [
    ['sleutel', teken(basis(), { id: 'vreemd', stand: 'actief' }, vreemd.privateKey)],
    ['handtekening', Object.assign({}, regel, { versie: '2' })],
    ['hash', regel, { bytes: ab(Buffer.from('dit is een proefartefacT')) }],
    ['hash', regel, { bytes: ab(Buffer.from('korter')) }],
    ['licentie', teken(Object.assign(basis(), { licentie: 'CC-BY-NC-4.0' }), { id: s1.id, stand: 'actief' }, s1.privateKey)],
    ['licentie', teken(Object.assign(basis(), { licentie: '' }), { id: s1.id, stand: 'actief' }, s1.privateKey)],
    ['contract', regel, { contract: 'spraak.naartekst' }]
  ];
  for (const [stap, r, extra] of gevallen) {
    const u = await M.controleer(r, Object.assign({}, opts, extra));
    assert.equal(u.ok, false, stap + ' liet door');
    assert.equal(u.stap, stap, 'verwacht ' + stap + ', kreeg ' + u.stap + ': ' + u.reden);
    assert.ok(u.reden && u.reden.length > 10, 'een weigering draagt een reden');
  }
});

test('3. de sleutelstanden: uitgefaseerd controleert en tekent niet, ingetrokken controleert niets', async () => {
  assert.equal((await M.controleer(regel, { sleutels: vertrouwd('uitgefaseerd') })).ok, true);
  assert.throws(() => teken(basis(), { id: s1.id, stand: 'uitgefaseerd' }, s1.privateKey), /niet meer worden getekend/);
  const weg = await M.controleer(regel, { sleutels: vertrouwd('ingetrokken') });
  assert.equal(weg.ok, false);
  assert.equal(weg.stap, 'sleutel');
  assert.match(weg.reden, /opnieuw ondertekend/);
  assert.equal((await M.controleer(regel, { sleutels: vertrouwd('verzonnen') })).ok, false);
});

test('4. een handtekening zonder het domein RTG:MODEL:v1 geldt niet', async () => {
  /* Dezelfde sleutel, dezelfde regel, maar getekend zoals een andere rol dat
     zou doen: zonder het modelvoorvoegsel. Dat mag hier niets waard zijn. */
  const zonder = M.tekst(regel).slice((M.DOMEIN + '\u0000').length);
  const sig = crypto.sign(null, Buffer.from('RTG:BUILD:v1\u0000' + zonder), s1.privateKey).toString('base64');
  const u = await M.controleer(Object.assign({}, regel, { handtekening: sig }), { sleutels: vertrouwd('actief') });
  assert.equal(u.ok, false);
  assert.equal(u.stap, 'handtekening');
  /* En zonder ENIG voorvoegsel: een handtekening over de kale inhoud, zoals een
     ander protocol die over dezelfde JSON zou zetten. Deze regel stond er eerst
     niet, en toen liet het weghalen van het voorvoegsel de toets groen. */
  const kaal = crypto.sign(null, Buffer.from(zonder), s1.privateKey).toString('base64');
  const u2 = await M.controleer(Object.assign({}, regel, { handtekening: kaal }), { sleutels: vertrouwd('actief') });
  assert.equal(u2.ok, false, 'een handtekening zonder RTG:MODEL:v1 mag niet gelden');
  assert.ok(M.tekst(regel).startsWith('RTG:MODEL:v1\u0000'));
});

test('5. zonder bytes is alleen de belofte gecontroleerd, en dat zegt de uitslag', async () => {
  const u = await M.controleer(regel, { sleutels: vertrouwd('actief') });
  assert.equal(u.ok, true);
  assert.equal(u.bytesGecontroleerd, false);
});

test('6. een veld buiten de getekende set verandert niets aan wat vaststaat', async () => {
  const r = Object.assign({}, regel, { opmerking: 'mag iedereen erbij zetten' });
  assert.equal((await M.controleer(r, { sleutels: vertrouwd('actief') })).ok, true);
  assert.ok(!M.GETEKEND.includes('opmerking'));
});
