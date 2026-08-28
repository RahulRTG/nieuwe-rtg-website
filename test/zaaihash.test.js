/* DE ZAAI-HASH, EN DE GRENS ERONDER.

   De demo-seed maakte bij elke serverstart 220 scrypt-hashes voor 4
   verschillende wachtwoorden. scrypt is met opzet duur, dus dat was 7,3 van de
   10,6 seconden die een start kostte -- en de toetsen starten per CI-ronde
   bijna negenhonderd servers. kluis.zaaiHash rekent per wachtwoord nog een keer.

   Wat hier vastligt is niet de snelheid maar de GRENS: gedeeld zout hoort bij
   een wachtwoord dat in de broncode staat, en nergens anders. Zakt een van deze
   toetsen, dan is die grens weg en niet alleen de winst.

   MUTATIES die zijn gedraaid en welke toets erop zakte (LAT.md regel 2):
   - de RTG_DEMO-grendel uit zaaiHash gehaald
     -> "zaaiHash bestaat niet buiten de demostand" ZAKT (RAAK)
   - de kast niets meer laten onthouden (dus weer een hash per account)
     -> "zaaiHash geeft hetzelfde wachtwoord dezelfde hash" en
        "de seed rekent nog een handvol hashes uit" ZAKKEN allebei (RAAK)
   - hashPasswordSync -- de ECHTE weg -- ook laten onthouden
     -> "de echte weg houdt per rij zijn eigen zout" ZAKT (RAAK)
   - en de mutatiemotor zelf: met de liegpoort over /api/ komt de eigenaar niet
     meer binnen -> "de seed rekent nog een handvol hashes uit" ZAKT (RAAK)

   Los: node --experimental-sqlite --test test/zaaihash.test.js */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const kluis = require('../server/accounts/kluis');
const { startServer, stop } = require('./helper');

function inDemostand(doe) {
  const was = process.env.RTG_DEMO;
  process.env.RTG_DEMO = '1';
  try { return doe(); } finally {
    if (was === undefined) delete process.env.RTG_DEMO; else process.env.RTG_DEMO = was;
  }
}

test('zaaiHash bestaat niet buiten de demostand', () => {
  const was = process.env.RTG_DEMO;
  delete process.env.RTG_DEMO;
  try {
    assert.throws(() => kluis.zaaiHash('werk'), /demostand/);
    process.env.RTG_DEMO = '0';
    assert.throws(() => kluis.zaaiHash('werk'), /demostand/);
  } finally {
    if (was === undefined) delete process.env.RTG_DEMO; else process.env.RTG_DEMO = was;
  }
});

test('zaaiHash geeft hetzelfde wachtwoord dezelfde hash, en die hash werkt gewoon', async () => {
  const a = inDemostand(() => kluis.zaaiHash('werk'));
  const b = inDemostand(() => kluis.zaaiHash('werk'));
  assert.equal(a, b, 'twee demo-accounts met hetzelfde wachtwoord delen hun hash');
  assert.match(a, /^[0-9a-f]{32}:[0-9a-f]{128}$/, 'zelfde vorm als elke andere hash');
  assert.equal(await kluis.verifyPassword('werk', a), true);
  assert.equal(await kluis.verifyPassword('Werk', a), false);
});

/* DE ANDERE KANT VAN DIEZELFDE GRENS. createStaffSync loopt OOK op een echte
   weg -- de eigenaar-PIN bij een goedgekeurde bedrijfsaanmelding
   (kern/aanmeldingen/bedrijf.js) -- en een PIN is vier cijfers. Zou de echte weg
   ooit ook zout gaan delen, dan staat in supplier_staff af te lezen wie
   dezelfde PIN koos, en dan is dit geen microseconde-optimalisatie meer maar een
   lek. Deze toets zakt zodra hashPasswordSync gaat onthouden. */
test('de echte weg houdt per rij zijn eigen zout', () => {
  const een = kluis.hashPasswordSync('1234');
  const twee = kluis.hashPasswordSync('1234');
  assert.notEqual(een, twee, 'hashPasswordSync mag nooit gaan onthouden');
  assert.notEqual(een.split(':')[0], twee.split(':')[0], 'elk zout eigen');
});

/* DE ZAAI-HASH BLIJFT BIJ DE SEED. Een grendel die niemand aanroept beschermt
   niets, en een grendel die overal wordt aangeroepen is geen grendel meer.
   scripts/check.js bewaakt dezelfde lijst; deze toets bewaakt dat check.js dat
   werkelijk doet, zodat de regel niet stilzwijgend uit de keuring valt. */
test('alleen de seed mag de zaai-hash aanroepen', () => {
  const bron = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'check.js'), 'utf8');
  assert.match(bron, /zaaiHash/, 'check.js hoort de zaai-hash te bewaken');
  assert.match(bron, /createStaffZaai/, 'check.js hoort ook de personeelsvariant te noemen');
});

/* EN DE METING ZELF, want een belofte over rekenwerk die niemand narekent is
   een voornemen. Deze toets start een echte server met een telraam ervoor en
   kijkt hoeveel scrypt-hashes de seed nog maakt. Waren er 220; vier is er een
   per demo-wachtwoord. De grens staat op tien, zodat een demo-wachtwoord erbij
   mag komen en tweehonderd niet.

   EN DAARNA LOGT HIJ IN, en dat is niet voor de sier. Een hash die goedkoop
   gemaakt is maar niemand meer binnenlaat, is geen besparing maar een kapotte
   seed -- en dat zou een telraam nooit zien. De demo-eigenaar loopt hier de
   echte inlogroute af met het wachtwoord uit de seed. */
test('de seed rekent nog een handvol hashes uit, en die hash logt gewoon in', async () => {
  const map = fs.mkdtempSync(path.join(os.tmpdir(), 'zaaitel-'));
  const telling = path.join(map, 'telling.json');
  const telraam = path.join(map, 'telraam.js');
  fs.writeFileSync(telraam, `
    const crypto = require('crypto'), fs = require('fs');
    const echt = crypto.scryptSync;
    let n = 0;
    crypto.scryptSync = function (...a) { n++; return echt.apply(crypto, a); };
    setInterval(() => { try { fs.writeFileSync(${JSON.stringify(telling)}, String(n)); } catch (e) {} }, 200).unref();
  `);
  let srv;
  try {
    srv = await startServer({ env: { NODE_OPTIONS: '-r ' + telraam } });
    await new Promise(r => setTimeout(r, 600));  // het telraam schrijft elke 200 ms
    const n = Number(fs.readFileSync(telling, 'utf8'));
    assert.ok(n > 0, 'het telraam heeft niets gezien; dan stelt deze toets niets vast');
    assert.ok(n <= 10, 'de seed maakte ' + n + ' scrypt-hashes; de zaai-hash is stuk of iemand zaait weer per account');

    const inlog = await (await fetch(srv.base + '/api/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ login: 'roellie.i@gmail.com', password: 'Imran', pasApp: 'business' })
    })).json();
    assert.ok(inlog && inlog.token, 'de eigenaar komt niet binnen met het seed-wachtwoord: ' + JSON.stringify(inlog).slice(0, 200));
  } finally {
    if (srv) stop(srv.child);
    fs.rmSync(map, { recursive: true, force: true });
  }
});
