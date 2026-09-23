/* ELKE SLEUTEL IN DE DATAMAP, ONDER GELIJKTIJDIG OPSTARTEN.

   DE AANLEIDING IS OPNIEUW EEN CI-UITVAL. Op 23 september 2026 viel er in
   test/eigenaar-wedloop.test.js (drie servers tegelijk op EEN datamap) een
   server om met `RangeError: Invalid key length` bij het versleutelen. Dezelfde
   vorm als de zegelsleutel op 15 september (test/zegel-wedloop.test.js), maar
   nu op vault.key: server/accounts/index.js deed existsSync en daarna een kale
   writeFileSync, dus een tweede proces zag het bestand bestaan terwijl de
   inhoud er nog niet was.

   De zegel was toen gerepareerd, en alleen de zegel. De vorm stond nog op acht
   andere plekken (secret.key, vault.key, lifestyle.key, foundation.key,
   geheugen.key, dyncode.key, tafelticket.key, dooszegel.key, en de
   ACME-accountsleutel). Een reparatie die op een plek woont en op negen nodig
   is, is een uitzondering en geen reparatie -- vandaar server/lib/sleutelbestand.js
   en vandaar toets 3 hieronder, die een NIEUWE sleutelschrijver tegenhoudt.

   DRIE BEWERINGEN:
   1. vierentwintig processen die tegelijk de sleutels van de kluis en de
      tokenondertekening laden (de echte weg van server/accounts), vallen niet om
      EN lezen allemaal dezelfde sleutel -- de tweede helft is de stille, want
      met temp+rename wint de laatste schrijver en draagt elk proces een eigen;
   2. een bestaand bestand dat geen sleutel is, wordt NOOIT stil vervangen (dan
      is alles wat ermee versleuteld is voorgoed onleesbaar);
   3. elk bestand onder server/ dat een `.key`-bestand noemt en schrijft, gaat
      langs de helper of staat met reden op de lijst hieronder.

   DE MUTATIES, elk nagetrokken: zet in sleutelbestand.publiceer linkSync terug
   naar een gewone writeFileSync op het doelpad (toets 1 zakt: meerdere sleutels
   of een lege lezing), laat sleutel() een verkeerde lengte stil vervangen
   (toets 2 zakt), en zet in server/kern/tafelticket.js de oude
   readFileSync/writeFileSync terug (toets 3 zakt en noemt het bestand). */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { execFile } = require('node:child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { zonderCommentaar } = require('../scripts/lib/bron');

const WORTEL = path.join(__dirname, '..');
const HOEVEEL = 24;     // gemeten in test/zegel-wedloop.test.js: met acht raakten ze elkaar niet
const RONDES = 2;

/* Het kind doet precies wat server/accounts bij het opstarten doet voor de
   twee sleutels, en drukt ze af. Een startlijn op de wandklok, zodat ze echt
   tegelijk beginnen (zie de kop van test/zegel-wedloop.test.js). */
const KIND = `
const { uitOmgevingOfBestand } = require(${JSON.stringify(path.join(WORTEL, 'server/lib/sleutelbestand.js'))});
const path = require('path');
const start = Number(process.argv[1]), map = process.argv[2];
delete process.env.RTG_SECRET_KEY; delete process.env.RTG_VAULT_KEY;
while (Date.now() < start) { /* spinnen: preciezer dan setTimeout */ }
const a = uitOmgevingOfBestand(path.join(map, 'secret.key'), 'RTG_SECRET_KEY');
const b = uitOmgevingOfBestand(path.join(map, 'vault.key'), 'RTG_VAULT_KEY');
/* Wat in CI omviel: een sleutel die geen 32 bytes is, gooit bij het versleutelen. */
require('crypto').createCipheriv('aes-256-gcm', b, Buffer.alloc(12));
process.stdout.write(a.toString('hex') + ':' + b.toString('hex'));
`;

function ronde() {
  const map = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-sleutelwedloop-'));
  const start = Date.now() + 300;
  const kinderen = [];
  for (let i = 0; i < HOEVEEL; i++) {
    kinderen.push(new Promise((klaar) => {
      execFile(process.execPath, ['-e', KIND, String(start), map], { encoding: 'utf8', timeout: 30000 },
        (fout, uit, err) => klaar(fout ? { ok: false, fout: String(err || fout.message || '').slice(0, 400) }
          : { ok: true, sleutels: String(uit).trim() }));
    }));
  }
  return Promise.all(kinderen).finally(() => { try { fs.rmSync(map, { recursive: true, force: true }); } catch (e) {} });
}

test('vierentwintig processen laden tegelijk de sleutels van de kluis: niemand valt om, iedereen dezelfde', async () => {
  const omgevallen = [];
  let meestePerRonde = 0;
  for (let r = 0; r < RONDES; r++) {
    const gezien = new Set();
    for (const u of await ronde()) { if (!u.ok) omgevallen.push(u.fout); else gezien.add(u.sleutels); }
    meestePerRonde = Math.max(meestePerRonde, gezien.size);
  }
  assert.equal(omgevallen.length, 0, 'processen vielen om bij het gelijktijdig laden van secret.key en vault.key:\n' +
    omgevallen.slice(0, 2).join('\n---\n'));
  assert.equal(meestePerRonde, 1, 'binnen een ronde lazen de processen ' + meestePerRonde + ' verschillende sleutelparen ' +
    'op EEN datamap; dan ontsleutelt het ene proces de kluis van het andere niet meer.');
});

test('een bestand dat geen sleutel is, wordt nooit stil vervangen', () => {
  const { sleutel } = require('../server/lib/sleutelbestand');
  const map = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-sleutelleeg-'));
  try {
    const pad = path.join(map, 'vault.key');
    fs.writeFileSync(pad, '');
    assert.throws(() => sleutel(pad, 32), /NIET vervangen/);
    assert.equal(fs.readFileSync(pad).length, 0, 'het bestand is aangeraakt');
    const goed = Buffer.alloc(32, 7);
    fs.writeFileSync(pad, goed);
    assert.deepEqual(sleutel(pad, 32), goed, 'een bestaande sleutel wordt gelezen zoals hij is');
    const nieuw = path.join(map, 'nieuw.key');
    const k = sleutel(nieuw, 32);
    assert.equal(k.length, 32);
    assert.deepEqual(fs.readFileSync(nieuw), k, 'wat gepubliceerd is, is wat er gelezen wordt');
    assert.deepEqual(fs.readdirSync(map).filter((n) => n.endsWith('.tmp')), [], 'geen tijdelijk bestand achtergelaten');
  } finally { fs.rmSync(map, { recursive: true, force: true }); }
});

/* Plekken die een `.key`-bestand noemen en schrijven, maar met opzet NIET via de
   helper, MET de reden. Een paar (certificaat + sleutel) moet SAMEN verschijnen;
   dat is een andere vorm dan een losse sleutel, en die hoort een eigen reparatie. */
const MET_REDEN = {
  'server/lib/ca.js': 'een sleutelPAAR (ca.crt + ca.key): moet samen gepubliceerd worden, niet los; de interne CA wordt bij de installatie eenmalig gemaakt',
  'server/lib/tls.js': 'een zelfondertekend PAAR als ontwikkelterugval, per proces geldig en elke dag vervangbaar; twee processen met een eigen paar breken niets',
  'server/lokaal-tls.js': 'een opdrachtregelscript voor de lokale ontwikkelmachine; er draait er nooit meer dan een tegelijk'
};

function serverbestanden() {
  const uit = [];
  (function loop(map) {
    for (const e of fs.readdirSync(path.join(WORTEL, map), { withFileTypes: true })) {
      const p = map + '/' + e.name;
      if (e.isDirectory()) { if (e.name !== 'data' && e.name !== 'node_modules') loop(p); }
      else if (p.endsWith('.js')) uit.push(p);
    }
  })('server');
  return uit.sort();
}

test('elke sleutelschrijver onder server/ gaat langs server/lib/sleutelbestand.js, of staat er met reden', () => {
  const buiten = [];
  for (const p of serverbestanden()) {
    if (p === 'server/lib/sleutelbestand.js') continue;
    const code = zonderCommentaar(fs.readFileSync(path.join(WORTEL, p), 'utf8'));
    const noemtSleutel = /['"][\w.-]*\.key['"]/.test(code);
    if (!noemtSleutel) continue;
    const helper = /require\(['"][./]*(?:lib\/)?sleutelbestand['"]\)/.test(code);
    /* Een kale schrijfactie op een sleutelpad: het pad uit een variabele die met
       '.key' eindigt, of rechtstreeks een '.key'-tekst. */
    const variabelen = [...code.matchAll(/(?:const|let|var)\s+(\w+)\s*=\s*[^;\n]*['"][\w.-]*\.key['"]/g)].map((m) => m[1]);
    const kaal = [...code.matchAll(/writeFileSync\(\s*([^,)]+)/g)].map((m) => m[1].trim())
      .filter((arg) => /\.key['"]/.test(arg) || variabelen.includes(arg));
    if (kaal.length && !MET_REDEN[p]) buiten.push(p + ' (schrijft ' + kaal.join(', ') + ' zonder de helper)');
    else if (!kaal.length && !helper && /randomBytes\(/.test(code) && !MET_REDEN[p]) {
      buiten.push(p + ' (noemt een sleutelbestand en maakt willekeurige bytes, maar gebruikt de helper niet)');
    }
  }
  assert.deepEqual(buiten, [], 'deze bestanden schrijven een sleutel buiten server/lib/sleutelbestand.js om. ' +
    'Gebruik sleutel() of leesOfPubliceer(), of zet het bestand met een reden in MET_REDEN.');
  for (const p of Object.keys(MET_REDEN)) {
    assert.ok(fs.existsSync(path.join(WORTEL, p)), p + ' staat in MET_REDEN maar bestaat niet meer');
  }
  /* De negen plekken die deze ronde omgingen, bij naam: de generieke scan hierboven
     kan een variabele missen die anders heet, deze regels niet. */
  const verplicht = {
    'server/accounts/index.js': /sleutelbestand\.uitOmgevingOfBestand\(SECRET_FILE[\s\S]*sleutelbestand\.uitOmgevingOfBestand\(VAULT_FILE/,
    'server/kern/rechterhand/index.js': /sleutelbestand'\)\.sleutel\(f, 32\)/,
    'server/foundation/basis.js': /sleutelbestand'\)\.sleutel\(f, 32\)/,
    'server/db/geheugen-kluis.js': /leesOfPubliceer\(kf,/,
    'server/kern/dyncode.js': /sleutelbestand'\)\.sleutel\(keyPad, 32\)/,
    'server/kern/tafelticket.js': /sleutelbestand'\)\.sleutel\(keyPad, 32\)/,
    'server/kern/zaakdoos/index.js': /sleutelbestand'\)\.sleutel\(zegelPad, 32\)/,
    'server/lib/tls-acme.js': /sleutelbestand'\)\.leesOfPubliceer\(pad,/,
    'server/lib/zegel.js': /require\('\.\/sleutelbestand'\)/
  };
  for (const [p, re] of Object.entries(verplicht)) {
    assert.match(zonderCommentaar(fs.readFileSync(path.join(WORTEL, p), 'utf8')), re, p + ' laadt zijn sleutel niet meer via de helper');
  }
});

test('een sleutel publiceren in een datamap die nog niet bestaat, maakt die map aan', () => {
  /* In CI zakte test/pragmavolgorde.test.js op ENOENT zodra de scherfindeling
     veranderde: er was toevallig nog geen eerdere toets die server/data had
     aangemaakt. Dat mag niet van de volgorde van toetsen afhangen. */
  const fs = require('fs');
  const os = require('os');
  const path = require('path');
  const { publiceer } = require('../server/lib/sleutelbestand');
  const basis = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-sleutelmap-'));
  const pad = path.join(basis, 'nog', 'niet', 'hier', 'secret.key');
  try {
    publiceer(pad, 'abc');
    require('node:assert/strict').equal(fs.readFileSync(pad, 'utf8'), 'abc');
  } finally { fs.rmSync(basis, { recursive: true, force: true }); }
});
