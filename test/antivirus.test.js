/* Tests voor De Ontsmetter (server/kern/antivirus.js): de platform-malware-
   scanner. Handtekeningen, magie-controle, extensies en entropie.
   Draai: node --test test/antivirus.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const maakAv = require('../server/kern/antivirus');

function av() { return maakAv({ db: { data: {} }, save() {} }); }

// De officiele EICAR-teststring (industriestandaard om een scanner te toetsen).
const EICAR = 'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*';
// echte PNG-magie + minimale bytes
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);

test('EICAR-testbestand wordt als besmet herkend', () => {
  const r = av().scan(Buffer.from(EICAR), { naam: 'test.com', mime: 'application/octet-stream' });
  assert.equal(r.verdict, 'besmet');
  assert.ok(r.redenen.some(x => /EICAR/.test(x)));
});

test('een echte PNG is schoon', () => {
  const r = av().scan(PNG, { naam: 'pasfoto.png', mime: 'image/png' });
  assert.equal(r.verdict, 'schoon', r.redenen.join(','));
});

test('een uitvoerbaar bestand (PE/MZ) is besmet', () => {
  const r = av().scan(Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03]), { naam: 'x.bin', mime: 'application/octet-stream' });
  assert.equal(r.verdict, 'besmet');
  assert.ok(r.redenen.some(x => /PE\/MZ/.test(x)));
});

test('PHP verstopt in een "afbeelding" is besmet (polyglot)', () => {
  const buf = Buffer.concat([PNG, Buffer.from('<?php system($_GET[0]); ?>')]);
  const r = av().scan(buf, { naam: 'foto.png', mime: 'image/png' });
  assert.equal(r.verdict, 'besmet');
  assert.ok(r.redenen.some(x => /PHP/.test(x)));
});

test('type-vervalsing: bytes zijn een .exe maar het heet image/png', () => {
  const r = av().scan(Buffer.from([0x4d, 0x5a, 0x00, 0x11, 0x22]), { naam: 'foto.png', mime: 'image/png' });
  assert.equal(r.verdict, 'besmet');
  assert.ok(r.redenen.some(x => /type-vervalsing|PE\/MZ/.test(x)));
});

test('dubbele/gevaarlijke extensie wordt gemarkeerd', () => {
  const r = av().scan(PNG, { naam: 'vakantie.jpg.exe', mime: 'application/octet-stream' });
  assert.equal(r.verdict, 'besmet');
  assert.ok(r.redenen.some(x => /extensie/.test(x)));
});

test('hoge entropie op niet-beeld wordt verdacht', () => {
  // pseudo-random bytes = ~8 bits entropie
  const buf = require('crypto').randomBytes(4096);
  const r = av().scan(buf, { naam: 'data.txt', mime: 'text/plain' });
  assert.equal(r.verdict, 'verdacht', r.redenen.join(','));
  assert.ok(r.redenen.some(x => /entropie/.test(x)));
});

test('verwerk telt mee en meldt op het bord bij besmetting', () => {
  const meldingen = [];
  const a = maakAv({ db: { data: {} }, save() {}, beveilig: { meld: (t, e, tk, m) => meldingen.push({ t, e }) } });
  a.verwerk(Buffer.from(EICAR), { naam: 'x', mime: 'application/octet-stream', bron: '1.2.3.4' });
  a.verwerk(PNG, { naam: 'ok.png', mime: 'image/png' });
  const s = a.stand();
  assert.equal(s.totaal, 2);
  assert.equal(s.besmet, 1);
  assert.equal(s.schoon, 1);
  assert.ok(meldingen.some(m => m.t === 'malware' && m.e === 'kritiek'));
});

test('besmette upload stelt voor de bron af te snijden (De Wacht)', () => {
  const voorstellen = [];
  const a = maakAv({ db: { data: {} }, save() {}, wacht: { voorstel: (v) => voorstellen.push(v) } });
  a.verwerk(Buffer.from(EICAR), { naam: 'x', mime: 'application/octet-stream', bron: '9.9.9.9' });
  assert.equal(voorstellen.length, 1);
  assert.equal(voorstellen[0].actie.soort, 'quarantaine');
  assert.equal(voorstellen[0].actie.bron, '9.9.9.9');
});

test('scanDataUrl decodeert en scant een base64 data-URL', () => {
  const url = 'data:application/octet-stream;base64,' + Buffer.from(EICAR).toString('base64');
  const r = av().scanDataUrl(url, { bron: 'test' });
  assert.equal(r.verdict, 'besmet');
});

test('een nieuwe handtekening toevoegen werkt (updatebare definities)', () => {
  const a = av();
  const voor = a.stand().definities;
  assert.equal(a.voegSignatuurToe({ id: 'eigen', naam: 'Eigen patroon', ernst: 'besmet', type: 'tekst', patroon: 'RTG_KWAADAARDIG' }), true);
  assert.equal(a.stand().definities, voor + 1);
  const r = a.scan(Buffer.from('hallo RTG_KWAADAARDIG daar'), { naam: 'x.txt', mime: 'text/plain' });
  assert.equal(r.verdict, 'besmet');
});
