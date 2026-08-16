/* De uploadgrens in het klein: bytes staan tijdens de keuring in een aparte
   map, bereiken de route alleen na de eigen én externe scan, en blijven bij
   geen enkel oordeel als terugvindbaar virusbestand liggen. */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const net = require('net');
const os = require('os');
const path = require('path');
const { maakUploadquarantaine, UploadGeweigerd } = require('../server/kern/uploadquarantaine');
const { maakClamd } = require('../server/kern/clamd');

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);
const dataUrl = b => 'data:image/png;base64,' + b.toString('base64');
const oordeel = (verdict, b) => ({ verdict, redenen: verdict === 'schoon' ? [] : ['test'],
  bytes: b.length, sha256: require('crypto').createHash('sha256').update(b).digest('hex'), entropie: 0 });

function werkmap() { return fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-quarantaine-')); }

test('schone bytes staan alleen tijdens de dubbele keuring in quarantaine', async () => {
  const dir = werkmap();
  let gezien = false;
  const antivirus = { verwerk: b => oordeel('schoon', b) };
  const q = maakUploadquarantaine({ dir, antivirus, clamd: {
    async scanBestand(p) {
      gezien = fs.existsSync(p) && fs.statSync(p).mode % 0o1000 === 0o600;
      assert.deepEqual(fs.readFileSync(p), PNG);
      return { verdict: 'schoon' };
    }
  } });
  try {
    const r = await q.keurDataUrl(dataUrl(PNG), { bron: 'test' });
    assert.equal(r.ok, true);
    assert.equal(gezien, true);
    assert.deepEqual(fs.readdirSync(q.map), [], 'na vrijgave blijft geen kopie achter');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('besmet en een defecte externe scanner falen dicht en laten niets liggen', async () => {
  for (const soort of ['besmet', 'defect']) {
    const dir = werkmap();
    let extern = 0;
    const antivirus = { verwerk: b => oordeel(soort === 'besmet' ? 'besmet' : 'schoon', b) };
    const q = maakUploadquarantaine({ dir, antivirus, clamd: { async scanBestand() {
      extern++;
      if (soort === 'defect') throw new Error('engine weg');
      return { verdict: 'schoon' };
    } } });
    try {
      await assert.rejects(q.keurDataUrl(dataUrl(PNG)), soort === 'besmet' ? UploadGeweigerd : /engine weg/);
      assert.equal(extern, soort === 'besmet' ? 0 : 1);
      assert.deepEqual(fs.readdirSync(q.map), []);
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  }
});

test('een ClamAV-treffer wordt ook op het beveiligingsbord geregistreerd', async () => {
  const dir = werkmap();
  const gemeld = [];
  const antivirus = {
    verwerk: b => oordeel('schoon', b),
    registreerExtern: (r, meta) => gemeld.push({ r, meta })
  };
  const q = maakUploadquarantaine({ dir, antivirus, clamd: {
    async scanBestand() { return { verdict: 'besmet', naam: 'Win.Test.Agent' }; }
  } });
  try {
    await assert.rejects(q.keurDataUrl(dataUrl(PNG), { bron: '1.2.3.4' }), UploadGeweigerd);
    assert.equal(gemeld.length, 1);
    assert.match(gemeld[0].r.redenen[0], /Win\.Test\.Agent/);
    assert.equal(gemeld[0].meta.bron, '1.2.3.4');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('de ClamAV-client spreekt het begrensde INSTREAM-protocol', async () => {
  const dir = werkmap();
  const bestand = path.join(dir, 'scan.bin');
  fs.writeFileSync(bestand, PNG);
  let ontvangen = Buffer.alloc(0);
  const server = net.createServer(sok => {
    let invoer = Buffer.alloc(0), kop = false;
    sok.on('data', stuk => {
      invoer = Buffer.concat([invoer, stuk]);
      if (!kop) {
        if (invoer.length < 10) return;
        assert.equal(invoer.subarray(0, 10).toString('latin1'), 'zINSTREAM\0');
        invoer = invoer.subarray(10); kop = true;
      }
      while (invoer.length >= 4) {
        const n = invoer.readUInt32BE(0);
        if (invoer.length < 4 + n) return;
        invoer = invoer.subarray(4);
        if (n === 0) {
          assert.deepEqual(ontvangen, PNG);
          sok.end('stream: Eicar-Test-Signature FOUND\0');
          return;
        }
        ontvangen = Buffer.concat([ontvangen, invoer.subarray(0, n)]);
        invoer = invoer.subarray(n);
      }
    });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const c = maakClamd({ host: '127.0.0.1', port: server.address().port, timeout: 2000 });
    const r = await c.scanBestand(bestand);
    assert.equal(r.verdict, 'besmet');
    assert.equal(r.naam, 'Eicar-Test-Signature');
  } finally {
    await new Promise(resolve => server.close(resolve));
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('een body met te veel of ongeldige data-URL inhoud wordt vóór de route geweigerd', async () => {
  const dir = werkmap();
  const q = maakUploadquarantaine({ dir, antivirus: { verwerk: b => oordeel('schoon', b) }, clamd: null });
  try {
    await assert.rejects(q.keurBody({ foto: 'data:image/png;base64,####' }), UploadGeweigerd);
    await assert.rejects(q.keurBody({ fotos: Array.from({ length: 25 }, () => dataUrl(PNG)) }), /Te veel/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
