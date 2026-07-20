/* Test voor de GEHEUGEN-motor (server/db/geheugen.js): de volledig in-memory
   runtime-engine met versleutelde, incrementele, brok-per-collectie-opslag.
   Toetst het beloofde: correctheid (round-trip), privacy (niets platte tekst op
   schijf), zuinigheid (alleen veranderde brokken herschreven), en veiligheid
   (knoei/corruptie valt op en rolt terug naar de vorige consistente generatie). */
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs'), os = require('os'), path = require('path');

// Een verse datamap + geen RTG_ENC_KEY: zo toetsen we de privacy-by-default
// (de motor maakt en gebruikt zijn eigen sleutel).
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-geheugen-'));
process.env.RTG_DATA_DIR = TMP;
delete process.env.RTG_ENC_KEY;

const state = require('../server/db/state');
const eng = require('../server/db/geheugen');
const GDIR = eng.GDIR;

state.db.writable = true;
const alleBestanden = d => { try { return fs.readdirSync(d).map(n => path.join(d, n)); } catch (e) { return []; } };
const mtimes = () => Object.fromEntries(alleBestanden(GDIR).map(f => [f, fs.statSync(f).mtimeMs]));

test('verse map: nog geen generatie, laden geeft null (dan seedt de app)', () => {
  assert.strictEqual(eng.laadGeheugen(), null);
});

test('round-trip: de data komt op de byte identiek terug van schijf', () => {
  state.db.data = {
    users: { u1: { codename: 'Valk 1', saldo: 100 }, u2: { codename: 'Valk 2', saldo: 0 } },
    orders: [{ ref: 'O1', total: 16 }, { ref: 'O2', total: 40 }],
    __schema: 1
  };
  eng.schrijfGeheugenNu();
  const geladen = eng.laadGeheugen();
  assert.deepStrictEqual(geladen, state.db.data);
});

test('privacy: geen enkel gevoelig veld staat als platte tekst op schijf', () => {
  state.db.data = { kluis: { codename: 'ZoekMijNiet7Q', pin: '424242', saldoCenten: 999 }, __schema: 1 };
  eng.schrijfGeheugenNu();
  const bestanden = alleBestanden(GDIR);
  assert.ok(bestanden.length > 0, 'er moeten brokken op schijf staan');
  for (const f of bestanden) {
    const ruw = fs.readFileSync(f);
    assert.ok(!ruw.includes(Buffer.from('ZoekMijNiet7Q')), 'codenaam lekt in ' + path.basename(f));
    assert.ok(!ruw.includes(Buffer.from('424242')), 'pin lekt in ' + path.basename(f));
    // elke brok begint met de magische markering van een versleuteld blok
    if (f.endsWith('.rtgm')) assert.ok(ruw.subarray(0, 7).equals(Buffer.from('RTGMEM1')), 'brok niet versleuteld: ' + path.basename(f));
  }
});

test('zuinig: alleen de veranderde collectie wordt herschreven', () => {
  state.db.data = { a: { n: 1 }, b: { n: 1 }, c: { n: 1 }, __schema: 1 };
  eng.schrijfGeheugenNu();
  const voor = mtimes();
  // even wachten zodat mtimes echt kunnen verschillen
  const wacht = Date.now() + 15; while (Date.now() < wacht) { /* busy 15ms */ }
  state.db.data.b = { n: 2 };            // alleen b verandert
  eng.schrijfGeheugenNu();
  const na = mtimes();
  // tel de .rtgm-brokken (geen .bak, geen manifest) die van mtime veranderden
  const brokVeranderd = Object.keys(na).filter(f =>
    f.endsWith('.rtgm') && !f.includes('manifest') && voor[f] !== undefined && na[f] !== voor[f]).length;
  assert.strictEqual(brokVeranderd, 1, 'precies één brok (b) hoort herschreven te zijn, niet a en c');
  assert.deepStrictEqual(eng.laadGeheugen(), state.db.data);
});

test('verwijderde collectie: de brok verdwijnt van schijf', () => {
  state.db.data = { blijft: { x: 1 }, gaatWeg: { y: 2 }, __schema: 1 };
  eng.schrijfGeheugenNu();
  const metBeide = alleBestanden(GDIR).filter(f => f.endsWith('.rtgm') && !f.includes('manifest')).length;
  delete state.db.data.gaatWeg;
  eng.schrijfGeheugenNu();
  const naVerwijderen = alleBestanden(GDIR).filter(f => f.endsWith('.rtgm') && !f.includes('manifest') && !f.endsWith('.bak')).length;
  assert.ok(naVerwijderen < metBeide, 'de brok van de verwijderde collectie hoort opgeruimd');
  assert.deepStrictEqual(eng.laadGeheugen(), state.db.data);
});

test('veiligheid: een geknoeide brok valt op en rolt terug naar de vorige generatie', () => {
  // generatie 1
  state.db.data = { geld: { saldo: 500 }, naam: { v: 'een' }, __schema: 1 };
  eng.schrijfGeheugenNu();
  const gen1 = JSON.parse(JSON.stringify(state.db.data));
  // generatie 2 (verandert 'geld', zodat de oude 'geld'-brok als .bak bewaard blijft)
  state.db.data.geld = { saldo: 999 };
  eng.schrijfGeheugenNu();
  // Realistisch: een afgekapte schrijf raakt alleen de brok die NU geschreven
  // werd (die heeft een .bak van de vorige generatie). Flip een byte in precies
  // die brok; onveranderde brokken (zoals 'naam') blijven heel.
  let geknoeid = false;
  for (const f of alleBestanden(GDIR)) {
    if (f.endsWith('.rtgm') && !f.includes('manifest') && !f.endsWith('.bak') && fs.existsSync(f + '.bak')) {
      const buf = fs.readFileSync(f);
      if (buf.length > 40) { buf[buf.length - 1] ^= 0xFF; fs.writeFileSync(f, buf); geknoeid = true; }
    }
  }
  assert.ok(geknoeid, 'er moet een zojuist geschreven brok zijn om mee te knoeien');
  // laden mag NOOIT een half/geknoeid beeld geven: het rolt terug naar generatie 1
  const geladen = eng.laadGeheugen();
  assert.ok(geladen, 'er hoort een consistente generatie herstelbaar te zijn');
  assert.strictEqual(geladen.geld.saldo, gen1.geld.saldo, 'moet terugrollen naar de vorige, consistente generatie');
});

test('manifest kapot: valt terug op de manifest-backup', () => {
  state.db.data = { alpha: { a: 1 }, __schema: 1 };
  eng.schrijfGeheugenNu();                 // generatie 1
  state.db.data.alpha = { a: 2 };
  eng.schrijfGeheugenNu();                 // generatie 2 -> manifest.rtgm.bak = gen1
  const manifest = path.join(GDIR, 'manifest.rtgm');
  fs.writeFileSync(manifest, Buffer.from('kapot-geen-geldig-blok'));
  const geladen = eng.laadGeheugen();
  assert.ok(geladen && geladen.alpha, 'moet uit de manifest-backup kunnen laden');
});
