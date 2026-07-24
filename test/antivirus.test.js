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

test('uitgebreide handtekeningen: webshell, powershell, svg-xss, archief, ransomware', () => {
  const a = av();
  const b = (s, mime) => a.scan(Buffer.from(s), { naam: 'x', mime: mime || 'application/octet-stream' });
  assert.equal(b('<?php proc_open("id"); ?>').verdict, 'besmet', 'proc_open webshell');
  assert.equal(b('powershell -enc SQBFAFgA').verdict, 'besmet', 'powershell -enc');
  assert.equal(b('<svg onerror=alert(1)>').verdict, 'besmet', 'svg onerror xss');
  assert.equal(b('eval(atob("..."))').verdict, 'besmet', 'js eval(atob');
  // ZIP-magie in een niet-beeld upload = verdacht
  assert.equal(a.scan(Buffer.from([0x50,0x4b,0x03,0x04,1,2,3,4]), { naam:'a.zip', mime:'application/zip' }).verdict, 'verdacht');
  // ransomware-notitie
  assert.equal(b('!!! YOUR FILES HAVE BEEN ENCRYPTED !!!').verdict, 'verdacht');
});

test('scanBody vindt een besmette data-URL diep in de body', () => {
  const a = av();
  const eicarUrl = 'data:image/png;base64,' + Buffer.from(EICAR).toString('base64');
  const raak = a.scanBody({ post: { tekst: 'hoi', media: [ { foto: eicarUrl } ] } }, { bron: 't' });
  assert.ok(raak && raak.verdict === 'besmet');
});

test('scanBody laat een schone body met een echte foto met rust', () => {
  const a = av();
  const pngUrl = 'data:image/png;base64,' + PNG.toString('base64');
  assert.equal(a.scanBody({ foto: pngUrl, tekst: 'mooie dag' }, {}), null);
});

test('scanBody negeert gewone tekstvelden (geen data-URL) volledig', () => {
  const a = av();
  // een chatbericht dat toevallig "os.system(" bevat is gewone tekst, geen upload
  assert.equal(a.scanBody({ bericht: 'gebruik os.system() in python voor shell_exec(' }, {}), null);
});

test('veiligeFoto weigert besmet en laat schoon door', () => {
  const a = av();
  const eicarUrl = 'data:image/png;base64,' + Buffer.from(EICAR).toString('base64');
  const pngUrl = 'data:image/png;base64,' + PNG.toString('base64');
  assert.equal(a.veiligeFoto(eicarUrl, {}).ok, false);
  assert.equal(a.veiligeFoto(pngUrl, {}).ok, true);
});

test('een nieuwe handtekening toevoegen werkt (updatebare definities)', () => {
  const a = av();
  const voor = a.stand().definities;
  assert.equal(a.voegSignatuurToe({ id: 'eigen', naam: 'Eigen patroon', ernst: 'besmet', type: 'tekst', patroon: 'RTG_KWAADAARDIG' }), true);
  assert.equal(a.stand().definities, voor + 1);
  const r = a.scan(Buffer.from('hallo RTG_KWAADAARDIG daar'), { naam: 'x.txt', mime: 'text/plain' });
  assert.equal(r.verdict, 'besmet');
});

// --- Multi-laag / obfuscatie: gzip, deflate en geneste base64 afpellen ---

const zlib = require('zlib');

test('EICAR verstopt in gzip wordt door de laag heen betrapt', () => {
  const gz = zlib.gzipSync(Buffer.from(EICAR));
  const r = av().scan(gz, { naam: 'onschuldig.txt', mime: 'application/octet-stream' });
  assert.equal(r.verdict, 'besmet', r.redenen.join(','));
  assert.ok(r.redenen.some(x => /laag 1/.test(x) && /EICAR/.test(x)), r.redenen.join(','));
});

test('webshell verstopt in zlib/deflate wordt betrapt', () => {
  const def = zlib.deflateSync(Buffer.from('<?php eval(base64_decode($_POST[0])); ?>'));
  const r = av().scan(def, { naam: 'blob.bin', mime: 'application/octet-stream' });
  assert.equal(r.verdict, 'besmet', r.redenen.join(','));
  assert.ok(r.redenen.some(x => /laag 1/.test(x)));
});

test('EICAR in dubbele base64 (geneste lagen) wordt betrapt', () => {
  const laag1 = Buffer.from(EICAR).toString('base64');
  const laag2 = Buffer.from(laag1).toString('base64');
  const r = av().scan(Buffer.from(laag2), { naam: 'data.txt', mime: 'text/plain' });
  assert.equal(r.verdict, 'besmet', r.redenen.join(','));
});

test('PE/MZ in gzip-in-base64 (compressie onder een encoding-laag) wordt betrapt', () => {
  const gz = zlib.gzipSync(Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08]));
  const b64 = Buffer.from(gz).toString('base64');
  const r = av().scan(Buffer.from(b64), { naam: 'payload.txt', mime: 'text/plain' });
  assert.equal(r.verdict, 'besmet', r.redenen.join(','));
});

test('schone inhoud in base64 blijft schoon (base64-peel geeft geen vals alarm)', () => {
  // gewone, onschuldige inhoud als base64: de peel-laag decodeert het en vindt
  // niets kwaadaardigs -> schoon (base64-tekst raakt zelf geen container-magie)
  const b64 = Buffer.from('Beste gast, welkom bij Rahul Travel Group. Fijne reis naar Ibiza!').toString('base64');
  const r = av().scan(Buffer.from(b64), { naam: 'brief.txt', mime: 'text/plain' });
  assert.equal(r.verdict, 'schoon', r.redenen.join(','));
});

test('een gzip-bom (klein in, enorm uit) laat ons niet ontploffen', () => {
  // 8 MB nullen comprimeert tot enkele KB's; de MAX_UITPAK-grens moet dit
  // veilig afkappen zonder de scanner te laten crashen of hangen.
  const groot = Buffer.alloc(64 * 1024 * 1024, 0);
  const gz = zlib.gzipSync(groot);
  const r = av().scan(gz, { naam: 'bom.gz', mime: 'application/octet-stream' });
  // niet besmet (nullen raken geen handtekening) en vooral: geen exception
  assert.ok(r.verdict === 'schoon' || r.verdict === 'verdacht');
});
